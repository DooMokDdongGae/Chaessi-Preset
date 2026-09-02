import { access, writeFile } from "node:fs/promises";
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
  const sidecarPathById = new Map();
  let mutationQueue = Promise.resolve();

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
      const referenceAssets = (sourceAssets.referenceAssets || []).map((reference, index) => ({
        ...reference,
        storedAs: toPosixPath(path.join(relativeFolder, `${id}.reference-${String(index + 1).padStart(2, "0")}.png`)),
      }));
      const storedPayload = redactPayloadAssets(payload, {
        sourceBytes: sourceAssets.sourceBytes,
        sourcePath: sourceRelativePath,
        maskBytes: sourceAssets.generationMaskBytes || sourceAssets.maskBytes,
        maskPath: generationMaskRelativePath || maskRelativePath,
        referenceAssets,
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
          if (modeSettings.image_strength !== undefined) sidecar.generation.image_strength = modeSettings.image_strength;
          if (modeSettings.image_noise !== undefined) sidecar.generation.image_noise = modeSettings.image_noise;
        }
        sidecar.source_assets = {
          source_image_filename: sourceRelativePath,
          mask_image_filename: maskRelativePath,
          generation_mask_image_filename: generationMaskRelativePath,
          source_info: modeSettings.source_info || {},
        };
      }
      if (referenceAssets.length) {
        sidecar.reference_assets = referenceAssets.map((reference) => ({
          image_filename: reference.storedAs,
          file_name: reference.file_name,
          original_width: reference.original_width,
          original_height: reference.original_height,
          transmitted_width: reference.transmitted_width,
          transmitted_height: reference.transmitted_height,
          type: reference.type,
          strength: reference.strength,
          fidelity: reference.fidelity,
          enabled: true,
        }));
      }
      sidecar.raw_payload = storedPayload;

      await writeFile(path.join(absoluteFolder, `${id}.png`), imageBytes);
      if (sourceAssets.sourceBytes) await writeFile(path.join(absoluteFolder, `${id}.source.png`), sourceAssets.sourceBytes);
      if (sourceAssets.maskBytes) await writeFile(path.join(absoluteFolder, `${id}.mask.png`), sourceAssets.maskBytes);
      if (sourceAssets.generationMaskBytes) {
        await writeFile(path.join(absoluteFolder, `${id}.generation-mask.png`), sourceAssets.generationMaskBytes);
      }
      for (const reference of referenceAssets) {
        await writeFile(resolveGenerationPath(rootDir, reference.storedAs), reference.bytes);
      }
      await writeJsonFile(path.join(absoluteFolder, `${id}.payload.json`), storedPayload);
      await writeJsonFile(path.join(absoluteFolder, `${id}.json`), sidecar);
      sidecarPathById.set(id, path.join(absoluteFolder, `${id}.json`));

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
            if (sidecar.generation_id) sidecarPathById.set(sidecar.generation_id, path.join(folder, fileName));
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
      const sidecarPath = await findGenerationSidecarPath(generationId);
      const sidecar = await readGenerationSidecar(sidecarPath);
      if (sidecar.generation_id !== generationId) {
        sidecarPathById.delete(generationId);
        throw storeError(404, "generation_not_found", "Generation not found.");
      }
      return sidecar;
    },

    async deleteGeneration(id) {
      return enqueueMutation(() => deleteGenerationInternal(id));
    },

    async deleteGenerations(ids) {
      if (!Array.isArray(ids)) {
        throw storeError(400, "invalid_generation_ids", "Generation ids must be an array.");
      }
      if (!ids.length) {
        throw storeError(400, "empty_generation_ids", "Select at least one generation to delete.");
      }
      return enqueueMutation(() => deleteGenerationsInternal(ids));
    },
  };

  function enqueueMutation(task) {
    const result = mutationQueue.then(task, task);
    mutationQueue = result.catch(() => undefined);
    return result;
  }

  async function deleteGenerationsInternal(ids) {
    const uniqueIds = [];
    const seenIds = new Set();
    const duplicateIds = [];
    const failed = [];

    ids.forEach((value, inputIndex) => {
      try {
        const generationId = sanitizeStoreId(value);
        if (seenIds.has(generationId)) {
          duplicateIds.push(generationId);
          return;
        }
        seenIds.add(generationId);
        uniqueIds.push(generationId);
      } catch {
        failed.push({
          id: null,
          input_index: inputIndex,
          reason: "Invalid generation id.",
        });
      }
    });

    const deletedIds = [];
    const missingIds = [];
    for (const generationId of uniqueIds) {
      try {
        await deleteGenerationInternal(generationId);
        deletedIds.push(generationId);
      } catch (error) {
        if (error?.type === "generation_not_found" && Number(error?.statusCode) === 404) {
          sidecarPathById.delete(generationId);
          missingIds.push(generationId);
          continue;
        }
        failed.push({
          id: generationId,
          reason: error?.publicMessage || "Generation could not be deleted.",
        });
      }
    }

    return {
      requested_count: ids.length,
      unique_count: uniqueIds.length,
      deleted_ids: deletedIds,
      missing_ids: missingIds,
      duplicate_ids: [...new Set(duplicateIds)],
      failed,
    };
  }

  async function deleteGenerationInternal(id) {
    const generationId = sanitizeStoreId(id);
    const sidecarPath = await findGenerationSidecarPath(generationId);
    const sidecar = await readGenerationSidecar(sidecarPath);
    if (sidecar.generation_id !== generationId) {
      sidecarPathById.delete(generationId);
      throw storeError(404, "generation_not_found", "Generation not found.");
    }
    const dateDir = path.basename(path.dirname(sidecarPath));
    const item = toGenerationSummary(sidecar, dateDir);
    const storedPaths = [item.image_path, item.payload_path];
    if (sidecar?.source_assets?.source_image_filename) storedPaths.push(sidecar.source_assets.source_image_filename);
    if (sidecar?.source_assets?.mask_image_filename) storedPaths.push(sidecar.source_assets.mask_image_filename);
    if (sidecar?.source_assets?.generation_mask_image_filename) {
      storedPaths.push(sidecar.source_assets.generation_mask_image_filename);
    }
    for (const reference of sidecar?.reference_assets || []) {
      if (reference?.image_filename) storedPaths.push(reference.image_filename);
    }

    // Validate every sidecar-provided path before deleting any file. Keep the
    // sidecar until last so an interrupted deletion can be retried safely.
    const assetPaths = [...new Set(storedPaths.map((storedPath) => resolveGenerationPath(rootDir, storedPath)))];
    for (const assetPath of assetPaths) await removePath(assetPath);
    await removePath(sidecarPath);
    sidecarPathById.delete(generationId);
    return {
      id: generationId,
      deleted: true,
      delete_mode: "image_sidecar_payload_mode_assets",
    };
  }

  async function findGenerationSidecarPath(generationId) {
    const indexedPath = sidecarPathById.get(generationId);
    if (indexedPath) {
      try {
        await access(indexedPath);
        return indexedPath;
      } catch {
        sidecarPathById.delete(generationId);
      }
    }

    const datePrefix = generationId.match(/^(\d{4}-\d{2}-\d{2})_/u)?.[1];
    if (datePrefix) {
      const directPath = path.join(generationsDir, datePrefix, `${generationId}.json`);
      try {
        await access(directPath);
        sidecarPathById.set(generationId, directPath);
        return directPath;
      } catch {
        // Fall through for legacy records whose folder does not match their id prefix.
      }
    }

    for (const dateDir of await listDirectories(generationsDir)) {
      const folder = path.join(generationsDir, dateDir);
      if ((await listFiles(folder)).includes(`${generationId}.json`)) {
        const legacyPath = path.join(folder, `${generationId}.json`);
        sidecarPathById.set(generationId, legacyPath);
        return legacyPath;
      }
    }
    throw storeError(404, "generation_not_found", "Generation not found.");
  }

  async function readGenerationSidecar(sidecarPath) {
    try {
      return await readJsonFile(sidecarPath);
    } catch {
      throw storeError(404, "generation_not_found", "Generation not found.");
    }
  }
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
  const generationsRoot = path.resolve(root, "data", "generations");
  const resolved = path.resolve(root, String(storedPath || ""));
  if (resolved === generationsRoot || !resolved.startsWith(`${generationsRoot}${path.sep}`)) {
    throw storeError(400, "invalid_generation_path", "Generation storage path is invalid.");
  }
  return resolved;
}
function datePart(date) {
  return date.toISOString().slice(0, 10);
}
