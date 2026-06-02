import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJsonFile(filePath, value) {
  assertNoSecretMaterial(value, filePath);
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function listDirectories(dirPath) {
  if (!existsSync(dirPath)) return [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

export async function listFiles(dirPath) {
  if (!existsSync(dirPath)) return [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

export async function removePath(targetPath) {
  if (!existsSync(targetPath)) return;
  await rm(targetPath, { recursive: true, force: true });
}

export function createId(prefix) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function createTimestampId(date = new Date()) {
  const stamp = date.toISOString()
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "_")
    .replace(/:/g, "");
  return `${stamp}_${randomBytes(3).toString("hex")}`;
}

export function sanitizeStoreId(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw storeError(400, "invalid_id", "Invalid id.");
  }
  return id;
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function assertNoSecretMaterial(value, label) {
  const text = JSON.stringify(value);
  const forbidden = ["Authorization", "Bearer", "apiKey", "access_token", "NAI_ACCESS_TOKEN", "OPENAI_API_KEY", "GEMINI_API_KEY"];
  for (const marker of forbidden) {
    if (text.includes(marker)) {
      throw storeError(500, "secret_leak_prevented", `Refusing to write or return ${label}: contains forbidden secret marker.`);
    }
  }
  if (/pst-[A-Za-z0-9_-]+/.test(text)) {
    throw storeError(500, "secret_leak_prevented", `Refusing to write or return ${label}: contains token-shaped value.`);
  }
}

export function storeError(statusCode, type, publicMessage, details = "") {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.type = type;
  error.publicMessage = publicMessage;
  error.details = details;
  return error;
}
