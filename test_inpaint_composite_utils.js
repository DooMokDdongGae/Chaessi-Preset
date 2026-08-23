import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";

import {
  compositeInpaintResult,
  DEFAULT_INPAINT_GENERATION_PADDING,
  INPAINT_MASK_BLOCK_SIZE,
  createInpaintGenerationMask,
  dilateBinaryMask,
  normalizeInpaintGenerationPadding,
  quantizeBinaryMaskToBlocks,
} from "./src/services/inpaint-composite-utils.js";
import {
  decodePngPixels,
  pngPixelsToMask,
  pngPixelsToRgb,
} from "./src/services/generation-image-utils.js";

assert.equal(DEFAULT_INPAINT_GENERATION_PADDING, 16);
assert.equal(INPAINT_MASK_BLOCK_SIZE, 8);

const point = Buffer.alloc(7 * 7);
point[3 * 7 + 3] = 255;
assert.deepEqual([...dilateBinaryMask(point, 7, 7, 0)], [...point]);

const padded = dilateBinaryMask(point, 7, 7, 2);
for (let y = 0; y < 7; y += 1) {
  for (let x = 0; x < 7; x += 1) {
    assert.equal(padded[y * 7 + x], x >= 1 && x <= 5 && y >= 1 && y <= 5 ? 255 : 0);
  }
}

const edge = Buffer.alloc(4 * 3);
edge[0] = 255;
const edgePadded = dilateBinaryMask(edge, 4, 3, 1);
assert.deepEqual([...edgePadded], [
  255, 255, 0, 0,
  255, 255, 0, 0,
  0, 0, 0, 0,
]);

const source = createPng(3, 1, 2, [
  10, 20, 30,
  40, 50, 60,
  70, 80, 90,
]);
const generated = createPng(3, 1, 6, [
  110, 120, 130, 255,
  140, 150, 160, 255,
  170, 180, 190, 128,
]);
const logicalMask = createPng(3, 1, 0, [0, 128, 255]);
const composite = decodePngPixels(compositeInpaintResult({
  sourceBytes: source,
  generatedBytes: generated,
  compositeMaskBytes: logicalMask,
}));
assert.deepEqual([...pngPixelsToRgb(composite)], [
  10, 20, 30,
  90, 100, 110,
  120, 130, 140,
]);

const blockInput = Buffer.alloc(16 * 16);
blockInput[0] = 64;
blockInput[4 * 16 + 12] = 255;
const blockQuantized = quantizeBinaryMaskToBlocks(blockInput, 16, 16);
for (let y = 0; y < 16; y += 1) {
  for (let x = 0; x < 16; x += 1) {
    const expected = y < 8 ? 255 : 0;
    assert.equal(blockQuantized[y * 16 + x], expected, "each touched 8x8 block must be uniformly selected");
  }
}

const selectionPixels = Array(16 * 16).fill(0);
selectionPixels[8 * 16 + 8] = 255;
const selectionMask = createPng(16, 16, 0, selectionPixels);
const zeroPaddingMask = pngPixelsToMask(decodePngPixels(createInpaintGenerationMask(selectionMask, 0)));
assert.equal(zeroPaddingMask[8 * 16 + 8], 255, "small selections must survive block quantization");
const generationMask = pngPixelsToMask(decodePngPixels(createInpaintGenerationMask(selectionMask, 8)));
for (let blockY = 0; blockY < 16; blockY += 8) {
  for (let blockX = 0; blockX < 16; blockX += 8) {
    const first = generationMask[blockY * 16 + blockX];
    for (let y = blockY; y < blockY + 8; y += 1) {
      for (let x = blockX; x < blockX + 8; x += 1) assert.equal(generationMask[y * 16 + x], first);
    }
  }
}
assert.ok(generationMask.some((value) => value === 255), "padding must expand the selection before quantization");

assert.throws(() => normalizeInpaintGenerationPadding(33), /0 to 32/);
assert.throws(() => normalizeInpaintGenerationPadding(1.5), /integer/);
assert.throws(() => compositeInpaintResult({
  sourceBytes: source,
  generatedBytes: createPng(2, 1, 2, [1, 2, 3, 4, 5, 6]),
  compositeMaskBytes: logicalMask,
}), /dimensions must match/);

console.log(JSON.stringify({
  ok: true,
  dilation: true,
  latent_block_quantization: true,
  boundary_clamp: true,
  logical_mask_preserved: true,
  grayscale_composite: true,
  rgba_result_alpha: true,
  dimension_validation: true,
}));

function createPng(width, height, colorType, pixels) {
  const channels = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]).get(colorType);
  const stride = width * channels;
  assert.equal(pixels.length, stride * height);
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 0;
    Buffer.from(pixels).copy(raw, row + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return result;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
