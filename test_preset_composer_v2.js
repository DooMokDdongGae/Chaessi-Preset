import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDefaultPreset } from "./src/state/preset-schema.js";
import { createDanbooruTagResolver } from "./src/services/danbooru-tag-resolver.js";
import { createComposerPresetCatalog } from "./src/services/preset-catalog-v2.js";
import { compileScenePlanV2Shot } from "./src/services/preset-composer-v2.js";

const ids = {
  base: "preset_base_v5", alice: "character_alice", beth: "character_beth", dan: "character_dan",
  aliceOutfit: "character_alice_outfit", bethOutfit: "character_beth_outfit", danOutfit: "character_dan_outfit",
  style: "character_style", quality: "character_quality", camera: "character_camera", lighting: "character_lighting",
};

const resolver = createDanbooruTagResolver({
  tagMap: new Map([
    tag("standing", "action"), tag("sitting", "action"), tag("hug", "action"),
    tag("looking_at_viewer", "camera"), tag("soft_smile", "expression"),
    tag("skirt_lift", "action"), tag("skirt", "attire"),
  ]),
  aliasMap: new Map([["카메라를 바라봄", new Set(["looking_at_viewer"])]]),
  requirements: new Map([["skirt_lift", ["skirt"]]]),
});

test("Test A — one girl uses subject only in Base and Anchor", () => {
  const plan = makePlan({
    actors: [{ id: ids.alice, scene: "1girl, girl, standing, 카메라를 바라봄, soft smile, left side" }],
    characterIds: [ids.alice], outfitIds: [ids.aliceOutfit],
    styleId: ids.style, qualityId: ids.quality, cameraId: ids.camera, lightingId: ids.lighting,
    mainPrompt: "2girls, hotel lobby, rain-streaked window",
  });
  const result = compileScenePlanV2Shot(plan, makeAssets({ allComponents: true }), { tagResolver: resolver });
  const actor = result.semanticSlots.actors[0];
  assert.equal(result.subjectCount, "1girl");
  assert.match(result.resolvedPreset.prompt_parts.base, /^1girl,/);
  assert.deepEqual(subjectTokens(result.semanticSlots.director.prompt), []);
  assert.deepEqual(subjectTokens(actor.anchorSlot.prompt), ["girl"]);
  assert.deepEqual(subjectTokens(actor.modifierSlot.prompt), []);
  assert.match(actor.modifierSlot.prompt, /standing, looking_at_viewer, soft_smile/);
  assert.equal(result.validation.subjectMapping.actorCount, 1);
  assert.equal(result.validation.payload.ok, true);
});

test("Test B — two girls are counted as actors rather than five NAI slots", () => {
  const plan = makePlan({
    actors: [
      { id: ids.alice, scene: "standing, soft smile, left side" },
      { id: ids.beth, scene: "sitting, serious expression, right side" },
    ],
    characterIds: [ids.alice, ids.beth], outfitIds: [ids.aliceOutfit, ids.bethOutfit],
    mainPrompt: "1girl, cafe interior, window light",
  });
  const result = compileScenePlanV2Shot(plan, makeAssets({ secondGirl: true }), { tagResolver: resolver });
  assert.equal(result.subjectCount, "2girls");
  assert.equal(result.validation.subjectMapping.actorCount, 2);
  assert.equal(result.resolvedPreset.prompt_parts.characters.length, 5);
  assert.deepEqual(result.naiSlotMap.map((item) => item.semanticRole), [
    "director", "actor-1-anchor", "actor-1-modifier", "actor-2-anchor", "actor-2-modifier",
  ]);
  result.semanticSlots.actors.forEach((actor) => {
    assert.deepEqual(subjectTokens(actor.anchorSlot.prompt), ["girl"]);
    assert.deepEqual(subjectTokens(actor.modifierSlot.prompt), []);
  });
});

test("Test C — girl plus boy compiles 1girl, 1boy with Anchor-only subjects", () => {
  const plan = makePlan({
    actors: [
      { id: ids.alice, scene: "standing, left side" },
      { id: ids.dan, scene: "standing, right side" },
    ],
    characterIds: [ids.alice, ids.dan], outfitIds: [ids.aliceOutfit, ids.danOutfit],
  });
  const result = compileScenePlanV2Shot(plan, makeAssets({ mixedActors: true }), { tagResolver: resolver });
  assert.equal(result.subjectCount, "1girl, 1boy");
  assert.deepEqual(subjectTokens(result.semanticSlots.actors[0].anchorSlot.prompt), ["girl"]);
  assert.deepEqual(subjectTokens(result.semanticSlots.actors[1].anchorSlot.prompt), ["boy"]);
  assert.deepEqual(subjectTokens(result.semanticSlots.actors[0].modifierSlot.prompt), []);
  assert.deepEqual(subjectTokens(result.semanticSlots.actors[1].modifierSlot.prompt), []);
});

