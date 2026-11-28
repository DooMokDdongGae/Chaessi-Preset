import sharp from "sharp";
import { extractStealthPngMetadata } from "../importers/nai-metadata.js";

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

// Generated server responses belong to the user. Reference input sanitizing is
// intentionally separate: it must never scrub returned generation metadata or
// alpha-channel packets/signatures. Preserve all provider PNG bytes, including
// unknown chunks, for History and direct downloads in every generation mode.
export async function receivedImageToPng(bytes, payload) {
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
  // The independent NovelAI Inspect tool reads ordinary PNG text fields. Sharp
  // retains WebP alpha/EXIF metadata, but does not expose alpha stealth as text.
  // Copy only strings actually returned with this image. In particular, retain
  // the exact Comment string: reserializing it can change signature semantics.
  let inspectPng = png;
  if (typeof actual?.Comment === "string" && returned && typeof returned === "object" && !Array.isArray(returned)) {
    for (const keyword of ["Title", "Description", "Software", "Source", "Generation time", "Comment"]) {
      if (typeof actual[keyword] === "string") inspectPng = appendPngText(inspectPng, keyword, actual[keyword]);
    }
  }
  // Explicit metadata survives alpha editing; original response metadata/alpha also remains in the PNG.
  return { imageBytes: appendPngText(inspectPng, "Generation Data", JSON.stringify(metadata)), format: "webp", metadata };
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
