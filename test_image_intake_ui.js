import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPreciseReferenceController } from "./src/ui/precise-reference-controller.js";

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
  "imageIntakeVibeButton",
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
assert.match(precise, /panel\.addEventListener\("paste"[\s\S]*?getImageFilesFromTransfer\(event\.clipboardData\)[\s\S]*?addFiles\(files, "clipboard", kind\)/);
assert.doesNotMatch(precise, /document\.addEventListener\("paste"/);
assert.match(html, /id="preciseReferenceInput"[^>]*multiple/);
assert.match(html, /id="imageInput"[^>]*multiple/);

// Precise intake stays available; newly introduced Vibe intake is outside this candidate.
assert.match(html, /id="imageIntakeVibeButton"[^>]*hidden[^>]*disabled/);
const nodes = new Map();
globalThis.document = {
  getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, {
      querySelectorAll: () => [], contains: () => false, replaceChildren() {}, closest: () => ({}),
    });
    return nodes.get(id);
  },
  createElement: () => ({}),
};
const context = { model: "nai-diffusion-5-full", effort: "high", mode: "text-to-image",
  capabilities: { v5HighPrecise: true, v45Vibe: true } };
const panel = createPreciseReferenceController({ getContext: () => context });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a52AAAAAASUVORK5CYII=", "base64");
const images = ["first.png", "second.png", "vibe.png"].map(fileName => ({
  fileName, file: new File([png], fileName, { type: "image/png" }),
}));
const capacity = panel.getCapacity();
await panel.addIntakeItems(images.slice(0, 2), "precise");
await assert.rejects(() => panel.addIntakeItems(images.slice(2), "vibe"), /unavailable/);
assert.equal(panel.getCapacity(), capacity - 2);
assert.deepEqual(panel.getPlan().precise.map(card => card.fileName), ["first.png", "second.png"]);
assert.equal(panel.getPlan().held, 0);
assert.doesNotMatch(nodes.get("preciseReferenceList").innerHTML, /vibe\.png/);
context.model = "nai-diffusion-4-5-full";
assert.equal(panel.getPlan().held, 2);
assert.equal(panel.getPlan().missingEncodings, 0);
await assert.rejects(() => panel.addIntakeItems(Array(capacity).fill(images[0]), "precise"));
assert.equal(panel.getCapacity(), capacity - 2);
delete globalThis.document;

console.log("image intake UI wiring tests passed");
