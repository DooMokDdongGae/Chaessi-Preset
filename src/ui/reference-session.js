import { NOVELAI_V45_FULL_MODEL, NOVELAI_V5_FULL_MODEL } from "../state/model-profiles.js";
import {effectiveVibeStrengths} from "../services/vibe-cost.js";

// Keep saved Vibe assets readable without offering new encoding or generation requests.
export const NEW_VIBE_TRANSFER_ENABLED = false;

export function supportsOutfitPreference(type) {
  return type === "character" || type === "character&style";
}

export function currentEncoding(card, model) {
  return card.encodings?.find(entry =>
    entry.model === model && entry.informationExtracted === card.informationExtracted);
}

// The editing list survives model/mode changes. Only the effective list goes to Generate.
export function planReferences(cards, { model, mode, effort, capabilities = {} }, normalizeStrength = true) {
  const text = mode === "text-to-image";
  const preciseAvailable = capabilities.v5HighPrecise === true &&
    model === NOVELAI_V5_FULL_MODEL && effort === "high" && text;
  const vibeAvailable = NEW_VIBE_TRANSFER_ENABLED && capabilities.v45Vibe === true && model === NOVELAI_V45_FULL_MODEL && text;
  const enabled = cards.filter(card => card.enabled);
  const precise = preciseAvailable ? enabled.filter(card => card.kind === "precise") : [];
  const selectedVibes = vibeAvailable ? enabled.filter(card => card.kind === "vibe") : [];
  const vibes = selectedVibes.filter(card => currentEncoding(card, model));
  const missingEncodings = selectedVibes.length - vibes.length;
  let strengths;
  try { strengths = effectiveVibeStrengths(vibes.map(card => card.strength), normalizeStrength); }
  catch { strengths = null; }
  const held = enabled.length - precise.length - selectedVibes.length;
  const fee = precise.length * 5 + Math.max(0, vibes.length - 4) * 2;
  return { preciseAvailable, vibeAvailable, precise, vibes, strengths, missingEncodings, held, fee,
    canGenerate: model === NOVELAI_V5_FULL_MODEL };
}

export function vibeRequest(cards, model, normalizeStrength) {
  if (!cards.length) return {};
  if (!NEW_VIBE_TRANSFER_ENABLED) throw new Error("Vibe Transfer is unavailable in this build.");
  return {
    normalize_vibe_strengths: normalizeStrength,
    vibe_references: cards.map(card => ({
      model,
      strength: card.strength,
      information_extracted: card.informationExtracted,
      encoding_base64: currentEncoding(card, model).encoding,
    })),
  };
}
