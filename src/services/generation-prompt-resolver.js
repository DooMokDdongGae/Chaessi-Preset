import { randomInt } from "node:crypto";
import { resolveRandomPromptText } from "./prompt-random-resolver.js";
import { storeError } from "./file-store-utils.js";

// Only generation snapshots pass through this function. The saved editing preset stays untouched.
export function resolveGenerationPrompts(preset, wildcards, pickIndex = randomInt) {
  const resolved = structuredClone(preset);
  const byKey = new Map(wildcards.map(item => [item.key, item]));
  const random = () => pickIndex(0x1000000) / 0x1000000;
  function resolve(text, location) {
    let output = resolveRandomPromptText(text, random);
    output = output.replace(/__([^\s]+?)__/g, (_, key) => {
      const wildcard = byKey.get(key);
      if (!wildcard?.entries?.length) throw storeError(400, "wildcard_missing", `Wildcard __${key}__ is missing or empty in ${location}.`);
      return resolveRandomPromptText(wildcard.entries[pickIndex(wildcard.entries.length)], random);
    });
    if (/__[^\s]+?__/.test(output)) throw storeError(400, "unresolved_wildcard", `Unresolved Wildcard in ${location}.`);
    return output;
  }
  resolved.prompt_parts.base = resolve(resolved.prompt_parts.base, "Base Prompt");
  resolved.prompt_parts.undesired = resolve(resolved.prompt_parts.undesired, "Undesired");
  resolved.prompt_parts.characters = resolved.prompt_parts.characters
    .filter(character => character.enabled !== false)
    .map((character, index) => ({ ...character,
      prompt: resolve(character.prompt, `Character ${index + 1} Prompt`),
      undesired: resolve(character.undesired, `Character ${index + 1} Undesired`),
    }));
  // Prevent templates in inactive models or imported source snapshots leaking into History.
  delete resolved.model_states;
  resolved.sources = { imported_raw_payload: null, imported_image_metadata: null };
  return resolved;
}

export function createPreparedPromptStore({ now = Date.now, ttl = 5 * 60_000, limit = 32 } = {}) {
  const items = new Map();
  function prune() { for (const [id, item] of items) if (item.expires <= now()) items.delete(id); }
  return {
    put(id, preset) {
      prune();
      while (items.size >= limit) items.delete(items.keys().next().value);
      items.set(id, { expires: now() + ttl, preset: structuredClone(preset) });
    },
    take(id) {
      prune();
      const item = items.get(id);
      if (!item) throw storeError(409, "prepared_prompt_expired", "Prepared prompt expired or was already used. Click Generate again.");
      items.delete(id);
      return item.preset;
    },
  };
}