test("Test D — implicit extra actor is warned or safely rewritten", () => {
  const plan = makePlan({
    actors: [{ id: ids.alice, scene: "standing, left side" }],
    characterIds: [ids.alice], outfitIds: [ids.aliceOutfit],
    supplement: "An adult woman is welcoming an arriving guest at reception.",
  });
  const warning = compileScenePlanV2Shot(plan, makeAssets({}), { tagResolver: resolver, rewriteSafeImplicitActors: false });
  assert.equal(warning.validation.semanticGuard.issues[0].type, "implicit-extra-actor");
  assert.equal(warning.validation.semanticGuard.issues[0].resolution, "warning");
  const rewritten = compileScenePlanV2Shot(plan, makeAssets({}), { tagResolver: resolver });
  assert.equal(rewritten.validation.semanticGuard.issues[0].resolution, "safe-rewrite");
  assert.doesNotMatch(rewritten.resolvedPreset.prompt_parts.base, /arriving guest/i);
  assert.match(rewritten.resolvedPreset.prompt_parts.base, /professional welcoming pose/i);
});

test("Test E — declared girl and boy cover an explicit male guest relation", () => {
  const plan = makePlan({
    actors: [
      { id: ids.alice, scene: "left side, standing, source#hug" },
      { id: ids.dan, scene: "right side, standing, target#hug" },
    ],
    characterIds: [ids.alice, ids.dan], outfitIds: [ids.aliceOutfit, ids.danOutfit],
    supplement: "The woman welcomes the male guest and they hug near reception.",
  });
  const result = compileScenePlanV2Shot(plan, makeAssets({ mixedActors: true }), { tagResolver: resolver });
  assert.equal(result.validation.semanticGuard.issues.length, 0);
  assert.equal(result.validation.interactions.ok, true);
});

test("Test F — Anchor-only, same and near-same position payloads are recorded", () => {
  const plan = makePlan({
    actors: [
      { id: ids.alice, scene: "standing, left side", position: { x: 0.3, y: 0.55 } },
      { id: ids.beth, scene: "standing, right side", position: { x: 0.7, y: 0.55 } },
    ],
    characterIds: [ids.alice, ids.beth], outfitIds: [ids.aliceOutfit, ids.bethOutfit],
  });
  const assets = makeAssets({ secondGirl: true });
  const anchorOnly = compileScenePlanV2Shot(plan, assets, { tagResolver: resolver, positionPolicy: "anchor-only" });
  const same = compileScenePlanV2Shot(plan, assets, { tagResolver: resolver, positionPolicy: "same" });
  const near = compileScenePlanV2Shot(plan, assets, { tagResolver: resolver, positionPolicy: "near-same" });
  assert.equal(anchorOnly.payload.parameters.use_coords, false);
  assert.equal(same.payload.parameters.use_coords, true);
  assert.deepEqual(same.semanticSlots.actors[0].anchorSlot.centers, same.semanticSlots.actors[0].modifierSlot.centers);
  assert.equal(near.payload.parameters.use_coords, true);
  assert.equal(near.semanticSlots.actors[0].modifierSlot.centers[0].x, 0.305);
  assert.equal(same.validation.positions.ok, true);
});

test("position and natural-language left/right conflicts are rejected", () => {
  const plan = makePlan({
    actors: [{ id: ids.alice, scene: "standing on the left", position: { x: 0.8, y: 0.5 } }],
    characterIds: [ids.alice], outfitIds: [ids.aliceOutfit],
  });
  assert.throws(() => compileScenePlanV2Shot(plan, makeAssets({}), { tagResolver: resolver }),
    (error) => error.code === "position-order-conflict");
});

test("position audit ignores hand and body-orientation directions", () => {
  const plan = makePlan({
    actors: [{
      id: ids.alice,
      scene: "standing slightly left of center, body turned toward screen right, right fingertips resting on the page edge",
      position: { x: 0.42, y: 0.5 },
    }],
    characterIds: [ids.alice], outfitIds: [ids.aliceOutfit],
  });
  const result = compileScenePlanV2Shot(plan, makeAssets({}), { tagResolver: resolver });
  assert.equal(result.validation.positions.ok, true);
});

