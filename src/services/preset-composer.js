import { validateScenePlan } from "../state/scene-plan.js";
import { NOVELAI_V5_FULL_MODEL } from "../state/model-profiles.js";
import { validatePayloadSafety, validatePreset } from "../adapters/novelai-v45-full.js";
import { buildModeGeneratePayload, validateModeGeneratePayload } from "../adapters/novelai-v45-generation-modes.js";
import { validateV5Payload } from "../adapters/novelai-v5-full.js";
import { resolvePresetRandomPrompts } from "./prompt-random-resolver.js";
import { assertNoSecretMaterial } from "./file-store-utils.js";

// Reusable backend core: no filesystem reads, CLI arguments, network, DOM or Electron.
export function composeScenePlan(plan, basePreset, { randomFn = Math.random } = {}) {
  const scenePlanValidation = validateScenePlan(plan);
  if (basePreset?.metadata?.id !== plan.basePresetId) throw new Error("Loaded preset ID does not match basePresetId.");
  requireValid(validatePreset(basePreset), "Base preset");
  if (basePreset.params.model !== NOVELAI_V5_FULL_MODEL) throw new Error("MVP requires a V5 base preset; automatic model conversion is not supported.");
  const preset = structuredClone(basePreset);
  // Preserve weighted syntax and existing prompt text; do not split/deduplicate tags.
  const sceneTags = (plan.scene.mainPrompt || "").trim();
  const supplement = (plan.scene.supplement || "").trim();
  if (sceneTags) preset.prompt_parts.base += `${preset.prompt_parts.base.trim() ? ", " : ""}${sceneTags}`;
  if (supplement) preset.prompt_parts.base += `${preset.prompt_parts.base.trim() ? "\n" : ""}${supplement}`;
  if (plan.overrides?.seed !== undefined) preset.params.seed = plan.overrides.seed;
  const resolvedPreset = resolvePresetRandomPrompts(preset, randomFn);
  const texts = [resolvedPreset.prompt_parts.base, resolvedPreset.prompt_parts.undesired,
    ...resolvedPreset.prompt_parts.characters.flatMap((character) => [character.prompt, character.undesired])];
  if (texts.some((text) => typeof text === "string" && text.includes("||"))) throw new Error("Unresolved random prompt block.");
  // Freeze the existing builder's seed choice into the request before exporting it.
  resolvedPreset.params.seed = buildModeGeneratePayload(resolvedPreset, { mode: "text-to-image" }).parameters.seed;
  const { payload, presetValidation, payloadValidation } = prepareResolvedPreset(resolvedPreset);
  return {
    schema: "chaessi-prepared-generation/v1",
    resolvedPreset,
    payload,
    requestBody: { preset: structuredClone(resolvedPreset) },
    validation: { scenePlan: scenePlanValidation, preset: presetValidation, payload: payloadValidation },
    warnings: ["Append-only composition: semantic conflicts with the base preset are not automatically resolved."],
  };
}

export function prepareResolvedPreset(preset, { modeRequest = { mode: "text-to-image" } } = {}) {
  assertNoSecretMaterial(preset, "resolved preset");
  const presetValidation = validatePreset(preset);
  requireValid(presetValidation, "Resolved preset");
  if (!Number.isInteger(preset.params.seed) || preset.params.seed < 0 || preset.params.seed > 4294967295) throw new Error("Resolved seed must be fixed.");
  if (JSON.stringify(preset.prompt_parts).includes("||")) throw new Error("Resolved preset contains random blocks.");
  if (preset.prompt_parts.characters.length > (preset.params.model === NOVELAI_V5_FULL_MODEL ? 32 : 6)) throw new Error("The selected model has too many character slots.");
  const payload = buildModeGeneratePayload(preset, modeRequest);
  const payloadValidation = modeRequest.mode !== "text-to-image"
    ? validateModeGeneratePayload(payload, modeRequest)
    : preset.params.model === NOVELAI_V5_FULL_MODEL ? validateV5Payload(payload) : validatePayloadSafety(payload);
  requireValid(payloadValidation, "Generation payload");
  assertNoSecretMaterial(payload, "payload");
  return { payload, presetValidation, payloadValidation };
}

function requireValid(result, label) {
  if (!result.ok || result.warnings.length) throw new Error(`${label} validation failed: ${[...result.errors, ...result.warnings].join("; ")}`);
}
