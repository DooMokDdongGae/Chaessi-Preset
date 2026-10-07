import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDefaultPreset } from "../src/state/preset-schema.js";
import { encodeRgbPng } from "../src/services/generation-image-utils.js";

test("HTTP store, frozen preparation, and final request/History across V4.5/V5 T2I/I2I/Inpaint", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chaessi-wildcard-http-"));
  const base = "http://127.0.0.1:4188";
  const child = spawn(process.execPath, ["--import", "./tests/mock-novelai.mjs", "server.mjs"], { cwd: new URL("../", import.meta.url), windowsHide: true, env: { ...process.env, PORT: "4188", CHAESSI_USER_DATA_DIR: root, NAI_ACCESS_TOKEN: "test-local-only" }, stdio: "ignore" });
  async function request(route, body, status = 200, method = "POST") {
    const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value;
  }
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base + "/api/health")).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    const tops = (await request("/api/wildcards", { key: "tops", text: "blue shirt\nwhite shirt" })).wildcard;
    await request("/api/wildcards", { key: "poses", text: "standing\nsitting" });
    await request("/api/wildcards", { key: "tops", text: "duplicate" }, 409);
    await request("/api/wildcards", { key: "empty", text: "\n" }, 400);
    assert.equal((await request("/api/wildcards", null, 200, "GET")).items.length, 2);
    assert.equal((await request(`/api/wildcards/${tops.id}`, null, 200, "GET")).wildcard.key, "tops");
    const source = encodeRgbPng(Buffer.alloc(64 * 64 * 3, 255), 64, 64).toString("base64");
    for (const model of ["nai-diffusion-4-5-full", "nai-diffusion-5-full"]) {
      for (const mode of ["text-to-image", "image-to-image", "inpaint"]) {
        const preset = createDefaultPreset({ params: { model, width: 64, height: 64, seed: 123 }, prompt_parts: { base: "1girl, __tops__, __poses__, ||outdoors|indoors||", undesired: "__tops__", characters: [{ prompt: "__tops__", undesired: "||text|blur||" }, { enabled: false, prompt: "__missing__" }] } });
        preset.model_states = { other: { prompt_parts: { base: "__missing__" } } };
        const prepared = await request("/api/novelai/prepare", { preset });
        const edited = await request("/api/wildcards", { ...tops, text: "red shirt", entries: ["red shirt"] });
        const modeState = { mode, width: 64, height: 64, source_image_base64: source, mask_image_base64: source, strength: .5, noise: 0, generation_padding: 16 };
        const result = await request("/api/novelai/generate", { prepared_id: prepared.prepared_id, preset: { ignored: "__missing__" }, mode, mode_state: modeState });
        const history = (await request(`/api/generations/${result.generation.id}`, null, 200, "GET")).generation;
        const transmitted = JSON.parse(await readFile(path.join(root, "captured-request.json"), "utf8"));
        assert.equal(history.generation.prompt, transmitted.input);
        assert.equal(history.internal_preset.prompt_parts.base, prepared.preset.prompt_parts.base);
        assert.equal(JSON.stringify(history).includes("__"), false);
        assert.equal(JSON.stringify(history).includes("||"), false);
        assert.equal(history.internal_preset.model_states, undefined);
        await request("/api/novelai/generate", { prepared_id: prepared.prepared_id }, 409);
        await request("/api/wildcards", { ...tops, entries: tops.entries });
      }
    }
    const missing = createDefaultPreset({ prompt_parts: { base: "__not_here__" } });
    await request("/api/novelai/prepare", { preset: missing }, 400);
    await request(`/api/wildcards/${tops.id}`, null, 200, "DELETE");
    await request(`/api/wildcards/${tops.id}`, null, 404, "GET");
  } finally {
    const exit = new Promise(resolve => child.once("exit", resolve)); child.kill(); await exit;
    await rm(root, { recursive: true, force: true });
  }
});
