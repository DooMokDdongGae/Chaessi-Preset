import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
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
const dialog = "#characterPresetDialog";
const listResponse = response => new URL(response.url()).pathname === "/api/character-presets"
  && response.request().method() === "GET";

async function launch(slotCount = 1) {
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
  page.setDefaultTimeout(20_000);
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
  while (await page.locator("#characterCards [data-character-index]").count() < slotCount) {
    await page.locator("#addCharacterButton").click();
  }
}

async function expectCount(selector, count) {
  await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector, count });
}
async function close() {
  // Escape in a focused search input clears its text before cancelling a dialog.
  await page.locator("#closeCharacterPresetDialog").focus();
  await page.keyboard.press("Escape");
  await page.locator(dialog).waitFor({ state: "hidden" });
}
async function more(count) {
  await page.locator(loadMore).click();
  await expectCount(cardSelector, count);
}

const restorations = [];
const loadingRaces = [];
const heldListReleases = [];
const expected = new Map();
const cards = "#dialogCharacterPresetCards";
const slotSelector = index => '#characterCards [data-character-index="' + index + '"]';
const settled = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function navigation() {
  await settled();
  return page.locator(cards).evaluate(el => {
    const value = id => document.getElementById(id).value;
    const rect = el.getBoundingClientRect();
    const firstVisible = [...el.children].findIndex(card => card.getBoundingClientRect().bottom > rect.top);
    return {
      count: el.querySelectorAll("[data-dialog-character-preset-id]").length,
      scrollTop: el.scrollTop,
      maxScroll: el.scrollHeight - el.clientHeight,
      firstVisible,
      search: value("characterPresetSearch"),
      category: value("dialogCharacterCategoryFilter"),
      subCategory: value("dialogCharacterSubCategoryFilter"),
      sort: value("characterPresetSort"),
    };
  });
}

async function remember(context) {
  const actual = await navigation();
  expected.set(context, actual);
  return actual;
}

async function checkNavigation(context, count = expected.get(context)?.count) {
  await expectCount(cardSelector, count);
  const actual = await navigation();
  const saved = expected.get(context);
  if (saved) {
    for (const key of ["search", "category", "subCategory", "sort"]) {
      assert.equal(actual[key], saved[key], context + " " + key);
    }
    const scrollTop = Math.min(saved.scrollTop, actual.maxScroll);
    assert(Math.abs(actual.scrollTop - scrollTop) <= 1,
      context + " pixel scroll expected " + scrollTop + ", got " + actual.scrollTop);
    restorations.push({ context, count, expectedScrollTop: scrollTop, actualScrollTop: actual.scrollTop, firstVisible: actual.firstVisible });
  }
  return actual;
}

async function reopen(context, count) {
  const loaded = page.waitForResponse(listResponse);
  await page.locator(context === "base" ? "#basePromptPresetButton"
    : slotSelector(context) + " [data-character-preset-save]").click();
  const response = await loaded;
  assert(response.ok());
  await response.finished();
  await page.locator(dialog).waitFor({ state: "visible" });
  await checkNavigation(context, count);
}

async function scrollFraction(fraction) {
  await page.locator(cards).evaluate((el, ratio) => {
    el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * ratio);
  }, fraction);
  await settled();
  assert((await navigation()).scrollTop > 0);
}

async function visibleCard() {
  const id = await page.locator(cards).evaluate(el => {
    const box = el.getBoundingClientRect();
    return [...el.querySelectorAll("[data-dialog-character-preset-id]")].find(card => {
      const rect = card.getBoundingClientRect();
      return rect.top >= box.top + 2 && rect.bottom <= box.bottom - 2;
    })?.dataset.dialogCharacterPresetId;
  });
  assert(id, "A fully visible preset card is required");
  return { id, index: Number(id.replace("pagination_preset_", "")), locator: page.locator('[data-dialog-character-preset-id="' + id + '"]') };
}

async function verifyOthers(excluded) {
  for (const context of ["base", 0, 2].filter(key => key !== excluded)) {
    await reopen(context);
    await close();
  }
}