test("ambiguous or unknown tag intent remains natural language", () => {
  const exact = resolver.resolve("카메라를 바라봄", { category: "camera" });
  const fallback = resolver.resolve("resting one shoulder lightly against the window frame", { category: "action" });
  assert.equal(exact.resolution, "high");
  assert.equal(exact.tag, "looking_at_viewer");
  assert.equal(fallback.resolution, "natural-language");
});

test("requiring conflict is returned instead of inventing a replacement action", () => {
  const plan = makePlan({ actors: [{ id: ids.alice, scene: "skirt_lift, left side" }], characterIds: [ids.alice], outfitIds: [ids.aliceOutfit] });
  assert.throws(() => compileScenePlanV2Shot(plan, makeAssets({}), { tagResolver: resolver }),
    (error) => error.code === "requirement-conflict" && error.details.conflicts[0].missing.includes("skirt"));
});

test("catalog validates existence, enabled state and category before compilation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-composer-v2-"));
  await writeJson(path.join(root, "data", "presets", ids.base, "preset.json"), makeAssets({}).basePreset);
  await writeJson(path.join(root, "data", "character-presets", ids.alice, "character-preset.json"), component(ids.alice, "여성 캐릭터", "girl, alice identity"));
  await writeJson(path.join(root, "data", "character-presets", ids.aliceOutfit, "character-preset.json"), component(ids.aliceOutfit, "여성 의상", "red dress"));
  const catalog = createComposerPresetCatalog({ rootDir: root });
  const loaded = await catalog.resolveSelections(selections({ characterIds: [ids.alice], outfitIds: [ids.aliceOutfit] }));
  assert.equal(loaded.characterPresets[0].category, "여성 캐릭터");
  await assert.rejects(catalog.resolveSelections(selections({ characterIds: [ids.aliceOutfit], outfitIds: [] })),
    (error) => error.code === "preset-category-mismatch");
});

test("Character subject and Outfit gender classification are independent while preset types remain strict", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-outfit-independence-"));
  const femaleCharacter = "character_female_subject";
  const maleCharacter = "character_male_subject";
  const femaleOutfit = "outfit_female_classified";
  const maleOutfit = "outfit_male_classified";
  await writeJson(path.join(root, "data", "presets", ids.base, "preset.json"), makeAssets({}).basePreset);
  await Promise.all([
    writeJson(path.join(root, "data", "character-presets", femaleCharacter, "character-preset.json"), component(femaleCharacter, "여성 캐릭터", "girl, female identity")),
    writeJson(path.join(root, "data", "character-presets", maleCharacter, "character-preset.json"), component(maleCharacter, "남성 캐릭터", "boy, male identity")),
    writeJson(path.join(root, "data", "character-presets", femaleOutfit, "character-preset.json"), component(femaleOutfit, "여성 의상", "pleated skirt, ribbon blouse")),
    writeJson(path.join(root, "data", "character-presets", maleOutfit, "character-preset.json"), component(maleOutfit, "남성 의상", "tailored men's suit")),
  ]);
  const catalog = createComposerPresetCatalog({ rootDir: root });
  const combinations = [
    [femaleCharacter, femaleOutfit],
    [femaleCharacter, maleOutfit],
    [maleCharacter, maleOutfit],
    [maleCharacter, femaleOutfit],
  ];
  for (const [characterId, outfitId] of combinations) {
    const loaded = await catalog.resolveSelections(selections({ characterIds: [characterId], outfitIds: [outfitId] }));
    assert.equal(loaded.characterPresets[0].id, characterId);
    assert.equal(loaded.outfitPresets[0].id, outfitId);
    const compiled = compileScenePlanV2Shot(makePlan({
      actors: [{ id: characterId, scene: "standing calmly" }],
      characterIds: [characterId], outfitIds: [outfitId],
    }), loaded, { tagResolver: resolver });
    const expectedSubject = characterId === femaleCharacter ? "1girl" : "1boy";
    assert.equal(compiled.subjectCount, expectedSubject);
    assert.match(compiled.semanticSlots.actors[0].modifierSlot.prompt, outfitId === femaleOutfit ? /pleated skirt/ : /men's suit/);
    assert.equal(compiled.validation.semanticGuard.issues.length, 0);
  }
  await assert.rejects(
    catalog.resolveSelections(selections({ characterIds: [femaleCharacter], outfitIds: [maleCharacter] })),
    (error) => error.code === "preset-category-mismatch",
  );
});

