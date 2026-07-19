export function getBrushCursorMetrics({
  brushSize,
  canvasWidth,
  canvasHeight,
  displayedWidth,
  displayedHeight,
}) {
  const widthScale = positiveRatio(displayedWidth, canvasWidth);
  const heightScale = positiveRatio(displayedHeight, canvasHeight);
  const size = Math.max(1, Number(brushSize) || 1);
  return {
    outerWidth: size * widthScale,
    outerHeight: size * heightScale,
    widthScale,
    heightScale,
    distorted: Math.abs(widthScale - heightScale) > Math.max(widthScale, heightScale) * 0.01,
  };
}

export function interpolateStrokePoints(from, to, spacing) {
  const start = normalizedPoint(from);
  const end = normalizedPoint(to);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const step = Math.max(1, Number(spacing) || 1);
  const segments = Math.max(1, Math.ceil(distance / step));
  return Array.from({ length: segments + 1 }, (_, index) => {
    const ratio = index / segments;
    return {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
  });
}

export function maskAlphaToRgbPixels(rgbaPixels) {
  const source = rgbaPixels instanceof Uint8ClampedArray
    ? rgbaPixels
    : new Uint8ClampedArray(rgbaPixels || []);
  if (source.length % 4 !== 0) throw new Error("Mask RGBA pixel data length is invalid.");
  const output = new Uint8ClampedArray(source.length);
  for (let index = 0; index < source.length; index += 4) {
    const value = source[index + 3] > 0 ? 255 : 0;
    output[index] = value;
    output[index + 1] = value;
    output[index + 2] = value;
    output[index + 3] = 255;
  }
  return output;
}

function positiveRatio(displayed, actual) {
  const numerator = Number(displayed);
  const denominator = Number(actual);
  if (!(numerator > 0) || !(denominator > 0)) return 1;
  return numerator / denominator;
}

function normalizedPoint(value) {
  return {
    x: Number(value?.x) || 0,
    y: Number(value?.y) || 0,
  };
}
