import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDefaultPreset } from '../src/adapters/novelai-v45-full.js';
import { planReferences, vibeRequest } from '../src/ui/reference-session.js';
import { installGenerationCost } from '../src/ui/generation-cost.js';

test('new Vibe capabilities cannot activate saved cards; V4.5 stays read-only and V5 Precise remains available', () => {
  const cards = [{ kind: 'vibe', enabled: true, strength: 0.7, informationExtracted: 0.7,
    encodings: [{ model: 'nai-diffusion-4-5-full', informationExtracted: 0.7, encoding: 'AQID' }] },
  { kind: 'precise', type: 'outfit', enabled: true, strength: 1 }];
  const before = structuredClone(cards);
  const context = { model: 'nai-diffusion-4-5-full', mode: 'text-to-image', effort: 'high',
    capabilities: { v45Vibe: true, v5HighPrecise: true } };
  const legacy = planReferences(cards, context);
  assert.equal(legacy.canGenerate, false);
  assert.equal(legacy.vibeAvailable, false);
  assert.deepEqual(legacy.vibes, []);
  assert.equal(legacy.fee, 0);
  assert.equal(legacy.held, 2);
  assert.throws(() => vibeRequest(cards.slice(0, 1), context.model, true), /unavailable/);
  assert.deepEqual(vibeRequest([], context.model, true), {});
  const v5 = planReferences(cards, { ...context, model: 'nai-diffusion-5-full' });
  assert.deepEqual(v5.precise.map(card => card.type), ['outfit']);
  assert.equal(v5.fee, 5);
  assert.deepEqual(cards, before);
});

test('new Vibe routes and legacy V4.5 generation reject before any upstream request', async t => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'chaessi-vibe-exclusion-'));
  // No network fallback: only the existing synthetic generation provider can be called.
  const preload = `import ${JSON.stringify(new URL('./mock-novelai.mjs', import.meta.url).href)};
    const mock=globalThis.fetch;globalThis.fetch=(url,options)=>{
      if(String(url)!=='https://image.novelai.net/ai/generate-image')throw Error('Unexpected external request');
      return mock(url,options);};`;
  const child = fork(new URL('../server.mjs', import.meta.url), {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    execArgv: ['--import', 'data:text/javascript,' + encodeURIComponent(preload)],
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PORT: '0',
      CHAESSI_PRIVATE_TEST_PROFILE: profile, CHAESSI_ELECTRON_SERVER: '1',
      CHAESSI_USER_DATA_DIR: profile, NAI_ACCESS_TOKEN: 'synthetic' },
  });
  const closed = once(child, 'exit');
  t.after(async () => { if (child.connected) child.disconnect(); await closed; await rm(profile, { recursive: true, force: true }); });
  const [ready] = await Promise.race([once(child, 'message', { signal: AbortSignal.timeout(20_000) }),
    closed.then(() => { throw Error('Isolated server failed to start'); })]);
  const base = `http://127.0.0.1:${ready.port}`;
  const health = await (await fetch(base + '/api/health')).json();
  assert.deepEqual(health.referenceCapabilities, { v5HighPrecise: true, v45Vibe: false });
  async function post(route, body, expected) {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result.error));
    return result;
  }
  const preset = createDefaultPreset({ params: { model: 'nai-diffusion-4-5-full', width: 512, height: 512, seed: 77 } });
  preset.prompt_parts.base = 'synthetic landscape';
  preset.prompt_parts.undesired = 'synthetic negative';
  const card = { model: preset.params.model, strength: 0.7, information_extracted: 0.7, encoding_base64: 'AQID' };
  assert.equal((await post('/api/novelai/vibe/encode', { model: preset.params.model }, 400)).error.type, 'vibe_transfer_unavailable');
  for (const route of ['/api/novelai/prepare', '/api/novelai/generate']) {
    for (const fields of [{ vibe_count: 1 }, { vibe_references: [card] }, { vibe_references: {} }]) {
      assert.equal((await post(route, { preset, ...fields }, 400)).error.type, 'vibe_transfer_unavailable');
    }
  }
  await assert.rejects(() => readFile(path.join(profile, 'captured-request.json')), { code: 'ENOENT' });
  for (const route of ['/api/novelai/prepare', '/api/novelai/generate']) {
    assert.equal((await post(route, { preset }, 400)).error.type, 'legacy_model_read_only');
  }
  await assert.rejects(() => readFile(path.join(profile, 'captured-request.json')), { code: 'ENOENT' });
});

test('legacy V4.5 has no new cost estimate or generation confirmation even with Opus', async t => {
  const ids = new Map(['generateStatus', 'generationSourceInfo', 'paramModel', 'paramWidth', 'paramHeight', 'paramSteps', 'paramSm', 'paramSmDyn'].map(id => [id, { before() {}, value: '', checked: false }]));
  Object.assign(ids.get('paramModel'), { value: 'nai-diffusion-4-5-full' });
  for (const [id, value] of [['paramWidth', '512'], ['paramHeight', '512'], ['paramSteps', '23']]) ids.get(id).value = value;
  const estimate = { setAttribute() {}, textContent: '' };
  const previousDocument = globalThis.document, previousObserver = globalThis.MutationObserver;
  globalThis.document = { createElement: () => estimate, getElementById: id => ids.get(id), addEventListener() {} };
  globalThis.MutationObserver = class { observe() {} };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousObserver === undefined) delete globalThis.MutationObserver; else globalThis.MutationObserver = previousObserver;
  });
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, '/api/novelai/account-usage');
    return Response.json({ ok: true, opus_available: true, opus_v45_eligible: true });
  });
  const preset = createDefaultPreset();
  const controller = installGenerationCost({ getPreset: () => preset, getMode: () => 'text-to-image',
    getReferencePlan: () => ({ canGenerate: false, vibes: [], held: 0, fee: 0 }) });
  assert.equal(estimate.textContent, 'Estimated cost unavailable.');
  await controller.refreshAccount(true);
  assert.equal(estimate.textContent, 'Estimated cost unavailable.');
  assert.equal(await controller.confirmSizeCost(), false);
});
