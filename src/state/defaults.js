export const APP_NAME = "chaessi-payload-manager";
export const APP_VERSION = "1.4.0";

export const NOVELAI_V45_FULL_MODEL = "nai-diffusion-4-5-full";
export const NOVELAI_GENERATE_ENDPOINT = "https://image.novelai.net/ai/generate-image";

export const DEFAULT_PROMPT = "1girl, flower field, sunset, very aesthetic, masterpiece, no text";
export const DEFAULT_UNDESIRED_PROMPT = [
  "lowres",
  "artistic error",
  "worst quality",
  "bad quality",
  "jpeg artifacts",
  "very displeasing",
  "chromatic aberration",
  "multiple views",
  "logo",
  "watermark",
  "text",
].join(", ");

export const DEFAULT_PARAMS = Object.freeze({
  model: NOVELAI_V45_FULL_MODEL,
  width: 832,
  height: 1216,
  steps: 23,
  scale: 4,
  cfg_rescale: 0,
  sampler: "k_euler_ancestral",
  seed: null,
  extra_noise_seed: null,
  n_samples: 1,
  noise_schedule: "karras",
  qualityToggle: true,
  ucPreset: 0,
  sm: false,
  sm_dyn: false,
  dynamic_thresholding: false,
});
