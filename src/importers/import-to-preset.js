import { createDefaultPreset } from "../state/preset-schema.js";
import { DEFAULT_PARAMS, NOVELAI_V45_FULL_MODEL } from "../state/defaults.js";
import { getModelProfile, isSupportedModel } from "../state/model-profiles.js";
import { syncActiveModelState } from "../state/model-state.js";

const DEFAULT_APPLY_OPTIONS = {
  applyBasePrompt: false,
  applyUndesired: false,
  applyCharacters: false,
  applyParams: false,
};

export function applyImportToPreset(currentPreset, parsedImport, options = {}) {
  if (!parsedImport?.ok || !parsedImport.parsed) {
    throw importerError(400, "invalid_import_result", "A valid parsed import result is required.");
  }

  const applyOptions = {
    ...DEFAULT_APPLY_OPTIONS,
    ...options,
  };
  const warnings = [];
  const parsed = parsedImport.parsed;
  const nextPreset = createDefaultPreset(currentPreset ?? {});

  if (applyOptions.applyBasePrompt) {
    nextPreset.prompt_parts.base = String(parsed.base_prompt ?? "");
  }
  if (applyOptions.applyUndesired) {
    nextPreset.prompt_parts.undesired = String(parsed.undesired ?? "");
  }
  if (applyOptions.applyCharacters) {
    nextPreset.prompt_parts.characters = Array.isArray(parsed.characters)
      ? parsed.characters.map((character, index) => ({
          id: character.id || `imported_character_${index + 1}`,
          name: character.name || `Imported Character ${index + 1}`,
          enabled: character.enabled !== false,
          prompt: String(character.prompt || ""),
          undesired: String(character.undesired || ""),
          centers: Array.isArray(character.centers) && character.centers.length
            ? character.centers
            : [{ x: 0.5, y: 0.5 }],
          position_mode: character.position_mode === "custom" ? "custom" : "auto",
        }))
      : [];
  }
  if (applyOptions.applyParams) {
    nextPreset.params = normalizeImportedParams(nextPreset.params, parsed.params, warnings);
  }

  nextPreset.sources = {
    ...nextPreset.sources,
    imported_raw_payload: parsed.raw_payload ?? null,
    imported_image_metadata: parsedImport.source_type ?? null,
  };
  nextPreset.metadata = {
    ...nextPreset.metadata,
    updated_at: new Date().toISOString(),
  };

  const syncedPreset = syncActiveModelState(nextPreset);
  return {
    ok: true,
    preset: syncedPreset,
    applied: {
      base_prompt: Boolean(applyOptions.applyBasePrompt),
      undesired: Boolean(applyOptions.applyUndesired),
      characters: Boolean(applyOptions.applyCharacters),
      params: Boolean(applyOptions.applyParams),
    },
    warnings,
  };
}

function normalizeImportedParams(currentParams, params, warnings) {
  const importedModel = isSupportedModel(params?.model) ? params.model : NOVELAI_V45_FULL_MODEL;
  const profile = getModelProfile(importedModel);
  const output = {
    ...DEFAULT_PARAMS,
    ...profile.defaults,
    ...(currentParams ?? {}),
    model: importedModel,
  };
  if (!params || typeof params !== "object") return output;

  for (const key of new Set([...Object.keys(DEFAULT_PARAMS), ...Object.keys(profile.defaults)])) {
    if (params[key] !== undefined) output[key] = params[key];
  }
  if (params.model && !isSupportedModel(params.model)) {
    warnings.push(`Imported model ${params.model} is unsupported; using ${NOVELAI_V45_FULL_MODEL}.`);
  }
  output.model = importedModel;
  return output;
}

function importerError(statusCode, type, publicMessage, details = "") {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.type = type;
  error.publicMessage = publicMessage;
  error.details = details;
  return error;
}
