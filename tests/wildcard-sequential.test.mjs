import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createWildcardStore} from '../src/services/wildcard-store.js';
import {resolveGenerationPrompts, usedSequentialChoices} from '../src/services/generation-prompt-resolver.js';
import {createDefaultPreset} from '../src/state/preset-schema.js';
import {buildModeGeneratePayload} from '../src/adapters/novelai-v45-generation-modes.js';
import {createGenerationStore} from '../src/services/generation-store.js';
import {encodeRgbPng} from '../src/services/generation-image-utils.js';
import {buildV5GeneratePayload} from '../src/adapters/novelai-v5-full.js';

const png = encodeRgbPng(Buffer.alloc(64 * 64 * 3, 190), 64, 64);
const preset = (base = '__pose__', extra = {}) => createDefaultPreset({params: {model: 'nai-diffusion-5-full', width: 64, height: 64, seed: 123, ...extra.params}, prompt_parts: {base, ...extra.prompt_parts}});
async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chaessi-wildcard-sequence-'));
  try { await fn(root, createWildcardStore({rootDir: root})); }
  finally { await rm(root, {recursive: true, force: true}); }
}
async function plan(store, input = preset(), pick = () => 0, mode = 'text-to-image') {
  const choices = [], resolved = resolveGenerationPrompts(input, await store.all(), pick, {mode, sequentialChoices: choices});
  const payload = buildModeGeneratePayload(resolved, {mode});
  return {choices: usedSequentialChoices(choices, payload), resolved, payload};
}
async function save(root, store, prepared, {finish = true} = {}) {
  const lease = await store.beginSequence(prepared.choices);
  const trace = await store.stageSequence(lease, png);
  const saved = await createGenerationStore({rootDir: root}).saveGeneration({preset: prepared.resolved, payload: prepared.payload, imageBytes: png, wildcardSelection: trace,
    responseInfo: {...(trace ? {generation_id: trace.id, created_at: trace.created_at} : {})}});
  if (finish) await store.finishSequence(lease);
  return {lease, trace, saved};
}
const sequential = {key: 'pose', entries: ['A', 'B', 'C'], selection_mode: 'sequential'};

test('sequential cycles only after History saves, persists restart, and commits once', () => fixture(async (root, store) => {
  const item = await store.save(sequential);
  for (const value of ['A', 'B', 'C', 'A']) {
    const p = await plan(store); assert.equal(p.resolved.prompt_parts.base, value);
    const result = await save(root, store, p); await store.finishSequence(result.lease);
    const record = JSON.parse(await readFile(path.join(root, result.saved.sidecar_path), 'utf8'));
    assert.equal(record.generation.prompt.split(',')[0], value);
    assert.equal(record.wildcard_selection.selections[0].entry, value);
    assert.equal(record.wildcard_selection.selections[0].entries, undefined);
  }
  const reopened = createWildcardStore({rootDir: root});
  assert.equal((await reopened.get(item.id)).sequence.next_entry, 'B');
  await reopened.resetSequence(item.id);
  assert.equal((await reopened.get(item.id)).sequence.next_entry, 'A');
}));

test('prepare, cancelled or failed request, and incomplete History never advance', () => fixture(async (root, store) => {
  const item = await store.save(sequential);
  for (let n = 0; n < 3; n++) assert.equal((await plan(store)).resolved.prompt_parts.base, 'A');
  let lease = await store.beginSequence((await plan(store)).choices); await store.abortSequence(lease);
  assert.equal((await store.get(item.id)).sequence.next_entry, 'A');
  lease = await store.beginSequence((await plan(store)).choices);
  const trace = await store.stageSequence(lease, png);
  const folder = path.join(root, 'data', 'generations', trace.created_at.slice(0, 10)); await mkdir(folder, {recursive: true});
  await writeFile(path.join(folder, trace.id + '.json'), '{"status":');
  const reopened = createWildcardStore({rootDir: root});
  assert.equal((await reopened.get(item.id)).sequence.next_entry, 'A');
  const state = JSON.parse(await readFile(path.join(root, 'data/wildcard-sequence/state.json'), 'utf8')); assert.equal(state.pending, null);
}));

test('restart completes a saved History pending cursor update exactly once', () => fixture(async (root, store) => {
  const item = await store.save(sequential), p = await plan(store);
  await save(root, store, p, {finish: false});
  for (let n = 0; n < 3; n++) assert.equal((await createWildcardStore({rootDir: root}).get(item.id)).sequence.next_entry, 'B');
  assert.equal(JSON.parse(await readFile(path.join(root, 'data/wildcard-sequence/state.json'), 'utf8')).cursors[item.id].revision, 1);
}));

test('cursor save errors recover pending success, without a duplicate provider call or step', () => fixture(async (root, store) => {
  const item = await store.save(sequential);
  const result = await save(root, store, await plan(store), {finish: false});
  const statePath = path.join(root, 'data/wildcard-sequence/state.json');
  const pending = await readFile(statePath);
  // Deterministic replacement failure after complete History: a directory occupies the state filename.
  await rm(statePath); await mkdir(statePath);
  await assert.rejects(store.finishSequence(result.lease));
  await rm(statePath, {recursive: true}); await writeFile(statePath, pending);
  assert.equal((await store.get(item.id)).sequence.next_entry, 'B');
  await store.finishSequence(result.lease);
  assert.equal((await store.get(item.id)).sequence.next_entry, 'B');
}));

