import { randomBytes } from "node:crypto";
import { assertNoSecretMaterial, sanitizeStoreId } from "../services/file-store-utils.js";
import { NOVELAI_V5_FULL_MODEL } from "./model-profiles.js";
import { validateScenePlanV2 } from "./image-director-contract.js";

export const IMAGE_MAKER_MULTI_REQUEST_SCHEMA = "chaessi-image-request/v2";
const MULTI_MODES = new Set(["editorial", "sequence"]);

export function validateImageMakerMultiRequest(value) {
  plainObject(value, "request");
  exactKeys(value, ["schema", "request", "count", "mode", "presets", "generation"], "request");
  assertNoSecretMaterial(value, "multi-shot request");
  if (value.schema !== IMAGE_MAKER_MULTI_REQUEST_SCHEMA) throw multiRequestError("unsupported-request-schema", "Unsupported multi-shot request schema.");
  text(value.request, "request.request");
  positiveInteger(value.count, "request.count");
  if (!MULTI_MODES.has(value.mode)) throw multiRequestError("unsupported-mode", "Multi-shot mode must be editorial or sequence.");

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
  exactKeys(value.generation, ["model", "baseSeed"], "request.generation");
  if (value.generation.model !== NOVELAI_V5_FULL_MODEL) throw multiRequestError("unsupported-model", "Phase 6 requires nai-diffusion-5-full.");
  if (value.generation.baseSeed !== null) uint32(value.generation.baseSeed, "request.generation.baseSeed");
  return { ok: true, errors: [], warnings: [] };
}

export function multiRequestPresetSelections(request) {
  validateImageMakerMultiRequest(request);
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

export function validateDirectorPlanForMultiRequest(request, plan) {
  validateImageMakerMultiRequest(request);
  validateScenePlanV2(plan);
  const errors = [];
  if (plan.mode !== request.mode) errors.push("Director plan mode does not match the request.");
  if (plan.count !== request.count || plan.shots.length !== request.count) errors.push("Director plan shot count does not match the requested count.");
  if (plan.request !== request.request) errors.push("Director plan request text does not match the request.");
  if (JSON.stringify(plan.presetSelections) !== JSON.stringify(multiRequestPresetSelections(request))) errors.push("Director plan preset selections do not match the request.");
  plan.shots.forEach((shot) => {
    if (shot.generation.characters.length !== 1) errors.push(`${shot.id} must declare exactly one actor in the current Phase 6 contract.`);
  });
  if (errors.length) throw multiRequestError("director-request-mismatch", "Director plan does not match the multi-shot request.", { errors });
  return { ok: true, errors: [], warnings: [] };
}

export function resolveMultiShotSeeds(request, plan, { randomUint32 = defaultRandomUint32 } = {}) {
  validateDirectorPlanForMultiRequest(request, plan);
  const resolvedRequest = structuredClone(request);
  const resolvedPlan = structuredClone(plan);
  const baseSeed = request.generation.baseSeed === null ? randomUint32() : request.generation.baseSeed;
  uint32(baseSeed, "resolved base seed");
  resolvedRequest.generation.baseSeed = baseSeed;
  const seeds = resolvedPlan.shots.map((shot, index) => {
    const seed = (baseSeed + index) % 4294967296;
    shot.generation.seed = seed;
    return { shotId: shot.id, seed };
  });
  return { request: resolvedRequest, plan: resolvedPlan, baseSeed, seeds };
}

function defaultRandomUint32() { return randomBytes(4).readUInt32BE(0); }
function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw multiRequestError("invalid-request", `${label} must be an object.`);
}
function exactKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length) throw multiRequestError("invalid-request", `${label} contains unsupported fields: ${unknown.join(", ")}.`);
  if (missing.length) throw multiRequestError("invalid-request", `${label} is missing fields: ${missing.join(", ")}.`);
}
function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw multiRequestError("invalid-request", `${label} must be non-empty text.`);
}
function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw multiRequestError("invalid-count", `${label} must be a positive safe integer.`);
}
function uint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 4294967295) throw multiRequestError("invalid-seed", `${label} must be an unsigned 32-bit integer.`);
}
function exactId(value, label) {
  try {
    if (typeof value !== "string" || sanitizeStoreId(value) !== value) throw new Error();
  } catch {
    throw multiRequestError("invalid-preset-id", `${label} must be an exact preset ID.`);
  }
}
function multiRequestError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, details });
}
