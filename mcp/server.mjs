import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLibrary } from './library.mjs';
import { SORT_MODES } from '../src/state/preset-sorting.js';

const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const locale = z.enum(['ko', 'en', 'ja']).default('ko');
const kind = z.enum(['character', 'full', 'base', 'negative', 'settings']).default('character');
const id = z.string().regex(/^[A-Za-z0-9_-]+$/).max(180);
const paging = {
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
  expected_snapshot: z.string().regex(/^[a-f0-9]{64}$/).optional(),
};

export function createChaessiMcpServer({ rootDir }) {
  const library = createLibrary({ rootDir });
  const server = new McpServer({ name: 'chaessi-preset-library', version: '1.0.0' }, {
    instructions: 'Read saved Chaessi Preset categories, presets and History images. Category filters use exact names returned by list_categories. Multiple filters are a union; no category is hard-coded. History defaults to oldest-first, while the app gallery is newest-first. Page using next_offset and expected_snapshot. Never present an ordinal preset/image pairing as verified provenance. Original PNG files still have metadata. Image conversion, HTML and publishing belong to the separate caller workflow. No generation or deletion tools exist.',
  });
  function tool(name, description, inputSchema, call) {
    server.registerTool(name, { description, inputSchema, annotations }, async args => {
      try {
        const value = await call(args);
        const text = JSON.stringify(value);
        if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw Object.assign(new Error('Response exceeds 2 MiB. Request a smaller page or a narrower filter.'), { code: 'response_too_large' });
        return { content: [{ type: 'text', text }], structuredContent: value };
      } catch (e) { return failure(e); }
    });
  }
  tool('get_status', 'Check the selected local app data root and read-only connection. Does not read credentials or generation APIs.', {}, () => library.status());
  tool('list_categories', 'List Character Preset categories and subcategories, including custom and orphan categories, with preset counts. Use the returned exact names as filters.', { locale }, args => library.listCategories(args));
  tool('list_presets', 'Read saved preset names and prompts. Supports any category or multiple category/subcategory filters, name search and the same locale/name/date sorting as the app. Default: Character Presets, Korean name ascending. filters are OR; each filter matches category AND subcategory. Only character presets have category fields.', {
    kind, locale, sort: z.enum(SORT_MODES).default('name-asc'), query: z.string().max(300).default(''),
    filters: z.array(z.object({ category: z.string().max(120).optional(), subcategory: z.string().max(120).optional() })).max(30).default([]),
    ...paging,
  }, args => library.listPresets(args));
  tool('get_preset', 'Read one saved preset by kind and id. Returns prompt data; excludes imported raw metadata and credentials.', { kind, id }, args => library.getPreset(args));
  tool('list_history', 'List the images currently saved in History with ids, creation times, local image paths and overall preset labels. oldest-first means generation order; newest-first matches the app gallery. Results are not automatically paired with category presets. Use pagination and snapshot to detect changes.', {
    order: z.enum(['oldest-first', 'newest-first']).default('oldest-first'), ...paging,
  }, args => library.listHistory(args));
  tool('get_history', 'Read a saved History entry: final transmitted prompts, Character prompts, saved prompt parts and local image path. Final prompts reflect resolved random/Wildcard choices. No entire raw payload, credentials, source or mask assets are returned.', { id }, args => library.getHistory(args));
  server.registerTool('get_history_image', {
    description: 'Read a History PNG by id as an MCP image. Returns the unchanged original bytes (metadata is still present), plus the local image path. No JPG conversion or metadata removal occurs. For images above 6 MiB use get_history.image_path with local file tools.',
    inputSchema: { id }, annotations,
  }, async args => {
    try {
      const { item, bytes, mimeType } = await library.getHistoryImage(args);
      return { content: [{ type: 'text', text: JSON.stringify({ ...item, original_metadata_preserved: true }) },
        { type: 'image', data: bytes.toString('base64'), mimeType }] };
    } catch (e) { return failure(e); }
  });
  return server;
}

function failure(e) {
  const codes = ['data_unavailable', 'invalid_path', 'not_found', 'invalid_record', 'invalid_kind', 'record_too_large', 'response_too_large', 'image_too_large', 'invalid_image', 'ambiguous_id', 'snapshot_changed', 'invalid_id', 'secret_leak_prevented'];
  const code = codes.includes(e?.code) ? e.code : codes.includes(e?.type) ? e.type : 'read_failed';
  const message = code === 'read_failed' ? 'Saved data could not be read. Retry after saving finishes and check the selected data root.' : e.publicMessage || e.message;
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: code, message }) }] };
}

export function resolveDataRoot(args = process.argv.slice(2), env = process.env) {
  if (args.length && (args.length !== 2 || args[0] !== '--data-root' || !path.isAbsolute(args[1]))) {
    throw new Error('Usage: node mcp/server.mjs [--data-root <absolute app user-data directory>]. The directory contains data/, not data/ itself.');
  }
  if (args.length) return args[1];
  if (env.CHAESSI_USER_DATA_DIR) {
    if (!path.isAbsolute(env.CHAESSI_USER_DATA_DIR)) throw new Error('CHAESSI_USER_DATA_DIR must be absolute.');
    return env.CHAESSI_USER_DATA_DIR;
  }
  if (env.APPDATA) return path.join(env.APPDATA, 'Chaessi Preset');
  throw new Error('Specify --data-root or CHAESSI_USER_DATA_DIR for this platform.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(pathToFileURL(path.resolve(process.argv[1])))) {
  try {
    const server = createChaessiMcpServer({ rootDir: resolveDataRoot() });
    await server.connect(new StdioServerTransport());
  } catch (e) {
    console.error(`[Chaessi MCP] ${e.message}`);
    process.exitCode = 1;
  }
}
