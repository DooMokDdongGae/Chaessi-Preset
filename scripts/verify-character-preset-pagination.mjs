import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCharacterPresetStore } from "../src/services/character-preset-store.js";
import { createGenerationStore } from "../src/services/generation-store.js";
import { encodeRgbPng } from "../src/services/generation-image-utils.js";
import { createDefaultPreset } from "../src/state/preset-schema.js";
import { buildModeGeneratePayload } from "../src/adapters/novelai-v45-generation-modes.js";

const require = createRequire(import.meta.url);
const { _electron } = require(process.env.CHAESSI_PLAYWRIGHT || "playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const profile = path.join(root, ".cache", "preset-list-pagination", "run-" + Date.now());
await mkdir(profile, { recursive: true });

const smallCount = 24;
const total = 1200;
const historyCount = 118;
const image = encodeRgbPng(Buffer.alloc(64 * 64 * 3, 190), 64, 64);
const presets = createCharacterPresetStore({ rootDir: profile });
const nameFor = i => "Preset " + String(i).padStart(4, "0");
const promptFor = i => "test prompt " + i;
async function seedPresets(start, end) {
  for (let i = start; i < end; i++) {
    await presets.saveCharacterPreset({
      id: "pagination_preset_" + i,
      name: nameFor(i),
      category: i < smallCount ? "조명" : "여성 의상",
      subCategory: i < smallCount ? "" : i % 2 ? "Casual / 캐주얼" : "Office / 오피스",
      prompt: promptFor(i),
    }, { thumbnail: { bytes: image, contentType: "image/png" } });
  }
}
await seedPresets(0, smallCount);

const history = createGenerationStore({ rootDir: profile });
const historyPreset = createDefaultPreset({ prompt_parts: { base: "History pagination fixture" } });
const payload = buildModeGeneratePayload(historyPreset, { mode: "text-to-image" });
for (let i = 0; i < historyCount; i++) {
  await history.saveGeneration({
    preset: historyPreset, payload, imageBytes: image,
    responseInfo: { generation_id: "pagination_history_" + i },
  });
}

let app, page;
const probe = net.createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const checks = [];
const errors = [];
const thumbnailRequests = new Set();
const pass = message => { checks.push(message); console.log("PASS " + message); };
const cardSelector = "#dialogCharacterPresetCards [data-dialog-character-preset-id]";
const historySelector = "#historyList .history-card";
const loadMore = "#dialogCharacterPresetLoadMoreButton";
const showAll = "#dialogCharacterPresetShowAllButton";
const slot = '#characterCards [data-character-index="0"]';
const dialog = "#characterPresetDialog";
const listResponse = response => new URL(response.url()).pathname === "/api/character-presets"
  && response.request().method() === "GET";

async function launch() {
  app = await _electron.launch({
    executablePath: process.env.CHAESSI_ELECTRON || require("electron"),
    args: ["tests/electron-fixture.cjs"],
    cwd: root,
    env: {
      ...process.env, PORT: String(port), NAI_ACCESS_TOKEN: "", NOVELAI_TOKEN: "", NODE_OPTIONS: "",
      CHAESSI_ELECTRON_TEST_DATA: profile,
      CHAESSI_TEST_PROVIDER_MODULE: new URL("../tests/mock-confirmation-provider.mjs", import.meta.url).href,
    },
    timeout: 45_000,
  });
  assert.equal(path.resolve(await app.evaluate(({ app }) => app.getPath("userData"))), path.resolve(profile));
  page = await app.firstWindow();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/thumbnail.png")) thumbnailRequests.add(url.pathname);
  });
  await page.context().route("https://**/*", route => route.abort());
  await page.route(/\/api\/(novelai\/generate|image-tools\/run)(?:\?|$)/, route => {
    errors.push("Unexpected generation request");
    return route.abort();
  });
  await page.waitForFunction(() => document.querySelector("#presetName")?.value);
  await page.locator("#uiLanguage").selectOption("en");
  if (!await page.locator(slot).count()) await page.locator("#addCharacterButton").click();
}

async function expectCount(selector, count) {
  await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector, count });
}
async function open(context, count) {
  const loaded = page.waitForResponse(listResponse);
  await page.locator(context === "base" ? "#basePromptPresetButton" : slot + " [data-character-preset-save]").click();
  assert((await loaded).ok());
  await page.locator(dialog).waitFor({ state: "visible" });
  await expectCount(cardSelector, count);
}
async function close() {
  await page.keyboard.press("Escape");
  await page.locator(dialog).waitFor({ state: "hidden" });
}
async function apply(index) {
  await page.locator('[data-dialog-character-load="pagination_preset_' + index + '"]').click();
  await page.locator(dialog).waitFor({ state: "hidden" });
}
async function more(count) {
  await page.locator(loadMore).click();
  await expectCount(cardSelector, count);
}

