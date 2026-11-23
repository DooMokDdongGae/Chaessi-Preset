import http from "node:http";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const protocol = "chaessi.prompt-transfer/1";
const maxBytes = 1024 * 1024;
const nonceLimit = 262144;
const receiptReserve = 4096;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const routes = new Set(["/v1/probe", "/v1/targets", "/v1/preview", "/v1/status"]);
const terminals = new Set(["applied", "cancelled", "stale", "expired", "failed"]);
const codes = { INVALID: 400, UNAUTHORIZED: 403, NOT_FOUND: 404, BUSY: 409, STALE: 409,
  ID_CONFLICT: 409, NOT_READY: 409, TOO_LARGE: 413, TIMEOUT: 408 };

function reject(code) { throw new Error(code); }
function keys(value, names) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key));
}
const field = value => value === "positive" || value === "undesired";
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const literal = value => typeof value === "string" && value.length > 0;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export function validatePreview(body) {
  if (!keys(body, ["requestId", "revision", "items"]) || typeof body.requestId !== "string" || !uuid.test(body.requestId) ||
      !literal(body.revision) || !Array.isArray(body.items) || !body.items.length || body.items.length > 128) reject("INVALID");
  for (const item of body.items) {
    if (!keys(item, ["source", "slot", "field", "mode", "text"]) || !literal(item.slot) ||
        !field(item.field) || !["append", "replace"].includes(item.mode) || typeof item.text !== "string" ||
        !item.text.isWellFormed() || /[\u0000-\u0008\u000b-\u001f]/u.test(item.text) ||
        !keys(item.source, ["image", "number", "field"]) || !integer(item.source.image, 1) ||
        !integer(item.source.number) || !field(item.source.field)) reject("INVALID");
    if (Buffer.byteLength(item.text) > 256 * 1024) reject("TOO_LARGE");
    // The live renderer checks each requested offset against the current model's remaining slots.
    if (item.slot.startsWith("new:") && !/^new:[1-9]\d{0,2}$/.test(item.slot)) reject("INVALID");
  }
}

function validateTargets(value) {
  if (!keys(value, ["revision", "limit", "canCreate", "targets"]) || !literal(value.revision) ||
      !integer(value.limit) || !integer(value.canCreate) || value.canCreate > value.limit ||
      !Array.isArray(value.targets) || value.targets.length > value.limit + 1) reject("NOT_READY");
  for (const row of value.targets) {
    if (!keys(row, ["slot", "number", "fields"]) || !literal(row.slot) || !integer(row.number) ||
        !Array.isArray(row.fields) || !row.fields.length || !row.fields.every(field)) reject("NOT_READY");
  }
  return value;
}

