import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createReceiver, protocol, validatePreview } from "../electron/transfer-receiver.mjs";
import { prepareRegistry, writeRegistryFile } from "../electron/transfer-registry.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const example = () => ({
  requestId: randomUUID(), revision: "fixture", items: [{
    source: { image: 1, number: 0, field: "positive" }, slot: "base",
    field: "undesired", mode: "append", text: "  합성\n1.5:: 문구 ::\t",
  }],
});

async function fixture(t, handler, options = {}) {
  const instanceId = randomUUID();
  const secret = randomBytes(32);
  const receiver = createReceiver({ instanceId, secret: secret.toString("hex"), ask: handler, ...options });
  const port = await receiver.listen();
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  const mac = segments => createHmac("sha256", secret).update(segments.join("\n")).digest("hex");
  t.after(() => { agent.destroy(); receiver.close(); });
  async function post(endpoint, body, options = {}) {
    const route = "/v1/" + endpoint;
    const bytes = Buffer.from(JSON.stringify(body));
    const nonce = options.nonce || randomBytes(16).toString("hex");
    const headers = {
      "Content-Type": "application/json", "Content-Length": bytes.length, "X-Chaessi-Instance": instanceId,
      "X-Chaessi-Nonce": nonce, "X-Chaessi-Mac": mac(["POST", route, instanceId, nonce, hash(bytes)]),
      ...options.headers,
    };
    const response = await new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, agent: options.fresh ? false : agent, method: "POST", path: route, headers }, resolve);
      req.on("error", reject);
      req.end(bytes);
    });
    const chunks = [];
    for await (const chunk of response) chunks.push(chunk);
    const reply = Buffer.concat(chunks);
    if (!options.unsigned) assert.equal(response.headers["x-chaessi-mac"], mac(["RES", response.statusCode, instanceId, nonce, hash(reply)]));
    return JSON.parse(reply.toString("utf8"));
  }
  return { receiver, post, instanceId };
}

test("Reader proof is confined to one authenticated connection; receipt and retries are idempotent", async t => {
  let previews = 0;
  const { receiver, post, instanceId } = await fixture(t, async (operation, body) => {
    if (operation === "targets") return { revision: "fixture", limit: 6, canCreate: 6, targets: [{ slot: "base", number: 0, fields: ["positive", "undesired"] }] };
    assert.equal(operation, "preview");
    assert.equal(body.items[0].text, example().items[0].text);
    previews++;
    return { state: "pending" };
  });
  const body = example();
  assert.equal((await post("preview", body)).error, "UNAUTHORIZED");
  assert.deepEqual(await post("probe", {}), { ok: true, protocol, instanceId, pid: process.pid });
  assert.equal((await post("preview", body, { fresh: true })).error, "UNAUTHORIZED");
  assert.equal((await post("targets", {})).targets[0].slot, "base");
  assert.equal((await post("preview", body)).state, "pending");
  assert.equal((await post("preview", body)).state, "pending");
  assert.equal((await post("preview", { ...body, revision: "other" })).error, "ID_CONFLICT");
  assert.equal((await post("preview", example())).error, "BUSY");
  assert.equal(receiver.finish(body.requestId, "applied"), true);
  assert.equal((await post("status", { requestId: body.requestId })).state, "applied");
  assert.equal((await post("preview", body)).state, "applied");
  assert.equal(previews, 1);
});

test("Web-origin requests, replayed nonces and bad authentication never reach draft handlers", async t => {
  const { post } = await fixture(t, () => assert.fail("Unexpected draft request"));
  const nonce = randomBytes(16).toString("hex");
  assert.equal((await post("probe", {}, { nonce })).ok, true);
  assert.equal((await post("probe", {}, { nonce, unsigned: true })).error, "UNAUTHORIZED");
  assert.equal((await post("targets", {}, { unsigned: true, headers: { Origin: "null" } })).error, "UNAUTHORIZED");
  assert.equal((await post("targets", {}, { unsigned: true, headers: { "X-Chaessi-Mac": "0".repeat(64) } })).error, "UNAUTHORIZED");
});

test("Only renderer expiry decides a pending batch outcome", async t => {
  let expired = 0;
  const { post } = await fixture(t, async operation => {
    if (operation === "expire") { expired++; return { state: "expired" }; }
    return { state: "pending" };
  }, { lifetime: 30 });
  const body = example();
  await post("probe", {});
  assert.equal((await post("preview", body)).state, "pending");
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(expired, 1);
  assert.equal((await post("status", { requestId: body.requestId })).state, "expired");
});

test("Unsupported text, absent fields, non-string IDs and sparse slot creation reject the batch", () => {
  for (const mutate of [
    b => { b.requestId = [b.requestId]; }, b => { b.items[0].text = "\ud800"; }, b => { b.items[0].text = "a\r\nb"; },
    b => { delete b.items[0].text; }, b => { b.items[0].slot = "new:2"; },
    b => { b.items[0].text = "a".repeat(256 * 1024 + 1); }, b => { b.items[0].source.path = "unexpected"; },
  ]) {
    const batch = example(); mutate(batch);
    assert.throws(() => validatePreview(batch), /INVALID|TOO_LARGE/);
  }
  assert.doesNotThrow(() => validatePreview(example()));
});

test("Windows discovery files inherit a protected directory DACL and can be atomically replaced", { skip: process.platform !== "win32" }, async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "chaessi-private-acl-test-"));
  const root = path.join(temp, "registry");
  const file = path.join(root, "instances", randomUUID() + ".json");
  t.after(async () => {
    await unlink(file).catch(() => {});
    for (const dir of [path.join(root, "instances"), root, temp]) await rmdir(dir).catch(() => {});
  });
  await prepareRegistry(root);
  await writeRegistryFile(file, { protocol });
  await prepareRegistry(root);
  await writeRegistryFile(file, { protocol, fixture: true });
  assert.equal(JSON.parse(await readFile(file, "utf8")).fixture, true);
});
