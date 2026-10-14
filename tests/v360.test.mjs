import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createDefaultPreset } from "../src/state/preset-schema.js";
import { switchPresetModel } from "../src/state/model-state.js";
import { switchPresetEffort, effectiveGenerationPreset } from "../src/state/effort-state.js";
import { buildModeGeneratePayload, validateModeGeneratePayload } from "../src/adapters/novelai-v45-generation-modes.js";
import { validateV5Payload, validateMediumContract } from "../src/adapters/novelai-v5-full.js";
import { resolveGenerationPrompts, createPreparedPromptStore } from "../src/services/generation-prompt-resolver.js";
import { createPresetStore } from "../src/services/preset-store.js";
import { createGenerationStore } from "../src/services/generation-store.js";
import { receivedImageToPng } from "../src/services/generation-png.js";
import { parseRawJsonImport } from "../src/importers/raw-json-import.js";
import { parseNovelAiPngMetadata } from "../src/importers/nai-metadata.js";
import { createPromptWorkflow } from "../src/ui/prompt-workflow.js";
import { messages } from "../src/ui/translations.js";
const make = (effort = "high") => createDefaultPreset({ params: { model: "nai-diffusion-5-full", effort, steps: 31, sampler: "k_dpmpp_2m", cfg_rescale: .2, ucPreset: 1, seed: 424242424 },
  prompt_parts: { base: "2girls, ||standing|sitting||, __scene__, -3::hat::", undesired: "__missing_uc__", characters: [{ prompt: "adult, blue hair", undesired: "__missing_char_uc__", centers: [{ x: .309, y: .508 }], position_mode: "custom" }] } });

test("Medium freezes only generation inputs and bypasses inactive missing Wildcards", () => {
  const preset = make("medium"), original = structuredClone(preset);
  const resolved = resolveGenerationPrompts(preset, [{ key: "scene", entries: ["laboratory"] }], () => 0);
  assert.equal(resolved.prompt_parts.base, "2girls, standing, laboratory, -3::hat::");
  assert.equal(resolved.prompt_parts.undesired, "");
  for (const mode of ["text-to-image", "image-to-image", "inpaint"]) {
    const state = { mode, width: 832, height: 1216, source_image_base64: "AQ==", mask_image_base64: "AQ==", strength: .6, noise: .1, i2i_strength: .4, i2i_noise: .1 };
    const payload = buildModeGeneratePayload(resolved, state);
    assert.deepEqual(validateMediumContract(payload), []);
    assert.equal(mode === "text-to-image" ? validateV5Payload(payload).ok : validateModeGeneratePayload(payload, state).ok, true);
    assert.equal(validateModeGeneratePayload(payload, state).ok, true);
    assert.equal(payload.parameters.image_format, mode === "inpaint" ? "png" : "webp");
    assert.equal(payload.parameters.img2img, undefined);
    assert.equal(payload.parameters.characterPrompts[0].uc, "");
    assert.equal(payload.parameters.v4_prompt.caption.char_captions[0].centers[0].x, .309);
    assert.equal(payload.parameters.steps, 14); assert.equal(Object.hasOwn(payload.parameters, "cfg_rescale"), false);
    const snapshot = effectiveGenerationPreset(resolved, payload);
    assert.equal(snapshot.params.effort, "medium"); assert.equal(snapshot.params.steps, 14);
  }
  assert.deepEqual(preset, original);
  assert.throws(() => resolveGenerationPrompts(make(), [{ key: "scene", entries: ["laboratory"] }], () => 0), /missing/);
});

test("Effort restores five remembered fields, shares Guidance and does not replace prompts", () => {
  const high = make(); const medium = switchPresetEffort(high, "medium");
  medium.params.scale = 4; medium.params.width = 1024;
  const restored = switchPresetEffort(medium, "high");
  assert.equal(restored.params.steps, 31); assert.equal(restored.params.sampler, "k_dpmpp_2m"); assert.equal(restored.params.ucPreset, 1);
  assert.equal(restored.params.cfg_rescale, .2); assert.equal(restored.params.scale, 4); assert.equal(restored.params.width, 1024);
  assert.deepEqual(restored.prompt_parts, high.prompt_parts);
  medium.params.steps = 14;
  assert.equal(switchPresetModel(medium, "nai-diffusion-5-full").params.steps, 31);
  assert.throws(() => buildModeGeneratePayload({ ...high, params: { ...high.params, effort: "unknown" } }), /Choose/);
});

test("Prepared snapshots cannot be reused across generation modes or used twice", () => {
  const store = createPreparedPromptStore(); store.put("x", make("medium"), "inpaint");
  assert.throws(() => store.take("x", "text-to-image"), /mode changed/);
  assert.equal(store.take("x", "inpaint").params.effort, "medium"); assert.throws(() => store.take("x", "inpaint"), /expired/);
});

test("Import uses actual variant or known hash, never just 14 Steps", () => {
  for (const hash of ["70AB5786", "93F4BD30"]) assert.equal(parseRawJsonImport({ model_name: "NovelAI Diffusion V5", model_hash: hash, steps: 14 }).parsed.params.effort, "medium");
  assert.equal(parseRawJsonImport({ model: "nai-diffusion-5-full-medium-inpainting", parameters: { steps: 14 } }).parsed.params.effort, "medium");
  assert.equal(parseRawJsonImport({ model_name: "NovelAI Diffusion V5", steps: 14 }).parsed.params.effort, "unknown");
  assert.equal(parseRawJsonImport({ model: "nai-diffusion-5-full", parameters: { steps: 14 } }).parsed.params.effort, "high");
});

