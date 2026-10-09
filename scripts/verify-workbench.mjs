import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createDefaultPreset } from "../src/state/preset-schema.js";
import { createPresetStore } from "../src/services/preset-store.js";
import { createCharacterPresetStore } from "../src/services/character-preset-store.js";
import { createGenerationStore } from "../src/services/generation-store.js";
import { buildModeGeneratePayload } from "../src/adapters/novelai-v45-generation-modes.js";
import { encodeRgbPng } from "../src/services/generation-image-utils.js";

// Actual Electron, actual local API and stores; isolated profile and synthetic data.
// Test-only provider returns the existing ZIP/MessagePack response formats.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const { _electron } = require(process.env.CHAESSI_PLAYWRIGHT || "playwright");
const folder = path.join(root, ".cache", "workbench-verification", `run-${Date.now()}`);
await mkdir(folder, { recursive: true });
const png = encodeRgbPng(Buffer.alloc(512 * 512 * 3, 185), 512, 512);
const sourceFile = path.join(folder, "source.png"); await writeFile(sourceFile, png);
const fixture = createDefaultPreset({ metadata: { name: "Chaessi · Studio" },
  params: { width: 512, height: 512, seed: 4123 },
  prompt_parts: { base: "1girl, adult, watercolor, soft light, simple background", undesired: "lowres, text",
    characters: [{ name: "Chaessi (peach)", prompt: "glasses, brown hair, white shirt, beige cardigan", undesired: "blurry" }, { name: "Companion", prompt: "blue shirt, standing" }] } });
