// Verification helper. Uses the app's existing safeStorage reader and passes the token in memory only.
import { app } from "electron";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadProviderToken } from "../electron/token-storage.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
app.setPath("userData", path.join(app.getPath("appData"), "Chaessi Preset"));
app.whenReady().then(async () => { try {
  const token = await loadProviderToken("novelai");
  if (!token) throw new Error("No saved NovelAI token is available.");
  const child = spawn(process.env.CHAESSI_NODE || "node", ["scripts/verify-ui.mjs"], {
    cwd: root, windowsHide: true, env: { ...process.env, NAI_ACCESS_TOKEN: token, CHAESSI_LIVE_ENV_FILE: "" }, stdio: "inherit",
  });
  child.on("exit", code => app.exit(code || 0));
} catch (error) { console.error(error.message); app.exit(1); } });
