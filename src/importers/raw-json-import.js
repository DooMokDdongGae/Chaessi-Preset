import { NOVELAI_V45_FULL_MODEL } from "../state/defaults.js";
import { NOVELAI_V5_FULL_MODEL } from "../state/model-profiles.js";

const SECRET_KEYS = new Set([
  "token",
  "Authorization",
  "authorization",
  "Bearer",
  "apiKey",
  "access_token",
  "NAI_ACCESS_TOKEN",
  "signed_hash",
  "image_cache_secret_key",
  "cookie",
  "set-cookie",
  "session",
]);

const SOURCE_ASSET_KEYS = new Set([
  "image",
  "mask",
  "controlnet_condition",
  "director_reference_images",
  "reference_image_multiple",
]);

const PARAM_MAP = {
  width: "width",
  height: "height",
  steps: "steps",
  scale: "scale",
  cfg_rescale: "cfg_rescale",
  sampler: "sampler",
  seed: "seed",
  extra_noise_seed: "extra_noise_seed",
  n_samples: "n_samples",
  noise_schedule: "noise_schedule",
  qualityToggle: "qualityToggle",
  ucPreset: "ucPreset",
  sm: "sm",
  sm_dyn: "sm_dyn",
  dynamic_thresholding: "dynamic_thresholding",
  qualityPresetId: "qualityPreset",
  ucPresetId: "ucPreset",
  tag_hint_transparent_background: "transparentBackground",
};
const REQUIRED_COMMON_PARAM_KEYS = [
  "model",
  "width",
  "height",
  "steps",
  "scale",
  "cfg_rescale",
  "sampler",
  "seed",
  "n_samples",
  "noise_schedule",
];
const REQUIRED_V45_PARAM_KEYS = ["qualityToggle", "ucPreset", "sm", "sm_dyn", "dynamic_thresholding"];
const REQUIRED_V5_PARAM_KEYS = ["qualityPreset", "ucPreset", "transparentBackground"];

export function parseRawJsonImport(input) {
  const warnings = [];
  const source = parseInputJson(input);
  const sanitized = expandNestedMetadataJson(sanitizeImportedValue(source, warnings), warnings);
  const payload = findPayload(sanitized);
  const parameters = payload?.parameters ?? sanitized?.parameters ?? {};

  let basePrompt = firstString(
    sanitized?.Description,
    sanitized?.Prompt,
    payload?.input,
    payload?.prompt,
    sanitized?.input,
    sanitized?.prompt,
    sanitized?.generation?.prompt,
    parameters?.v4_prompt?.caption?.base_caption,
    payload?.v4_prompt?.caption?.base_caption,
    sanitized?.v4_prompt?.caption?.base_caption,
    sanitized?.prompt_parts?.base,
  );
  let undesired = firstString(
    sanitized?.["Undesired Content"],
    parameters?.negative_prompt,
    payload?.negative_prompt,
    sanitized?.negative_prompt,
    sanitized?.uc,
    sanitized?.generation?.undesired_prompt,
    sanitized?.generation?.negative_prompt,
    parameters?.v4_negative_prompt?.caption?.base_caption,
    payload?.v4_negative_prompt?.caption?.base_caption,
    sanitized?.v4_negative_prompt?.caption?.base_caption,
    sanitized?.prompt_parts?.undesired,
  );

  const positivePrompt = parameters?.v4_prompt ?? payload?.v4_prompt ?? sanitized?.v4_prompt;
  const positiveChars = getCharCaptions(positivePrompt);
  const negativeChars = getCharCaptions(parameters?.v4_negative_prompt ?? payload?.v4_negative_prompt ?? sanitized?.v4_negative_prompt);
  const characters = mergeCharacters(positiveChars, negativeChars, positivePrompt?.use_coords === true);
  const params = extractParams(payload, parameters, sanitized);
  basePrompt = stripQualitySuffix(basePrompt, params.qualityPreset);
  basePrompt = stripTransparentSuffix(basePrompt, params.transparentBackground);
  undesired = stripUcPrefix(undesired, params.ucPreset, basePrompt);
  const requiredKeys = [
    ...REQUIRED_COMMON_PARAM_KEYS,
    ...(params.model === NOVELAI_V5_FULL_MODEL ? REQUIRED_V5_PARAM_KEYS : REQUIRED_V45_PARAM_KEYS),
  ];
  const missingParams = requiredKeys.filter((key) => params[key] === undefined);
  if (missingParams.length) {
    warnings.push(`Missing generation parameter candidates: ${missingParams.join(", ")}.`);
  }

  return {
    ok: true,
    source_type: detectSourceType(sanitized, payload),
    detected: {
      has_raw_payload: Boolean(payload),
      has_v4_prompt: Boolean(parameters?.v4_prompt || payload?.v4_prompt || sanitized?.v4_prompt),
      has_v4_negative_prompt: Boolean(parameters?.v4_negative_prompt || payload?.v4_negative_prompt || sanitized?.v4_negative_prompt),
      has_character_prompts: characters.length > 0,
      has_params: Object.keys(params).length > 0,
    },
    parsed: {
      base_prompt: basePrompt,
      undesired,
      characters,
      params,
      raw_payload: payload ?? sanitized,
    },
    warnings,
  };
}

