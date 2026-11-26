import { createHash } from "node:crypto";
import { referenceInputPng } from "./generation-png.js";
import { NOVELAI_V45_FULL_MODEL } from "../state/model-profiles.js";
import { storeError } from "./file-store-utils.js";
import { effectiveVibeStrengths } from "./vibe-cost.js";

export const MAX_VIBES = 16;
const MB = 1024 * 1024;
const MAX_ENCODING_BYTES = 4 * MB;
const ENCODE_ENDPOINT = "https://image.novelai.net/ai/encode-vibe";

function invalid(message) {
  return storeError(400, "invalid_vibe", message);
}

function unit(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw invalid(`${name} must be a number between 0 and 1.`);
  }
  return value;
}

function decodeBase64(value, maxBytes, name) {
  if (typeof value !== "string" || !value.length || value.length > Math.ceil(maxBytes / 3) * 4) {
    throw invalid(`Missing or oversized ${name}.`);
  }
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > maxBytes || bytes.toString("base64") !== value) {
    throw invalid(`Invalid ${name} data.`);
  }
  return bytes;
}

export function supportsVibeGeneration(model, mode, count) {
  return model === NOVELAI_V45_FULL_MODEL && mode === "text-to-image"
    && Number.isInteger(count) && count > 0 && count <= MAX_VIBES;
}

export function prepareVibes({ model, mode, references = [], normalize = true, preciseCount = 0 }) {
  if (!Array.isArray(references)) throw invalid("Vibes must be a list.");
  if (!references.length) return null;
  if (!supportsVibeGeneration(model, mode, references.length)) {
    throw invalid("Choose V4.5 Full Text to Image and up to 16 Vibes.");
  }
  if (preciseCount) throw invalid("Disable Precise Reference before using Vibe Transfer.");
  if (typeof normalize !== "boolean") throw invalid("Invalid Vibe normalization setting.");
  let byteCount = 0;
  const cards = references.map((ref) => {
    if (ref?.model !== model) throw invalid("Use an encoding for the selected Vibe model.");
    if (!Number.isFinite(ref.strength)) throw invalid("Vibe Strength must be a finite number.");
    const encoding = decodeBase64(ref.encoding_base64, MAX_ENCODING_BYTES, "Vibe encoding");
    byteCount += encoding.length;
    if (byteCount > 32 * MB) throw invalid("The selected Vibe encodings exceed the local 32 MiB limit.");
    return {
      encoding: ref.encoding_base64,
      strength: ref.strength,
      informationExtracted: unit(ref.information_extracted, "Information Extracted"),
    };
  });
  return { cards, normalize, extraAnlas: Math.max(0, cards.length - 4) * 2 };
}

export function applyVibes(payload, selection) {
  if (!selection) return payload;
  const { cards, normalize } = selection;
  const weights = cards.map(card => card.strength);
  // V4.5 takes pre-encoded information. Information Extracted was applied during encoding.
  return { ...payload, parameters: { ...payload.parameters,
    reference_image_multiple: cards.map(card => card.encoding),
    reference_strength_multiple: effectiveVibeStrengths(weights, normalize),
    normalize_reference_strength_multiple: normalize,
  } };
}

// Only the explicit encode action calls the provider. No source or encoding is written to disk.
export function createVibeEncoder({ getToken, fetchImpl = fetch }) {
  const cache = new Map();
  const pending = new Map();
  let cacheBytes = 0;

  async function request(model, informationExtracted, image) {
    const token = getToken();
    const response = await fetchImpl(ENCODE_ENDPOINT, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/octet-stream, application/binary" },
      body: JSON.stringify({ model, image: image.toString("base64"), information_extracted: informationExtracted }),
    }).catch(() => {
      throw storeError(502, "vibe_encode_unknown", "Encoding response unavailable. Check the account balance before trying again.");
    });
    if (!response.ok) {
      throw storeError(response.status, "vibe_encode_failed", `NovelAI Vibe encoding failed (HTTP ${response.status}).`);
    }
    const mime = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!["application/binary", "application/octet-stream"].includes(mime) || !response.body) {
      await response.body?.cancel();
      throw storeError(502, "vibe_invalid_response", "NovelAI returned no binary encoding. Check the balance before retrying.");
    }
    const parts = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > MAX_ENCODING_BYTES) throw storeError(502, "vibe_encoding_too_large", "Vibe encoding exceeds the local size limit.");
      parts.push(chunk);
    }
    if (!length) throw storeError(502, "vibe_invalid_response", "NovelAI returned an empty Vibe encoding.");
    return Buffer.concat(parts).toString("base64");
  }

  return {
    async encode({ model, information_extracted: informationExtracted, image_base64: source } = {}) {
      if (model !== NOVELAI_V45_FULL_MODEL) throw invalid("Select V4.5 Full for Vibe encoding.");
      unit(informationExtracted, "Information Extracted");
      const bytes = decodeBase64(source, 16 * MB, "Vibe PNG");
      let pixels;
      try {
        pixels = await referenceInputPng(bytes);
      } catch {
        throw invalid("Choose one PNG with at most 16,777,216 pixels.");
      }
      const key = [model, informationExtracted, createHash("sha256").update(pixels).digest("hex")].join(":");
      let encoding = cache.get(key);
      let cached = true;
      if (encoding) {
        cache.delete(key);
        cache.set(key, encoding);
      } else if (pending.has(key)) {
        encoding = await pending.get(key);
      } else {
        cached = false;
        const job = request(model, informationExtracted, pixels);
        pending.set(key, job);
        try {
          encoding = await job;
          cache.set(key, encoding);
          cacheBytes += encoding.length;
          while (cacheBytes > 64 * MB || cache.size > 128) {
            const oldest = cache.keys().next().value;
            cacheBytes -= cache.get(oldest).length;
            cache.delete(oldest);
          }
        } finally {
          pending.delete(key);
        }
      }
      return { ok: true, encoding_base64: encoding, model, information_extracted: informationExtracted, cached, encoding_anlas: cached ? 0 : 2 };
    },
  };
}
