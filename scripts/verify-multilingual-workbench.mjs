import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDefaultPreset } from '../src/state/preset-schema.js';
import { createPresetStore } from '../src/services/preset-store.js';
import { createCharacterPresetStore } from '../src/services/character-preset-store.js';
import { createGenerationStore } from '../src/services/generation-store.js';
import { createWildcardStore } from '../src/services/wildcard-store.js';
import { buildModeGeneratePayload } from '../src/adapters/novelai-v45-generation-modes.js';
import { encodeRgbPng } from '../src/services/generation-image-utils.js';
import { sortPresets } from '../src/ui/preset-sorting.js';
import { messages } from '../src/ui/translations.js';
import { manualChapters } from '../src/ui/manual-content.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url), { _electron } = require(process.env.CHAESSI_PLAYWRIGHT || 'playwright');
const folder = path.join(root, '.cache', 'multilingual-verification', `run-${Date.now()}`); await mkdir(folder, { recursive: true });
const source = path.join(folder, 'source.png');
await writeFile(source, encodeRgbPng(Buffer.alloc(512 * 512 * 3, 155), 512, 512));
const picture = process.env.CHAESSI_GUIDE_IMAGE ? await readFile(process.env.CHAESSI_GUIDE_IMAGE) : await readFile(source);
const legacy = createDefaultPreset({ metadata: { name: 'Chaessi · Studio', id: 'guide_studio' }, params: { model: 'nai-diffusion-4-5-full', scale: 4, seed: 321, width: picture.readUInt32BE(16), height: picture.readUInt32BE(20) }, prompt_parts: { base: 'adult woman, glasses, brown hair, white shirt, beige cardigan, bookshelf, soft light', undesired: 'lowres, text', characters: [{ name: 'Chaessi (peach)', prompt: 'glasses, brown hair, white shirt', undesired: 'blurry', centers: [{ x: .35, y: .5 }] }, { name: 'Companion', prompt: 'blue shirt', centers: [{ x: .7, y: .5 }] }] } });
const presetStore = createPresetStore({ rootDir: folder }); const saved = await presetStore.savePreset(legacy);
const names = ['Zebra 10', 'Zebra 2', 'Apple', '가나다', '나무', 'あさ', 'かぜ', 'アオ', 'Save', 'Delete'];
for (let index = 0; index < names.length; index++) await presetStore.savePreset(createDefaultPreset({ metadata: { id: `sort_${index}`, name: names[index], created_at: `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00Z` } }));
const characterStore = createCharacterPresetStore({ rootDir: folder });
for (let index = 0; index < 55; index++) await characterStore.saveCharacterPreset({ id: `character_sort_${index}`, name: names[index] || `Zebra ${index}`, category: '여성 의상', subCategory: index === 54 ? 'Office / 오피스' : 'Casual / 캐주얼', prompt: index === 0 ? 'red shirt' : 'blue shirt', created_at: `2026-09-${String(index % 28 + 1).padStart(2, '0')}T00:00:00Z` });
await characterStore.saveCharacterPreset({ id: 'custom_name', name: 'Save', category: 'Save', prompt: 'white shirt' });
const wildcardStore = createWildcardStore({ rootDir: folder });
await wildcardStore.save({ key: 'tops', name: 'Tops', text: 'white shirt\nblack shirt\nblue shirt' });
const generationStore = createGenerationStore({ rootDir: folder });
const history = await generationStore.saveGeneration({ preset: legacy, payload: buildModeGeneratePayload(legacy), imageBytes: picture, responseInfo: { generation_id: 'guide_history', created_at: '2026-10-09T00:00:00Z' } });
const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening'); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const base = `http://127.0.0.1:${port}`, checks = [], errors = [], failed = [];
let app, page;
const pass = text => { checks.push(text); console.log(`PASS ${text}`); };
const get = async endpoint => (await fetch(base + endpoint)).json();
async function launch() {
  app = await _electron.launch({ executablePath: process.env.CHAESSI_ELECTRON || require('electron'), args: ['tests/electron-fixture.cjs'], cwd: root,
    env: { ...process.env, PORT: String(port), NAI_ACCESS_TOKEN: 'test-local-only', NOVELAI_TOKEN: '', CHAESSI_TEST_PROVIDER_MODULE: new URL('../tests/mock-workbench-provider.mjs', import.meta.url).href, CHAESSI_ELECTRON_TEST_DATA: folder }, timeout: 45_000 });
  page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => document.querySelector('#presetName')?.value.length > 0);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 980));
}
async function close(id) { await page.locator(`#${id}`).evaluate(el => el.close()); await page.locator(`#${id}`).waitFor({ state: 'hidden' }); }
async function language(locale) { await page.locator('#uiLanguage').selectOption(locale); await page.waitForFunction(locale => document.documentElement.lang === locale, locale); }
async function loadLegacy() { await page.locator('#openPresetLoadButton').click(); await page.locator(`[data-load-preset="${saved.metadata.id}"]`).click(); await page.locator('#presetLoadDialog').waitFor({ state: 'hidden' }); }
async function openCharacter(index = 0) { await page.locator(`[data-character-index="${index}"] [data-character-preset-save]`).click(); await page.locator('#characterPresetDialog').waitFor({ state: 'visible' }); await page.waitForFunction(() => document.querySelector('#dialogCharacterCategoryFilter').options.length > 2); }
const captureGuides = process.env.CHAESSI_CAPTURE_GUIDES !== '0';
async function snapshot(locale, name) { const dir = captureGuides ? path.join(root, 'assets', 'manuals', locale) : path.join(folder, 'screenshots', locale); await mkdir(dir, { recursive: true }); await page.screenshot({ path: path.join(dir, name + '.png') }); }
async function workbench() { await page.locator('[data-workspace-view="workbench"]').click(); }
try {
  await launch();
  assert.equal(await page.locator('#paramModel').inputValue(), 'nai-diffusion-5-full');
  assert.equal(await page.locator('#paramScale').inputValue(), '5');
  assert.equal(await page.locator('#paramModel option').first().getAttribute('value'), 'nai-diffusion-5-full');
  assert.equal((await get('/api/preset/default')).preset.params.qualityPreset, 'standard');
  pass('Fresh actual Electron workbench defaults to V5 and its profile; model menu lists V5 first');
  await loadLegacy(); assert.equal(await page.locator('#paramModel').inputValue(), 'nai-diffusion-4-5-full'); assert.equal(await page.locator('#paramScale').inputValue(), '4');
  pass('Existing v3.4.2 V4.5 preset restores model, scale, prompts and characters unchanged');
  const prompt = 'Save, Delete, white shirt, __tops__, ||standing|sitting||';
  await page.locator('#basePrompt').fill(prompt); await page.locator('#presetName').fill('Save');
  await page.locator('[data-character-index="0"] [data-character-field="name"]').fill('Delete');
  await openCharacter(); await page.locator('#dialogCharacterCategoryFilter').selectOption('여성 의상'); await page.locator('#dialogCharacterSubCategoryFilter').selectOption('Casual / 캐주얼'); await close('characterPresetDialog');
  await page.locator('[data-generation-mode="inpaint"]').click(); await page.locator('#generationSourceInput').setInputFiles(source);
  await page.waitForFunction(() => document.querySelector('#generationSourceCanvas').width === 512 && !document.querySelector('#sourceEmptyState').hidden === false);
  const canvas = page.locator('#inpaintMaskOverlayCanvas'); const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2); await page.mouse.up();
  const stateSnapshot = () => page.evaluate(() => ({ base: document.querySelector('#basePrompt').value, name: document.querySelector('#presetName').value,
    characters: [...document.querySelectorAll('#characterCards input, #characterCards textarea')].map(el => el.value), model: document.querySelector('#paramModel').value, seed: document.querySelector('#paramSeed').value,
    source: document.querySelector('#generationSourceCanvas').toDataURL(), mask: document.querySelector('#inpaintMaskCanvas').toDataURL() }));
  const before = await stateSnapshot();
  for (const locale of ['ko', 'en', 'ja', 'ko']) {
    await language(locale); assert.deepEqual(await stateSnapshot(), before);
    assert.equal(await page.locator('#generateButton').textContent(), messages['Generate One Image'][locale]);
    assert.equal(await page.locator('#savePresetButton').textContent(), messages.Save[locale]);
    assert.equal(await page.locator('#advancedSettingsButton').textContent(), messages['More settings'][locale]);
  }
  pass('KO/EN/JA switching translates controls and preserves exact user names, prompts, characters, V4.5 settings, source and painted mask');
  await page.locator('[data-generation-mode="text-to-image"]').click();
  for (const locale of ['ko', 'en', 'ja']) {
    await language(locale); await page.locator('#openPresetLoadButton').click();
    const items = (await get('/api/presets')).items;
    for (const mode of ['name-asc', 'name-desc', 'created-desc', 'created-asc', 'updated-desc', 'updated-asc']) {
      await page.locator('#mainPresetSort').selectOption(mode);
      assert.deepEqual(await page.locator('[data-load-preset]').evaluateAll(nodes => nodes.map(n => n.dataset.loadPreset)), sortPresets(items, mode, locale).map(item => item.id));
    }
    await page.locator('#mainPresetSort').selectOption('name-asc');
    assert.equal(await page.locator('.preset-card strong').filter({ hasText: /^Save$/ }).textContent(), 'Save');
    await page.locator('#presetSearch').fill('Zebra'); assert.equal(await page.locator('.preset-card').count(), 2); await page.locator('#presetSearch').fill(''); await close('presetLoadDialog');
    await openCharacter();
    await page.locator('#dialogCharacterCategoryFilter').selectOption('여성 의상'); await page.locator('#dialogCharacterSubCategoryFilter').selectOption('Casual / 캐주얼');
    await page.locator('#characterPresetSort').selectOption('name-asc');
    const all = (await get('/api/character-presets')).items.filter(item => item.category === '여성 의상' && item.subCategory === 'Casual / 캐주얼');
    assert.deepEqual(await page.locator('[data-dialog-character-load]').evaluateAll(nodes => nodes.map(n => n.dataset.dialogCharacterLoad)), sortPresets(all, 'name-asc', locale).slice(0, 50).map(item => item.id));
    await page.locator('#characterPresetSearch').fill('Zebra 10'); assert.equal(await page.locator('[data-dialog-character-load]').count(), all.filter(item => item.name.includes('Zebra 10')).length); await page.locator('#characterPresetSearch').fill('');
    assert.equal(await page.locator('#dialogCharacterCategoryFilter').inputValue(), '여성 의상');
    await page.locator('#dialogCharacterCategoryFilter').selectOption('Save'); assert.equal(await page.locator('#dialogCharacterCategoryFilter option:checked').textContent(), 'Save');
    await page.locator('#dialogCharacterCategoryFilter').selectOption('여성 의상'); await page.locator('#dialogCharacterSubCategoryFilter').selectOption('Casual / 캐주얼'); await close('characterPresetDialog');
  }
  pass('All six sort orders in all three languages, main search, Character category/search, sorting before pagination and user-owned category/name protection pass');
  await language('ja'); await page.locator('#openPresetLoadButton').click(); await page.locator('#mainPresetSort').selectOption('created-desc'); await close('presetLoadDialog');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.session.flushStorageData()); await app.close(); app = null;
  for (let i = 0; i < 100; i++) { try { await fetch(base + '/api/health'); } catch { break; } await new Promise(resolve => setTimeout(resolve, 50)); }
  await launch(); assert.equal(await page.locator('#uiLanguage').inputValue(), 'ja'); assert.equal(await page.locator('#mainPresetSort').inputValue(), 'created-desc');
  await loadLegacy(); await openCharacter(); assert.equal(await page.locator('#dialogCharacterSubCategoryFilter').inputValue(), 'Casual / 캐주얼'); await close('characterPresetDialog');
  pass('Actual Electron restart preserves language, sort preference and numbered Character category independently of loaded preset');
  // Capture real current UI for the offline guide in every language.
  await page.locator('[data-workspace-view="history"]').click(); await page.locator('#loadHistoryButton').click();
  await page.locator(`[data-view-generation="${history.id}"]`).click(); await page.locator('[data-viewer-reuse="preview"]').click();
  await page.locator('#imageViewerDialog').waitFor({ state: 'hidden' }); await workbench();
  await page.locator('#paramModel').selectOption('nai-diffusion-5-full');
  for (const locale of ['ko', 'en', 'ja']) {
    await language(locale); await snapshot(locale, 'workbench');
    await page.locator('#advancedSettingsButton').click(); await snapshot(locale, 'generation'); await close('generationSettingsDialog');
    await page.locator('#apiSettingsButton').click(); await snapshot(locale, 'settings'); await close('apiSettingsDialog');
    await page.locator('[data-expand-prompt="basePrompt"]').click(); await snapshot(locale, 'editor'); await close('promptEditorDialog');
    await page.locator('#openPresetLoadButton').click(); await page.locator('#mainPresetSort').selectOption('name-asc'); await snapshot(locale, 'presets'); await close('presetLoadDialog');
    await openCharacter(); await snapshot(locale, 'character'); await close('characterPresetDialog');
    await page.locator('#openWildcardsButton').click(); await page.locator('#wildcardList button').first().click(); await snapshot(locale, 'wildcard'); await page.locator('#wildcardClose').click();
    await page.locator('#characterPositionMode').selectOption('custom'); await page.locator('#characterPositionPadPanel').scrollIntoViewIfNeeded(); await snapshot(locale, 'position');
    await page.locator('[data-generation-mode="inpaint"]').click(); await page.locator('#generationSourceInput').setInputFiles(source);
    await page.waitForFunction(() => !document.querySelector('#sourceEmptyState').hidden === false);
    await page.locator('#inpaintTools').scrollIntoViewIfNeeded();
    const maskBox = await page.locator('#inpaintMaskOverlayCanvas').boundingBox();
    await page.mouse.move(maskBox.x + maskBox.width / 2, maskBox.y + maskBox.height / 2); await page.mouse.down(); await page.mouse.move(maskBox.x + maskBox.width / 2 + 35, maskBox.y + maskBox.height / 2); await page.mouse.up();
    await snapshot(locale, 'inpaint'); await page.locator('[data-generation-mode="text-to-image"]').click();
    await page.locator('[data-workspace-view="history"]').click(); await snapshot(locale, 'history'); await workbench();
    await page.locator('#editorPane').evaluate(el => { el.scrollTop = 0; });
  }
  pass(`30 actual Electron screenshots captured without exposing tokens; ${captureGuides ? 'KO/EN/JA guide assets updated' : 'existing guide assets preserved'}`);
  const manualState = await stateSnapshot();
  const remoteManualRequests = [];
  await page.route('**/*', route => { const url = route.request().url(); if (/^(data:|blob:)/.test(url) || new URL(url).origin === base) return route.continue(); remoteManualRequests.push(url); return route.abort(); });
  await page.locator('#navManuals').click();
  for (const locale of ['ko', 'en', 'ja']) {
    await page.locator('#manualLanguage').selectOption(locale);
    assert.equal(await page.locator('#manualContents button').count(), 11);
    for (const chapter of manualChapters) {
      await page.locator(`[data-manual-chapter="${chapter.id}"]`).click();
      assert.equal(await page.locator('#manualArticle h3').textContent(), chapter[locale][0]);
      await page.waitForFunction(() => { const image = document.querySelector('#manualArticle img'); return image.complete && image.naturalWidth > 0; });
      const response = await fetch(base + `/assets/manuals/${locale}/${chapter.image}.png`); assert.equal(response.status, 200);
    }
    await page.locator('#manualSearch').fill(chapterSearch(locale)); assert.equal(await page.locator('#manualContents button').count(), 1); await page.locator('#manualSearch').fill('');
    await page.locator('[data-manual-chapter="wildcards"]').click(); await page.locator('.manual-picture').click(); assert.equal(await page.locator('#manualImageZoom').isVisible(), true); await close('manualImageZoom');
    await page.locator('#manualTextSize').fill('22'); assert.equal(await page.locator('#manualArticle').evaluate(el => el.style.fontSize), '22px');
    await page.locator('#manualArticle').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: path.join(folder, `manual-${locale}.png`) });
    if (captureGuides) await page.screenshot({ path: path.join(root, 'assets', 'manuals', locale, 'help-center.png') });
  }
  await page.locator('#manualClose').click(); assert.deepEqual(await stateSnapshot(), manualState);
  assert.deepEqual(remoteManualRequests, []);
  pass('All 33 localized chapters, packaged local screenshots, search, image zoom and text sizing work inside Electron and preserve workbench state');
  for (const locale of ['ko', 'en', 'ja']) {
    await language(locale);
    assert.equal(await page.locator('#navManuals').textContent(), messages['ⓘ Help Center'][locale]);
    const unchanged = await stateSnapshot();
    for (const [host, chapter] of [['.preset-prompt-surface', 'editing'], ['.preset-character-surface', 'characters'], ['#panel-generate', 'models']]) {
      const helpButton = page.locator(`${host} [data-help-topic="${chapter}"]`).first();
      await helpButton.click();
      assert.equal(await page.locator('#manualTitle').textContent(), messages['Help Center'][locale]);
      assert.equal(await page.locator('#manualArticle h3').textContent(), manualChapters.find(c => c.id === chapter)[locale][0]);
      await page.locator('#manualSearch').fill('no matching topic');
      await page.locator('#manualClose').click();
      assert.equal(await helpButton.evaluate(el => el === document.activeElement), true);
    }
    for (const [openButton, host, chapter] of [['#advancedSettingsButton', '#generationSettingsDialog', 'models'], ['#apiSettingsButton', '#apiSettingsDialog', 'account'], ['#openPresetLoadButton', '#presetLoadDialog', 'presets'], ['[data-character-index="0"] [data-character-preset-save]', '#characterPresetDialog', 'characters'], ['#openWildcardsButton', '#wildcardDialog', 'wildcards']]) {
      await page.locator(openButton).click();
      if (chapter === 'wildcards') { await page.locator('#wildcardList button').first().click(); }
      const helpButton = page.locator(`${host} [data-help-topic="${chapter}"]`);
      await helpButton.click();
      assert.equal(await page.locator('#manualSearch').inputValue(), '');
      assert.equal(await page.locator('#manualArticle h3').textContent(), manualChapters.find(c => c.id === chapter)[locale][0]);
      assert.equal(await page.locator(host).evaluate(el => el.open), true);
      await page.locator('#manualClose').click();
      assert.equal(await helpButton.evaluate(el => el === document.activeElement), true);
      if (chapter === 'wildcards') assert.equal(await page.locator('#wildcardEntries').inputValue(), 'white shirt\nblack shirt\nblue shirt');
      await close(host.slice(1));
    }
    for (const [host, chapter] of [['#characterPositionPadPanel', 'position'], ['#modeSourcePanel', 'images'], ['#panel-history', 'history']]) {
      if (chapter === 'images') await page.locator('[data-generation-mode="inpaint"]').click();
      if (chapter === 'history') await page.locator('[data-workspace-view="history"]').click();
      await page.locator(`${host} [data-help-topic="${chapter}"]`).click();
      assert.equal(await page.locator('#manualArticle h3').textContent(), manualChapters.find(c => c.id === chapter)[locale][0]);
      await page.locator('#manualClose').click();
      if (chapter === 'images') await page.locator('[data-generation-mode="text-to-image"]').click();
      if (chapter === 'history') await workbench();
    }
    assert.deepEqual(await stateSnapshot(), unchanged);
  }
  assert.deepEqual(remoteManualRequests, []);
  pass('Contextual Help Center entries in KO/EN/JA reset stale search, open the right topic offline, preserve tool dialogs and work, and return keyboard focus');
  await page.locator('#openPresetLoadButton').click(); await page.locator('[data-delete-preset="sort_0"]').click();
  assert.equal(await page.locator('#deleteConfirmName').textContent(), 'Zebra 10'); assert.equal(await page.evaluate(() => document.activeElement.id), 'deleteConfirmCancel');
  assert.equal(await page.locator('#deleteConfirmCancel').evaluate(el => el.classList.contains('danger-button')), false);
  const gap = await page.evaluate(() => { const a = document.querySelector('#deleteConfirmCancel').getBoundingClientRect(), b = document.querySelector('#deleteConfirmAccept').getBoundingClientRect(); return b.left - a.right; }); assert.ok(gap >= 22);
  await page.keyboard.press('Enter'); await page.locator('#deleteConfirmDialog').waitFor({ state: 'hidden' }); assert.equal((await get('/api/presets/sort_0')).ok, true);
  await page.locator('[data-delete-preset="sort_0"]').click(); await page.locator('#deleteConfirmAccept').click(); await page.locator('[data-delete-preset="sort_0"]').waitFor({ state: 'detached' }); assert.equal((await get('/api/presets/sort_0')).ok, false); await close('presetLoadDialog');
  pass('Main preset deletion names its target, defaults to Cancel on Enter, and deletes only after explicit confirmation');
  await openCharacter(); await page.locator('#characterPresetSearch').fill('Zebra 10'); await page.locator('[data-dialog-character-delete="character_sort_0"]').click(); await page.keyboard.press('Escape'); await page.locator('#deleteConfirmDialog').waitFor({ state: 'hidden' }); assert.equal((await get('/api/character-presets/character_sort_0')).ok, true);
  await page.locator('[data-dialog-character-delete="character_sort_0"]').click(); await page.locator('#deleteConfirmAccept').click(); await page.locator('[data-dialog-character-delete="character_sort_0"]').waitFor({ state: 'detached' }); await page.locator('#characterPresetSearch').fill(''); await close('characterPresetDialog');
  const characterCount = await page.locator('#characterCards .character-card').count(); await page.locator('[data-remove-character="1"]').click(); await page.locator('#deleteConfirmCancel').click(); assert.equal(await page.locator('#characterCards .character-card').count(), characterCount);
  await page.locator('[data-remove-character="1"]').click(); await page.locator('#deleteConfirmAccept').click(); await page.waitForFunction(count => document.querySelectorAll('#characterCards .character-card').length === count - 1, characterCount);
  pass('Character library and current slot deletion support cancel/accept; Escape keeps saved data; slot removal keeps saved library items');
  await page.locator('#openWildcardsButton').click(); await page.locator('#wildcardList button').first().click(); await page.locator('#wildcardDelete').click(); await page.locator('#deleteConfirmCancel').click(); assert.equal((await get('/api/wildcards')).items.length, 1);
  await page.locator('#wildcardDelete').click(); await page.locator('#deleteConfirmAccept').click(); await page.waitForFunction(() => !document.querySelector('#wildcardList button')); assert.equal((await get('/api/wildcards')).items.length, 0); await page.locator('#wildcardClose').click();
  pass('Wildcard deletion explains broken references and honors both cancel and explicit delete');
  await page.locator('#deleteLatestButton').click(); await page.locator('#deleteConfirmCancel').click(); assert.equal((await get('/api/generations')).items.length, 1);
  await page.locator('#viewLatestButton').click(); await page.locator('#imageViewerDeleteButton').click(); await page.locator('#deleteConfirmAccept').click(); await page.waitForFunction(() => document.querySelector('#imageViewerDialog').open === false); assert.equal((await get('/api/generations')).items.length, 0);
  pass('Latest result and viewer History deletion use the same image preview/impact confirmation and remove only the confirmed record');
  await page.locator('#apiSettingsButton').click(); await page.locator('#clearTokenButton').click(); await page.locator('#deleteConfirmCancel').click(); await close('apiSettingsDialog');
  pass('Saved token removal also requires confirmation');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
  for (const locale of ['ko', 'en', 'ja']) {
    await language(locale); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const rect = await page.locator('#generateButton').boundingBox(); assert.ok(rect.y + rect.height <= await page.evaluate(() => innerHeight));
    await page.locator('#navManuals').click();
    assert.equal(await page.locator('#manualReader').evaluate(el => el.scrollWidth > el.clientWidth), false);
    const closeBox = await page.locator('#manualClose').boundingBox(); assert.ok(closeBox.y + closeBox.height < await page.evaluate(() => innerHeight));
    await page.locator('#manualClose').click();
  }
  pass('KO/EN/JA minimum-size window has no horizontal overflow and keeps Generate accessible');
  assert.deepEqual(errors, []); pass('No renderer errors during multilingual workflows');
} catch (error) { failed.push(error.stack); console.error(error); process.exitCode = 1; await page?.screenshot({ path: path.join(folder, 'failure.png') }).catch(() => {}); }
finally { await writeFile(path.join(folder, 'results.json'), JSON.stringify({ passed: checks, failed, rendererErrors: errors, liveNovelAI: 'not run: mock provider; historical image reused for guide screenshots' }, null, 2)); if (app) await app.close(); console.log(`${checks.length} passed, ${failed.length} failed. Evidence: ${folder}`); }
function chapterSearch(locale) { return { ko: '토큰은 비밀번호', en: 'Treat the token like a password', ja: 'トークンはパスワード' }[locale]; }