function parseInputJson(input) {
  if (input && typeof input === "object" && !Array.isArray(input)) return input;
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      throw importerError(400, "invalid_import_json", "Import text must be valid JSON.");
    }
  }
  throw importerError(400, "invalid_import_json", "Import requires a JSON object or JSON text.");
}

function expandNestedMetadataJson(source, warnings) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return source;
  const nested = parseOptionalJsonObject(source.Comment) ?? parseOptionalJsonObject(source.comment);
  if (!nested) return source;
  warnings.push("Parsed nested JSON metadata from Comment field.");
  return {
    ...source,
    ...sanitizeImportedValue(nested, warnings),
  };
}

function parseOptionalJsonObject(value) {
  if (typeof value !== "string" || !/[{[]/.test(value)) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function findPayload(source) {
  if (!source || typeof source !== "object") return null;
  if (isNovelAiPayload(source)) return source;
  if (isNovelAiPayload(source.raw_payload)) return source.raw_payload;
  if (isNovelAiPayload(source.request?.raw_payload)) return source.request.raw_payload;
  return null;
}

function isNovelAiPayload(value) {
  return Boolean(
    value
      && typeof value === "object"
      && typeof value.input === "string"
      && value.model
      && value.action
      && value.parameters
      && typeof value.parameters === "object",
  );
}

function detectSourceType(source, payload) {
  if (payload && source?.raw_payload === payload) return "sidecar_json";
  if (payload) return "novelai_payload_json";
  return "raw_json";
}

function extractParams(payload, parameters, source) {
  const params = {};
  const candidates = {
    ...(source && typeof source === "object" ? source : {}),
    ...parameters,
    ...(payload ?? {}),
    ...(source?.generation ?? {}),
  };

  if (payload?.model || source?.generation?.model || parameters?.model || source?.model_name || source?.Source) {
    params.model = detectModel(payload?.model || source?.generation?.model || parameters?.model || source?.model_name || source?.Source);
  } else if (payload || parameters || source) {
    params.model = NOVELAI_V45_FULL_MODEL;
  }

  for (const [sourceKey, targetKey] of Object.entries(PARAM_MAP)) {
    if (candidates[sourceKey] !== undefined) params[targetKey] = candidates[sourceKey];
  }
  params.transparentBackground = candidates.tag_hint_transparent_background === true;

  if (source?.generation?.quality_toggle !== undefined) {
    params.qualityToggle = source.generation.quality_toggle;
  }
  if (source?.generation?.batch_size !== undefined) {
    params.n_samples = source.generation.batch_size;
  }
  if (source?.generation?.guidance !== undefined) {
    params.scale = source.generation.guidance;
  }
  if (source?.generation?.guidance_rescale !== undefined) {
    params.cfg_rescale = source.generation.guidance_rescale;
  }
  if (params.qualityToggle === undefined && params.model === NOVELAI_V45_FULL_MODEL && looksLikeNovelAiV4Source(payload, parameters, source)) {
    params.qualityToggle = true;
  }
  if (typeof params.qualityPreset === "number") {
    params.qualityPreset = new Map([[0, "none"], [1, "standard"], [3, "light"]]).get(params.qualityPreset) || "standard";
  }
  if (typeof params.qualityPreset !== "string" && candidates.tag_hint_qt !== undefined) {
    params.qualityPreset = new Map([[0, "none"], [1, "standard"], [3, "light"]]).get(Number(candidates.tag_hint_qt)) || "none";
  }
  if (typeof params.ucPreset === "string") {
    params.ucPreset = new Map([["heavy", 0], ["light", 1], ["furryFocus", 2], ["humanFocus", 3], ["none", 4]]).get(params.ucPreset) ?? 4;
  } else if (params.ucPreset === undefined && candidates.tag_hint_uc_preset !== undefined) {
    params.ucPreset = new Map([[2, 0], [3, 1], [5, 2], [4, 3], [0, 4]]).get(Number(candidates.tag_hint_uc_preset)) ?? 4;
  }
  if (params.ucPreset === undefined && params.model === NOVELAI_V45_FULL_MODEL && looksLikeNovelAiV4Source(payload, parameters, source)) {
    params.ucPreset = 0;
  }

  return params;
}

function detectModel(value) {
  const text = String(value || "");
  return /diffusion[- ]?v5|nai-diffusion-5|NovelAI Diffusion V5/i.test(text)
    ? NOVELAI_V5_FULL_MODEL
    : text === NOVELAI_V45_FULL_MODEL ? text : NOVELAI_V45_FULL_MODEL;
}

function looksLikeNovelAiV4Source(payload, parameters, source) {
  return Boolean(
    payload?.model === NOVELAI_V45_FULL_MODEL
      || parameters?.model === NOVELAI_V45_FULL_MODEL
      || source?.model === NOVELAI_V45_FULL_MODEL
      || source?.generation?.model === NOVELAI_V45_FULL_MODEL
      || parameters?.v4_prompt
      || parameters?.v4_negative_prompt
      || payload?.v4_prompt
      || payload?.v4_negative_prompt
      || source?.v4_prompt
      || source?.v4_negative_prompt,
  );
}

function getCharCaptions(v4Prompt) {
  const captions = v4Prompt?.caption?.char_captions;
  return Array.isArray(captions) ? captions : [];
}

function mergeCharacters(positiveChars, negativeChars, useCoords = false) {
  const max = Math.max(positiveChars.length, negativeChars.length);
  const characters = [];
  for (let index = 0; index < max; index += 1) {
    const positive = positiveChars[index] ?? {};
    const negative = negativeChars[index] ?? {};
    characters.push({
      id: `imported_character_${index + 1}`,
      name: `Imported Character ${index + 1}`,
      enabled: true,
      prompt: String(positive.char_caption ?? ""),
      undesired: String(negative.char_caption ?? ""),
      centers: Array.isArray(positive.centers)
        ? positive.centers
        : Array.isArray(negative.centers)
          ? negative.centers
          : [{ x: 0.5, y: 0.5 }],
      position_mode: useCoords ? "custom" : "auto",
    });
  }
  return characters;
}

function stripQualitySuffix(prompt, qualityPreset) {
  const suffix = qualityPreset === "standard"
    ? "very aesthetic, masterpiece, no text"
    : qualityPreset === "light" ? "very aesthetic, amazing quality, no text" : "";
  if (!suffix) return prompt;
  const marker = `, ${suffix}`;
  return prompt.endsWith(marker) ? prompt.slice(0, -marker.length) : prompt;
}

function stripTransparentSuffix(prompt, transparentBackground) {
  if (transparentBackground !== true) return prompt;
  const marker = ", transparent background";
  return prompt.endsWith(marker) ? prompt.slice(0, -marker.length) : prompt;
}

function stripUcPrefix(prompt, ucPreset, basePrompt) {
  const prefixes = [
    "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page",
    "lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, very displeasing, jpeg artifacts, 0::ai-generated::",
    "{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, {sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, everyone, [sketch background], simple, [flat colors], ych (character), outline, multiple scenes, [[horror (theme)]], comic",
    "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy",
  ];
  const prefix = prefixes[Number(ucPreset)];
  if (!prefix) return prompt;
  const complete = `${String(basePrompt).toLowerCase().includes("nsfw") ? "" : "nsfw, "}${prefix}`;
  if (prompt === complete) return "";
  return prompt.startsWith(`${complete}, `) ? prompt.slice(complete.length + 2) : prompt;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return "";
}

export function sanitizeImportedValue(value, warnings, path = "") {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeImportedValue(item, warnings, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && isTokenLike(value)) {
      warnings.push("Removed secret-like string from imported data.");
      return "[redacted]";
    }
    return value;
  }

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    const normalizedKey = key.toLowerCase();
    if (SECRET_KEYS.has(key) || SECRET_KEYS.has(normalizedKey)) {
      warnings.push("Removed secret-like field from imported data.");
      continue;
    }
    if (SOURCE_ASSET_KEYS.has(key)) {
      warnings.push("Removed embedded source asset from imported data.");
      continue;
    }
    output[key] = sanitizeImportedValue(child, warnings, childPath);
  }
  return output;
}

function isTokenLike(value) {
  return /^pst-[A-Za-z0-9_-]+$/.test(value.trim())
    || /Bearer\s+[A-Za-z0-9._-]+/.test(value);
}

function importerError(statusCode, type, publicMessage, details = "") {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.type = type;
  error.publicMessage = publicMessage;
  error.details = details;
  return error;
}
