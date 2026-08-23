import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolvePresetRandomPrompts } from "./src/services/prompt-random-resolver.js";
import { NovelAiT5Tokenizer } from "./src/ui/novelai-t5-tokenizer.js";
import {
  analyzePresetPromptTokens,
  countPromptText,
  expandRandomPrompt,
  formatPromptTokenCounter,
  getPromptTokenCounterState,
} from "./src/ui/prompt-token-counter.js";

const definition = JSON.parse(await readFile(
  new URL("./assets/tokenizers/google-t5-small-vocab.json", import.meta.url),
  "utf8",
));
const tokenizer = new NovelAiT5Tokenizer(definition);

const preset = {
  prompt_parts: {
    base: "girl",
    undesired: "",
    characters: [{ id: "c1", enabled: true, prompt: "girl, ", undesired: "" }],
  },
  params: { qualityToggle: true, ucPreset: 0 },
};
const analysis = analyzePresetPromptTokens(preset, tokenizer);
assert.deepEqual(analysis.basePrompt, {
  min: 10,
  max: 10,
  estimated: false,
  combinations: 1,
  context: { min: 14, max: 14, estimated: false },
});
assert.equal(analysis.characters[0].prompt.min, 4);
assert.deepEqual(analysis.positiveContext, { min: 14, max: 14, estimated: false });
assert.equal(analysis.baseUndesired.min, 77);
assert.equal(analysis.characters[0].undesired.min, 1);
assert.deepEqual(analysis.negativeContext, { min: 78, max: 78, estimated: false });

const withoutQuality = structuredClone(preset);
withoutQuality.params.qualityToggle = false;
assert.equal(analyzePresetPromptTokens(withoutQuality, tokenizer).basePrompt.min, 2);

const disabledCharacter = structuredClone(preset);
disabledCharacter.prompt_parts.characters[0].enabled = false;
const disabledAnalysis = analyzePresetPromptTokens(disabledCharacter, tokenizer);
assert.equal(disabledAnalysis.characters.length, 0);
assert.equal(disabledAnalysis.positiveContext.max, 10);
assert.equal(disabledAnalysis.negativeContext.max, 77);

function assertExactMaximum(text) {
  const expanded = expandRandomPrompt(text, Number.MAX_SAFE_INTEGER, tokenizer);
  const expected = Math.max(...expanded.variants.map((variant) => tokenizer.count(variant)));
  const range = countPromptText(text, tokenizer);
  assert.equal(range.max, expected, text);
  assert.equal(range.estimated, false, text);
  assert.notEqual(range.max, tokenizer.count(text), `Unresolved syntax was counted: ${text}`);
  return range;
}

for (const text of [
  "||a|B|c||",
  "girl, ||red dress|blue jacket|black evening gown||",
  "||red|blue|deep crimson||, long hair",
  "portrait of ||a woman|two women|a woman standing beside a window||, soft lighting",
  "||red|blue|| dress, ||indoors|city street|luxury hotel lobby||",
]) {
  assertExactMaximum(text);
}

const randomRange = countPromptText("||red|blue|deep crimson||", tokenizer);
assert.deepEqual(randomRange, { min: 2, max: 6, estimated: false, combinations: 3 });
assert.equal(formatPromptTokenCounter(randomRange, 512), "6 tokens | context 6 / 512");
assert.equal(formatPromptTokenCounter(randomRange, 512).includes("-"), false);

const twoBlocks = expandRandomPrompt(
  "||red|blue|| dress, ||smiling|shy|| expression",
  256,
  tokenizer,
);
assert.equal(twoBlocks.exact, true);
assert.equal(twoBlocks.variants.length, 4);
assert.ok(twoBlocks.variants.includes("blue dress, shy expression"));

assert.ok(tokenizer.count("abcdefghijk") > tokenizer.count("internationalization"));
assert.ok("abcdefghijk".length < "internationalization".length);
const tokenOrderRange = assertExactMaximum("||internationalization|abcdefghijk||");
assert.equal(tokenOrderRange.max, tokenizer.count("abcdefghijk"));

const emptyBlock = "||||";
const emptyPreset = structuredClone(preset);
emptyPreset.prompt_parts.base = emptyBlock;
const emptyResolved = resolvePresetRandomPrompts(emptyPreset, () => 0);
assert.equal(emptyResolved.prompt_parts.base, emptyBlock);
assert.equal(countPromptText(emptyBlock, tokenizer).max, tokenizer.count(emptyBlock));

const exactly256 = Array(4).fill("||a|B|c|deep crimson||").join(", ");
const exactly256Expanded = expandRandomPrompt(exactly256, 256, tokenizer);
assert.equal(exactly256Expanded.exact, true);
assert.equal(exactly256Expanded.combinations, 256);
assert.equal(exactly256Expanded.variants.length, 256);
assertExactMaximum(exactly256);

const over256 = Array(5).fill("||internationalization|abcdefghijk|A|B||").join(", ");
const over256Set = expandRandomPrompt(over256, 256, tokenizer);
assert.equal(over256Set.exact, false);
assert.equal(over256Set.combinations, 1024);
assert.equal(over256Set.variants.length, 1);
assert.equal(over256Set.variants[0].includes("||"), false);
assert.equal(over256Set.variants[0].includes("|"), false);
assert.equal(over256Set.variants[0], Array(5).fill("abcdefghijk").join(", "));
const over256Range = countPromptText(over256, tokenizer, 256);
assert.equal(over256Range.estimated, true);
assert.equal(over256Range.min, over256Range.max);
assert.equal(over256Range.max, tokenizer.count(over256Set.variants[0]));
assert.notEqual(over256Range.max, tokenizer.count(over256));

const manyBlocks = Array(100).fill("||a|B|c||").join(", ");
const startedAt = performance.now();
const manyRange = countPromptText(manyBlocks, tokenizer, 256);
const elapsedMs = performance.now() - startedAt;
assert.equal(manyRange.estimated, true);
assert.equal(manyRange.min, manyRange.max);
assert.ok(elapsedMs < 1000, `Large Random Prompt count took ${elapsedMs.toFixed(1)}ms`);

for (const [wordCount, expectedTotal, expectedState] of [
  [498, 511, "near"],
  [499, 512, "near"],
  [500, 513, "over"],
]) {
  const boundaryPreset = structuredClone(preset);
  boundaryPreset.prompt_parts.base = Array(wordCount).fill("girl").join(" ");
  const boundary = analyzePresetPromptTokens(boundaryPreset, tokenizer);
  assert.equal(boundary.positiveContext.max, expectedTotal);
  assert.equal(getPromptTokenCounterState(boundary.basePrompt, boundary.limit), expectedState);
}

const randomPreset = structuredClone(preset);
randomPreset.prompt_parts.base = "||red|blue|deep crimson|| dress";
const original = structuredClone(randomPreset);
const resolved = resolvePresetRandomPrompts(randomPreset, () => 0.5);
assert.deepEqual(randomPreset, original);
assert.equal(resolved.prompt_parts.base.includes("||"), false);
const resolvedAnalysis = analyzePresetPromptTokens(resolved, tokenizer);
assert.equal(resolvedAnalysis.basePrompt.min, resolvedAnalysis.basePrompt.max);
assert.equal(resolvedAnalysis.basePrompt.estimated, false);

console.log("Prompt token counter tests passed.");
