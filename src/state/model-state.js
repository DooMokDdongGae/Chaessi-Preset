import { getModelProfile, NOVELAI_V45_FULL_MODEL } from "./model-profiles.js";

export function switchPresetModel(preset, targetModel) {
  const source = structuredClone(preset);
  const currentModel = source.params?.model || NOVELAI_V45_FULL_MODEL;
  const states = { ...(source.model_states || {}) };
  states[currentModel] = snapshotActiveState(source, currentModel);
  const target = states[targetModel] || createInitialTargetState(source, targetModel);
  const next = {
    ...source,
    prompt_parts: structuredClone(target.prompt_parts),
    params: { ...target.params, model: targetModel },
    model_states: states,
  };
  next.model_states[targetModel] = snapshotActiveState(next, targetModel);
  return next;
}

export function syncActiveModelState(preset) {
  const model = preset?.params?.model || NOVELAI_V45_FULL_MODEL;
  return {
    ...preset,
    model_states: {
      ...(preset?.model_states || {}),
      [model]: snapshotActiveState(preset, model),
    },
  };
}

function createInitialTargetState(source, targetModel) {
  const profile = getModelProfile(targetModel);
  return {
    prompt_parts: structuredClone(source.prompt_parts),
    params: {
      ...source.params,
      ...profile.defaults,
      width: source.params?.width ?? profile.defaults.width,
      height: source.params?.height ?? profile.defaults.height,
      steps: source.params?.steps ?? profile.defaults.steps,
      seed: source.params?.seed ?? null,
      model: targetModel,
    },
  };
}

function snapshotActiveState(preset, model) {
  return {
    prompt_parts: structuredClone(preset.prompt_parts || { base: "", undesired: "", characters: [] }),
    params: { ...(preset.params || {}), model },
  };
}
