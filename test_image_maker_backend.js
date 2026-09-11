import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDefaultPreset } from "./src/state/preset-schema.js";
import { composeScenePlan } from "./src/services/preset-composer.js";
import { createImageMakerBackend } from "./src/services/image-maker-backend.js";
import { buildModeGeneratePayload } from "./src/adapters/novelai-v45-generation-modes.js";
import { resolvePresetRandomPrompts } from "./src/services/prompt-random-resolver.js";

const plan = { schema: "chaessi-scene-plan/v1", basePresetId: "preset_fixture", request: "A city scene",
  scene: { mainPrompt: "city street", supplement: "Lights illuminate the street." }, overrides: { seed: 12345 } };
const base = () => createDefaultPreset({ metadata: { id: "preset_fixture" },
  prompt_parts: { base: "1girl, 1.2::lineart::, ||night|day||", undesired: "blur", characters: [{ prompt: "1girl, black hair" }] },
  params: { model: "nai-diffusion-5-full", seed: null, n_samples: 1 } });

test("composition preserves inputs, weights, characters and negatives; exported request reproduces payload", () => {
  const preset = base();
  const original = structuredClone(preset);
  const result = composeScenePlan(plan, preset, { randomFn: () => 0 });
  assert.deepEqual(preset, original);
  assert.equal(result.resolvedPreset.prompt_parts.base, "1girl, 1.2::lineart::, night, city street\nLights illuminate the street.");
  assert.deepEqual(result.resolvedPreset.prompt_parts.characters, original.prompt_parts.characters);
  assert.equal(result.resolvedPreset.prompt_parts.undesired, "blur");
  assert.equal(result.payload.parameters.seed, 12345);
  assert.equal(result.payload.model, "nai-diffusion-5-full");
  assert.equal(result.payload.parameters.params_version, 4);
  const serverEquivalent = buildModeGeneratePayload(resolvePresetRandomPrompts(result.requestBody.preset), { mode: "text-to-image" });
  assert.deepEqual(serverEquivalent, result.payload);
  assert.equal(result.resolvedPreset.schema, undefined);
  assert.equal(result.resolvedPreset.request, undefined);
  assert.equal(typeof globalThis.document, "undefined");
});

test("omitted seed is frozen and future inputs, wrong IDs/models, credentials and malformed random blocks fail", () => {
  const noSeed = structuredClone(plan); delete noSeed.overrides;
  const result = composeScenePlan(noSeed, base());
  assert.ok(Number.isInteger(result.resolvedPreset.params.seed));
  assert.deepEqual(buildModeGeneratePayload(result.requestBody.preset), result.payload);
  for (const bad of [
    { ...plan, shots: [] }, { ...plan, basePresetId: "../outside" }, { ...plan, basePresetId: "preset_other" },
    { ...plan, overrides: { seed: -1 } }, { ...plan, overrides: { seed: "123" } },
    { ...plan, overrides: { model: "nai-diffusion-5-full" } }, { ...plan, scene: { mainPrompt: "" } },
    { ...plan, scene: { mainPrompt: "pst-exampleSecret" } },
  ]) assert.throws(() => composeScenePlan(bad, base()));
  const v45 = base(); v45.params.model = "nai-diffusion-4-5-full";
  assert.throws(() => composeScenePlan(plan, v45), /V5/);
  const random = base(); random.prompt_parts.base = "||unfinished";
  assert.throws(() => composeScenePlan(plan, random), /random/);
  const many = base(); many.params.n_samples = 2;
  assert.throws(() => composeScenePlan(plan, many), /one image/);
});

test("backend/CLI use an explicit root, never modify presets and refuse output overwrite", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-maker-test-"));
  const presetDir = path.join(root, "data", "presets", plan.basePresetId);
  await mkdir(presetDir, { recursive: true });
  const file = path.join(presetDir, "preset.json");
  const original = JSON.stringify(base());
  await writeFile(file, original);
  await assert.rejects(createImageMakerBackend(), /explicit/);
  const backend = await createImageMakerBackend({ dataRoot: root });
  assert.equal((await backend.listPresets())[0].id, plan.basePresetId);
  await assert.rejects(backend.loadPreset("../escape"));
  await assert.rejects(backend.loadPreset("missing"));
  await backend.prepare(plan);
  const input = path.join(root, "plan.json");
  await writeFile(input, JSON.stringify(plan));
  const output = path.join(root, "output");
  const args = ["cli/chaessi.mjs", "dry-run", "--data-root", root, "--input", input, "--out-dir", output];
  const run = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).sent, false);
  assert.equal((await readdir(output)).length, 4);
  const outputBefore = await readFile(path.join(output, "payload.json"), "utf8");
  const rerun = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(rerun.status, 1);
  assert.equal(await readFile(path.join(output, "payload.json"), "utf8"), outputBefore);
  assert.equal(await readFile(file, "utf8"), original);
  assert.deepEqual(await readdir(path.join(root, "data")), ["presets"]);
});
