import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, html, css] = await Promise.all([
  readFile("src/app.js", "utf8"),
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
]);

for (const id of [
  "imageViewerPreviousButton",
  "imageViewerNextButton",
  "imageViewerPosition",
  "imageViewerHistoryDetails",
  "imageViewerHistoryId",
  "imageViewerPrompt",
  "imageViewerUndesired",
]) {
  assert.ok(html.includes(`id="${id}"`), `${id} must exist`);
}
assert.ok(html.includes('aria-label="Previous, newer History item"'));
assert.ok(html.includes('aria-label="Next, older History item"'));
assert.ok(app.includes('navigateHistoryViewer("previous")'));
assert.ok(app.includes('navigateHistoryViewer("next")'));
assert.ok(app.includes('event.key !== "ArrowLeft" && event.key !== "ArrowRight"'));
assert.ok(app.includes("isHistoryNavigationEditingTarget(event.target)"));
assert.ok(app.includes("historyViewGuard.begin()"));
assert.ok(app.includes("historyViewGuard.isCurrent(requestToken)"));
assert.ok(app.includes('kind: "history"'));
assert.ok(app.includes('kind: "latest"'));
assert.ok(app.includes("generation.output?.image_filename || generation.image_path"));
assert.ok(app.includes("getAdjacentHistoryIdAfterRemoval(previousItems, activeViewerId, removed)"));
assert.ok(!app.match(/navigateHistoryViewer[\s\S]{0,800}listGenerations/u), "navigation must not scan sidecars");
assert.ok(!app.match(/navigateHistoryViewer[\s\S]{0,800}(preload|new Image\()/u), "navigation must not preload images");
assert.ok(css.includes(".image-viewer-stage"));
assert.ok(css.includes(".image-viewer-nav:disabled"));

console.log("History navigation UI, race guard, details, and no-preload wiring tests passed.");
