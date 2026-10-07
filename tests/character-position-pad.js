import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPresetStore } from "../src/services/preset-store.js";
import { parseRawJsonImport } from "../src/importers/raw-json-import.js";
import { applyImportToPreset } from "../src/importers/import-to-preset.js";
import {
  clampPosition,
  findPositionOverlaps,
  getPositionPadAspect,
  normalizePointerPosition,
  roundPosition,
} from "../src/ui/character-position-pad.js";
import { buildV5GeneratePayload } from "../src/adapters/novelai-v5-full.js";
import { createDefaultPreset } from "../src/state/preset-schema.js";
import { NOVELAI_V45_FULL_MODEL, NOVELAI_V5_FULL_MODEL } from "../src/state/model-profiles.js";
import { switchPresetModel, syncActiveModelState } from "../src/state/model-state.js";

assert.deepEqual(normalizePointerPosition({ clientX: 50, clientY: 100 }, { left: 0, top: 0, width: 100, height: 200 }), { x: 0.5, y: 0.5 });
assert.deepEqual(normalizePointerPosition({ clientX: 0, clientY: 0 }, { left: 0, top: 0, width: 100, height: 200 }), { x: 0, y: 0 });
assert.deepEqual(normalizePointerPosition({ clientX: 100, clientY: 0 }, { left: 0, top: 0, width: 100, height: 200 }), { x: 1, y: 0 });
assert.deepEqual(normalizePointerPosition({ clientX: 0, clientY: 200 }, { left: 0, top: 0, width: 100, height: 200 }), { x: 0, y: 1 });
assert.deepEqual(normalizePointerPosition({ clientX: 100, clientY: 200 }, { left: 0, top: 0, width: 100, height: 200 }), { x: 1, y: 1 });
assert.deepEqual(normalizePointerPosition({ clientX: -20, clientY: 250 }, { left: 0, top: 0, width: 100, height: 200 }), { x: 0, y: 1 });
assert.equal(clampPosition(-1), 0);
assert.equal(clampPosition(2), 1);
assert.equal(roundPosition(0.12349), 0.123);
assert.equal(roundPosition(0.1235), 0.124);
assert.equal(getPositionPadAspect(832, 1216), 832 / 1216);
assert.equal(getPositionPadAspect(1024, 1024), 1);
assert.equal(getPositionPadAspect(1216, 832), 1216 / 832);

const characters = Array.from({ length: 32 }, (_, index) => ({
  id: `character_${index + 1}`,
  name: `Character ${index + 1}`,
  enabled: true,
  prompt: `character ${index + 1}`,
  undesired: "",
  centers: [{ x: index === 0 ? 0.5 : Math.min(1, index / 31), y: 0.5 }],
  position_mode: "custom",
}));
characters[1].centers[0] = { x: 0.599, y: 0.5 };
assert.equal(findPositionOverlaps(characters.slice(0, 2)).length, 1, "distance below 0.1 warns");
characters[1].centers[0] = { x: 0.6, y: 0.5 };
assert.equal(findPositionOverlaps(characters.slice(0, 2)).length, 0, "distance exactly 0.1 does not warn");

let preset = createDefaultPreset({
  prompt_parts: { base: "portrait", undesired: "", characters },
  params: { model: NOVELAI_V5_FULL_MODEL, width: 832, height: 1216 },
});
const originalCenters = structuredClone(preset.prompt_parts.characters.map((character) => character.centers));
preset.prompt_parts.characters.forEach((character) => { character.position_mode = "auto"; });
assert.deepEqual(preset.prompt_parts.characters.map((character) => character.centers), originalCenters, "AI's Choice preserves centers");
let payload = buildV5GeneratePayload(preset);
assert.equal(payload.parameters.use_coords, false);
preset.prompt_parts.characters.forEach((character) => { character.position_mode = "custom"; });
payload = buildV5GeneratePayload(preset);
assert.equal(payload.parameters.use_coords, true);
assert.deepEqual(payload.parameters.characterPrompts[0].center, originalCenters[0][0]);

preset = syncActiveModelState(preset);
const v45 = switchPresetModel(preset, NOVELAI_V45_FULL_MODEL);
const restored = switchPresetModel(v45, NOVELAI_V5_FULL_MODEL);
assert.deepEqual(restored.prompt_parts.characters.map((character) => character.centers), originalCenters, "V4.5/V5 round trip preserves all centers");

const [html, appSource] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../src/app.js", import.meta.url), "utf8"),
]);
assert.match(html, /id="characterPositionPadPanel" hidden/);
assert.match(appSource, /visible: profile\.family === "v5" && \$\("characterPositionMode"\)\.value === "custom"/);
assert.match(appSource, /positionStep = .*"v5" \? "0\.001" : "0\.01"/);
assert.match(appSource, /characterPositionPadController\?\.setPosition\(index,[\s\S]*?notify: false/);
assert.match(appSource, /onPositionChange: applyCharacterPositionChange/);
assert.match(appSource, /\.\.\.structuredClone\(\(state\.currentPreset\.prompt_parts\?\.characters\?\.\[index\]\?\.centers \|\| \[\]\)\.slice\(1\)\)/);

console.log("Character Position Pad math, overlap, preservation, wiring, and V5 payload tests passed.");

const rootDir = await mkdtemp(path.join(os.tmpdir(), 'chaessi-position-roundtrip-'));
try {
  const store = createPresetStore({ rootDir });
  const saved = await store.savePreset(preset);
  const loaded = await store.getPreset(saved.metadata.id);
  assert.deepEqual(loaded.prompt_parts, preset.prompt_parts);
  assert.deepEqual(loaded.model_states, preset.model_states);
  const imported = parseRawJsonImport(payload);
  const applied = applyImportToPreset(createDefaultPreset(), imported, { applyBasePrompt: true, applyUndesired: true, applyCharacters: true, applyParams: true });
  assert.deepEqual(applied.preset.prompt_parts.characters.map(c => c.centers), originalCenters);
  assert.equal(applied.preset.prompt_parts.characters.every(c => c.position_mode === 'custom'), true);
  const metadataImport = parseRawJsonImport({
    Source: 'NovelAI Diffusion V5 0ADF9AB7',
    Comment: JSON.stringify({ ...payload.parameters, prompt: payload.input, model_name: 'NovelAI Diffusion V5' }),
  });
  assert.deepEqual(metadataImport.parsed.characters.map(c => c.centers), originalCenters);
  console.log('Preset disk Save/Load and raw payload Position import passed.');
} finally {
  await rm(rootDir, { recursive: true, force: true });
}
