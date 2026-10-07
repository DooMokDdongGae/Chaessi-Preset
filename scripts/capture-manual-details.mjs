import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const { evidence } = JSON.parse(await readFile(path.join(root, ".cache/latest-verification.json"), "utf8"));
const screens = path.join(root, "manuals/screenshots");
const { chromium } = createRequire(import.meta.url)(process.env.CHAESSI_PLAYWRIGHT || "playwright");
const base = "http://127.0.0.1:4189";
const child = spawn(process.execPath, ["server.mjs"], { cwd: root, windowsHide: true, env: { ...process.env, PORT: "4189", CHAESSI_USER_DATA_DIR: evidence, NAI_ACCESS_TOKEN: "" }, stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + "/api/health")).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(base); await page.waitForFunction(() => document.querySelector("#presetName").value.length > 0);
  await page.locator("#openWildcardsButton").click();
  await page.locator("#wildcardList button").filter({ hasText: "__tops__" }).click();
  await page.waitForFunction(() => document.querySelector("#wildcardKey").value === "tops");
  async function region(name, first, last) {
    await page.locator(first).scrollIntoViewIfNeeded();
    const a = await page.locator(first).boundingBox(), b = await page.locator(last).boundingBox();
    await page.screenshot({ path: path.join(screens, name), clip: { x: Math.min(a.x,b.x)-5, y: a.y-5, width: Math.max(a.x+a.width,b.x+b.width)-Math.min(a.x,b.x)+10, height: b.y+b.height-a.y+10 } });
  }
  await region("wildcard-key.png", '#wildcardName', '#wildcardReference');
  await region("wildcard-candidates.png", '#wildcardEntries', '#wildcardCount');
  await region("wildcard-tools.png", '.wildcard-editor .actions', '#wildcardStatus');
  await page.locator("#wildcardClose").click();
  const items = (await (await fetch(base + "/api/generations")).json()).items;
  if (items.length) {
    await page.locator("#imageInput").setInputFiles(path.join(evidence, items[0].image_path));
    await page.locator("#imageIntakeI2IButton").click();
    await page.locator(".mode-settings-row").screenshot({ path: path.join(screens, "i2i-controls.png") });
    await page.locator('[data-generation-mode="inpaint"]').click();
    await page.locator(".inpaint-toolbar").screenshot({ path: path.join(screens, "inpaint-controls.png") });
    await page.locator("#loadHistoryButton").click();
    await page.locator("#historyList [data-generation-id]").first().click();
    await page.locator("#imageViewerDialog").waitFor({ state: "visible" });
    await page.locator("#imageViewerHistoryDetails").evaluate(el => el.open = true);
    await page.locator("#imageViewerHistoryDetails").screenshot({ path: path.join(screens, "history-details.png") });
  }
  console.log("Captured readable detail images from the actual app; no generation requests.");
} finally { await browser?.close(); child.kill(); }
