import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { installGenerationCost } from "../src/ui/generation-cost.js";

const serverFile = fileURLToPath(new URL("../server.mjs", import.meta.url));

async function startChild(t, port, { normalStartup = false } = {}) {
  const profile = await mkdtemp(path.join(os.tmpdir(), "chaessi-server-test-"));
  let file = serverFile;
  if (normalStartup) {
    // Real PUBLIC startup reads a project-local .env and migrates project data.
    // Exercise it from a new source folder containing neither.
    const project = path.dirname(serverFile);
    const cache = path.join(project, ".cache");
    await mkdir(cache, { recursive: true });
    const fixture = await mkdtemp(path.join(cache, "startup-"));
    t.after(() => rm(fixture, { recursive: true, force: true }));
    for (const name of ["server.mjs", "package.json"]) await copyFile(path.join(project, name), path.join(fixture, name));
    await cp(path.join(project, "src"), path.join(fixture, "src"), { recursive: true });
    file = path.join(fixture, "server.mjs");
  }
  const trace = path.join(profile, "requests.jsonl");
  const child = fork(file, {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    execArgv: ["--import", new URL("./mock-pixel-resolution-provider.mjs", import.meta.url).href],
    env: {
      SystemRoot: process.env.SystemRoot,
      PATH: process.env.PATH,
      PORT: String(port),
      CHAESSI_ELECTRON_SERVER: "1",
      ...(!normalStartup && { CHAESSI_PRIVATE_TEST_PROFILE: profile }),
      CHAESSI_USER_DATA_DIR: profile,
      NAI_ACCESS_TOKEN: "synthetic-local-test",
      CHAESSI_PROVIDER_TRACE: trace,
    },
  });
  const closed = once(child, "exit");
  t.after(async () => {
    if (child.connected) child.disconnect();
    await closed;
    await rm(profile, { recursive: true, force: true });
  });
  const [message] = await Promise.race([
    once(child, "message", { signal: AbortSignal.timeout(15000) }),
    closed.then(() => { throw new Error("Child exited before publishing its listening port"); }),
  ]);
  assert.equal(message.channel, "server-ready");
  assert.ok(Number.isInteger(message.port) && message.port > 0);
  return { port: message.port, trace };
}

test("concurrent Electron servers announce their own loopback port when the preferred port is occupied", async t => {
  const primary = await startChild(t, 0);
  const secondary = await startChild(t, primary.port);
  assert.notEqual(secondary.port, primary.port);
  for (const {port} of [primary, secondary]) {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(health.status, 200);
    const result = await health.json();
    assert.equal(result.app, "Chaessi Preset");
    assert.equal(result.channel, "public");
    assert.equal(result.accountRefreshOnStartup, false);
  }
});

test("normal PUBLIC startup updates the existing estimate with one mock account read; isolated startup and local edits make none", async t => {
  const {port, trace} = await startChild(t, 0, { normalStartup: true });
  const base = `http://127.0.0.1:${port}`;
  const fetchLocal = globalThis.fetch;
  const health = await (await fetchLocal(base + "/api/health")).json();
  assert.equal(health.accountRefreshOnStartup, true);
  const requests = [];
  t.mock.method(globalThis, "fetch", async url => {
    requests.push(url);
    return fetchLocal(base + url);
  });
  let estimate;
  const nodes = {
    generateStatus: { before(node) { assert.equal(estimate, undefined); estimate = node; } },
    generationSourceInfo: {},
    paramModel: {value: "nai-diffusion-5-full"}, paramEffort: {value: "high"},
    paramWidth: {value: "1344"}, paramHeight: {value: "768"}, paramSteps: {value: "23"},
  };
  globalThis.window = { promptTransfer: {} };
  globalThis.document = {
    createElement: () => ({ setAttribute() {} }),
    getElementById: id => nodes[id],
    addEventListener() {},
  };
  globalThis.MutationObserver = class { observe() {} };
  t.after(() => {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.MutationObserver;
  });
  const ui = installGenerationCost({ getPreset: () => ({params:{model:"nai-diffusion-5-full"}}), getMode: () => "text-to-image" });
  await ui.refreshAccount(false);
  assert.deepEqual(requests, []);
  assert.match(estimate.textContent, /may use Opus allowance/);
  const account = await ui.refreshAccount(health.accountRefreshOnStartup);
  assert.equal(account.anlas_balance, 100);
  assert.equal(account.stamina_percent, 80);
  assert.equal(estimate.textContent, "Estimated 0 Anlas · Uses Opus allowance");
  nodes.paramWidth.value = "1664";
  nodes.paramHeight.value = "960";
  ui.render();
  assert.match(estimate.textContent, /Estimated [1-9]\d* Anlas/);
  assert.deepEqual(requests, ["/api/novelai/account-usage"]);
  const provider = (await readFile(trace, "utf8")).trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(provider.map(r => [r.method, r.url]), [["GET", "https://image.novelai.net/user/data"]]);
});
