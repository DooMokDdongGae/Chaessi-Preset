import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import {
  buildModeGeneratePayload,
  GENERATION_MODES,
  NOVELAI_V5_FULL_INPAINT_MODEL,
  validateModeGeneratePayload,
} from "./src/adapters/novelai-v45-generation-modes.js";
import {
  decodePngPixels,
  encodeRgbaPng,
  normalizePngToRgba,
  pngPixelsToAlpha,
} from "./src/services/generation-image-utils.js";
import { createNovelAiMultipartBody } from "./src/services/novelai-multipart-request.js";
import { createGenerationStore } from "./src/services/generation-store.js";
import { createInpaintGenerationMask } from "./src/services/inpaint-composite-utils.js";
import { createDefaultPreset } from "./src/state/preset-schema.js";
import { NOVELAI_V5_FULL_MODEL } from "./src/state/model-profiles.js";

const rgba = Buffer.from([
  255, 0, 0, 255,
  0, 255, 0, 128,
  0, 0, 255, 64,
  255, 255, 255, 0,
]);
const source = encodeRgbaPng(rgba, 2, 2);
const mask = encodeRgbaPng(Buffer.from([
  255, 255, 255, 255,
  0, 0, 0, 255,
  0, 0, 0, 255,
  255, 255, 255, 255,
]), 2, 2);
const normalizedSource = normalizePngToRgba(source);
assert.deepEqual([...pngPixelsToAlpha(decodePngPixels(normalizedSource))], [255, 128, 64, 0]);

const preset = createDefaultPreset({
  prompt_parts: {
    base: "1girl, solo",
    undesired: "lowres, blurry",
    characters: [{
      id: "c1",
      name: "Blue",
      enabled: true,
      prompt: "girl, blue hair",
      undesired: "red hair",
      centers: [{ x: 0.5, y: 0.5 }],
      position_mode: "custom",
    }],
  },
  params: {
    model: NOVELAI_V5_FULL_MODEL,
    width: 832,
    height: 1216,
    steps: 23,
    n_samples: 1,
    scale: 5,
    seed: 424242424,
    sampler: "k_euler_ancestral",
    cfg_rescale: 0.3,
    qualityPreset: "none",
    ucPreset: 4,
  },
});

const commonModeState = {
  width: 2,
  height: 2,
  source_image_base64: source.toString("base64"),
};
const i2i = buildModeGeneratePayload(preset, {
  ...commonModeState,
  mode: GENERATION_MODES.IMAGE_TO_IMAGE,
  strength: 0.4,
  noise: 0.2,
});
assert.equal(i2i.model, NOVELAI_V5_FULL_MODEL);
assert.equal(i2i.action, "img2img");
assert.equal(i2i.parameters.strength, 0.4);
assert.equal(i2i.parameters.noise, 0.2);
assert.equal(i2i.parameters.extra_noise_seed, 424242423);
assert.equal(i2i.parameters.color_correct, false);
assert.equal(i2i.parameters.params_version, 4);
assert.equal(i2i.parameters.straight_alpha, true);
assert.equal(i2i.parameters.characterPrompts.length, 1);
assert.equal(validateModeGeneratePayload(i2i, { mode: GENERATION_MODES.IMAGE_TO_IMAGE }).ok, true);

const infill = buildModeGeneratePayload(preset, {
  ...commonModeState,
  mode: GENERATION_MODES.INPAINT,
  mask_image_base64: mask.toString("base64"),
  strength: 1,
  i2i_strength: 0.7,
  i2i_noise: 0.2,
});
assert.equal(infill.model, NOVELAI_V5_FULL_INPAINT_MODEL);
assert.equal(infill.action, "infill");
assert.equal(infill.parameters.strength, 0.7);
assert.equal(infill.parameters.noise, 0.2);
assert.equal(infill.parameters.inpaintImg2ImgStrength, 1);
assert.equal(infill.parameters.add_original_image, false);
assert.equal(infill.parameters.request_type, "NativeInfillingRequest");
assert.equal(infill.parameters.extra_noise_seed, 424242423);
assert.equal(validateModeGeneratePayload(infill, { mode: GENERATION_MODES.INPAINT }).ok, true);

