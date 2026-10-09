import test from 'node:test';
import assert from 'node:assert/strict';
import { sortPresets } from '../src/ui/preset-sorting.js';
import { t, translateText, formatUIError } from '../src/ui/i18n.js';
import { messages } from '../src/ui/translations.js';
import { manualChapters } from '../src/ui/manual-content.js';

test('Natural name sorting preserves original records, handles case/numbers and deterministic ties', () => {
  const items = [{ id: 'z', name: 'Preset 10' }, { id: 'b', name: 'preset 2' }, { id: 'a', name: 'Preset 2' }, { id: 'x', name: 'Apple' }];
  const before = structuredClone(items);
  assert.deepEqual(sortPresets(items, 'name-asc', 'en').map(item => item.id), ['x', 'a', 'b', 'z']);
  assert.deepEqual(sortPresets(items, 'name-desc', 'en').map(item => item.id), ['z', 'a', 'b', 'x']);
  assert.deepEqual(items, before);
});
test('Creation and modification sorting use separate dates and support legacy missing dates', () => {
  const items = [{ id: 'old', name: 'A', created_at: '2020-01-01', updated_at: '2026-01-01' }, { id: 'new', name: 'B', created_at: '2026-01-01', updated_at: '2021-01-01' }, { id: 'legacy', name: 'C' }];
  assert.deepEqual(sortPresets(items, 'created-desc').map(x => x.id), ['new', 'old', 'legacy']);
  assert.deepEqual(sortPresets(items, 'updated-desc').map(x => x.id), ['old', 'new', 'legacy']);
  assert.deepEqual(sortPresets(items, 'created-asc').map(x => x.id), ['legacy', 'old', 'new']);
  assert.deepEqual(sortPresets(items, 'updated-asc').map(x => x.id), ['legacy', 'new', 'old']);
});
test('Korean and Japanese name ordering follows written text with numbers kept natural', () => {
  assert.deepEqual(sortPresets([{ id: 1, name: '나무' }, { id: 2, name: '가방' }], 'name-asc', 'ko').map(x => x.name), ['가방', '나무']);
  assert.deepEqual(sortPresets([{ id: 1, name: 'かぜ' }, { id: 2, name: 'あさ' }], 'name-asc', 'ja').map(x => x.name), ['あさ', 'かぜ']);
});
test('Every UI message has three translations with identical parameter names', () => {
  const parameters = value => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const [key, value] of Object.entries(messages)) {
    for (const locale of ['ko', 'en', 'ja']) { assert.ok(value[locale], `${locale}: ${key}`); assert.deepEqual(parameters(value[locale]), parameters(key), `${locale}: ${key}`); }
  }
  assert.equal(t('Save', {}, 'ja'), '保存');
  assert.equal(translateText('Saved 3 candidates. Every candidate has an equal chance.', 'ko'), '후보 3개를 저장했습니다. 모든 후보의 선택 확률이 같습니다.');
  assert.equal(translateText('Sample only: Save, __tops__, ||A|B||', 'ja'), '試しに選択: Save, __tops__, ||A|B||');
  assert.equal(translateText('Sample only: $&', 'ko'), '시험 선택: $&');
  assert.equal(translateText(formatUIError('HTTP 502: upstream diagnostic'), 'ja'), 'エラーの詳細: HTTP 502: upstream diagnostic');
});
test('Integrated guide keeps the same chapters and step counts in all three languages', () => {
  assert.equal(manualChapters.length, 11);
  assert.equal(new Set(manualChapters.map(c => c.id)).size, 11);
  assert.ok(manualChapters.some(c => c.id === 'wildcards'));
  for (const chapter of manualChapters) for (const locale of ['ko', 'en', 'ja']) {
    const [title, introduction, steps, note] = chapter[locale];
    assert.ok(title && introduction && note); assert.equal(steps.length, 4); assert.ok(steps.every(Boolean));
  }
});
