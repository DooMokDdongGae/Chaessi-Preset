import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createDefaultPreset } from "./src/state/preset-schema.js";
import { validateImageMakerMultiRequest, multiRequestPresetSelections } from "./src/state/image-maker-multi-request.js";
import { resolveWorkshopImageMakerAssets } from "./src/services/image-maker-workshop-context.js";
import { compileScenePlanV2Shot } from "./src/services/preset-composer-v2.js";
import { runMultiImageMakerRequest } from "./src/services/image-maker-multi-runner.js";
import { buildDirectorContext } from "./src/services/codex-director-bridge.js";
import { createImageMakerRequestValue, createWorkshopGenerationSummary, evaluateImageMakerFreshness, planningRequestRevision } from "./src/ui/image-maker-state.js";

function workshop(model = "nai-diffusion-5-full") {
  return createDefaultPreset({
    metadata: { id: "active_workshop", name: "Active Workshop" },
    prompt_parts: { base: "watercolor style, detailed background", undesired: "low quality", characters: [] },
    params: { model, width: 832, height: 1216, steps: 28, scale: 5, sampler: "k_euler_ancestral", seed: 4401 },
  });
}

function workflowRequest(preset, presetBlocks = []) {
  return createImageMakerRequestValue({
    request: "호텔 로비에서 장부를 든 여성 직원", mode: "editorial", count: 1, presetBlocks,
    generation: createWorkshopGenerationSummary(preset, "text-to-image"),
  });
}

function shotPlan(request) {
  const selections = multiRequestPresetSelections(request);
  return {
    schema: "chaessi-scene-plan/v2", request: request.request, mode: request.mode, count: 1,
    presetSelections: selections,
    continuity: { characterIdentity: "locked", outfit: "locked", location: "locked", props: "tracked", screenDirection: "tracked" },
    shots: [{
      id: "shot_001", index: 1, intent: "로비 공간과 직원을 함께 보여준다.", rhythmRole: "establishing",
      direction: { shotSize: "medium", cameraHeight: "eye level", cameraAngle: "front three-quarter", viewpoint: "lobby", bodyOrientation: "front three-quarter", pose: "standing", action: "holding a ledger", gaze: "viewer", expression: "professional smile", subjectPlacement: "left third", depth: "lobby background", lighting: "soft daylight", visibilityRequirements: ["face visible"] },
      continuity: { location: "hotel lobby", outfitState: "fully worn", props: [], screenDirection: "stationary", carriesFrom: null },
      generation: { mainPrompt: "hotel lobby, reception desk", supplement: "A single employee stands beside the desk.", characters: selections.characterPresetIds.map((id) => ({ characterPresetId: id, visibleFeaturesPrompt: "", scenePrompt: "holding a closed ledger, professional smile", undesiredPrompt: "", position: null })), undesiredPrompt: "extra people", seed: 4401 },
    }],
  };
}

test("v3 workflow accepts natural language with zero optional preset blocks", () => {
  const request = workflowRequest(workshop());
  assert.equal(validateImageMakerMultiRequest(request).ok, true);
  assert.deepEqual(request.presetBlocks, []);
  assert.equal(request.generation.model, "nai-diffusion-5-full");
});

test("Director bindings infer explicit actor count without mandatory actor preset blocks", () => {
  const request = workflowRequest(workshop()); request.request = "호텔 로비의 여성 직원과 남성 직원";
  const selections = multiRequestPresetSelections(request);
  assert.equal(selections.characterPresetIds.length, 2);
  assert.equal(selections.outfitPresetIds.length, 2);
});

test("optional preset blocks resolve by real store/category and remain repeatable", async () => {
  const preset = workshop();
  const blocks = [
    { scope: "actor-1", store: "character-preset", category: "여성 캐릭터", presetId: "chaessi" },
    { scope: "actor-1", store: "character-preset", category: "여성 의상", presetId: "uniform" },
    { scope: "global", store: "character-preset", category: "그림체", presetId: "ink" },
  ];
  const request = workflowRequest(preset, blocks);
  const values = new Map([
    ["chaessi", { id: "chaessi", name: "Chaessi", category: "여성 캐릭터", prompt: "black hair", undesired: "" }],
    ["uniform", { id: "uniform", name: "Uniform", category: "여성 의상", prompt: "hotel uniform", undesired: "" }],
    ["ink", { id: "ink", name: "Ink", category: "그림체", prompt: "ink wash", undesired: "" }],
  ]);
  const assets = await resolveWorkshopImageMakerAssets({ request, workshopContext: { preset, modeRequest: { mode: "text-to-image" } }, presetStore: {}, characterPresetStore: { getCharacterPreset: async (id) => values.get(id) } });
  assert.match(assets.characterPresets[0].prompt, /black hair/);
  assert.match(assets.outfitPresets[0].prompt, /hotel uniform/);
  assert.match(assets.globalPrompt, /watercolor style/);
  assert.match(assets.globalPrompt, /ink wash/);
});

test("Composer uses active Workshop model and renderer settings without Director overrides", async () => {
  for (const model of ["nai-diffusion-5-full", "nai-diffusion-4-5-full"]) {
    const preset = workshop(model); const request = workflowRequest(preset);
    const assets = await resolveWorkshopImageMakerAssets({ request, workshopContext: { preset, modeRequest: { mode: "text-to-image" } }, presetStore: {}, characterPresetStore: {} });
    const prepared = compileScenePlanV2Shot(shotPlan(request), assets);
    assert.equal(prepared.payload.model, model);
    assert.equal(prepared.resolvedPreset.params.steps, 28);
    assert.equal(prepared.resolvedPreset.params.scale, 5);
    assert.match(prepared.resolvedPreset.prompt_parts.base, /watercolor style/);
  }
});

