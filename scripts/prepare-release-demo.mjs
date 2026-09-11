import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDefaultPreset } from "../src/state/preset-schema.js";

const target = process.argv[2];
if (!target || !path.isAbsolute(target)) throw new Error("Usage: node scripts/prepare-release-demo.mjs <absolute-data-root>");
await rm(target, { recursive: true, force: true });

const ids = {
  base: "preset_release_demo_v5",
  character: "character_release_demo",
  outfit: "outfit_release_demo",
  style: "style_release_demo",
  quality: "quality_release_demo",
};

const base = createDefaultPreset({
  metadata: { id: ids.base, name: "V5 Portrait Base" },
  prompt_parts: { base: "masterpiece, clean editorial illustration", undesired: "low quality, blurry, extra people", characters: [] },
  params: { model: "nai-diffusion-5-full", width: 832, height: 1216, seed: 330001, n_samples: 1 },
});
await writeJson(path.join(target, "data", "presets", ids.base, "preset.json"), base);
await writeComponent(ids.character, "Sample Character", "여성 캐릭터", "girl, adult woman, short black hair, blue eyes");
await writeComponent(ids.outfit, "Tailored Navy Uniform", "남성 의상", "navy tailored jacket, white shirt, straight trousers, leather shoes");
await writeComponent(ids.style, "Clean Editorial", "그림체", "clean editorial illustration, soft color grading");
await writeComponent(ids.quality, "V5 Standard", "품질", "high detail, coherent composition");

const request = {
  schema: "chaessi-image-request/v2",
  request: "조용한 현대 미술관에서 큐레이터가 전시를 준비하는 세련된 화보",
  count: 3,
  mode: "editorial",
  presets: {
    basePresetId: ids.base,
    characterPresetId: ids.character,
    outfitPresetId: ids.outfit,
    stylePresetId: ids.style,
    qualityPresetId: ids.quality,
    cameraPresetId: null,
    lightingPresetId: null,
  },
  generation: { model: "nai-diffusion-5-full", baseSeed: 330001 },
};

const shotSpecs = [
  {
    intent: "넓은 전시장과 큐레이터를 함께 보여주는 도입 구도",
    role: "establishing",
    shotSize: "wide",
    cameraAngle: "front three-quarter",
    pose: "standing beside a framed artwork",
    action: "checking the exhibition layout",
    gaze: "looking across the gallery",
    expression: "calm concentration",
    placement: "left third",
    position: { x: 0.3, y: 0.56 },
  },
  {
    intent: "작품 캡션을 정리하는 손동작과 업무 집중도를 보여주는 중간 구도",
    role: "action",
    shotSize: "medium",
    cameraAngle: "side angle",
    pose: "leaning slightly toward a display label",
    action: "aligning the exhibition label",
    gaze: "looking at the label",
    expression: "focused expression",
    placement: "right third",
    position: { x: 0.7, y: 0.54 },
  },
  {
    intent: "준비를 마친 큐레이터의 차분한 표정을 강조하는 마무리 초상",
    role: "portrait",
    shotSize: "close-up",
    cameraAngle: "eye-level profile",
    pose: "relaxed upright pose",
    action: "pausing beside the completed display",
    gaze: "looking toward the nearest artwork",
    expression: "small satisfied smile",
    placement: "center",
    position: { x: 0.5, y: 0.48 },
  },
];

const plan = {
  schema: "chaessi-scene-plan/v2",
  request: request.request,
  mode: request.mode,
  count: request.count,
  presetSelections: {
    basePresetId: ids.base,
    characterPresetIds: [ids.character],
    outfitPresetIds: [ids.outfit],
    stylePresetId: ids.style,
    qualityPresetId: ids.quality,
    cameraPresetId: null,
    lightingPresetId: null,
  },
  continuity: { characterIdentity: "locked", outfit: "locked", location: "locked", props: "free", screenDirection: "free" },
  shots: shotSpecs.map((shot, index) => ({
    id: `shot_${String(index + 1).padStart(3, "0")}`,
    index: index + 1,
    intent: shot.intent,
    rhythmRole: shot.role,
    direction: {
      shotSize: shot.shotSize,
      cameraHeight: "eye level",
      cameraAngle: shot.cameraAngle,
      viewpoint: "gallery floor",
      bodyOrientation: shot.cameraAngle,
      pose: shot.pose,
      action: shot.action,
      gaze: shot.gaze,
      expression: shot.expression,
      subjectPlacement: shot.placement,
      depth: "layered gallery depth",
      lighting: "soft museum track lighting",
      visibilityRequirements: ["face", "selected outfit", "main action"],
    },
    continuity: { location: "modern art gallery", outfitState: "fully worn", props: [], screenDirection: "stable", carriesFrom: null },
    generation: {
      mainPrompt: "1girl, solo, modern art gallery, framed artwork, soft museum track lighting",
      supplement: "One curator works alone in a quiet exhibition space.",
      characters: [{
        characterPresetId: ids.character,
        visibleFeaturesPrompt: "short black hair, blue eyes",
        scenePrompt: `${shot.pose}, ${shot.action}, ${shot.gaze}, ${shot.expression}`,
        undesiredPrompt: "",
        position: shot.position,
      }],
      undesiredPrompt: "extra people, background characters",
      seed: 330001 + index,
    },
  })),
};

const runId = "release_demo_gallery";
const runDir = path.join(target, "data", "image-maker-runs", runId);
await writeJson(path.join(runDir, "request.json"), request);
await writeJson(path.join(runDir, "director-plan.json"), plan);
await writeJson(path.join(runDir, "multi-run-manifest.json"), {
  schema: "chaessi-image-maker-multi-run/v1",
  runId,
  mode: request.mode,
  requestedCount: request.count,
  preparedCount: request.count,
  completedCount: request.count,
  status: "completed",
  stage: "completed",
  startedAt: "2026-09-11T09:00:00.000Z",
  finishedAt: "2026-09-11T09:03:00.000Z",
  requiresSemanticReview: false,
  shots: plan.shots.map((shot, index) => ({
    shotId: shot.id,
    status: "completed",
    seed: 330001 + index,
    model: "nai-diffusion-5-full",
    width: 832,
    height: 1216,
    issues: [],
    generationId: `release-demo-${index + 1}`,
    generation: {
      imagePath: "assets/branding/chaessi-symbol.png",
      metadataPath: null,
      payloadPath: null,
    },
  })),
});

console.log(JSON.stringify({ target, request, plan, runId }, null, 2));

async function writeComponent(id, name, category, prompt) {
  await writeJson(path.join(target, "data", "character-presets", id, "character-preset.json"), {
    schema: "chaessi-character-preset/v1",
    id,
    name,
    category,
    subCategory: "",
    enabled: true,
    prompt,
    undesired: "",
    centers: [{ x: 0.5, y: 0.5 }],
  });
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
