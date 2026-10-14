import { EFFORT_MEMORY_KEYS, getPresetEffort, NOVELAI_V5_FULL_MODEL } from "./model-profiles.js";

// Prompts and shared settings stay in the editor; only the official five fields are remembered.
export function switchPresetEffort(preset, effort) {
  if (preset.params.model !== NOVELAI_V5_FULL_MODEL || !["high", "medium"].includes(effort)) throw new Error("Effort is available only for V5 Full.");
  const next = structuredClone(preset);
  const current = next.params.effort ?? "high";
  next.effort_states ||= {};
  if (["high", "medium"].includes(current)) next.effort_states[current] = Object.fromEntries(EFFORT_MEMORY_KEYS.map(key => [key, next.params[key]]));
  for (const key of EFFORT_MEMORY_KEYS) if (Object.hasOwn(next.effort_states[effort] || {}, key)) next.params[key] = next.effort_states[effort][key];
  next.params.effort = effort;
  return next;
}

export function effectiveGenerationPreset(preset, payload) {
  const next = structuredClone(preset);
  delete next.model_states;
  delete next.effort_states;
  const effort = getPresetEffort(next);
  if (payload.action === "infill") delete next.params.dataset;
  next.params = { ...next.params, model: NOVELAI_V5_FULL_MODEL, effort,
    width: payload.parameters.width, height: payload.parameters.height, scale: payload.parameters.scale,
    noise_schedule: payload.parameters.noise_schedule, qualityPreset: payload.parameters.qualityPresetId,
    steps: payload.parameters.steps, sampler: payload.parameters.sampler, seed: payload.parameters.seed, n_samples: 1 };
  for (const key of ["sm", "sm_dyn", "qualityToggle"]) delete next.params[key];
  next.params.dynamic_thresholding = payload.parameters.dynamic_thresholding;
  next.params.transparentBackground = payload.parameters.tag_hint_transparent_background === true;
  next.params.ucPreset = ["heavy", "light", "furryFocus", "humanFocus", "none"].indexOf(payload.parameters.ucPresetId);
  if (payload.parameters.extra_noise_seed !== undefined) next.params.extra_noise_seed = payload.parameters.extra_noise_seed;
  else delete next.params.extra_noise_seed;
  if (effort === "medium") {
    next.params.ucPreset = 0;
    delete next.params.cfg_rescale;
    next.prompt_parts.undesired = "";
    next.prompt_parts.characters = next.prompt_parts.characters.map(character => ({ ...character, undesired: "" }));
  }
  return next;
}
