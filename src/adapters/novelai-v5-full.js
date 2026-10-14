import { NOVELAI_V5_GENERATE_ENDPOINT } from "../state/defaults.js";
import { getEffectiveParams, getPresetEffort, getV5ApiModel, isV5ApiModel, NOVELAI_V5_FULL_MODEL, NOVELAI_V5_MEDIUM_MODEL } from "../state/model-profiles.js";
import { normalizeCenters, PRESET_SCHEMA } from "../state/preset-schema.js";

const QUALITY = Object.freeze({
  none: { hint: 0, suffix: "" },
  standard: { hint: 1, suffix: "very aesthetic, masterpiece, no text" },
  light: { hint: 3, suffix: "very aesthetic, amazing quality, no text" },
});
const UC_PRESETS = Object.freeze([
  { id: "heavy", hint: 2, prefix: "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page" },
  { id: "light", hint: 3, prefix: "lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, very displeasing, jpeg artifacts, 0::ai-generated::" },
  { id: "furryFocus", hint: 5, prefix: "{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, {sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, everyone, [sketch background], simple, [flat colors], ych (character), outline, multiple scenes, [[horror (theme)]], comic" },
  { id: "humanFocus", hint: 4, prefix: "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy" },
  { id: "none", hint: 0, prefix: "" },
]);

export function buildV5GeneratePayload(preset, { policy = "official" } = {}) {
  if (preset?.params?.model !== NOVELAI_V5_FULL_MODEL) throw new Error("V5 adapter requires the V5 Full model.");
  const params = getEffectiveParams(preset);
  const medium = getPresetEffort(preset) === "medium";
  const preserveInpaint = policy === "chaessi-inpaint-strategy";
  const qualityId = Object.hasOwn(QUALITY, params.qualityPreset) ? params.qualityPreset : "standard";
  const quality = QUALITY[qualityId];
  const transparent = params.transparentBackground === true;
  const base = String(preset.prompt_parts?.base || "");
  const qualityParts = [transparent ? "transparent background" : "", quality.suffix].filter(Boolean);
  let input = preserveInpaint ? [base, ...qualityParts].filter(Boolean).join(", ") : applyQualityToPrompt(base, qualityParts.join(", "));
  const ucIndex = Math.max(0, Math.min(integer(params.ucPreset, 0), UC_PRESETS.length - 1));
  const ucPreset = UC_PRESETS[ucIndex];
  const negative = applyUcPreset(preserveInpaint && !medium ? base : input, medium ? "" : String(preset.prompt_parts?.undesired || ""), ucPreset);
  if (!preserveInpaint && params.dataset === "furry" && !input.startsWith("fur dataset") && !input.startsWith("background dataset")) input = `fur dataset, ${input}`;
  const characters = (preset.prompt_parts?.characters || [])
    .slice(0, 32)
    .filter((character) => character?.enabled !== false && (preserveInpaint ? String(character?.prompt || "").trim() : String(character?.prompt || "").length));
  const useCoords = characters.length > 0 && characters.every((character) => character.position_mode === "custom");
  const charCaptions = characters.map((character) => ({ char_caption: String(character.prompt || ""), centers: normalizeCenters(character.centers) }));
  const negativeCaptions = characters.map((character) => ({ char_caption: medium ? "" : String(character.undesired || ""), centers: preserveInpaint ? normalizeCenters(character.centers) : normalizeCenters(character.centers).slice(0, 1) }));
  if (!preserveInpaint) charCaptions.forEach(caption => { caption.centers = caption.centers.slice(0, 1); });
  const characterPrompts = characters.map((character) => ({
    prompt: String(character.prompt || ""),
    uc: medium ? "" : String(character.undesired || ""),
    center: normalizeCenters(character.centers)[0],
    enabled: true,
  }));
  const seed = normalizeSeed(params.seed);
  return {
    input,
    model: getV5ApiModel(preset),
    action: "generate",
    parameters: {
      params_version: 4,
      width: integer(params.width, 832), height: integer(params.height, 1216),
      n_samples: integer(params.n_samples, 1), seed,
      sampler: String(params.sampler || "k_euler_ancestral"), steps: integer(params.steps, 23),
      scale: number(params.scale, 7),
      ucPresetId: ucPreset.id,
      qualityPresetId: qualityId,
      autoSmea: false,
      dynamic_thresholding: false,
      controlnet_strength: 1,
      legacy: false,
      add_original_image: true,
      ...(!medium ? { cfg_rescale: number(params.cfg_rescale, 0) } : {}),
      legacy_v3_extend: false,
      use_coords: useCoords,
      legacy_uc: false,
      normalize_reference_strength_multiple: true,
      inpaintImg2ImgStrength: 1,
      straight_alpha: true,
      tag_hint_qt: quality.hint, tag_hint_uc_preset: ucPreset.hint,
      ...(transparent ? { tag_hint_transparent_background: true } : {}),
      characterPrompts,
      v4_prompt: { caption: { base_caption: input, char_captions: charCaptions }, use_coords: useCoords, use_order: true },
      v4_negative_prompt: { caption: { base_caption: negative, char_captions: negativeCaptions }, legacy_uc: false },
      negative_prompt: negative,
      deliberate_euler_ancestral_bug: false,
      prefer_brownian: true,
      noise_schedule: "karras",
      image_format: preserveInpaint ? "png" : "webp",
      stream: "msgpack",
    },
    use_new_shared_trial: true,
  };
}

