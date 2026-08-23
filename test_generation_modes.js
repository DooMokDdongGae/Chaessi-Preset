import assert from "node:assert/strict";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

import { buildGeneratePayload, createDefaultPreset } from "./src/adapters/novelai-v45-full.js";
import {
  buildModeGeneratePayload,
  GENERATION_MODES,
  validateModeGeneratePayload,
} from "./src/adapters/novelai-v45-generation-modes.js";
import {
  assertMaskHasPaintedPixels,
  assertMatchingDimensions,
  decodeBase64Png,
  normalizePngToRgb,
} from "./src/services/generation-image-utils.js";
import { createGenerationStore } from "./src/services/generation-store.js";
import { createInpaintGenerationMask } from "./src/services/inpaint-composite-utils.js";
import { resolvePresetRandomPrompts } from "./src/services/prompt-random-resolver.js";

const rootDir = path.resolve(`.test-generation-modes-${process.pid}`);

try {
  const preset = createDefaultPreset({
    name: "Generation mode test",
    params: {
      seed: 123456789,
      extra_noise_seed: 123456789,
    },
    prompt_parts: {
      base: "||red|blue|| flower",
      undesired: "||blurry|text||",
      characters: [],
    },
  });
  const originalPreset = structuredClone(preset);
  const resolvedPreset = resolvePresetRandomPrompts(preset);
  assert.deepEqual(preset, originalPreset, "random resolution must not mutate the preset");
  assert.equal(JSON.stringify(resolvedPreset).includes("||"), false);

  const sourceBytes = createRgbPng(64, 64, (x, y) => [x * 3, y * 3, 120]);
  const maskBytes = createRgbPng(64, 64, (x, y) => {
    const painted = x >= 16 && x < 48 && y >= 16 && y < 48;
    return painted ? [255, 255, 255] : [0, 0, 0];
  });
  const sourceBase64 = sourceBytes.toString("base64");
  const maskBase64 = maskBytes.toString("base64");

  const textPayload = buildModeGeneratePayload(resolvedPreset, { mode: GENERATION_MODES.TEXT_TO_IMAGE });
  assert.deepEqual(textPayload, buildGeneratePayload(resolvedPreset));
  assert.equal(textPayload.parameters.image, undefined);
  assert.equal(textPayload.parameters.mask, undefined);

  const imagePayload = buildModeGeneratePayload(resolvedPreset, {
    mode: GENERATION_MODES.IMAGE_TO_IMAGE,
    width: 64,
    height: 64,
    source_image_base64: sourceBase64,
    strength: 0.7,
    noise: 0.05,
  });
  assert.equal(imagePayload.action, "img2img");
  assert.equal(imagePayload.parameters.strength, 0.7);
  assert.equal(imagePayload.parameters.noise, 0.05);
  assert.equal(validateModeGeneratePayload(imagePayload, { mode: GENERATION_MODES.IMAGE_TO_IMAGE }).ok, true);

  const inpaintPayload = buildModeGeneratePayload(resolvedPreset, {
    mode: GENERATION_MODES.INPAINT,
    width: 64,
    height: 64,
    source_image_base64: sourceBase64,
    mask_image_base64: maskBase64,
    strength: 1,
    add_original_image: true,
  });
  assert.equal(inpaintPayload.action, "infill");
  assert.equal(inpaintPayload.model, "nai-diffusion-4-5-full-inpainting");
  assert.equal(inpaintPayload.parameters.request_type, "NativeInfillingRequest");
  assert.equal(inpaintPayload.parameters.add_original_image, false);
  assert.equal(validateModeGeneratePayload(inpaintPayload, { mode: GENERATION_MODES.INPAINT }).ok, true);

  const inpaintWithoutOriginal = buildModeGeneratePayload(resolvedPreset, {
    mode: GENERATION_MODES.INPAINT,
    width: 64,
    height: 64,
    source_image_base64: sourceBase64,
    mask_image_base64: maskBase64,
    strength: 1,
    add_original_image: false,
  });
  assert.equal(inpaintWithoutOriginal.parameters.add_original_image, false);

  const inpaintWithDefaultOriginalSetting = buildModeGeneratePayload(resolvedPreset, {
    mode: GENERATION_MODES.INPAINT,
    width: 64,
    height: 64,
    source_image_base64: sourceBase64,
    mask_image_base64: maskBase64,
    strength: 1,
  });
  assert.equal(inpaintWithDefaultOriginalSetting.parameters.add_original_image, false);

  const source = decodeBase64Png(sourceBase64, "source image");
  const mask = decodeBase64Png(maskBase64, "mask image");
  assertMaskHasPaintedPixels(mask.bytes);
  assertMatchingDimensions(source, mask, 64, 64);
  const normalizedSource = normalizePngToRgb(source.bytes);
  const normalizedMask = normalizePngToRgb(mask.bytes);
  const generationMaskBytes = createInpaintGenerationMask(normalizedMask, 16);

  const store = createGenerationStore({ rootDir });
  const saved = await store.saveGeneration({
    preset: resolvedPreset,
    payload: inpaintPayload,
    imageBytes: normalizedSource,
    responseInfo: {
      generation_id: "generation_mode_test",
      created_at: "2026-01-02T03:04:05.000Z",
      response_container: "zip",
      response_image_entry: "image_0.png",
      response_content_type: "application/zip",
    },
    mode: GENERATION_MODES.INPAINT,
    modeSettings: {
      strength: 1,
      noise: 0,
      add_original_image: false,
      generation_padding: 16,
      source_info: { file_name: "test.png" },
    },
    sourceAssets: {
      sourceBytes: normalizedSource,
      maskBytes: normalizedMask,
      generationMaskBytes,
    },
  });
  const storedPayload = JSON.parse(await readFile(path.join(rootDir, saved.payload_path), "utf8"));
  assert.equal(storedPayload.parameters.image.storage, "generation_asset");
  assert.equal(storedPayload.parameters.mask.storage, "generation_asset");
  assert.equal(storedPayload.parameters.mask.stored_as.endsWith(".generation-mask.png"), true);
  assert.equal(JSON.stringify(storedPayload).includes(sourceBase64), false);
  const storedSidecar = JSON.parse(await readFile(path.join(rootDir, saved.sidecar_path), "utf8"));
  assert.equal(storedSidecar.generation.add_original_image, false);
  assert.equal(Object.hasOwn(storedSidecar.generation, "feather"), false);
  assert.equal(storedSidecar.generation.generation_padding, 16);
  assert.equal(storedSidecar.source_assets.mask_image_filename.endsWith(".mask.png"), true);
  assert.equal(storedSidecar.source_assets.generation_mask_image_filename.endsWith(".generation-mask.png"), true);
  const storedSummary = (await store.listGenerations())[0];
  assert.equal(storedSummary.mode, GENERATION_MODES.INPAINT);
  assert.equal(storedSummary.add_original_image, false);
  assert.equal(storedSummary.feather, undefined);
  assert.equal(storedSummary.generation_padding, 16);

  storedSidecar.generation.feather = 50;
  await writeFile(path.join(rootDir, saved.sidecar_path), `${JSON.stringify(storedSidecar, null, 2)}\n`, "utf8");
  const legacySummary = (await store.listGenerations())[0];
  assert.equal(legacySummary.feather, 50, "existing History feather metadata must remain readable");

  await store.deleteGeneration(saved.id);
  const generationDir = path.dirname(path.join(rootDir, saved.image_path));
  assert.deepEqual(await readdir(generationDir), []);

  console.log(JSON.stringify({
    ok: true,
    text_to_image_unchanged: true,
    image_to_image: { action: imagePayload.action, strength: imagePayload.parameters.strength, noise: imagePayload.parameters.noise },
    inpaint: {
      action: inpaintPayload.action,
      model: inpaintPayload.model,
      request_type: inpaintPayload.parameters.request_type,
      add_original_image_forced_false: inpaintPayload.parameters.add_original_image,
      add_original_image_explicit_false: inpaintWithoutOriginal.parameters.add_original_image,
    },
    stored_assets_redacted: true,
    selection_and_generation_masks_separate: true,
    legacy_feather_history_readable: true,
  }));
} finally {
  await rm(rootDir, { recursive: true, force: true });
}

function createRgbPng(width, height, pixelAt) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = pixelAt(x, y);
      const offset = row + 1 + x * 3;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return result;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
