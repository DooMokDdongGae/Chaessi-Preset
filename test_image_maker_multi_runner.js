import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createDefaultPreset } from "./src/state/preset-schema.js";
import { buildV5GeneratePayload } from "./src/adapters/novelai-v5-full.js";
import { runMultiImageMakerRequest } from "./src/services/image-maker-multi-runner.js";
import { classifyImageMakerRenderReview } from "./src/services/image-maker-render-review.js";

const ids = { base: "preset_multi_v5", character: "character_multi_actor", outfit: "character_multi_outfit" };

test("A — editorial request prepares exactly three distinct shots", async () => {
  const fixture = await makeFixture({ count: 3, mode: "editorial" });
  const output = await runMultiImageMakerRequest({ ...fixture, dryRun: true, runId: "multi_editorial_3", fetchFn: forbiddenFetch });
  assert.equal(output.status, "ready");
  assert.equal(output.manifest.requestedCount, 3);
  assert.equal(output.manifest.preparedCount, 3);
  assert.equal(output.manifest.preflight.shots.every((shot) => shot.status === "ready"), true);
});

test("B — sequence request preserves four-step continuity and deterministic seeds", async () => {
  const fixture = await makeFixture({ count: 4, mode: "sequence" });
  const output = await runMultiImageMakerRequest({ ...fixture, dryRun: true, runId: "multi_sequence_4", fetchFn: forbiddenFetch });
  assert.equal(output.status, "ready");
  assert.deepEqual(output.manifest.seeds.map((item) => item.seed), [6000, 6001, 6002, 6003]);
  const stored = JSON.parse(await readFile(path.join(output.runDir, "director-plan.json"), "utf8"));
  assert.deepEqual(stored.shots.slice(1).map((shot) => shot.continuity.carriesFrom), ["shot_001", "shot_002", "shot_003"]);
  assert.equal(new Set(stored.shots.map((shot) => shot.direction.action)).size, 4);
});

test("C — user-selected count seven is preserved without a project maximum", async () => {
  const fixture = await makeFixture({ count: 7, mode: "editorial" });
  const output = await runMultiImageMakerRequest({ ...fixture, dryRun: true, runId: "multi_count_7", fetchFn: forbiddenFetch });
  assert.equal(output.manifest.requestedCount, 7);
  assert.equal(output.manifest.preparedCount, 7);
  assert.equal(output.manifest.preflight.shots.length, 7);
});

test("D — exact directing duplicate is blocked before shot preparation", async () => {
  const fixture = await makeFixture({ count: 3, mode: "editorial", duplicateAt: 1 });
  let calls = 0;
  const output = await runMultiImageMakerRequest({ ...fixture, runId: "multi_duplicate", fetchFn: async () => { calls += 1; throw new Error(); } });
  assert.equal(output.status, "needs-review");
  assert.match(output.manifest.preflight.planAudit.errors.join(" "), /repeats/);
  assert.equal(calls, 0);
});

test("E — one semantic-review shot blocks every generation", async () => {
  const fixture = await makeFixture({ count: 5, mode: "editorial", invalidAt: 3 });
  let calls = 0;
  const output = await runMultiImageMakerRequest({ ...fixture, runId: "multi_invalid_one", fetchFn: async () => { calls += 1; throw new Error(); } });
  assert.equal(output.status, "needs-review");
  assert.equal(output.manifest.preparedCount, 4);
  assert.equal(output.manifest.preflight.shots[3].status, "needs-review");
  assert.equal(calls, 0);
});

test("F — shot-specific positions map to same Anchor and Modifier coordinates", async () => {
  const fixture = await makeFixture({ count: 3, mode: "editorial", positions: [0.2, 0.5, 0.8] });
  const output = await runMultiImageMakerRequest({ ...fixture, dryRun: true, runId: "multi_positions", fetchFn: forbiddenFetch });
  for (let index = 0; index < 3; index += 1) {
    const shotId = `shot_${String(index + 1).padStart(3, "0")}`;
    const payload = JSON.parse(await readFile(path.join(output.runDir, "shots", shotId, "preflight", "payload.json"), "utf8"));
    assert.equal(payload.parameters.use_coords, true);
    assert.equal(payload.parameters.characterPrompts[1].center.x, fixture.positions[index]);
    assert.equal(payload.parameters.characterPrompts[2].center.x, fixture.positions[index]);
  }
});

