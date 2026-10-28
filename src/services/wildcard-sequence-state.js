import path from 'node:path';
import {mkdir, open, readFile, rename, unlink} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {createTimestampId, storeError, assertNoSecretMaterial} from './file-store-utils.js';

const hash = value => createHash('sha256').update(value).digest('hex');
export const wildcardDefinitionHash = item => hash(JSON.stringify([item.id, item.key, item.selection_mode || 'random', item.entries]));

// One state file and, at most, one pending History save. No provider retries.
// The owning Wildcard store serializes mutations and generation acquisition.
export function createWildcardSequenceState({rootDir}) {
  const file = path.join(rootDir, 'data', 'wildcard-sequence', 'state.json');
  let state, loading, recovery, active = null;
  async function persist(next) {
    assertNoSecretMaterial(next, 'Wildcard sequence state');
    await mkdir(path.dirname(file), {recursive: true});
    const temp = `${file}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temp, 'wx');
      await handle.writeFile(JSON.stringify(next, null, 2) + '\n');
      await handle.sync(); await handle.close(); handle = null;
      await rename(temp, file); state = next;
    } catch (error) { state = undefined; loading = null; throw error; }
    finally { await handle?.close(); await unlink(temp).catch(() => {}); }
  }
  function validate(value) {
    if (value?.schema !== 'chaessi-wildcard-sequence/v1' || !value.cursors || typeof value.cursors !== 'object' || Array.isArray(value.cursors)) throw new Error('Invalid state');
    for (const cursor of Object.values(value.cursors)) {
      if (!Array.isArray(cursor.entries) || !cursor.entries.length || cursor.entries.some(e => typeof e !== 'string') || !Number.isSafeInteger(cursor.next_index) || cursor.next_index < 0 || cursor.next_index >= cursor.entries.length || !Number.isSafeInteger(cursor.revision) || cursor.revision < 0) throw new Error('Invalid cursor');
    }
    const p = value.pending;
    if (p && (!/^[A-Za-z0-9_-]+$/.test(p.id) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !/^[a-f0-9]{64}$/.test(p.image_sha256) || !Array.isArray(p.choices) || !p.choices.length)) throw new Error('Invalid pending save');
    if (p) for (const choice of p.choices) if (!Array.isArray(choice.entries) || !choice.entries.length || !Number.isSafeInteger(choice.index) || choice.index < 0 || choice.index >= choice.entries.length || !Number.isSafeInteger(choice.revision) || choice.revision < 0 || typeof choice.id !== 'string') throw new Error('Invalid pending choice');
    return value;
  }
  async function saved(pending) {
    const folder = path.join(rootDir, 'data', 'generations', pending.date);
    try {
      const record = JSON.parse(await readFile(path.join(folder, pending.id + '.json'), 'utf8'));
      const payload = JSON.parse(await readFile(path.join(folder, pending.id + '.payload.json'), 'utf8'));
      const image = await readFile(path.join(folder, pending.id + '.png'));
      return record.status === 'success' && record.generation_id === pending.id && record.wildcard_selection?.id === pending.id && hash(image) === pending.image_sha256 && JSON.stringify(record.raw_payload) === JSON.stringify(payload);
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return false;
      throw error;
    }
  }
  async function settle() {
    if (!state.pending) return;
    const next = structuredClone(state), pending = next.pending;
    if (await saved(pending)) for (const choice of pending.choices) {
      if ((next.cursors[choice.id]?.revision || 0) !== choice.revision) throw storeError(409, 'wildcard_sequence_recovery', 'Wildcard position recovery needs attention. No new generation was sent.');
      next.cursors[choice.id] = {entries: choice.entries, next_index: (choice.index + 1) % choice.entries.length, revision: choice.revision + 1};
    }
    next.pending = null; await persist(next);
  }
  async function ready() {
    if (!loading) loading = (async () => {
      try { state = validate(JSON.parse(await readFile(file, 'utf8'))); }
      catch (error) {
        if (error.code === 'ENOENT') state = {schema: 'chaessi-wildcard-sequence/v1', cursors: {}, pending: null};
        else throw storeError(500, 'wildcard_sequence_state', 'Could not read Wildcard positions. Restore the sequence state from backup before generating.');
      }
      await settle();
    })().catch(error => { loading = null; throw error; });
    await loading;
    if (state.pending && !active) {
      recovery ||= settle().finally(() => { recovery = null; });
      await recovery;
    }
  }
  function position(item, cursor = state.cursors[item.id]) {
    let index = 0;
    if (cursor) {
      const available = new Map(item.entries.map((entry, i) => [entry, i]));
      for (let n = 0; n < cursor.entries.length; n++) {
        const candidate = cursor.entries[(cursor.next_index + n) % cursor.entries.length];
        if (available.has(candidate)) { index = available.get(candidate); break; }
      }
    }
    return {next_index: index, next_entry: item.entries[index], revision: cursor?.revision || 0, definition_hash: wildcardDefinitionHash(item)};
  }
  function assertEditable() {
    if (active) throw storeError(409, 'wildcard_sequence_busy', 'Wait for the sequential Wildcard generation to finish before editing or resetting Wildcards.');
  }
  return {
    ready, assertEditable,
    async view(item) { await ready(); return {...item, selection_mode: item.selection_mode || 'random', sequence: position(item)}; },
    async reset(item) {
      await ready(); assertEditable();
      const next = structuredClone(state);
      next.cursors[item.id] = {entries: item.entries, next_index: 0, revision: (state.cursors[item.id]?.revision || 0) + 1};
      await persist(next);
    },
    async reconcile(previous, item) {
      const old = state.cursors[item.id];
      if (!old || JSON.stringify(previous.entries) === JSON.stringify(item.entries)) return;
      const cursor = {entries: previous.entries, next_index: position(previous).next_index, revision: old.revision + 1};
      const next = structuredClone(state);
      next.cursors[item.id] = {entries: item.entries, next_index: position(item, cursor).next_index, revision: cursor.revision};
      await persist(next);
    },
    async begin(choices, definitions) {
      await ready(); if (!choices.length) return null;
      assertEditable();
      for (const choice of choices) {
        const item = definitions.find(item => item.id === choice.id);
        if (!item || wildcardDefinitionHash(item) !== choice.definition_hash || position(item).revision !== choice.revision || position(item).next_index !== choice.index) throw storeError(409, 'wildcard_sequence_changed', 'Wildcard choices changed. Generate again to review the next item.');
      }
      active = {id: createTimestampId(new Date()), choices: choices.map(choice => ({...structuredClone(choice), entries: definitions.find(item => item.id === choice.id).entries}))};
      return active;
    },
    async stage(lease, imageBytes) {
      if (!lease) return null;
      if (active !== lease) throw new Error('Sequential Wildcard generation is no longer active.');
      const created_at = new Date().toISOString();
      const pending = {id: lease.id, date: created_at.slice(0, 10), image_sha256: hash(imageBytes), choices: lease.choices};
      await persist({...structuredClone(state), pending});
      return {id: lease.id, created_at, selections: lease.choices.map(({entries, ...choice}) => choice)};
    },
    async finish(lease) {
      if (!lease || active !== lease) return;
      try { await ready(); await settle(); }
      finally { active = null; }
    },
    async abort(lease) {
      if (!lease || active !== lease) return;
      try { await ready(); await settle(); }
      finally { active = null; }
    },
  };
}
