import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CODEX_DIRECTOR_RUNTIME_DEFAULT,
  createCodexDirectorBridge,
  inspectCodexClient,
  invokeCodexExec,
  parseCodexPlan,
} from "./src/services/codex-director-bridge.js";

const request = {
  schema: "chaessi-image-request/v2",
  request: "호텔 로비에서 장부를 든 여성 직원의 세련된 화보",
  count: 3,
  mode: "editorial",
  presets: {
    basePresetId: "preset_v5", characterPresetId: "character_chaessi", outfitPresetId: "outfit_hotel",
    stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null,
  },
  generation: { model: "nai-diffusion-5-full", baseSeed: 12345 },
};

test("Codex Bridge creates, caches, and explicitly regenerates a valid plan", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-codex-bridge-"));
  let execCalls = 0;
  const execArgs = [];
  const invoke = async ({ args }) => {
    if (args[0] === "--version") return { stdout: "codex-cli test" };
    if (args[0] === "login") return { stdout: "Logged in using ChatGPT" };
    execCalls += 1;
    execArgs.push(args);
    return { finalMessage: JSON.stringify(makePlan(request)) };
  };
  const bridge = createCodexDirectorBridge({ ...dependencies(root), invoke });
  try {
    const first = await bridge.createPlan({ request, operationId: "first_12345678" });
    assert.equal(first.cached, false);
    assert.equal(first.plan.shots.length, 3);
    const cached = await bridge.createPlan({ request, operationId: "second_12345678" });
    assert.equal(cached.cached, true);
    assert.equal(execCalls, 1);
    const regenerated = await bridge.createPlan({ request, regenerate: true, operationId: "third_12345678" });
    assert.equal(regenerated.cached, false);
    assert.equal(execCalls, 2);
    assert.equal(execArgs[0].includes("--model"), true);
    assert.equal(execArgs[0][execArgs[0].indexOf("--model") + 1], CODEX_DIRECTOR_RUNTIME_DEFAULT.model);
    assert.equal(execArgs[0].includes(`model_reasoning_effort=${JSON.stringify(CODEX_DIRECTOR_RUNTIME_DEFAULT.reasoningEffort)}`), true);
    const artifact = JSON.parse(await readFile(path.join(root, "data", "image-maker-director-runs", "director_first_12345678", "director-result.json"), "utf8"));
    assert.equal(artifact.client.authentication, "chatgpt");
    assert.equal(artifact.client.model, "gpt-5.6-terra");
    assert.equal(artifact.client.reasoningEffort, "medium");
    assert.equal(JSON.stringify(artifact).includes("Bearer"), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Codex Bridge keeps runtime model overrides separate from the developer CLI config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-codex-runtime-model-"));
  let invocationArgs = null;
  let execCalls = 0;
  const invoke = async ({ args }) => {
    if (args[0] === "--version") return { stdout: "codex-cli test" };
    if (args[0] === "login") return { stdout: "Logged in using ChatGPT" };
    execCalls += 1;
    invocationArgs = args;
    return { finalMessage: JSON.stringify(makePlan(request)) };
  };
  try {
    const lowBridge = createCodexDirectorBridge({
      ...dependencies(root), invoke, model: "gpt-test-director", reasoningEffort: "low",
    });
    const status = await lowBridge.getStatus();
    assert.equal(status.model, "gpt-test-director");
    assert.equal(status.reasoningEffort, "low");
    await lowBridge.createPlan({ request, operationId: "runtime_low_12345678" });
    assert.equal(invocationArgs[invocationArgs.indexOf("--model") + 1], "gpt-test-director");
    assert.equal(invocationArgs.includes('model_reasoning_effort="low"'), true);
    const mediumBridge = createCodexDirectorBridge({
      ...dependencies(root), invoke, model: "gpt-test-director", reasoningEffort: "medium",
    });
    await mediumBridge.createPlan({ request, operationId: "runtime_medium_12345678" });
    assert.equal(execCalls, 2, "changing runtime effort must not reuse a plan cached under another effort");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Codex Bridge validates sequence continuity", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-codex-sequence-"));
  const sequenceRequest = { ...structuredClone(request), request: "로비로 들어와 장부를 확인하고 창밖을 보는 연속 장면", mode: "sequence" };
  const invoke = async ({ args }) => args[0] === "--version" ? { stdout: "codex-cli test" }
    : args[0] === "login" ? { stdout: "Logged in using ChatGPT" }
      : { finalMessage: JSON.stringify(makePlan(sequenceRequest)) };
  try {
    const result = await createCodexDirectorBridge({ ...dependencies(root), invoke }).createPlan({ request: sequenceRequest });
    assert.equal(result.plan.shots[1].continuity.carriesFrom, "shot_001");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Codex Bridge isolates invalid output, schema, and count failures", async () => {
  for (const [name, output, code] of [
    ["invalid", "not json", "CODEX_INVALID_OUTPUT"],
    ["schema", JSON.stringify({ ...makePlan(request), schema: "wrong" }), "CODEX_SCHEMA_INVALID"],
    ["count", JSON.stringify({ ...makePlan(request), count: 2, shots: makePlan(request).shots.slice(0, 2) }), "CODEX_COUNT_MISMATCH"],
  ]) {
    const root = await mkdtemp(path.join(os.tmpdir(), `chaessi-codex-${name}-`));
    const invoke = async ({ args }) => args[0] === "--version" ? { stdout: "codex-cli test" }
      : args[0] === "login" ? { stdout: "Logged in using ChatGPT" } : { finalMessage: output };
    try {
      await assert.rejects(() => createCodexDirectorBridge({ ...dependencies(root), invoke }).createPlan({ request }), (error) => error.code === code);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test("Codex client reports missing executable", async () => {
  await assert.rejects(() => inspectCodexClient({ executable: "definitely-missing-chaessi-codex.exe" }), (error) => error.code === "CODEX_NOT_AVAILABLE");
});

test("Codex process timeout is classified without retry", async () => {
  await assert.rejects(() => invokeCodexExec({ executable: process.execPath, args: ["-e", "setTimeout(() => {}, 5000)"], timeoutMs: 30 }), (error) => error.code === "CODEX_TIMEOUT");
});

test("Codex JSON capture accepts plain JSON and one fenced JSON block", () => {
  assert.equal(parseCodexPlan(JSON.stringify(makePlan(request))).count, 3);
  assert.equal(parseCodexPlan(`\`\`\`json\n${JSON.stringify(makePlan(request))}\n\`\`\``).count, 3);
  assert.throws(() => parseCodexPlan("prefix { broken"), (error) => error.code === "CODEX_INVALID_OUTPUT");
});

function dependencies(root) {
  return {
    dataRoot: root,
    presetStore: { getPreset: async () => ({ metadata: { id: "preset_v5", name: "V5", updated_at: "2026-09-09" }, params: { model: "nai-diffusion-5-full", width: 832, height: 1216 } }) },
    characterPresetStore: { getCharacterPreset: async (id) => id.startsWith("character_")
      ? { id, name: "Chaessi", category: "여성 캐릭터", subCategory: "", prompt: "black hair, blue eyes, long hair", updated_at: "2026-09-09" }
      : { id, name: "Hotel uniform", category: "여성 의상", subCategory: "", prompt: "maroon jacket, pencil skirt", updated_at: "2026-09-09" } },
  };
}

function makePlan(sourceRequest) {
  const presets = {
    basePresetId: sourceRequest.presets.basePresetId,
    characterPresetIds: [sourceRequest.presets.characterPresetId],
    outfitPresetIds: [sourceRequest.presets.outfitPresetId],
    stylePresetId: sourceRequest.presets.stylePresetId,
    qualityPresetId: sourceRequest.presets.qualityPresetId,
    cameraPresetId: null,
    lightingPresetId: null,
  };
  const actions = ["holding a closed ledger", "checking the ledger", "standing beside the reception desk"];
  const sizes = ["wide", "medium", "close-up"];
  return {
    schema: "chaessi-scene-plan/v2", request: sourceRequest.request, mode: sourceRequest.mode, count: sourceRequest.count,
    presetSelections: presets,
    continuity: { characterIdentity: "locked", outfit: "locked", location: "locked", props: "tracked", screenDirection: "tracked" },
    shots: Array.from({ length: sourceRequest.count }, (_, index) => ({
      id: `shot_${String(index + 1).padStart(3, "0")}`, index: index + 1,
      intent: `Distinct hotel composition ${index + 1}`,
      rhythmRole: ["establishing", "action", "portrait"][index % 3],
      direction: {
        shotSize: sizes[index % 3], cameraHeight: "eye level", cameraAngle: index === 1 ? "low angle" : "level angle",
        viewpoint: index === 2 ? "profile" : "front three-quarter", bodyOrientation: "three-quarter turn",
        pose: index === 2 ? "upright still pose" : "relaxed standing pose", action: actions[index % 3],
        gaze: index === 1 ? "looking down at the ledger" : "looking toward camera", expression: index === 2 ? "quiet confident smile" : "professional smile",
        subjectPlacement: index === 1 ? "right third" : "left third", depth: "reception desk in midground", lighting: "soft lobby lighting",
        visibilityRequirements: ["face visible", "ledger visible"],
      },
      continuity: {
        location: "hotel lobby", outfitState: "clean hotel uniform", props: [{ id: "ledger", state: index === 1 ? "open" : "closed" }],
        screenDirection: "stable", carriesFrom: sourceRequest.mode === "sequence" && index > 0 ? `shot_${String(index).padStart(3, "0")}` : null,
      },
      generation: {
        mainPrompt: `${sizes[index % 3]}, eye level, hotel lobby`, supplement: actions[index % 3],
        characters: [{ characterPresetId: sourceRequest.presets.characterPresetId, visibleFeaturesPrompt: "black hair, blue eyes", scenePrompt: `${actions[index % 3]}, professional smile`, undesiredPrompt: "", position: { x: index === 1 ? 0.7 : 0.3, y: 0.55 } }],
        undesiredPrompt: "", seed: sourceRequest.generation.baseSeed === null ? null : sourceRequest.generation.baseSeed + index,
      },
    })),
  };
}
