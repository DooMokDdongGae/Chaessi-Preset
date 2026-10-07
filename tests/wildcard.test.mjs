import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createWildcardStore, normalizeWildcard } from "../src/services/wildcard-store.js";
import { resolveGenerationPrompts, createPreparedPromptStore } from "../src/services/generation-prompt-resolver.js";
import { createDefaultPreset } from "../src/state/preset-schema.js";
import { buildModeGeneratePayload } from "../src/adapters/novelai-v45-generation-modes.js";
import { mergeWithBuiltIns } from "../src/services/character-preset-category-store.js";
import { FEMALE_CLOTHING_CATEGORY, MALE_CLOTHING_CATEGORY } from "../src/state/character-preset-categories.js";

test("candidate lines preserve tags, normalize BOM/CRLF, deduplicate, reject invalid definitions", () => {
  assert.deepEqual(normalizeWildcard({ key: "tops", text: "\uFEFFwhite shirt\r\n\n white shirt \r\n1.2::blue shirt::, rolled sleeves" }).entries, ["white shirt", "1.2::blue shirt::, rolled sleeves"]);
  for (const key of ["", "../tops", "TOPS", "a__b"]) assert.throws(() => normalizeWildcard({ key, text: "x" }));
  assert.throws(() => normalizeWildcard({ key: "tops", text: "__other__" }), /another Wildcard/);
  assert.throws(() => normalizeWildcard({ key: "tops", text: "\n" }), /at least one/);
});

test("store persists multiple definitions and serializes conflicting saves", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-wildcard-"));
  try {
    const store = createWildcardStore({ rootDir: root });
    const first = await store.save({ key: "tops", text: "white shirt\nblue shirt", name: "상의" });
    await store.save({ key: "poses", text: "standing\nsitting" });
    const race = await Promise.allSettled([store.save({ key: "shoes", text: "boots" }), store.save({ key: "shoes", text: "sneakers" })]);
    assert.equal(race.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await createWildcardStore({ rootDir: root }).list()).length, 3);
    await assert.rejects(store.save({ ...first, key: "renamed" }), /cannot change/);
    await store.save({ ...first, entries: ["black shirt"] });
    assert.deepEqual((await store.get(first.id)).entries, ["black shirt"]);
    await store.delete(first.id);
    await assert.rejects(store.get(first.id), /not found/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("all 1,000 candidates can be reached, including the final index; templates remain untouched", () => {
  const preset = createDefaultPreset({ prompt_parts: { base: "1girl, __tops__", undesired: "", characters: [] } });
  const entries = Array.from({ length: 1000 }, (_, i) => `shirt ${i}`);
  for (let i = 0; i < entries.length; i++) {
    assert.equal(resolveGenerationPrompts(preset, [{ key: "tops", entries }], () => i).prompt_parts.base, `1girl, shirt ${i}`);
  }
  assert.equal(preset.prompt_parts.base, "1girl, __tops__");
});

test("mix legacy blocks and references across all fields, independently per occurrence", () => {
  const preset = createDefaultPreset({ prompt_parts: {
    base: "||__tops__|dress||, __poses__, __tops__", undesired: "__bad__",
    characters: [{ prompt: "__tops__", undesired: "||text|blur||" }, { enabled: false, prompt: "__missing__" }],
  } });
  preset.model_states = { another: { prompt_parts: { base: "__missing__" } } };
  preset.sources.imported_raw_payload = { template: "__tops__" };
  const wildcards = [{ key: "tops", entries: ["||white shirt|blue shirt||"] }, { key: "poses", entries: ["standing"] }, { key: "bad", entries: ["bad hands"] }];
  const resolved = resolveGenerationPrompts(preset, wildcards, () => 0);
  assert.equal(resolved.prompt_parts.base, "white shirt, standing, white shirt");
  assert.equal(resolved.prompt_parts.undesired, "bad hands");
  assert.equal(resolved.prompt_parts.characters.length, 1);
  assert.equal(resolved.prompt_parts.characters[0].prompt, "white shirt");
  assert.equal(resolved.prompt_parts.characters[0].undesired, "text");
  assert.equal(JSON.stringify(resolved).includes("__"), false);
  assert.equal(resolved.model_states, undefined);
  assert.deepEqual(resolved.sources, { imported_raw_payload: null, imported_image_metadata: null });
  assert.throws(() => resolveGenerationPrompts(preset, []), /missing.*Base Prompt/);
  let i = 0;
  const repeated = createDefaultPreset({ prompt_parts: { base: "__tops__, __tops__" } });
  assert.equal(resolveGenerationPrompts(repeated, [{ key: "tops", entries: ["white", "blue"] }], () => i++).prompt_parts.base, "white, blue");
});

test("prepared prompts are immutable, single-use, bounded and expire", () => {
  let time = 0;
  const cache = createPreparedPromptStore({ now: () => time, ttl: 100, limit: 2 });
  const preset = { prompt: "blue" }; cache.put("a", preset); preset.prompt = "red";
  assert.equal(cache.take("a").prompt, "blue");
  assert.throws(() => cache.take("a"), /already used/);
  cache.put("b", preset); time = 100;
  assert.throws(() => cache.take("b"), /expired/);
  cache.put("c", preset); cache.put("d", preset); cache.put("e", preset);
  assert.throws(() => cache.take("c"));
});

test("resolved payloads work with both model adapters and keep all character positions", () => {
  for (const model of ["nai-diffusion-4-5-full", "nai-diffusion-5-full"]) {
    const preset = createDefaultPreset({ params: { model }, prompt_parts: { base: "__tops__", characters: [{ prompt: "__tops__", centers: [{ x: .2, y: .8 }], position_mode: "custom" }] } });
    const resolved = resolveGenerationPrompts(preset, [{ key: "tops", entries: ["blue shirt"] }]);
    const payload = buildModeGeneratePayload(resolved, { mode: "text-to-image" });
    assert.match(payload.input, /blue shirt/);
    assert.equal(JSON.stringify(payload).includes("__tops__"), false);
    assert.deepEqual(resolved.prompt_parts.characters[0].centers, [{ x: .2, y: .8 }]);
  }
});

test("Korean clothing sorting also covers saved and newly added subcategories", () => {
  const categories = mergeWithBuiltIns([{ name: FEMALE_CLOTHING_CATEGORY, subcategories: ["Z / 가방", "A / 힙합"] }]);
  for (const name of [FEMALE_CLOTHING_CATEGORY, MALE_CLOTHING_CATEGORY]) {
    const values = categories.find(category => category.name === name).subcategories.map(value => value.split("/").at(-1).trim());
    assert.deepEqual(values, [...values].sort((a, b) => a.localeCompare(b, "ko")));
  }
});
