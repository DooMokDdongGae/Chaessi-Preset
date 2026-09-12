import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildV5GeneratePayload, validateV5Payload } from "./src/adapters/novelai-v5-full.js";
import { getJson } from "./src/api/client.js";
import { createCodexDirectorBridge } from "./src/services/codex-director-bridge.js";
import { runMultiImageMakerRequest } from "./src/services/image-maker-multi-runner.js";
import { createComposerPresetCatalog } from "./src/services/preset-catalog-v2.js";
import { compileScenePlanV2Shot } from "./src/services/preset-composer-v2.js";
import { createDefaultPreset, createCharacterPart } from "./src/state/preset-schema.js";
import { validateImageMakerMultiRequest } from "./src/state/image-maker-multi-request.js";

const ids = {
  base: "preset_v321_migration",
  male: "character_v321_male",
  femaleOutfit: "outfit_v321_female",
};

test("A — v3.2.1 catalog assets resolve for Image Maker selectors", async () => {
  const fixture = await createFixture();
  try {
    const assets = await createComposerPresetCatalog({ rootDir: fixture.root }).resolveSelections(fixture.plan.presetSelections);
    assert.equal(assets.basePreset.metadata.id, ids.base);
    assert.equal(assets.characterPresets[0].category, "남성 캐릭터");
    assert.equal(assets.outfitPresets[0].category, "여성 의상");
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("B — cross-gender Outfit passes while selector type mismatch remains blocked", async () => {
  const fixture = await createFixture();
  const catalog = createComposerPresetCatalog({ rootDir: fixture.root });
  try {
    const assets = await catalog.resolveSelections(fixture.plan.presetSelections);
    assert.equal(assets.outfitPresets[0].id, ids.femaleOutfit);
    await assert.rejects(
      catalog.resolveSelections({ ...fixture.plan.presetSelections, outfitPresetIds: [ids.male] }),
      (error) => error.code === "preset-category-mismatch",
    );
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("C — actor coordinates retain 0.001 precision in the v3.2.1 V5 payload", async () => {
  const fixture = await createFixture();
  try {
    const assets = await createComposerPresetCatalog({ rootDir: fixture.root }).resolveSelections(fixture.plan.presetSelections);
    const prepared = compileScenePlanV2Shot(fixture.plan, assets, { positionPolicy: "same" });
    assert.equal(prepared.payload.parameters.use_coords, true);
    assert.deepEqual(prepared.payload.parameters.characterPrompts[1].center, { x: 0.301, y: 0.557 });
    assert.deepEqual(prepared.payload.parameters.characterPrompts[2].center, { x: 0.301, y: 0.557 });

    const thirtyTwo = structuredClone(fixture.basePreset);
    thirtyTwo.prompt_parts.characters = Array.from({ length: 32 }, (_, index) => createCharacterPart({
      id: `slot_${index + 1}`, name: `Slot ${index + 1}`, prompt: "camera framing",
      centers: [{ x: Number(((index + 1) / 33).toFixed(3)), y: 0.5 }], position_mode: "custom",
    }));
    assert.equal(validateV5Payload(buildV5GeneratePayload(thirtyTwo)).ok, true);
    thirtyTwo.prompt_parts.characters.push(createCharacterPart({ id: "slot_33", name: "Slot 33", prompt: "extra" }));
    const cappedPayload = buildV5GeneratePayload(thirtyTwo);
    assert.equal(cappedPayload.parameters.characterPrompts.length, 32);
    assert.equal(validateV5Payload(cappedPayload).ok, true);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("D — the ported Codex Bridge returns a valid scene-plan/v2", async () => {
  const fixture = await createFixture();
  const invoke = async ({ args }) => args[0] === "--version"
    ? { stdout: "codex-cli migration-test" }
    : args[0] === "login"
      ? { stdout: "Logged in using ChatGPT" }
      : { finalMessage: JSON.stringify(fixture.plan) };
  try {
    const bridge = createCodexDirectorBridge({
      dataRoot: fixture.root,
      presetStore: { getPreset: async () => fixture.basePreset },
      characterPresetStore: { getCharacterPreset: async (id) => id === ids.male ? fixture.character : fixture.outfit },
      invoke,
    });
    const result = await bridge.createPlan({ request: fixture.request, operationId: "migration_bridge_321" });
    assert.equal(result.plan.schema, "chaessi-scene-plan/v2");
    assert.equal(result.plan.shots.length, 2);
    assert.equal(result.client.authentication, "chatgpt");
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("E — two-shot editorial preflight is ready and makes no generation request", async () => {
  const fixture = await createFixture();
  let calls = 0;
  try {
    const output = await runMultiImageMakerRequest({
      request: fixture.request,
      directorPlan: fixture.plan,
      dataRoot: fixture.root,
      dryRun: true,
      runId: "migration_editorial_321",
      fetchFn: async () => { calls += 1; throw new Error("dry-run network call"); },
    });
    assert.equal(output.status, "ready");
    assert.equal(output.manifest.preparedCount, 2);
    assert.equal(calls, 0);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("F — v3.3.1 Workshop, History, Position Pad, and Image Maker wiring coexist", async () => {
  const [pkg, html, app, server, electron] = await Promise.all([
    readJson("package.json"), readText("index.html"), readText("src/app.js"),
    readText("server.mjs"), readText("electron/server-process.mjs"),
  ]);
  assert.equal(pkg.version, "3.3.1");
  for (const marker of ["presetWorkspace", "imageMakerWorkspace", "characterPositionPad", "historyBulkDeleteDialog", "imageViewerPreviousButton"]) {
    assert.match(html, new RegExp(`id=[\"']${marker}[\"']`));
  }
  for (const marker of ["createCharacterPositionPad", "createHistorySelectionController", "getHistoryNavigation", "createImageMakerController"]) {
    assert.ok(app.includes(marker), marker);
  }
  for (const marker of ["/api/novelai/generate", "/api/generations/delete-batch", "/api/image-maker/preflight", "NOVELAI_V5_FULL_INPAINT_MODEL"]) {
    assert.ok(server.includes(marker), marker);
  }
  assert.ok(electron.includes("loadProviderToken(\"novelai\")"));
  assert.ok(electron.includes("CHAESSI_CODEX_EXECUTABLE"));
});

test("single-count UI orchestration remains a valid v2 request for one-cost E2E", async () => {
  const fixture = await createFixture();
  try {
    const one = { ...fixture.request, count: 1 };
    assert.equal(validateImageMakerMultiRequest(one).ok, true);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("structured API details remain inspectable without replacing the public error message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ ok: false, error: { code: "PORT_TEST", message: "Readable failure", details: { field: "count" } } }),
  });
  try {
    await assert.rejects(() => getJson("/fixture"), (error) => (
      error.message === "Readable failure" && error.code === "PORT_TEST" && error.details.field === "count"
    ));
  } finally { globalThis.fetch = originalFetch; }
});

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-v321-port-"));
  const basePreset = createDefaultPreset({
    metadata: { id: ids.base, name: "v3.2.1 migration base" },
    prompt_parts: { base: "clean editorial style", undesired: "low quality", characters: [] },
    params: { model: "nai-diffusion-5-full", seed: 321001, n_samples: 1 },
  });
  const character = component(ids.male, "남성 캐릭터", "boy, adult man, black hair");
  const outfit = component(ids.femaleOutfit, "여성 의상", "pleated skirt, ribbon blouse");
  await writeJson(path.join(root, "data", "presets", ids.base, "preset.json"), basePreset);
  await writeJson(path.join(root, "data", "character-presets", ids.male, "character-preset.json"), character);
  await writeJson(path.join(root, "data", "character-presets", ids.femaleOutfit, "character-preset.json"), outfit);
  const request = {
    schema: "chaessi-image-request/v2", request: "한 명의 남성이 리본 블라우스와 주름치마를 입은 편집 화보",
    count: 2, mode: "editorial",
    presets: { basePresetId: ids.base, characterPresetId: ids.male, outfitPresetId: ids.femaleOutfit, stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null },
    generation: { model: "nai-diffusion-5-full", baseSeed: 321001 },
  };
  const plan = makePlan(request);
  return { root, basePreset, character, outfit, request, plan };
}

function makePlan(request) {
  const positions = [{ x: 0.301, y: 0.557 }, { x: 0.701, y: 0.557 }];
  return {
    schema: "chaessi-scene-plan/v2", request: request.request, mode: request.mode, count: request.count,
    presetSelections: { basePresetId: ids.base, characterPresetIds: [ids.male], outfitPresetIds: [ids.femaleOutfit], stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null },
    continuity: { characterIdentity: "locked", outfit: "locked", location: "locked", props: "free", screenDirection: "free" },
    shots: positions.map((position, index) => ({
      id: `shot_${String(index + 1).padStart(3, "0")}`, index: index + 1,
      intent: index ? "close editorial portrait" : "wide editorial introduction", rhythmRole: index ? "portrait" : "establishing",
      direction: {
        shotSize: index ? "close-up" : "wide", cameraHeight: "eye level", cameraAngle: index ? "profile angle" : "front three-quarter angle",
        viewpoint: "studio floor", bodyOrientation: index ? "profile" : "front three-quarter", pose: index ? "seated pose" : "standing pose",
        action: index ? "adjusting one sleeve" : "holding a calm pose", gaze: index ? "looking aside" : "looking toward viewer",
        expression: index ? "reserved smile" : "calm expression", subjectPlacement: index ? "right third" : "left third",
        depth: "clean studio depth", lighting: "soft studio light", visibilityRequirements: ["face and selected outfit remain visible"],
      },
      continuity: { location: "editorial studio", outfitState: "fully worn", props: [], screenDirection: "stable", carriesFrom: null },
      generation: {
        mainPrompt: "1boy, solo, editorial studio", supplement: "One adult man poses alone in a clean studio.",
        characters: [{ characterPresetId: ids.male, visibleFeaturesPrompt: "black hair", scenePrompt: `${index ? "seated" : "standing"}, calm expression`, undesiredPrompt: "", position }],
        undesiredPrompt: "extra people, background characters", seed: 321001 + index,
      },
    })),
  };
}

function component(id, category, prompt) {
  return { schema: "chaessi-character-preset/v1", id, name: id, category, subCategory: "", enabled: true, prompt, undesired: "", centers: [{ x: 0.5, y: 0.5 }] };
}
async function writeJson(file, value) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); }
async function readText(file) { return readFile(new URL(file, import.meta.url), "utf8"); }
async function readJson(file) { return JSON.parse(await readText(file)); }
