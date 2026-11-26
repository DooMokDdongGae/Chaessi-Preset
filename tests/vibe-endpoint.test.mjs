import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { encodeRgbPng } from "../src/services/generation-image-utils.js";
import { parseNovelAiPngMetadata } from "../src/importers/nai-metadata.js";
import { buildGeneratePayload, createDefaultPreset } from "../src/adapters/novelai-v45-full.js";
import { createGenerationStore } from '../src/services/generation-store.js';
import { appendPngText } from '../src/services/generation-png.js';
import { NOVELAI_V45_FULL_MODEL as model } from "../src/state/model-profiles.js";

// New Vibe generation is excluded; preserve synthetic legacy History reading.
test("isolated V4.5 stays read-only while existing synthetic History and metadata remain readable", async t => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "chaessi-vibe-endpoint-"));
  const preset = createDefaultPreset({ params: { model, width: 512, height: 512, seed: 77 } });
  preset.prompt_parts.base = "fixture landscape";
  preset.prompt_parts.undesired = "fixture negative";
  const payload = buildGeneratePayload(preset);
  const output = appendPngText(encodeRgbPng(Buffer.alloc(3), 1, 1), 'Generation Data', JSON.stringify(payload));
  // Seed only synthetic local History; this is not a generation request.
  const saved = await createGenerationStore({ rootDir: profile }).saveGeneration({ preset, payload, imageBytes: output,
    responseInfo: { created_at: '2026-11-25T00:00:00Z', generation_id: 'synthetic-legacy-history' } });
  const before = await readFile(path.join(profile, saved.sidecar_path));
  const child = fork(new URL("../server.mjs", import.meta.url), {
    stdio: ["ignore", "ignore", "ignore", "ipc"], execArgv: ["--import", 'data:text/javascript,' + encodeURIComponent(
      `import ${JSON.stringify(new URL('./mock-novelai.mjs', import.meta.url).href)};
       const mock=globalThis.fetch;globalThis.fetch=(url,options)=>{if(String(url)!=='https://image.novelai.net/ai/generate-image')throw Error('Unexpected external request');return mock(url,options);};`)],
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PORT: "0",
      CHAESSI_PRIVATE_TEST_PROFILE: profile, CHAESSI_ELECTRON_SERVER: "1", CHAESSI_USER_DATA_DIR: profile, NAI_ACCESS_TOKEN: "synthetic" },
  });
  const closed = once(child, "exit");
  t.after(async () => {
    if (child.connected) child.disconnect();
    await closed;
    await rm(profile, { recursive: true, force: true });
  });
  const [start] = await Promise.race([once(child, "message", { signal: AbortSignal.timeout(20_000) }),
    closed.then(() => { throw Error("Test server did not start."); })]);
  assert.equal(start.channel, "server-ready");
  const base = `http://127.0.0.1:${start.port}`;
  async function post(route, body, status = 200, extraHeaders = {}) {
    const response = await fetch(base + route, { method: "POST", headers: { "Content-Type": "application/json", ...extraHeaders }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.status, status, result.error?.message);
    return result;
  }
  const input = { model, information_extracted: 0.6, image_base64: encodeRgbPng(Buffer.alloc(3), 1, 1).toString("base64") };
  await post("/api/novelai/vibe/encode", input, 403, { Origin: "https://different.example" });
  const excluded = await post("/api/novelai/vibe/encode", input, 400);
  assert.equal(excluded.error.type, 'vibe_transfer_unavailable');
  const card = { model, strength: -0.4, encoding_base64: 'AQID', information_extracted: 0.6 };
  const local = { preset, mode: "text-to-image", vibe_references: [card, { ...card, strength: 1.6 }] };
  await post("/api/novelai/prepare", { preset, vibe_count: 2 }, 400);
  await post("/api/novelai/generate", local, 400);
  await post("/api/novelai/generate", { ...local, precise_references: [{}] }, 400);
  await post("/api/novelai/generate", { ...local, mode: "inpaint" }, 400);
  for (const route of ['/api/novelai/prepare', '/api/novelai/generate']) {
    assert.equal((await post(route, { preset }, 400)).error.type, 'legacy_model_read_only');
  }
  await assert.rejects(() => readFile(path.join(profile, 'captured-request.json')), { code: 'ENOENT' });
  const listing = await (await fetch(base + '/api/generations')).json();
  assert.equal(listing.items.length, 1);
  const result = await (await fetch(base + '/api/generations/' + saved.id)).json();
  assert.equal(result.generation.internal_preset.params.model, model);
  assert.equal(result.generation.internal_preset.prompt_parts.base, 'fixture landscape');
  assert.deepEqual(await readFile(path.join(profile, saved.sidecar_path)), before);
  assert.equal(parseNovelAiPngMetadata(output).parsed.base_prompt, "fixture landscape");
  for (const data of [output.toString("latin1"), JSON.stringify(result)]) {
    assert.ok(!data.includes(card.encoding_base64));
    assert.ok(!data.includes("synthetic-vendor-echo-marker"));
  }
});
