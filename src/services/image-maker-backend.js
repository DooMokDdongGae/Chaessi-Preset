import path from "node:path";
import { realpath, readdir } from "node:fs/promises";
import { createPresetStore } from "./preset-store.js";
import { sanitizeStoreId } from "./file-store-utils.js";
import { composeScenePlan } from "./preset-composer.js";
import { validateScenePlan } from "../state/scene-plan.js";

// Explicit root: never start server.mjs, create stores, migrate or write user data.
export async function createImageMakerBackend({ dataRoot } = {}) {
  if (typeof dataRoot !== "string" || !path.isAbsolute(dataRoot)) throw new Error("An explicit absolute dataRoot is required.");
  const root = await realpath(dataRoot);
  const presetRoot = await realpath(path.join(root, "data", "presets"));
  ensureInside(root, presetRoot);
  const store = createPresetStore({ rootDir: root });
  async function loadPreset(id) {
    const safeId = sanitizeStoreId(id);
    const file = await realpath(path.join(presetRoot, safeId, "preset.json"));
    ensureInside(presetRoot, file);
    return store.getPreset(safeId);
  }
  return {
    dataRoot: root,
    loadPreset,
    async listPresets() {
      const items = [];
      for (const entry of await readdir(presetRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const preset = await loadPreset(entry.name);
        items.push({ id: entry.name, name: preset.metadata?.name, model: preset.params?.model });
      }
      return items.sort((a, b) => a.id.localeCompare(b.id));
    },
    async prepare(plan, options) {
      validateScenePlan(plan);
      return composeScenePlan(plan, await loadPreset(plan.basePresetId), options);
    },
  };
}

function ensureInside(root, file) {
  const relative = path.relative(root, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Preset path escapes the selected data root.");
}
