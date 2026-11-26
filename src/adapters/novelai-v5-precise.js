import { createHash } from "node:crypto";
import { MAX_PRECISE_REFERENCES } from "./novelai-v45-precise-reference.js";
import { decodeBase64Png, readPngSize } from "../services/generation-image-utils.js";
import { referenceInputPng } from "../services/generation-png.js";
import { v5ReferenceCrop } from "../state/v5-reference-buckets.js";
import { NOVELAI_V5_FULL_MODEL } from "../state/model-profiles.js";

function invalid(message) {
  return Object.assign(new Error(message), { statusCode: 400, type: "invalid_v5_reference", publicMessage: message });
}

export async function attachV5Precise(payload, references) {
  if (references == null || (Array.isArray(references) && references.length === 0)) return { images: [], summary: [] };
  if (!Array.isArray(references) || references.length > MAX_PRECISE_REFERENCES) throw invalid("Invalid Precise Reference list.");
  const active = references.filter(ref => ref?.enabled !== false);
  if (!active.length) return { images: [], summary: [] };
  if (payload.model !== NOVELAI_V5_FULL_MODEL || payload.action !== "generate") {
    throw invalid("V5 Precise Reference requires V5 Full High Text to Image.");
  }
  let total = 0;
  const images = [];
  const summary = [];
  for (const ref of active) {
    if (!ref || !Number.isFinite(ref.strength)) throw invalid("A finite reference strength is required.");
    const character = ref.type === "character" || ref.type === "character&style";
    if (ref.prefer_same_outfit !== undefined && (!character || typeof ref.prefer_same_outfit !== "boolean")) {
      throw invalid("Prefer same outfit is only available for character references.");
    }
    const prefer = ref.prefer_same_outfit ?? (ref.type === "character&style");
    const caption = { character: prefer ? "character_mainoutfit" : "character",
      "character&style": prefer ? "character&style" : "character&style_anyoutfit",
      style: "style", outfit: "costume" };
    if (!Object.hasOwn(caption, ref.type)) throw invalid("Unknown Precise Reference type.");
    const source = decodeBase64Png(ref.image_base64, "Precise Reference");
    if (!v5ReferenceCrop(source.width, source.height).unchanged) throw invalid("Invalid V5 reference bucket dimensions.");
    const { bytes } = source;
    total += bytes.length;
    if (total > 96 * 1024 * 1024) throw invalid("Precise Reference images exceed the application input limit.");
    // An independent local caller may bypass canvas intake. Re-encode pixels before submission.
    let pixels;
    try {
      pixels = await referenceInputPng(bytes);
    } catch {
      throw invalid("Choose a decodable single PNG Precise Reference.");
    }
    // EXIF orientation may swap these dimensions during the shared pixel-only conversion.
    const { width, height } = readPngSize(pixels, "Precise Reference");
    images.push(pixels);
    summary.push({ type: ref.type, caption: caption[ref.type], strength: ref.strength,
      ...(character ? { prefer_same_outfit: prefer } : {}), width, height,
      sha256: createHash("sha256").update(pixels).digest("hex") });
  }
  Object.assign(payload.parameters, {
    director_reference_descriptions: summary.map(ref => ({ caption: { base_caption: ref.caption, char_captions: [] }, legacy_uc: false })),
    director_reference_strength_values: summary.map(ref => ref.strength),
    director_reference_information_extracted: summary.map(() => 1),
    director_reference_secondary_strength_values: summary.map(() => 0),
  });
  return { images, summary };
}
