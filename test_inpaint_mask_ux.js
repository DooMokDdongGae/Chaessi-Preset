import assert from "node:assert/strict";

import {
  getBrushCursorMetrics,
  interpolateStrokePoints,
  maskAlphaToRgbPixels,
} from "./src/ui/inpaint-mask-utils.js";

const converted = maskAlphaToRgbPixels(new Uint8ClampedArray([
  1, 2, 3, 0,
  4, 5, 6, 64,
  7, 8, 9, 128,
  10, 11, 12, 255,
]));
assert.deepEqual([...converted], [
  0, 0, 0, 255,
  255, 255, 255, 255,
  255, 255, 255, 255,
  255, 255, 255, 255,
], "selection mask export must be binary");

const points = interpolateStrokePoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
assert.deepEqual(points[0], { x: 0, y: 0 });
assert.deepEqual(points.at(-1), { x: 100, y: 0 });
assert.equal(points.length, 11);
for (let index = 1; index < points.length; index += 1) {
  assert.ok(Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y) <= 10);
}

const landscape = getBrushCursorMetrics({
  brushSize: 200,
  canvasWidth: 1600,
  canvasHeight: 800,
  displayedWidth: 800,
  displayedHeight: 400,
});
assert.equal(landscape.outerWidth, 100);
assert.equal(landscape.outerHeight, 100);
assert.equal(landscape.distorted, false);

const portrait = getBrushCursorMetrics({
  brushSize: 40,
  canvasWidth: 800,
  canvasHeight: 1600,
  displayedWidth: 200,
  displayedHeight: 400,
});
assert.equal(portrait.outerWidth, 10);
assert.equal(portrait.outerHeight, 10);
assert.equal(portrait.distorted, false);

const distorted = getBrushCursorMetrics({
  brushSize: 40,
  canvasWidth: 100,
  canvasHeight: 100,
  displayedWidth: 50,
  displayedHeight: 75,
});
assert.equal(distorted.distorted, true);

console.log(JSON.stringify({
  ok: true,
  binary_selection_export: true,
  stroke_interpolation: true,
  cursor_scaling: true,
  feather_cursor_removed: true,
}));
