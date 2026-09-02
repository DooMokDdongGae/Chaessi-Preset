import assert from "node:assert/strict";
import {
  getAdjacentHistoryIdAfterRemoval,
  getHistoryNavigation,
  isHistoryNavigationEditingTarget,
} from "./src/ui/history-navigation.js";

const items = Array.from({ length: 101 }, (_, index) => ({ id: `history-${String(index + 1).padStart(3, "0")}` }));

assert.deepEqual(getHistoryNavigation(items, "history-001"), {
  index: 0,
  total: 101,
  previousId: null,
  nextId: "history-002",
});
assert.equal(getHistoryNavigation(items, "history-050").nextId, "history-051");
assert.equal(getHistoryNavigation(items, "history-051").previousId, "history-050");
assert.deepEqual(getHistoryNavigation(items, "history-101"), {
  index: 100,
  total: 101,
  previousId: "history-100",
  nextId: null,
});
assert.equal(getHistoryNavigation(items, "missing").index, -1);

assert.equal(
  getAdjacentHistoryIdAfterRemoval(items, "history-050", new Set(["history-050"])),
  "history-051",
  "deletion should prefer the next/older item",
);
assert.equal(
  getAdjacentHistoryIdAfterRemoval(items, "history-100", new Set(["history-100", "history-101"])),
  "history-099",
  "deletion should fall back to the previous/newer item",
);
assert.equal(
  getAdjacentHistoryIdAfterRemoval(items.slice(0, 1), "history-001", new Set(["history-001"])),
  null,
);
assert.equal(getAdjacentHistoryIdAfterRemoval(items, "history-050", new Set(["history-051"])), null);

const editable = { closest: (selector) => selector.includes("textarea") ? {} : null };
const plain = { closest: () => null };
assert.equal(isHistoryNavigationEditingTarget(editable), true);
assert.equal(isHistoryNavigationEditingTarget(plain), false);
assert.equal(isHistoryNavigationEditingTarget(null), false);

console.log("History navigation ordering, deletion adjacency, and keyboard-target tests passed.");
