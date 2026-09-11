import { assertNoSecretMaterial, sanitizeStoreId } from "../services/file-store-utils.js";

export const SCENE_PLAN_SCHEMA = "chaessi-scene-plan/v1";

// Reject unsupported fields rather than silently ignoring future director instructions.
export function validateScenePlan(plan) {
  objectKeys(plan, ["schema", "request", "basePresetId", "scene", "overrides"], "scene-plan");
  assertNoSecretMaterial(plan, "scene-plan");
  if (plan.schema !== SCENE_PLAN_SCHEMA) throw new Error("Unsupported scene-plan schema.");
  if (typeof plan.basePresetId !== "string" || sanitizeStoreId(plan.basePresetId) !== plan.basePresetId) {
    throw new Error("basePresetId must be an exact preset ID.");
  }
  if (plan.request !== undefined && typeof plan.request !== "string") throw new Error("request must be text.");
  objectKeys(plan.scene, ["mainPrompt", "supplement"], "scene");
  for (const key of ["mainPrompt", "supplement"]) {
    if (plan.scene[key] !== undefined && typeof plan.scene[key] !== "string") throw new Error(`scene.${key} must be text.`);
  }
  if (![plan.scene.mainPrompt, plan.scene.supplement].some((text) => text?.trim())) throw new Error("Scene text is required.");
  objectKeys(plan.overrides ?? {}, ["seed"], "overrides");
  const seed = plan.overrides?.seed;
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)) {
    throw new Error("overrides.seed must be an integer from 0 to 4294967295.");
  }
  return { ok: true, errors: [], warnings: [] };
}

function objectKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error(`${label} contains unsupported fields.`);
}
