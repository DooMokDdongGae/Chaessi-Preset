import { app, BrowserWindow, Menu } from "electron";
import path from "node:path";
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

function createWindow({ serverStatus = "starting" } = {}) {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Chaessi Preset",
    icon: appIconPath,
    backgroundColor: "#10111d",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (serverStatus === "ready") {
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
    await startServerProcess();
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
