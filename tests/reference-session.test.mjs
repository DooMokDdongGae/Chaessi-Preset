import assert from "node:assert/strict";
import test from "node:test";
import { NOVELAI_V45_FULL_MODEL, NOVELAI_V5_FULL_MODEL } from "../src/state/model-profiles.js";
import { currentEncoding, planReferences, supportsOutfitPreference, vibeRequest } from "../src/ui/reference-session.js";

const context = {
  model: NOVELAI_V5_FULL_MODEL, mode: "text-to-image", effort: "high",
  capabilities: { v5HighPrecise: true, v45Vibe: true },
};
const vibe = { kind: "vibe", enabled: true, strength: 0.6, informationExtracted: 0.7,
  encodings: [{ model: NOVELAI_V45_FULL_MODEL, informationExtracted: 0.7, encoding: "AQID" }] };
const cards = [
  { kind: "precise", type: "outfit", enabled: true, strength: 4 },
  vibe,
  { kind: "precise", type: "style", enabled: false, strength: 3 },
  { kind: "precise", type: "character&style", enabled: true, strength: 1, preferSameOutfit: false },
];

test("only High Text to Image applies enabled Precise cards in the user's order", () => {
  const before = structuredClone(cards);
  const high = planReferences(cards, context);
  assert.deepEqual(high.precise.map(card => card.type), ["outfit", "character&style"]);
  assert.equal(high.fee, 10);
  assert.equal(high.held, 1);
  for (const change of [{ mode: "inpaint" }, { mode: "image-to-image" }, { effort: "medium" }, { capabilities: {} }]) {
    const suspended = planReferences(cards, { ...context, ...change });
    assert.deepEqual(suspended.precise, []);
    assert.deepEqual(suspended.vibes, []);
    assert.equal(suspended.fee, 0);
    assert.equal(suspended.held, 3);
  }
  assert.deepEqual(planReferences(cards, context).precise, high.precise);
  assert.deepEqual(cards, before);
  for (const type of ["character", "character&style"]) assert.ok(supportsOutfitPreference(type));
  for (const type of ["outfit", "style"]) assert.equal(supportsOutfitPreference(type), false);
});

// New Vibe success was verified in the earlier PRIVATE research, but is outside this candidate.
test("V4.5 stays read-only and keeps saved Vibes inactive without deleting their encodings", () => {
  const legacy = { ...context, model: NOVELAI_V45_FULL_MODEL };
  const ready = planReferences(cards, legacy);
  assert.equal(ready.canGenerate, false);
  assert.equal(ready.held, 3);
  assert.equal(ready.vibeAvailable, false);
  assert.deepEqual(ready.vibes, []);
  assert.deepEqual(ready.precise, []);
  const changed = { ...vibe, strength: -1.5 };
  assert.equal(currentEncoding(changed, legacy.model), vibe.encodings[0]);
  assert.throws(() => vibeRequest([changed], legacy.model, false), /unavailable/);
  const missing = planReferences([vibe, { ...changed, informationExtracted: 0.5 }], legacy);
  assert.equal(missing.missingEncodings, 0);
  assert.equal(missing.canGenerate, false);
  assert.equal(planReferences([{ ...vibe, enabled: false }], legacy).canGenerate, false);
  assert.equal(planReferences([vibe], { ...legacy, mode: "inpaint" }).canGenerate, false);
  assert.equal(planReferences(Array(5).fill(vibe), legacy).fee, 0);
  assert.deepEqual(vibeRequest([], legacy.model, true), {});
});
