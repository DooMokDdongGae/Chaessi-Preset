import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createReferenceLibrary } from '../src/services/reference-library.js';
import { deleteReferences, listReferences, readReference, renameReference, saveReference } from '../src/ui/reference-library-client.js';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a52AAAAAASUVORK5CYII=', 'base64');
const enc1 = Buffer.from([1, 2, 3]);
const enc2 = Buffer.from([252, 249, 9, 128, 1]);
function precise(slot = 0) {
  return {
    kind: 'precise', type: 'character&style', strength: 2.25, fidelity: 0.55, preferSameOutfit: true, enabled: false,
    original: { slot, mimeType: 'image/png', name: '합성.png' },
  };
}
async function fixture(t) {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'chaessi-ref-test-'));
  const connections = [];
  function connect() {
    const store = createReferenceLibrary({ rootDir });
    connections.push(store);
    return store;
  }
  const library = connect();
  t.after(async () => {
    for (const store of connections) store.close();
    await rm(rootDir, { recursive: true, force: true });
  });
  return { library, rootDir, connect };
}
function saveSingle(library, opts = {}) {
  const upload = library.begin();
  library.addPart(upload, 0, pixel);
  return library.save({ upload, name: 'one', scope: 'single', snapshot: { cards: [precise()] }, ...opts });
}

test('listing is read-only and a saved composition restores source bytes, ordered options and source-less Vibe variants after restart', async t => {
  const { library, rootDir } = await fixture(t);
  assert.deepEqual(library.list(), []);
  assert.deepEqual(await readdir(rootDir), []);
  const upload = library.begin();
  for (const [i, bytes] of [pixel, enc1, enc2, pixel].entries()) library.addPart(upload, i, bytes);
  const card = {
    kind: 'vibe', type: 'vibe', enabled: true, strength: -2, informationExtracted: 0.4,
    fileName: 'Vibe study', original: null, thumbnail: { slot: 3, mimeType: 'image/png', name: 'preview.png' },
    encodings: [
      { slot: 1, model: 'nai-diffusion-4-5-full', informationExtracted: 0.4 },
      { slot: 2, model: 'nai-diffusion-4-5-full', informationExtracted: 0.8 },
    ],
  };
  const saved = library.save({ upload, name: '비교', scope: 'set', snapshot: { normalizeStrength: true, cards: [card, precise()] } });
  assert.equal(saved.count, 2);
  assert.equal(saved.scope, 'set');
  assert.equal('snapshot' in library.list()[0], false);
  library.close();
  assert.deepEqual(library.get(saved.id).snapshot, {
    normalizeStrength: true, cards: [card, { ...precise(), fileName: '합성.png', thumbnail: null }],
  });
  for (const [index, bytes] of [pixel, enc1, enc2, pixel].entries()) {
    assert.deepEqual(Buffer.from(library.asset(saved.id, 1, index)), bytes);
  }
});

test('independent copies, rename and updates are revision-checked across store connections; batch deletion rolls back as a unit', async t => {
  const { library, rootDir, connect } = await fixture(t);
  const hist = path.join(rootDir, 'data', 'generations', 'fixture');
  await mkdir(hist, { recursive: true });
  await writeFile(path.join(hist, 'image.png'), pixel);
  const one = saveSingle(library);
  const two = saveSingle(library, { name: 'copy' });
  const otherConnection = connect();
  const renamed = otherConnection.rename(one.id, one.version, 'renamed');
  assert.equal(renamed.version, 2);
  assert.throws(() => library.remove([two, one]), e => e.statusCode === 409);
  assert.equal(library.list().length, 2);
  assert.throws(() => library.asset(one.id, one.version, 0), e => e.statusCode === 409);
  assert.deepEqual(Buffer.from(library.asset(one.id, renamed.version, 0)), pixel);
  assert.throws(() => saveSingle(library, { id: one.id, version: one.version }), e => e.statusCode === 409);
  assert.equal(otherConnection.get(one.id).name, 'renamed');
  const updated = saveSingle(library, { id: one.id, version: renamed.version, name: 'new settings' });
  assert.equal(updated.version, 3);
  assert.equal(library.remove([updated]), 1);
  assert.deepEqual(Buffer.from(library.asset(two.id, two.version, 0)), pixel);
  assert.deepEqual(await readFile(path.join(hist, 'image.png')), pixel);
  await rm(hist, { recursive: true });
  assert.deepEqual(Buffer.from(library.asset(two.id, two.version, 0)), pixel);
  const third = saveSingle(library);
  assert.equal(library.remove([two, third]), 2);
  assert.deepEqual(library.list(), []);
});

