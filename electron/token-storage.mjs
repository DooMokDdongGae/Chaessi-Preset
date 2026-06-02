import { app, safeStorage } from "electron";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const SUPPORTED_PROVIDERS = new Set(["novelai"]);
const STORE_DIR_NAME = "secure-store";
const STORE_FILE_NAME = "tokens.json";

export async function isTokenStorageAvailable() {
  await ensureElectronReady();
  return safeStorage.isEncryptionAvailable();
}

export async function saveProviderToken(provider, token) {
  assertSupportedProvider(provider);
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    throw tokenStorageError("empty_token", "Token cannot be empty.");
  }
  await assertEncryptionAvailable();

  const store = await readTokenStoreForWrite();
  const encrypted = await encryptToken(cleanToken);
  store[provider] = {
    storage: "electron_safe_storage",
    encrypted: toEncryptedBuffer(encrypted).toString("base64"),
    updated_at: new Date().toISOString(),
  };
  await writeTokenStore(store);
  return getProviderTokenStatusFromStore(provider, store);
}

export async function loadProviderToken(provider) {
  assertSupportedProvider(provider);
  await assertEncryptionAvailable();

  const store = await readTokenStore();
  const record = store[provider];
  if (!record?.encrypted) return null;
  if (record.storage !== "electron_safe_storage") {
    throw tokenStorageError("unsupported_storage", "Unsupported token storage format.");
  }
  return decryptToken(Buffer.from(record.encrypted, "base64"));
}

export async function deleteProviderToken(provider) {
  assertSupportedProvider(provider);
  const store = await readTokenStoreForWrite();
  const existed = Boolean(store[provider]);
  delete store[provider];
  await writeTokenStore(store);
  return {
    provider,
    configured: false,
    storage: "electron_safe_storage",
    deleted: existed,
  };
}

export async function getProviderTokenStatus(provider) {
  assertSupportedProvider(provider);
  const available = await isTokenStorageAvailable();
  const store = await readTokenStore();
  return {
    ...getProviderTokenStatusFromStore(provider, store),
    available,
  };
}

export async function getTokenStorePath() {
  await ensureElectronReady();
  return path.join(app.getPath("userData"), STORE_DIR_NAME, STORE_FILE_NAME);
}

function getProviderTokenStatusFromStore(provider, store) {
  const record = store[provider];
  return {
    provider,
    configured: Boolean(record?.encrypted),
    storage: "electron_safe_storage",
    updated_at: record?.updated_at || null,
  };
}

async function encryptToken(token) {
  if (typeof safeStorage.encryptStringAsync === "function") {
    return safeStorage.encryptStringAsync(token);
  }
  return safeStorage.encryptString(token);
}

async function decryptToken(encrypted) {
  if (typeof safeStorage.decryptStringAsync === "function") {
    return normalizeDecryptedValue(await safeStorage.decryptStringAsync(encrypted));
  }
  return normalizeDecryptedValue(safeStorage.decryptString(encrypted));
}

async function assertEncryptionAvailable() {
  if (!(await isTokenStorageAvailable())) {
    throw tokenStorageError("encryption_unavailable", "Electron safeStorage encryption is not available.");
  }
}

async function readTokenStoreForWrite() {
  const result = await readTokenStoreSafe();
  if (!result.ok) {
    throw tokenStorageError("token_store_corrupt", "Token store could not be read safely.");
  }
  return result.value;
}

async function readTokenStore() {
  const result = await readTokenStoreSafe();
  if (!result.ok) return {};
  return result.value;
}

async function readTokenStoreSafe() {
  const filePath = await getTokenStorePath();
  try {
    const text = await readFile(filePath, "utf8");
    const parsed = JSON.parse(text || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, value: {} };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    if (error?.code === "ENOENT") return { ok: true, value: {} };
    if (error instanceof SyntaxError) return { ok: false, value: {} };
    throw error;
  }
}

async function writeTokenStore(store) {
  const filePath = await getTokenStorePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

async function ensureElectronReady() {
  if (!app.isReady()) await app.whenReady();
}

function assertSupportedProvider(provider) {
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw tokenStorageError("unsupported_provider", "Unsupported token provider.");
  }
}

function tokenStorageError(type, publicMessage) {
  const error = new Error(publicMessage);
  error.type = type;
  error.publicMessage = publicMessage;
  return error;
}

function toEncryptedBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  throw tokenStorageError("invalid_encrypted_token", "Encrypted token could not be stored safely.");
}

function normalizeDecryptedValue(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.result === "string") return value.result;
  throw tokenStorageError("invalid_decrypted_token", "Encrypted token could not be loaded safely.");
}
