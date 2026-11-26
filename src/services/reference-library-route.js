import { MAX_LIBRARY_PART_BYTES } from './reference-library.js';
import { storeError } from './file-store-utils.js';

const base = '/api/reference-library';
const invalid = message => storeError(400, 'invalid_reference_library_request', message);

async function readPart(req) {
  if (req.headers['content-type'] !== 'application/octet-stream') throw invalid('Expected a reference asset.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_LIBRARY_PART_BYTES) throw storeError(413, 'reference_asset_too_large', 'Reference assets can be up to 30 MiB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

export async function handleReferenceLibraryRoute({ req, res, url, library, readJsonBody, sendJson }) {
  const host = req.headers.host;
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host || '') ||
      (req.headers.origin && req.headers.origin !== `http://${host}`) ||
      req.headers['x-chaessi-reference-library'] !== '1') {
    throw storeError(403, 'invalid_origin', 'Open the reference library in this app.');
  }
  res.setHeader('Cache-Control', 'no-store');
  const parts = url.pathname.slice(base.length).split('/').filter(Boolean);
  const [route, id, sub, index] = parts;
  let result;
  if (req.method === 'GET' && !parts.length) {
    result = { items: library.list() };
  } else if (req.method === 'POST' && route === 'uploads' && parts.length === 1) {
    result = { upload: library.begin() };
  } else if (route === 'uploads' && parts.length === 3 && /^\d+$/.test(sub) && req.method === 'POST') {
    library.addPart(id, Number(sub), await readPart(req));
    result = {};
  } else if (route === 'uploads' && parts.length === 2 && req.method === 'DELETE') {
    library.abort(id);
    result = {};
  } else if (route === 'entries' && parts.length === 1 && req.method === 'POST') {
    result = { item: library.save(await readJsonBody(req)) };
  } else if (route === 'entries' && parts.length === 2 && req.method === 'GET') {
    result = { item: library.get(id) };
  } else if (route === 'entries' && sub === 'assets' && parts.length === 4 && /^\d+$/.test(index) && req.method === 'GET') {
    const bytes = library.asset(id, Number(url.searchParams.get('version')), Number(index));
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff' });
    res.end(bytes);
    return;
  } else if (route === 'entries' && sub === 'rename' && parts.length === 3 && req.method === 'POST') {
    const body = await readJsonBody(req);
    result = { item: library.rename(id, body.version, body.name) };
  } else if (route === 'delete' && parts.length === 1 && req.method === 'POST') {
    const body = await readJsonBody(req);
    result = { removed: library.remove(body.items) };
  } else {
    throw storeError(404, 'not_found', 'Not found.');
  }
  sendJson(res, 200, { ok: true, ...result });
}