export function createReceiver({ instanceId, secret, ask, onUnavailable, now = Date.now, lifetime = 120000 }) {
  const records = new Map();
  const nonces = new Set();
  const proven = new WeakSet();
  const key = Buffer.from(secret, "hex");
  let active;
  let port;
  let closed = false;
  const sign = parts => createHmac("sha256", key).update(parts.join("\n")).digest("hex");

  function finish(id, state) {
    const record = records.get(id);
    if (!record || !terminals.has(state)) return false;
    if (terminals.has(record.state)) return record.state === state;
    clearTimeout(record.timer);
    record.timer = undefined;
    record.state = state;
    if (active === id) active = undefined;
    return true;
  }

  async function expire(id) {
    if (active !== id) return;
    // The renderer serializes its own clock check and commit. A lost IPC reply
    // cannot turn an already approved draft into a reported cancellation.
    try {
      const result = await ask("expire", { requestId: id });
      if (!finish(id, result.state)) onUnavailable?.();
    } catch { onUnavailable?.(); }
  }

  async function route(req, body, bytes) {
    if (req.url === "/v1/probe") {
      if (!keys(body, [])) reject("INVALID");
      proven.add(req.socket);
      return { protocol, instanceId, pid: process.pid };
    }
    if (req.url === "/v1/targets") {
      if (!keys(body, [])) reject("INVALID");
      return { instanceId, ...validateTargets(await ask("targets", {})) };
    }
    if (req.url === "/v1/status") {
      if (!keys(body, ["requestId"]) || typeof body.requestId !== "string" || !uuid.test(body.requestId)) reject("INVALID");
      const record = records.get(body.requestId);
      if (!record) reject("NOT_FOUND");
      if (record.state === "opening") reject("NOT_READY");
      return { requestId: body.requestId, state: record.state };
    }
    if (!proven.has(req.socket)) reject("UNAUTHORIZED");
    validatePreview(body);
    const id = body.requestId;
    const fingerprint = digest(bytes);
    const prior = records.get(id);
    if (prior) {
      if (prior.fingerprint !== fingerprint) reject("ID_CONFLICT");
      if (prior.state === "opening") reject("BUSY");
      return { requestId: id, state: prior.state };
    }
    if (active || records.size >= 4096) reject("BUSY");
    active = id;
    const expiresAt = now() + lifetime;
    const record = { fingerprint, state: "opening", timer: setTimeout(() => expire(id), lifetime) };
    record.timer.unref();
    records.set(id, record);
    try {
      const response = await ask("preview", body, expiresAt);
      if (response?.state !== "pending") reject("NOT_READY");
      if (record.state === "opening") record.state = "pending";
      return { requestId: id, state: record.state };
    } catch (error) {
      // The bridge rejects preview only on a definite renderer rejection or
      // loss of the draft. A transport timeout never decides this transition.
      finish(id, error.message === "STALE" ? "stale" : "failed");
      if (error.message === "BUSY") records.delete(id);
      throw error;
    }
  }

  const server = http.createServer({ maxHeaderSize: 8192, requestTimeout: 5000, headersTimeout: 5000 }, async (req, res) => {
    let signed = false;
    const nonce = req.headers["x-chaessi-nonce"];
    function reply(status, value) {
      const bytes = Buffer.from(JSON.stringify(value));
      const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Content-Length": bytes.length };
      if (signed) headers["X-Chaessi-Mac"] = sign(["RES", status, instanceId, nonce, digest(bytes)]);
      if (!res.destroyed) { res.writeHead(status, headers); res.end(bytes); }
    }
    try {
      if (closed || req.socket.remoteAddress !== "127.0.0.1") reject("UNAUTHORIZED");
      if (req.method !== "POST" || !routes.has(req.url)) reject("NOT_FOUND");
      const h = req.headers;
      const names = req.rawHeaders.filter((_, i) => i % 2 === 0).map(name => name.toLowerCase());
      if (new Set(names).size !== names.length || h.host !== "127.0.0.1:" + port ||
          h["x-chaessi-instance"] !== instanceId || h["content-type"] !== "application/json" ||
          names.some(name => /^(?:origin$|referer$|sec-fetch-|proxy-|forwarded$|x-forwarded-|transfer-encoding$|content-encoding$|expect$)/.test(name)) ||
          !/^[0-9a-f]{32}$/.test(nonce || "") || !/^[0-9a-f]{64}$/.test(h["x-chaessi-mac"] || "")) reject("UNAUTHORIZED");
      if (!/^\d+$/.test(h["content-length"] || "")) reject("INVALID");
      const length = Number(h["content-length"]);
      if (length > maxBytes) reject("TOO_LARGE");
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes) reject("TOO_LARGE");
        chunks.push(chunk);
      }
      if (size !== length) reject("INVALID");
      const bytes = Buffer.concat(chunks, size);
      const mac = sign(["POST", req.url, instanceId, nonce, digest(bytes)]);
      if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(h["x-chaessi-mac"], "hex")) || nonces.has(nonce)) reject("UNAUTHORIZED");
      signed = true;
      // Keep room for receipt polling after new transfer admission stops.
      // Refused requests never reach the renderer. A new process gets a fresh key.
      if (nonces.size >= nonceLimit ||
          (nonces.size >= nonceLimit - receiptReserve && req.url !== "/v1/status" && req.url !== "/v1/probe")) reject("BUSY");
      nonces.add(nonce);
      let body;
      try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
      catch { reject("INVALID"); }
      const result = await route(req, body, bytes);
      reply(200, { ok: true, ...result });
    } catch (error) {
      const code = Object.hasOwn(codes, error.message) ? error.message : "NOT_READY";
      reply(codes[code], { ok: false, error: code });
    }
  });
  server.keepAliveTimeout = 5000;
  server.setTimeout(130000, socket => socket.destroy());
  server.on("clientError", (_error, socket) => socket.destroy());
  server.on("checkContinue", (_req, res) => { res.writeHead(403); res.end(); });
  return {
    finish,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      port = server.address().port;
      return port;
    },
    close() {
      closed = true;
      for (const record of records.values()) clearTimeout(record.timer);
      records.clear();
      nonces.clear();
      key.fill(0);
      server.close();
      server.closeAllConnections();
    },
  };
}
