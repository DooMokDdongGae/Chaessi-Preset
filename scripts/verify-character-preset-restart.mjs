import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createDefaultPreset } from "../src/state/preset-schema.js";
import { createPresetStore } from "../src/services/preset-store.js";
import { createGenerationStore } from "../src/services/generation-store.js";
import { encodeRgbPng } from "../src/services/generation-image-utils.js";
import { buildModeGeneratePayload } from "../src/adapters/novelai-v45-generation-modes.js";

const require = createRequire(import.meta.url);
const { _electron } = require(process.env.CHAESSI_PLAYWRIGHT || "playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const folder = path.join(root, ".cache", "category-restart", `run-${Date.now()}`);
await mkdir(folder, { recursive: true });
const preset = createDefaultPreset({ metadata: { name: "Different main preset" }, prompt_parts: { base: "simple background", characters: [{ name: "Loaded A", prompt: "white shirt" }, { name: "Loaded B", prompt: "blue shirt" }] } });
const saved = await createPresetStore({ rootDir: folder }).savePreset(preset);
const historyPreset = createDefaultPreset({ metadata: { name: "Different History preset" }, prompt_parts: { base: "outdoors", characters: [{ name: "History A", prompt: "black shirt" }, { name: "History B", prompt: "red shirt" }] } });
const payload = buildModeGeneratePayload(historyPreset, { mode: "text-to-image" });
const history = await createGenerationStore({ rootDir: folder }).saveGeneration({ preset: historyPreset, payload, imageBytes: encodeRgbPng(Buffer.alloc(64 * 64 * 3, 200), 64, 64), responseInfo: { generation_id: "category_history_fixture", created_at: new Date().toISOString() } });
const probe = net.createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
let app, page;
const checks = [], errors = [];
const pass = message => { checks.push(message); console.log(`PASS ${message}`); };
async function launch() {
  app = await _electron.launch({
    executablePath: process.env.CHAESSI_ELECTRON || require("electron"), args: ["tests/electron-fixture.cjs"], cwd: root,
    env: { ...process.env, PORT: String(port), NAI_ACCESS_TOKEN: "", CHAESSI_ELECTRON_TEST_DATA: folder }, timeout: 45_000,
  });
  assert.equal(path.resolve(await app.evaluate(({ app }) => app.getPath("userData"))).toLowerCase(), path.resolve(folder).toLowerCase());
  page = await app.firstWindow(); page.on("pageerror", error => errors.push(error.message));
  await page.waitForFunction(() => document.querySelector("#presetName")?.value.length > 0);
  await page.locator('#uiLanguage').selectOption('en');
  await page.locator("#addCharacterButton").click(); await page.locator("#addCharacterButton").click();
}
async function stop() {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.session.flushStorageData());
  await app.close(); app = null;
  for (let i = 0; i < 100; i++) {
    try { await fetch(`http://127.0.0.1:${port}/api/health`); } catch { return; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("Previous Electron server did not stop");
}
async function open(index) {
  await page.locator(`#characterCards [data-character-index="${index}"] [data-character-preset-save]`).click();
  await page.locator("#characterPresetDialog").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#characterPresetDialogStatus").textContent.includes("character presets loaded"));
}
async function close() { await page.keyboard.press("Escape"); await page.locator("#characterPresetDialog").waitFor({ state: "hidden" }); }
async function choose(index, category, subCategory = "") {
  await open(index); await page.locator("#dialogCharacterCategoryFilter").selectOption(category);
  if (subCategory) await page.locator("#dialogCharacterSubCategoryFilter").selectOption(subCategory);
  await close();
}
async function verify(index, category, subCategory = "") {
  await open(index);
  assert.equal(await page.locator("#dialogCharacterCategoryFilter").inputValue(), category);
  assert.equal(await page.locator("#dialogCharacterSubCategoryFilter").inputValue(), subCategory);
  await close();
}
async function verifyBoth() {
  await verify(0, "여성 의상", "Casual / 캐주얼");
  await verify(1, "남성 의상", "Office / 오피스");
}
try {
  await launch();
  await choose(0, "여성 의상", "Casual / 캐주얼"); await choose(1, "남성 의상", "Office / 오피스");
  await stop(); await launch(); await verifyBoth();
  pass("Actual Electron quit/relaunch with the same isolated app profile preserves two independent slot categories");
  await page.locator("#openPresetLoadButton").click(); await page.locator(`[data-load-preset="${saved.metadata.id}"]`).click();
  await page.locator("#presetLoadDialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator('#characterCards [data-character-field="name"]').first().inputValue(), "Loaded A");
  await verifyBoth(); pass("Loading a different main preset changes prompts but preserves both numbered-field preferences");
  await page.locator('[data-workspace-view="history"]').click();
  await page.locator("#loadHistoryButton").click();
  const reuse = page.locator(`[data-generation-id="${history.id}"] .history-reuse-details summary`);
  await reuse.click(); await page.locator(`[data-apply-generation-preset="${history.id}"]`).click();
  await page.waitForFunction(() => document.querySelector('#characterCards [data-character-field="name"]')?.value === "History A");
  await page.locator('[data-workspace-view="workbench"]').click();
  await verifyBoth(); pass("Applying an actual stored History preset changes prompts without resetting either category");
  await choose(0, "조명"); await choose(1, "");
  await stop(); await launch(); await verify(0, "조명"); await verify(1, "");
  pass("Explicitly changed category and All categories replace old preferences and survive a second Electron restart");
  assert.deepEqual(errors, []);
  await writeFile(path.join(folder, "results.json"), JSON.stringify({ checks, errors, port }, null, 2));
  console.log(`${checks.length}/${checks.length} Electron persistence scenarios passed. Evidence: ${folder}`);
} catch (error) {
  await page?.screenshot({ path: path.join(folder, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally { if (app) await app.close(); }
