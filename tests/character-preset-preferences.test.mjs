import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterPresetPreferences } from "../src/ui/character-preset-preferences.js";

function memoryStorage(initial = null) {
  let data = initial;
  return { getItem: () => data, setItem: (_, value) => { data = value; }, raw: () => data };
}
const female = { category: "여성 의상", subCategory: "Casual / 캐주얼" };
const male = { category: "남성 의상", subCategory: "Office / 오피스" };

test("numbered slots persist independently across new preference instances", () => {
  const storage = memoryStorage();
  const first = createCharacterPresetPreferences(storage);
  assert.equal(first.set(0, female), true);
  assert.equal(first.set(1, male), true);
  assert.equal(first.set(31, { category: "그림체", subCategory: "" }), true);
  const restarted = createCharacterPresetPreferences(storage);
  assert.deepEqual(restarted.get(0), female);
  assert.deepEqual(restarted.get(1), male);
  assert.equal(restarted.get(31).category, "그림체");
  assert.deepEqual(restarted.get(2), { category: "", subCategory: "" });
});
test("explicit changes and All categories survive restart without altering other fields", () => {
  const storage = memoryStorage();
  const prefs = createCharacterPresetPreferences(storage);
  prefs.set(0, female); prefs.set(1, male);
  prefs.set(0, { category: "조명", subCategory: "" });
  assert.equal(createCharacterPresetPreferences(storage).get(0).category, "조명");
  prefs.set(0, { category: "", subCategory: "ignored" });
  assert.deepEqual(createCharacterPresetPreferences(storage).get(0), { category: "", subCategory: "" });
  assert.deepEqual(createCharacterPresetPreferences(storage).get(1), male);
});
test("only filter fields are retained and returned snapshots cannot change preferences", () => {
  const storage = memoryStorage();
  const prefs = createCharacterPresetPreferences(storage);
  prefs.set(0, { ...female, prompt: "not-a-setting", token: "not-a-setting" });
  prefs.get(0).category = "changed";
  assert.deepEqual(prefs.get(0), female);
  assert.ok(!storage.raw().includes("not-a-setting"));
  for (const index of [-1, 32, null, 1.5, "0"]) assert.equal(prefs.set(index, female), false);
});
test("malformed or unsupported persisted data safely starts at All categories", () => {
  for (const data of ["broken JSON", '{"schema":2,"slots":[]}', '{"schema":1,"slots":{}}']) {
    const storage = memoryStorage(data);
    const prefs = createCharacterPresetPreferences(storage);
    assert.deepEqual(prefs.get(0), { category: "", subCategory: "" });
    assert.equal(prefs.set(0, female), true);
    assert.deepEqual(createCharacterPresetPreferences(storage).get(0), female);
  }
});
test("storage errors are reported while the current selection remains usable", () => {
  const storage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  const prefs = createCharacterPresetPreferences(storage);
  assert.equal(prefs.set(0, female), false);
  assert.deepEqual(prefs.get(0), female);
});
