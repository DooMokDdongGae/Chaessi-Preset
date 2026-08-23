import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, generation, precise] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./src/app.js", import.meta.url), "utf8"),
  readFile(new URL("./src/ui/generation-mode-controller.js", import.meta.url), "utf8"),
  readFile(new URL("./src/ui/precise-reference-controller.js", import.meta.url), "utf8"),
]);

for (const id of [
  "openImageIntakeButton",
  "imageIntakeDialog",
  "imageIntakeI2IButton",
  "imageIntakeInpaintButton",
  "imageIntakePreciseButton",
  "imageIntakeMetadata",
  "imageIntakeApplyMetadataButton",
  "imageDragOverlay",
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`));
}

assert.match(app, /imageIntakeController\.openFiles\(files, "clipboard"\)/);
assert.match(app, /imageIntakeController\.openFiles\(getImageFilesFromTransfer\(event\.dataTransfer\), "drag-and-drop"\)/);
assert.doesNotMatch(app, /getData\("text\/plain"\)/);
assert.doesNotMatch(generation, /document\.addEventListener\("paste"/);
assert.match(generation, /loadSourceItem\(item, mode/);
assert.match(generation, /settingsByModel: new Map\(\)/);
assert.match(generation, /i2iNoise: model === "nai-diffusion-5-full" \? 0 : 0\.05/);
assert.match(generation, /getModel\?\.\(\) === "nai-diffusion-5-full"/);
assert.match(app, /loadSourceItem\(item, mode\)/);
assert.match(app, /data-generation-mode="image-to-image"/);
assert.doesNotMatch(app, /V5 Full Image to Image is not supported/);
assert.match(precise, /elements\.panel\.addEventListener\("paste"/);
assert.match(precise, /state\.references\.push\(\.\.\.prepared\)/);
assert.match(html, /id="preciseReferenceInput"[^>]*multiple/);
assert.match(html, /id="imageInput"[^>]*multiple/);

console.log("image intake UI wiring tests passed");
