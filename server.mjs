import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  buildGeneratePayload,
  createDefaultPreset,
  validatePayloadSafety,
  validatePreset,
} from "./src/adapters/novelai-v45-full.js";
import {
  APP_NAME,
  NOVELAI_GENERATE_ENDPOINT,
} from "./src/state/defaults.js";
import { createTokenProvider } from "./src/security/token-provider.js";
import {
  EnvSecretStore,
  PROVIDER_ENV_KEYS,
} from "./src/security/secret-store.js";
import { createPresetStore } from "./src/services/preset-store.js";
import { createCharacterPresetStore } from "./src/services/character-preset-store.js";
import { createGenerationStore } from "./src/services/generation-store.js";
import { createSectionPresetStore } from "./src/services/section-preset-store.js";
import {
  assertNoSecretMaterial,
  storeError,
} from "./src/services/file-store-utils.js";
import { parseRawJsonImport } from "./src/importers/raw-json-import.js";
import { applyImportToPreset } from "./src/importers/import-to-preset.js";
import { parseNovelAiPngMetadata } from "./src/importers/nai-metadata.js";
import { parseImageMetadata } from "./src/importers/image-metadata.js";

const HEALTH_APP_NAME = "Chaessi Preset";
const APP_VERSION = "1.2.0";
const PORT = Number(process.env.PORT || 4174);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(process.env.CHAESSI_USER_DATA_DIR || ROOT);
const REQUEST_LIMIT_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 180_000;
const MIGRATABLE_DATA_DIRS = [
  "presets",
  "character-presets",
  "generations",
  "base-prompts",
  "undesired-prompts",
  "params-presets",
];

