import assert from "node:assert/strict";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildGeneratePayload, createDefaultPreset } from "./src/adapters/novelai-v45-full.js";
import { createGenerationStore } from "./src/services/generation-store.js";

const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-generation-direct-"));
try {
  const store = createGenerationStore({ rootDir: root });
  const preset = createDefaultPreset({
    prompt_parts: { base: "direct lookup test", undesired: "lowres", characters: [] },
  });
  const payload = buildGeneratePayload(preset);
  const saved = await store.saveGeneration({
    preset,
    payload,
    imageBytes: Buffer.from("89504e470d0a1a0a", "hex"),
    responseInfo: { created_at: "2026-08-28T00:00:00.000Z" },
  });

  store.listGenerations = async () => {
    throw new Error("get/delete must not call listGenerations");
  };
  assert.equal((await store.getGeneration(saved.id)).generation_id, saved.id);

  const recreated = createGenerationStore({ rootDir: root });
  recreated.listGenerations = store.listGenerations;
  assert.equal((await recreated.getGeneration(saved.id)).generation_id, saved.id);

  const legacyId = "legacy_generation_id";
  const legacyFolder = path.join(root, "data", "generations", "2020-01-02");
  await mkdir(legacyFolder, { recursive: true });
  const originalSidecarPath = path.join(root, saved.sidecar_path);
  const movedSidecarPath = path.join(legacyFolder, `${saved.id}.json`);
  await rename(originalSidecarPath, movedSidecarPath);
  assert.equal((await recreated.getGeneration(saved.id)).generation_id, saved.id, "externally moved sidecar must be rediscovered");

  await writeFile(path.join(legacyFolder, `${legacyId}.json`), JSON.stringify({
    generation_id: legacyId,
    created_at: "2020-01-02T00:00:00.000Z",
    generation: {},
    output: {},
  }), "utf8");
  assert.equal((await recreated.getGeneration(legacyId)).generation_id, legacyId);

  await recreated.deleteGeneration(saved.id);
  await assert.rejects(() => recreated.getGeneration(saved.id), errorType("generation_not_found", 404));

  const externallyRemoved = await recreated.saveGeneration({
    preset,
    payload,
    imageBytes: Buffer.from("89504e470d0a1a0a", "hex"),
    responseInfo: { created_at: "2026-08-29T00:00:00.000Z" },
  });
  assert.equal((await recreated.getGeneration(externallyRemoved.id)).generation_id, externallyRemoved.id);
  await rm(path.join(root, externallyRemoved.sidecar_path));
  await assert.rejects(() => recreated.getGeneration(externallyRemoved.id), errorType("generation_not_found", 404));

  const corruptId = "2026-08-28_010203_corrupt";
  await writeFile(path.join(legacyFolder, `${corruptId}.json`), "{broken", "utf8");
  await assert.rejects(() => recreated.getGeneration(corruptId), errorType("generation_not_found", 404));
  await assert.rejects(() => recreated.getGeneration("missing_generation"), errorType("generation_not_found", 404));
  await assert.rejects(() => recreated.getGeneration("../escape"), errorType("invalid_id", 400));

  console.log("Generation direct lookup tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}

function errorType(type, statusCode) {
  return (error) => error?.type === type && error?.statusCode === statusCode;
}
