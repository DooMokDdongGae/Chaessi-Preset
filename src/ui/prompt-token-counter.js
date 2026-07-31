export const NOVELAI_V45_FULL_TOKEN_PROFILE = Object.freeze({
  model: "nai-diffusion-4-5-full",
  tokenizer: "google-t5-small-compatible",
  promptLimit: 512,
  randomCombinationLimit: 256,
  qualitySuffix: ", very aesthetic, masterpiece, no text",
  ucPresets: Object.freeze([
    "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page",
    "lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page",
    "{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, {sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, everyone, [sketch background], simple, [flat colors], ych (character), outline, multiple scenes, [[horror (theme)]], comic",
    "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy",
    "",
  ]),
});

const RANDOM_BLOCK_PATTERN = /\|\|([\s\S]*?)\|\|/g;

export function analyzePresetPromptTokens(
  preset,
  tokenizer,
  profile = NOVELAI_V45_FULL_TOKEN_PROFILE,
) {
  const promptParts = preset?.prompt_parts ?? {};
  const params = preset?.params ?? {};
  const characters = Array.isArray(promptParts.characters)
    ? promptParts.characters.filter((character) => character?.enabled !== false)
    : [];
  const rawBaseVariants = expandRandomPrompt(
    promptParts.base,
    profile.randomCombinationLimit,
    tokenizer,
  );
  const basePrompt = countVariantSet(
    transformVariantSet(rawBaseVariants, (text) => params.qualityToggle === false
      ? text
      : `${text}${profile.qualitySuffix}`),
    tokenizer,
  );
  const characterPrompts = characters.map((character) => countPromptText(
    character?.prompt,
    tokenizer,
    profile.randomCombinationLimit,
  ));

  const rawUndesiredVariants = expandRandomPrompt(
    promptParts.undesired,
    profile.randomCombinationLimit,
    tokenizer,
  );
  const baseUndesired = countBaseUndesired(
    rawBaseVariants,
    rawUndesiredVariants,
    tokenizer,
    params.ucPreset,
    profile,
  );
  const characterUndesired = characters.map((character) => countPromptText(
    character?.undesired,
    tokenizer,
    profile.randomCombinationLimit,
  ));

  const positiveContext = sumRanges([basePrompt, ...characterPrompts]);
  const negativeContext = sumRanges([baseUndesired, ...characterUndesired]);
  return {
    model: profile.model,
    limit: profile.promptLimit,
    basePrompt: withContext(basePrompt, positiveContext),
    baseUndesired: withContext(baseUndesired, negativeContext),
    characters: characters.map((character, index) => ({
      id: character.id,
      prompt: withContext(characterPrompts[index], positiveContext),
      undesired: withContext(characterUndesired[index], negativeContext),
    })),
    positiveContext,
    negativeContext,
  };
}

export function formatPromptTokenCounter(range, limit = 512) {
  if (!range) return "Unavailable";
  return `${range.max} tokens | context ${range.context?.max ?? range.max} / ${limit}`;
}

export function getPromptTokenCounterState(range, limit = 512) {
  const maximum = range?.context?.max ?? 0;
  if (maximum > limit) return "over";
  if (maximum >= limit * 0.8) return "near";
  return "normal";
}

export function countPromptText(text, tokenizer, combinationLimit = 256) {
  return countVariantSet(expandRandomPrompt(text, combinationLimit, tokenizer), tokenizer);
}

