import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createDefaultPreset} from '../src/state/preset-schema.js';
import {switchPresetEffort} from '../src/state/effort-state.js';
import {switchPresetModel} from '../src/state/model-state.js';
import {estimateGeneration} from '../src/image-tools/contracts.js';

const sizes = [
  {width:1344, height:768, eligible:true, high:26, medium:17},
  {width:768, height:1344, eligible:true, high:26, medium:17},
  {width:1664, height:960, eligible:false, high:39, medium:26},
  {width:960, height:1664, eligible:false, high:39, medium:26},
];

function dimensions({width, height}) {
  return [width, height];
}

test('Wide and tall V5 requests retain exact dimensions through save, import, mock generation and History', async t => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'chaessi-size-'));
  const trace = path.join(profile, 'mock-requests.jsonl');
  const server = fork(new URL('../server.mjs', import.meta.url), [], {
    execArgv:['--import', new URL('./mock-pixel-resolution-provider.mjs', import.meta.url).href],
    silent:true, windowsHide:true,
    env:{
      SystemRoot:process.env.SystemRoot || '', PORT:'0',
      CHAESSI_USER_DATA_DIR:profile, CHAESSI_PRIVATE_TEST_PROFILE:profile, CHAESSI_ELECTRON_SERVER:'1',
      NAI_ACCESS_TOKEN:'synthetic-local-test', CHAESSI_PROVIDER_TRACE:trace,
    },
  });
  t.after(async () => {
    if (server.exitCode === null && !server.signalCode) {
      const stopped = once(server, 'exit');
      server.kill();
      await stopped;
    }
    await rm(profile, {recursive:true, force:true});
  });
  const [ready] = await once(server, 'message', {signal:AbortSignal.timeout(15_000)});
  assert.equal(ready.channel, 'server-ready');
  const base = 'http://127.0.0.1:' + ready.port;
  async function api(route, body) {
    const options = body ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)} : {};
    const response = await fetch(base + route, options);
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    return result;
  }
  const account = await api('/api/novelai/cost-account');
  assert.equal(account.opus_available, true);
  assert.deepEqual((await api('/api/generations')).items, []);
  for (const size of sizes) {
    const expected = dimensions(size);
    const legacy = createDefaultPreset({
      params:{model:'nai-diffusion-4-5-full', width:size.width, height:size.height, steps:23, seed:123},
      prompt_parts:{base:'synthetic square'},
    });
    const saved = (await api('/api/presets', {preset:legacy})).preset;
    const reopened = (await api('/api/presets/' + saved.metadata.id)).preset;
    assert.deepEqual(dimensions(reopened.params), expected);
    assert.equal(reopened.params.model, 'nai-diffusion-4-5-full');
    const v5 = switchPresetModel(reopened, 'nai-diffusion-5-full');
    for (const effort of ['high', 'medium']) {
      await t.test(expected.join(' × ') + ' · ' + effort, async () => {
        const preset = switchPresetEffort(v5, effort);
        const settings = {preset, mode:'text-to-image'};
        const {payload} = await api('/api/payload/preview', settings);
        const importResult = (await api('/api/import/raw-json', {json:payload})).import_result;
        assert.deepEqual(dimensions(importResult.parsed.params), expected);
        assert.equal(importResult.parsed.params.effort, effort);
        assert.deepEqual(dimensions(payload.parameters), expected);
        assert.equal(payload.parameters.steps, effort === 'high' ? 23 : 14);
        const cost = estimateGeneration(payload, {opusAvailable:account.opus_available});
        assert.equal(cost.anlas, size.eligible ? 0 : size[effort]);
        assert.equal(estimateGeneration(payload, {opusAvailable:false}).anlas, size[effort]);
        const prepared = await api('/api/novelai/prepare', settings);
        assert.deepEqual(dimensions(prepared.preset.params), expected);
        assert.equal(prepared.camera_input, null);
        const result = await api('/api/novelai/generate', {prepared_id:prepared.prepared_id, mode:'text-to-image'});
        const captured = JSON.parse(await readFile(path.join(profile, 'captured-request.json'), 'utf8'));
        assert.equal(captured.model, effort === 'high' ? 'nai-diffusion-5-full' : 'nai-diffusion-5-full-medium');
        const {generation:history} = await api('/api/generations/' + result.generation.id);
        for (const params of [captured.parameters, result.summary, history.generation,
          history.raw_payload.parameters, history.internal_preset.params, history.output.actual_generation_params]) {
          assert.deepEqual(dimensions(params), expected);
        }
        assert.equal(history.generation.effort, effort);
        const image = await readFile(path.join(profile, result.generation.image_path));
        assert.equal(image.toString('ascii', 12, 16), 'IHDR');
        assert.deepEqual([image.readUInt32BE(16),image.readUInt32BE(20)], expected);
      });
    }
  }
  assert.equal((await api('/api/generations')).items.length, 8);
  const requests = (await readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const generationRequests = requests.filter(request => request.dimensions);
  assert.deepEqual(generationRequests.map(request => dimensions(request.dimensions)),
    sizes.flatMap(size => [dimensions(size), dimensions(size)]));
  assert.equal(requests.length, 9); // Eight mock generations and one mock account lookup.
});
