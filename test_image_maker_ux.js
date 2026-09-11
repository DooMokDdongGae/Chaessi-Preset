import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  collectReviewMessages,
  evaluateImageMakerFreshness,
  projectDirectorState,
  projectDirectorStatus,
  projectRunHistoryItem,
  projectShotCards,
  projectShotOverview,
  revisionFor,
} from "./src/ui/image-maker-state.js";
import { createImageMakerApi } from "./src/services/image-maker-api.js";

const request = {
  schema: "chaessi-image-request/v2", request: "호텔 로비에서 장부를 든 직원 화보", count: 3, mode: "editorial",
  presets: { basePresetId: "base", characterPresetId: "character", outfitPresetId: "outfit", stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null },
  generation: { model: "nai-diffusion-5-full", baseSeed: 8300 },
};

test("A — Director status distinguishes connected, unavailable, and unauthenticated without exposing a path", () => {
  const connected = projectDirectorStatus({ executable: "C:\\secret\\codex.exe", authentication: "chatgpt", model: "gpt-5.6-terra", reasoningEffort: "medium" });
  assert.deepEqual([connected.state, connected.title, connected.detail], ["connected", "Connected", "GPT 5.6 Terra / Medium"]);
  assert.equal(JSON.stringify(connected).includes("secret"), false);
  assert.equal(projectDirectorStatus(null, { code: "CODEX_NOT_AVAILABLE" }).state, "unavailable");
  assert.equal(projectDirectorStatus(null, { code: "CODEX_NOT_AUTHENTICATED" }).state, "unauthenticated");
});

test("B — Director result projects Cached and Generated now badges", () => {
  assert.equal(projectDirectorState({ cached: true, plan: makePlan() }).cacheLabel, "Cached");
  assert.equal(projectDirectorState({ cached: false, plan: makePlan() }).cacheLabel, "Generated now");
});

test("C — shot overview and cards prioritize camera, placement, action, gaze, and friendly position", () => {
  const cards = projectShotCards(makePlan());
  assert.equal(cards.length, 3);
  assert.match(cards[0].overview, /wide · Left · viewer/);
  assert.equal(cards[0].positionLabel, "Left");
  assert.match(cards[1].poseAction, /checking ledger/);
  assert.equal(projectShotOverview(makePlan())[2].label.startsWith("03"), true);
  const environmentalMention = makePlan();
  environmentalMention.shots[0].direction.subjectPlacement = "slightly right of center with the desk on the left";
  environmentalMention.shots[0].generation.characters[0].position = null;
  assert.equal(projectShotCards(environmentalMention)[0].positionLabel, "");
  assert.match(projectShotCards(environmentalMention)[0].overview, /Right/);
});

test("D — review messages are readable and preserve shot navigation identity", () => {
  const items = collectReviewMessages({ shots: [{ shotId: "shot_002", issues: [{ type: "director-slot-actor-cue", term: "her", resolution: "warning" }] }] });
  assert.equal(items[0].shotId, "shot_002");
  assert.match(items[0].message, /undeclared extra person/);
  assert.equal(items[0].message.includes("director-slot-actor-cue"), false);
});

test("E — changing request content makes the retained plan stale", () => {
  const plan = makePlan();
  const originalRevision = revisionFor(request, "request");
  const state = evaluateImageMakerFreshness({ currentRequest: { ...request, request: "다른 요청" }, plan, planRequestRevision: originalRevision });
  assert.equal(state.planStale, true);
  assert.equal(state.canPreflight, false);
  assert.equal(state.canGenerate, false);
});

test("F — changing a preset invalidates generation until current-plan preflight runs again", () => {
  const plan = makePlan();
  const requestRevision = revisionFor(request, "request");
  const baseline = evaluateImageMakerFreshness({ currentRequest: request, plan, planRequestRevision: requestRevision });
  const ready = evaluateImageMakerFreshness({ currentRequest: request, plan, planRequestRevision: requestRevision, preflightPlanRevision: baseline.planRevision, preflightStatus: "ready" });
  assert.equal(ready.canGenerate, true);
  const changed = structuredClone(request); changed.presets.outfitPresetId = "outfit_2";
  assert.equal(evaluateImageMakerFreshness({ currentRequest: changed, plan, planRequestRevision: requestRevision, preflightPlanRevision: baseline.planRevision, preflightStatus: "ready" }).canGenerate, false);
});

test("G — Manual Plan controls remain visible when the Director is unavailable", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  for (const id of ["imageMakerDirectorStatus", "imageMakerImportPlanButton", "imageMakerPreparePlanButton", "imageMakerPlanJson"]) assert.ok(html.includes(`id="${id}"`), id);
});

test("H — result cards link back to shot plans and history exposes request reuse", async () => {
  const [controller, history] = await Promise.all([
    readFile(new URL("./src/ui/image-maker-controller.js", import.meta.url), "utf8"),
    Promise.resolve(projectRunHistoryItem({ request: request.request, mode: "editorial", requestedCount: 3, status: "completed", startedAt: "2026-09-11T01:00:00Z" })),
  ]);
  assert.ok(controller.includes("data-view-shot-plan"));
  assert.ok(controller.includes("data-reuse-request"));
  assert.ok(controller.includes("data-reuse-plan"));
  assert.equal(history.title, request.request);
  assert.equal(history.countLabel, "3 images");
});

test("I — browsing, preflight, gallery and history do not invoke Codex plan creation", async () => {
  let directorCalls = 0;
  const api = createImageMakerApi({
    dataRoot: process.cwd(),
    presetStore: { listPresets: async () => [] }, characterPresetStore: { listCharacterPresets: async () => [] }, generationStore: {},
    directorBridge: { getStatus: async () => ({ authentication: "chatgpt" }), createPlan: async () => { directorCalls += 1; return { plan: makePlan() }; } },
    runner: async () => ({ manifest: { status: "ready", requestedCount: 3, preparedCount: 3, shots: [] } }),
  });
  await api.listCatalog(); await api.getDirectorStatus(); await api.preflight({ request, directorPlan: makePlan(), operationId: "ux_preflight_123" });
  assert.equal(directorCalls, 0);
  await api.createDirectorPlan({ request });
  assert.equal(directorCalls, 1);
});

function makePlan() {
  return {
    schema: "chaessi-scene-plan/v2", request: request.request, mode: request.mode, count: request.count,
    presetSelections: { basePresetId: "base", characterPresetIds: ["character"], outfitPresetIds: ["outfit"], stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null },
    shots: [
      shot(1, "wide", "left third", "standing", "holding ledger", "viewer", "calm", { x: 0.3, y: 0.55 }),
      shot(2, "medium", "center", "seated", "checking ledger", "down", "focused", { x: 0.5, y: 0.55 }),
      shot(3, "close", "right third", "standing", "closing ledger", "side", "smile", { x: 0.7, y: 0.55 }),
    ],
  };
}
function shot(index, shotSize, subjectPlacement, pose, action, gaze, expression, position) {
  return {
    id: `shot_${String(index).padStart(3, "0")}`, intent: `Intent ${index}`,
    direction: { shotSize, cameraHeight: "eye level", cameraAngle: "level", viewpoint: "front", subjectPlacement, pose, action, gaze, expression },
    generation: { characters: [{ position }] }, continuity: { carriesFrom: null },
  };
}
