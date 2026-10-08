import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createCharacterPresetStore } from "../src/services/character-preset-store.js";

// An isolated local app and synthetic presets; no saved credentials or live NovelAI calls.
const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = path.join(root, ".cache", "category-verification", `run-${Date.now()}`);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CHAESSI_PLAYWRIGHT || "playwright");
await mkdir(evidence, { recursive: true });
const casual = "Casual / 캐주얼", office = "Office / 오피스";
const presets = [
  { id: "character_test_fcasual", name: "Female casual", category: "여성 의상", subCategory: casual, prompt: "white shirt, __colors__, ||standing|sitting||" },
  { id: "character_test_foffice", name: "Female office", category: "여성 의상", subCategory: office, prompt: "gray blazer" },
  { id: "character_test_mcasual", name: "Male casual", category: "남성 의상", subCategory: casual, prompt: "blue shirt" },
  { id: "character_test_lighting", name: "Soft light", category: "조명", prompt: "soft lighting" },
  { id: "character_test_base", name: "Actual Base Name", category: "기타", prompt: "1girl, __colors__, ||indoors|outdoors||", undesired: "lowres" },
];
const store = createCharacterPresetStore({ rootDir: evidence });
for (const preset of presets) await store.saveCharacterPreset(preset);
const probe = net.createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: root, windowsHide: true, env: { ...process.env, PORT: String(port), CHAESSI_USER_DATA_DIR: evidence, NAI_ACCESS_TOKEN: "", NOVELAI_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"],
});
let serverErrors = "";
child.stderr.on("data", chunk => { serverErrors = (serverErrors + chunk).slice(-4000); });
child.stdout.on("data", chunk => { serverErrors = (serverErrors + chunk).slice(-4000); });
const exit = once(child, "exit");
const checks = [], errors = [];
let browser, page;
const pass = message => { checks.push(message); console.log(`PASS ${message}`); };

