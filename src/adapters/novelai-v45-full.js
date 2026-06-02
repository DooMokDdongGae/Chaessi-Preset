import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_PARAMS,
  NOVELAI_GENERATE_ENDPOINT,
  NOVELAI_V45_FULL_MODEL,
} from "../state/defaults.js";
import {
  createDefaultPreset as createSchemaDefaultPreset,
  normalizeCenters,
  PRESET_SCHEMA,
} from "../state/preset-schema.js";

const SUPPORTED_TOP_LEVEL_KEYS = new Set(["metadata", "prompt_parts", "params", "sources"]);
const SUPPORTED_METADATA_KEYS = new Set(["schema", "id", "name", "created_at", "updated_at", "app", "thumbnail_path"]);
const SUPPORTED_PROMPT_KEYS = new Set(["base", "undesired", "characters"]);
const SUPPORTED_CHARACTER_KEYS = new Set(["id", "name", "enabled", "prompt", "undesired", "centers"]);
const SUPPORTED_SOURCE_KEYS = new Set(["imported_raw_payload", "imported_image_metadata"]);
const SUPPORTED_PARAM_KEYS = new Set([
  "model",
  "width",
  "height",
  "steps",
  "scale",
  "cfg_rescale",
  "sampler",
  "seed",
  "extra_noise_seed",
  "n_samples",
  "noise_schedule",
  "qualityToggle",
  "ucPreset",
  "sm",
  "sm_dyn",
  "dynamic_thresholding",
]);

const FORBIDDEN_PAYLOAD_KEYS = [
  "Authorization",
  "Bearer",
  "apiKey",
  "token",
  "access_token",
  "request_type",
  "signed_hash",
  "image",
  "mask",
  "reference_image_multiple",
  "director_reference_images",
];

export function createDefaultPreset(overrides = {}) {
  return createSchemaDefaultPreset(overrides);
}

export function buildGeneratePayload(preset) {
  const validation = validatePreset(preset);
  if (!validation.ok) {
    throw new Error(`Invalid preset: ${validation.errors.join("; ")}`);
  }

  const params = {
    ...DEFAULT_PARAMS,
    ...(preset.params ?? {}),
    model: NOVELAI_V45_FULL_MODEL,
  };
  const seed = normalizeSeed(params.seed);
  const extraNoiseSeed = params.extra_noise_seed == null
    ? seed
    : normalizeSeed(params.extra_noise_seed);
  const basePrompt = String(preset.prompt_parts?.base ?? "");
  const undesiredPrompt = String(preset.prompt_parts?.undesired ?? "");
  const characters = Array.isArray(preset.prompt_parts?.characters)
    ? preset.prompt_parts.characters.filter((character) => character.enabled !== false)
    : [];

  const positiveCharCaptions = characters
    .filter((character) => character.prompt || character.undesired)
    .map((character) => ({
      char_caption: String(character.prompt ?? ""),
      centers: normalizeCenters(character.centers),
    }));
  const negativeCharCaptions = characters
    .filter((character) => character.prompt || character.undesired)
    .map((character) => ({
      char_caption: String(character.undesired ?? ""),
      centers: normalizeCenters(character.centers),
    }));

  const payload = {
    input: basePrompt,
    model: NOVELAI_V45_FULL_MODEL,
    action: "generate",
    parameters: {
      params_version: 3,
      width: normalizeInteger(params.width, 832),
      height: normalizeInteger(params.height, 1216),
      n_samples: normalizeInteger(params.n_samples, 1),
      seed,
      extra_noise_seed: extraNoiseSeed,
      sampler: String(params.sampler || DEFAULT_PARAMS.sampler),
      steps: normalizeInteger(params.steps, 23),
      scale: normalizeNumber(params.scale, 4),
      cfg_rescale: normalizeNumber(params.cfg_rescale, 0),
      noise_schedule: String(params.noise_schedule || DEFAULT_PARAMS.noise_schedule),
      negative_prompt: undesiredPrompt,
      legacy: false,
      legacy_uc: false,
      legacy_v3_extend: false,
      add_original_image: true,
      prefer_brownian: true,
      ucPreset: normalizeInteger(params.ucPreset, 0),
      qualityToggle: params.qualityToggle !== false,
      use_coords: false,
      sm: Boolean(params.sm),
      sm_dyn: Boolean(params.sm_dyn),
      dynamic_thresholding: Boolean(params.dynamic_thresholding),
      skip_cfg_above_sigma: null,
      controlnet_strength: 1,
      inpaintImg2ImgStrength: 1,
      normalize_reference_strength_multiple: true,
      deliberate_euler_ancestral_bug: false,
      characterPrompts: [],
      v4_prompt: {
        caption: {
          base_caption: basePrompt,
          char_captions: positiveCharCaptions,
        },
        use_coords: false,
        use_order: true,
      },
      v4_negative_prompt: {
        caption: {
          base_caption: undesiredPrompt,
          char_captions: negativeCharCaptions,
        },
        legacy_uc: false,
      },
    },
  };

  const safety = validatePayloadSafety(payload);
  if (!safety.ok) {
    throw new Error(`Unsafe payload: ${safety.errors.join("; ")}`);
  }

  return payload;
}

