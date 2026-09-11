import { readFile } from "node:fs/promises";
import path from "node:path";
import { validatePreset } from "../adapters/novelai-v45-full.js";
import { NOVELAI_V5_FULL_MODEL } from "../state/model-profiles.js";
import { sanitizeStoreId } from "./file-store-utils.js";

export const COMPOSER_PRESET_CATEGORIES = Object.freeze({
  character: Object.freeze(["여성 캐릭터", "남성 캐릭터"]),
  outfit: Object.freeze(["여성 의상", "남성 의상"]),
  style: Object.freeze(["그림체"]),
  quality: Object.freeze(["품질"]),
  camera: Object.freeze(["구도·카메라"]),
  lighting: Object.freeze(["조명"]),
});

export function createComposerPresetCatalog({ rootDir }) {
  const root = path.resolve(rootDir);
  const dataRoot = path.join(root, "data");

  return {
    async resolveSelections(selections) {
      const basePreset = await loadBasePreset(selections.basePresetId);
      const characterPresets = await loadMany(selections.characterPresetIds, "character");
      const outfitPresets = await loadMany(selections.outfitPresetIds, "outfit");
      if (outfitPresets.length && outfitPresets.length !== characterPresets.length) {
        throw catalogError("outfit-count-mismatch", "outfitPresetIds must be empty or contain one preset for every actor.");
      }
      return {
        basePreset,
        characterPresets,
        outfitPresets,
        stylePreset: await loadOptional(selections.stylePresetId, "style"),
        qualityPreset: await loadOptional(selections.qualityPresetId, "quality"),
        cameraPreset: await loadOptional(selections.cameraPresetId, "camera"),
        lightingPreset: await loadOptional(selections.lightingPresetId, "lighting"),
      };
    },
  };

  async function loadBasePreset(id) {
    requireExactId(id, "basePresetId");
    const file = inside(path.join(dataRoot, "presets", id, "preset.json"));
    const preset = await readJson(file, "base-preset-not-found", id);
    if (preset?.metadata?.id !== id) throw catalogError("preset-id-mismatch", `Stored base preset ID does not match ${id}.`);
    const validation = validatePreset(preset);
    if (!validation.ok || validation.warnings.length) {
      throw catalogError("invalid-base-preset", `Base preset ${id} is not activation-ready.`, validation);
    }
    if (preset.params?.model !== NOVELAI_V5_FULL_MODEL) {
      throw catalogError("wrong-base-model", `Base preset ${id} is not a V5 Full preset.`);
    }
    return preset;
  }

  async function loadMany(ids, role) {
    return Promise.all((ids || []).map((id) => loadComponentPreset(id, role)));
  }

  async function loadOptional(id, role) {
    return id === null ? null : loadComponentPreset(id, role);
  }

  async function loadComponentPreset(id, role) {
    requireExactId(id, `${role}PresetId`);
    const file = inside(path.join(dataRoot, "character-presets", id, "character-preset.json"));
    const preset = await readJson(file, "component-preset-not-found", id);
    if (preset?.id !== id) throw catalogError("preset-id-mismatch", `Stored component preset ID does not match ${id}.`);
    if (preset.enabled === false) throw catalogError("preset-disabled", `Preset ${id} is disabled.`);
    if (!COMPOSER_PRESET_CATEGORIES[role]?.includes(preset.category)) {
      throw catalogError("preset-category-mismatch", `Preset ${id} cannot be used as ${role}.`, {
        actualCategory: preset.category,
        expectedCategories: COMPOSER_PRESET_CATEGORIES[role],
      });
    }
    if (typeof preset.prompt !== "string" || !preset.prompt.trim()) {
      throw catalogError("empty-component-preset", `Preset ${id} has no usable prompt.`);
    }
    return preset;
  }

  function inside(candidate) {
    const resolved = path.resolve(candidate);
    if (resolved !== dataRoot && !resolved.startsWith(`${dataRoot}${path.sep}`)) {
      throw catalogError("invalid-preset-path", "Preset path escapes the configured data root.");
    }
    return resolved;
  }
}

function requireExactId(id, label) {
  if (typeof id !== "string" || !id || sanitizeStoreId(id) !== id) {
    throw catalogError("invalid-preset-id", `${label} must be an exact preset ID.`);
  }
}

async function readJson(file, code, id) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw catalogError(code, `Could not load preset ${id}.`, { cause: error.message });
  }
}

function catalogError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, details });
}
