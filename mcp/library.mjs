import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { cloneBuiltInCharacterPresetCategories, normalizeCharacterPresetCategoryName } from '../src/state/character-preset-categories.js';
import { assertNoSecretMaterial, sanitizeStoreId } from '../src/services/file-store-utils.js';
import { sortPresets } from '../src/state/preset-sorting.js';

const PRESET_FILES = {
  character: ['character-presets', 'character-preset.json'],
  full: ['presets', 'preset.json'],
  base: ['base-prompts', 'base-prompt.json'],
  negative: ['undesired-prompts', 'undesired-prompt.json'],
  settings: ['params-presets', 'params-preset.json'],
};
const string = value => typeof value === 'string' ? value : '';
const fields = (value, keys) => Object.fromEntries(keys.filter(key => ['string', 'number', 'boolean'].includes(typeof value?.[key])).map(key => [key, value[key]]));
const error = (code, message) => Object.assign(new Error(message), { code });
const within = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);

// This adapter deliberately has no file-writing or generation methods. Every
// call reads current on-disk records; it can also be used while the app is closed.
export function createLibrary({ rootDir }) {
  const root = path.resolve(rootDir);
  const data = path.join(root, 'data');

  async function safePath(relative, scope, { missing = false } = {}) {
    const expected = path.resolve(data, scope);
    const candidate = path.resolve(data, relative);
    if (!within(expected, candidate)) throw error('invalid_path', 'Asset is outside its allowed data section.');
    let actualData;
    try { actualData = await realpath(data); }
    catch (e) {
      if (e.code === 'ENOENT') throw error('data_unavailable', 'The selected app data directory does not exist. Check the MCP data-root setting.');
      throw error('data_unavailable', 'The selected app data directory cannot be read.');
    }
    try {
      const actual = await realpath(candidate);
      const actualScope = path.resolve(actualData, scope);
      // Symlinks / junctions into a different section or outside the data root
      // must not turn a History read into arbitrary file access.
      if (!within(actualScope, actual)) throw error('invalid_path', 'Linked files outside the allowed data section are not accessible.');
      return actual;
    } catch (e) {
      if (missing && e.code === 'ENOENT') return null;
      if (e.code === 'ENOENT') throw error('not_found', 'The requested record or image no longer exists.');
      throw e;
    }
  }

  async function entries(relative, scope) {
    const target = await safePath(relative, scope, { missing: true });
    return target ? readdir(target, { withFileTypes: true }) : [];
  }
  async function json(relative, scope) {
    const target = await safePath(relative, scope);
    if ((await stat(target)).size > 8 * 1024 * 1024) throw error('record_too_large', 'Record exceeds the 8 MiB read limit.');
    try { return JSON.parse(await readFile(target, 'utf8')); }
    catch (e) {
      if (e instanceof SyntaxError) throw error('invalid_record', 'Record is incomplete or invalid JSON. Retry after the app finishes saving.');
      throw e;
    }
  }
  const safeResult = value => {
    assertNoSecretMaterial(value, 'MCP prompt data');
    return value;
  };

  async function presets(kind) {
    const config = PRESET_FILES[kind];
    if (!config) throw error('invalid_kind', 'Unknown preset kind.');
    const [section, filename] = config;
    const items = [], skipped = [];
    for (const entry of await entries(section, section)) {
      if (!entry.isDirectory()) continue;
      try {
        const id = sanitizeStoreId(entry.name);
        const raw = await json(`${section}/${id}/${filename}`, section);
        if ((kind === 'full' ? raw.metadata?.id : raw.id) !== id) throw error('invalid_record', 'Preset id does not match its folder.');
        items.push(safeResult(projectPreset(raw, kind)));
      } catch { skipped.push(entry.name); }
    }
    return { items, skipped_count: skipped.length };
  }

  async function history() {
    const items = [], skipped = [];
    for (const folder of await entries('generations', 'generations')) {
      if (!folder.isDirectory()) continue;
      for (const file of await entries(`generations/${folder.name}`, 'generations')) {
        if (!file.isFile() || !file.name.endsWith('.json') || file.name.endsWith('.payload.json')) continue;
        try {
          const id = sanitizeStoreId(file.name.slice(0, -5));
          const raw = await json(`generations/${folder.name}/${file.name}`, 'generations');
          if (raw.generation_id !== id) throw error('invalid_record', 'History id does not match its file.');
          const imageRelative = raw.output?.image_filename || `data/generations/${folder.name}/${id}.png`;
          if (!string(imageRelative).replaceAll('\\', '/').startsWith('data/generations/')) throw error('invalid_path', 'Invalid stored History image path.');
          const imagePath = await safePath(imageRelative.slice(5), 'generations', { missing: true });
          const item = safeResult({
            id, created_at: string(raw.created_at),
            preset: fields(raw.preset, ['id', 'name']),
            ...fields(raw.generation, ['model', 'mode', 'width', 'height', 'seed']),
            image_path: imagePath, image_available: !!imagePath,
            record_revision: createHash('sha256').update(JSON.stringify(raw)).digest('hex'),
          });
          items.push({ item, raw, relative: `generations/${folder.name}/${file.name}` });
        } catch { skipped.push(file.name); }
      }
    }
    return { items, skipped_count: skipped.length };
  }
  async function findHistory(id) {
    sanitizeStoreId(id);
    const records = await history();
    const matching = records.items.filter(record => record.item.id === id);
    if (matching.length !== 1) throw error(matching.length ? 'ambiguous_id' : 'not_found', 'History record could not be uniquely found.');
    return matching[0];
  }

  return {
    async status() {
      let available = false;
      try { available = (await stat(await realpath(data))).isDirectory(); } catch {}
      return { name: 'Chaessi Preset', data_root: root, data_available: available, read_only: true,
        preset_kinds: Object.keys(PRESET_FILES), history_default_order: 'oldest-first',
        note: 'Read saved data only. No generation, deletion, JPG conversion, HTML creation or publishing tools.' };
    },
    async listCategories({ locale = 'ko' } = {}) {
      const categories = new Map(cloneBuiltInCharacterPresetCategories().map(c => [c.name, { name: c.name, subcategories: new Set(c.subcategories), preset_count: 0 }]));
      let configWarning = false;
      try {
        const exists = await safePath('character-preset-categories/categories.json', 'character-preset-categories', { missing: true });
        if (exists) {
          const config = await json('character-preset-categories/categories.json', 'character-preset-categories');
          if (config.schema !== 'chaessi-character-preset-categories/v1' || !Array.isArray(config.categories)) throw error('invalid_record', 'Invalid categories.');
          for (const c of config.categories) {
            if (!string(c.name)) continue;
            const name = normalizeCharacterPresetCategoryName(c.name);
            const category = categories.get(name) || { name, subcategories: new Set(), preset_count: 0 };
            for (const sub of c.subcategories || []) if (string(sub)) category.subcategories.add(sub);
            categories.set(name, category);
          }
        }
      } catch (e) { if (e.code === 'data_unavailable') throw e; configWarning = true; }
      const records = await presets('character');
      for (const preset of records.items) {
        const c = categories.get(preset.category) || { name: preset.category, subcategories: new Set(), preset_count: 0 };
        c.preset_count++;
        if (preset.subcategory) c.subcategories.add(preset.subcategory);
        categories.set(c.name, c);
      }
      const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
      return safeResult({ items: [...categories.values()].map(c => ({ name: c.name, preset_count: c.preset_count,
        subcategories: [...c.subcategories].sort(collator.compare).map(name => ({ name,
          preset_count: records.items.filter(p => p.category === c.name && p.subcategory === name).length }))
      })).sort((a, b) => collator.compare(a.name, b.name)), skipped_count: records.skipped_count, config_warning: configWarning });
    },
    async listPresets({ kind = 'character', filters = [], query = '', sort = 'name-asc', locale = 'ko', offset = 0, limit = 50, expected_snapshot } = {}) {
      const records = await presets(kind);
      const needle = query.toLocaleLowerCase(locale);
      const selected = records.items.filter(p => (!needle || p.name.toLocaleLowerCase(locale).includes(needle)) &&
        (!filters.length || filters.some(f => (!f.category || p.category === normalizeCharacterPresetCategoryName(f.category)) && (!f.subcategory || p.subcategory === f.subcategory))));
      const items = sortPresets(selected, sort, locale);
      return page(items, { offset, limit, expected_snapshot, skipped_count: records.skipped_count, sort, locale });
    },
    async getPreset({ kind = 'character', id }) {
      sanitizeStoreId(id);
      const config = PRESET_FILES[kind];
      if (!config) throw error('invalid_kind', 'Unknown preset kind.');
      const [section, filename] = config;
      const raw = await json(`${section}/${id}/${filename}`, section);
      if ((kind === 'full' ? raw.metadata?.id : raw.id) !== id) throw error('invalid_record', 'Preset id does not match its folder.');
      return safeResult(projectPreset(raw, kind));
    },
    async listHistory({ order = 'oldest-first', offset = 0, limit = 50, expected_snapshot } = {}) {
      const records = await history();
      const items = records.items.map(r => r.item).sort((a, b) => {
        const time = string(a.created_at).localeCompare(string(b.created_at));
        return (order === 'newest-first' ? -time : time) || a.id.localeCompare(b.id);
      });
      return page(items, { offset, limit, expected_snapshot, skipped_count: records.skipped_count, order });
    },
    async getHistory({ id }) {
      const { item, raw } = await findHistory(id);
      const actual = raw.generation || {};
      const payload = raw.raw_payload || {};
      // Prefer the transmitted payload / final generation fields, never a
      // current preset definition or Wildcard candidate library.
      const chars = actual.characterPrompts || payload.parameters?.characterPrompts;
      const positiveCaptions = payload.parameters?.v4_prompt?.caption?.char_captions || [];
      const negativeCaptions = payload.parameters?.v4_negative_prompt?.caption?.char_captions || [];
      const finalCharacters = Array.isArray(chars) && chars.length
        ? chars.map(c => ({ prompt: string(c.prompt), negative_prompt: string(c.uc ?? c.undesired), enabled: c.enabled !== false }))
        : positiveCaptions.map((c, index) => ({ prompt: string(c.char_caption), negative_prompt: string(negativeCaptions[index]?.char_caption), enabled: true }));
      return safeResult({ ...item,
        final_prompt: string(actual.prompt ?? payload.input),
        final_negative_prompt: string(actual.undesired_prompt ?? payload.parameters?.negative_prompt),
        final_characters: finalCharacters,
        saved_prompt_parts: projectPromptParts(raw.internal_preset?.prompt_parts),
        image_operation: raw.image_operation ? { tool: string(raw.image_operation.tool), parent_id: string(raw.image_operation.parent_id), actual_output_size: fields(raw.image_operation.actual_output_size, ['width', 'height']), actual_anlas: raw.image_operation.actual_anlas ?? null, settings: fields(raw.image_operation.settings, ['prompt','emotion','defry','effort','magnitude','strength','noise','factor','extension','selection','context','inpaint_strength','image_strength','image_noise','padding']), request_generation_parameters: fields(raw.image_operation.request_generation_parameters, ['width','height','steps','sampler','scale','cfg_rescale','seed','strength','noise','upscaled_enhance']), prompt_role: 'original-generation-provenance' } : null,
        association: 'History stores the overall preset and prompts. Character category/name is not reliably recorded; do not claim an ordinal match is verified.',
      });
    },
    async getHistoryImage({ id }) {
      const { item } = await findHistory(id);
      if (!item.image_available) throw error('not_found', 'History image no longer exists.');
      const target = await safePath(path.relative(data, item.image_path), 'generations');
      if ((await stat(target)).size > 6 * 1024 * 1024) throw error('image_too_large', 'Image exceeds the 6 MiB MCP image limit. Use its local image_path from get_history instead.');
      const bytes = await readFile(target);
      if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw error('invalid_image', 'History image is not a PNG.');
      return { item, bytes, mimeType: 'image/png' };
    },
  };
}

