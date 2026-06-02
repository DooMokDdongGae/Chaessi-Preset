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

export function createGenerationStore({ rootDir }) {
  const generationsDir = path.join(rootDir, "data", "generations");

  return {
    async saveGeneration({ preset, payload, imageBytes, responseInfo }) {
      const createdAt = responseInfo.created_at ? new Date(responseInfo.created_at) : new Date();
      const date = datePart(createdAt);
      const id = responseInfo.generation_id || createTimestampId(createdAt);
      const relativeFolder = path.join("data", "generations", date);
      const absoluteFolder = path.join(rootDir, relativeFolder);
      await ensureDir(absoluteFolder);

      const imageRelativePath = toPosixPath(path.join(relativeFolder, `${id}.png`));
      const sidecarRelativePath = toPosixPath(path.join(relativeFolder, `${id}.json`));
      const payloadRelativePath = toPosixPath(path.join(relativeFolder, `${id}.payload.json`));

      const sidecar = buildSidecar({
        preset,
        payload,
        status: "success",
        responseInfo: {
          ...responseInfo,
          generation_id: id,
          created_at: createdAt.toISOString(),
          image_filename: imageRelativePath,
          sidecar_filename: sidecarRelativePath,
        },
      });

      await writeFile(path.join(absoluteFolder, `${id}.png`), imageBytes);
      await writeJsonFile(path.join(absoluteFolder, `${id}.payload.json`), payload);
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
      const absoluteSidecar = path.join(rootDir, item.sidecar_path);
      return await readJsonFile(absoluteSidecar);
    },

    async deleteGeneration(id) {
      const generationId = sanitizeStoreId(id);
      const items = await this.listGenerations();
      const item = items.find((entry) => entry.id === generationId);
      if (!item) throw storeError(404, "generation_not_found", "Generation not found.");
      await removePath(path.join(rootDir, item.image_path));
      await removePath(path.join(rootDir, item.sidecar_path));
      await removePath(path.join(rootDir, item.payload_path));
      return {
        id: generationId,
        deleted: true,
        delete_mode: "image_sidecar_payload",
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
  };
}

function datePart(date) {
  return date.toISOString().slice(0, 10);
}
