import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  collectReviewMessages,
  createImageMakerRequestValue,
  projectDirectorState,
  projectGenerationState,
  projectPreflightState,
  projectResultGallery,
  projectShotCards,
} from "./src/ui/image-maker-state.js";
import { createImageMakerApi } from "./src/services/image-maker-api.js";

test("A — catalog separates Character, Outfit, Style and Quality presets", async () => {
  const api = fixtureApi();
  const catalog = await api.listCatalog();
  assert.deepEqual(catalog.character.map((item) => item.id), ["character_1", "character_male"]);
  assert.deepEqual(catalog.outfit.map((item) => item.id), ["outfit_1", "outfit_male"]);
  assert.deepEqual(catalog.style.map((item) => item.id), ["style_1"]);
  assert.deepEqual(catalog.quality.map((item) => item.id), ["quality_1"]);
  assert.equal(catalog.base[0].model, "nai-diffusion-5-full");
});

test("B — request controls create chaessi-image-request/v2 without a maximum count", () => {
  const value = createImageMakerRequestValue({
    request: "Seven editorial scenes", basePresetId: "base_1", characterPresetId: "character_1",
    outfitPresetId: "outfit_1", stylePresetId: "style_1", qualityPresetId: "quality_1",
    mode: "editorial", count: "37", baseSeed: "7000",
  });
  assert.equal(value.schema, "chaessi-image-request/v2");
  assert.equal(value.count, 37);
  assert.equal(value.mode, "editorial");
  assert.equal(value.generation.baseSeed, 7000);
});

test("C — three-shot plan projects to three readable shot cards", () => {
  const cards = projectShotCards(plan(3));
  assert.equal(cards.length, 3);
  assert.match(cards[0].camera, /medium/);
  assert.equal(cards[1].placement, "center");
  assert.deepEqual(cards[2].position, { x: 0.7, y: 0.55 });
});

test("D — ready preflight enables generation", () => {
  assert.deepEqual(projectPreflightState({ status: "ready", preparedCount: 3, requestedCount: 3 }), {
    status: "ready", canGenerate: true, title: "READY", message: "3 / 3 shots can generate",
  });
});

test("E — needs-review blocks generation and exposes a readable reason", () => {
  const run = { status: "needs-review", shots: [{ shotId: "shot_002", issues: [{ type: "implicit-extra-actor", term: "someone" }] }] };
  assert.equal(projectPreflightState(run).canGenerate, false);
  assert.deepEqual(collectReviewMessages(run)[0], { shotId: "shot_002", type: "implicit-extra-actor", severity: "review", message: "This shot may imply an undeclared extra person “someone”.", rewrite: null });
});

test("F — sequential backend state maps to honest progress", () => {
  const progress = projectGenerationState({ status: "generating", completedCount: 2, requestedCount: 3, shots: [{ shotId: "shot_001", status: "completed" }, { shotId: "shot_002", status: "completed" }, { shotId: "shot_003", status: "ready" }] });
  assert.equal(progress.busy, true);
  assert.equal(progress.completedCount, 2);
  assert.equal(progress.shots[2].status, "ready");
});

test("G — completed gallery preserves shot order", () => {
  const gallery = projectResultGallery({ shots: [
    { shotId: "shot_001", generationId: "g1", seed: 1, imageUrl: "/1.png" },
    { shotId: "shot_002", generationId: "g2", seed: 2, imageUrl: "/2.png" },
  ] });
  assert.deepEqual(gallery.map((item) => item.generationId), ["g1", "g2"]);
});

test("H — partial failure keeps completed gallery items", () => {
  const run = { status: "partial-failure", completedCount: 1, requestedCount: 3, shots: [
    { shotId: "shot_001", status: "completed", generationId: "g1", seed: 1, imageUrl: "/1.png" },
    { shotId: "shot_002", status: "failed", failure: { code: "NAI_RESPONSE", message: "Request failed." } },
  ] };
  assert.equal(projectGenerationState(run).busy, false);
  assert.equal(projectResultGallery(run).length, 1);
});