function projectPromptParts(parts) {
  return { base: string(parts?.base), undesired: string(parts?.undesired),
    characters: (Array.isArray(parts?.characters) ? parts.characters : []).map(c => ({
      ...fields(c, ['id', 'name', 'enabled']), prompt: string(c.prompt), undesired: string(c.undesired),
    })) };
}
function projectPreset(raw, kind) {
  const meta = kind === 'full' ? raw.metadata : raw;
  const item = { kind, ...fields(meta, ['id', 'name', 'created_at', 'updated_at']) };
  item.name ||= 'Untitled';
  if (kind === 'character') Object.assign(item, { category: normalizeCharacterPresetCategoryName(raw.category),
    subcategory: string(raw.subCategory ?? raw.subcategory).trim(), prompt: string(raw.prompt), undesired: string(raw.undesired) });
  if (kind === 'base') item.prompt = string(raw.prompt ?? raw.base_prompt);
  if (kind === 'negative') item.undesired = string(raw.undesired ?? raw.prompt);
  if (kind === 'full') item.prompt_parts = projectPromptParts(raw.prompt_parts);
  if (['full', 'settings'].includes(kind)) item.params = fields(raw.params, ['model', 'width', 'height', 'steps', 'scale', 'seed', 'sampler', 'noise_schedule']);
  return item;
}
function page(items, options) {
  const { offset, limit, expected_snapshot, ...info } = options;
  const snapshot = createHash('sha256').update(JSON.stringify({ items, info })).digest('hex');
  if (expected_snapshot && expected_snapshot !== snapshot) throw error('snapshot_changed', 'The library changed while paging. Start again at offset 0.');
  return { ...info, total: items.length, offset, limit, snapshot,
    next_offset: offset + limit < items.length ? offset + limit : null,
    items: items.slice(offset, offset + limit).map((item, index) => ({ ordinal: offset + index + 1, ...item })) };
}
