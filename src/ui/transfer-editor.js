import {createCharacterPart} from "../state/preset-schema.js";
import {getModelProfile} from "../state/model-profiles.js";
import {t} from "./i18n.js";

const $ = id => document.getElementById(id);
const stale = () => { throw new Error("STALE"); };
const field = (card, name) => card.querySelector('[data-character-field="' + name + '"]');

/** Adapter for the live editor. Never calls the whole-preset importer or form synchronizer. */
export function createTransferEditor({state, fields, renderCharacterCards, renderCharacterPositionPad, refresh}) {
  function cards() { return [...$("characterCards").querySelectorAll('[data-character-scope="preset"]')]; }
  function read() {
    const draft = state.currentPreset;
    if (!draft) throw new Error("NOT_READY");
    const {prompt_parts:parts, params} = draft;
    const {maxCharacters:limit} = getModelProfile(params.model);
    const list = cards();
    if (list.length !== Math.min(limit, parts.characters.length) ||
        fields.basePrompt.value !== parts.base || fields.undesiredPrompt.value !== parts.undesired ||
        fields.model.value !== params.model || fields.effort.value !== (params.effort || "high")) stale();
    for (const [index, card] of list.entries()) {
      const current = parts.characters[index];
      if (Number(card.dataset.characterIndex) !== index || field(card, "prompt").value !== current.prompt ||
          field(card, "undesired").value !== current.undesired) stale();
    }
    let mirror;
    try { mirror = JSON.parse(fields.charactersJson.value); } catch { stale(); }
    if (JSON.stringify(mirror) !== JSON.stringify(parts.characters)) stale();
    const signature = JSON.stringify([parts, params, draft.metadata, $("characterPositionMode").value,
      fields.charactersJson.value, list.map(card => ["name", "x", "y"].map(key => field(card, key).value))]);
    return {draft, limit, signature};
  }

  function write(plan) {
    const {draft} = read(), parts = draft.prompt_parts, characters = parts.characters;
    const existing = cards();
    const count = characters.length;
    if (count !== plan.originalCount) stale();
    const newCharacters = plan.createdSlots.map(({number, requested}) => createCharacterPart({
      name:"Character " + number, enabled:requested, position_mode:$("characterPositionMode").value,
    }));
    const changes = [];
    let characterEdits = Boolean(newCharacters.length);
    for (const {number, property, before, after} of plan.groups) {
      if (before === after) continue;
      const owner = number ? characters[number - 1] ?? newCharacters[number - count - 1] : parts;
      if (!owner || owner[property] !== before) stale();
      if (number > count) {
        owner[property] = after; // Still detached.
      } else {
        const control = number ? field(existing[number - 1], property) :
          property === "base" ? fields.basePrompt : fields.undesiredPrompt;
        if (!control || control.value !== before) stale();
        changes.push({number, property, before, after});
      }
      characterEdits ||= number > 0;
    }
    if (!changes.length && !newCharacters.length) return null;
    const originalJson = fields.charactersJson.value;
    const selectedPosition = state.selectedCharacterPositionIndex;
    function setValues(reverse) {
      // Switching a character's editor tab rebuilds the array and its objects even
      // when every value is identical. Always patch the active draft on Undo.
      const liveParts = state.currentPreset.prompt_parts;
      const liveCharacters = liveParts.characters;
      if (newCharacters.length) {
        if (reverse) liveCharacters.splice(count, newCharacters.length);
        else liveCharacters.push(...newCharacters);
      }
      for (const change of changes) {
        const owner = change.number ? liveCharacters[change.number - 1] : liveParts;
        owner[change.property] = reverse ? change.before : change.after;
      }
      if (characterEdits) fields.charactersJson.value = reverse ? originalJson : JSON.stringify(liveCharacters, null, 2);
      if (newCharacters.length) {
        renderCharacterCards(liveCharacters);
        if (reverse && state.selectedCharacterPositionIndex >= count) state.selectedCharacterPositionIndex = selectedPosition;
        renderCharacterPositionPad();
        $("addCharacterButton").disabled = liveCharacters.length >= getModelProfile(draft.params.model).maxCharacters;
      }
      const currentCards = cards();
      for (const {number, property, before, after} of changes) {
        const value = reverse ? before : after;
        if (!number) {
          (property === "base" ? fields.basePrompt : fields.undesiredPrompt).value = value;
        } else if (!newCharacters.length) {
          const card = currentCards[number - 1];
          field(card, property).value = value;
          if (property === "prompt") card.querySelector(".character-folded-preview").textContent = value || t("Empty prompt");
        }
      }
      refresh();
    }
    try { setValues(false); } catch (error) { setValues(true); throw error; }
    return () => {
      try { setValues(true); } catch (error) { setValues(false); throw error; }
    };
  }
  return {read, write};
}
