// Independent composition geometry shared by the editor and the request renderer.
// Source coordinates are pixel edges; transform translation is the image centre.
export const COMPOSITION_SCHEMA = 'chaessi.composition.v1';
export const COMPOSITION_PIXEL_LIMIT = 3_145_728;
export const SOURCE_PIXEL_LIMIT = 4_194_304;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export function initialComposition(width, height) {
  return {schema: COMPOSITION_SCHEMA, source: {width, height},
    frame: {width: Math.ceil(width / 8) * 8, height: Math.ceil(height / 8) * 8},
    transform: {x: width / 2, y: height / 2, scale: 1, angle: 0}, bindings: []};
}
export function validateComposition(value, source) {
  if (value?.schema !== COMPOSITION_SCHEMA) throw new Error('Unsupported composition session.');
  const recipe = structuredClone(value), {frame: f, transform: t} = recipe;
  if (!source || source.width * source.height > SOURCE_PIXEL_LIMIT || source.width < 1 || source.height < 1 ||
      recipe.source?.width !== source.width || recipe.source?.height !== source.height) throw new Error('Composition source dimensions do not match (maximum 4 MP).');
  if (!f || ![f.width, f.height].every(n => Number.isInteger(n) && n >= 64 && n <= 4096 && n % 8 === 0) || f.width * f.height > COMPOSITION_PIXEL_LIMIT)
    throw new Error('Output must be 64–4096 px per side, in steps of 8, and at most 3,145,728 pixels.');
  if (!t || ![t.x, t.y, t.scale, t.angle].every(Number.isFinite) || Math.abs(t.x) > 32768 || Math.abs(t.y) > 32768 || t.scale < .05 || t.scale > 8 || Math.abs(t.angle) > Math.PI * 2)
    throw new Error('Invalid image placement.');
  if (!Array.isArray(recipe.bindings) || recipe.bindings.length > 32 || recipe.bindings.some(b => !['source', 'frame'].includes(b))) throw new Error('Invalid character bindings.');
  return {schema: COMPOSITION_SCHEMA, source: {...source}, frame: {...f}, transform: {...t}, bindings: [...recipe.bindings]};
}
export function sourceToFrame(p, recipe) {
  const {source: s, transform: t} = recipe, x = (p.x - s.width / 2) * t.scale, y = (p.y - s.height / 2) * t.scale;
  return {x: t.x + x * Math.cos(t.angle) - y * Math.sin(t.angle), y: t.y + x * Math.sin(t.angle) + y * Math.cos(t.angle)};
}
export function frameToSource(p, recipe) {
  const {source: s, transform: t} = recipe, x = p.x - t.x, y = p.y - t.y;
  return {x: (x * Math.cos(t.angle) + y * Math.sin(t.angle)) / t.scale + s.width / 2,
    y: (-x * Math.sin(t.angle) + y * Math.cos(t.angle)) / t.scale + s.height / 2};
}
export function characterCenter(center, binding, recipe) {
  if (binding === 'frame') return {...center};
  const p = sourceToFrame({x: center.x * recipe.source.width, y: center.y * recipe.source.height}, recipe);
  return {x: p.x / recipe.frame.width, y: p.y / recipe.frame.height};
}
export function resizeCompositionFrame(recipe, edge, delta, characters = []) {
  const next = structuredClone(recipe), horizontal = ['left', 'right'].includes(edge), leading = ['left', 'top'].includes(edge);
  if (!['left','right','top','bottom'].includes(edge)) throw new Error('Invalid frame edge.');
  const key = horizontal ? 'width' : 'height', axis = horizontal ? 'x' : 'y', old = recipe.frame[key];
  next.frame[key] = Math.round((old + (leading ? -delta : delta)) / 8) * 8;
  const offset = leading ? next.frame[key] - old : 0;
  next.transform[axis] += offset;
  validateComposition(next, recipe.source);
  const mapped = structuredClone(characters);
  mapped.forEach((c, i) => { if (recipe.bindings[i] === 'frame') c.centers = (c.centers || [{x:.5,y:.5}]).map(p => ({...p, [axis]: (p[axis] * old + offset) / next.frame[key]})); });
  return {recipe: next, characters: mapped};
}
// Premultiplied bilinear colour sampling avoids dark halos at transparent edges.
// A summed-area mask conservatively retains thin strokes when reducing an image.
export function renderCompositionPixels(source, manualAlpha, recipe) {
  validateComposition(recipe, recipe.source);
  const {width: sw, height: sh} = recipe.source, {width: w, height: h} = recipe.frame;
  if (source.length !== sw * sh * 4 || manualAlpha.length !== sw * sh) throw new Error('Invalid source/mask pixels.');
  const image = new Uint8ClampedArray(w * h * 4), mask = new Uint8Array(w * h), gap = new Uint8Array(w * h);
  const integral = new Uint32Array((sw + 1) * (sh + 1)), stride = sw + 1;
  for (let y = 0; y < sh; y++) { let sum = 0; for (let x = 0; x < sw; x++) { sum += manualAlpha[y * sw + x] > 0 ? 1 : 0; integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum; } }
  const t = recipe.transform, cos = Math.cos(t.angle), sin = Math.sin(t.angle), footprint = Math.max(.5, (Math.abs(cos) + Math.abs(sin)) / (2 * t.scale));
  let selected = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + .5 - t.x, dy = y + .5 - t.y, sx = (dx * cos + dy * sin) / t.scale + sw / 2, sy = (-dx * sin + dy * cos) / t.scale + sh / 2;
    const bx = Math.floor(sx - .5), by = Math.floor(sy - .5), fx = sx - .5 - bx, fy = sy - .5 - by, i = y * w + x, o = i * 4;
    let alpha = 0, red = 0, green = 0, blue = 0;
    for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
      const px = bx + ox, py = by + oy;
      if (px < 0 || py < 0 || px >= sw || py >= sh) continue;
      const q = (py * sw + px) * 4, weight = (ox ? fx : 1-fx) * (oy ? fy : 1-fy) * source[q+3];
      alpha += weight; red += source[q] * weight; green += source[q+1] * weight; blue += source[q+2] * weight;
    }
    image[o+3] = alpha;
    if (alpha > 0) { image[o] = red / alpha; image[o+1] = green / alpha; image[o+2] = blue / alpha; }
    const x0 = clamp(Math.floor(sx-footprint),0,sw), x1 = clamp(Math.ceil(sx+footprint),0,sw), y0 = clamp(Math.floor(sy-footprint),0,sh), y1 = clamp(Math.ceil(sy+footprint),0,sh);
    const manual = integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0];
    gap[i] = image[o+3] < 254 ? 255 : 0;
    mask[i] = gap[i] || (manual > 0 ? 255 : 0); if (mask[i]) selected++;
  }
  return {image, mask, gap, selected};
}
