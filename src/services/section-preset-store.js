import path from "node:path";
import {
  createId,
  ensureDir,
  listDirectories,
  readJsonFile,
  removePath,
  sanitizeStoreId,
  storeError,
  writeJsonFile,
} from "./file-store-utils.js";

const SECTION_CONFIG = {
  "base-prompts": {
    idPrefix: "base",
    fileName: "base-prompt.json",
    schema: "chaessi-base-prompt-preset/v1",
    normalize: (input) => ({
      prompt: stringField(input.prompt ?? input.base_prompt, "Base prompt"),
    }),
    summary: (preset) => ({
      prompt_length: preset.prompt.length,
      preview: preset.prompt.slice(0, 96),
    }),
  },
  "undesired-prompts": {
    idPrefix: "undesired",
    fileName: "undesired-prompt.json",
    schema: "chaessi-undesired-prompt-preset/v1",
    normalize: (input) => ({
      undesired: stringField(input.undesired ?? input.prompt, "Undesired prompt"),
    }),
    summary: (preset) => ({
      undesired_length: preset.undesired.length,
      preview: preset.undesired.slice(0, 96),
    }),
  },
  "params-presets": {
    idPrefix: "params",
    fileName: "params-preset.json",
    schema: "chaessi-params-preset/v1",
    normalize: (input) => ({
      params: normalizeParams(input.params ?? input),
    }),
    summary: (preset) => ({
      width: preset.params.width,
      height: preset.params.height,
      steps: preset.params.steps,
      scale: preset.params.scale,
      sampler: preset.params.sampler,
      seed: preset.params.seed,
    }),
  },
};

export function createSectionPresetStore({ rootDir, section }) {
  const config = SECTION_CONFIG[section];
  if (!config) throw new Error(`Unknown section preset store: ${section}`);
  const sectionDir = path.join(rootDir, "data", section);

  return {
    async list() {
      await ensureDir(sectionDir);
      const ids = await listDirectories(sectionDir);
      const items = [];
      for (const id of ids) {
        try {
          const preset = await readJsonFile(path.join(sectionDir, id, config.fileName));
          items.push(toSummary(preset, config));
        } catch {
          // Ignore incomplete section preset directories.
        }
      }
      items.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      return items;
    },

    async get(id) {
      const presetId = sanitizeStoreId(id);
      try {
        return await readJsonFile(path.join(sectionDir, presetId, config.fileName));
      } catch {
        throw storeError(404, "section_preset_not_found", "Section preset not found.");
      }
    },

    async save(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw storeError(400, "invalid_section_preset", "Section preset must be an object.");
      }
      const now = new Date().toISOString();
      const id = sanitizeStoreId(input.id || createId(config.idPrefix));
      const existing = await readExisting(id);
      const preset = {
        schema: config.schema,
        id,
        name: String(input.name || "Untitled"),
        ...config.normalize(input),
        created_at: existing?.created_at || input.created_at || now,
        updated_at: now,
        thumbnail_path: input.thumbnail_path || existing?.thumbnail_path || null,
      };
      await writeJsonFile(path.join(sectionDir, id, config.fileName), preset);
      return preset;
    },

    async delete(id) {
      const presetId = sanitizeStoreId(id);
      if (!await existsSectionPreset(presetId)) {
        throw storeError(404, "section_preset_not_found", "Section preset not found.");
      }
      await removePath(path.join(sectionDir, presetId));
      return { id: presetId, deleted: true };
    },
  };

  async function readExisting(id) {
    try {
      return await readJsonFile(path.join(sectionDir, id, config.fileName));
    } catch {
      return null;
    }
  }

  async function existsSectionPreset(id) {
    try {
      await readJsonFile(path.join(sectionDir, id, config.fileName));
      return true;
    } catch {
      return false;
    }
  }
}

function toSummary(preset, config) {
  return {
    id: preset.id,
    name: preset.name,
    created_at: preset.created_at,
    updated_at: preset.updated_at,
    thumbnail_path: preset.thumbnail_path ?? null,
    ...config.summary(preset),
  };
}

function stringField(value, label) {
  if (value !== undefined && typeof value !== "string") {
    throw storeError(400, "invalid_section_preset", `${label} must be a string.`);
  }
  return String(value || "");
}

function normalizeParams(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw storeError(400, "invalid_params_preset", "Params preset must contain params.");
  }
  const allowed = [
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
  ];
  const output = {};
  for (const key of allowed) {
    if (value[key] !== undefined) output[key] = value[key];
  }
  return output;
}
