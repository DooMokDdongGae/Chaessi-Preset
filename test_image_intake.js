import assert from "node:assert/strict";
import { File } from "node:buffer";
import {
  detectImageMimeFromBytes,
  getImageDestinationAvailability,
  getImageFilesFromTransfer,
  hasFileTransfer,
  hasImportableNovelAiMetadata,
  inspectImageFile,
  inspectImageFiles,
  releaseImageIntakeItems,
} from "./src/ui/image-intake.js";

const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const WEBP = Uint8Array.from([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
const JPEG = Uint8Array.from([255, 216, 255, 224]);

assert.equal(detectImageMimeFromBytes(PNG), "image/png");
assert.equal(detectImageMimeFromBytes(WEBP), "image/webp");
assert.equal(detectImageMimeFromBytes(JPEG), "image/jpeg");
assert.equal(detectImageMimeFromBytes(Uint8Array.from([1, 2, 3])), "");

const metadataCalls = [];
const pngFile = new File([PNG], "sample.not-png", { type: "application/octet-stream" });
const item = await inspectImageFile(pngFile, {
  source: "clipboard",
  createPreview: false,
  decodeImage: async (file) => {
    assert.equal(file.type, "image/png");
    return { width: 832, height: 1216 };
  },
  inspectMetadata: async (file) => {
    metadataCalls.push(new Uint8Array(await file.arrayBuffer()));
    return { ok: true, parsed: { base_prompt: "safe synthetic prompt" }, detected: {} };
  },
});
assert.equal(item.mimeType, "image/png");
assert.equal(item.width, 832);
assert.equal(item.height, 1216);
assert.equal(item.source, "clipboard");
assert.deepEqual(metadataCalls[0], PNG);
assert.equal(hasImportableNovelAiMetadata(item.metadata), true);
assert.equal(hasImportableNovelAiMetadata({ ok: true, parsed: {}, detected: {} }), false);

const ordered = await inspectImageFiles([
  new File([PNG], "one.png", { type: "image/png" }),
  new File([JPEG], "two.jpg", { type: "image/jpeg" }),
], {
  createPreview: false,
  decodeImage: async () => ({ width: 64, height: 64 }),
});
assert.deepEqual(ordered.map((entry) => entry.fileName), ["one.png", "two.jpg"]);

await assert.rejects(
  inspectImageFile(new File([Uint8Array.from([1, 2, 3])], "bad.png", { type: "image/png" }), {
    createPreview: false,
    decodeImage: async () => ({ width: 1, height: 1 }),
  }),
  /PNG, WebP, or JPEG/,
);

assert.deepEqual(getImageDestinationAvailability(1, 16), {
  imageToImage: true,
  inpaint: true,
  preciseReference: true,
});
assert.deepEqual(getImageDestinationAvailability(2, 16), {
  imageToImage: false,
  inpaint: false,
  preciseReference: true,
});
assert.equal(getImageDestinationAvailability(3, 2).preciseReference, false);

assert.deepEqual(getImageFilesFromTransfer({ files: [pngFile] }), [pngFile]);
assert.deepEqual(getImageFilesFromTransfer({
  files: [],
  items: [{ kind: "file", getAsFile: () => pngFile }],
}), [pngFile]);
assert.equal(hasFileTransfer({ types: ["text/plain", "Files"] }), true);
assert.equal(hasFileTransfer({ types: ["text/plain"] }), false);

const revoked = [];
const originalRevoke = URL.revokeObjectURL;
URL.revokeObjectURL = (url) => revoked.push(url);
try {
  const disposable = [{ previewUrl: "blob:one" }, { previewUrl: "" }, { previewUrl: "blob:two" }];
  releaseImageIntakeItems(disposable);
  assert.deepEqual(revoked, ["blob:one", "blob:two"]);
  assert.deepEqual(disposable.map((entry) => entry.previewUrl), ["", "", ""]);
} finally {
  URL.revokeObjectURL = originalRevoke;
}

console.log("image intake tests passed");