test("I — duplicate Generate operation starts the runner once and frontend sources contain no secret access", async () => {
  let calls = 0;
  const api = fixtureApi({ runner: async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 10)); return { status: "completed" }; } });
  const first = api.startGeneration({ operationId: "operation_12345678", request: {}, directorPlan: {} });
  const second = api.startGeneration({ operationId: "operation_12345678", request: {}, directorPlan: {} });
  assert.equal(first.runId, second.runId);
  assert.equal(second.duplicate, true);
  assert.equal(calls, 1);
  const controller = await readFile(new URL("./src/ui/image-maker-controller.js", import.meta.url), "utf8");
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  assert.equal(/NAI_ACCESS_TOKEN|pst-[A-Za-z0-9_-]+|Bearer\s/.test(controller), false);
  assert.equal(html.includes('type="password"') && !html.includes("imageMakerToken"), true);
});

test("Phase 8 — Codex Director result exposes cache state without triggering preflight", async () => {
  const generated = plan(3);
  const api = fixtureApi({ directorBridge: {
    getStatus: async () => ({ version: "codex-cli test", authentication: "chatgpt" }),
    createPlan: async () => ({ status: "plan-ready", cached: true, plan: generated }),
  } });
  const result = await api.createDirectorPlan({ request: { request: "test" } });
  assert.equal(result.cached, true);
  assert.equal(projectDirectorState(result).status, "plan-ready");
  assert.match(projectDirectorState(result).message, /기존 Director Plan/);
});

test("frontend wiring exposes the Image Maker screen, hidden technical details and server endpoints", async () => {
  const [html, app, server] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./src/app.js", import.meta.url), "utf8"),
    readFile(new URL("./server.mjs", import.meta.url), "utf8"),
  ]);
  for (const id of ["imageMakerWorkspace", "imageMakerRequest", "imageMakerCharacterPreset", "imageMakerPlanJson", "imageMakerCreatePlanButton", "imageMakerRegeneratePlanButton", "imageMakerShotList", "imageMakerPreflightButton", "imageMakerGenerateButton", "imageMakerGallery", "imageMakerDetailDialog"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes("<details class=\"image-maker-plan-source\">"));
  assert.ok(app.includes("createImageMakerController"));
  for (const route of ["/api/image-maker/catalog", "/api/image-maker/director-plan", "/api/image-maker/preflight", "/api/image-maker/generate", "/api/image-maker/runs"]) assert.ok(server.includes(route), route);
});

function fixtureApi({ runner = async () => ({ status: "completed" }), directorBridge = null } = {}) {
  return createImageMakerApi({
    dataRoot: process.cwd(), runner, baseUrl: "http://127.0.0.1:1",
    presetStore: { listPresets: async () => [{ id: "base_1", name: "V5 Base", model: "nai-diffusion-5-full" }] },
    characterPresetStore: { listCharacterPresets: async () => [
      { id: "character_1", name: "Character", category: "여성 캐릭터" },
      { id: "character_male", name: "Male Character", category: "남성 캐릭터" },
      { id: "outfit_1", name: "Outfit", category: "여성 의상" },
      { id: "outfit_male", name: "Male Outfit", category: "남성 의상" },
      { id: "style_1", name: "Style", category: "그림체" },
      { id: "quality_1", name: "Quality", category: "품질" },
      { id: "disabled_1", name: "Disabled", category: "그림체", enabled: false },
    ] },
    generationStore: { getGeneration: async () => ({}) },
    directorBridge,
  });
}

function plan(count) {
  return { shots: Array.from({ length: count }, (_, index) => ({
    id: `shot_${String(index + 1).padStart(3, "0")}`, intent: `Shot ${index + 1}`,
    direction: { shotSize: "medium", cameraHeight: "eye level", cameraAngle: "three-quarter", viewpoint: "lobby", subjectPlacement: index === 1 ? "center" : "side", pose: "standing", action: `action ${index + 1}`, gaze: "viewer", expression: "calm" },
    generation: { characters: [{ position: { x: 0.3 + (index * 0.2), y: 0.55 } }] },
    continuity: { carriesFrom: index ? `shot_${String(index).padStart(3, "0")}` : null },
  })) };
}
