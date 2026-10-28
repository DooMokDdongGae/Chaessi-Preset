import { randomInt } from "node:crypto";
import { resolveRandomPromptText } from "./prompt-random-resolver.js";
import { storeError } from "./file-store-utils.js";
import { getPresetEffort } from "../state/model-profiles.js";

// Only generation snapshots pass through this function. The saved editing preset stays untouched.
export function resolveGenerationPrompts(preset, wildcards, pickIndex = randomInt, { mode = "text-to-image", sequentialChoices = [] } = {}) {
  const resolved = structuredClone(preset);
  const medium = getPresetEffort(preset) === "medium";
  const byKey = new Map(wildcards.map(item => [item.key, item]));
  const random = () => pickIndex(0x1000000) / 0x1000000;
  const selected = new Map();
  function resolve(text, location) {
    let output = resolveRandomPromptText(text, random);
    let offsetChange = 0;
    output = output.replace(/__([^\s]+?)__/g, (match, key, offset) => {
      const wildcard = byKey.get(key);
      if (!wildcard?.entries?.length) throw storeError(400, "wildcard_missing", `Wildcard __${key}__ is missing or empty in ${location}.`);
      if (wildcard.selection_mode === 'sequential') {
        let choice = selected.get(wildcard.id);
        if (!choice) {
          const index = wildcard.sequence?.next_index ?? 0;
          const value = resolveRandomPromptText(wildcard.entries[index], random);
          choice = {id: wildcard.id, key, mode: 'sequential', index, entry: wildcard.entries[index], value,
            revision: wildcard.sequence?.revision ?? 0, definition_hash: wildcard.sequence?.definition_hash, locations: [], occurrences: []};
          selected.set(wildcard.id, choice); sequentialChoices.push(choice);
        }
        choice.locations.push(location);
        choice.occurrences.push({location, start: offset + offsetChange, end: offset + offsetChange + choice.value.length});
        offsetChange += choice.value.length - match.length;
        return choice.value;
      }
      const value = resolveRandomPromptText(wildcard.entries[pickIndex(wildcard.entries.length)], random);
      offsetChange += value.length - match.length;
      return value;
    });
    if (/__[^\s]+?__/.test(output)) throw storeError(400, "unresolved_wildcard", `Unresolved Wildcard in ${location}.`);
    return output;
  }
  resolved.prompt_parts.base = resolve(resolved.prompt_parts.base, "Base Prompt");
  resolved.prompt_parts.undesired = medium ? "" : resolve(resolved.prompt_parts.undesired, "Undesired");
  resolved.prompt_parts.characters = resolved.prompt_parts.characters
    .filter(character => character.enabled !== false && (mode === "inpaint" && !medium || String(character.prompt || "").length > 0))
    .map((character, index) => ({ ...character,
      prompt: resolve(character.prompt, `Character ${index + 1} Prompt`),
      undesired: medium ? "" : resolve(character.undesired, `Character ${index + 1} Undesired`),
    }));
  // Prevent templates in inactive models or imported source snapshots leaking into History.
  delete resolved.model_states;
  delete resolved.effort_states;
  resolved.sources = { imported_raw_payload: null, imported_image_metadata: null };
  return resolved;
}

// Consume only references that survive into the generated fields. Base is kept
// by the adapters; the existing generated-copy exclusions provide exact ranges.
export function usedSequentialChoices(choices, payload, excludedBase = [], preset = null) {
  const characterMap = new Map();
  if (preset) {
    let index = 0;
    for (const character of payload.parameters.characterPrompts || []) {
      while (index < preset.prompt_parts.characters.length && preset.prompt_parts.characters[index].prompt !== character.prompt) index++;
      if (index < preset.prompt_parts.characters.length) characterMap.set(index++, character);
    }
  }
  return choices.filter(choice => choice.occurrences.some(({location, start}) => {
    if (location === 'Base Prompt') {
      if (!choice.value.replace(/[\s,]/g, '')) return Boolean(choice.value && payload.input.includes(choice.value));
      return choice.value.split('').some((character, offset) => !/[\s,]/.test(character) && !excludedBase.some(range => start + offset >= range.start && start + offset < range.end));
    }
    if (location === 'Undesired') return String(payload.parameters.negative_prompt || '').includes(choice.value);
    const match = /^Character (\d+) (Prompt|Undesired)$/.exec(location);
    const index = Number(match?.[1]) - 1;
    const character = preset ? characterMap.get(index) : payload.parameters.characterPrompts?.[index];
    return Boolean(character && String(match[2] === 'Prompt' ? character.prompt : character.uc).includes(choice.value));
  }));
}

export function createPreparedPromptStore({ now = Date.now, ttl = 5 * 60_000, limit = 32 } = {}) {
  const items = new Map();
  function prune() { for (const [id, item] of items) if (item.expires <= now()) items.delete(id); }
  return {
    put(id, preset, mode, cameraInput = null, wildcardChoices = []) {
      prune();
      while (items.size >= limit) items.delete(items.keys().next().value);
      items.set(id, { expires: now() + ttl, preset: structuredClone(preset), mode, cameraInput: structuredClone(cameraInput), wildcardChoices: structuredClone(wildcardChoices) });
    },
    take(id, mode) {
      return this.takeSnapshot(id, mode).preset;
    },
    takeSnapshot(id, mode) {
      prune();
      const item = items.get(id);
      if (!item) throw storeError(409, "prepared_prompt_expired", "Prepared prompt expired or was already used. Click Generate again.");
      if (item.mode !== undefined && item.mode !== mode) throw storeError(409, "prepared_mode_changed", "Generation mode changed. Prepare the prompt again.");
      items.delete(id);
      return { preset: item.preset, cameraInput: item.cameraInput, wildcardChoices: item.wildcardChoices };
    },
  };
}