test('same sequential reference shares one choice across active fields; independent Wildcards advance separately', () => fixture(async (root, store) => {
  const first = await store.save(sequential), other = await store.save({key: 'top', entries: ['shirt', 'coat'], selection_mode: 'sequential'});
  const input = preset('__pose__, __pose__, __top__', {prompt_parts: {undesired: '__pose__', characters: [{prompt: '__pose__', undesired: '__pose__'}, {enabled: false, prompt: '__missing__'}]}});
  const p = await plan(store, input); assert.equal(p.choices.length, 2); assert.equal(p.resolved.prompt_parts.base, 'A, A, shirt');
  assert.equal(p.resolved.prompt_parts.characters[0].prompt, 'A'); await save(root, store, p);
  assert.equal((await store.get(first.id)).sequence.next_entry, 'B'); assert.equal((await store.get(other.id)).sequence.next_entry, 'coat');
}));

test('inactive negatives and unselected branches do not consume; final excluded references are omitted', () => fixture(async (root, store) => {
  const item = await store.save(sequential);
  const p = await plan(store, preset('||plain|__pose__||', {params: {effort: 'medium'}, prompt_parts: {undesired: '__pose__', characters: [{prompt: 'person', undesired: '__pose__'}, {enabled: false, prompt: '__pose__'}]}}));
  assert.deepEqual(p.choices, []); await save(root, store, p); assert.equal((await store.get(item.id)).sequence.next_entry, 'A');
  const choices = [], resolved = resolveGenerationPrompts(preset('😀 __pose__'), await store.all(), () => 0, {sequentialChoices: choices});
  const payload = buildModeGeneratePayload(resolved, {mode: 'text-to-image'});
  assert.deepEqual(usedSequentialChoices(choices, payload, [{start: 3, end: 4}]), []);
  assert.equal(usedSequentialChoices(choices, payload).length, 1);
}));

test('edits retain the planned item, deletion uses next surviving item, modes pause and resume', () => fixture(async (root, store) => {
  let item = await store.save(sequential); await save(root, store, await plan(store));
  item = await store.save({...item, entries: ['X', 'A', 'B', 'C']}); assert.equal(item.sequence.next_entry, 'B');
  item = await store.save({...item, entries: ['C', 'B', 'A', 'X']}); assert.equal(item.sequence.next_entry, 'B');
  item = await store.save({...item, selection_mode: 'random'}); assert.equal(item.sequence.next_entry, 'B');
  item = await store.save({...item, selection_mode: 'sequential'}); assert.equal(item.sequence.next_entry, 'B');
  item = await store.save({...item, entries: ['C', 'A', 'X']}); assert.equal(item.sequence.next_entry, 'A');
  await store.resetSequence(item.id); assert.equal((await store.get(item.id)).sequence.next_entry, 'C');
}));

test('legacy mode-less files stay byte-identical, random references remain independent, default is random', () => fixture(async (root, store) => {
  const item = await store.save({key: 'pose', entries: ['A', 'B', 'C']}); assert.equal(item.selection_mode, 'random');
  const file = path.join(root, 'data/wildcards', item.id, 'wildcard.json'); const raw = JSON.parse(await readFile(file, 'utf8')); delete raw.selection_mode; await writeFile(file, JSON.stringify(raw));
  const bytes = await readFile(file); let i = 0;
  const p = await plan(store, preset('__pose__, __pose__'), () => i++);
  assert.equal(p.resolved.prompt_parts.base, 'A, B'); assert.deepEqual(p.choices, []);
  assert.deepEqual(await readFile(file), bytes);
  await assert.rejects(readFile(path.join(root, 'data/wildcard-sequence/state.json')), {code: 'ENOENT'});
}));

test('stale preparations, overlapping sequential work, and active edits/reset are refused before sending', () => fixture(async (root, store) => {
  const item = await store.save(sequential), first = await plan(store), stale = await plan(store);
  const lease = await store.beginSequence(first.choices);
  await assert.rejects(store.beginSequence(stale.choices), /Wait for/);
  await assert.rejects(store.save({...item, entries: ['new']}), /Wait for/);
  await assert.rejects(store.resetSequence(item.id), /Wait for/);
  await store.abortSequence(lease); await save(root, store, first);
  await assert.rejects(store.beginSequence(stale.choices), /changed/);
}));

test('History preset reuse is already resolved and consumes no fresh position', () => fixture(async (root, store) => {
  const item = await store.save(sequential); const {saved} = await save(root, store, await plan(store));
  const record = JSON.parse(await readFile(path.join(root, saved.sidecar_path), 'utf8'));
  const reused = await plan(store, record.internal_preset); assert.deepEqual(reused.choices, []); await save(root, store, reused);
  assert.equal((await store.get(item.id)).sequence.next_entry, 'B');
}));

test('only actually transmitted Character negatives count when an empty Character is omitted', () => fixture(async (root, store) => {
  await store.save(sequential); const choices = [];
  const input = preset('plain', {prompt_parts: {characters: [{prompt: '', undesired: '__pose__'}, {prompt: 'person', undesired: 'plain'}]}});
  const resolved = resolveGenerationPrompts(input, await store.all(), () => 0, {mode: 'inpaint', sequentialChoices: choices});
  const payload = buildV5GeneratePayload(resolved, {policy: 'chaessi-inpaint-strategy'});
  assert.deepEqual(usedSequentialChoices(choices, payload, [], resolved), []);
  const second = [], used = resolveGenerationPrompts(preset('plain', {prompt_parts: {characters: [{prompt: '', undesired: 'plain'}, {prompt: 'person', undesired: '__pose__'}]}}), await store.all(), () => 0, {mode: 'inpaint', sequentialChoices: second});
  assert.equal(usedSequentialChoices(second, buildV5GeneratePayload(used, {policy: 'chaessi-inpaint-strategy'}), [], used).length, 1);
}));
