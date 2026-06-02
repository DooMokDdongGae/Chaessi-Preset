import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_PARAMS,
} from "./defaults.js";

export const PRESET_SCHEMA = "chaessi-preset/v2";

export function createPresetMetadata(overrides = {}) {
  const now = new Date().toISOString();
  return {
    schema: PRESET_SCHEMA,
    id: overrides.id ?? null,
    name: overrides.name ?? "Untitled Preset",
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    app: {
      name: APP_NAME,
      version: APP_VERSION,
    },
  };
}

export function createCharacterPart(overrides = {}) {
  return {
    id: overrides.id ?? cryptoRandomId("character"),
    name: overrides.name ?? "Character",
    enabled: overrides.enabled ?? true,
    prompt: overrides.prompt ?? "",
    undesired: overrides.undesired ?? "",
    centers: normalizeCenters(overrides.centers),
  };
}

export function createDefaultPreset(overrides = {}) {
  return {
    metadata: createPresetMetadata(overrides.metadata),
    prompt_parts: {
      base: overrides.prompt_parts?.base ?? "",
      undesired: overrides.prompt_parts?.undesired ?? "",
      characters: Array.isArray(overrides.prompt_parts?.characters)
        ? overrides.prompt_parts.characters.map(createCharacterPart)
        : [],
    },
    params: {
      ...DEFAULT_PARAMS,
      ...(overrides.params ?? {}),
    },
    sources: {
      imported_raw_payload: overrides.sources?.imported_raw_payload ?? null,
      imported_image_metadata: overrides.sources?.imported_image_metadata ?? null,
    },
  };
}

export function normalizeCenters(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ x: 0.5, y: 0.5 }];
  }

  return value.map((center) => ({
    x: clampUnit(center?.x, 0.5),
    y: clampUnit(center?.y, 0.5),
  }));
}

function clampUnit(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function cryptoRandomId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

