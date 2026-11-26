import { NOVELAI_V45_FULL_MODEL } from "../state/model-profiles.js";

const MB = 1024 * 1024;
const single = "novelai-vibe-transfer";
const bundle = "novelai-vibe-transfer-bundle";

async function textHash(value) {
  const bytes = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), n => n.toString(16).padStart(2, "0")).join("");
}

function decode(value, limit) {
  if (typeof value !== "string" || !value || value.length > 4 * Math.ceil(limit / 3)) {
    throw new Error("Missing or oversized data in the Vibe file.");
  }
  let binary;
  try { binary = atob(value); } catch { throw new Error("Invalid base64 in Vibe file."); }
  if (!binary.length || binary.length > limit || btoa(binary) !== value) throw new Error("Invalid base64 in Vibe file.");
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function imageFile(value, name, limit) {
  const bytes = decode(value, limit);
  const mark = String.fromCharCode(...bytes.subarray(0, 12));
  let type;
  if (mark.startsWith("\x89PNG\r\n\x1a\n")) type = "png";
  else if (mark.startsWith("\xff\xd8\xff")) type = "jpeg";
  else if (mark.startsWith("RIFF") && mark.slice(8) === "WEBP") type = "webp";
  else throw new Error("Vibe import supports PNG, JPEG and WebP source images.");
  return new File([bytes], name + "." + type, { type: "image/" + type });
}

function information(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Invalid Information Extracted in Vibe file.");
  }
  return value;
}

async function readCard(record) {
  if (record?.identifier !== single || record.version !== 1 || !["image", "encoding"].includes(record.type)) {
    throw new Error("Unsupported NovelAI Vibe record.");
  }
  const settings = record.importInfo;
  if (settings?.model !== NOVELAI_V45_FULL_MODEL) throw new Error("Import a Vibe exported for V4.5 Full.");
  if (settings.mask) throw new Error("This Vibe uses a mask. Masked Vibe encoding is unavailable.");
  const informationExtracted = information(settings.information_extracted);
  if (!Number.isFinite(settings.strength)) throw new Error("Invalid Vibe Strength.");
  const source = record.type === "image";
  const name = String(record.name || "Vibe").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "Vibe";
  const variants = Object.entries(record.encodings?.["v4-5full"] || {});
  if (variants.length > 256) throw new Error("The Vibe file contains too many encoding variants.");
  if (!source && (variants.length !== 1 || variants[0][0] !== "unknown")) throw new Error("Missing V4.5 Full Vibe encoding.");
  const canonical = source ? record.image : variants[0][1]?.encoding;
  if (typeof canonical !== "string" || !/^[a-f\d]{64}$/.test(record.id) || await textHash(canonical) !== record.id) {
    throw new Error("The Vibe file does not match its original image or encoding checksum.");
  }
  const original = source ? imageFile(record.image, name, 16 * MB) : null;
  const thumbnailData = typeof record.thumbnail === "string" && /^data:image\/(png|jpeg|webp);base64,/.exec(record.thumbnail);
  if (record.thumbnail && !thumbnailData) throw new Error("Invalid Vibe thumbnail.");
  const thumbnail = thumbnailData ? imageFile(record.thumbnail.slice(thumbnailData[0].length), "thumbnail", MB) : null;
  const encodings = [];
  for (const [key, variant] of variants) {
    // A mask changes the embedding. It cannot stand in for an unmasked variant.
    if (variant?.params?.mask) {
      if (source) continue;
      throw new Error("This pre-encoded Vibe uses an unsupported mask.");
    }
    const fraction = information(source ? variant?.params?.information_extracted : variant?.params?.information_extracted ?? informationExtracted);
    if (source && key !== await textHash("information_extracted:" + fraction)) throw new Error("Invalid Vibe encoding settings checksum.");
    if (!source && fraction !== informationExtracted) throw new Error("The Vibe encoding does not match its Information Extracted setting.");
    decode(variant.encoding, 4 * MB);
    encodings.push({ model: NOVELAI_V45_FULL_MODEL, informationExtracted: fraction, encoding: variant.encoding });
  }
  return { kind: "vibe", type: "vibe", original, thumbnail, fileName: original?.name || name,
    strength: settings.strength, informationExtracted, enabled: true, encodings };
}

async function readVibeJson(text, optional = false) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("Invalid NovelAI Vibe JSON."); }
  if (optional && value?.identifier !== single && value?.identifier !== bundle) return null;
  if (value?.identifier === single) return [await readCard(value)];
  if (value?.identifier !== bundle || value.version !== 1 || !Array.isArray(value.vibes)
      || value.vibes.length < 1 || value.vibes.length > 16) {
    throw new Error("Choose a NovelAI Vibe file or a bundle of up to 16 Vibes.");
  }
  const cards = [];
  for (const item of value.vibes) cards.push(await readCard(item));
  return cards;
}

async function readPngText(bytes, compressed) {
  if (!compressed) return new TextDecoder().decode(bytes);
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 88 * MB) throw new Error("Vibe PNG metadata exceeds the local 88 MiB limit.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return new Blob(chunks).text();
}

async function embeddedVibes(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  if (bytes.length < 20 || view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null;
  let chunkCount = 0;
  for (let pos = 8; pos + 12 <= bytes.length && ++chunkCount <= 16384;) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const end = pos + 8 + length;
    if (end + 4 > bytes.length) throw new Error("Invalid Vibe PNG chunk length.");
    const data = bytes.subarray(pos + 8, end);
    pos = end + 4;
    if (type === "IEND") return null;
    if (!["tEXt", "iTXt", "zTXt"].includes(type) || data.length < 8
        || String.fromCharCode(...data.subarray(0, 8)) !== "naidata\0") continue;
    let start = 8;
    let compressed = false;
    if (type === "zTXt") {
      if (data[start++] !== 0) throw new Error("Unsupported Vibe PNG text compression.");
      compressed = true;
    } else if (type === "iTXt") {
      const flag = data[start++];
      if ((flag !== 0 && flag !== 1) || data[start++] !== 0) throw new Error("Unsupported Vibe PNG text compression.");
      compressed = flag === 1;
      for (let i = 0; i < 2; i++) {
        const terminator = data.indexOf(0, start);
        if (terminator < 0) throw new Error("Invalid Vibe PNG text header.");
        start = terminator + 1;
      }
    }
    const text = await readPngText(data.subarray(start), compressed);
    const json = new TextDecoder("utf-8", { fatal: true }).decode(decode(text, 64 * MB));
    return readVibeJson(json, true);
  }
  throw new Error("Invalid or oversized Vibe PNG chunk table.");
}

// A regular PNG without a NovelAI bundle stays on the image intake path.
export async function tryImportVibeFile(file) {
  const named = /\.naiv4vibe(?:bundle)?(?:\.png)?$/i.test(file?.name || "");
  if (!file?.size) throw new Error("Choose a nonempty Vibe file.");
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const png = head.length === 8 && String.fromCharCode(...head) === "\x89PNG\r\n\x1a\n";
  if (!named && !png && file.type !== "application/json" && !/\.json$/i.test(file.name)) return null;
  if (!file?.size || file.size > 96 * MB) throw new Error("The Vibe file exceeds the local 96 MiB limit or is empty.");
  if (png) {
    const cards = await embeddedVibes(file);
    if (named && !cards) throw new Error("The Vibe PNG is missing its embedded bundle.");
    return cards;
  }
  return readVibeJson(await file.text());
}

export async function importVibeFile(file) {
  const cards = await tryImportVibeFile(file);
  if (!cards) throw new Error("Choose a NovelAI Vibe file or bundle.");
  return cards;
}