export function buildSidecar({ preset, payload, status, responseInfo = {} }) {
  const parameters = payload.parameters;
  const createdAt = responseInfo.created_at ?? new Date().toISOString();
  return {
    app: {
      name: APP_NAME,
      version: APP_VERSION,
    },
    status,
    created_at: createdAt,
    generation_id: responseInfo.generation_id ?? null,
    preset: {
      schema: preset.metadata?.schema ?? PRESET_SCHEMA,
      id: preset.metadata?.id ?? null,
      name: preset.metadata?.name ?? "",
    },
    generation: {
      model: payload.model,
      action: payload.action,
      prompt: payload.input,
      undesired_prompt: parameters.negative_prompt,
      seed: parameters.seed,
      extra_noise_seed: parameters.extra_noise_seed,
      width: parameters.width,
      height: parameters.height,
      steps: parameters.steps,
      scale: parameters.scale,
      cfg_rescale: parameters.cfg_rescale,
      sampler: parameters.sampler,
      noise_schedule: parameters.noise_schedule,
      n_samples: parameters.n_samples,
      qualityToggle: parameters.qualityToggle,
      ucPreset: parameters.ucPreset,
      sm: parameters.sm,
      sm_dyn: parameters.sm_dyn,
      dynamic_thresholding: parameters.dynamic_thresholding,
    },
    output: {
      image_filename: responseInfo.image_filename ?? null,
      sidecar_filename: responseInfo.sidecar_filename ?? null,
      response_container: responseInfo.response_container ?? "zip",
      response_image_entry: responseInfo.response_image_entry ?? null,
      response_content_type: responseInfo.response_content_type ?? null,
      content_disposition: responseInfo.content_disposition ?? null,
    },
    request: {
      endpoint: NOVELAI_GENERATE_ENDPOINT,
      automatic_retry: false,
      created_at_utc: createdAt,
    },
    error: responseInfo.error ?? null,
    internal_preset: preset,
    raw_payload: payload,
  };
}

