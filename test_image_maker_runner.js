import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createDefaultPreset } from "./src/state/preset-schema.js";
import { buildV5GeneratePayload } from "./src/adapters/novelai-v5-full.js";
import { runImageMakerRequest } from "./src/services/image-maker-runner.js";

const ids = { base: "preset_phase5", character: "character_phase5", outfit: "character_phase5_outfit" };

test("Test A — clean single actor reaches ready", async () => {
  const fixture = await makeFixture();
  const output = await runImageMakerRequest({ ...fixture, dryRun: true, runId: "test_a_clean", fetchFn: forbiddenFetch });
  assert.equal(output.status, "ready");
  assert.equal(output.guardReport.issues.length, 0);
  assert.equal(output.prepared.subjectCount, "1girl");
});

test("Test B — safe implicit-actor rewrite reaches ready", async () => {
  const fixture = await makeFixture({ supplement: "She is welcoming an arriving guest at reception." });
  const output = await runImageMakerRequest({ ...fixture, dryRun: true, runId: "test_b_rewrite", fetchFn: forbiddenFetch });
  assert.equal(output.status, "ready");
  assert.equal(output.guardReport.issues[0].resolution, "safe-rewrite");
  assert.doesNotMatch(output.prepared.resolvedPreset.prompt_parts.base, /arriving guest/i);
});

test("Test C — unresolved implicit actor needs review and does not call Local API", async () => {
  const fixture = await makeFixture({ scenePrompt: "standing beside someone at the desk" });
  let calls = 0;
  const output = await runImageMakerRequest({
    ...fixture,
    dryRun: false,
    runId: "test_c_review",
    fetchFn: async () => { calls += 1; throw new Error("must not be called"); },
  });
  assert.equal(output.status, "needs-review");
  assert.equal(output.manifest.requiresSemanticReview, true);
  assert.equal(output.generationResult.localApiCalls, 0);
  assert.equal(calls, 0);
});

test("Test D — a completed run cannot generate twice", async () => {
  const fixture = await makeFixture();
  const api = fakeSuccessfulLocalApi(fixture.dataRoot, fixture.basePreset);
  const first = await runImageMakerRequest({ ...fixture, runId: "test_d_duplicate", fetchFn: api.fetch });
  assert.equal(first.status, "completed");
  assert.equal(api.generationCalls(), 1);
  await assert.rejects(
    runImageMakerRequest({ ...fixture, runId: "test_d_duplicate", fetchFn: api.fetch }),
    (error) => error.code === "duplicate-run",
  );
  assert.equal(api.generationCalls(), 1);
});

test("Test E — dry-run writes payload and makes zero Local API calls", async () => {
  const fixture = await makeFixture({ position: { x: 0.3, y: 0.55 } });
  let calls = 0;
  const output = await runImageMakerRequest({
    ...fixture,
    dryRun: true,
    runId: "test_e_dry",
    fetchFn: async () => { calls += 1; throw new Error("must not be called"); },
  });
  assert.equal(calls, 0);
  const payload = JSON.parse(await readFile(path.join(output.runDir, "payload.json"), "utf8"));
  const generation = JSON.parse(await readFile(path.join(output.runDir, "generation-result.json"), "utf8"));
  assert.equal(payload.model, "nai-diffusion-5-full");
  assert.equal(payload.parameters.use_coords, true);
  assert.equal(generation.localApiCalls, 0);
});

test("camera-only Director Slot actor cues require review before generation", async () => {
  const fixture = await makeFixture();
  fixture.directorPlan.shots[0].direction.depth = "bellhop in the foreground and reception desk behind her";
  let calls = 0;
  const output = await runImageMakerRequest({
    ...fixture,
    runId: "test_director_actor_cue",
    fetchFn: async () => { calls += 1; throw new Error("must not be called"); },
  });
  assert.equal(output.status, "needs-review");
  assert.equal(output.guardReport.issues[0].type, "director-slot-actor-cue");
  assert.equal(calls, 0);
});

