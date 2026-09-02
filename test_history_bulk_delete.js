import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildGeneratePayload, createDefaultPreset } from "./src/adapters/novelai-v45-full.js";
import { GENERATION_MODES } from "./src/adapters/novelai-v45-generation-modes.js";
import { createGenerationStore } from "./src/services/generation-store.js";
import { createHistorySelectionController } from "./src/ui/history-selection.js";

const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-history-bulk-delete-"));
assert.ok(root.startsWith(os.tmpdir()), "bulk-delete tests must remain inside the system temp directory");

try {
  const store = createGenerationStore({ rootDir: root });
  const preset = createDefaultPreset({
    prompt_parts: { base: "synthetic bulk delete", undesired: "lowres", characters: [] },
  });
  const payload = buildGeneratePayload(preset);
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const externalSource = path.join(root, "external-original.png");
  await writeFile(externalSource, png);

  const first = await saveSynthetic(store, preset, payload, png, "2026-08-20T00:00:00.000Z", true);
  const second = await saveSynthetic(store, preset, payload, png, "2026-08-21T00:00:00.000Z");
  const unsafe = await saveSynthetic(store, preset, payload, png, "2026-08-22T00:00:00.000Z");
  const preserved = await saveSynthetic(store, preset, payload, png, "2026-08-23T00:00:00.000Z", true);

  const unsafeSidecarPath = path.join(root, unsafe.sidecar_path);
  const unsafeSidecar = JSON.parse(await readFile(unsafeSidecarPath, "utf8"));
  unsafeSidecar.output.image_filename = "data/presets/must-not-delete.png";
  const protectedFile = path.join(root, "data", "presets", "must-not-delete.png");
  await mkdir(path.dirname(protectedFile), { recursive: true });
  await writeFile(protectedFile, png);
  await writeFile(unsafeSidecarPath, `${JSON.stringify(unsafeSidecar, null, 2)}\n`, "utf8");

  await assert.rejects(
    () => store.deleteGenerations([]),
    (error) => error?.type === "empty_generation_ids" && error?.statusCode === 400,
  );
  await assert.rejects(
    () => store.deleteGenerations("all"),
    (error) => error?.type === "invalid_generation_ids" && error?.statusCode === 400,
  );

  const result = await store.deleteGenerations([
    first.id,
    first.id,
    "missing_generation",
    unsafe.id,
    "../escape",
  ]);
  assert.deepEqual(result.deleted_ids, [first.id]);
  assert.deepEqual(result.missing_ids, ["missing_generation"]);
  assert.deepEqual(result.duplicate_ids, [first.id]);
  assert.equal(result.failed.length, 2);
  assert.ok(result.failed.some((item) => item.id === unsafe.id && item.reason === "Generation storage path is invalid."));
  assert.ok(result.failed.some((item) => item.id === null && item.reason === "Invalid generation id."));
  assert.equal(JSON.stringify(result).includes("..\\"), false);

  for (const storedPath of ownedAssetPaths(first)) {
    await assert.rejects(() => access(path.join(root, storedPath)));
  }
  await access(externalSource);
  await access(protectedFile);
  await access(path.join(root, preserved.image_path));
  assert.equal((await store.getGeneration(preserved.id)).generation_id, preserved.id);
  await assert.rejects(() => store.getGeneration(first.id), notFound);

  const single = await store.deleteGenerations([second.id]);
  assert.deepEqual(single.deleted_ids, [second.id]);
  await assert.rejects(() => store.getGeneration(second.id), notFound);

  const raceItem = await saveSynthetic(store, preset, payload, png, "2026-08-24T00:00:00.000Z");
  const [singleRace, bulkRace] = await Promise.all([
    store.deleteGeneration(raceItem.id),
    store.deleteGenerations([raceItem.id]),
  ]);
  assert.equal(singleRace.deleted, true);
  assert.deepEqual(bulkRace.missing_ids, [raceItem.id]);

  const restarted = createGenerationStore({ rootDir: root });
  const remaining = await restarted.listGenerations();
  assert.ok(remaining.some((item) => item.id === preserved.id));
  assert.ok(remaining.some((item) => item.id === unsafe.id));
  assert.equal(remaining.some((item) => item.id === first.id || item.id === second.id || item.id === raceItem.id), false);

  testSelectionController();
  console.log("History bulk delete store and selection tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}

async function saveSynthetic(store, preset, payload, imageBytes, createdAt, withAssets = false) {
  return store.saveGeneration({
    preset,
    payload,
    imageBytes,
    responseInfo: { created_at: createdAt },
    mode: withAssets ? GENERATION_MODES.INPAINT : GENERATION_MODES.TEXT_TO_IMAGE,
    modeSettings: withAssets ? { strength: 1, noise: 0, generation_padding: 16 } : {},
    sourceAssets: withAssets ? {
      sourceBytes: imageBytes,
      maskBytes: imageBytes,
      generationMaskBytes: imageBytes,
      referenceAssets: [{
        bytes: imageBytes,
        file_name: "synthetic-reference.png",
        type: "character",
        strength: 0.6,
        fidelity: 0.8,
      }],
    } : {},
  });
}

function ownedAssetPaths(saved) {
  const folder = path.dirname(saved.sidecar_path);
  const id = saved.id;
  return [
    saved.image_path,
    saved.sidecar_path,
    saved.payload_path,
    path.join(folder, `${id}.source.png`),
    path.join(folder, `${id}.mask.png`),
    path.join(folder, `${id}.generation-mask.png`),
    path.join(folder, `${id}.reference-01.png`),
  ];
}

function notFound(error) {
  return error?.type === "generation_not_found" && error?.statusCode === 404;
}

function testSelectionController() {
  const selection = createHistorySelectionController();
  assert.equal(selection.snapshot().count, 0);
  selection.enter();
  const displayed = Array.from({ length: 50 }, (_, index) => `generation_${index}`);
  selection.selectVisible(displayed);
  assert.equal(selection.snapshot().count, 50);
  selection.toggle(displayed[0]);
  assert.equal(selection.snapshot().count, 49);
  selection.selectVisible([...displayed, "generation_50"]);
  assert.equal(selection.snapshot().count, 51, "existing selections must survive Load more and rerender");
  selection.setBusy(true);
  selection.toggle("generation_51");
  selection.cancel();
  assert.equal(selection.snapshot().count, 51, "busy state must block duplicate actions and cancellation");
  selection.setBusy(false);
  selection.reconcile(["generation_1", "generation_50"]);
  assert.deepEqual(selection.snapshot().selectedIds, ["generation_1", "generation_50"]);
  selection.clear();
  assert.equal(selection.snapshot().count, 0);
  selection.cancel();
  assert.equal(selection.snapshot().active, false);
}
