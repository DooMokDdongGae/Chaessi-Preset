export const NOVELAI_V45_FULL_MODEL = "nai-diffusion-4-5-full";
export const NOVELAI_V5_FULL_MODEL = "nai-diffusion-5-full";

export const MODEL_PROFILES = Object.freeze({
  [NOVELAI_V45_FULL_MODEL]: Object.freeze({
    id: NOVELAI_V45_FULL_MODEL,
    label: "V4.5 Full",
    family: "v4.5",
    tokenizer: "t5",
    tokenLimit: 512,
    maxCharacters: 6,
    modes: Object.freeze(["text-to-image", "image-to-image", "inpaint"]),
    capabilities: Object.freeze({ preciseReference: true, qualityPreset: false, cfgRescale: true, transparency: false, smea: true }),
    defaults: Object.freeze({ width: 832, height: 1216, steps: 23, scale: 4, cfg_rescale: 0, sampler: "k_euler_ancestral", noise_schedule: "karras", qualityToggle: true, ucPreset: 0 }),
    samplers: Object.freeze(["k_euler_ancestral", "k_euler", "k_dpmpp_2s_ancestral", "k_dpmpp_2m_sde", "k_dpmpp_2m", "k_dpmpp_sde"]),
  }),
  [NOVELAI_V5_FULL_MODEL]: Object.freeze({
    id: NOVELAI_V5_FULL_MODEL,
    label: "V5 Full",
    family: "v5",
    tokenizer: "qwen",
    tokenLimit: 1471,
    maxCharacters: 32,
    modes: Object.freeze(["text-to-image", "image-to-image", "inpaint"]),
    capabilities: Object.freeze({ preciseReference: false, qualityPreset: true, cfgRescale: true, transparency: true, smea: false }),
    defaults: Object.freeze({ width: 832, height: 1216, steps: 23, scale: 5, cfg_rescale: 0, sampler: "k_euler_ancestral", noise_schedule: "karras", qualityToggle: true, qualityPreset: "standard", transparentBackground: false, ucPreset: 0 }),
    samplers: Object.freeze(["k_euler_ancestral", "k_euler", "k_dpmpp_2s_ancestral", "k_dpmpp_2m_sde", "k_dpmpp_2m", "k_dpmpp_sde"]),
  }),
});

export function getModelProfile(model) {
  return MODEL_PROFILES[model] || MODEL_PROFILES[NOVELAI_V45_FULL_MODEL];
}

export function isSupportedModel(model) {
  return Object.hasOwn(MODEL_PROFILES, model);
}