async function makeFixture({ supplement = "The adult woman stands alone at the reception desk.", scenePrompt = "standing, holding book, looking at viewer, calm smile", position } = {}) {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "chaessi-phase5-"));
  const basePreset = createDefaultPreset({
    metadata: { id: ids.base, name: "Phase 5 Fixture" },
    prompt_parts: { base: "fixture style, 1girl", undesired: "low quality", characters: [] },
    params: { model: "nai-diffusion-5-full", seed: 25050901, n_samples: 1 },
  });
  await writeJson(path.join(dataRoot, "data", "presets", ids.base, "preset.json"), basePreset);
  await writeJson(path.join(dataRoot, "data", "character-presets", ids.character, "character-preset.json"), component(ids.character, "여성 캐릭터", "girl, adult woman, brown hair"));
  await writeJson(path.join(dataRoot, "data", "character-presets", ids.outfit, "character-preset.json"), component(ids.outfit, "여성 의상", "maroon track jacket, track pants"));
  const request = {
    schema: "chaessi-image-request/v1",
    request: "호텔 로비 프런트에서 혼자 서 있는 성인 여성 직원",
    count: 1,
    presets: {
      basePresetId: ids.base, characterPresetId: ids.character, outfitPresetId: ids.outfit,
      stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null,
    },
    generation: { model: "nai-diffusion-5-full", seed: 25050901 },
  };
  const directorPlan = {
    schema: "chaessi-scene-plan/v2", request: request.request, mode: "single", count: 1,
    presetSelections: {
      basePresetId: ids.base, characterPresetIds: [ids.character], outfitPresetIds: [ids.outfit],
      stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null,
    },
    continuity: { characterIdentity: "locked", outfit: "locked", location: "locked", props: "tracked", screenDirection: "free" },
    shots: [{
      id: "shot_001", index: 1, intent: "single actor orchestration fixture", rhythmRole: "hero",
      direction: {
        shotSize: "medium", cameraHeight: "eye level", cameraAngle: "three-quarter angle", viewpoint: "from lobby entrance",
        bodyOrientation: "front three-quarter", pose: "upright relaxed stance", action: "holding a closed ledger",
        gaze: "looking at viewer", expression: "calm professional smile", subjectPlacement: "left third",
        depth: "subject foreground and desk background", lighting: "soft daylight", visibilityRequirements: ["face and uniform visible"],
      },
      continuity: { location: "hotel lobby", outfitState: "fully worn", props: [{ id: "ledger", state: "closed and held" }], screenDirection: "slightly right", carriesFrom: null },
      generation: {
        mainPrompt: "1girl, solo, modern hotel lobby, reception desk, soft daylight",
        supplement,
        characters: [{
          characterPresetId: ids.character, visibleFeaturesPrompt: "", scenePrompt, undesiredPrompt: "",
          ...(position ? { position } : {}),
        }],
        undesiredPrompt: "2girls, 1boy, multiple people, background characters", seed: request.generation.seed,
      },
    }],
  };
  return { request, directorPlan, dataRoot, basePreset };
}

function fakeSuccessfulLocalApi(dataRoot, basePreset) {
  let generateCount = 0;
  return {
    generationCalls: () => generateCount,
    async fetch(url, init) {
      const pathname = new URL(url).pathname;
      if (pathname === "/api/health") return jsonResponse({ ok: true, app: "Chaessi Preset", version: "test" });
      if (pathname === "/api/settings/token-status") return jsonResponse({ ok: true, configured: true, source: "fixture" });
      if (pathname.startsWith("/api/presets/")) return jsonResponse({ ok: true, preset: basePreset });
      if (pathname === "/api/novelai/generate") {
        generateCount += 1;
        const body = JSON.parse(init.body);
        const payload = buildV5GeneratePayload(body.preset);
        const id = "fixture_generation";
        const relativeFolder = "data/generations/fixture";
        await mkdir(path.join(dataRoot, relativeFolder), { recursive: true });
        await writeFile(path.join(dataRoot, relativeFolder, `${id}.png`), Buffer.from("fixture-png"));
        await writeJson(path.join(dataRoot, relativeFolder, `${id}.json`), { generation_id: id });
        await writeJson(path.join(dataRoot, relativeFolder, `${id}.payload.json`), payload);
        return jsonResponse({
          ok: true,
          generation: { id, image_path: `${relativeFolder}/${id}.png`, sidecar_path: `${relativeFolder}/${id}.json`, payload_path: `${relativeFolder}/${id}.payload.json` },
          summary: { model: payload.model, seed: payload.parameters.seed, width: payload.parameters.width, height: payload.parameters.height },
        });
      }
      return { ok: false, status: 404, json: async () => ({ ok: false }) };
    },
  };
}
function jsonResponse(value) { return { ok: true, status: 200, json: async () => value }; }
async function forbiddenFetch() { throw new Error("dry-run must not call fetch"); }
function component(id, category, prompt) {
  return { schema: "chaessi-character-preset/v1", id, name: id, category, subCategory: "", enabled: true, prompt, undesired: "", centers: [{ x: 0.5, y: 0.5 }] };
}
async function writeJson(file, value) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); }
