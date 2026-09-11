import { assertNoSecretMaterial, sanitizeStoreId } from "../services/file-store-utils.js";
import { NOVELAI_V5_FULL_MODEL } from "./model-profiles.js";
import { validateScenePlanV2 } from "./image-director-contract.js";

export const IMAGE_MAKER_REQUEST_SCHEMA = "chaessi-image-request/v1";

export function validateImageMakerRequest(value) {
  plainObject(value, "request");
  exactKeys(value, ["schema", "request", "count", "presets", "generation"], "request");
  assertNoSecretMaterial(value, "Image Maker request");
  if (value.schema !== IMAGE_MAKER_REQUEST_SCHEMA) throw requestError("unsupported-request-schema", "Unsupported Image Maker request schema.");
  text(value.request, "request.request");
  if (value.count !== 1) throw requestError("unsupported-count", "Phase 5 requires count=1.");

  plainObject(value.presets, "request.presets");
  exactKeys(value.presets, [
    "basePresetId", "characterPresetId", "outfitPresetId", "stylePresetId",
    "qualityPresetId", "cameraPresetId", "lightingPresetId",
  ], "request.presets");
  exactId(value.presets.basePresetId, "request.presets.basePresetId");
  exactId(value.presets.characterPresetId, "request.presets.characterPresetId");
  exactId(value.presets.outfitPresetId, "request.presets.outfitPresetId");
  for (const key of ["stylePresetId", "qualityPresetId", "cameraPresetId", "lightingPresetId"]) {
    if (value.presets[key] !== null) exactId(value.presets[key], `request.presets.${key}`);
  }

  plainObject(value.generation, "request.generation");
  exactKeys(value.generation, ["model", "seed"], "request.generation");
  if (value.generation.model !== NOVELAI_V5_FULL_MODEL) throw requestError("unsupported-model", "Phase 5 requires nai-diffusion-5-full.");
  if (value.generation.seed !== null && (!Number.isInteger(value.generation.seed) || value.generation.seed < 0 || value.generation.seed > 4294967295)) {
    throw requestError("invalid-seed", "request.generation.seed must be null or an unsigned 32-bit integer.");
  }
  return { ok: true, errors: [], warnings: [] };
}

export function requestPresetSelections(request) {
  validateImageMakerRequest(request);
  return {
    basePresetId: request.presets.basePresetId,
    characterPresetIds: [request.presets.characterPresetId],
    outfitPresetIds: [request.presets.outfitPresetId],
    stylePresetId: request.presets.stylePresetId,
    qualityPresetId: request.presets.qualityPresetId,
    cameraPresetId: request.presets.cameraPresetId,
    lightingPresetId: request.presets.lightingPresetId,
  };
}

export function validateDirectorPlanForImageRequest(request, plan) {
  validateImageMakerRequest(request);
  validateScenePlanV2(plan);
  const errors = [];
  if (plan.mode !== "single" || plan.count !== 1 || plan.shots.length !== 1) errors.push("Director plan must contain exactly one single-mode shot.");
  if (plan.request !== request.request) errors.push("Director plan request text does not match the Image Maker request.");
  if (JSON.stringify(plan.presetSelections) !== JSON.stringify(requestPresetSelections(request))) {
    errors.push("Director plan preset selections do not match the Image Maker request.");
  }
  const shot = plan.shots[0];
  if (shot.generation.characters.length !== 1) errors.push("Phase 5 requires exactly one declared actor.");
  if (shot.generation.seed !== request.generation.seed) errors.push("Director plan seed does not match the Image Maker request.");
  if (errors.length) throw requestError("director-request-mismatch", "Director plan does not match the Image Maker request.", { errors });
  return { ok: true, errors: [], warnings: [] };
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw requestError("invalid-request", `${label} must be an object.`);
}
function exactKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length) throw requestError("invalid-request", `${label} contains unsupported fields: ${unknown.join(", ")}.`);
  if (missing.length) throw requestError("invalid-request", `${label} is missing fields: ${missing.join(", ")}.`);
}
function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw requestError("invalid-request", `${label} must be non-empty text.`);
}
function exactId(value, label) {
  try {
    if (typeof value !== "string" || sanitizeStoreId(value) !== value) throw new Error();
  } catch {
    throw requestError("invalid-preset-id", `${label} must be an exact preset ID.`);
  }
}
function requestError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, details });
}
