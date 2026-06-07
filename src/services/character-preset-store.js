import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createId,
  ensureDir,
  listDirectories,
  readJsonFile,
  removePath,
    sanitizeStoreId,
    storeError,
    toPosixPath,
    writeJsonFile,
} from "./file-store-utils.js";
import { normalizeCenters } from "../state/preset-schema.js";

const CHARACTER_PRESET_SCHEMA = "chaessi-character-preset/v1";
const DEFAULT_CHARACTER_PRESET_CATEGORY = "기타";
const FEMALE_CLOTHING_CATEGORY = "여성 의상";
const CATEGORY_ALIASES = new Map([
  ["여성 아웃핏", FEMALE_CLOTHING_CATEGORY],
  ["남성 아웃핏", "남성 의상"],
]);

export function createCharacterPresetStore({ rootDir }) {
  const characterPresetsDir = path.join(rootDir, "data", "character-presets");

  return {
    async listCharacterPresets() {
      await ensureDir(characterPresetsDir);
      const ids = await listDirectories(characterPresetsDir);
      const items = [];
      for (const id of ids) {
        try {
          const preset = await readJsonFile(path.join(characterPresetsDir, id, "character-preset.json"));
          items.push(toCharacterPresetSummary(preset));
        } catch {
          // Ignore incomplete character preset directories.
        }
      }
      items.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      return items;
    },

    async getCharacterPreset(id) {
      const presetId = sanitizeStoreId(id);
      const filePath = path.join(characterPresetsDir, presetId, "character-preset.json");
      try {
        return normalizeCharacterPreset(await readJsonFile(filePath));
      } catch {
        throw storeError(404, "character_preset_not_found", "Character preset not found.");
      }
    },

    async saveCharacterPreset(input, options = {}) {
      const now = new Date().toISOString();
      const id = sanitizeStoreId(input?.id || createId("character"));
      const existing = await readExistingCharacterPreset(id);
      const thumbnail = normalizeThumbnailOption(options.thumbnail);
      const inputHasThumbnailPath = Object.prototype.hasOwnProperty.call(input || {}, "thumbnail_path");
      const thumbnailPath = thumbnail
        ? toPosixPath(path.join("data", "character-presets", id, `thumbnail.${thumbnail.extension}`))
        : inputHasThumbnailPath
          ? input.thumbnail_path || null
          : existing?.thumbnail_path || null;
      const preset = normalizeCharacterPreset({
        ...input,
        id,
        created_at: existing?.created_at || input?.created_at || now,
        updated_at: now,
        thumbnail_path: thumbnailPath,
      });
      await writeJsonFile(path.join(characterPresetsDir, id, "character-preset.json"), preset);
      if (thumbnail) {
        await writeFile(path.join(characterPresetsDir, id, `thumbnail.${thumbnail.extension}`), thumbnail.bytes);
      } else if (inputHasThumbnailPath && input.thumbnail_path === null) {
        await removeCharacterThumbnailFiles(id);
      }
      return preset;
    },

    async deleteCharacterPreset(id) {
      const presetId = sanitizeStoreId(id);
      const folder = path.join(characterPresetsDir, presetId);
      if (!await existsCharacterPreset(presetId)) {
        throw storeError(404, "character_preset_not_found", "Character preset not found.");
      }
      await removePath(folder);
      return { id: presetId, deleted: true };
    },
  };

  async function readExistingCharacterPreset(id) {
    try {
      return await readJsonFile(path.join(characterPresetsDir, id, "character-preset.json"));
    } catch {
      return null;
    }
  }

  async function existsCharacterPreset(id) {
    try {
      await readJsonFile(path.join(characterPresetsDir, id, "character-preset.json"));
      return true;
    } catch {
      return false;
    }
  }

  async function removeCharacterThumbnailFiles(id) {
    for (const extension of ["webp", "png", "jpg", "jpeg"]) {
      await removePath(path.join(characterPresetsDir, id, `thumbnail.${extension}`));
    }
  }
}

function normalizeThumbnailOption(thumbnail) {
  if (!thumbnail?.bytes?.length) return null;
  const contentType = String(thumbnail.contentType || "").toLowerCase();
  if (contentType.includes("image/webp")) return { bytes: thumbnail.bytes, extension: "webp" };
  if (contentType.includes("image/png")) return { bytes: thumbnail.bytes, extension: "png" };
  if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) return { bytes: thumbnail.bytes, extension: "jpg" };
  return null;
}

export function normalizeCharacterPreset(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw storeError(400, "invalid_character_preset", "Character preset must be an object.");
  }
  if (input.prompt !== undefined && typeof input.prompt !== "string") {
    throw storeError(400, "invalid_character_preset", "Character prompt must be a string.");
  }
  if (input.undesired !== undefined && typeof input.undesired !== "string") {
    throw storeError(400, "invalid_character_preset", "Character undesired must be a string.");
  }

  const category = normalizeCharacterPresetCategory(input.category);
  return {
    schema: CHARACTER_PRESET_SCHEMA,
    id: sanitizeStoreId(input.id),
    name: String(input.name || "Untitled Character"),
    category,
    subCategory: normalizeCharacterPresetSubCategory(category, input.subCategory ?? input.subcategory),
    enabled: input.enabled !== false,
    prompt: String(input.prompt || ""),
    undesired: String(input.undesired || ""),
    centers: normalizeCenters(input.centers),
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString(),
    thumbnail_path: input.thumbnail_path || null,
  };
}

function toCharacterPresetSummary(preset) {
  const category = normalizeCharacterPresetCategory(preset.category);
  return {
    id: preset.id,
    name: preset.name,
    category,
    subCategory: normalizeCharacterPresetSubCategory(category, preset.subCategory ?? preset.subcategory),
    created_at: preset.created_at,
    updated_at: preset.updated_at,
    thumbnail_path: preset.thumbnail_path ?? null,
  };
}

function normalizeCharacterPresetCategory(value) {
  const category = String(value || "").trim();
  return CATEGORY_ALIASES.get(category) || category || DEFAULT_CHARACTER_PRESET_CATEGORY;
}

function normalizeCharacterPresetSubCategory(category, value) {
  if (category !== FEMALE_CLOTHING_CATEGORY) return "";
  return String(value || "").trim();
}