try {
  await launch();
  await open("base", smallCount);
  assert(await page.locator(loadMore).isHidden());
  assert(await page.locator(showAll).isHidden());
  await close();
  pass("A library with 24 items displays all items without pagination controls");

  await seedPresets(smallCount, total);
  await open("base", 50);
  await more(100);
  await close();
  await open("base", 100);
  await more(150);
  await close();
  await open("base", 150);
  pass("The initial 50 grow to 100 and 150, and each limit survives closing and reopening");

  await apply(120);
  assert.equal(await page.locator("#basePrompt").inputValue(), promptFor(120));
  assert.equal(await page.locator("#presetName").inputValue(), nameFor(120));
  await open("base", 150);
  await close();
  await open("character", 150);
  await apply(140);
  assert.equal(await page.locator(slot + ' [data-character-field="prompt"]').inputValue(), promptFor(140));
  await open("character", 150);
  pass("Base and Character share the limit and preserve it after applying a preset");

  const search = page.locator("#characterPresetSearch");
  await search.fill("Preset 000");
  await expectCount(cardSelector, 10);
  assert(await page.locator(showAll).isHidden());
  await search.fill("nothing-matches-this");
  await expectCount(cardSelector, 0);
  await search.fill("");
  await expectCount(cardSelector, 150);
  await page.locator("#dialogCharacterCategoryFilter").selectOption("조명");
  await expectCount(cardSelector, smallCount);
  await page.locator("#dialogCharacterCategoryFilter").selectOption("여성 의상");
  await page.locator("#dialogCharacterSubCategoryFilter").selectOption("Casual / 캐주얼");
  await expectCount(cardSelector, 150);
  await page.locator("#characterPresetSort").selectOption("name-desc");
  await expectCount(cardSelector, 150);
  assert.equal(await page.locator(cardSelector + " strong").first().textContent(), nameFor(1199));
  await page.locator("#dialogCharacterCategoryFilter").selectOption("");
  await page.locator("#characterPresetSort").selectOption("name-asc");
  await expectCount(cardSelector, 150);
  await close();
  pass("Search, empty results, category, subcategory and sort retain the 150-item limit");

  for (const [language, label] of [["ko", "전체 보기"], ["ja", "すべて表示"], ["en", "Show all"]]) {
    await page.locator("#uiLanguage").selectOption(language);
    await open("base", 150);
    await page.getByRole("button", { name: label, exact: true }).waitFor();
    await close();
  }
  pass("The Show all action is available in Korean, Japanese and English");

  await open("base", 150);
  const renderMs = await page.locator(showAll).evaluate(async button => {
    const start = performance.now();
    button.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Math.round(performance.now() - start);
  });
  await expectCount(cardSelector, total);
  assert(await page.locator(loadMore).isHidden());
  const thumbnails = page.locator(cardSelector + " img");
  assert.equal(await thumbnails.count(), total);
  assert.equal(await page.locator(cardSelector + ' img[loading="lazy"][decoding="async"]').count(), total);
  const unseen = thumbnails.nth(900);
  assert.equal(await unseen.evaluate(img => img.naturalWidth), 0);
  const initiallyRequested = thumbnailRequests.size;
  assert(initiallyRequested < total);
  await unseen.scrollIntoViewIfNeeded();
  await page.waitForFunction(img => img.complete && img.naturalWidth > 0, await unseen.elementHandle());
  console.log(JSON.stringify({ total, renderMs, initiallyRequested, thumbnailAtIndex900LoadedOnScroll: true }));
  pass("All 1,200 cards render and a distant thumbnail loads when scrolled into view");

  await page.locator("#characterPresetSearch").fill("Preset 000");
  await expectCount(cardSelector, 10);
  await page.locator("#characterPresetSearch").fill("");
  await expectCount(cardSelector, total);
  await apply(1100);
  assert.equal(await page.locator("#basePrompt").inputValue(), promptFor(1100));
  await open("character", total);
  await page.locator('[data-library-tab="save"]').click();
  await page.locator("#characterPresetNameInput").fill("New pagination test preset");
  await page.locator("#dialogSaveAsCharacterPresetButton").click();
  await page.locator(dialog).waitFor({ state: "hidden" });
  await open("character", total + 1);
  const newCard = page.locator(cardSelector).filter({ hasText: "New pagination test preset" });
  await newCard.locator("[data-dialog-character-delete]").click();
  await page.locator("#deleteConfirmAccept").click();
  await expectCount(cardSelector, total);
  assert.equal(await newCard.count(), 0);
  await close();
  pass("Show all survives filtering, apply, switching dialogs, Save As and confirmed deletion");

  await page.locator('[data-workspace-view="history"]').click();
  await expectCount(historySelector, 50);
  await page.locator("#historyLoadMoreButton").click();
  await expectCount(historySelector, 100);
  await page.locator("#historyLoadMoreButton").click();
  await expectCount(historySelector, historyCount);
  await page.locator("#historySearch").fill("nothing-matches-this");
  await expectCount(historySelector, 0);
  await page.locator("#historySearch").fill("");
  await expectCount(historySelector, 50);
  pass("History still loads 50 at a time and resets to 50 when its filter changes");

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.session.flushStorageData());
  await app.close();
  app = null;
  await assert.rejects(fetch("http://127.0.0.1:" + port + "/api/health"), "The first local server must stop before restart");
  await launch();
  await open("base", 50);
  assert(await page.locator(showAll).isVisible());
  await close();
  assert.deepEqual(errors, []);
  pass("Quitting and relaunching Electron with the same profile restores the initial 50");

  await writeFile(path.join(profile, "results.json"), JSON.stringify({
    checks, errors, total, renderMs, initiallyRequested, paidCalls: 0,
  }, null, 2));
  console.log(checks.length + " checks passed. Evidence: " + profile);
} catch (error) {
  await page?.screenshot({ path: path.join(profile, "failure.png") }).catch(() => {});
  console.error("App status:", await page?.locator("#toast").textContent().catch(() => ""));
  throw error;
} finally {
  if (app) await app.close();
}
