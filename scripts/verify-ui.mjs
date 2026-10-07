import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseNovelAiPngMetadata } from "../src/importers/nai-metadata.js";
import { buildModeGeneratePayload } from "../src/adapters/novelai-v45-generation-modes.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = path.join(root, ".cache", "verification", `run-${Date.now()}`);
const screens = path.join(root, "manuals", "screenshots");
await mkdir(evidence, { recursive: true }); await mkdir(screens, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CHAESSI_PLAYWRIGHT || "playwright");
let token = process.env.NAI_ACCESS_TOKEN || "";
if (!token && process.env.CHAESSI_LIVE_ENV_FILE) {
  const source = await readFile(process.env.CHAESSI_LIVE_ENV_FILE, "utf8");
  token = /^\s*NAI_ACCESS_TOKEN\s*=\s*(.+)$/m.exec(source)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
}
const port = 4187;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["--import", "./scripts/capture-live-request.mjs", "server.mjs"], {
  cwd: root, windowsHide: true, env: { ...process.env, PORT: String(port), CHAESSI_USER_DATA_DIR: evidence, CHAESSI_VERIFY_DIR: evidence, NAI_ACCESS_TOKEN: token }, stdio: ["ignore", "pipe", "pipe"],
});
let browser;
const checks = [];
let lastImagePath;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base); await page.waitForFunction(() => document.querySelector("#healthStatus").textContent.includes("3.4.0"));
  await page.waitForFunction(() => document.querySelector("#presetName").value.length > 0);
  await page.locator("#presetName").fill("Wildcard example");
  await page.locator("#basePrompt").fill("1girl, solo, __tops__, __poses__, ||outdoors|indoors||, simple background");
  await page.locator("#undesiredPrompt").fill("lowres, blurry");
  await page.locator("#paramWidth").fill("832"); await page.locator("#paramHeight").fill("1216"); await page.locator("#paramSteps").fill("28");
  await page.locator("#openWildcardsButton").click();
  for (const [key, name, text] of [["tops", "Tops / 상의", "white shirt\nblack shirt\nblue shirt\nred shirt"], ["poses", "Poses / 자세", "standing\nsitting\nwalking"]]) {
    await page.locator("#wildcardNew").click();
    await page.locator("#wildcardKey").fill(key); await page.locator("#wildcardName").fill(name); await page.locator("#wildcardEntries").fill(text);
    await page.locator("#wildcardSave").click(); await page.locator("#wildcardStatus").filter({ hasText: "Saved" }).waitFor();
  }
  await page.locator("#wildcardList button").filter({ hasText: "__tops__" }).click();
  await page.waitForFunction(() => document.querySelector("#wildcardKey").value === "tops");
  await page.locator("#wildcardDialog").screenshot({ path: path.join(screens, "wildcard-library.png") });
  await page.locator("#wildcardSample").click(); assert.match(await page.locator("#wildcardStatus").textContent(), /Sample only/);
  await page.locator("#wildcardNew").click(); await page.locator("#wildcardKey").fill("bulk-test");
  const bulkText = Array.from({ length: 500 }, (_, i) => `shirt ${i}`).join("\n") + "\nshirt 0\n\n";
  await page.locator("#wildcardFile").setInputFiles({ name: "bulk.txt", mimeType: "text/plain", buffer: Buffer.from(bulkText) });
  await page.waitForFunction(() => document.querySelector("#wildcardCount").textContent.includes("500 candidates"));
  await page.locator("#wildcardSave").click(); await page.locator("#wildcardStatus").filter({ hasText: "Saved 500" }).waitFor();
  const downloadWait = page.waitForEvent("download"); await page.locator("#wildcardExport").click();
  const download = await downloadWait; assert.equal(download.suggestedFilename(), "bulk-test.txt");
  assert.equal((await readFile(await download.path(), "utf8")).split("\n").length, 500);
  page.once("dialog", dialog => dialog.accept()); await page.locator("#wildcardDelete").click();
  await page.locator("#wildcardStatus").filter({ hasText: "deleted" }).waitFor();
  checks.push("500-candidate TXT import, duplicate removal, export, sample and deletion via UI");
  await page.locator("#wildcardClose").click(); checks.push("Create and manage multiple Wildcards via UI");
  await page.locator("#basePrompt").fill("1girl, solo, ");
  await page.locator('[data-insert-wildcard="basePrompt"]').click();
  await page.locator("#wildcardList button").filter({ hasText: "__tops__" }).click();
  await page.waitForFunction(() => document.querySelector("#wildcardKey").value === "tops");
  await page.locator("#wildcardDialog").screenshot({ path: path.join(screens, "wildcard-insert.png") });
  await page.locator("#wildcardInsert").click();
  assert.equal(await page.locator("#basePrompt").inputValue(), "1girl, solo, __tops__");
  checks.push("Insert reference at cursor");
  await page.locator("#basePrompt").fill("1girl, solo, __tops__, __poses__, ||outdoors|indoors||, simple background");
  await page.locator("#basePromptPresetButton").click();
  await page.locator("#characterPresetNameInput").fill("Summer outfit example");
  await page.locator("#dialogSaveAsCharacterPresetButton").click(); await page.locator("#characterPresetDialog").waitFor({ state: "hidden" });
  await page.locator("#presetName").fill("Old name");
  await page.locator("#basePromptPresetButton").click();
  const savedCard = page.locator('[data-dialog-character-load]').filter({ hasText: "Summer outfit example" });
  // Cards load directly through the app's delegated click listener.
  await page.locator("#dialogCharacterPresetCards [data-dialog-character-load]").first().click();
  await page.locator("#characterPresetDialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#presetName").inputValue(), "Summer outfit example"); checks.push("Base Prompt Preset loaded name");
  await page.locator("#basePromptPresetButton").click();
  for (const category of ["여성 의상", "남성 의상"]) {
    await page.locator("#dialogCharacterCategoryFilter").selectOption(category);
    const labels = await page.locator("#dialogCharacterSubCategoryFilter option").allTextContents();
    const korean = labels.slice(1).map(label => label.split("/").at(-1).trim());
    assert.deepEqual(korean, [...korean].sort((a, b) => a.localeCompare(b, "ko")));
  }
  await page.locator("#dialogCharacterCategoryFilter").selectOption("여성 의상");
  await page.locator("#characterPresetDialog").screenshot({ path: path.join(screens, "preset-library.png") });
  await page.locator("#characterPresetDialog button[value='cancel']").click(); checks.push("Female and male clothing Korean ordering");
  await page.locator("#addCharacterButton").click();
  await page.locator('#characterCards [data-character-field="prompt"]').fill("brown hair, __tops__");
  await page.locator('[data-character-wildcard]').click(); await page.locator("#wildcardClose").click();
  checks.push("Character Prompt Wildcard insertion dialog");
  await page.locator(".preset-prompt-surface").evaluate(el => el.scrollIntoView({ block: "center" }));
  await page.locator(".preset-prompt-surface").screenshot({ path: path.join(screens, "preset-editor.png") });
  await page.locator(".preset-params-surface").screenshot({ path: path.join(screens, "settings.png") });
  await page.locator(".preset-character-surface").screenshot({ path: path.join(screens, "characters.png") });
  await page.locator("#savePresetButton").click(); await page.locator("#confirmSavePresetButton").click(); await page.locator("#presetSaveDialog").waitFor({ state: "hidden" });
  const savedPresets = (await (await fetch(`${base}/api/presets`)).json()).items;
  const template = (await (await fetch(`${base}/api/presets/${savedPresets[0].id}`)).json()).preset;
  assert.match(template.prompt_parts.base, /__tops__/); checks.push("Main Preset preserves reusable Wildcard references");
  await page.locator("#paramModel").selectOption("nai-diffusion-5-full");
  await page.locator("#characterPositionMode").selectOption("custom");
  await page.locator("#characterPositionPadPanel").screenshot({ path: path.join(screens, "v5-position.png") });
  if (token) {
    for (const model of ["nai-diffusion-4-5-full", "nai-diffusion-5-full"]) {
      await page.locator("#paramModel").selectOption(model);
      await page.locator("#basePrompt").fill("1girl, solo, __tops__, __poses__, ||outdoors|indoors||, simple background");
      await page.locator("#paramWidth").fill("832"); await page.locator("#paramHeight").fill("1216"); await page.locator("#paramSteps").fill("28");
      const resultWait = page.waitForResponse(response => response.url().endsWith("/api/novelai/generate"), { timeout: 240_000 });
      await page.locator("#generateButton").click();
      const response = await resultWait; const result = await response.json();
      assert.equal(result.ok, true, result.error?.details || result.error?.message);
      const stored = (await (await fetch(`${base}/api/generations/${result.generation.id}`)).json()).generation;
      const request = JSON.parse(await readFile(path.join(evidence, `request-${model.includes("diffusion-5") ? "v5" : "v45"}.json`), "utf8"));
      const png = Buffer.from(await (await fetch(`${base}/${result.generation.image_path}`)).arrayBuffer());
      const metadata = parseNovelAiPngMetadata(png);
      await writeFile(path.join(evidence, `metadata-${model.includes("diffusion-5") ? "v5" : "v45"}.json`), JSON.stringify(metadata, null, 2));
      assert.equal(stored.generation.prompt, request.input);
      assert.equal(stored.raw_payload.input, request.input);
      assert.equal(buildModeGeneratePayload(stored.internal_preset, { mode: "text-to-image" }).input, request.input);
      assert.equal(JSON.stringify(stored).includes("__tops__"), false);
      assert.equal(JSON.stringify(stored).includes("||"), false);
      assert.equal(metadata.parsed?.raw_payload?.prompt, request.input, "PNG metadata must match the transmitted base prompt including model quality tags");
      assert.equal(metadata.parsed?.raw_payload?.uc, request.parameters.negative_prompt, "PNG Undesired must match");
      assert.equal(JSON.stringify(metadata).includes("__tops__"), false);
      lastImagePath = path.join(evidence, result.generation.image_path);
      assert.match(await page.locator("#basePrompt").inputValue(), /__tops__/);
      await page.locator("#resolvedGenerationDetails").evaluate(el => { el.open = true; });
      await page.locator("#resolvedGenerationDetails").screenshot({ path: path.join(screens, "selected-prompt.png") });
      await page.locator(".generation-layout").screenshot({ path: path.join(screens, "generation.png") });
      checks.push(`${model}: live request = History = PNG metadata, template preserved`);
    }
    await page.locator("#historyList [data-generation-id]").first().click();
    await page.locator("#imageViewerDialog").waitFor({ state: "visible" });
    await page.locator("#imageViewerHistoryDetails").evaluate(el => { el.open = true; });
    await page.locator("#imageViewerDialog").screenshot({ path: path.join(screens, "history.png") });
    await page.locator("#imageViewerCloseButton").click();
  } else { checks.push("LIVE GENERATION NOT RUN: no token supplied"); }
  if (lastImagePath) {
    await page.locator("#imageInput").setInputFiles(lastImagePath);
    await page.locator("#imageIntakeDialog").waitFor({ state: "visible" });
    await page.locator("#imageIntakeDialog").screenshot({ path: path.join(screens, "image-intake.png") });
    await page.locator("#imageIntakeI2IButton").click();
    await page.locator("#panel-generate").screenshot({ path: path.join(screens, "image-to-image.png") });
    await page.locator("#imageInput").setInputFiles(lastImagePath);
    await page.locator("#imageIntakeInpaintButton").click();
    await page.locator("#panel-generate").screenshot({ path: path.join(screens, "inpaint.png") });
    checks.push("Image intake routes real result to Image to Image and Inpaint");
  }
  await page.locator("#apiSettingsButton").click();
  await page.locator(".api-settings-surface").screenshot({ path: path.join(screens, "api-settings.png") });
  await page.locator("#healthStatus").click();
  await page.locator("#aboutDialog").screenshot({ path: path.join(screens, "about.png") });
  assert.equal(await page.locator("#aboutDialog a").count(), 4);
  for (const link of await page.locator("#aboutDialog a").all()) {
    const href = await link.getAttribute("href");
    if (process.env.CHAESSI_VERIFY_PDFS === "1") {
      const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
      const pdfResponse = await fetch(`${base}${href}`);
      assert.equal(pdfResponse.status, 200); assert.match(pdfResponse.headers.get("content-type"), /application\/pdf/);
      assert.equal(Buffer.from(await pdfResponse.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
      await popup.waitForLoadState("domcontentloaded"); await popup.close();
      checks.push(`Opened ${href} from App info`);
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(evidence, "ui-results.json"), JSON.stringify({ checks, errors }, null, 2));
  await writeFile(path.join(root, ".cache", "latest-verification.json"), JSON.stringify({ evidence, checks, errors }, null, 2));
  console.log(checks.join("\n"));
} finally { await browser?.close(); child.kill(); }