export function validateV5Payload(payload) {
  const errors = [];
  if (![NOVELAI_V5_FULL_MODEL, NOVELAI_V5_MEDIUM_MODEL].includes(payload?.model) || payload?.action !== "generate") errors.push("V5 T2I model or action is invalid");
  if (payload?.parameters?.params_version !== 4) errors.push("V5 params_version must be 4");
  if (payload?.parameters?.stream !== "msgpack" || payload?.parameters?.image_format !== "webp") errors.push("V5 stream transport parameters are invalid");
  if (payload?.parameters?.straight_alpha !== true || payload?.parameters?.legacy_uc !== false) errors.push("V5 alpha or UC compatibility fields are invalid");
  if (!Array.isArray(payload?.parameters?.characterPrompts) || payload.parameters.characterPrompts.length > 32) errors.push("V5 Character Prompt array is invalid");
  if (payload?.parameters?.n_samples !== 1) errors.push("V5 Full supports one image per request");
  if (payload?.parameters?.image !== undefined || payload?.parameters?.mask !== undefined) errors.push("V5 T2I payload contains source assets");
  for (const key of ["director_reference_images", "reference_image_multiple", "controlnet_condition"]) if (payload?.parameters?.[key] !== undefined) errors.push(`V5 T2I payload contains unsupported ${key}`);
  errors.push(...validateMediumContract(payload));
  return { ok: errors.length === 0, errors, warnings: [] };
}

export function validateMediumContract(payload) {
  const errors = [];
  if (![NOVELAI_V5_MEDIUM_MODEL, `${NOVELAI_V5_MEDIUM_MODEL}-inpainting`].includes(payload?.model)) return errors;
  const p = payload.parameters || {};
  if (p.steps !== 14 || p.sampler !== "k_euler_ancestral" || p.ucPresetId !== "heavy" || Object.hasOwn(p, "cfg_rescale")) errors.push("Medium requires 14 Steps, Euler Ancestral, Heavy UC and omitted CFG Rescale.");
  const expected = applyUcPreset(payload.input, "", UC_PRESETS[0]);
  if (p.negative_prompt !== expected || p.v4_negative_prompt?.caption?.base_caption !== expected) errors.push("Medium must use only the fixed Heavy UC.");
  if ((p.characterPrompts || []).some(c => c.uc !== "") || (p.v4_negative_prompt?.caption?.char_captions || []).some(c => c.char_caption !== "")) errors.push("Medium character UC must be empty in both caption structures.");
  return errors;
}

export function applyQualityToPrompt(base, suffix) {
  if (!suffix) return base;
  const chunks = base.split(/(\|\|[^]*?\|\|)/);
  let first = "", rest = "", found = false;
  for (let index = 0; index < chunks.length; index++) {
    const part = chunks[index];
    const split = index % 2 === 0 && !found ? part.indexOf("|") : -1;
    if (split >= 0) { first += part.slice(0, split); rest += part.slice(split); found = true; }
    else if (found) rest += part; else first += part;
  }
  const marker = /(?:^|\s|[,.:[\]{}、。])text:(?!:)/i;
  const text = first.match(marker);
  const position = text?.index ?? first.length;
  const prefix = first.slice(0, position);
  return [prefix, suffix].filter(Boolean).join(", ") + first.slice(position) + rest;
}

export const V5_TRANSPORT = Object.freeze({ endpoint: NOVELAI_V5_GENERATE_ENDPOINT, contentType: "multipart/form-data", response: "msgpack" });

function integer(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.floor(parsed) : fallback; }
function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizeSeed(value) { const parsed = Number(value); return value === null || value === undefined || value === "" || !Number.isFinite(parsed) || parsed < 0 ? Math.floor(Math.random() * 4_294_967_295) : Math.min(Math.floor(parsed), 4_294_967_295); }
function applyUcPreset(basePrompt, undesired, preset) {
  if (!preset.prefix) return undesired;
  let output = String(undesired).split("|").map((segment, index) => index === 0 ? (segment ? `${preset.prefix}, ${segment}` : preset.prefix) : segment).join("|");
  if (!String(basePrompt).toLowerCase().includes("nsfw")) output = `nsfw, ${output}`;
  return output;
}