test('partial or invalid save, aborted upload and duplicate cache keys cannot change a prior entry', async t => {
  const { library } = await fixture(t);
  const first = saveSingle(library);
  const upload = library.begin();
  library.addPart(upload, 0, Buffer.from('not an image'));
  const operation = { upload, name: 'replacement', scope: 'single', id: first.id, version: first.version, snapshot: { cards: [precise()] } };
  assert.throws(() => library.save(operation), /PNG, JPEG or WebP/);
  assert.equal(library.get(first.id).version, 1);
  library.abort(upload);
  assert.throws(() => library.save(operation), /expired/);
  const second = library.begin();
  library.addPart(second, 0, enc1);
  library.addPart(second, 1, enc2);
  const vibe = { kind: 'vibe', type: 'vibe', enabled: true, strength: 0.4, informationExtracted: 1,
    encodings: [0, 1].map(slot => ({ slot, model: 'nai-diffusion-4-5-full', informationExtracted: 1 })) };
  assert.throws(() => library.save({ upload: second, name: 'variants', scope: 'single', snapshot: { cards: [vibe] } }), /Duplicate Vibe/);
  assert.equal(library.list().length, 1);
  library.abort(second);
});

test('deleting a large saved encoding reclaims its database pages on disk', async t => {
  const { rootDir, library } = await fixture(t);
  const upload = library.begin();
  library.addPart(upload, 0, Buffer.alloc(1024 * 1024, 42));
  const entry = library.save({ upload, scope: 'single', name: 'Cached Vibe', snapshot: { cards: [{
    kind: 'vibe', type: 'vibe', strength: 1, informationExtracted: 1, enabled: true,
    encodings: [{ model: 'nai-diffusion-4-5-full', informationExtracted: 1, slot: 0 }],
  }] } });
  const file = path.join(rootDir, 'data', 'reference-library', 'library.sqlite');
  const before = (await stat(file)).size;
  library.remove([entry]);
  assert.ok(before - (await stat(file)).size >= 1024 * 1024);
});

test('library renderer API saves and reloads original File and cached bytes over isolated loopback routes', async t => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'chaessi-ref-http-'));
  const server = fork(new URL('../server.mjs', import.meta.url), [], {
    execArgv: ['--import', 'data:text/javascript,globalThis.fetch=()=>{throw new Error("External request in library test")}'],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true,
    env: { SystemRoot: process.env.SystemRoot || '', PORT: '0', CHAESSI_ELECTRON_SERVER: '1',
      CHAESSI_PRIVATE_TEST_PROFILE: rootDir, CHAESSI_USER_DATA_DIR: rootDir },
  });
  const stopped = once(server, 'exit');
  t.after(async () => {
    if (server.connected) server.disconnect();
    await stopped;
    await rm(rootDir, { recursive: true, force: true });
  });
  const [ready] = await Promise.race([
    once(server, 'message', { signal: AbortSignal.timeout(15_000) }),
    stopped.then(() => { throw new Error('Fixture server closed before ready.'); }),
  ]);
  assert.equal(ready.channel, 'server-ready');
  const origin = `http://127.0.0.1:${ready.port}`;
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (url, init) => realFetch(origin + url, init));
  assert.equal((await realFetch(origin + '/api/reference-library')).status, 403);
  assert.equal((await realFetch(origin + '/api/reference-library', { headers: {
    'X-Chaessi-Reference-Library': '1', Origin: 'https://example.invalid',
  } })).status, 403);
  const original = new File([pixel], 'pixel.png', { type: 'image/png' });
  const vibe = { kind: 'vibe', type: 'vibe', strength: -1.25, enabled: true, informationExtracted: 0.6, original,
    encodings: [{ model: 'nai-diffusion-4-5-full', informationExtracted: 0.6, encoding: enc1.toString('base64') }] };
  const first = await saveReference({ name: 'saved', scope: 'set', snapshot: { cards: [vibe, { ...precise(), original }], normalizeStrength: false } });
  const snapshot = await readReference(first);
  assert.equal(snapshot.normalizeStrength, false);
  assert.deepEqual(snapshot.cards.map(c => c.kind), ['vibe', 'precise']);
  assert.deepEqual(snapshot.cards[0].encodings, vibe.encodings);
  assert.deepEqual(Buffer.from(await snapshot.cards[1].original.arrayBuffer()), pixel);
  assert.deepEqual([snapshot.cards[1].original.name, snapshot.cards[1].original.type], ['pixel.png', 'image/png']);
  const renamed = await renameReference(first, 'changed');
  await assert.rejects(() => readReference(first), /changed/);
  await deleteReferences([renamed]);
  assert.deepEqual(await listReferences(), []);
});