export function validatePreset(preset) {
  const errors = [];
  const warnings = [];

  if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
    return { ok: false, errors: ["preset must be an object"], warnings };
  }

  warnUnknownKeys(preset, SUPPORTED_TOP_LEVEL_KEYS, "preset", warnings);
  if (!preset.metadata || typeof preset.metadata !== "object" || Array.isArray(preset.metadata)) {
    errors.push("metadata is required");
  } else {
    warnUnknownKeys(preset.metadata, SUPPORTED_METADATA_KEYS, "metadata", warnings);
    if (preset.metadata.schema && preset.metadata.schema !== PRESET_SCHEMA) {
      warnings.push(`metadata.schema is ${preset.metadata.schema}; expected ${PRESET_SCHEMA}`);
    }
    if (preset.metadata.name !== undefined && typeof preset.metadata.name !== "string") {
      errors.push("metadata.name must be a string");
    }
  }

  if (!preset.prompt_parts || typeof preset.prompt_parts !== "object") {
    errors.push("prompt_parts is required");
  } else {
    warnUnknownKeys(preset.prompt_parts, SUPPORTED_PROMPT_KEYS, "prompt_parts", warnings);
    if (typeof preset.prompt_parts.base !== "string") errors.push("prompt_parts.base must be a string");
    if (typeof preset.prompt_parts.undesired !== "string") errors.push("prompt_parts.undesired must be a string");
    if (!Array.isArray(preset.prompt_parts.characters)) {
      errors.push("prompt_parts.characters must be an array");
    } else {
      preset.prompt_parts.characters.forEach((character, index) => {
        if (!character || typeof character !== "object" || Array.isArray(character)) {
          errors.push(`prompt_parts.characters[${index}] must be an object`);
          return;
        }
        warnUnknownKeys(character, SUPPORTED_CHARACTER_KEYS, `prompt_parts.characters[${index}]`, warnings);
      });
    }
  }

  if (!preset.params || typeof preset.params !== "object") {
    errors.push("params is required");
  } else {
    warnUnknownKeys(preset.params, SUPPORTED_PARAM_KEYS, "params", warnings);
    if (preset.params.model && preset.params.model !== NOVELAI_V45_FULL_MODEL) {
      errors.push(`params.model must be ${NOVELAI_V45_FULL_MODEL}`);
    }
  }

  if (!preset.sources || typeof preset.sources !== "object") {
    errors.push("sources is required");
  } else {
    warnUnknownKeys(preset.sources, SUPPORTED_SOURCE_KEYS, "sources", warnings);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validatePayloadSafety(payload) {
  const errors = [];
  const warnings = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, errors: ["payload must be an object"], warnings };
  }

  if (payload.model !== NOVELAI_V45_FULL_MODEL) {
    errors.push(`payload.model must be ${NOVELAI_V45_FULL_MODEL}`);
  }
  if (payload.action !== "generate") {
    errors.push("payload.action must be generate");
  }
  if (payload.parameters?.v4_prompt?.caption?.base_caption !== payload.input) {
    errors.push("v4_prompt base_caption must match top-level input");
  }
  if (payload.parameters?.negative_prompt !== payload.parameters?.v4_negative_prompt?.caption?.base_caption) {
    errors.push("v4_negative_prompt base_caption must match negative_prompt");
  }

  findForbiddenPayloadEntries(payload, "", errors);

  return { ok: errors.length === 0, errors, warnings };
}

function findForbiddenPayloadEntries(value, path, errors) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenPayloadEntries(item, `${path}[${index}]`, errors));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_PAYLOAD_KEYS.includes(key)) {
      errors.push(`forbidden payload field detected: ${childPath}`);
    }
    if (typeof child === "string" && /^pst-[A-Za-z0-9_-]+$/.test(child.trim())) {
      errors.push(`possible NovelAI token value detected at: ${childPath}`);
    }
    findForbiddenPayloadEntries(child, childPath, errors);
  }
}

function warnUnknownKeys(source, allowed, path, warnings) {
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) warnings.push(`Unsupported field ignored by adapter: ${path}.${key}`);
  }
}

function normalizeInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.floor(number);
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeSeed(value) {
  if (value === null || value === undefined || value === "") {
    return Math.floor(Math.random() * 4_294_967_295);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return Math.floor(Math.random() * 4_294_967_295);
  }
  return Math.max(0, Math.min(Math.floor(number), 4_294_967_295));
}
