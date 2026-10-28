import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {once} from 'node:events';import net from 'node:net';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {createDefaultPreset} from '../src/state/preset-schema.js';

test('sequential HTTP prepare/cancel, failure, success/History, stale snapshot, exclusivity, restart and reuse', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chaessi-wildcard-sequence-http-'));
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening'); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`; let child;
  async function launch() {
    child = spawn(process.execPath, ['--import', './tests/mock-wildcard-sequential-provider.mjs', 'server.mjs'], {cwd: new URL('../', import.meta.url), windowsHide: true, stdio: 'ignore', env: {...process.env, PORT: String(port), CHAESSI_USER_DATA_DIR: root, NAI_ACCESS_TOKEN: 'wildcard-test-only'}});
    for (let n = 0; n < 150; n++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 40)); } throw Error('Wildcard test server did not start');
  }
  async function stop() { const exit = once(child, 'exit'); child.kill(); await exit; }
  async function request(route, body, expected = 200) {
    const response = await fetch(base + route, body === undefined ? undefined : {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
    const json = await response.json(); assert.equal(response.status, expected, JSON.stringify(json)); return json;
  }
  const preset = extra => createDefaultPreset({params: {model: 'nai-diffusion-5-full', width: 64, height: 64, seed: 12}, prompt_parts: {base: '__pose__, __pose__' + (extra || ''), undesired: '__pose__', characters: [{prompt: '__pose__', undesired: '__pose__'}]}});
  try {
    await launch();
    const item = (await request('/api/wildcards', {key: 'pose', entries: ['A', 'B', 'C'], selection_mode: 'sequential'})).wildcard;
    const current = async () => (await request('/api/wildcards/' + item.id)).wildcard;
    const prepared = await request('/api/novelai/prepare', {preset: preset()});
    assert.equal(prepared.preset.prompt_parts.base, 'A, A');
    await request('/api/novelai/prepare', {preset: preset()}); assert.equal((await current()).sequence.next_entry, 'A');
    await request('/api/novelai/generate', {preset: preset(', FAIL_WILDCARD')}, 503); assert.equal((await current()).sequence.next_entry, 'A');
    const first = await request('/api/novelai/generate', {prepared_id: prepared.prepared_id});
    const history = (await request('/api/generations/' + first.generation.id)).generation;
    assert.equal(history.internal_preset.prompt_parts.base, 'A, A'); assert.equal(history.wildcard_selection.selections.length, 1);
    assert.equal(history.wildcard_selection.selections[0].entry, 'A');
    assert.equal((await current()).sequence.next_entry, 'B');
    await request('/api/novelai/generate', {prepared_id: prepared.prepared_id}, 409); assert.equal((await current()).sequence.next_entry, 'B');
    const stale = await request('/api/novelai/prepare', {preset: preset()});
    await request('/api/novelai/generate', {preset: preset()}); assert.equal((await current()).sequence.next_entry, 'C');
    await request('/api/novelai/generate', {prepared_id: stale.prepared_id}, 409); assert.equal((await current()).sequence.next_entry, 'C');
    await stop(); await launch(); assert.equal((await current()).sequence.next_entry, 'C');
    await request('/api/novelai/generate', {preset: history.internal_preset}); assert.equal((await current()).sequence.next_entry, 'C');
    await request('/api/wildcards/' + item.id + '/reset', {}); assert.equal((await current()).sequence.next_entry, 'A');
    const waiting = request('/api/novelai/generate', {preset: preset(', WAIT_WILDCARD')});
    for (let n = 0; n < 150; n++) { if (await readFile(path.join(root, 'wildcard-request-started')).then(() => true).catch(() => false)) break; await new Promise(r => setTimeout(r, 20)); }
    await request('/api/novelai/generate', {preset: preset()}, 409);
    await request('/api/wildcards/' + item.id + '/reset', {}, 409);
    await request('/api/wildcards', {...await current(), entries: ['edited']}, 409);
    await writeFile(path.join(root, 'wildcard-request-release'), '1'); await waiting; assert.equal((await current()).sequence.next_entry, 'B');
  } finally { if (child?.exitCode === null) await stop(); await rm(root, {recursive: true, force: true}); }
});
