import { validatePreset } from "../adapters/novelai-v45-full.js";
import { multiRequestPresetSelections, validateImageMakerMultiRequest } from "../state/image-maker-multi-request.js";
import { assertNoSecretMaterial } from "./file-store-utils.js";

const CHARACTER_CATEGORIES = new Set(["여성 캐릭터", "남성 캐릭터"]);

export async function resolveWorkshopImageMakerAssets({ request, workshopContext, presetStore, characterPresetStore }) {
  validateImageMakerMultiRequest(request);
  const preset = structuredClone(workshopContext?.preset);
  const validation = validatePreset(preset);
  if (!validation.ok) throw contextError("invalid-workshop-preset", "The active Preset Workshop state is invalid.");
  assertNoSecretMaterial(preset, "Image Maker Workshop preset");
  const selections = multiRequestPresetSelections(request);
  const blocks = await Promise.all((request.presetBlocks || []).map(async (block) => ({
    ...block,
    value: block.store === "preset"
      ? await presetStore.getPreset(block.presetId)
      : await characterPresetStore.getCharacterPreset(block.presetId),
  })));
  for (const block of blocks) {
    const actual = block.store === "preset" ? "Full Preset" : String(block.value?.category || "");
    if (actual !== block.category) throw contextError("preset-category-mismatch", `Preset ${block.presetId} no longer belongs to ${block.category}.`);
  }

  const explicitBase = blocks.find((block) => block.store === "preset" && block.scope === "global")?.value;
  const basePreset = structuredClone(explicitBase || preset);
  basePreset.metadata = { ...basePreset.metadata, id: selections.basePresetId, name: "Image Maker active Workshop context" };
  basePreset.params = structuredClone(preset.params);
  basePreset.prompt_parts = {
    base: "",
    undesired: String(preset.prompt_parts?.undesired || ""),
    characters: [],
  };

  const actorCount = selections.characterPresetIds.length;
  const inferredSubjects = inferSubjects(request.request, actorCount);
  const characterPresets = [];
  const outfitPresets = [];
  for (let index = 0; index < actorCount; index += 1) {
    const scope = `actor-${index + 1}`;
    const scoped = blocks.filter((block) => block.scope === scope && block.store === "character-preset");
    const identities = scoped.filter((block) => CHARACTER_CATEGORIES.has(block.category));
    const modifiers = scoped.filter((block) => !CHARACTER_CATEGORIES.has(block.category));
    const subject = inferSubject(request.request, identities[0]?.category, inferredSubjects[index]);
    characterPresets.push({
      id: selections.characterPresetIds[index],
      name: identities.map((block) => block.value.name).filter(Boolean).join(" + ") || `Director Actor ${index + 1}`,
      category: subject === "boy" ? "남성 캐릭터" : "여성 캐릭터",
      prompt: joinPrompt(...identities.map((block) => block.value.prompt), subject),
      undesired: joinPrompt(...identities.map((block) => block.value.undesired)),
    });
    outfitPresets.push({
      id: selections.outfitPresetIds[index],
      name: modifiers.map((block) => block.value.name).filter(Boolean).join(" + ") || `Actor ${index + 1} guidance`,
      category: "기타",
      prompt: joinPrompt(...modifiers.map((block) => block.value.prompt)),
      undesired: joinPrompt(...modifiers.map((block) => block.value.undesired)),
    });
  }
  const globalBlocks = blocks.filter((block) => block.scope === "global" && block.store === "character-preset");
  const fullPresetPrompts = blocks.filter((block) => block.scope === "global" && block.store === "preset");
  return {
    basePreset, characterPresets, outfitPresets,
    stylePreset: null, qualityPreset: null, cameraPreset: null, lightingPreset: null,
    globalPrompt: joinPrompt(
      preset.prompt_parts?.base,
      ...fullPresetPrompts.map((block) => block.value.prompt_parts?.base),
      ...globalBlocks.map((block) => block.value.prompt),
    ),
    globalUndesired: joinPrompt(
      ...fullPresetPrompts.map((block) => block.value.prompt_parts?.undesired),
      ...globalBlocks.map((block) => block.value.undesired),
    ),
    presetBlocks: blocks.map(({ value, ...block }) => ({ ...block, name: value?.name || block.presetId })),
    modeRequest: structuredClone(workshopContext?.modeRequest || { mode: request.generation.mode }),
  };
}

export function summarizeWorkshopGeneration(preset, mode = "text-to-image", modeState = {}) {
  const params = preset?.params || {};
  const width = Number(modeState.width ?? params.width);
  const height = Number(modeState.height ?? params.height);
  return {
    model: String(params.model || ""), mode,
    width, height,
    seed: Number.isInteger(params.seed) && params.seed >= 0 ? params.seed : null,
    planningRevision: revision([params.model, mode, width, height]),
    renderRevision: revision([params.model, mode, width, height, params.steps, params.scale, params.cfg_rescale, params.sampler, params.seed, params.ucPreset, params.qualityToggle, params.transparentBackground, modeState.strength, modeState.noise, modeState.i2i_strength, modeState.i2i_noise, modeState.add_original_image, modeState.generation_padding]),
  };
}

function inferSubject(text, category = "", fallback = "girl") {
  if (String(category).includes("남성")) return "boy";
  if (String(category).includes("여성")) return "girl";
  return fallback || (/(?:\bboy\b|\bman\b|male|남성|남자)/i.test(text) ? "boy" : "girl");
}
function inferSubjects(text, count) {
  const source = String(text || ""); const matches = [];
  for (const match of source.matchAll(/\b(\d+)\s*(girls?|women)\b/gi)) matches.push(...Array(Number(match[1])).fill("girl"));
  for (const match of source.matchAll(/\b(\d+)\s*(boys?|men)\b/gi)) matches.push(...Array(Number(match[1])).fill("boy"));
  if (!matches.length) {
    const terms = [...source.matchAll(/\bgirl\b|\bwoman\b|female|여성|여자|\bboy\b|\bman\b|male|남성|남자/gi)]
      .map((match) => /boy|man|male|남성|남자/i.test(match[0]) ? "boy" : "girl");
    matches.push(...terms);
  }
  while (matches.length < count) matches.push(matches.at(-1) || "girl");
  return matches.slice(0, count);
}
function joinPrompt(...values) { return values.flat().map((value) => String(value || "").trim()).filter(Boolean).join(", "); }
function revision(value) {
  let hash = 2166136261; const text = JSON.stringify(value);
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `settings_${(hash >>> 0).toString(36)}`;
}
function contextError(code, message) { return Object.assign(new Error(message), { code }); }
