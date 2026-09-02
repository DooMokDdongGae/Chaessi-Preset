import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-history-bulk-endpoint-"));
assert.ok(root.startsWith(os.tmpdir()), "endpoint test data must remain inside the system temp directory");
const port = await getAvailablePort();
const id = "2026-08-20_010203_endpoint";
const folder = path.join(root, "data", "generations", "2026-08-20");
await mkdir(folder, { recursive: true });
await writeFile(path.join(folder, `${id}.png`), Buffer.from("89504e470d0a1a0a", "hex"));
await writeFile(path.join(folder, `${id}.payload.json`), "{}\n", "utf8");
await writeFile(path.join(folder, `${id}.json`), `${JSON.stringify({
  generation_id: id,
  created_at: "2026-08-20T01:02:03.000Z",
  generation: { model: "nai-diffusion-5-full", width: 832, height: 1216, seed: 1 },
  output: {
    image_filename: `data/generations/2026-08-20/${id}.png`,
    sidecar_filename: `data/generations/2026-08-20/${id}.json`,
  },
}, null, 2)}\n`, "utf8");

const child = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL(".", import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    CHAESSI_USER_DATA_DIR: root,
    NAI_ACCESS_TOKEN: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForHealth(port);
  const empty = await request(port, []);
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.type, "empty_generation_ids");

  const response = await request(port, [id, id, "missing_generation", "../escape"]);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.result.deleted_ids, [id]);
  assert.deepEqual(response.body.result.missing_ids, ["missing_generation"]);
  assert.deepEqual(response.body.result.duplicate_ids, [id]);
  assert.equal(response.body.result.failed.length, 1);
  assert.equal(response.body.result.failed[0].id, null);
  await assert.rejects(() => access(path.join(folder, `${id}.json`)));
  await assert.rejects(() => access(path.join(folder, `${id}.png`)));
  await assert.rejects(() => access(path.join(folder, `${id}.payload.json`)));

  console.log("History bulk delete endpoint tests passed.");
} finally {
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
  await rm(root, { recursive: true, force: true });
}

async function request(serverPort, ids) {
  const response = await fetch(`http://127.0.0.1:${serverPort}/api/generations/delete-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  return { status: response.status, body: await response.json() };
}

async function waitForHealth(serverPort) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${serverPort}/api/health`);
      if (response.ok) return;
    } catch {
      // Server has not started yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not start.");
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const selectedPort = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(selectedPort));
    });
  });
}