test("sequential generation stops after a failure and records partial-failure", async () => {
  const fixture = await makeFixture({ count: 3, mode: "editorial" });
  const api = fakeLocalApi(fixture.dataRoot, fixture.basePreset, { failGenerationAt: 2 });
  const output = await runMultiImageMakerRequest({ ...fixture, runId: "multi_partial", fetchFn: api.fetch });
  assert.equal(output.status, "partial-failure");
  assert.equal(output.manifest.completedCount, 1);
  assert.equal(output.manifest.failedShotId, "shot_002");
  assert.equal(api.generationCalls(), 2);
  assert.equal(output.manifest.shots[0].status, "completed");
  assert.equal(output.manifest.shots[1].status, "failed");
  assert.equal(output.manifest.shots[2].status, "ready");
});

test("renderer-added person is an observation rather than structural failure", () => {
  const artifact = classifyImageMakerRenderReview({ renderObservation: { extraPerson: true } });
  assert.equal(artifact.status, "passed");
  assert.equal(artifact.classification, "renderer-artifact");
  const structural = classifyImageMakerRenderReview({ structuralIssues: ["compiled actor count mismatch"], renderObservation: { extraPerson: true } });
  assert.equal(structural.status, "failed");
  assert.equal(structural.classification, "structural-failure");
});

async function makeFixture({ count, mode, duplicateAt = -1, invalidAt = -1, positions } = {}) {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "chaessi-multi-"));
  const basePreset = createDefaultPreset({
    metadata: { id: ids.base, name: "Multi Fixture" },
    prompt_parts: { base: "fixture style, 1girl", undesired: "low quality", characters: [] },
    params: { model: "nai-diffusion-5-full", seed: 1, n_samples: 1 },
  });
  await writeJson(path.join(dataRoot, "data", "presets", ids.base, "preset.json"), basePreset);
  await writeJson(path.join(dataRoot, "data", "character-presets", ids.character, "character-preset.json"), component(ids.character, "여성 캐릭터", "girl, adult woman, dark hair"));
  await writeJson(path.join(dataRoot, "data", "character-presets", ids.outfit, "character-preset.json"), component(ids.outfit, "여성 의상", "cream jacket, navy skirt"));
  const request = {
    schema: "chaessi-image-request/v2", request: `${mode} fixture with ${count} shots`, count, mode,
    presets: { basePresetId: ids.base, characterPresetId: ids.character, outfitPresetId: ids.outfit, stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null },
    generation: { model: "nai-diffusion-5-full", baseSeed: 6000 },
  };
  const positionsUsed = positions || Array.from({ length: count }, (_, index) => 0.2 + (0.6 * index / Math.max(1, count - 1)));
  const actions = mode === "sequence"
    ? ["entering the lobby", "walking toward the desk", "checking a closed ledger", "looking through the window"]
    : Array.from({ length: count }, (_, index) => `editorial pose ${index + 1}`);
  while (actions.length < count) actions.push(`continuing action ${actions.length + 1}`);
  const shots = Array.from({ length: count }, (_, index) => makeShot({ index, mode, action: actions[index], x: positionsUsed[index], invalid: index === invalidAt }));
  if (duplicateAt > 0) shots[duplicateAt].direction = structuredClone(shots[0].direction);
  const directorPlan = {
    schema: "chaessi-scene-plan/v2", request: request.request, mode, count,
    presetSelections: { basePresetId: ids.base, characterPresetIds: [ids.character], outfitPresetIds: [ids.outfit], stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null },
    continuity: { characterIdentity: "locked", outfit: "locked", location: "locked", props: "tracked", screenDirection: "tracked" },
    shots,
  };
  return { request, directorPlan, dataRoot, basePreset, positions: positionsUsed };
}