async function holdStaleListResponse() {
  let release, arrived;
  const gate = new Promise(resolve => { release = resolve; });
  const received = new Promise(resolve => { arrived = resolve; });
  heldListReleases.push(release);
  await page.route(/\/api\/character-presets(?:\?|$)/, async route => {
    const response = await route.fetch();
    const body = await response.json();
    arrived();
    await gate;
    // A stale response has fewer entries so an accidental overwrite is observable.
    await route.fulfill({ response, json: { ...body, items: body.items.slice(0, 1) } });
  }, { times: 1 });
  return {
    received,
    async deliver() {
      const loaded = page.waitForResponse(listResponse);
      release();
      await (await loaded).finished();
      await settled();
    },
  };
}

async function historySnapshot() {
  const folder = path.join(profile, "data", "generations");
  const files = await readdir(folder, { recursive: true, withFileTypes: true });
  const snapshots = await Promise.all(files.filter(file => file.isFile()).map(async file => ({
    file: path.relative(folder, path.join(file.parentPath, file.name)),
    sha256: createHash("sha256").update(await readFile(path.join(file.parentPath, file.name))).digest("hex"),
  })));
  return snapshots.sort((a, b) => a.file.localeCompare(b.file));
}

let renderMs;
try {
  await launch();
  while (await page.locator("#characterCards [data-character-index]").count() < 3) {
    await page.locator("#addCharacterButton").click();
  }

  await reopen("base", smallCount);
  assert(await page.locator(loadMore).isHidden());
  assert(await page.locator(showAll).isHidden());
  assert.equal((await navigation()).scrollTop, 0);
  await close();
  pass("A 24-item library shows all items without pagination controls");

  await seedPresets(smallCount, total);
  await reopen("base", 50);
  assert.equal((await navigation()).scrollTop, 0);
  await more(100);
  await scrollFraction(0.4);
  await remember("base");
  await close();
  await reopen("base");
  await close();
  pass("Base starts at 50, retains 100 items and restores the real list pixel offset");

  await reopen(0, 50);
  assert.equal((await navigation()).scrollTop, 0);
  for (const count of [100, 150, 200, 250]) await more(count);
  await scrollFraction(0.55);
  await remember(0);
  await close();
  await reopen("base");
  await close();
  pass("Character 1 independently starts at 50 and retains 250 without changing Base");

  for (const [language, label] of [["ko", "전체 보기"], ["ja", "すべて表示"], ["en", "Show all"]]) {
    await page.locator("#uiLanguage").selectOption(language);
    await reopen(2, 50);
    assert.equal((await navigation()).scrollTop, 0);
    await page.getByRole("button", { name: label, exact: true }).waitFor();
    await close();
  }
  pass("A fresh Character 3 starts at 50, with the existing Korean, Japanese and English controls");

  await reopen(2, 50);
  renderMs = await page.locator(showAll).evaluate(async button => {
    const start = performance.now();
    button.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Math.round(performance.now() - start);
  });
  await expectCount(cardSelector, total);
  assert(await page.locator(loadMore).isHidden());
  assert.equal(await page.locator(cardSelector + ' img[loading="lazy"][decoding="async"]').count(), total);
  const initiallyRequested = thumbnailRequests.size;
  const unseen = page.locator(cardSelector + " img").nth(900);
  assert.equal(await unseen.evaluate(img => img.naturalWidth), 0);
  assert(initiallyRequested < total);
  await unseen.scrollIntoViewIfNeeded();
  await page.waitForFunction(img => img.complete && img.naturalWidth > 0, await unseen.elementHandle());
  assert((await remember(2)).firstVisible >= 450);
  await close();
  pass("Character 3 Show all renders 1,200 cards and lazily loads thumbnails beyond item 451");

  await reopen(1, 50);
  assert.equal((await navigation()).scrollTop, 0);
  await close();
  await page.locator("#addCharacterButton").click();
  await reopen(3, 50);
  assert.equal((await navigation()).scrollTop, 0);
  await close();
  for (let round = 0; round < 3; round++) {
    for (const context of ["base", 0, 2]) {
      await reopen(context);
      await close();
    }
  }
  pass("Repeated Base 100 / Character 1 250 / Character 3 all transitions restore independent pixels; unused Character 2 and newly added Character 4 start fresh");

  for (const context of ["base", 0]) {
    await reopen(context);
    const target = await visibleCard();
    await target.locator.locator("strong").click();
    await remember(context);
    await close();
    await reopen(context);
    await target.locator.locator("[data-dialog-character-load]").click();
    await page.locator(dialog).waitFor({ state: "hidden" });
    const input = context === "base" ? "#basePrompt" : slotSelector(context) + ' [data-character-field="prompt"]';
    assert.equal(await page.locator(input).inputValue(), promptFor(target.index));
    await reopen(context);
    await close();
  }
  await verifyOthers(0);
  pass("Selecting and applying Base and Character presets preserves each list and scroll position");

  await reopen(0);
  await page.locator('[data-library-tab="save"]').click();
  await page.locator('[data-library-tab="browse"]').click();
  await checkNavigation(0);
  await page.locator('[data-library-tab="save"]').click();
  await page.keyboard.press("Escape");
  await page.locator(dialog).waitFor({ state: "hidden" });
  await reopen(0);
  await page.locator("#closeCharacterPresetDialog").click();
  await page.locator(dialog).waitFor({ state: "hidden" });
  await reopen(0);
  await close();
  pass("Save/manage tab, Escape and header Close retain the visible-list position instead of replacing it with hidden-list zero");

  await reopen(0);
  const selected = await visibleCard();
  await selected.locator.locator("strong").click();
  await remember(0);
  await page.locator('[data-library-tab="save"]').click();
  await page.locator("#dialogSaveCharacterPresetButton").click();
  await page.locator(dialog).waitFor({ state: "hidden" });
  await reopen(0);
  await checkNavigation(0);
  await page.locator('[data-library-tab="save"]').click();
  await page.locator("#characterPresetNameInput").fill("zz Navigation test preset");
  await page.locator("#dialogSaveAsCharacterPresetButton").click();
  await page.locator(dialog).waitFor({ state: "hidden" });
  await reopen(0);
  await close();
  expected.get(2).count = total + 1;
  await verifyOthers(0);
  pass("Overwrite and Save As preserve the active hidden-list position and other slots, including Show all after an added preset");

  await reopen(2);
  await scrollFraction(1);
  await remember(2);
  const removed = await visibleCard();
  await removed.locator.locator("[data-dialog-character-delete]").click();
  const beforeDelete = await navigation();
  await page.locator("#deleteConfirmCancel").click();
  await checkNavigation(2);
  await removed.locator.locator("[data-dialog-character-delete]").click();
  await page.locator("#deleteConfirmAccept").click();
  expected.get(2).count = total;
  await expectCount(cardSelector, total);
  const afterDelete = await checkNavigation(2);
  assert(afterDelete.maxScroll < beforeDelete.scrollTop, "Deleting at the bottom must exercise scroll clamping");
  assert.equal(afterDelete.scrollTop, afterDelete.maxScroll);
  assert.equal(await removed.locator.count(), 0);
  await remember(2);
  await close();
  await verifyOthers(2);
  pass("Cancelled deletion keeps scroll; confirmed deletion clamps to the new bottom, refreshes Show all and preserves Base and Character 1");

  await reopen(0);
  const search = page.locator("#characterPresetSearch");
  await search.fill("Preset 000");
  await expectCount(cardSelector, 10);
  assert.equal((await navigation()).scrollTop, 0);
  await search.fill("nothing-matches-this");
  await expectCount(cardSelector, 0);
  await search.fill("Preset 00");
  await page.locator("#dialogCharacterCategoryFilter").selectOption("조명");
  await expectCount(cardSelector, smallCount);
  await page.locator("#characterPresetSort").selectOption("name-desc");
  assert.equal(await page.locator(cardSelector + " strong").first().textContent(), nameFor(23));
  await scrollFraction(0.5);
  await remember(0);
  await close();
  await verifyOthers(0);
  await reopen(0);
  await close();
  pass("Search, empty results, category and descending sort belong to Character 1 and preserve every other slot's filters and scroll");

  await reopen(0);
  await search.fill("");
  await page.locator("#dialogCharacterCategoryFilter").selectOption("여성 의상");
  await page.locator("#dialogCharacterSubCategoryFilter").selectOption("Casual / 캐주얼");
  await expectCount(cardSelector, 250);
  await scrollFraction(0.25);
  await remember(0);
  await close();
  await verifyOthers(0);
  await reopen(0);
  await checkNavigation(0);
  await close();
  pass("Small filtered results retain the 250-item allowance, and category, subcategory, sort and pixels restore independently");

  await reopen(2);
  await search.fill("Preset 000");
  await expectCount(cardSelector, 10);
  await search.fill("");
  await expectCount(cardSelector, total);
  await scrollFraction(0.95);
  await remember(2);
  const refreshed = page.waitForResponse(listResponse);
  await page.locator("#dialogRefreshCharacterPresetButton").click();
  await (await refreshed).finished();
  await checkNavigation(2);
  await close();
  await verifyOthers(2);
  pass("Show all survives filters and an explicit asynchronous refresh preserves the actual list pixels");

  await reopen(2);
  await close();
  const baseLoading = await holdStaleListResponse();
  await page.locator("#basePromptPresetButton").click();
  await baseLoading.received;
  assert.equal(await page.locator(cardSelector).count(), 0, "Loading must not expose another slot's cards");
  await page.locator("#closeCharacterPresetDialog").click();
  await page.locator(dialog).waitFor({ state: "hidden" });
  await reopen("base");
  await baseLoading.deliver();
  loadingRaces.push({ scenario: "delayed Base close and same-slot reopen", ...(await checkNavigation("base")) });
  await close();
  await verifyOthers("base");
  pass("Closing Base before its delayed response preserves the saved 100-item scroll and ignores the old response after reopening");

  await reopen(2);
  await close();
  await page.locator("#addCharacterButton").click();
  const freshLoading = await holdStaleListResponse();
  await page.locator(slotSelector(4) + " [data-character-preset-save]").click();
  await freshLoading.received;
  assert.equal(await page.locator(cardSelector).count(), 0);
  await close();
  await reopen(0);
  await freshLoading.deliver();
  loadingRaces.push({ scenario: "delayed fresh slot closed before switching to Character 1", ...(await checkNavigation(0)) });
  await close();
  await reopen(4, 50);
  assert.equal((await navigation()).scrollTop, 0);
  await close();
  await verifyOthers(0);
  pass("Escape while a fresh slot is loading keeps its 50/zero state and a late response cannot replace another slot's filtered list");

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
  await page.locator('[data-workspace-view="workbench"]').click();
  pass("History keeps its existing 50/100/118 pagination and reset behavior");

  const savedCategories = await page.evaluate(() => localStorage.getItem("chaessi.character-preset-categories.v1"));
  assert.deepEqual(JSON.parse(savedCategories).slots[0], { category: "여성 의상", subCategory: "Casual / 캐주얼" });
  const historyFilesBefore = await historySnapshot();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.session.flushStorageData());
  await app.close();
  app = null;
  await assert.rejects(fetch("http://127.0.0.1:" + port + "/api/health"), "The first local server must stop before restart");

  // The editor starts with its default preset; recreate fields by number for this check.
  await launch(5);
  assert.equal(await page.evaluate(() => localStorage.getItem("chaessi.character-preset-categories.v1")), savedCategories);
  expected.clear();
  for (const context of ["base", 0, 1, 2, 3, 4]) {
    await reopen(context, 50);
    const restarted = await navigation();
    assert.equal(restarted.scrollTop, 0, "Restart scroll " + context);
    if (context === 0) {
      assert.equal(restarted.category, "여성 의상");
      assert.equal(restarted.subCategory, "Casual / 캐주얼");
    }
    await close();
  }
  assert.deepEqual(await historySnapshot(), historyFilesBefore);
  assert.deepEqual(errors, []);
  pass("A full app restart resets every slot to 50 and pixel zero, while retaining exact saved categories and the synthetic History files");

  const result = {
    checks, errors, total, renderMs, initiallyRequested, restorations, loadingRaces, savedCategories,
    historyFiles: historyFilesBefore.length, paidCalls: 0,
  };
  await writeFile(path.join(profile, "results.json"), JSON.stringify(result, null, 2));
  await page.screenshot({ path: path.join(profile, "final.png") });
  console.log(JSON.stringify({ checks: checks.length, renderMs, restorations: restorations.length, initiallyRequested, profile }));
} catch (error) {
  await page?.screenshot({ path: path.join(profile, "failure.png") }).catch(() => {});
  await writeFile(path.join(profile, "failure.json"), JSON.stringify({ message: error.message, checks, errors, restorations }, null, 2));
  console.error("App status:", await page?.locator("#toast").textContent().catch(() => ""));
  throw error;
} finally {
  for (const release of heldListReleases) release();
  if (app) await app.close();
}
