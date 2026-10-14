import sharp from "sharp";
import { extractStealthPngMetadata } from "../importers/nai-metadata.js";

// Inpaint's existing PNG bytes bypass conversion completely.
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
