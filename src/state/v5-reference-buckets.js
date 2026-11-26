// The Full High reference encoder uses 64-pixel buckets with at most 1024² pixels.
// Selection walks from portrait to landscape, including the first bucket on ties.
const landscape = Array.from({ length: 49 }, (_, index) => {
  const long = 1024 + index * 64;
  return [long, Math.floor(1024 ** 2 / long / 64) * 64];
});
const buckets = [...landscape.slice(1).reverse().map(([w, h]) => [h, w]), ...landscape];

export function v5ReferenceCrop(sourceWidth, sourceHeight) {
  if (![sourceWidth, sourceHeight].every(n => Number.isSafeInteger(n) && n > 0)) {
    throw new Error("Invalid reference image dimensions.");
  }
  const logRatio = Math.log(sourceWidth / sourceHeight);
  let selected = buckets[0];
  let closest = Infinity;
  for (const bucket of buckets) {
    const distance = Math.abs(logRatio - Math.log(bucket[0] / bucket[1]));
    if (distance < closest) { selected = bucket; closest = distance; }
  }
  const [width, height] = selected;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const resizeWidth = Math.max(width, Math.round(sourceWidth * scale));
  const resizeHeight = Math.max(height, Math.round(sourceHeight * scale));
  return { width, height, resizeWidth, resizeHeight,
    left: Math.floor((resizeWidth - width) / 2), top: Math.floor((resizeHeight - height) / 2),
    unchanged: sourceWidth === width && sourceHeight === height };
}