test("Image Maker delegates I2I and Inpaint payloads to the existing mode builders", async () => {
  for (const model of ["nai-diffusion-5-full", "nai-diffusion-4-5-full"]) {
    for (const modeRequest of [
      { mode: "image-to-image", mode_state: { width: 832, height: 1216, source_image_base64: "AAAA", strength: 0.6, noise: 0.1 } },
      { mode: "inpaint", mode_state: { width: 832, height: 1216, source_image_base64: "AAAA", mask_image_base64: "AAAA", strength: 0.7, noise: 0, add_original_image: false } },
    ]) {
      const preset = workshop(model); const request = workflowRequest(preset); request.generation.mode = modeRequest.mode;
      const assets = await resolveWorkshopImageMakerAssets({ request, workshopContext: { preset, modeRequest }, presetStore: {}, characterPresetStore: {} });
      const prepared = compileScenePlanV2Shot(shotPlan(request), assets);
      assert.equal(prepared.requestBody.mode, modeRequest.mode);
      assert.ok(prepared.payload.parameters.image);
      if (modeRequest.mode === "inpaint") assert.ok(prepared.payload.parameters.mask);
    }
  }
});

test("request-only v3 workflow reaches ready through the real multi-shot dry-run", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "chaessi-v331-"));
  try {
    const preset = workshop(); const request = workflowRequest(preset); const directorPlan = shotPlan(request);
    const output = await runMultiImageMakerRequest({
      request, directorPlan, workshopContext: { preset, modeRequest: { mode: "text-to-image" } },
      presetStore: {}, characterPresetStore: {}, dataRoot, dryRun: true, runId: "v331_request_only",
      fetchFn: async () => { throw new Error("dry-run must not call NovelAI or Local API"); },
    });
    assert.equal(output.status, "ready");
    assert.equal(output.manifest.preparedCount, 1);
    assert.equal(output.manifest.preflight.shots[0].status, "ready");
  } finally { await rm(dataRoot, { recursive: true, force: true }); }
});

test("Codex receives compact planning context without renderer settings or source images", async () => {
  const preset = workshop(); const request = workflowRequest(preset);
  const context = await buildDirectorContext({ request, workshopContext: { preset, modeRequest: { mode: "image-to-image", mode_state: { source_image_base64: "PRIVATE_IMAGE_BYTES" } } }, presetStore: {}, characterPresetStore: {} });
  const sent = JSON.stringify(context.promptContext);
  assert.match(sent, /nai-diffusion-5-full/);
  assert.match(sent, /portrait/);
  assert.equal(sent.includes("PRIVATE_IMAGE_BYTES"), false);
  assert.equal(sent.includes("sampler"), false);
  assert.equal(sent.includes("steps"), false);
});

test("renderer-only changes keep the Director plan and invalidate only Preflight", () => {
  const preset = workshop(); const request = workflowRequest(preset); const plan = shotPlan(request);
  const readyBase = evaluateImageMakerFreshness({ currentRequest: request, plan, planRequestRevision: planningRequestRevision(request) });
  const ready = evaluateImageMakerFreshness({ currentRequest: request, plan, planRequestRevision: planningRequestRevision(request), preflightPlanRevision: readyBase.preflightRevision, preflightStatus: "ready" });
  assert.equal(ready.canGenerate, true);
  const changed = structuredClone(request); changed.generation.renderRevision = "settings_new"; changed.generation.seed = 9123;
  const state = evaluateImageMakerFreshness({ currentRequest: changed, plan, planRequestRevision: planningRequestRevision(request), preflightPlanRevision: readyBase.preflightRevision, preflightStatus: "ready" });
  assert.equal(state.planStale, false);
  assert.equal(state.preflightStale, true);
  assert.equal(state.canGenerate, false);
});

test("I2I source canvas changes planning context while strength changes only renderer context", () => {
  const preset = workshop();
  const first = createWorkshopGenerationSummary(preset, "image-to-image", { width: 640, height: 960, strength: 0.5, noise: 0.1 });
  const strengthOnly = createWorkshopGenerationSummary(preset, "image-to-image", { width: 640, height: 960, strength: 0.8, noise: 0.1 });
  const canvasChange = createWorkshopGenerationSummary(preset, "image-to-image", { width: 960, height: 640, strength: 0.5, noise: 0.1 });
  assert.equal(first.planningRevision, strengthOnly.planningRevision);
  assert.notEqual(first.renderRevision, strengthOnly.renderRevision);
  assert.notEqual(first.planningRevision, canvasChange.planningRevision);
});

test("default UI is natural-language-first and keeps manual plan tools advanced", async () => {
  const [html, controller] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./src/ui/image-maker-controller.js", import.meta.url), "utf8"),
  ]);
  for (const removed of ["imageMakerBasePreset", "imageMakerCharacterPreset", "imageMakerOutfitPreset", "imageMakerStylePreset", "imageMakerQualityPreset", "imageMakerBaseSeed"]) assert.equal(html.includes(removed), false);
  for (const present of ["imageMakerRequest", "imageMakerCount", "imageMakerGenerateButton", "imageMakerAddPresetButton", "imageMakerPresetBlocks", "imageMakerAdvancedWorkflow"]) assert.ok(html.includes(`id="${present}"`), present);
  assert.ok(controller.includes('"/api/image-maker/director-plan"'));
  assert.ok(controller.includes('"/api/image-maker/preflight"'));
  assert.ok(controller.includes('"/api/image-maker/generate"'));
  assert.ok(controller.includes("Final NovelAI Prompt"));
  assert.ok(controller.includes("navigator.clipboard.writeText"));
});
