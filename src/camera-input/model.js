// Independent v3.8.2 camera input. No source-image inference or legacy calibration.
export const CAMERA_SCHEMA = 'absolute-camera/1';
export const AXES = ['shot', 'direction', 'elevation', 'height', 'pan', 'tilt', 'roll'];
export const SHOTS = ['close-up', 'upper body', 'cowboy shot', 'full body', 'wide shot'];
export const HEIGHTS = ['none', 'eye-level', 'waist-level view', 'ground-level view'];
export function defaultCamera(enabled = false) {
  return { schema: CAMERA_SCHEMA, enabled, yaw: 0, elevation: 0, shot: 'upper body',
    height: 'none', pan: 0, tilt: 0, roll: 0, excludeBaseTags: false,
    weights: Object.fromEntries(AXES.map(axis => [axis, 1])), overrides: {} };
}
export function cameraError(message) {
  const error = new Error(message);
  Object.assign(error, {statusCode: 400, type: 'invalid_camera_input', publicMessage: message});
  return error;
}
export function normalizeCamera(value) {
  if (!value || value.schema !== CAMERA_SCHEMA) throw cameraError('Unknown camera version. Legacy records are read-only.');
  const result = defaultCamera();
  if (typeof value.enabled !== 'boolean' || typeof value.excludeBaseTags !== 'boolean') throw cameraError('Invalid camera switches.');
  result.enabled = value.enabled; result.excludeBaseTags = value.excludeBaseTags;
  for (const [key, min, max] of [['yaw', -180, 180], ['elevation', -90, 90], ['pan', -100, 100], ['tilt', -90, 90], ['roll', -180, 180]]) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < min || value[key] > max) throw cameraError('Invalid camera coordinate: ' + key);
    result[key] = Math.round(value[key] * 1000) / 1000;
  }
  if (!SHOTS.includes(value.shot) || !HEIGHTS.includes(value.height)) throw cameraError('Invalid camera framing.');
  result.shot = value.shot; result.height = value.height;
  for (const axis of AXES) {
    const weight = value.weights?.[axis];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < -10 || weight > 10) throw cameraError('Complete the camera weight before continuing.');
    result.weights[axis] = Math.round(weight * 1000) / 1000;
    if (value.overrides?.[axis] !== undefined) {
      const text = value.overrides[axis];
      if (typeof text !== 'string' || text.length > 300 || /[\r\n{}\[\]:|]/.test(text) || /__/.test(text)) throw cameraError('Use plain camera wording; adjust emphasis in the weight field.');
      result.overrides[axis] = text;
    }
  }
  return result;
}
export function directionAt(yaw) {
  const angle = Math.abs(yaw);
  return angle < 22.5 ? 'from front' : angle < 67.5 ? 'three-quarter view' : angle < 112.5 ? 'from side' : angle < 157.5 ? 'three-quarter rear view' : 'from behind';
}
export function cameraTerms(state) {
  const c = normalizeCamera(state);
  const generated = {shot: c.shot, direction: directionAt(c.yaw),
    elevation: c.elevation > 15 ? 'from above' : c.elevation < -15 ? 'from below' : '',
    height: c.height === 'none' ? '' : c.height,
    pan: c.pan < -10 ? 'subject on the right side of the frame' : c.pan > 10 ? 'subject on the left side of the frame' : '',
    tilt: c.tilt < -15 ? 'camera aimed downward' : c.tilt > 15 ? 'camera aimed upward' : '',
    roll: Math.abs(c.roll) > 5 ? 'dutch angle' : ''};
  return AXES.map(axis => ({axis, automatic: generated[axis], text: c.overrides[axis] ?? generated[axis], weight: c.weights[axis], manual: Object.hasOwn(c.overrides, axis)}));
}
const GROUPS = {
  direction: ['from front', 'front view', 'frontal view', 'three-quarter view', 'three-quarter front view', 'three-quarter rear view', 'three-quarter back view', 'from side', 'side view', 'profile view', 'from behind', 'back view', 'rear view', 'three-quarter front view from the right', 'three-quarter front view from the left', 'three-quarter back view from the right', 'three-quarter back view from the left'],
  shot: [...SHOTS, 'portrait', 'bust', 'face focus', 'extreme close-up', 'very wide shot'],
  elevation: ['from above', 'from below', 'high angle', 'low angle', "bird's-eye view", "worm's-eye view"],
  height: HEIGHTS.filter(x => x !== 'none'), roll: ['dutch angle', 'tilted frame'],
  pan: ['subject on the right side of the frame', 'subject on the left side of the frame'],
  tilt: ['camera aimed downward', 'camera aimed upward'],
};
const known = new Map(Object.entries(GROUPS).flatMap(([axis, tags]) => tags.map(tag => [tag, axis])));
const canonical = text => text.toLowerCase().replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
// Split only complete top-level expressions. Grouped or ambiguous prose is never removed.
export function promptSegments(text) {
  const result = []; let start = 0, nesting = 0, numeric = 0;
  for (let i = 0; i < text.length; i++) {
    if ('{[('.includes(text[i])) nesting++;
    if ('}])'.includes(text[i])) nesting = Math.max(0, nesting - 1);
    if (text.slice(i, i + 2) === '::') {
      const prefix = text.slice(start, i);
      if (/(?:^|[\s,])[-+]?\d+(?:\.\d+)?$/.test(prefix)) numeric++;
      else numeric = Math.max(0, numeric - 1);
      i++; continue;
    }
    if (text[i] === ',' && nesting === 0 && numeric === 0) { result.push({start, end: i, text: text.slice(start, i)}); start = i + 1; }
  }
  result.push({start, end: text.length, text: text.slice(start)});
  return result;
}
export function inspectCameraTags(text, location = 'Base') {
  const hits = [];
  for (const segment of promptSegments(String(text || ''))) {
    const trimmed = segment.text.trim();
    const unwrapped = trimmed.replace(/^[-+]?\d+(?:\.\d+)?::([^:]+)::$/, '$1').replace(/^\{([^{}]+)\}$|^\[([^\[\]]+)\]$/g, (_, a, b) => a ?? b);
    const tag = canonical(unwrapped);
    if (known.has(tag)) { hits.push({...segment, location, tag, axis: known.get(tag), removable: true}); continue; }
    // Inside grouped tags: report, but leave every byte untouched. Free prose is not reinterpreted.
    if (/[{}\[\]:]/.test(trimmed)) {
      const inner = canonical(trimmed).replace(/[-+]?\d+(?:\.\d+)?::|::|[{}\[\]]/g, '');
      for (const part of inner.split(',')) if (known.has(part.trim())) hits.push({...segment, location, tag: part.trim(), axis: known.get(part.trim()), removable: false});
    }
  }
  return hits;
}
export function compileCamera(preset, input) {
  const camera = normalizeCamera(input), result = structuredClone(preset);
  if (!camera.enabled) return {preset: result, camera, block: '', terms: [], conflicts: [], excluded: [], needsReview: false};
  const terms = cameraTerms(camera);
  const block = terms.filter(term => term.text.trim() && term.weight !== 0).map(term => term.weight === 1 ? term.text.trim() : `${term.weight}::${term.text.trim()}::`).join(', ');
  // Custom text can explain a single intent with multiple words, but known opposing groups are rejected.
  const ownTags = inspectCameraTags(block);
  const axes = new Map();
  for (const hit of ownTags) { const values = axes.get(hit.axis) || new Set(); values.add(hit.tag); axes.set(hit.axis, values); }
  if ([...axes.values()].some(values => values.size > 1)) throw cameraError('Camera wording contains conflicting expressions on the same axis.');
  const base = String(preset.prompt_parts?.base || '');
  const conflicts = inspectCameraTags(base);
  for (const [index, character] of (preset.prompt_parts?.characters || []).entries()) {
    if (character.enabled !== false) conflicts.push(...inspectCameraTags(character.prompt, `Character ${index + 1}`));
  }
  const excluded = camera.excludeBaseTags ? conflicts.filter(hit => hit.location === 'Base' && hit.removable) : [];
  const removeStarts = new Set(excluded.map(hit => hit.start));
  // Only the generated copy is reconstructed. The editing original is retained separately.
  const generatedBase = excluded.length ? promptSegments(base).filter(segment => !removeStarts.has(segment.start)).map(segment => segment.text).join(',') : base;
  result.prompt_parts.base = [block, generatedBase].filter(text => text.trim()).join(', ');
  const remaining = conflicts.filter(hit => !excluded.includes(hit));
  return {preset: result, camera, block, terms, conflicts, excluded, needsReview: remaining.length > 0};
}
