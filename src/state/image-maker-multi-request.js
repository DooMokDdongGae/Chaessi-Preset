import { randomBytes } from "node:crypto";
import { assertNoSecretMaterial, sanitizeStoreId } from "../services/file-store-utils.js";
import { NOVELAI_V5_FULL_MODEL } from "./model-profiles.js";
import { validateScenePlanV2 } from "./image-director-contract.js";

export const IMAGE_MAKER_MULTI_REQUEST_SCHEMA = "chaessi-image-request/v2";
export const IMAGE_MAKER_WORKFLOW_REQUEST_SCHEMA = "chaessi-image-request/v3";
const MULTI_MODES = new Set(["editorial", "sequence"]);

export function validateImageMakerMultiRequest(value) {
  plainObject(value, "request");
  if (value.schema === IMAGE_MAKER_WORKFLOW_REQUEST_SCHEMA) return validateWorkflowRequest(value);
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

function validateWorkflowRequest(value) {
  exactKeys(value, ["schema", "request", "count", "mode", "presetBlocks", "generation"], "request");
  text(value.request, "request.request");
  positiveInteger(value.count, "request.count");
  if (!MULTI_MODES.has(value.mode)) throw multiRequestError("unsupported-mode", "Multi-shot mode must be editorial or sequence.");
  if (!Array.isArray(value.presetBlocks)) throw multiRequestError("invalid-preset-blocks", "request.presetBlocks must be an array.");
  value.presetBlocks.forEach((block, index) => {
    plainObject(block, `request.presetBlocks[${index}]`);
    exactKeys(block, ["scope", "store", "category", "presetId"], `request.presetBlocks[${index}]`);
    if (block.scope !== "global" && !/^actor-[1-9][0-9]*$/.test(block.scope)) throw multiRequestError("invalid-preset-scope", "Preset scope must be global or actor-N.");
    if (!["preset", "character-preset"].includes(block.store)) throw multiRequestError("invalid-preset-store", "Unknown preset store.");
    text(block.category, `request.presetBlocks[${index}].category`);
    exactId(block.presetId, `request.presetBlocks[${index}].presetId`);
  });
  plainObject(value.generation, "request.generation");
  exactKeys(value.generation, ["model", "mode", "width", "height", "seed", "planningRevision", "renderRevision"], "request.generation");
  text(value.generation.model, "request.generation.model");
  if (!["text-to-image", "image-to-image", "inpaint"].includes(value.generation.mode)) throw multiRequestError("unsupported-generation-mode", "Unsupported Workshop generation mode.");
  positiveInteger(value.generation.width, "request.generation.width");
  positiveInteger(value.generation.height, "request.generation.height");
  if (value.generation.seed !== null) uint32(value.generation.seed, "request.generation.seed");
  text(value.generation.planningRevision, "request.generation.planningRevision");
  text(value.generation.renderRevision, "request.generation.renderRevision");
  return { ok: true, errors: [], warnings: [] };
}

export function multiRequestPresetSelections(request) {
  validateImageMakerMultiRequest(request);
  if (request.schema === IMAGE_MAKER_WORKFLOW_REQUEST_SCHEMA) {
    const actorCount = Math.max(inferActorCount(request.request), ...request.presetBlocks.map((block) => Number(block.scope.match(/^actor-(\d+)$/)?.[1]) || 0));
    return {
      basePresetId: "image_maker_active_workshop",
      characterPresetIds: Array.from({ length: actorCount }, (_, index) => `image_maker_actor_${index + 1}`),
      outfitPresetIds: Array.from({ length: actorCount }, (_, index) => `image_maker_modifier_${index + 1}`),
      stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null,
    };
  }
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

function inferActorCount(value) {
  const text = String(value || "").toLowerCase();
  let count = 1;
  const tagged = [...text.matchAll(/\b(\d+)\s*(?:girls?|boys?|women|men|people|persons?|actors?)\b/g)].map((match) => Number(match[1]));
  const danbooru = [...text.matchAll(/\b(\d+)(girls?|boys?)\b/g)].map((match) => Number(match[1]));
  const korean = [...text.matchAll(/(\d+)\s*명/g)].map((match) => Number(match[1]));
  count = Math.max(count, ...tagged, ...danbooru, ...korean);
  const wordCounts = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, 두: 2, 세: 3, 네: 4 };
  for (const [word, number] of Object.entries(wordCounts)) {
    if (new RegExp(`(?:\\b${word}\\s+(?:girls?|boys?|women|men|people|persons?|actors?)\\b|${word}\\s*명)`, "i").test(text)) count = Math.max(count, number);
  }
  const distinctSexTerms = [/(?:\bgirl\b|\bwoman\b|female|여성|여자)/i, /(?:\bboy\b|\bman\b|male|남성|남자)/i].filter((pattern) => pattern.test(text)).length;
  return Math.max(count, distinctSexTerms);
}

export function validateDirectorPlanForMultiRequest(request, plan) {
  validateImageMakerMultiRequest(request);
  validateScenePlanV2(plan);
  const errors = [];
  if (plan.mode !== request.mode) errors.push("Director plan mode does not match the request.");
  if (plan.count !== request.count || plan.shots.length !== request.count) errors.push("Director plan shot count does not match the requested count.");
  if (plan.request !== request.request) errors.push("Director plan request text does not match the request.");
  if (JSON.stringify(plan.presetSelections) !== JSON.stringify(multiRequestPresetSelections(request))) errors.push("Director plan preset selections do not match the request.");
  const actorCount = multiRequestPresetSelections(request).characterPresetIds.length;
  plan.shots.forEach((shot) => {
    if (shot.generation.characters.length !== actorCount) errors.push(`${shot.id} must declare exactly ${actorCount} actor${actorCount === 1 ? "" : "s"}.`);
  });
  if (errors.length) throw multiRequestError("director-request-mismatch", "Director plan does not match the multi-shot request.", { errors });
  return { ok: true, errors: [], warnings: [] };
}

export function resolveMultiShotSeeds(request, plan, { randomUint32 = defaultRandomUint32 } = {}) {
  validateDirectorPlanForMultiRequest(request, plan);
  const resolvedRequest = structuredClone(request);
  const resolvedPlan = structuredClone(plan);
  const configuredSeed = request.schema === IMAGE_MAKER_WORKFLOW_REQUEST_SCHEMA ? request.generation.seed : request.generation.baseSeed;
  const baseSeed = configuredSeed === null ? randomUint32() : configuredSeed;
  uint32(baseSeed, "resolved base seed");
  if (request.schema === IMAGE_MAKER_WORKFLOW_REQUEST_SCHEMA) resolvedRequest.generation.seed = baseSeed;
  else resolvedRequest.generation.baseSeed = baseSeed;
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
