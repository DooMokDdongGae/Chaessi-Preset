import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("./src/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const css = await readFile(new URL("./styles.css", import.meta.url), "utf8");

for (const id of ["historyLoadMoreButton", "historyStatus", "dialogCharacterPresetLoadMoreButton"]) {
  assert.ok(html.includes(`id="${id}"`), `missing paged-list control: ${id}`);
}
assert.ok(app.includes('$("historyList").addEventListener("click", handleHistoryListClick)'));
assert.ok(app.includes('$("dialogCharacterPresetCards").addEventListener("click", handleDialogCharacterPresetClick)'));
assert.equal(app.includes('document.querySelectorAll("img[data-view-generation]").forEach'), false);
assert.equal(app.includes('document.querySelectorAll("[data-dialog-character-load]").forEach'), false);
assert.ok(app.includes("historyViewGuard.begin()"));
assert.ok(app.includes("historyViewGuard.isCurrent(requestToken)"));
assert.ok(app.includes('$("imageViewerDialog").addEventListener("close", handleImageViewerClosed)'));
assert.ok(app.includes("cancelPendingHistoryView();"));
assert.ok(app.includes("await waitForNextPaint()"));
assert.ok(css.includes('.history-card.is-loading::after'));
assert.ok(app.includes('$("historyStatus").textContent = "Loading generation details…"'));

console.log("UI list optimization wiring tests passed.");
