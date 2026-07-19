import { createHash } from "node:crypto";
import { buildGeneratePayload } from "./novelai-v45-full.js";
import { NOVELAI_V45_FULL_MODEL } from "../state/defaults.js";

export const GENERATION_MODES = Object.freeze({
  TEXT_TO_IMAGE: "text-to-image",
  IMAGE_TO_IMAGE: "image-to-image",
  INPAINT: "inpaint",
});

export const NOVELAI_V45_FULL_INPAINT_MODEL = `${NOVELAI_V45_FULL_MODEL}-inpainting`;

export function buildModeGeneratePayload(preset, modeState = {}) {
  const mode = normalizeGenerationMode(modeState.mode);
  const payload = buildGeneratePayload(preset);
  if (mode === GENERATION_MODES.TEXT_TO_IMAGE) return payload;

  const width = positiveInteger(modeState.width, "source width");
  const height = positiveInteger(modeState.height, "source height");
  const image = requiredBase64(modeState.source_image_base64, "source image");
  payload.parameters.width = width;
  payload.parameters.height = height;
  payload.parameters.image = image;

  if (mode === GENERATION_MODES.IMAGE_TO_IMAGE) {
    payload.action = "img2img";
    payload.parameters.strength = unitNumber(modeState.strength, 0.7, "strength");
    payload.parameters.noise = unitNumber(modeState.noise, 0.05, "noise");
    return payload;
  }

  payload.model = NOVELAI_V45_FULL_INPAINT_MODEL;
  payload.action = "infill";
  payload.parameters.mask = requiredBase64(modeState.mask_image_base64, "mask image");
  payload.parameters.add_original_image = false;
  payload.parameters.inpaintImg2ImgStrength = unitNumber(modeState.strength, 1, "inpaint strength");
  payload.parameters.noise = 0;
  payload.parameters.deliberate_euler_ancestral_bug = false;
  payload.parameters.controlnet_strength = 1;
  payload.parameters.request_type = "NativeInfillingRequest";
  return payload;
}

export function validateModeGeneratePayload(payload, modeState = {}) {
  const mode = normalizeGenerationMode(modeState.mode);
  const errors = [];
  if (payload.parameters?.v4_prompt?.caption?.base_caption !== payload.input) {
    errors.push("v4_prompt base caption does not match input");
  }
  if (payload.parameters?.v4_negative_prompt?.caption?.base_caption !== payload.parameters?.negative_prompt) {
    errors.push("v4_negative_prompt base caption does not match negative prompt");
  }
  if (mode === GENERATION_MODES.TEXT_TO_IMAGE) {
    if (payload.model !== NOVELAI_V45_FULL_MODEL || payload.action !== "generate") {
      errors.push("text-to-image model or action is invalid");
    }
    if (payload.parameters?.image !== undefined || payload.parameters?.mask !== undefined) {
      errors.push("text-to-image payload contains source assets");
    }
  } else if (mode === GENERATION_MODES.IMAGE_TO_IMAGE) {
    if (payload.model !== NOVELAI_V45_FULL_MODEL || payload.action !== "img2img") {
      errors.push("image-to-image model or action is invalid");
    }
    if (!payload.parameters?.image || payload.parameters?.mask !== undefined) {
      errors.push("image-to-image payload source assets are invalid");
    }
  } else {
    if (payload.model !== NOVELAI_V45_FULL_INPAINT_MODEL || payload.action !== "infill") {
      errors.push("inpaint model or action is invalid");
    }
    if (!payload.parameters?.image || !payload.parameters?.mask) {
      errors.push("inpaint payload requires source image and mask");
    }
    if (payload.parameters?.request_type !== "NativeInfillingRequest") {
      errors.push("inpaint request_type is invalid");
    }
  }
  findSecretLikeValue(payload, "", errors);
  return { ok: errors.length === 0, errors, warnings: [] };
}

export function normalizeGenerationMode(value) {
  const mode = String(value || GENERATION_MODES.TEXT_TO_IMAGE);
  if (!Object.values(GENERATION_MODES).includes(mode)) {
    const error = new Error("Unsupported generation mode.");
    error.statusCode = 400;
    error.type = "unsupported_generation_mode";
    error.publicMessage = error.message;
    throw error;
  }
  return mode;
}

export function redactPayloadAssets(payload, assets = {}) {
  const copy = JSON.parse(JSON.stringify(payload));
  if (copy.parameters?.image) {
    copy.parameters.image = assetReference(assets.sourceBytes, assets.sourcePath);
  }
  if (copy.parameters?.mask) {
    copy.parameters.mask = assetReference(assets.maskBytes, assets.maskPath);
  }
  return copy;
}

function assetReference(bytes, storedAs) {
  const buffer = bytes ? Buffer.from(bytes) : Buffer.alloc(0);
  return {
    storage: "generation_asset",
    stored_as: storedAs || null,
    byte_length: buffer.length,
    sha256: buffer.length ? createHash("sha256").update(buffer).digest("hex") : null,
  };
}

function requiredBase64(value, label) {
  const text = String(value || "").trim();
  const clean = text.includes(",") ? text.slice(text.indexOf(",") + 1) : text;
  if (!clean || !/^[A-Za-z0-9+/=\r\n]+$/.test(clean)) {
    throw modeError(`${label} must be base64 PNG data.`);
  }
  return clean;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw modeError(`${label} must be a positive integer.`);
  return number;
}

function unitNumber(value, fallback, label) {
  const number = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw modeError(`${label} must be between 0 and 1.`);
  return Number(number.toFixed(2));
}

function findSecretLikeValue(value, path, errors) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (["Authorization", "Bearer", "apiKey", "token", "access_token", "NAI_ACCESS_TOKEN"].includes(key)) {
      errors.push(`forbidden secret field detected: ${childPath}`);
    }
    if (typeof child === "string" && /^pst-[A-Za-z0-9_-]+$/.test(child.trim())) {
      errors.push(`possible NovelAI token value detected at: ${childPath}`);
    }
    findSecretLikeValue(child, childPath, errors);
  }
}

function modeError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.type = "invalid_generation_mode_state";
  error.publicMessage = message;
  return error;
}
