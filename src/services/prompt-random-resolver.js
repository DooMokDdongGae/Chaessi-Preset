const RANDOM_BLOCK_PATTERN = /\|\|([\s\S]*?)\|\|/g;

export function resolvePresetRandomPrompts(preset, randomFn = Math.random) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) return preset;

  const resolved = cloneJson(preset);
  if (!resolved.prompt_parts || typeof resolved.prompt_parts !== "object") return resolved;

  resolved.prompt_parts.base = resolveRandomPromptText(resolved.prompt_parts.base, randomFn);
  resolved.prompt_parts.undesired = resolveRandomPromptText(resolved.prompt_parts.undesired, randomFn);

  if (Array.isArray(resolved.prompt_parts.characters)) {
    resolved.prompt_parts.characters = resolved.prompt_parts.characters.map((character) => {
      if (!character || typeof character !== "object" || Array.isArray(character)) return character;
      return {
        ...character,
        prompt: resolveRandomPromptText(character.prompt, randomFn),
        undesired: resolveRandomPromptText(character.undesired, randomFn),
      };
    });
  }

  return resolved;
}

export function resolveRandomPromptText(text, randomFn = Math.random) {
  if (typeof text !== "string" || !text.includes("||")) return text;

  return text.replace(RANDOM_BLOCK_PATTERN, (match, optionText) => {
    const options = optionText
      .split("|")
      .map((option) => option.trim())
      .filter(Boolean);
    if (!options.length) return match;
    const index = Math.min(options.length - 1, Math.floor(clampRandom(randomFn()) * options.length));
    return options[index];
  });
}

function clampRandom(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value >= 1) return 0.999999999999;
  return value;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
