import sharp from "sharp";
import { extractStealthPngMetadata } from "../importers/nai-metadata.js";
import { NOVELAI_V5_FULL_MODEL } from "../state/model-profiles.js";

const REFERENCE_METADATA_KEYS = [
  "v4_prompt", "v4_negative_prompt", "negative_prompt", "characterPrompts", "use_coords", "width", "height",
  "seed", "extra_noise_seed", "steps", "scale", "cfg_rescale", "sampler", "noise_schedule", "n_samples",
  "qualityToggle", "ucPreset", "qualityPresetId", "ucPresetId", "tag_hint_qt", "tag_hint_uc_preset",
  "sm", "sm_dyn", "dynamic_thresholding", "tag_hint_transparent_background", "straight_alpha",
  "director_reference_descriptions", "director_reference_strength_values", "director_reference_information_extracted",
  "director_reference_secondary_strength_values", "reference_strength_multiple", "normalize_reference_strength_multiple",
];

export function scrubReferenceStealth(pixels, { channels, width, height }) {
  // NovelAI PNG metadata may also be written bitwise in alpha, column first.
  const headerBits = (15 + 4) * 8;
  if (channels !== 4 || width * height < headerBits) return;
  const alphaIndex = bit => ((bit % height) * width + Math.floor(bit / height)) * 4 + 3;
  const header = Buffer.alloc(headerBits / 8);
  for (let bit = 0; bit < headerBits; bit++) {
    header[bit >> 3] |= (pixels[alphaIndex(bit)] & 1) << (7 - (bit % 8));
  }
  if (!["stealth_pngcomp", "stealth_pnginfo"].includes(header.toString("ascii", 0, 15))) return;
  const end = Math.min(width * height, headerBits + header.readUInt32BE(15));
  for (let bit = 0; bit < end; bit++) {
    const index = alphaIndex(bit);
    // Remove the entire embedded message. Keep the color and the high seven alpha bits.
    pixels[index] = (pixels[index] & 0xfe) | (pixels[index] >>> 7);
  }
}

async function referencePixels(bytes, input) {
  const image = sharp(bytes, { limitInputPixels: 16_777_216 });
  const { format, pages } = await image.metadata();
  if (input) {
    if (format !== "png" || (pages || 1) !== 1) throw new Error("Choose a single PNG reference image.");
    image.rotate();
  }
  const { data, info } = await image.toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  scrubReferenceStealth(data, info);
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
  return { png, format };
}

export async function referenceInputPng(bytes) {
  return (await referencePixels(bytes, true)).png;
}

async function referenceResultPng(bytes, payload) {
  const { png, format } = await referencePixels(bytes, false);
  const parameters = Object.fromEntries(REFERENCE_METADATA_KEYS.filter(key => Object.hasOwn(payload.parameters, key))
    .map(key => [key, payload.parameters[key]]));
  // Preserve standard prompt imports, without persisting the provider's raw metadata, embeddings or remote cache keys.
  const metadata = { model: payload.model, prompt: payload.input, uc: payload.parameters.negative_prompt,
    ...parameters, provenance: "chaessi-request" };
  return { imageBytes: appendPngText(png, "Comment", JSON.stringify(metadata)), format, metadata, requestMetadataOnly: true };
}

// Inpaint's existing PNG bytes bypass conversion completely.
export async function receivedImageToPng(bytes, payload) {
  if (payload.parameters?.reference_image_multiple?.length ||
      (payload.model === NOVELAI_V5_FULL_MODEL && payload.parameters?.director_reference_descriptions?.length)) {
    return referenceResultPng(bytes, payload);
  }
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return { imageBytes: bytes, format: "png" };
  const png = await sharp(bytes, { limitInputPixels: 16_777_216 }).keepMetadata().png().toBuffer();
  let actual = null;
  try { actual = JSON.parse(extractStealthPngMetadata(png)?.text || "null"); } catch {}
  let returned = actual?.Comment;
  if (typeof returned === "string") { try { returned = JSON.parse(returned); } catch { returned = null; } }
  const parameters = { ...payload.parameters, ...(returned || {}) };
  for (const key of ["image", "mask", "signed_hash", "image_cache_secret_key"]) delete parameters[key];
  const metadata = { ...(actual || {}), model: payload.model, input: returned?.prompt ?? payload.input,
    parameters, provenance: actual ? "novelai-response-and-request" : "chaessi-request" };
  // Explicit metadata survives alpha editing; original response metadata/alpha also remains in the PNG.
  return { imageBytes: appendPngText(png, "Generation Data", JSON.stringify(metadata)), format: "webp", metadata };
}

export function appendPngText(png, keyword, text) {
  const data = Buffer.concat([Buffer.from(keyword), Buffer.from([0, 0, 0, 0, 0]), Buffer.from(text, "utf8")]);
  const type = Buffer.from("iTXt");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length); type.copy(chunk, 4); data.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, data])) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  let offset = 8;
  while (offset + 12 <= png.length) {
    if (png.toString("ascii", offset + 4, offset + 8) === "IEND") return Buffer.concat([png.subarray(0, offset), chunk, png.subarray(offset)]);
    offset += png.readUInt32BE(offset) + 12;
  }
  throw new Error("Converted PNG has no IEND chunk.");
}
