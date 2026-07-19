import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createTimestampId,
  ensureDir,
  listDirectories,
  listFiles,
  readJsonFile,
  removePath,
  sanitizeStoreId,
  storeError,
  toPosixPath,
  writeJsonFile,
} from "./file-store-utils.js";
import { buildSidecar } from "../adapters/novelai-v45-full.js";
import {
  GENERATION_MODES,
  redactPayloadAssets,
} from "../adapters/novelai-v45-generation-modes.js";

export function createGenerationStore({ rootDir }) {
  const generationsDir = path.join(rootDir, "data", "generations");

  return {
    async saveGeneration({ preset, payload, imageBytes, responseInfo, mode = GENERATION_MODES.TEXT_TO_IMAGE, modeSettings = {}, sourceAssets = {} }) {
      const createdAt = responseInfo.created_at ? new Date(responseInfo.created_at) : new Date();
      const date = datePart(createdAt);
      const id = responseInfo.generation_id || createTimestampId(createdAt);
      const relativeFolder = path.join("data", "generations", date);
      const absoluteFolder = path.join(rootDir, relativeFolder);
      await ensureDir(absoluteFolder);

      const imageRelativePath = toPosixPath(path.join(relativeFolder, `${id}.png`));
      const sidecarRelativePath = toPosixPath(path.join(relativeFolder, `${id}.json`));
      const payloadRelativePath = toPosixPath(path.join(relativeFolder, `${id}.payload.json`));
      const sourceRelativePath = sourceAssets.sourceBytes
        ? toPosixPath(path.join(relativeFolder, `${id}.source.png`))
        : null;
      const maskRelativePath = sourceAssets.maskBytes
        ? toPosixPath(path.join(relativeFolder, `${id}.mask.png`))
        : null;
      const generationMaskRelativePath = sourceAssets.generationMaskBytes
        ? toPosixPath(path.join(relativeFolder, `${id}.generation-mask.png`))
        : null;
      const storedPayload = redactPayloadAssets(payload, {
        sourceBytes: sourceAssets.sourceBytes,
        sourcePath: sourceRelativePath,
        maskBytes: sourceAssets.generationMaskBytes || sourceAssets.maskBytes,
        maskPath: generationMaskRelativePath || maskRelativePath,
      });

      const sidecar = buildSidecar({
        preset,
        payload: storedPayload,
        status: "success",
        responseInfo: {
          ...responseInfo,
          generation_id: id,
          created_at: createdAt.toISOString(),
          image_filename: imageRelativePath,
          sidecar_filename: sidecarRelativePath,
        },
      });
      sidecar.generation.mode = mode;
      sidecar.generation.model = payload.model;
      sidecar.generation.action = payload.action;
      sidecar.generation.width = payload.parameters.width;
      sidecar.generation.height = payload.parameters.height;
      if (mode !== GENERATION_MODES.TEXT_TO_IMAGE) {
        sidecar.generation.strength = modeSettings.strength;
        sidecar.generation.noise = modeSettings.noise;
        sidecar.generation.request_type = payload.parameters.request_type ?? null;
        if (mode === GENERATION_MODES.INPAINT) {
          sidecar.generation.add_original_image = modeSettings.add_original_image === true;
          sidecar.generation.generation_padding = Number(modeSettings.generation_padding) || 0;
        }
        sidecar.source_assets = {
          source_image_filename: sourceRelativePath,
          mask_image_filename: maskRelativePath,
          generation_mask_image_filename: generationMaskRelativePath,
          source_info: modeSettings.source_info || {},
        };
      }
      sidecar.raw_payload = storedPayload;

      await writeFile(path.join(absoluteFolder, `${id}.png`), imageBytes);
      if (sourceAssets.sourceBytes) await writeFile(path.join(absoluteFolder, `${id}.source.png`), sourceAssets.sourceBytes);
      if (sourceAssets.maskBytes) await writeFile(path.join(absoluteFolder, `${id}.mask.png`), sourceAssets.maskBytes);
      if (sourceAssets.generationMaskBytes) {
        await writeFile(path.join(absoluteFolder, `${id}.generation-mask.png`), sourceAssets.generationMaskBytes);
      }
      await writeJsonFile(path.join(absoluteFolder, `${id}.payload.json`), storedPayload);
      await writeJsonFile(path.join(absoluteFolder, `${id}.json`), sidecar);

      return {
        id,
        image_path: imageRelativePath,
        sidecar_path: sidecarRelativePath,
        payload_path: payloadRelativePath,
        sidecar,
      };
    },

    async listGenerations() {
      await ensureDir(generationsDir);
      const dateDirs = await listDirectories(generationsDir);
      const items = [];
      for (const dateDir of dateDirs) {
        const folder = path.join(generationsDir, dateDir);
        const files = await listFiles(folder);
        for (const fileName of files.filter((name) => name.endsWith(".json") && !name.endsWith(".payload.json"))) {
          try {
            const sidecar = await readJsonFile(path.join(folder, fileName));
            items.push(toGenerationSummary(sidecar, dateDir));
          } catch {
            // Ignore incomplete generation sidecars.
          }
        }
      }
      items.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      return items;
    },

    async getGeneration(id) {
      const generationId = sanitizeStoreId(id);
      const items = await this.listGenerations();
      const item = items.find((entry) => entry.id === generationId);
      if (!item) throw storeError(404, "generation_not_found", "Generation not found.");
      const absoluteSidecar = resolveGenerationPath(rootDir, item.sidecar_path);
      return await readJsonFile(absoluteSidecar);
    },

    async deleteGeneration(id) {
      const generationId = sanitizeStoreId(id);
      const items = await this.listGenerations();
      const item = items.find((entry) => entry.id === generationId);
      if (!item) throw storeError(404, "generation_not_found", "Generation not found.");
      const sidecarPath = resolveGenerationPath(rootDir, item.sidecar_path);
      const sidecar = await readJsonFile(sidecarPath).catch(() => null);
      await removePath(resolveGenerationPath(rootDir, item.image_path));
      await removePath(sidecarPath);
      await removePath(resolveGenerationPath(rootDir, item.payload_path));
      if (sidecar?.source_assets?.source_image_filename) {
        await removePath(resolveGenerationPath(rootDir, sidecar.source_assets.source_image_filename));
      }
      if (sidecar?.source_assets?.mask_image_filename) {
        await removePath(resolveGenerationPath(rootDir, sidecar.source_assets.mask_image_filename));
      }
      if (sidecar?.source_assets?.generation_mask_image_filename) {
        await removePath(resolveGenerationPath(rootDir, sidecar.source_assets.generation_mask_image_filename));
      }
      return {
        id: generationId,
        deleted: true,
        delete_mode: "image_sidecar_payload_mode_assets",
      };
    },
  };
}