const wireI2i = structuredClone(i2i);
wireI2i.parameters.image = "image";
const i2iBody = createNovelAiMultipartBody(wireI2i, { image: normalizedSource });
assert.deepEqual([...i2iBody.keys()], ["image", "request"]);
const i2iImagePart = i2iBody.get("image");
assert.equal(i2iImagePart.type, "image/png");
assert.equal(i2iImagePart.name, "blob");
const i2iRequestPart = i2iBody.get("request");
assert.equal(i2iRequestPart.type, "application/json");
assert.equal(i2iRequestPart.name, "blob");
const i2iRequestJson = await i2iRequestPart.text();
assert.equal(i2iRequestJson.includes(source.toString("base64")), false);
assert.equal(JSON.parse(i2iRequestJson).parameters.image, "image");

const wireInfill = structuredClone(infill);
wireInfill.parameters.image = "image";
wireInfill.parameters.mask = "mask";
const infillBody = createNovelAiMultipartBody(wireInfill, { image: normalizedSource, mask });
assert.deepEqual([...infillBody.keys()], ["image", "mask", "request"]);
assert.equal(infillBody.get("mask").type, "image/png");
assert.equal(infillBody.get("mask").name, "blob");
const infillRequestJson = await infillBody.get("request").text();
assert.equal(infillRequestJson.includes(mask.toString("base64")), false);
assert.deepEqual(
  [JSON.parse(infillRequestJson).parameters.image, JSON.parse(infillRequestJson).parameters.mask],
  ["image", "mask"],
);

const rootDir = path.resolve(`.test-v5-generation-modes-${process.pid}`);
try {
  const generationMask = createInpaintGenerationMask(mask, 0);
  const storedWireInfill = structuredClone(wireInfill);
  const store = createGenerationStore({ rootDir });
  const saved = await store.saveGeneration({
    preset,
    payload: storedWireInfill,
    imageBytes: normalizedSource,
    responseInfo: {
      generation_id: "v5_inpaint_fixture",
      created_at: "2026-08-23T00:00:00.000Z",
      response_container: "msgpack",
      response_image_entry: "final.image",
      response_content_type: "application/msgpack",
    },
    mode: GENERATION_MODES.INPAINT,
    modeSettings: {
      strength: 1,
      noise: 0,
      add_original_image: false,
      generation_padding: 0,
      image_strength: 0.7,
      image_noise: 0.2,
      source_info: { file_name: "fixture.png" },
    },
    sourceAssets: {
      sourceBytes: normalizedSource,
      maskBytes: mask,
      generationMaskBytes: generationMask,
    },
  });
  assert.deepEqual(await readFile(path.join(rootDir, saved.image_path)), normalizedSource, "raw server result must be stored without compositing");
  const sidecar = JSON.parse(await readFile(path.join(rootDir, saved.sidecar_path), "utf8"));
  assert.match(sidecar.source_assets.source_image_filename, /\.source\.png$/);
  assert.match(sidecar.source_assets.mask_image_filename, /\.mask\.png$/);
  assert.match(sidecar.source_assets.generation_mask_image_filename, /\.generation-mask\.png$/);
  assert.equal(sidecar.generation.image_strength, 0.7);
  assert.equal(sidecar.generation.image_noise, 0.2);
  const storedPayload = JSON.parse(await readFile(path.join(rootDir, saved.payload_path), "utf8"));
  assert.equal(storedPayload.parameters.image.storage, "generation_asset");
  assert.equal(storedPayload.parameters.mask.storage, "generation_asset");
  assert.equal(JSON.stringify(storedPayload).includes(source.toString("base64")), false);
  await store.deleteGeneration(saved.id);
  assert.deepEqual(await readdir(path.dirname(path.join(rootDir, saved.image_path))), []);
} finally {
  await rm(rootDir, { recursive: true, force: true });
}

console.log("V5 I2I/Inpaint adapter, RGBA source, and multipart contract tests passed.");
