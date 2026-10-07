import { app } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deleteProviderToken,
  getProviderTokenStatus,
  loadProviderToken,
  saveProviderToken,
} from "./token-storage.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const serverPath = path.join(projectRoot, "server.mjs");
const serverPort = Number(process.env.PORT || 4174);
const serverBaseUrl = `http://127.0.0.1:${serverPort}`;
const serverHealthUrl = `http://127.0.0.1:${serverPort}/api/health`;

let serverProcess = null;
let stopping = false;

export function getServerHealthUrl() {
  return serverHealthUrl;
}

export function getServerBaseUrl() {
  return serverBaseUrl;
}

export async function startServerProcess() {
  if (serverProcess && !serverProcess.killed) return serverProcess;

  stopping = false;
  const command = getServerCommand();
  const savedTokenEnv = await loadSavedTokenEnv();
  serverProcess = spawn(command.executable, [serverPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(serverPort),
      CHAESSI_USER_DATA_DIR: app.getPath("userData"),
      ...command.env,
      ...savedTokenEnv,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });

  serverProcess.stdout?.on("data", (chunk) => {
    const text = sanitizeLogChunk(chunk);
    if (text) process.stdout.write(`[server] ${text}`);
  });

  serverProcess.stderr?.on("data", (chunk) => {
    const text = sanitizeLogChunk(chunk);
    if (text) process.stderr.write(`[server] ${text}`);
  });

  serverProcess.on("exit", (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`[Chaessi Preset] Local server exited unexpectedly: code=${code ?? "none"} signal=${signal ?? "none"}`);
    }
    serverProcess = null;
  });

  serverProcess.on("message", (message) => {
    handleTokenStorageMessage(message).catch((error) => {
      sendTokenStorageReply(message?.requestId, {
        ok: false,
        error: {
          type: error?.type || "token_storage_failed",
          message: error?.publicMessage || error?.message || "Token storage request failed.",
        },
      });
    });
  });

  return serverProcess;
}

async function loadSavedTokenEnv() {
  try {
    const novelaiToken = await loadProviderToken("novelai");
    if (!novelaiToken) return {};
    return {
      NAI_ACCESS_TOKEN: novelaiToken,
    };
  } catch (error) {
    const message = error?.publicMessage || error?.message || "Secure token storage unavailable.";
    console.warn(`[Chaessi Preset] ${message} Falling back to environment token.`);
    return {};
  }
}

function getServerCommand() {
  if (app.isPackaged) {
    return {
      executable: process.execPath,
      env: {
        ELECTRON_RUN_AS_NODE: "1",
      },
    };
  }

  return {
    executable: process.env.npm_node_execpath || process.env.NODE || "node",
    env: {},
  };
}

async function handleTokenStorageMessage(message) {
  if (!message || message.channel !== "token-storage" || !message.requestId) return;
  const { action, provider, token } = message;
  if (action === "status") {
    sendTokenStorageReply(message.requestId, {
      ok: true,
      status: await getProviderTokenStatus(provider),
    });
    return;
  }
  if (action === "save") {
    await saveProviderToken(provider, token);
    sendTokenStorageReply(message.requestId, { ok: true });
    return;
  }
  if (action === "delete") {
    await deleteProviderToken(provider);
    sendTokenStorageReply(message.requestId, { ok: true });
    return;
  }
  sendTokenStorageReply(message.requestId, {
    ok: false,
    error: {
      type: "unsupported_token_storage_action",
      message: "Unsupported token storage action.",
    },
  });
}

function sendTokenStorageReply(requestId, payload) {
  if (!serverProcess || !requestId) return;
  serverProcess.send?.({
    channel: "token-storage",
    requestId,
    ...payload,
  });
}

export async function waitForServerHealth({ timeoutMs = 10_000, intervalMs = 250 } = {}) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    if (!serverProcess || serverProcess.exitCode !== null) {
      const error = new Error("Local server process exited before becoming ready.");
      error.publicMessage = "Local server process exited before becoming ready.";
      error.cause = lastError;
      throw error;
    }

    try {
      const response = await fetch(serverHealthUrl);
      if (response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.ok) return body;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }

  const error = new Error(`Local server did not become ready at ${serverHealthUrl}`);
  error.publicMessage = "Local server did not become ready.";
  error.cause = lastError;
  throw error;
}

export function stopServerProcess() {
  if (!serverProcess || serverProcess.killed) return;
  stopping = true;
  serverProcess.kill();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeLogChunk(chunk) {
  return String(chunk)
    .replace(/Authorization:\s*Bearer\s+[^\s]+/gi, "Authorization: Bearer [redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/(NAI_ACCESS_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY)\s*=\s*[^\s]+/g, "$1=[redacted]");
}
