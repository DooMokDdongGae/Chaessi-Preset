import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { buildV5GeneratePayload, validateV5Payload } from "./src/adapters/novelai-v5-full.js";
import { parseRawJsonImport } from "./src/importers/raw-json-import.js";
import { applyImportToPreset } from "./src/importers/import-to-preset.js";
import { createDefaultPreset } from "./src/state/preset-schema.js";
import { NOVELAI_V45_FULL_MODEL, NOVELAI_V5_FULL_MODEL } from "./src/state/model-profiles.js";
import { getModelProfile } from "./src/state/model-profiles.js";
import { switchPresetModel, syncActiveModelState } from "./src/state/model-state.js";
import { NovelAiQwenTokenizer } from "./src/ui/novelai-qwen-tokenizer.js";
import { analyzePresetPromptTokens, countPromptText, NOVELAI_V5_FULL_TOKEN_PROFILE } from "./src/ui/prompt-token-counter.js";

const compressed = await readFile(new URL("./assets/tokenizers/qwen35-tokenizer.deflate", import.meta.url));
const tokenizer = new NovelAiQwenTokenizer(JSON.parse(inflateRawSync(compressed)));
const [indexHtml, appSource, stylesheet] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./src/app.js", import.meta.url), "utf8"),
  readFile(new URL("./styles.css", import.meta.url), "utf8"),
]);
assert.match(indexHtml, /id="headerModelLabel"[^>]+data-model="nai-diffusion-4-5-full"[^>]+tabindex="0"/);
assert.match(appSource, /modelBadge\.dataset\.model = profile\.id/);
assert.match(stylesheet, /\.model-badge\[data-model="nai-diffusion-4-5-full"\][\s\S]*?#22d3ee/);
assert.match(stylesheet, /\.model-badge\[data-model="nai-diffusion-5-full"\][\s\S]*?#e879f9/);
assert.match(stylesheet, /\.model-badge:focus-visible/);
assert.match(stylesheet, /@media \(max-width: 1100px\)[\s\S]*?\.app-header\s*\{\s*display: grid/);
assert.equal(getModelProfile(NOVELAI_V5_FULL_MODEL).defaults.scale, 5);
for (const [text, count] of [
  ["", 0], ["girl", 1], ["blue_hair", 3], ["blue hair", 2],
  ["A girl stands under moonlight.", 7], ["1.2::girl::", 6],
  ["-0.8::feet::", 8], ["red|blue", 3],
  ["한글 프롬프트", 5], ["日本語のプロンプト", 4],
]) assert.equal(tokenizer.count(text), count, text);
assert.equal(countPromptText("||red dress|blue jacket||", tokenizer).max, Math.max(tokenizer.count("red dress"), tokenizer.count("blue jacket")));
assert.equal(countPromptText("girl, ||red|blue|| dress, ||indoors|street||", tokenizer).combinations, 4);
assert.equal(tokenizer.count(Array(100).fill("girl, ").join("")), 201);

const characters = Array.from({ length: 32 }, (_, index) => ({
  id: `c${index + 1}`, name: `Character ${index + 1}`, enabled: true,
  prompt: "girl", undesired: "", centers: [{ x: index / 31, y: 0.5 }], position_mode: "custom",
}));
let preset = createDefaultPreset({
  prompt_parts: { base: "portrait", undesired: "", characters },
  params: { model: NOVELAI_V5_FULL_MODEL, scale: 7, qualityPreset: "standard", transparentBackground: true },
});
const payload = buildV5GeneratePayload(preset);
assert.equal(validateV5Payload(payload).ok, true);
assert.equal(payload.model, NOVELAI_V5_FULL_MODEL);
assert.equal(payload.parameters.params_version, 4);
assert.equal(payload.parameters.v4_prompt.caption.char_captions.length, 32);
assert.equal(payload.parameters.tag_hint_qt, 1);
assert.equal(payload.parameters.tag_hint_transparent_background, true);
assert.match(payload.input, /transparent background, very aesthetic, masterpiece, no text$/);
assert.equal(payload.parameters.image, undefined);
assert.equal(payload.parameters.director_reference_images, undefined);
assert.equal(payload.parameters.characterPrompts.length, 32);

const tokenAnalysis = analyzePresetPromptTokens(preset, tokenizer, NOVELAI_V5_FULL_TOKEN_PROFILE);
assert.equal(tokenAnalysis.limit, 1471);
assert.equal(tokenAnalysis.characters.length, 32);
assert.equal(tokenAnalysis.positiveContext.max, tokenAnalysis.basePrompt.max + 32);
const negativePreset = structuredClone(preset);
negativePreset.prompt_parts.undesired = "bad";
negativePreset.prompt_parts.characters.forEach((character) => { character.undesired = "bad"; });
const negativeAnalysis = analyzePresetPromptTokens(negativePreset, tokenizer, NOVELAI_V5_FULL_TOKEN_PROFILE);
assert.equal(negativeAnalysis.negativeContext.max, negativeAnalysis.baseUndesired.max + 32 * tokenizer.count("bad"));

preset = syncActiveModelState(preset);
const v45 = switchPresetModel(preset, NOVELAI_V45_FULL_MODEL);
assert.equal(v45.prompt_parts.characters.length, 32);
assert.equal(v45.params.model, NOVELAI_V45_FULL_MODEL);
const restored = switchPresetModel(v45, NOVELAI_V5_FULL_MODEL);
assert.deepEqual(restored.prompt_parts.characters, preset.prompt_parts.characters);
assert.equal(restored.params.transparentBackground, true);

const imported = parseRawJsonImport({
  Source: "NovelAI Diffusion V5 0ADF9AB7",
  Comment: JSON.stringify({ prompt: "portrait", uc: "", model_name: "NovelAI Diffusion V5", width: 832, height: 1216, steps: 23, scale: 7, cfg_rescale: 0, sampler: "k_euler_ancestral", seed: 1, n_samples: 1, noise_schedule: "karras", tag_hint_qt: 3, tag_hint_transparent_background: true, v4_prompt: payload.parameters.v4_prompt, v4_negative_prompt: payload.parameters.v4_negative_prompt }),
});
assert.equal(imported.parsed.params.model, NOVELAI_V5_FULL_MODEL);
assert.equal(imported.parsed.characters.length, 32);
const applied = applyImportToPreset(createDefaultPreset(), imported, { applyBasePrompt: true, applyUndesired: true, applyCharacters: true, applyParams: true });
assert.equal(applied.preset.params.model, NOVELAI_V5_FULL_MODEL);
assert.equal(applied.preset.prompt_parts.characters.length, 32);
assert.equal(applied.preset.model_states[NOVELAI_V5_FULL_MODEL].prompt_parts.characters.length, 32);

const transparentImported = parseRawJsonImport({
  Source: "NovelAI Diffusion V5 0ADF9AB7",
  Comment: JSON.stringify({
    prompt: "1girl, transparent background, very aesthetic, masterpiece, no text",
    uc: "lowres, blurry",
    width: 832, height: 1216, steps: 23, scale: 5, cfg_rescale: 0,
    sampler: "k_euler_ancestral", seed: 2, n_samples: 1, noise_schedule: "karras",
    tag_hint_qt: 1, tag_hint_uc_preset: 0, tag_hint_transparent_background: true,
    model_name: "NovelAI Diffusion V5", model_hash: "0ADF9AB7", signed_hash: "secret-signature",
    image_cache_secret_key: "secret-cache", image: "embedded-source",
  }),
});
assert.equal(transparentImported.parsed.base_prompt, "1girl");
assert.equal(transparentImported.parsed.params.transparentBackground, true);
assert.equal(transparentImported.parsed.params.qualityPreset, "standard");
assert.equal(transparentImported.parsed.params.ucPreset, 4);
assert.equal(transparentImported.parsed.raw_payload.signed_hash, undefined);
assert.equal(transparentImported.parsed.raw_payload.image_cache_secret_key, undefined);
assert.equal(transparentImported.parsed.raw_payload.image, undefined);

console.log("V5 profile, adapter, tokenizer, import, and model-state tests passed.");
