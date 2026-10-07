import path from "node:path";
import { rename, unlink } from "node:fs/promises";
import { createId, listDirectories, readJsonFile, removePath, sanitizeStoreId, storeError, writeJsonFile } from "./file-store-utils.js";

export function normalizeWildcard(input) {
  const key = String(input?.key || "").trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(key) || key.includes("__")) {
    throw storeError(400, "invalid_wildcard_key", "Use 1-64 lowercase letters, numbers, single underscores or hyphens for the key.");
  }
  const raw = Array.isArray(input.entries) ? input.entries : String(input.text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
  if (raw.some(value => typeof value !== "string" || /[\r\n\u0000]/.test(value))) {
    throw storeError(400, "invalid_wildcard_entries", "Each candidate must be one line of text.");
  }
  const entries = [...new Set(raw.map(value => value.trim()).filter(Boolean))];
  if (!entries.length) throw storeError(400, "empty_wildcard", "Add at least one candidate.");
  if (entries.length > 100_000 || entries.join("\n").length > 5_000_000) throw storeError(400, "wildcard_too_large", "Wildcard exceeds 100,000 candidates or 5 MB of text.");
  if (entries.some(value => /__[^\s]+?__/.test(value))) throw storeError(400, "nested_wildcard", "Candidates cannot contain another Wildcard reference.");
  return { key, name: String(input.name || key).trim().slice(0, 120) || key, entries };
}

export function createWildcardStore({ rootDir }) {
  const folder = path.join(rootDir, "data", "wildcards");
  let queue = Promise.resolve();
  const mutate = fn => { const result = queue.then(fn, fn); queue = result.catch(() => {}); return result; };
  async function get(id) {
    const safeId = sanitizeStoreId(id);
    try { return await readJsonFile(path.join(folder, safeId, "wildcard.json")); }
    catch (error) { if (error.code === "ENOENT") throw storeError(404, "wildcard_not_found", "Wildcard not found."); throw error; }
  }
  async function all() {
    const result = [];
    for (const id of await listDirectories(folder)) result.push(await get(id));
    return result.sort((a, b) => a.key.localeCompare(b.key));
  }
  return {
    get, all,
    async list() { return (await all()).map(({ entries, ...item }) => ({ ...item, count: entries.length })); },
    save(input) { return mutate(async () => {
      const normalized = normalizeWildcard(input);
      const existing = input.id ? await get(input.id) : null;
      if (existing && existing.key !== normalized.key) throw storeError(409, "wildcard_key_immutable", "The reference key cannot change. Create a new Wildcard instead.");
      const items = await all();
      if (items.some(item => item.key === normalized.key && item.id !== existing?.id)) throw storeError(409, "wildcard_key_exists", "This reference key already exists.");
      const now = new Date().toISOString();
      const item = { schema: "chaessi-wildcard/v1", id: existing?.id || createId("wildcard"), ...normalized, created_at: existing?.created_at || now, updated_at: now };
      const target = path.join(folder, item.id, "wildcard.json");
      const temporary = `${target}.${createId("write")}.tmp`;
      try { await writeJsonFile(temporary, item); await rename(temporary, target); }
      finally { await unlink(temporary).catch(() => {}); }
      return item;
    }); },
    delete(id) { return mutate(async () => { const item = await get(id); await removePath(path.join(folder, item.id)); return { id: item.id, deleted: true }; }); },
  };
}
