import {createHash, randomUUID} from 'node:crypto';
import {readFile, writeFile, rename, mkdir, readdir} from 'node:fs/promises';
import path from 'node:path';
import {compileCamera, normalizeCamera, CAMERA_SCHEMA} from '../camera-input/model.js';
import {assertNoSecretMaterial, sanitizeStoreId, storeError} from './file-store-utils.js';
import {validatePreset} from '../adapters/novelai-v45-full.js';

export function prepareCameraInput(original, resolved, camera, mode) {
  if (!camera) return {preset: resolved, context: null};
  const compiled = compileCamera(resolved, camera);
  if (!compiled.camera.enabled) return {preset: resolved, context: null};
  const reviewKey = createHash('sha256').update(JSON.stringify({original, resolved, camera: compiled.camera, mode})).digest('hex');
  const context = {schema: CAMERA_SCHEMA, state: compiled.camera, original_preset: structuredClone(original),
    resolved_prompt_parts: structuredClone(resolved.prompt_parts), block: compiled.block, terms: compiled.terms,
    conflicts: compiled.conflicts, excluded: compiled.excluded, needs_review: compiled.needsReview, review_key: reviewKey,
    mode, scene_center: {x: 0.5, y: 0.5}};
  assertNoSecretMaterial(context, 'camera input');
  return {preset: compiled.preset, context};
}
export function requireCameraReview(context, acknowledgement) {
  if (context?.needs_review && acknowledgement !== context.review_key) throw storeError(409, 'camera_review_required', 'Review the remaining manual camera expressions before generating.');
}
export function finishCameraRecord(context, payload) {
  if (!context) return null;
  const record = structuredClone(context);
  delete record.review_key;
  record.final_caption = payload.parameters.v4_prompt?.caption ?? null;
  record.input = payload.input;
  record.recorded_at = new Date().toISOString();
  return record;
}
export function createCameraInputStore(root) {
  const dir = path.join(root, 'data', 'camera-input-v382');
  let queue = Promise.resolve();
  return {
    async list() {
      await mkdir(dir, {recursive: true});
      const items = [];
      for (const file of await readdir(dir)) {
        if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
        const item = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
        items.push({id: item.id, name: item.name, saved_at: item.saved_at});
      }
      return items.sort((a,b) => b.saved_at.localeCompare(a.saved_at));
    },
    async get(id) {
      const item = JSON.parse(await readFile(path.join(dir, sanitizeStoreId(id) + '.json'), 'utf8'));
      normalizeCamera(item.camera); assertNoSecretMaterial(item, 'saved camera work'); return item;
    },
    async save(body) {
      const camera = normalizeCamera(body.camera), validation = validatePreset(body.preset);
      if (!validation.ok || validation.warnings.length) throw storeError(400, 'invalid_preset', 'Invalid saved camera work preset.');
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120) throw storeError(400, 'invalid_name', 'Enter a camera work name (1–120 characters).');
      const item = {schema: CAMERA_SCHEMA, id: randomUUID(), name: body.name.trim(), saved_at: new Date().toISOString(), camera, preset: structuredClone(body.preset)};
      assertNoSecretMaterial(item, 'camera work');
      const run = async () => {
        await mkdir(dir, {recursive: true});
        const file = path.join(dir, item.id + '.json'), temporary = file + '.tmp';
        await writeFile(temporary, JSON.stringify(item, null, 2)); await rename(temporary, file); return item;
      };
      const task = queue.then(run, run); queue = task.catch(() => {}); return task;
    },
  };
}