const saved = await createPresetStore({ rootDir: folder }).savePreset(fixture);
const characterStore = createCharacterPresetStore({ rootDir: folder });
for (const preset of [
  { id: "ui_casual", name: "Casual · 캐주얼", category: "여성 의상", subCategory: "Casual / 캐주얼", prompt: "white shirt, beige cardigan" },
  { id: "ui_office", name: "Office · 오피스", category: "여성 의상", subCategory: "Office / 오피스", prompt: "gray blazer" },
  { id: "ui_base", name: "Watercolor studio", category: "그림체", prompt: "watercolor, soft lighting", undesired: "lowres" },
]) await characterStore.saveCharacterPreset(preset);
const generationStore = createGenerationStore({ rootDir: folder });
const historyFixtures = [];
for (let i = 0; i < 6; i++) {
  const preset = structuredClone(fixture); preset.params.seed = 100 + i;
  preset.params.model = i % 2 ? "nai-diffusion-5-full" : "nai-diffusion-4-5-full";
  historyFixtures.push(await generationStore.saveGeneration({ preset,
    payload: buildModeGeneratePayload(preset, { mode: "text-to-image" }), imageBytes: png,
    responseInfo: { generation_id: `ui_history_${i}`, created_at: `2026-10-0${i + 1}T12:00:00Z` } }));
}
const probe = net.createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const checks = [], errors = [], failures = [];
let app, page;
const pass = message => { checks.push(message); console.log(`PASS ${message}`); };
async function launch() {
  app = await _electron.launch({ executablePath: process.env.CHAESSI_ELECTRON || require("electron"), args: ["tests/electron-fixture.cjs"], cwd: root,
    env: { ...process.env, PORT: String(port), NAI_ACCESS_TOKEN: "test-local-only", NOVELAI_TOKEN: "",
      CHAESSI_TEST_PROVIDER_MODULE: new URL("../tests/mock-workbench-provider.mjs", import.meta.url).href,
      CHAESSI_ELECTRON_TEST_DATA: folder }, timeout: 45_000 });
  page = await app.firstWindow(); page.on("pageerror", error => errors.push(error.message));
  await page.waitForFunction(() => document.querySelector("#presetName")?.value.length > 0, null, { timeout: 25_000 });
  await page.locator('#uiLanguage').selectOption('en');
}
async function closeDialog(id) { await page.keyboard.press("Escape"); await page.locator(`#${id}`).waitFor({ state: "hidden" }); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function showHistory() { await page.locator('[data-workspace-view="history"]').click(); await page.locator("#loadHistoryButton").click(); }
async function workbench() { await page.locator('[data-workspace-view="workbench"]').click(); }
async function loadMain() {
  await page.locator("#openPresetLoadButton").click(); await page.locator(`[data-load-preset="${saved.metadata.id}"]`).click();
  await page.locator("#presetLoadDialog").waitFor({ state: "hidden" });
}
async function openCharacter(index) {
  await page.locator(`#characterCards [data-character-index="${index}"] [data-character-preset-save]`).click();
  await page.locator("#characterPresetDialog").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#characterPresetDialogStatus").textContent.includes("character presets loaded"));
}
async function screenshot(name) { await page.screenshot({ path: path.join(folder, `${name}.png`) }); }
try {
  await launch(); await loadMain();
  assert.deepEqual(errors, []);
  pass("Actual Electron boots the current workbench with a stored preset compatible with v3.4.2");
  // Wide layout, split and dock must fit without body scrolling or clipping.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 980));
  await page.waitForFunction(() => innerWidth > 1200);
  const geometry = await page.evaluate(() => {
    const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height }; };
    return { editor: box("editorPane"), result: box("resultPane"), dock: box("generationDock"), button: box("generateButton"), width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.ok(geometry.editor.right < geometry.result.x);
  assert.ok(geometry.button.bottom <= geometry.height); assert.equal(geometry.overflow, false);
  await screenshot("01-workbench");
  await page.locator("#workbenchDivider").focus(); await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#workbenchDivider").getAttribute("aria-valuenow"), "50");
  pass("Wide window keeps prompt and image panes side by side; split is keyboard adjustable; Generate remains visible");
  const initial = await page.locator("#basePrompt").evaluate(el => el.getBoundingClientRect().height);
  const longPrompt = "adult, white shirt, soft lighting, ".repeat(90);
  await page.locator("#basePrompt").fill(longPrompt);
  assert.ok(await page.locator("#basePrompt").evaluate(el => el.getBoundingClientRect().height) > initial);
  await page.locator('[data-expand-prompt="basePrompt"]').click();
  const edited = longPrompt + " blue sky";
  await page.locator("#promptExpandedInput").fill(edited);
  assert.equal(await page.locator("#basePrompt").inputValue(), edited);
  await screenshot("02-large-editor"); await closeDialog("promptEditorDialog");
  assert.equal(await page.locator("#basePrompt").inputValue(), edited);
  const characterPrompt = page.locator('#characterCards [data-character-index="0"] [data-character-field="prompt"]');
  await characterPrompt.fill("white shirt, __tops__, ||standing|sitting||");
  assert.equal(await page.locator("#basePrompt").evaluate(el => el.classList.contains("is-editing")), false);
  await page.locator('#characterCards [data-character-index="0"] [data-expand-prompt]').click();
  await page.locator("#promptExpandedInput").fill("white shirt, __tops__, ||standing|sitting||, glasses");
  await closeDialog("promptEditorDialog");
  assert.match(await characterPrompt.inputValue(), /glasses/);
  pass("Base/Character selection expands the active field; large editing applies live and Escape preserves the exact text");
  const currentBase = await page.locator("#basePrompt").inputValue();
  await showHistory(); await workbench();
  assert.equal(await page.locator("#basePrompt").inputValue(), currentBase);
  const fold = page.locator('#characterCards [data-character-index="0"] [data-collapse-character]');
  await fold.click(); assert.equal(await characterPrompt.isVisible(), false); await fold.click();
  assert.match(await characterPrompt.inputValue(), /glasses/);
  await page.locator('#characterCards [data-character-index="0"] [data-character-tab="undesired"]').click();
  await page.locator('#characterCards [data-character-index="0"] [data-character-field="undesired"]').fill("bad hands");
  await page.locator('#characterCards [data-character-index="0"] [data-character-tab="prompt"]').click();
  assert.match(await characterPrompt.inputValue(), /glasses/);
  pass("Workspace navigation, folding and Prompt/Undesired tabs preserve edited text");
  await openCharacter(0); await page.locator("#dialogCharacterCategoryFilter").selectOption("여성 의상");
  await page.locator("#dialogCharacterSubCategoryFilter").selectOption("Casual / 캐주얼");
  await page.locator("#characterPresetSearch").fill("Casual");
  assert.equal(await page.locator("[data-dialog-character-load]").count(), 1);
  await screenshot("03-preset-library");
  await page.locator('[data-dialog-character-load="ui_casual"]').click();
  await page.locator("#characterPresetDialog").waitFor({ state: "hidden" });
  assert.equal(await characterPrompt.inputValue(), "white shirt, beige cardigan");
  await openCharacter(0); assert.equal(await page.locator("#dialogCharacterSubCategoryFilter").inputValue(), "Casual / 캐주얼");
  await page.locator('[data-library-tab="save"]').click();
  await page.locator("#characterPresetNameInput").fill("Saved Character"); await page.locator("#dialogSaveAsCharacterPresetButton").click();
  await page.locator("#characterPresetDialog").waitFor({ state: "hidden" });
  await openCharacter(1); await page.locator("#dialogCharacterCategoryFilter").selectOption("남성 의상");
  await page.locator("#dialogCharacterSubCategoryFilter").selectOption("Office / 오피스"); await closeDialog("characterPresetDialog");
  pass("Preset browse/search/load and Save As work; two slots keep independent category preferences");
  await page.locator("#basePromptPresetButton").click();
  await page.waitForFunction(() => document.querySelector("#characterPresetDialogStatus").textContent.includes("character presets loaded"));
  await page.locator("#characterPresetSearch").fill(""); await page.locator("#dialogCharacterCategoryFilter").selectOption("그림체");
  await page.locator('[data-dialog-character-load="ui_base"]').click();
  await page.locator("#characterPresetDialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#presetName").inputValue(), "Watercolor studio");
  await page.locator("#saveAsPresetButton").click(); await page.locator("#presetSaveNameInput").fill("Workbench saved copy");
  await page.locator("#confirmSavePresetButton").click(); await page.locator("#presetSaveDialog").waitFor({ state: "hidden" });
  await loadMain();
  const loaded = (await (await fetch(`${base}/api/presets/${saved.metadata.id}`)).json()).preset;
  assert.equal(loaded.prompt_parts.base, fixture.prompt_parts.base);
  assert.deepEqual(loaded.prompt_parts.characters, saved.prompt_parts.characters);
  await openCharacter(0); assert.equal(await page.locator("#dialogCharacterCategoryFilter").inputValue(), "여성 의상"); await closeDialog("characterPresetDialog");
  pass("Base Preset actual Name, main Save As/Load and existing v3.4.2 preset schema remain compatible");
  await page.locator("#openWildcardsButton").click(); await page.locator("#wildcardNew").click();
  await page.locator("#wildcardKey").fill("tops"); await page.locator("#wildcardName").fill("Tops / 상의");
  await page.locator("#wildcardEntries").fill("white shirt\nblue shirt\nblack shirt\nred shirt"); await page.locator("#wildcardSave").click();
  await page.locator("#wildcardStatus").filter({ hasText: "Saved 4" }).waitFor(); await page.locator("#wildcardClose").click();
  await page.locator('[data-expand-prompt="basePrompt"]').click(); await page.locator("#promptExpandedInput").fill("1girl, adult, ");
  await page.locator('[data-insert-wildcard="promptExpandedInput"]').click();
  await page.locator("#wildcardList button").first().click(); await page.locator("#wildcardInsert").click();
  assert.equal(await page.locator("#basePrompt").inputValue(), "1girl, adult, __tops__"); await closeDialog("promptEditorDialog");
  pass("Wildcard creation and insertion inside the large editor update the original reusable prompt");
  await page.locator("#paramModel").selectOption("nai-diffusion-5-full");
  await page.locator("#characterPositionMode").selectOption("custom");
  await page.locator("#characterPositionPadPanel").scrollIntoViewIfNeeded();
  const pad = await page.locator("#characterPositionPad").boundingBox();
  const markers = page.locator("#characterPositionMarkers button");
  const rect = await markers.first().boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(pad.x + pad.width * .25, pad.y + pad.height * .35, { steps: 5 }); await page.mouse.up();
  const x = Number(await page.locator('#characterCards [data-character-index="0"] [data-character-field="x"]').inputValue());
  assert.ok(Math.abs(x - .25) < .06);
  assert.ok(await page.locator("#editorPane").evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  pass("Position Pad pointer drag updates the character coordinates in the new editor pane");
  await page.locator("#advancedSettingsButton").click();
  await page.locator("#paramCfgRescale").fill("0.12"); await screenshot("04-generation-settings"); await closeDialog("generationSettingsDialog");
  await page.locator("#paramWidth").fill("512"); await page.locator("#paramHeight").fill("512");
  // Six complete renderer → preparation → NovelAI payload → History workflows.
  for (const model of ["nai-diffusion-4-5-full", "nai-diffusion-5-full"]) {
    await page.locator("#paramModel").selectOption(model);
    await page.locator("#basePrompt").fill("1girl, adult, __tops__, ||indoors|outdoors||");
    for (const mode of ["text-to-image", "image-to-image", "inpaint"]) {
      await page.locator(`[data-generation-mode="${mode}"]`).click();
      if (mode !== "text-to-image") {
        await page.locator("#generationSourceInput").setInputFiles(sourceFile);
        await page.locator("#generationSourceInfo").filter({ hasText: "512" }).waitFor();
        if (mode === "inpaint") {
          await page.locator("#sourceCanvasFrame").scrollIntoViewIfNeeded();
          const canvas = await page.locator("#generationSourceCanvas").boundingBox();
          await page.mouse.move(canvas.x + canvas.width * .4, canvas.y + canvas.height * .4); await page.mouse.down();
          await page.mouse.move(canvas.x + canvas.width * .6, canvas.y + canvas.height * .6, { steps: 8 }); await page.mouse.up();
          await page.locator("#undoMaskButton").click(); await page.locator("#redoMaskButton").click();
          assert.ok(await page.locator("#resultPane").evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Inpaint controls fit within the image pane");
          const maskBefore = await page.locator("#inpaintMaskCanvas").evaluate(el => el.toDataURL());
          await showHistory(); await workbench();
          assert.equal(await page.locator("#inpaintMaskCanvas").evaluate(el => el.toDataURL()), maskBefore);
          await screenshot(model.includes("diffusion-5") ? "06-v5-inpaint" : "05-v45-inpaint");
        }
      }
      const generatedResponse = page.waitForResponse(response => response.url().endsWith("/api/novelai/generate"), { timeout: 20_000 });
      await page.locator("#generateButton").click();
      const generationResponse = await generatedResponse;
      assert.equal(generationResponse.status(), 200, await generationResponse.text());
      const generated = await generationResponse.json();
      await page.locator("#generateStatus").filter({ hasText: "Generation saved." }).waitFor({ timeout: 20_000 });
      const latest = (await (await fetch(`${base}/api/generations`)).json()).items.find(item => item.id === generated.generation.id);
      const history = (await (await fetch(`${base}/api/generations/${latest.id}`)).json()).generation;
      const sent = JSON.parse(await readFile(path.join(folder, "captured-request.json"), "utf8"));
      assert.equal(history.generation.prompt, sent.input); assert.ok(!sent.input.includes("__tops__") && !sent.input.includes("||"));
      assert.match(await page.locator("#basePrompt").inputValue(), /__tops__/);
      assert.equal(latest.mode, mode); assert.equal(latest.model, sent.model);
      pass(`${model} ${mode}: UI generation, final request/History prompt matching and reusable input preservation (mock provider)`);
    }
  }
  await page.locator('[data-generation-mode="text-to-image"]').click();
  await page.locator("#paramModel").selectOption("nai-diffusion-4-5-full");
  await page.locator(".reference-disclosure summary").click();
  await page.locator("#preciseReferenceInput").setInputFiles(sourceFile);
  await page.locator("#preciseReferenceCount").filter({ hasText: "1 active" }).waitFor();
  await page.locator("#paramModel").selectOption("nai-diffusion-5-full");
  await page.locator("#paramModel").selectOption("nai-diffusion-4-5-full");
  assert.match(await page.locator("#preciseReferenceCount").textContent(), /1 active/);
  pass("V4.5 Precise Reference remains accessible and survives V5/V4.5 switches");
  await showHistory();
  await page.locator("#historyModelFilter").selectOption("nai-diffusion-5-full"); await page.locator("#historyModeFilter").selectOption("inpaint");
  assert.equal(await page.locator("#historyList .history-card").count(), 1);
  await page.locator("#historyModelFilter").selectOption(""); await page.locator("#historyModeFilter").selectOption("");
  await screenshot("07-history-gallery");
  const countBefore = await page.locator("#historyList .history-card").count();
  await page.locator("#historyList [data-view-generation]").first().click();
  await page.locator("#imageViewerDialog").waitFor({ state: "visible" });
  await page.locator("#imageViewerHistoryDetails summary").click();
  assert.ok((await page.locator("#imageViewerPrompt").textContent()).length > 0);
  await page.locator("#imageViewerNextButton").click();
  await page.locator("#viewerReuseActions [data-viewer-reuse='seed']").click();
  await page.locator("#imageViewerDialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#workbenchView").isVisible(), true);
  await showHistory(); await page.locator("#historySearch").fill("ui_history_1");
  assert.equal(await page.locator("#historyList .history-card").count(), 1);
  await page.locator("#historyEnterSelectionButton").click(); await page.locator("#historySelectVisibleButton").click();
  await page.locator("#historyDeleteSelectedButton").click(); await page.locator("#historyBulkDeleteConfirmButton").click();
  await page.locator("#historyBulkDeleteDialog").waitFor({ state: "hidden" });
  await page.locator("#historySearch").fill("");
  if (await page.locator("#historyCancelSelectionButton").isVisible()) await page.locator("#historyCancelSelectionButton").click();
  assert.equal(await page.locator("#historyList .history-card").count(), countBefore - 1);
  pass("History model/mode/search filters, large viewer navigation/reuse and filtered bulk deletion work without losing records");
  await page.locator("#historyList [data-view-generation]").first().click();
  await page.locator("#imageViewerDialog").waitFor({ state: "visible" });
  const editorBeforePreview = await page.locator("#basePrompt").inputValue();
  await page.locator('#viewerReuseActions [data-viewer-reuse="preview"]').click();
  await page.locator("#imageViewerDialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#basePrompt").inputValue(), editorBeforePreview);
  pass("Keep in workbench shows an existing History image alongside current editing without replacing prompts");
  await workbench();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
  await page.waitForFunction(() => innerWidth < 1020);
  await page.locator('[data-workbench-pane="edit"]').click();
  const textBefore = await page.locator("#basePrompt").inputValue();
  await page.locator('[data-workbench-pane="result"]').click();
  await screenshot("08-small-window-result");
  await page.locator('[data-workbench-pane="edit"]').click();
  assert.equal(await page.locator("#basePrompt").inputValue(), textBefore);
  assert.ok(await page.locator("#generateButton").evaluate(el => el.getBoundingClientRect().bottom <= innerHeight));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await screenshot("09-small-window-edit");
  await page.locator("#navImport").click(); assert.equal(await page.locator("#rawJsonInput").isVisible(), false);
  await page.locator("#importWorkspaceDialog details summary").first().click(); assert.equal(await page.locator("#rawJsonInput").isVisible(), true);
  await closeDialog("importWorkspaceDialog");
  await page.locator("#apiSettingsButton").click(); assert.equal(await page.locator("#tokenInput").isVisible(), true); await closeDialog("apiSettingsDialog");
  await page.locator("#navManuals").click(); assert.equal(await page.locator("#manualReader").isVisible(), true); await closeDialog("manualReader");
  pass("Minimum 960×640 window, pane switches, API settings, raw JSON and Manuals access stay usable without horizontal overflow");
  await page.locator("#basePrompt").fill("__missing_test_wildcard__");
  await page.locator("#generateButton").click();
  await page.waitForFunction(() => document.querySelector("#generateStatus").classList.contains("error"));
  assert.match(await page.locator("#generateStatus").getAttribute("title"), /missing_test_wildcard/);
  assert.equal(await page.locator("#basePrompt").inputValue(), "__missing_test_wildcard__");
  pass("Generation error remains readable through full status text/tooltip and preserves editable input for retry");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.session.flushStorageData());
  await app.close(); app = null;
  for (let i = 0; i < 100; i++) { try { await fetch(base + "/api/health"); } catch { break; } await new Promise(resolve => setTimeout(resolve, 50)); }
  await launch(); await loadMain(); await openCharacter(0);
  assert.equal(await page.locator("#dialogCharacterSubCategoryFilter").inputValue(), "Casual / 캐주얼"); await closeDialog("characterPresetDialog");
  await openCharacter(1); assert.equal(await page.locator("#dialogCharacterSubCategoryFilter").inputValue(), "Office / 오피스"); await closeDialog("characterPresetDialog");
  assert.equal(await page.locator("#workbenchDivider").getAttribute("aria-valuenow"), "50");
  pass("Actual Electron restart retains numbered-field categories and layout preferences independently of loaded presets");
  assert.deepEqual(errors, []); pass("No renderer JavaScript errors throughout the workbench scenarios");
} catch (error) {
  failures.push(error.stack); await page?.screenshot({ path: path.join(folder, "failure.png") }).catch(() => {});
  console.error(error); process.exitCode = 1;
} finally {
  await writeFile(path.join(folder, "results.json"), JSON.stringify({ passed: checks, failed: failures, rendererErrors: errors, liveNovelAI: "not run: provider mocked" }, null, 2));
  if (app) await app.close();
  console.log(`${checks.length} passed, ${failures.length} failed. Evidence: ${folder}`);
}