export function expandRandomPrompt(text, combinationLimit = 256, tokenizer = null) {
  const source = String(text ?? "");
  const blocks = [];
  let cursor = 0;
  for (const match of source.matchAll(RANDOM_BLOCK_PATTERN)) {
    blocks.push({ staticText: source.slice(cursor, match.index), options: parseRandomOptions(match) });
    cursor = match.index + match[0].length;
  }
  if (!blocks.length) return { exact: true, variants: [source], combinations: 1 };

  const suffix = source.slice(cursor);
  const combinations = blocks.reduce((total, block) => total * block.options.length, 1);
  if (combinations > combinationLimit) {
    if (!tokenizer) {
      throw new Error("A tokenizer is required to estimate large Random Prompt combinations.");
    }
    return {
      exact: false,
      variants: [buildEstimatedMaximumVariant(blocks, suffix, tokenizer)],
      combinations,
    };
  }

  let variants = [""];
  for (const block of blocks) {
    variants = variants.flatMap((prefix) => block.options.map(
      (option) => `${prefix}${block.staticText}${option}`,
    ));
  }
  return {
    exact: true,
    variants: variants.map((variant) => `${variant}${suffix}`),
    combinations,
  };
}

function parseRandomOptions(match) {
  const options = match[1].split("|").map((option) => option.trim()).filter(Boolean);
  return options.length ? options : [match[0]];
}

function buildEstimatedMaximumVariant(blocks, suffix, tokenizer) {
  return blocks.map((block) => {
    const option = selectHighestTokenVariant(block.options, tokenizer);
    return `${block.staticText}${option}`;
  }).join("") + suffix;
}

function selectHighestTokenVariant(variants, tokenizer) {
  let highest = variants[0] ?? "";
  let highestCount = tokenizer.count(highest);
  for (const variant of variants.slice(1)) {
    const count = tokenizer.count(variant);
    if (count > highestCount) {
      highest = variant;
      highestCount = count;
    }
  }
  return highest;
}

function transformVariantSet(set, transform) {
  return { ...set, variants: set.variants.map(transform) };
}

function countVariantSet(set, tokenizer) {
  const counts = set.variants.map((variant) => tokenizer.count(variant));
  return {
    min: Math.min(...counts),
    max: Math.max(...counts),
    estimated: !set.exact,
    combinations: set.combinations ?? counts.length,
  };
}

function countBaseUndesired(baseSet, undesiredSet, tokenizer, ucPreset, profile) {
  const presetIndex = normalizePresetIndex(ucPreset, profile.ucPresets.length);
  if (!baseSet.exact || !undesiredSet.exact
    || baseSet.variants.length * undesiredSet.variants.length > profile.randomCombinationLimit) {
    const base = selectHighestTokenVariant(baseSet.variants, tokenizer);
    const undesired = selectHighestTokenVariant(undesiredSet.variants, tokenizer);
    const count = tokenizer.count(applyUcPreset(base, undesired, presetIndex, profile));
    return {
      min: count,
      max: count,
      estimated: true,
      combinations: (baseSet.combinations ?? 1) * (undesiredSet.combinations ?? 1),
    };
  }

  const counts = [];
  for (const base of baseSet.variants) {
    for (const undesired of undesiredSet.variants) {
      counts.push(tokenizer.count(applyUcPreset(base, undesired, presetIndex, profile)));
    }
  }
  return {
    min: Math.min(...counts),
    max: Math.max(...counts),
    estimated: false,
    combinations: counts.length,
  };
}

function applyUcPreset(basePrompt, undesired, presetIndex, profile) {
  const presetText = profile.ucPresets[presetIndex] ?? profile.ucPresets.at(-1) ?? "";
  let output = String(undesired ?? "").split("|").map((segment, index) => {
    if (index !== 0 || !presetText) return segment;
    return segment ? `${presetText}, ${segment}` : presetText;
  }).join("|");
  if (presetText && !String(basePrompt ?? "").toLowerCase().includes("nsfw")) {
    output = `nsfw, ${output}`;
  }
  return output;
}

function normalizePresetIndex(value, length) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed < length ? parsed : length - 1;
}

function sumRanges(ranges) {
  return {
    min: ranges.some((range) => range.min == null)
      ? null
      : ranges.reduce((total, range) => total + range.min, 0),
    max: ranges.reduce((total, range) => total + range.max, 0),
    estimated: ranges.some((range) => range.estimated),
  };
}

function withContext(range, context) {
  return { ...range, context };
}
