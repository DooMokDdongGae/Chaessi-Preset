import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("./src/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const server = await readFile(new URL("./server.mjs", import.meta.url), "utf8");
const css = await readFile(new URL("./styles.css", import.meta.url), "utf8");

for (const id of [
  "historyEnterSelectionButton",
  "historySelectionToolbar",
  "historySelectionCount",
  "historySelectVisibleButton",
  "historyClearSelectionButton",
  "historyDeleteSelectedButton",
  "historyCancelSelectionButton",
  "historyBulkDeleteDialog",
  "historyBulkDeleteCount",
  "historyBulkDeleteStatus",
  "historyBulkDeleteConfirmButton",
]) {
  assert.ok(html.includes(`id="${id}"`), `missing History bulk-delete UI: ${id}`);
}

assert.ok(server.includes('url.pathname === "/api/generations/delete-batch"'));
assert.ok(server.includes("generationStore.deleteGenerations(body?.ids)"));
assert.ok(app.includes('postJson("/api/generations/delete-batch", { ids })'));
assert.ok(app.includes("historyPages.snapshot().items.map((item) => item.id)"), "select displayed must only use rendered page items");
assert.ok(app.includes("historySelection.snapshot().busy"));
assert.ok(app.includes("historyViewGuard.cancel()"));
assert.ok(app.includes("state.generations = previousItems.filter"), "successful local removal must avoid a full History reload");
assert.equal(app.includes('postJson("/api/generations/delete-all"'), false);
assert.equal(server.includes('url.pathname === "/api/generations/delete-all"'), false);
assert.ok(css.includes(".history-card.is-bulk-selected"));
assert.ok(css.includes(".danger-button"));

console.log("History bulk delete UI/API wiring tests passed.");
