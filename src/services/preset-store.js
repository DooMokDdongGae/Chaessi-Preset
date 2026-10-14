import path from "node:path";
import { writeFile } from "node:fs/promises";
import {
  createId,
  ensureDir,
  listDirectories,
  listFiles,
  readJsonFile,
  removePath,
  sanitizeStoreId,
  storeError,
  writeJsonFile,
} from "./file-store-utils.js";
import { validatePreset } from "../adapters/novelai-v45-full.js";
import { PRESET_SCHEMA } from "../state/preset-schema.js";
import { APP_NAME, APP_VERSION } from "../state/defaults.js";

export function createPresetStore({ rootDir }) {
  const presetsDir = path.join(rootDir, "data", "presets");
  const queues = new Map();

  return {
    async listPresets() {
      await ensureDir(presetsDir);
      const ids = await listDirectories(presetsDir);
      const items = [];
      for (const id of ids) {
        try {
          const preset = await readJsonFile(path.join(presetsDir, id, "preset.json"));
          items.push(toPresetSummary(preset));
        } catch {
          // Ignore incomplete preset directories.
        }
      }
      items.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      return items;
    },

    async getPreset(id) {
      const presetId = sanitizeStoreId(id);
      const filePath = path.join(presetsDir, presetId, "preset.json");
      try {
        return stripPresetUiState(await readJsonFile(filePath));
      } catch {
        throw storeError(404, "preset_not_found", "Preset not found.");
      }
    },

    async savePreset(preset, options = {}) {
      preset = stripPresetUiState(preset);
      const validation = validatePreset(preset);
      if (!validation.ok) {
        throw storeError(400, "invalid_preset", "Invalid internal preset schema.", validation.errors.join("; "));
      }
      if (validation.warnings.length) {
        throw storeError(400, "unsupported_preset_fields", "Preset contains unsupported fields.", validation.warnings.join("; "));
      }

      const id = sanitizeStoreId(preset.metadata?.id || createId("preset"));
      const previousTask = queues.get(id) || Promise.resolve();
      const task = previousTask.catch(() => {}).then(async () => {
      const now = new Date().toISOString();
      const existing = await readExistingPreset(id);
      const thumbnail = normalizeThumbnailOption(options.thumbnail);
      const thumbnailPath = thumbnail
        ? toPosixStorePath(path.join("data", "presets", id, `thumbnail.${thumbnail.extension}`))
        : existing?.metadata?.thumbnail_path || preset.metadata?.thumbnail_path || null;
      const nextPreset = {
        ...preset,
        metadata: {
          ...preset.metadata,
          schema: PRESET_SCHEMA,
          app: { name: APP_NAME, version: APP_VERSION },
          id,
          created_at: existing?.metadata?.created_at || preset.metadata?.created_at || now,
          updated_at: now,
          thumbnail_path: thumbnailPath,
        },
      };

      if (existing && JSON.stringify({ prompt: existing.prompt_parts, params: existing.params, name: existing.metadata.name }) !== JSON.stringify({ prompt: preset.prompt_parts, params: preset.params, name: preset.metadata.name })) {
        await writeJsonFile(path.join(presetsDir, id, "revisions", `${createId("revision")}.json`), existing);
      }
      await writeJsonFile(path.join(presetsDir, id, "preset.json"), nextPreset);
      if (thumbnail) {
        await removeLegacyThumbnails(presetsDir, id);
        await writeFile(path.join(presetsDir, id, `thumbnail.${thumbnail.extension}`), thumbnail.bytes);
      }
      return nextPreset;
      });
      queues.set(id, task);
      try { return await task; } finally { if (queues.get(id) === task) queues.delete(id); }
    },

    async listPresetRevisions(id) {
      const presetId = sanitizeStoreId(id);
      if (!await existsPreset(presetId)) throw storeError(404, "preset_not_found", "Preset not found.");
      const folder = path.join(presetsDir, presetId, "revisions");
      const items = [];
      for (const file of await listFiles(folder)) {
        if (!file.endsWith(".json")) continue;
        const preset = await readJsonFile(path.join(folder, file));
        items.push({ ...toPresetSummary(preset), revision_id: file.slice(0, -5) });
      }
      return items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    },

    async getPresetRevision(id, revisionId) {
      const presetId = sanitizeStoreId(id), revision = sanitizeStoreId(revisionId);
      try { return stripPresetUiState(await readJsonFile(path.join(presetsDir, presetId, "revisions", `${revision}.json`))); }
      catch { throw storeError(404, "revision_not_found", "Saved revision not found."); }
    },

    async deletePreset(id) {
      const presetId = sanitizeStoreId(id);
      const folder = path.join(presetsDir, presetId);
      if (!await existsPreset(presetId)) {
        throw storeError(404, "preset_not_found", "Preset not found.");
      }
      await removePath(folder);
      return { id: presetId, deleted: true };
    },
  };

  async function readExistingPreset(id) {
    try {
      return await readJsonFile(path.join(presetsDir, id, "preset.json"));
    } catch {
      return null;
    }
  }

  async function existsPreset(id) {
    try {
      await readJsonFile(path.join(presetsDir, id, "preset.json"));
      return true;
    } catch {
      return false;
    }
  }
}

async function removeLegacyThumbnails(presetsDir, id) {
  for (const extension of ["webp", "png", "jpg", "jpeg"]) {
    await removePath(path.join(presetsDir, id, `thumbnail.${extension}`));
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

function toPosixStorePath(value) {
  return value.split(path.sep).join("/");
}

function toPresetSummary(preset) {
  return {
    id: preset.metadata?.id ?? null,
    name: preset.metadata?.name ?? "Untitled Preset",
    created_at: preset.metadata?.created_at ?? null,
    updated_at: preset.metadata?.updated_at ?? null,
    model: preset.params?.model ?? null,
    thumbnail_path: preset.metadata?.thumbnail_path ?? null,
  };
}

function stripPresetUiState(preset) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) return preset;
  const characters = Array.isArray(preset.prompt_parts?.characters)
    ? preset.prompt_parts.characters.map(({ activeTab, ...character }) => character)
    : preset.prompt_parts?.characters;
  return {
    ...preset,
    prompt_parts: {
      ...(preset.prompt_parts || {}),
      characters,
    },
  };
}
