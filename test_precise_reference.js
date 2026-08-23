import assert from "node:assert/strict";
import { access, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { createDefaultPreset } from "./src/adapters/novelai-v45-full.js";
import {
  buildModeGeneratePayload,
  GENERATION_MODES,
} from "./src/adapters/novelai-v45-generation-modes.js";
import {
  applyPreciseReferences,
  PRECISE_REFERENCE_TYPES,
  validatePreciseReferencePayload,
} from "./src/adapters/novelai-v45-precise-reference.js";
import { createGenerationStore } from "./src/services/generation-store.js";
import { selectPreciseReferenceTarget } from "./src/ui/precise-reference-controller.js";

const rootDir = path.resolve(`.test-precise-reference-${process.pid}`);
const preset = createDefaultPreset({ params: { seed: 1234, extra_noise_seed: 1234 } });
const modes = [
  [GENERATION_MODES.TEXT_TO_IMAGE, {}],
  [GENERATION_MODES.IMAGE_TO_IMAGE, { width: 64, height: 64, source_image_base64: "YWJj", strength: 0.7, noise: 0.05 }],
  [GENERATION_MODES.INPAINT, { width: 64, height: 64, source_image_base64: "YWJj", mask_image_base64: "ZGVm", strength: 1 }],
];

try {
  assert.deepEqual(selectPreciseReferenceTarget(800, 1200), { width: 1024, height: 1536, delta: 0 });
  assert.deepEqual(selectPreciseReferenceTarget(1200, 800), { width: 1536, height: 1024, delta: 0 });
  assert.deepEqual(selectPreciseReferenceTarget(1000, 1000), { width: 1472, height: 1472, delta: 0 });
  for (const [mode, state] of modes) {
    const payload = buildModeGeneratePayload(preset, { mode, ...state });
    const untouched = structuredClone(payload);
    assert.equal(applyPreciseReferences(payload, []), payload);
    assert.deepEqual(payload, untouched, `${mode} payload must not change without references`);
  }

  const references = [
    reference("first", PRECISE_REFERENCE_TYPES.CHARACTER, 0.8, 0.7),
    { ...reference("disabled", PRECISE_REFERENCE_TYPES.STYLE, 1, 1), enabled: false },
    reference("third", PRECISE_REFERENCE_TYPES.CHARACTER_AND_STYLE, -0.25, 1.2),
  ];
  const base = buildModeGeneratePayload(preset, { mode: GENERATION_MODES.TEXT_TO_IMAGE });
  const payload = applyPreciseReferences(base, references);
  assert.deepEqual(payload.parameters.director_reference_images, ["Zmlyc3Q=", "dGhpcmQ="]);
  assert.deepEqual(payload.parameters.director_reference_descriptions.map((entry) => entry.caption.base_caption), ["character", "character&style"]);
  assert.deepEqual(payload.parameters.director_reference_information_extracted, [1, 1]);
  assert.deepEqual(payload.parameters.director_reference_strength_values, [0.8, -0.25]);
  assert.ok(Math.abs(payload.parameters.director_reference_secondary_strength_values[0] - 0.3) < 1e-12);
  assert.ok(Math.abs(payload.parameters.director_reference_secondary_strength_values[1] + 0.2) < 1e-12);
  assert.equal(validatePreciseReferencePayload(payload, references).ok, true);
  assert.equal(base.parameters.director_reference_images, undefined, "base payload must remain unchanged");

  assert.throws(() => applyPreciseReferences(base, [reference("bad", "unknown", 1, 1)]), /unsupported type/);
  assert.throws(() => applyPreciseReferences(base, [{ ...reference("bad", "character", 1, 1), strength: Infinity }]), /finite number/);

  const store = createGenerationStore({ rootDir });
  const referenceBytes = [Buffer.from("reference-one"), Buffer.from("reference-two")];
  const saved = await store.saveGeneration({
    preset,
    payload,
    imageBytes: Buffer.from("result"),
    responseInfo: {
      generation_id: "precise_reference_test",
      created_at: "2026-08-01T00:00:00.000Z",
    },
    sourceAssets: {
      referenceAssets: referenceBytes.map((bytes, index) => ({
        bytes,
        file_name: `reference-${index + 1}.png`,
        original_width: 512,
        original_height: 768,
        transmitted_width: index ? 1472 : 1024,
        transmitted_height: index ? 1472 : 1536,
        type: index ? "character&style" : "character",
        strength: index ? -0.25 : 0.8,
        fidelity: index ? 1.2 : 0.7,
      })),
    },
  });
  const storedPayload = JSON.parse(await readFile(path.join(rootDir, saved.payload_path), "utf8"));
  assert.equal(storedPayload.parameters.director_reference_images.length, 2);
  assert.equal(storedPayload.parameters.director_reference_images[0].storage, "generation_asset");
  assert.equal(storedPayload.parameters.director_reference_images[0].byte_length, referenceBytes[0].length);
  assert.equal(JSON.stringify(storedPayload).includes("Zmlyc3Q="), false);
  const sidecar = JSON.parse(await readFile(path.join(rootDir, saved.sidecar_path), "utf8"));
  assert.equal(sidecar.reference_assets.length, 2);
  assert.equal(sidecar.reference_assets[0].image_filename.endsWith(".reference-01.png"), true);
  assert.equal(sidecar.reference_assets[1].image_filename.endsWith(".reference-02.png"), true);
  for (const item of sidecar.reference_assets) await access(path.join(rootDir, item.image_filename));

  const html = await readFile("index.html", "utf8");
  const controller = await readFile("src/ui/precise-reference-controller.js", "utf8");
  for (const id of ["preciseReferenceInput", "preciseReferenceList", "preciseReferenceCount", "preciseReferenceWarning"]) {
    assert.equal(html.includes(`id="${id}"`), true, `missing UI element ${id}`);
  }
  for (const type of ["character", "style", "character&style"]) assert.equal(controller.includes(type), true);

  await store.deleteGeneration(saved.id);
  assert.deepEqual(await readdir(path.dirname(path.join(rootDir, saved.image_path))), []);

  console.log(JSON.stringify({
    ok: true,
    no_reference_payloads_unchanged: modes.length,
    active_reference_order_preserved: true,
    type_mapping: Object.values(PRECISE_REFERENCE_TYPES),
    history_assets_redacted_and_deleted: true,
  }));
} finally {
  await rm(rootDir, { recursive: true, force: true });
}

function reference(id, type, strength, fidelity) {
  return {
    id,
    enabled: true,
    type,
    strength,
    fidelity,
    image_base64: Buffer.from(id).toString("base64"),
    source_info: { file_name: `${id}.png` },
  };
}