loadLocalEnvFallback();
await migrateProjectDataToUserData();
const tokenProvider = createTokenProvider({
  secretStore: new EnvSecretStore(),
});
const presetStore = createPresetStore({ rootDir: DATA_ROOT });
const characterPresetStore = createCharacterPresetStore({ rootDir: DATA_ROOT });
const generationStore = createGenerationStore({ rootDir: DATA_ROOT });
const basePromptStore = createSectionPresetStore({ rootDir: DATA_ROOT, section: "base-prompts" });
const undesiredPromptStore = createSectionPresetStore({ rootDir: DATA_ROOT, section: "undesired-prompts" });
const paramsPresetStore = createSectionPresetStore({ rootDir: DATA_ROOT, section: "params-presets" });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        app: HEALTH_APP_NAME,
        version: APP_VERSION,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/preset/default") {
      sendJson(res, 200, { ok: true, preset: createDefaultPreset() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/settings/token-status") {
      sendJson(res, 200, await handleTokenStatus());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/settings/token") {
      const body = await readJsonBody(req);
      await handleSaveToken(body);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/settings/token/")) {
      const provider = decodeURIComponent(url.pathname.slice("/api/settings/token/".length));
      await handleDeleteToken({ provider });
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/payload/preview") {
      const body = await readJsonBody(req);
      const preset = stripPresetUiState(body?.preset);
      const presetValidation = validatePreset(preset);
      if (!presetValidation.ok) {
        throw httpError(400, "invalid_preset", "Invalid internal preset schema.", presetValidation.errors.join("; "));
      }
      const payload = buildGeneratePayload(preset);
      const payloadSafety = validatePayloadSafety(payload);
      if (!payloadSafety.ok) {
        throw httpError(400, "unsafe_payload", "Payload safety validation failed.", payloadSafety.errors.join("; "));
      }
      sendJson(res, 200, {
        ok: true,
        payload,
        warnings: [...presetValidation.warnings, ...payloadSafety.warnings],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/novelai/generate") {
      const body = await readJsonBody(req);
      const result = await handleGenerate(body);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/import/raw-json") {
      const body = await readJsonBody(req);
      const source = body?.json !== undefined ? body.json : body?.text;
      sendJson(res, 200, {
        ok: true,
        import_result: parseRawJsonImport(source),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/import/png") {
      const fileBuffer = await readMultipartPng(req);
      sendJson(res, 200, {
        ok: true,
        import_result: parseNovelAiPngMetadata(fileBuffer),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/import/image") {
      const fileBuffer = await readMultipartImage(req);
      sendJson(res, 200, {
        ok: true,
        import_result: await parseImageMetadata(fileBuffer),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/import/apply") {
      const body = await readJsonBody(req);
      const result = applyImportToPreset(body?.current_preset, body?.import_result, body?.options);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/presets") {
      sendJson(res, 200, { ok: true, items: await presetStore.listPresets() });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/presets/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/presets/".length));
      sendJson(res, 200, { ok: true, preset: await presetStore.getPreset(id) });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/presets/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/presets/".length));
      sendJson(res, 200, { ok: true, result: await presetStore.deletePreset(id) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/presets") {
      const { preset: inputPreset, thumbnail } = await readPresetSaveRequest(req);
      const preset = await presetStore.savePreset(inputPreset, { thumbnail });
      sendJson(res, 200, { ok: true, preset });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/character-presets") {
      sendJson(res, 200, { ok: true, items: await characterPresetStore.listCharacterPresets() });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/character-presets/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/character-presets/".length));
      sendJson(res, 200, { ok: true, result: await characterPresetStore.deleteCharacterPreset(id) });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/character-presets/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/character-presets/".length));
      sendJson(res, 200, { ok: true, preset: await characterPresetStore.getCharacterPreset(id) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/character-presets") {
      const { preset: inputPreset, thumbnail } = await readCharacterPresetSaveRequest(req);
      const preset = await characterPresetStore.saveCharacterPreset(inputPreset, { thumbnail });
      sendJson(res, 200, { ok: true, preset });
      return;
    }

    const sectionRoute = matchSectionPresetRoute(req.method, url.pathname);
    if (sectionRoute) {
      const result = await handleSectionPresetRoute(sectionRoute, req);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/generations") {
      sendJson(res, 200, { ok: true, items: await generationStore.listGenerations() });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/generations/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/generations/".length));
      sendJson(res, 200, { ok: true, generation: await generationStore.getGeneration(id) });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/generations/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/generations/".length));
      sendJson(res, 200, { ok: true, result: await generationStore.deleteGeneration(id) });
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      if (await serveStaticFile(req, res, url.pathname)) return;
    }

    sendJson(res, 404, {
      ok: false,
      error: {
        type: "not_found",
        message: "Not found",
      },
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    sendJson(res, status, {
      ok: false,
      error: sanitizeError(error),
    });
  }
});

const SECTION_ROUTE_STORES = {
  "/api/base-prompts": basePromptStore,
  "/api/undesired-prompts": undesiredPromptStore,
  "/api/params-presets": paramsPresetStore,
};

const tokenStorageRequests = new Map();
const runtimeSafeStorageTokenEnv = new Map();

process.on?.("message", (message) => {
  if (!message || message.channel !== "token-storage" || !message.requestId) return;
  const pending = tokenStorageRequests.get(message.requestId);
  if (!pending) return;
  tokenStorageRequests.delete(message.requestId);
  clearTimeout(pending.timeout);
  if (message.ok) {
    pending.resolve(message);
    return;
  }
  const error = httpError(500, message.error?.type || "token_storage_failed", message.error?.message || "Token storage request failed.");
  pending.reject(error);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[${APP_NAME}] API server listening on http://127.0.0.1:${PORT}`);
});

async function handleTokenStatus() {
  const provider = "novelai";
  const envStatus = tokenProvider.getTokenStatus(provider);
  const safeStatus = await getSafeTokenStatus(provider);
  const status = buildPublicTokenStatus({ provider, safeStatus, envStatus });
  const providers = tokenProvider.listProviderStatuses().map((item) => (
    item.provider === provider ? status : buildPublicTokenStatus({ provider: item.provider, envStatus: item })
  ));
  return {
    ok: true,
    provider: status.provider,
    configured: status.configured,
    source: status.source,
    token: status,
    providers,
    storage: {
      current: status.source,
      accepts_ui_token: Boolean(safeStatus.available),
    },
  };
}

async function handleSaveToken(body) {
  const provider = validateTokenProvider(body?.provider);
  const token = String(body?.token || "").trim();
  if (!token) throw httpError(400, "missing_token", "Token is required.");
  await requestElectronTokenStorage({ action: "save", provider, token });
  setRuntimeSafeStorageToken(provider, token);
}

async function handleDeleteToken({ provider }) {
  const safeProvider = validateTokenProvider(provider);
  await requestElectronTokenStorage({ action: "delete", provider: safeProvider });
  clearRuntimeSafeStorageToken(safeProvider);
}

async function getSafeTokenStatus(provider) {
  try {
    const response = await requestElectronTokenStorage({ action: "status", provider });
    return {
      available: true,
      configured: Boolean(response.status?.configured),
      storage: "electron_safe_storage",
    };
  } catch {
    return {
      available: false,
      configured: false,
      storage: "electron_safe_storage",
    };
  }
}

function buildPublicTokenStatus({ provider, safeStatus = {}, envStatus = {} }) {
  if (safeStatus.configured) {
    return {
      provider,
      configured: true,
      source: "safe_storage",
      storage: "electron_safe_storage",
    };
  }
  if (envStatus.configured) {
    return {
      provider,
      configured: true,
      source: "env",
      storage: "env",
    };
  }
  return {
    provider,
    configured: false,
    source: "none",
    storage: safeStatus.available ? "electron_safe_storage" : "none",
  };
}

function validateTokenProvider(provider) {
  if (provider !== "novelai") {
    throw httpError(400, "unsupported_provider", "Unsupported token provider.");
  }
  return provider;
}

function setRuntimeSafeStorageToken(provider, token) {
  const envKey = PROVIDER_ENV_KEYS[provider];
  if (!runtimeSafeStorageTokenEnv.has(provider)) {
    runtimeSafeStorageTokenEnv.set(provider, {
      hadValue: Object.prototype.hasOwnProperty.call(process.env, envKey),
      value: process.env[envKey],
    });
  }
  process.env[envKey] = token;
}

function clearRuntimeSafeStorageToken(provider) {
  const envKey = PROVIDER_ENV_KEYS[provider];
  const previous = runtimeSafeStorageTokenEnv.get(provider);
  if (!previous) return;
  if (previous.hadValue) {
    process.env[envKey] = previous.value;
  } else {
    delete process.env[envKey];
  }
  runtimeSafeStorageTokenEnv.delete(provider);
}

function requestElectronTokenStorage(payload) {
  if (typeof process.send !== "function") {
    throw httpError(501, "token_storage_unavailable", "Secure token storage is only available in the Electron app.");
  }
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      tokenStorageRequests.delete(requestId);
      reject(httpError(504, "token_storage_timeout", "Token storage request timed out."));
    }, 5000);
    tokenStorageRequests.set(requestId, { resolve, reject, timeout });
    process.send({
      channel: "token-storage",
      requestId,
      ...payload,
    });
  });
}

async function handleGenerate(body) {
  const preset = stripPresetUiState(body?.preset);
  const presetValidation = validatePreset(preset);
  if (!presetValidation.ok) {
    throw httpError(400, "invalid_preset", "Invalid internal preset schema.", presetValidation.errors.join("; "));
  }
  if (presetValidation.warnings.length) {
    throw httpError(400, "unsupported_preset_fields", "Preset contains unsupported fields.", presetValidation.warnings.join("; "));
  }

  const payload = buildGeneratePayload(preset);
  const payloadSafety = validatePayloadSafety(payload);
  if (!payloadSafety.ok) {
    throw httpError(400, "unsafe_payload", "Payload safety validation failed.", payloadSafety.errors.join("; "));
  }

  const token = tokenProvider.getToken("novelai");
  const naiResponse = await postNovelAiPayload({ token, payload });
  if (naiResponse.status !== 200) {
    throw httpError(
      naiResponse.status,
      "novelai_request_failed",
      "Request failed",
      naiResponse.body.toString("utf8").slice(0, 2000),
    );
  }

  const extracted = extractFirstImageFromZip(naiResponse.body);
  const createdAt = new Date();
  const saved = await generationStore.saveGeneration({
    preset,
    payload,
    imageBytes: extracted.imageBytes,
    responseInfo: {
    created_at: createdAt.toISOString(),
    response_container: "zip",
    response_image_entry: extracted.entryName,
    response_content_type: naiResponse.headers.get("content-type") || "",
    content_disposition: naiResponse.headers.get("content-disposition") || "",
    },
  });

  return {
    ok: true,
    generation: {
      id: saved.id,
      image_path: saved.image_path,
      sidecar_path: saved.sidecar_path,
      payload_path: saved.payload_path,
    },
    summary: {
      model: payload.model,
      width: payload.parameters.width,
      height: payload.parameters.height,
      steps: payload.parameters.steps,
      scale: payload.parameters.scale,
      cfg_rescale: payload.parameters.cfg_rescale,
      sampler: payload.parameters.sampler,
      noise_schedule: payload.parameters.noise_schedule,
      qualityToggle: payload.parameters.qualityToggle,
      seed: payload.parameters.seed,
    },
  };
}

function stripPresetUiState(preset) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) return preset;
  const characters = Array.isArray(preset.prompt_parts?.characters)
    ? preset.prompt_parts.characters.map(({ activeTab, ...character }) => character)
    : preset.prompt_parts?.characters;
  return {
    ...preset,
    prompt_parts: {
      ...(preset.prompt_parts || {}),
      characters,
    },
  };
}

async function postNovelAiPayload({ token, payload }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(NOVELAI_GENERATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://novelai.net",
        "Referer": "https://novelai.net/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return {
      status: response.status,
      headers: response.headers,
      body: Buffer.from(await response.arrayBuffer()),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractFirstImageFromZip(responseBytes) {
  const entries = readZipCentralDirectory(responseBytes);
  const imageEntries = entries.filter((entry) => /\.(png|webp|jpe?g)$/i.test(entry.name) && !entry.isDirectory);
  if (!imageEntries.length) {
    throw httpError(502, "novelai_zip_extract_failed", "No image found in NovelAI ZIP response.", entries.map((entry) => entry.name).join(", ") || "(none)");
  }
  const entry = imageEntries[0];
  return {
    entryName: entry.name,
    imageBytes: readZipEntry(responseBytes, entry),
  };
}

function readZipCentralDirectory(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8");

    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      isDirectory: name.endsWith("/"),
    });

    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw httpError(502, "novelai_zip_extract_failed", "ZIP central directory not found in NovelAI response.");
}

function readZipEntry(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw httpError(502, "novelai_zip_extract_failed", `Invalid local header for ZIP entry: ${entry.name}`);
  }

  const filenameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + filenameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  const compressed = buffer.subarray(dataStart, dataEnd);

  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRawSync(compressed);
  throw httpError(502, "novelai_zip_extract_failed", `Unsupported ZIP compression method ${entry.method} for entry ${entry.name}`);
}

function matchSectionPresetRoute(method, pathname) {
  for (const [basePath, store] of Object.entries(SECTION_ROUTE_STORES)) {
    if (pathname === basePath && (method === "GET" || method === "POST")) {
      return { store, action: method === "GET" ? "list" : "save" };
    }
    if (pathname.startsWith(`${basePath}/`) && (method === "GET" || method === "DELETE")) {
      return {
        store,
        action: method === "GET" ? "get" : "delete",
        id: decodeURIComponent(pathname.slice(basePath.length + 1)),
      };
    }
  }
  return null;
}

async function handleSectionPresetRoute(route, req) {
  if (route.action === "list") return { ok: true, items: await route.store.list() };
  if (route.action === "get") return { ok: true, preset: await route.store.get(route.id) };
  if (route.action === "delete") return { ok: true, result: await route.store.delete(route.id) };
  const body = await readJsonBody(req);
  return { ok: true, preset: await route.store.save(body?.preset ?? body) };
}

function loadLocalEnvFallback() {
  if (!existsSync(path.join(ROOT, ".env"))) return;
  const content = readFileSync(path.join(ROOT, ".env"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#") || !stripped.includes("=")) continue;
    const [rawKey, ...rawValueParts] = stripped.split("=");
    const key = rawKey.trim();
    if (!Object.values(PROVIDER_ENV_KEYS).includes(key) || process.env[key]) continue;
    process.env[key] = rawValueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
}

async function migrateProjectDataToUserData() {
  if (path.resolve(DATA_ROOT) === path.resolve(ROOT)) return;
  const sourceDataDir = path.join(ROOT, "data");
  const targetDataDir = path.join(DATA_ROOT, "data");
  if (!existsSync(sourceDataDir)) return;
  await mkdir(targetDataDir, { recursive: true });
  for (const dirName of MIGRATABLE_DATA_DIRS) {
    const sourceDir = path.join(sourceDataDir, dirName);
    const targetDir = path.join(targetDataDir, dirName);
    if (!existsSync(sourceDir) || existsSync(targetDir)) continue;
    await cp(sourceDir, targetDir, { recursive: true });
  }
}

async function readJsonBody(req) {
  const bodyText = await readBody(req);
  try {
    return JSON.parse(bodyText || "{}");
  } catch {
    throw httpError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > REQUEST_LIMIT_BYTES) {
        reject(httpError(413, "request_too_large", "Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > REQUEST_LIMIT_BYTES) {
        reject(httpError(413, "request_too_large", "Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readMultipartPng(req) {
  const fileData = await readMultipartImage(req);
  if (fileData.length < 8 || fileData.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
    throw httpError(400, "invalid_png", "Uploaded file must be a PNG.");
  }
  return fileData;
}

async function readMultipartImage(req) {
  const form = await readMultipartForm(req);
  const file = form.files.find((item) => item.filename);
  if (file) return file.data;
  throw httpError(400, "missing_image_file", "Image file field is required.");
}

async function readPresetSaveRequest(req) {
  const contentType = req.headers["content-type"] || "";
  if (/multipart\/form-data/i.test(contentType)) {
    const form = await readMultipartForm(req);
    const presetText = form.fields.preset;
    if (!presetText) throw httpError(400, "missing_preset", "Preset field is required.");
    let preset;
    try {
      preset = JSON.parse(presetText);
    } catch {
      throw httpError(400, "invalid_preset_json", "Preset field must be valid JSON.");
    }
    const thumbnailFile = form.files.find((file) => file.name === "thumbnail");
    return {
      preset,
      thumbnail: thumbnailFile ? {
        bytes: thumbnailFile.data,
        contentType: thumbnailFile.contentType,
      } : null,
    };
  }
  const body = await readJsonBody(req);
  return { preset: body?.preset, thumbnail: null };
}

async function readCharacterPresetSaveRequest(req) {
  const contentType = req.headers["content-type"] || "";
  if (/multipart\/form-data/i.test(contentType)) {
    const form = await readMultipartForm(req);
    const presetText = form.fields.preset;
    if (!presetText) throw httpError(400, "missing_character_preset", "Character preset field is required.");
    let preset;
    try {
      preset = JSON.parse(presetText);
    } catch {
      throw httpError(400, "invalid_character_preset_json", "Character preset field must be valid JSON.");
    }
    const thumbnailFile = form.files.find((file) => file.name === "thumbnail");
    return {
      preset,
      thumbnail: thumbnailFile ? {
        bytes: thumbnailFile.data,
        contentType: thumbnailFile.contentType,
      } : null,
    };
  }
  const body = await readJsonBody(req);
  return { preset: body?.preset, thumbnail: null };
}

async function readMultipartForm(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!boundaryMatch) {
    throw httpError(400, "invalid_multipart", "Expected multipart/form-data with a boundary.");
  }

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const body = await readRawBody(req);
  const parts = splitMultipartBody(body, boundary);
  const fields = {};
  const files = [];
  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) continue;
    const headerText = part.subarray(0, headerEnd).toString("latin1");
    const name = parseMultipartHeaderValue(headerText, "name");
    if (!name) continue;
    const data = trimPartEnd(part.subarray(headerEnd + 4));
    const filename = parseMultipartHeaderValue(headerText, "filename");
    if (filename !== null) {
      files.push({
        name,
        filename,
        contentType: parsePartContentType(headerText),
        data,
      });
    } else {
      fields[name] = data.toString("utf8");
    }
  }
  return { fields, files };
}

function parseMultipartHeaderValue(headerText, key) {
  const match = new RegExp(`${key}="([^"]*)"`, "i").exec(headerText);
  return match ? match[1] : null;
}

function parsePartContentType(headerText) {
  const match = /^content-type:\s*([^\r\n]+)/im.exec(headerText);
  return match ? match[1].trim() : "";
}

function splitMultipartBody(body, boundary) {
  const parts = [];
  let start = body.indexOf(boundary);
  while (start >= 0) {
    start += boundary.length;
    if (body[start] === 45 && body[start + 1] === 45) break;
    if (body[start] === 13 && body[start + 1] === 10) start += 2;
    const next = body.indexOf(boundary, start);
    if (next < 0) break;
    parts.push(body.subarray(start, next));
    start = next;
  }
  return parts;
}

function trimPartEnd(buffer) {
  let end = buffer.length;
  while (end > 0 && (buffer[end - 1] === 10 || buffer[end - 1] === 13)) end -= 1;
  return buffer.subarray(0, end);
}

function sendJson(res, statusCode, value) {
  assertNoSecretMaterial(value, "API response");
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(value, null, 2));
}

async function serveStaticFile(req, res, pathname) {
  const routePath = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(routePath);
  const rootFiles = new Set(["/index.html", "/styles.css"]);
  if (rootFiles.has(decodedPath)) {
    const filePath = path.resolve(ROOT, decodedPath.slice(1));
    if (!isPathInside(filePath, ROOT) || !existsSync(filePath)) return false;
    return sendStaticFile(req, res, filePath);
  }

  if (decodedPath.startsWith("/src/") && !isAllowedClientSource(decodedPath)) {
    return false;
  }

  const allowedRoots = [
    { prefix: "/src/", root: path.join(ROOT, "src") },
    { prefix: "/assets/", root: path.join(ROOT, "assets") },
    { prefix: "/data/presets/", root: path.join(DATA_ROOT, "data", "presets") },
    { prefix: "/data/character-presets/", root: path.join(DATA_ROOT, "data", "character-presets") },
    { prefix: "/data/generations/", root: path.join(DATA_ROOT, "data", "generations") },
  ];

  const match = allowedRoots.find((item) => decodedPath.startsWith(item.prefix));
  if (!match) return false;
  if (match.prefix === "/data/presets/" && !isPresetThumbnailPath(decodedPath)) return false;
  if (match.prefix === "/data/character-presets/" && !isPresetThumbnailPath(decodedPath)) return false;

  const relative = decodedPath.slice(match.prefix.length);
  const filePath = path.resolve(match.root, relative);
  if (!isPathInside(filePath, match.root) || !existsSync(filePath)) return false;
  return sendStaticFile(req, res, filePath);
}

function isPresetThumbnailPath(pathname) {
  const baseName = path.basename(pathname).toLowerCase();
  return /^thumbnail\.(webp|png|jpg|jpeg)$/.test(baseName);
}

function isAllowedClientSource(pathname) {
  return pathname === "/src/app.js"
    || pathname.startsWith("/src/api/")
    || pathname.startsWith("/src/ui/");
}

function sendStaticFile(req, res, filePath) {
  const content = readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": getContentType(filePath),
    "Cache-Control": "no-store",
  });
  if (req.method !== "HEAD") res.end(content);
  else res.end();
  return true;
}

function isPathInside(filePath, rootPath) {
  const relative = path.relative(rootPath, filePath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  }[extension] || "application/octet-stream";
}

function sanitizeError(error) {
  return {
    type: error.type || "internal_error",
    status: Number(error.statusCode) || 500,
    message: error.publicMessage || "Request failed",
    details: sanitizeText(error.details || error.message || ""),
  };
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/pst-[A-Za-z0-9_-]+/g, "[redacted-token]")
    .replace(/(NAI_ACCESS_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY)\s*=\s*[^\s]+/g, "$1=[redacted]")
    .replace(/(apiKey|access_token|token)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[redacted]")
    .slice(0, 2000);
}

function httpError(statusCode, type, publicMessage, details = "") {
  return storeError(statusCode, type, publicMessage, details);
}
