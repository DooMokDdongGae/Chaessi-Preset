import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";
import { mkdirSync, mkdtempSync } from "node:fs";
import { attachTransfer } from "./transfer-main.mjs";
import { fileURLToPath } from "node:url";
import {
  getServerBaseUrl,
  getServerHealthUrl,
  startServerProcess,
  stopServerProcess,
  waitForServerHealth,
} from "./server-process.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const appIconPath = path.join(projectRoot, "assets", "branding", "chaessi-preset.ico");
const supportUrl = "https://buymeacoffee.com/magiconcert";

const profileOverride = process.env.CHAESSI_PRIVATE_TEST_PROFILE;
const isolated = Boolean(profileOverride);
if (isolated) {
  const profile = profileOverride;
  const profilePath = path.resolve(profile).toLowerCase();
  const publicPath = path.resolve(app.getPath("appData"), "Chaessi Preset").toLowerCase();
  if (!path.isAbsolute(profile) || profilePath === publicPath || profilePath.startsWith(publicPath + path.sep) ||
      publicPath.startsWith(profilePath + path.sep) || profilePath === path.parse(profilePath).root) {
    throw new Error("A separate absolute review profile is required.");
  }
  mkdirSync(profile, { recursive: true });
  app.setPath("userData", path.resolve(profile));
}
// Keep the primary PUBLIC session at its existing path and origin. Concurrent
// windows need their own Chromium session; each publishes its own receiver.
const profile = app.getPath("userData");
if (!app.requestSingleInstanceLock()) {
  app.setPath("sessionData", mkdtempSync(path.join(profile, "window-")));
} else if (isolated) {
  const session = path.join(profile, "primary-window");
  mkdirSync(session, { recursive: true });
  app.setPath("sessionData", session);
}

function createWindow({ serverStatus = "starting" } = {}) {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: app.getName(),
    icon: appIconPath,
    backgroundColor: "#10111d",
    webPreferences: {
      preload: path.join(__dirname, "transfer-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === supportUrl) {
      shell.openExternal(supportUrl).catch(() => {
        console.error("[Chaessi Preset] Could not open the support page in the browser.");
      });
      return { action: "deny" };
    }
    let target;
    try { target = new URL(url); } catch { return { action: "deny" }; }
    if (target.origin !== getServerBaseUrl() || !/^\/manuals\/(app|wildcard)-(ko|en)\.pdf$/.test(target.pathname)) return { action: "deny" };
    return { action: "allow", overrideBrowserWindowOptions: {
      width: 1000, height: 820, title: "Chaessi Preset Manual", autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    } };
  });

  if (serverStatus === "ready") {
    attachTransfer(window, getServerBaseUrl());
    window.loadURL(getServerBaseUrl()).catch((error) => {
      window.loadURL(createShellHtml({
        serverStatus: "failed",
        message: `Failed to load Chaessi Preset UI: ${error.message}`,
      }));
    });
    return;
  }

  window.loadURL(createShellHtml({ serverStatus }));
}

function createShellHtml({ serverStatus, message = "" }) {
  const statusText = message || (serverStatus === "ready"
    ? `Local server is ready at ${getServerHealthUrl()}`
    : "Local server is starting.");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Chaessi Preset</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #10111d;
        color: #f7f4ff;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 28% 18%, rgba(208, 78, 255, 0.18), transparent 34%),
          radial-gradient(circle at 72% 76%, rgba(62, 210, 255, 0.14), transparent 30%),
          #10111d;
      }
      main {
        width: min(560px, calc(100vw - 48px));
        border: 1px solid rgba(211, 176, 255, 0.24);
        background: rgba(18, 19, 33, 0.78);
        padding: 32px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.34);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 30px;
        font-weight: 750;
        letter-spacing: 0;
      }
      p {
        margin: 0;
        color: #cfc8e8;
        line-height: 1.55;
      }
      .pill {
        display: inline-flex;
        margin-bottom: 18px;
        padding: 6px 10px;
        border: 1px solid rgba(91, 220, 255, 0.36);
        color: #92ecff;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="pill">Electron Shell</div>
      <h1>Chaessi Preset</h1>
      <p>${escapeHtml(statusText)}</p>
    </main>
  </body>
</html>`;
  return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  let serverStatus = "starting";
  try {
    await startServerProcess({ isolated, onLost: () => app.quit() });
    await waitForServerHealth();
    serverStatus = "ready";
  } catch (error) {
    serverStatus = "failed";
    console.error(`[Chaessi Preset] Local server startup failed: ${error.publicMessage || error.message}`);
  }

  createWindow({ serverStatus });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow({ serverStatus });
  });
});

app.on("before-quit", () => {
  stopServerProcess();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