function makeAssets({ secondGirl = false, mixedActors = false, allComponents = false } = {}) {
  const basePreset = createDefaultPreset({
    metadata: { id: ids.base, name: "Fixture V5" },
    prompt_parts: { base: "base style that is replaced, 1girl", undesired: "base bad", characters: [] },
    params: { model: "nai-diffusion-5-full", seed: 12345, n_samples: 1 },
  });
  const assets = {
    basePreset,
    characterPresets: [component(ids.alice, "여성 캐릭터", "1girl, girl, alice face, brown hair", "wrong alice face")],
    outfitPresets: [component(ids.aliceOutfit, "여성 의상", "girl, red dress, pants")],
    stylePreset: null, qualityPreset: null, cameraPreset: null, lightingPreset: null,
  };
  if (secondGirl) {
    assets.characterPresets.push(component(ids.beth, "여성 캐릭터", "girl, beth face, blonde hair", "wrong beth face"));
    assets.outfitPresets.push(component(ids.bethOutfit, "여성 의상", "1girl, blue coat"));
  }
  if (mixedActors) {
    assets.characterPresets.push(component(ids.dan, "남성 캐릭터", "1boy, boy, dan face, black hair", "wrong dan face"));
    assets.outfitPresets.push(component(ids.danOutfit, "남성 의상", "boy, navy suit"));
  }
  if (allComponents) {
    assets.stylePreset = component(ids.style, "그림체", "fixture style", "style bad");
    assets.qualityPreset = component(ids.quality, "품질", "amazing quality", "low quality");
    assets.cameraPreset = component(ids.camera, "구도·카메라", "1girl, girl, cinematic framing");
    assets.lightingPreset = component(ids.lighting, "조명", "warm rim light");
  }
  return assets;
}

function makePlan({ actors, characterIds, outfitIds, styleId = null, qualityId = null, cameraId = null, lightingId = null, mainPrompt = "1girl, lobby", supplement = "The declared actors remain clearly separated in the frame." }) {
  return {
    schema: "chaessi-scene-plan/v2", request: "fixture", mode: "single", count: 1,
    presetSelections: selections({ characterIds, outfitIds, styleId, qualityId, cameraId, lightingId }),
    continuity: { characterIdentity: "locked", outfit: "locked", location: "locked", props: "free", screenDirection: "free" },
    shots: [{
      id: "shot_001", index: 1, intent: "compile fixture", rhythmRole: "hero",
      direction: {
        shotSize: "medium", cameraHeight: "eye level", cameraAngle: "three-quarter angle", viewpoint: "from the entrance",
        bodyOrientation: "front three-quarter", pose: "standing", action: "posing", gaze: "looking ahead",
        expression: "calm expression", subjectPlacement: "balanced placement", depth: "actors in foreground and room behind",
        lighting: "warm ambient light", visibilityRequirements: ["faces and outfits remain visible"],
      },
      continuity: { location: "lobby", outfitState: "fully worn", props: [], screenDirection: "toward center", carriesFrom: null },
      generation: {
        mainPrompt, supplement,
        characters: actors.map((actor) => ({
          characterPresetId: actor.id, visibleFeaturesPrompt: "", scenePrompt: actor.scene, undesiredPrompt: "",
          ...(actor.position ? { position: actor.position } : {}),
        })),
        undesiredPrompt: "", seed: 12345,
      },
    }],
  };
}

function selections({ characterIds, outfitIds, styleId = null, qualityId = null, cameraId = null, lightingId = null }) {
  return { basePresetId: ids.base, characterPresetIds: characterIds, outfitPresetIds: outfitIds,
    stylePresetId: styleId, qualityPresetId: qualityId, cameraPresetId: cameraId, lightingPresetId: lightingId };
}

function subjectTokens(text) {
  return String(text).split(",").map((part) => part.trim().toLowerCase()).filter((part) => /^(?:girl|boy|\d+(?:girl|girls|boy|boys))$/.test(part));
}
function component(id, category, prompt, undesired = "") {
  return { schema: "chaessi-character-preset/v1", id, name: id, category, subCategory: "", enabled: true, prompt, undesired, centers: [{ x: 0.5, y: 0.5 }] };
}
function tag(name, category) { return [name, { name, sources: new Set(["classified"]), categories: new Set([category]), counts: { classified: 1 } }]; }
async function writeJson(file, value) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(value)); }