function toGenerationSummary(sidecar, dateDir) {
  const id = sidecar.generation_id;
  return {
    id,
    created_at: sidecar.created_at,
    image_path: sidecar.output?.image_filename || toPosixPath(path.join("data", "generations", dateDir, `${id}.png`)),
    sidecar_path: sidecar.output?.sidecar_filename || toPosixPath(path.join("data", "generations", dateDir, `${id}.json`)),
    payload_path: toPosixPath(path.join("data", "generations", dateDir, `${id}.payload.json`)),
    model: sidecar.generation?.model,
    width: sidecar.generation?.width,
    height: sidecar.generation?.height,
    seed: sidecar.generation?.seed,
    mode: sidecar.generation?.mode || GENERATION_MODES.TEXT_TO_IMAGE,
    strength: sidecar.generation?.strength,
    noise: sidecar.generation?.noise,
    add_original_image: sidecar.generation?.add_original_image,
    feather: sidecar.generation?.feather,
    generation_padding: sidecar.generation?.generation_padding,
  };
}


function resolveGenerationPath(rootDir, storedPath) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, String(storedPath || ""));
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw storeError(400, "invalid_generation_path", "Generation storage path is invalid.");
  }
  return resolved;
}
function datePart(date) {
  return date.toISOString().slice(0, 10);
}