function makeShot({ index, mode, action, x, invalid }) {
  const id = `shot_${String(index + 1).padStart(3, "0")}`;
  const sizes = ["wide", "medium", "close-up", "full-body", "cowboy"];
  return {
    id, index: index + 1, intent: `Meaningful shot ${index + 1}`, rhythmRole: index === 0 ? "establishing" : "action",
    direction: {
      shotSize: sizes[index % sizes.length], cameraHeight: index % 2 ? "slightly low" : "eye level",
      cameraAngle: index % 2 ? "profile angle" : "front three-quarter angle", viewpoint: "from the lobby entrance",
      bodyOrientation: index % 2 ? "side three-quarter" : "front three-quarter", pose: `controlled pose ${index + 1}`,
      action, gaze: index % 2 ? "looking aside" : "looking toward viewer", expression: `expression ${index + 1}`,
      subjectPlacement: x < 0.4 ? "left third" : x > 0.6 ? "right third" : "center",
      depth: "clear foreground depth with lobby architecture in background", lighting: "soft daylight",
      visibilityRequirements: ["face and outfit remain readable"],
    },
    continuity: {
      location: "modern hotel lobby", outfitState: "uniform fully worn",
      props: [{ id: "ledger", state: mode === "sequence" && index >= 2 ? "held closed" : "resting nearby" }],
      screenDirection: x < 0.5 ? "moving right" : "moving left", carriesFrom: mode === "sequence" && index > 0 ? `shot_${String(index).padStart(3, "0")}` : null,
    },
    generation: {
      mainPrompt: "1girl, solo, modern hotel lobby, reception desk, daylight",
      supplement: `One adult woman performs scene ${index + 1} in the same modern lobby.`,
      characters: [{
        characterPresetId: ids.character, visibleFeaturesPrompt: "", scenePrompt: invalid ? "standing beside someone" : `${action}, calm expression`,
        undesiredPrompt: "", position: { x, y: 0.55 },
      }],
      undesiredPrompt: "3::extra person, multiple people, background characters::", seed: null,
    },
  };
}

function fakeLocalApi(dataRoot, basePreset, { failGenerationAt = Infinity } = {}) {
  let generateCount = 0;
  return {
    generationCalls: () => generateCount,
    async fetch(url, init) {
      const pathname = new URL(url).pathname;
      if (pathname === "/api/health") return response({ ok: true, app: "Chaessi Preset", version: "test" });
      if (pathname === "/api/settings/token-status") return response({ ok: true, configured: true, source: "fixture" });
      if (pathname.startsWith("/api/presets/")) return response({ ok: true, preset: basePreset });
      if (pathname === "/api/novelai/generate") {
        generateCount += 1;
        if (generateCount === failGenerationAt) return { ok: false, status: 500, json: async () => ({ ok: false }) };
        const body = JSON.parse(init.body);
        const payload = buildV5GeneratePayload(body.preset);
        const id = `multi_generation_${generateCount}`;
        const folder = "data/generations/fixture";
        await mkdir(path.join(dataRoot, folder), { recursive: true });
        await writeFile(path.join(dataRoot, folder, `${id}.png`), Buffer.from("fixture"));
        await writeJson(path.join(dataRoot, folder, `${id}.json`), { generation_id: id });
        await writeJson(path.join(dataRoot, folder, `${id}.payload.json`), payload);
        return response({ ok: true, generation: { id, image_path: `${folder}/${id}.png`, sidecar_path: `${folder}/${id}.json`, payload_path: `${folder}/${id}.payload.json` }, summary: { model: payload.model, seed: payload.parameters.seed } });
      }
      return { ok: false, status: 404, json: async () => ({ ok: false }) };
    },
  };
}
function response(value) { return { ok: true, status: 200, json: async () => value }; }
async function forbiddenFetch() { throw new Error("dry-run must not call fetch"); }
function component(id, category, prompt) { return { schema: "chaessi-character-preset/v1", id, name: id, category, subCategory: "", enabled: true, prompt, undesired: "", centers: [{ x: 0.5, y: 0.5 }] }; }
async function writeJson(file, value) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); }