test("WebP becomes PNG without losing RGBA, Effort or reusable prompt metadata", async () => {
  const pixels = Buffer.from(Array.from({ length: 64 * 64 * 4 }, (_, i) => i % 4 === 3 ? [0, 128, 255][Math.floor(i / 4) % 3] : (i * 37) % 256));
  const webp = await sharp(pixels, { raw: { width: 64, height: 64, channels: 4 } }).webp({ lossless: true }).toBuffer();
  const preset = make("medium"); preset.prompt_parts.base = "adult, blue hair";
  const payload = buildModeGeneratePayload(preset);
  const result = await receivedImageToPng(webp, payload);
  const before = await sharp(webp).raw().toBuffer(), after = await sharp(result.imageBytes).raw().toBuffer();
  assert.deepEqual(after, before);
  const imported = parseNovelAiPngMetadata(result.imageBytes);
  assert.equal(imported.parsed.params.effort, "medium"); assert.equal(imported.parsed.params.steps, 14);
  assert.equal(imported.parsed.base_prompt, "adult, blue hair");
  assert.equal((await receivedImageToPng(result.imageBytes, payload)).imageBytes, result.imageBytes);
});

test("Overwrite preserves old v2 data in revisions; concurrent saves preserve each previous state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-v360-revisions-"));
  try {
    const store = createPresetStore({ rootDir: root }); const preset = make();
    preset.metadata.schema = "chaessi-preset/v2"; preset.prompt_parts.base = "first";
    let saved = await store.savePreset(preset); const id = saved.metadata.id;
    await Promise.all(["second", "third"].map(base => store.savePreset({ ...saved, prompt_parts: { ...saved.prompt_parts, base } })));
    const revisions = await store.listPresetRevisions(id); assert.equal(revisions.length, 2);
    const texts = await Promise.all(revisions.map(async item => (await store.getPresetRevision(id, item.revision_id)).prompt_parts.base));
    assert.deepEqual(new Set(texts), new Set(["first", "second"]));
    assert.equal((await store.getPreset(id)).prompt_parts.base, "third");
    await assert.rejects(store.getPresetRevision(id, "../escape"));
    const workflow = createPromptWorkflow(); workflow.markSaved(saved);
    const changed = { ...saved, prompt_parts: { ...saved.prompt_parts, base: "edited" } };
    assert.equal(workflow.isDirty(changed), true); workflow.checkpoint(changed);
    assert.equal(workflow.saved().prompt_parts.base, "first");
    assert.equal(workflow.swapPrevious(saved).prompt_parts.base, "edited");
    const gen = buildModeGeneratePayload(make("medium"));
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } }).png().toBuffer();
    const history = createGenerationStore({ rootDir: root });
    const item = await history.saveGeneration({ preset: effectiveGenerationPreset(make("medium"), gen), payload: gen, imageBytes: png, responseInfo: {} });
    assert.equal(item.sidecar.generation.effort, "medium"); assert.equal(item.sidecar.generation.ucPreset, 0);
    assert.equal(item.sidecar.request.endpoint.endsWith("generate-image-stream"), true);
    assert.equal((await history.listGenerations())[0].effort, "medium");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("V5 High Inpaint exactly matches frozen v3.5.0 requests at the same inputs", async () => {
  const fixtures = JSON.parse(await readFile(new URL("./fixtures/v350-high-inpaint.json", import.meta.url)));
  for (const fixture of fixtures.cases) assert.deepEqual(buildModeGeneratePayload(fixture.preset, fixture.modeState), fixture.payload, fixture.name);
  for (const [file, expected] of Object.entries(fixtures.unchangedFiles)) assert.equal(createHash("sha256").update((await readFile(new URL(`../${file}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n")).digest("hex"), expected, file);
});

test("New workflow and Effort text has Korean, English and Japanese translations", () => {
  for (const key of ["Effort", "High", "Medium", "Restore saved", "Previous work", "Saved revisions", "V4.5 Full (legacy data)"]) {
    for (const locale of ["ko", "en", "ja"]) assert.ok(messages[key]?.[locale], `${locale} ${key}`);
  }
});

test("High/Medium compiler matches independent official Quality/text/chunk requests and imports without double suffixes", async () => {
  const fixtures = JSON.parse(await readFile(new URL("./fixtures/official-v5-contract.json", import.meta.url)));
  for (const fixture of fixtures.cases) {
    const payload = buildModeGeneratePayload(fixture.preset);
    assert.deepEqual(payload, fixture.payload, fixture.name);
    const parsed = parseRawJsonImport(payload);
    assert.equal(parsed.parsed.base_prompt, fixture.preset.prompt_parts.base, fixture.name);
  }
  const preset = make(); preset.params.seed = 0;
  assert.equal(buildModeGeneratePayload(preset, { mode: "image-to-image", width: 832, height: 1216, source_image_base64: "AQ==" }).parameters.extra_noise_seed, -1);
  assert.equal(buildModeGeneratePayload(preset, { mode: "inpaint", width: 832, height: 1216, source_image_base64: "AQ==", mask_image_base64: "AQ==" }).parameters.extra_noise_seed, 0);
});
