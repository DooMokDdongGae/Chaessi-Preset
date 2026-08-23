import assert from "node:assert/strict";
import { encode } from "@msgpack/msgpack";
import { buildV5GeneratePayload } from "./src/adapters/novelai-v5-full.js";
import { extractFinalNovelAiPng } from "./src/services/novelai-msgpack-stream.js";
import { createDefaultPreset } from "./src/state/preset-schema.js";
import { NOVELAI_V5_FULL_MODEL } from "./src/state/model-profiles.js";

const HEAVY = "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page";
const base = "1girl, solo, blue hair, green eyes, white shirt, standing, simple background";
const preset = createDefaultPreset({
  prompt_parts: { base, undesired: "lowres, blurry,", characters: [] },
  params: { model: NOVELAI_V5_FULL_MODEL, width: 832, height: 1216, scale: 5, sampler: "k_euler_ancestral", steps: 23, n_samples: 1, seed: 424242424, qualityPreset: "standard", ucPreset: 0, cfg_rescale: 0 },
});
const payload = buildV5GeneratePayload(preset);
const positive = `${base}, very aesthetic, masterpiece, no text`;
const negative = `nsfw, ${HEAVY}, lowres, blurry,`;

assert.deepEqual(payload, {
  input: positive,
  model: "nai-diffusion-5-full",
  action: "generate",
  parameters: {
    params_version: 4, width: 832, height: 1216, n_samples: 1, seed: 424242424,
    sampler: "k_euler_ancestral", steps: 23, scale: 5,
    ucPresetId: "heavy", qualityPresetId: "standard", autoSmea: false,
    dynamic_thresholding: false, controlnet_strength: 1, legacy: false,
    add_original_image: true, cfg_rescale: 0, legacy_v3_extend: false,
    use_coords: false, legacy_uc: false, normalize_reference_strength_multiple: true,
    inpaintImg2ImgStrength: 1, straight_alpha: true, tag_hint_qt: 1,
    tag_hint_uc_preset: 2, characterPrompts: [],
    v4_prompt: { caption: { base_caption: positive, char_captions: [] }, use_coords: false, use_order: true },
    v4_negative_prompt: { caption: { base_caption: negative, char_captions: [] }, legacy_uc: false },
    negative_prompt: negative, deliberate_euler_ancestral_bug: false,
    prefer_brownian: true, noise_schedule: "karras", image_format: "png", stream: "msgpack",
  },
  use_new_shared_trial: true,
});
assert.equal(Object.hasOwn(payload.parameters, "extra_noise_seed"), false);
assert.equal(Object.hasOwn(payload.parameters, "tag_hint_transparent_background"), false);
assert.equal(Object.hasOwn(payload.parameters, "qualityToggle"), false);
assert.equal(Object.hasOwn(payload.parameters, "ucPreset"), false);
assert.equal(Object.hasOwn(payload.parameters, "sm"), false);

const characters = [
  { id: "c1", name: "Blue", enabled: true, prompt: "girl, blue hair", undesired: "red hair", centers: [{ x: 0.309, y: 0.508 }], position_mode: "custom" },
  { id: "c2", name: "Red", enabled: true, prompt: "girl, red hair", undesired: "blue hair", centers: [{ x: 0.741, y: 0.512 }], position_mode: "custom" },
];
const characterPayload = buildV5GeneratePayload(createDefaultPreset({
  prompt_parts: { base: "2girls", undesired: "lowres", characters },
  params: { model: NOVELAI_V5_FULL_MODEL, qualityPreset: "none", ucPreset: 4, seed: 1 },
}));
assert.equal(characterPayload.parameters.use_coords, true);
assert.deepEqual(characterPayload.parameters.characterPrompts, [
  { prompt: "girl, blue hair", uc: "red hair", center: { x: 0.309, y: 0.508 }, enabled: true },
  { prompt: "girl, red hair", uc: "blue hair", center: { x: 0.741, y: 0.512 }, enabled: true },
]);
assert.deepEqual(
  characterPayload.parameters.v4_positive_prompt,
  undefined,
);
assert.deepEqual(
  characterPayload.parameters.v4_prompt.caption.char_captions.map((item) => item.centers[0]),
  characterPayload.parameters.v4_negative_prompt.caption.char_captions.map((item) => item.centers[0]),
);

const transparentPayload = buildV5GeneratePayload(createDefaultPreset({
  prompt_parts: { base: "1girl", undesired: "", characters: [] },
  params: { model: NOVELAI_V5_FULL_MODEL, qualityPreset: "none", ucPreset: 4, transparentBackground: true },
}));
assert.equal(transparentPayload.input, "1girl, transparent background");
assert.equal(transparentPayload.parameters.tag_hint_transparent_background, true);
assert.equal(transparentPayload.parameters.straight_alpha, true);

const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.from("fixture")]);
const stream = Buffer.concat([
  frame({ event_type: "intermediate", step_ix: 1, sigma: 1.5, image: new Uint8Array([1, 2]) }),
  frame({ event_type: "final", image: new Uint8Array(png) }),
]);
const decoded = extractFinalNovelAiPng(stream);
assert.deepEqual(decoded.imageBytes, png);
assert.equal(decoded.events.length, 2);
assert.equal(decoded.intermediateCount, 1);

assert.throws(() => extractFinalNovelAiPng(Buffer.concat([frame({ event_type: "error", message: "fixture failure" })])), /fixture failure/);
assert.throws(() => extractFinalNovelAiPng(stream.subarray(0, stream.length - 1)), /ended inside/);

console.log("Official V5 request fixture and length-prefixed msgpack stream tests passed.");

function frame(value) {
  const body = Buffer.from(encode(value));
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length);
  return Buffer.concat([header, body]);
}