try {
  let ready = false;
  let healthError = "";
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch (error) { healthError = `${error.message} ${error.cause?.message || ""}`; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Isolated app server started at ${base}: ${serverErrors}; ${healthError}`);
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector("#presetName").value.length > 0);
  assert.match(await page.locator("#healthStatus").textContent(), /3\.4\.1/);
  const card = i => page.locator(`#characterCards [data-character-index="${i}"]`);
  const category = page.locator("#dialogCharacterCategoryFilter");
  const subcategory = page.locator("#dialogCharacterSubCategoryFilter");
  async function open(i) {
    await (i === "base" ? page.locator("#basePromptPresetButton") : card(i).locator("[data-character-preset-save]")).click();
    await page.locator("#characterPresetDialog").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector("#characterPresetDialogStatus").textContent.includes("character presets loaded"));
  }
  async function close() {
    await page.keyboard.press("Escape");
    await page.locator("#characterPresetDialog").waitFor({ state: "hidden" });
  }
  async function choose(cat, sub = "") { await category.selectOption(cat); if (sub) await subcategory.selectOption(sub); }
  async function filter(cat, sub, ids) {
    assert.equal(await category.inputValue(), cat);
    assert.equal(await subcategory.inputValue(), sub);
    if (ids) {
      const actual = await page.locator("#dialogCharacterPresetCards [data-dialog-character-load]").evaluateAll(els => els.map(el => el.dataset.dialogCharacterLoad).sort());
      assert.deepEqual(actual, [...ids].sort());
    }
  }
  await page.locator("#addCharacterButton").click();
  await page.locator("#addCharacterButton").click();
  await open(0); await choose("여성 의상", casual); await filter("여성 의상", casual, [presets[0].id]); await close();
  await open(0); await filter("여성 의상", casual, [presets[0].id]);
  await page.locator("#characterPresetDialog").screenshot({ path: path.join(evidence, "slot-1-female-casual.png") });
  await close(); pass("Reopening a Character Prompt restores category, subcategory and filtered cards");

  await open(1); await filter("", "", presets.map(p => p.id));
  await choose("남성 의상", casual); await close();
  await open(0); await filter("여성 의상", casual, [presets[0].id]);
  await page.locator(`[data-dialog-character-load="${presets[0].id}"]`).click();
  await page.locator("#characterPresetDialog").waitFor({ state: "hidden" });
  assert.equal(await card(0).locator('[data-character-field="name"]').inputValue(), presets[0].name);
  assert.equal(await card(0).locator('[data-character-field="prompt"]').inputValue(), presets[0].prompt);
  await open(0); await filter("여성 의상", casual, [presets[0].id]); await close();
  await open(1); await filter("남성 의상", casual, [presets[2].id]);
  await page.locator("#characterPresetDialog").screenshot({ path: path.join(evidence, "slot-2-male-casual.png") });
  await close(); pass("Two slots keep independent choices; loading a Character Preset preserves its slot's filter and prompt");

  await open(0); await subcategory.selectOption(office); await close();
  await open(0); await filter("여성 의상", office, [presets[1].id]);
  await choose("남성 의상", casual); await close();
  await open(0); await filter("남성 의상", casual, [presets[2].id]);
  await choose("조명"); assert.equal(await subcategory.isDisabled(), true); await close();
  await open(0); await filter("조명", "", [presets[3].id]);
  await choose(""); await close();
  await open(0); await filter("", "", presets.map(p => p.id));
  await choose("여성 의상", casual); await subcategory.selectOption(""); await close();
  await open(0); await filter("여성 의상", "", [presets[0].id, presets[1].id]); await close();
  pass("Explicit parent/subcategory changes, categories without children, All categories and All subcategories are remembered");

  await open("base"); await filter("", "", presets.map(p => p.id)); await choose("기타");
  await page.locator(`[data-dialog-character-load="${presets[4].id}"]`).click();
  await page.locator("#characterPresetDialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#presetName").inputValue(), presets[4].name);
  assert.equal(await page.locator("#basePrompt").inputValue(), presets[4].prompt);
  await open(0); await filter("여성 의상", "", [presets[0].id, presets[1].id]); await choose("여성 의상", casual); await close();
  await open("base"); await filter("기타", "", [presets[4].id]); await choose("여성 의상", office); await close();
  await open(1); await filter("남성 의상", casual, [presets[2].id]); await close();
  await open("base"); await filter("여성 의상", office, [presets[1].id]); await close();
  pass("Base Prompt loading retains the actual name and prompt; Base and Character browsing preferences do not overwrite each other");

  await page.locator("#paramModel").selectOption("nai-diffusion-5-full");
  await card(0).locator('[data-character-tab="undesired"]').click();
  await card(0).locator("[data-toggle-character]").click();
  await open(0); await filter("여성 의상", casual, [presets[0].id]); await close();
  await card(0).locator("[data-toggle-character]").click();
  await card(0).locator('[data-move-character="down"]').click();
  await open(0); await filter("남성 의상", casual, [presets[2].id]); await close();
  await open(1); await filter("여성 의상", casual, [presets[0].id]); await close();
  await card(0).locator("[data-remove-character]").click();
  await open(0); await filter("여성 의상", casual, [presets[0].id]); await close();
  await page.locator("#addCharacterButton").click();
  await open(1); await filter("", "", presets.map(p => p.id)); await close();
  pass("Model/tab/enable changes preserve selection; move and delete follow the character; a newly added slot starts clean");

  await page.locator("#savePresetButton").click(); await page.locator("#confirmSavePresetButton").click();
  await page.locator("#presetSaveDialog").waitFor({ state: "hidden" });
  const list = await (await fetch(`${base}/api/presets`)).json();
  const saved = (await (await fetch(`${base}/api/presets/${list.items[0].id}`)).json()).preset;
  assert.equal(saved.prompt_parts.characters[0].prompt, presets[0].prompt);
  assert.ok(!JSON.stringify(saved).includes("presetCategoryFilter"));
  await open(0); await filter("여성 의상", casual, [presets[0].id]); await close();
  await page.locator("#openPresetLoadButton").click();
  await page.locator(`[data-load-preset="${list.items[0].id}"]`).click();
  await page.locator("#presetLoadDialog").waitFor({ state: "hidden" });
  await open(0); await filter("", "", presets.map(p => p.id)); await close();
  pass("Saving retains the current choices and reusable prompts without UI fields; loading a main preset resets editor preferences");

  await page.locator("#openWildcardsButton").click(); await page.locator("#wildcardNew").click();
  await page.locator("#wildcardKey").fill("colors"); await page.locator("#wildcardEntries").fill("blue\nred");
  await page.locator("#wildcardSave").click(); await page.locator("#wildcardStatus").filter({ hasText: "Saved" }).waitFor();
  await page.locator("#wildcardClose").click();
  const preparedResponse = await fetch(`${base}/api/novelai/prepare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset: saved }) });
  assert.equal(preparedResponse.status, 200);
  const prepared = await preparedResponse.json();
  assert.ok(!JSON.stringify(prepared.preset.prompt_parts).includes("__colors__"));
  assert.ok(!JSON.stringify(prepared.preset.prompt_parts).includes("||"));
  assert.ok(!JSON.stringify(prepared.preset).includes("presetCategoryFilter"));
  assert.match(saved.prompt_parts.characters[0].prompt, /__colors__/);
  pass("Wildcard management, saved references and existing random syntax still resolve through the app's preparation endpoint");
  assert.deepEqual(errors, []); pass("No renderer JavaScript errors");
  await writeFile(path.join(evidence, "results.json"), JSON.stringify({ version: "3.4.1", checks, errors }, null, 2));
  console.log(`${checks.length}/${checks.length} UI scenarios passed. Evidence: ${evidence}`);
} catch (error) {
  await page?.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close(); child.kill(); await exit;
}
