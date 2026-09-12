import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const [url, fixtureRoot, outputDirectory] = process.argv.slice(2);
if (!url || !fixtureRoot || !outputDirectory) {
  throw new Error("Usage: node capture-image-maker-release-screenshots.mjs <url> <fixture-root> <output-directory>");
}

const chrome = findChrome();
const debugPort = 9339;
const profile = path.join(fixtureRoot, ".release-screenshot-chrome");
await rm(profile, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const child = spawn(chrome, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
], { shell: false, windowsHide: true, stdio: "ignore" });

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`).catch(() => null))?.ok, 15_000);
  const created = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
  const cdp = await connectCdp(created.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url });
    await waitFor(
      () => evaluate(cdp, "Boolean(document.getElementById('imageMakerWorkspaceTab'))"),
      15_000,
      async () => evaluate(cdp, "JSON.stringify({ href: location.href, readyState: document.readyState, title: document.title, body: document.body?.innerText?.slice(0, 200) })"),
    );
    await evaluate(cdp, `
      document.getElementById("presetWorkspace").hidden = true;
      document.getElementById("imageMakerWorkspace").hidden = false;
      document.getElementById("presetWorkspaceTab").classList.remove("is-active");
      document.getElementById("imageMakerWorkspaceTab").classList.add("is-active");
      true
    `);
    await waitFor(() => evaluate(cdp, "Boolean(document.getElementById('imageMakerAddPresetButton'))"), 20_000);

    const request = JSON.parse(await readFile(path.join(fixtureRoot, "data", "image-maker-runs", "release_demo_gallery", "request.json"), "utf8"));
    const plan = JSON.parse(await readFile(path.join(fixtureRoot, "data", "image-maker-runs", "release_demo_gallery", "director-plan.json"), "utf8"));
    await populateRequest(cdp, request);
    await evaluate(cdp, "window.scrollTo(0, 0); true");
    await delay(300);
    await capture(cdp, "image-maker-main.png");

    await evaluate(cdp, `
      (() => {
        document.getElementById("imageMakerAdvancedWorkflow").open = true;
        const detail = document.querySelector("#imageMakerPlanJson")?.closest("details");
        if (detail) detail.open = true;
        const area = document.getElementById("imageMakerPlanJson");
        area.value = ${JSON.stringify(JSON.stringify(plan, null, 2))};
        area.dispatchEvent(new Event("input", { bubbles: true }));
        document.getElementById("imageMakerPreparePlanButton").click();
        return true;
      })()
    `);
    await waitFor(
      () => evaluate(cdp, "document.querySelectorAll('.image-maker-shot-card').length === 3"),
      10_000,
      async () => evaluate(cdp, "JSON.stringify({ planStatus: document.getElementById('imageMakerPlanStatus')?.innerText, toast: document.getElementById('toast')?.innerText, request: document.getElementById('imageMakerRequest')?.value, count: document.getElementById('imageMakerCount')?.value })"),
    );
    await evaluate(cdp, `document.querySelector("#imageMakerPlanJson")?.closest("details")?.removeAttribute("open"); document.getElementById("imageMakerPlanMode").scrollIntoView({block:"start"}); true`);
    await delay(300);
    await capture(cdp, "director-plan.png");

    await evaluate(cdp, `document.getElementById("imageMakerPreflightButton").click(); true`);
    await waitFor(
      () => evaluate(cdp, "document.getElementById('imageMakerRunSummary').dataset.status === 'ready'"),
      20_000,
      async () => evaluate(cdp, "JSON.stringify({ status: document.getElementById('imageMakerRunSummary')?.dataset?.status, summary: document.getElementById('imageMakerRunSummary')?.innerText, review: document.getElementById('imageMakerReviewList')?.innerText, toast: document.getElementById('toast')?.innerText })"),
    );
    await evaluate(cdp, `document.getElementById("imageMakerRunSummary").scrollIntoView({block:"start"}); true`);
    await delay(300);
    await capture(cdp, "preflight.png");

    await evaluate(cdp, `
      (() => {
        const history = document.getElementById("imageMakerRunHistory")?.closest("details");
        if (history) history.open = true;
        document.querySelector('[data-image-maker-run="release_demo_gallery"]')?.click();
        return true;
      })()
    `);
    await waitFor(() => evaluate(cdp, "document.querySelectorAll('.image-maker-result-card').length === 3"));
    await waitFor(() => evaluate(cdp, "[...document.querySelectorAll('.image-maker-result-card img')].every((img) => img.complete)"));
    await evaluate(cdp, `document.getElementById("imageMakerResultsPanel").scrollIntoView({block:"start"}); true`);
    await delay(300);
    await capture(cdp, "gallery.png");
  } finally {
    cdp.close();
  }
} finally {
  child.kill();
}

async function populateRequest(cdp, value) {
  await evaluate(cdp, `
    (() => {
      const set = (id, value) => {
        const element = document.getElementById(id);
        element.value = value ?? "";
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("imageMakerRequest", ${JSON.stringify(value.request)});
      set("imageMakerCount", ${JSON.stringify(String(value.count))});
      document.querySelector('input[name="imageMakerMode"][value="${value.mode}"]').click();
      return true;
    })()
  `);
}

async function capture(cdp, name) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path.join(outputDirectory, name), Buffer.from(result.data, "base64"));
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Browser evaluation failed.");
  return response.result?.value;
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result || {});
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

async function waitFor(check, timeoutMs = 10_000, diagnose = null) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await delay(100);
  }
  const detail = diagnose ? await diagnose().catch(() => "diagnostics unavailable") : "";
  throw new Error(`Timed out while preparing release screenshots.${detail ? ` ${detail}` : ""}`);
}

function findChrome() {
  const candidates = [
    process.env.CHAESSI_RELEASE_CHROME,
    path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);
  const found = candidates.find(existsSync);
  if (!found) throw new Error("Google Chrome was not found for release screenshot capture.");
  return found;
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
