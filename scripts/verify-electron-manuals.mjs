import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = fileURLToPath(new URL("../", import.meta.url));
const packaged = process.env.CHAESSI_PACKAGED === "1";
const folder = path.join(root, ".cache", `electron-manual-${packaged ? "packaged" : "source"}-${Date.now()}`); await mkdir(folder, { recursive: true });
const require = createRequire(import.meta.url);
const { _electron } = require(process.env.CHAESSI_PLAYWRIGHT || "playwright");
const app = await _electron.launch({
  executablePath: process.env.CHAESSI_ELECTRON || require("electron"),
  args: packaged ? [`--user-data-dir=${folder}`] : ["tests/electron-fixture.cjs"], cwd: root,
  env: { ...process.env, PORT: "4191", NAI_ACCESS_TOKEN: "", CHAESSI_ELECTRON_TEST_DATA: folder }, timeout: 45_000,
});
const checks = [];
try {
  const runtime = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, userData: app.getPath("userData") }));
  assert.equal(runtime.packaged, packaged);
  assert.equal(path.resolve(runtime.userData).toLowerCase(), path.resolve(folder).toLowerCase(), "verification must use isolated user data");
  const page = await app.firstWindow();
  await page.waitForFunction(() => document.querySelector("#healthStatus")?.textContent === "v3.4.0");
  await page.locator("#healthStatus").click();
  for (const name of ["app-ko", "app-en", "wildcard-ko", "wildcard-en"]) {
    const windowWait = app.waitForEvent("window");
    await page.locator(`#aboutDialog a[href='/manuals/${name}.pdf']`).click();
    const viewer = await windowWait;
    await viewer.waitForLoadState("domcontentloaded");
    assert.match(viewer.url(), new RegExp(`/manuals/${name}\\.pdf$`));
    const response = await fetch(`http://127.0.0.1:4191/manuals/${name}.pdf`);
    assert.equal(response.status, 200); assert.match(response.headers.get("content-type"), /application\/pdf/);
    await viewer.waitForTimeout(1200);
    await viewer.screenshot({ path: path.join(folder, `${name}.png`) });
    await viewer.close(); checks.push(`${name}.pdf opened in the actual Electron PDF viewer`);
  }
  await writeFile(path.join(folder, "results.json"), JSON.stringify({ checks }, null, 2));
  console.log(`${packaged ? "Packaged" : "Source"} runtime with isolated user data\n` + checks.join("\n"));
} finally { await app.close(); }
