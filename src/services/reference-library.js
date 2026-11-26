import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { assertNoSecretMaterial, storeError } from './file-store-utils.js';
import { detectImageMimeFromBytes } from '../ui/image-intake.js';

export const MAX_LIBRARY_PART_BYTES = 30 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
const MAX_PARTS = 4096;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const preciseTypes = ['character', 'style', 'character&style', 'outfit'];
const bad = (message) => storeError(400, 'invalid_reference_library_entry', message);
const missing = () => storeError(404, 'reference_not_found', 'Saved reference not found.');
const stale = () => storeError(409, 'reference_changed', 'The saved reference changed. Refresh the list before continuing.');

function validName(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 160 || /[\u0000-\u001f]/.test(value)) {
    throw bad('Enter a reference name of 1–160 characters.');
  }
  return value.trim();
}

function bounded(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) throw bad(`Invalid ${label}.`);
  return value;
}

function boolean(value) {
  if (typeof value !== 'boolean') throw bad('Invalid reference option.');
  return value;
}

function fileName(value) {
  if (typeof value !== 'string' || !value || value.length > 255 || /[\\/\u0000-\u001f]/.test(value)) {
    throw bad('Invalid reference file name.');
  }
  return value;
}

export function createReferenceLibrary({ rootDir }) {
  const folder = path.join(rootDir, 'data', 'reference-library');
  const file = path.join(folder, 'library.sqlite');
  const uploads = new Map();
  let db;

  function database(create = false) {
    if (db) return db;
    if (!create && !existsSync(file)) return null;
    if (create) mkdirSync(folder, { recursive: true });
    db = new DatabaseSync(file);
    db.exec(`
      PRAGMA busy_timeout=5000;
      PRAGMA foreign_keys=ON;
      PRAGMA secure_delete=ON;
      PRAGMA auto_vacuum=FULL;
      PRAGMA temp_store=FILE;
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, scope TEXT NOT NULL, version INTEGER NOT NULL,
        updated TEXT NOT NULL, count INTEGER NOT NULL, snapshot TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assets (
        entry TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE, slot INTEGER NOT NULL,
        bytes BLOB NOT NULL, PRIMARY KEY(entry, slot)
      );
      CREATE TEMP TABLE pending (
        upload TEXT NOT NULL, slot INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(upload, slot)
      );
    `);
    return db;
  }

  function transaction(operation) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function abort(upload) {
    if (!uploads.has(upload)) return;
    clearTimeout(uploads.get(upload).timer);
    db.prepare('DELETE FROM pending WHERE upload=?').run(upload);
    uploads.delete(upload);
  }

  function touch(upload) {
    const state = uploads.get(upload);
    if (!state) throw storeError(410, 'reference_upload_expired', 'The reference save expired. Save again.');
    clearTimeout(state.timer);
    state.timer = setTimeout(() => abort(upload), 10 * 60 * 1000);
    state.timer.unref();
    return state;
  }

  function begin() {
    if (uploads.size >= 4) throw storeError(409, 'reference_library_busy', 'Another reference save is in progress.');
    database(true);
    const upload = randomUUID();
    uploads.set(upload, { bytes: 0 });
    touch(upload);
    return upload;
  }

  function addPart(upload, slot, bytes) {
    const state = touch(upload);
    if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PARTS || !bytes.length || bytes.length > MAX_LIBRARY_PART_BYTES) {
      throw bad('Invalid reference asset size or index.');
    }
    if (state.bytes + bytes.length > MAX_UPLOAD_BYTES) throw bad('Reference composition exceeds the library size limit.');
    if (db.prepare('SELECT 1 FROM pending WHERE upload=? AND slot=?').get(upload, slot)) throw bad('Duplicate reference asset.');
    db.prepare('INSERT INTO pending VALUES (?, ?, ?)').run(upload, slot, bytes);
    state.bytes += bytes.length;
  }

  function snapshotFor(input, scope, upload) {
    if (!['single', 'set'].includes(scope) || !Array.isArray(input?.cards) || !input.cards.length ||
        input.cards.length > 64 || (scope === 'single' && input.cards.length !== 1)) throw bad('Invalid reference selection.');
    const parts = new Map(db.prepare('SELECT slot, substr(bytes, 1, 16) AS header FROM pending WHERE upload=?').all(upload)
      .map(row => [row.slot, row.header]));
    function part(value) {
      if (!Number.isInteger(value) || !parts.has(value)) throw bad('Missing reference asset.');
      const header = parts.get(value);
      parts.delete(value);
      return header;
    }
    function image(source) {
      if (source == null) return null;
      const mimeType = detectImageMimeFromBytes(part(source.slot));
      if (!mimeType || mimeType !== source.mimeType) throw bad('Reference image must be a PNG, JPEG or WebP.');
      return { slot: source.slot, mimeType, name: fileName(source.name) };
    }
    const cards = input.cards.map(card => {
      if (!card || !['precise', 'vibe'].includes(card.kind)) throw bad('Unknown reference kind.');
      const original = image(card.original);
      const thumbnail = image(card.thumbnail);
      const result = {
        kind: card.kind, enabled: boolean(card.enabled), strength: bounded(card.strength, -Infinity, Infinity, 'strength'),
        fileName: fileName(card.fileName || original?.name || thumbnail?.name || 'reference'),
        type: card.type, original, thumbnail,
      };
      if (card.kind === 'precise') {
        if (!original || !preciseTypes.includes(card.type)) throw bad('Invalid Precise Reference.');
        if (card.fidelity !== undefined) result.fidelity = bounded(card.fidelity, -Infinity, Infinity, 'fidelity');
        if (card.preferSameOutfit !== undefined) result.preferSameOutfit = boolean(card.preferSameOutfit);
      } else {
        if (card.type !== 'vibe' || !Array.isArray(card.encodings ?? [])) throw bad('Invalid Vibe reference.');
        result.informationExtracted = bounded(card.informationExtracted, 0, 1, 'Information Extracted');
        const keys = new Set();
        result.encodings = (card.encodings || []).map(item => {
          if (!item || typeof item.model !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(item.model)) throw bad('Invalid Vibe model.');
          const info = bounded(item.informationExtracted, 0, 1, 'encoding Information Extracted');
          const key = JSON.stringify([item.model, info]);
          if (keys.has(key)) throw bad('Duplicate Vibe encoding.');
          keys.add(key);
          part(item.slot);
          return { model: item.model, informationExtracted: info, slot: item.slot };
        });
        if (!original && !result.encodings.length) throw bad('An original image or reusable Vibe encoding is required.');
      }
      return result;
    });
    if (parts.size) throw bad('Unclaimed reference asset.');
    const result = { cards };
    if (input.normalizeStrength !== undefined) result.normalizeStrength = boolean(input.normalizeStrength);
    return result;
  }

  const summaryFields = 'id, name, scope, version, updated, count';
  function list() {
    return database()?.prepare(`SELECT ${summaryFields} FROM entries ORDER BY updated DESC, id`).all() || [];
  }
  function entry(id) {
    if (!ID.test(id || '')) throw missing();
    const row = database()?.prepare(`SELECT ${summaryFields} FROM entries WHERE id=?`).get(id);
    if (!row) throw missing();
    return row;
  }
  function requireVersion(id, version) {
    const current = entry(id);
    if (current.version !== version) throw stale();
    return current;
  }
  function save({ id, version, name, scope, snapshot, upload }) {
    touch(upload);
    const title = validName(name);
    const config = snapshotFor(snapshot, scope, upload);
    assertNoSecretMaterial({ name: title, config }, 'saved reference settings');
    const result = transaction(() => {
      if (id) {
        const current = requireVersion(id, version);
        if (current.scope !== scope) throw bad('Cannot replace a single reference with a composition or vice versa.');
        db.prepare('DELETE FROM assets WHERE entry=?').run(id);
      } else if (version !== undefined) throw bad('Unexpected version for a new reference.');
      const key = id || randomUUID();
      db.prepare(`INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, version=excluded.version,
        updated=excluded.updated, count=excluded.count, snapshot=excluded.snapshot`)
        .run(key, title, scope, id ? version + 1 : 1, new Date().toISOString(), config.cards.length, JSON.stringify(config));
      db.prepare('INSERT INTO assets SELECT ?, slot, bytes FROM pending WHERE upload=?').run(key, upload);
      return entry(key);
    });
    abort(upload);
    return result;
  }
  function get(id) {
    if (!ID.test(id || '')) throw missing();
    const row = database()?.prepare(`SELECT ${summaryFields}, snapshot FROM entries WHERE id=?`).get(id);
    if (!row) throw missing();
    return { ...row, snapshot: JSON.parse(row.snapshot) };
  }
  function asset(id, version, slot) {
    const row = database()?.prepare('SELECT e.version, a.bytes FROM entries e LEFT JOIN assets a ON a.entry=e.id AND a.slot=? WHERE e.id=?').get(slot, id);
    if (!row) throw missing();
    if (row.version !== version) throw stale();
    if (!row.bytes) throw missing();
    return row.bytes;
  }
  function rename(id, version, name) {
    const title = validName(name);
    assertNoSecretMaterial(title, 'reference name');
    if (!database()) throw missing();
    return transaction(() => {
      requireVersion(id, version);
      db.prepare('UPDATE entries SET name=?, updated=?, version=version+1 WHERE id=?').run(title, new Date().toISOString(), id);
      return entry(id);
    });
  }
  function remove(items) {
    if (!Array.isArray(items) || !items.length || items.length > 1000) throw bad('Select references to delete.');
    if (!database()) throw missing();
    return transaction(() => {
      for (const item of items) {
        requireVersion(item?.id, item?.version);
        db.prepare('DELETE FROM entries WHERE id=?').run(item.id);
      }
      return items.length;
    });
  }
  function close() {
    for (const { timer } of uploads.values()) clearTimeout(timer);
    uploads.clear();
    db?.close();
    db = undefined;
  }
  return { list, begin, addPart, abort, save, get, asset, rename, remove, close };
}
