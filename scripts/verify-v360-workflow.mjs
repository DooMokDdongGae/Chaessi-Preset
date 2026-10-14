import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createDefaultPreset } from "../src/state/preset-schema.js";
import { createPresetStore } from "../src/services/preset-store.js";
import { createWildcardStore } from "../src/services/wildcard-store.js";
import { messages } from "../src/ui/translations.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url), { _electron } = require(process.env.CHAESSI_PLAYWRIGHT || "playwright");
const folder = path.join(root, ".cache", "v360-workflow", `run-${Date.now()}`); await mkdir(folder, { recursive: true });
const store = createPresetStore({ rootDir: folder });
const saved = await store.savePreset(createDefaultPreset({ metadata: { name: "Prompt $& 작업台" }, params: { model: "nai-diffusion-5-full", effort: "high", seed: 4242, width: 512, height: 512, steps: 31, sampler: "k_dpmpp_2m", cfg_rescale: .2, ucPreset: 4 },
  prompt_parts: { base: "adult woman, __scene__", undesired: "__inactive_uc__", characters: [{ prompt: "adult, blue hair", undesired: "__inactive_char_uc__", position_mode: "custom", centers: [{ x: .309, y: .508 }] }] } }));
const legacy = await store.savePreset(createDefaultPreset({ metadata: { name: "Legacy V4.5" }, params: { model: "nai-diffusion-4-5-full", seed: 123 }, prompt_parts: { base: "old saved prompt", undesired: "bad", characters: [] } }));
await createWildcardStore({ rootDir: folder }).save({ key: "scene", text: "laboratory\ngarden" });
const probe = net.createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening"); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const base = `http://127.0.0.1:${port}`, checks = [], errors = []; let app, page;
const pass = text => { checks.push(text); console.log(`PASS ${text}`); };
async function launch() {
  app = await _electron.launch({ executablePath: process.env.CHAESSI_ELECTRON || require("electron"), args: ["tests/electron-fixture.cjs"], cwd: root,
    env: { ...process.env, PORT: String(port), NAI_ACCESS_TOKEN: "test-local-only", NOVELAI_TOKEN: "", CHAESSI_ELECTRON_TEST_DATA: folder, CHAESSI_TEST_PROVIDER_MODULE: new URL("../tests/mock-workbench-provider.mjs", import.meta.url).href } });
  page = await app.firstWindow(); page.on("pageerror", error => errors.push(error.message));
  await page.waitForFunction(() => document.querySelector("#presetName")?.value); await page.locator("#uiLanguage").selectOption("en");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 980));
}
async function load(id) { await page.locator("#openPresetLoadButton").click(); await page.locator(`[data-load-preset="${id}"]`).click(); await page.locator("#presetLoadDialog").waitFor({ state: "hidden" }); }
async function save(asNew = false) {
  await page.locator(asNew ? "#saveAsPresetButton" : "#savePresetButton").click();
  const response = page.waitForResponse(response => response.url().endsWith("/api/presets") && response.request().method() === "POST");
  await page.locator("#confirmSavePresetButton").click(); const result = await response;
  assert.equal(result.status(), 200, await result.text()); await page.locator("#presetSaveDialog").waitFor({ state: "hidden" }); return (await result.json()).preset;
}
try {
  await launch();
  assert.equal(await page.locator("#paramScale").inputValue(), "7");
  await page.locator('[data-generation-mode="inpaint"]').click(); assert.equal(await page.locator("#paramScale").inputValue(), "5");
  await page.locator('[data-generation-mode="text-to-image"]').click(); assert.equal(await page.locator("#paramScale").inputValue(), "7");
  await load(saved.metadata.id);
  await page.locator("#basePrompt").fill("adult woman, __scene__, -3::hat::");
  assert.equal(await page.locator("#restoreSavedPresetButton").isEnabled(), true);
  const updated = await save(); assert.equal(updated.metadata.id, saved.metadata.id);
  await page.locator("#presetRevisionsButton").click(); await page.locator("#presetRevisionsDialog [data-revision-id]").first().click();
  await page.locator("#presetRevisionsDialog").waitFor({ state: "hidden" }); assert.equal(await page.locator("#basePrompt").inputValue(), saved.prompt_parts.base);
  await page.locator("#previousWorkbenchButton").click(); assert.equal(await page.locator("#basePrompt").inputValue(), updated.prompt_parts.base);
  await page.locator("#basePrompt").fill("temporary change"); await page.locator("#restoreSavedPresetButton").click(); assert.equal(await page.locator("#basePrompt").inputValue(), updated.prompt_parts.base);
  const separate = await save(true); assert.notEqual(separate.metadata.id, saved.metadata.id);
  pass("Actual Save / Save As / saved revisions / saved-state restore / previous-work swap preserve the original and edited prompts");
  await page.locator("#paramEffort").selectOption("medium");
  assert.equal(await page.locator("#undesiredPrompt").isVisible(), false);
  assert.equal(await page.locator("#paramSteps").isVisible(), false);
  assert.match(await page.locator("#summarySize").textContent(), /14 steps/);
  assert.equal(await page.locator('[data-character-tab="undesired"]').isVisible(), false);
  assert.equal(await page.locator('[data-character-field="undesired"]').inputValue(), "__inactive_char_uc__");
  await page.locator("#paramScale").fill("4"); await page.locator("#paramEffort").selectOption("high");
  assert.equal(await page.locator("#paramSteps").inputValue(), "31"); assert.equal(await page.locator("#paramScale").inputValue(), "4");
  assert.equal(await page.locator("#undesiredPrompt").inputValue(), "__inactive_uc__"); await page.locator("#paramEffort").selectOption("medium");
  pass("Medium hides inactive controls, preserves UC and restores High fields while retaining shared Guidance");
  await load(saved.metadata.id); await page.locator("#paramEffort").selectOption("medium");
  for (const locale of ["ko", "en", "ja"]) {
    await page.locator("#uiLanguage").selectOption(locale); await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
    assert.equal(await page.locator("#presetRevisionsButton").textContent(), messages["Saved revisions"][locale]);
    assert.equal(await page.locator("#basePrompt").inputValue(), updated.prompt_parts.base);
    await page.locator("#navManuals").click(); await page.locator('[data-manual-chapter="models"]').click();
    assert.match(await page.locator("#manualArticle").textContent(), /Medium/); await page.locator("#manualClose").click();
    await page.screenshot({ path: path.join(folder, `medium-${locale}.png`) });
    await page.locator("#presetRevisionsButton").click();
    await page.screenshot({ path: path.join(folder, `preset-revisions-${locale}.png`) });
    await page.locator("#presetRevisionsDialog").evaluate(element => element.close());
  }
  await page.locator("#uiLanguage").selectOption("en");
  pass("Korean / English / Japanese Effort and workflow controls and Help Center preserve exact user prompts");
  const generatedResponse = page.waitForResponse(response => response.url().endsWith("/api/novelai/generate"));
  await page.locator("#generateButton").click(); const response = await generatedResponse;
  assert.equal(response.status(), 200, await response.text()); const generated = await response.json();
  const sidecar = (await (await fetch(`${base}/api/generations/${generated.generation.id}`)).json()).generation;
  assert.equal(sidecar.generation.effort, "medium"); assert.equal(sidecar.generation.steps, 14); assert.equal(sidecar.internal_preset.prompt_parts.undesired, "");
  assert.equal(sidecar.output.actual_generation_params.effort, "medium"); assert.equal(sidecar.output.actual_generation_params.steps, 14);
  assert.match(sidecar.generation.prompt, /laboratory|garden/); assert.doesNotMatch(sidecar.generation.prompt, /__scene__/);
  const png = await readFile(path.join(folder, generated.generation.image_path)); const form = new FormData(); form.append("image", new Blob([png], { type: "image/png" }), "result.png");
  const imported = await (await fetch(`${base}/api/import/image`, { method: "POST", body: form })).json();
  assert.equal(imported.import_result.parsed.params.effort, "medium");
  await page.locator("#navImport").click(); await page.locator("#importWorkspaceDialog").evaluate(element => element.close());
  const mediumSaved = await save();
  await page.locator('[data-workspace-view="history"]').click(); await page.locator("#historyList [data-view-generation]").first().click();
  await page.locator('[data-viewer-reuse="params"]').click(); await page.locator("#imageViewerDialog").evaluate(element => element.close());
  assert.equal(await page.locator("#paramEffort").inputValue(), "medium");
  pass("One-image generation resolves only active Wildcards, writes effective Medium History and restores Effort from PNG and History settings");
  await load(legacy.metadata.id); assert.equal(await page.locator("#basePrompt").inputValue(), "old saved prompt"); assert.equal(await page.locator("#generateButton").isDisabled(), true);
  const blocked = await fetch(`${base}/api/novelai/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ preset: legacy }) });
  assert.equal(blocked.status, 400); assert.match((await blocked.text()), /legacy_model_read_only/);
  await page.locator("#paramModel").selectOption("nai-diffusion-5-full"); assert.equal(await page.locator("#basePrompt").inputValue(), "old saved prompt");
  pass("V4.5 records remain readable, generation is blocked before provider access and V5 conversion preserves prompts");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.session.flushStorageData()); await app.close(); app = null;
  await launch(); await load(mediumSaved.metadata.id); assert.equal(await page.locator("#paramEffort").inputValue(), "medium");
  await page.locator("#paramEffort").selectOption("high"); assert.equal(await page.locator("#paramSteps").inputValue(), "31");
  pass("Actual Electron restart reloads saved Medium with its preserved High settings");
  assert.deepEqual(errors, []);
} catch (error) { errors.push(error.stack); console.error(error); process.exitCode = 1; await page?.screenshot({ path: path.join(folder, "failure.png") }).catch(() => {}); }
finally { if (app) await app.close(); await writeFile(path.join(folder, "results.json"), JSON.stringify({ passed: checks, errors, paid_calls: 0 }, null, 2)); console.log(`${checks.length} checks. Evidence: ${folder}`); }
