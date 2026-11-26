import "./mock-novelai.mjs";
import { appendFile } from "node:fs/promises";
import path from "node:path";
const syntheticGenerate = globalThis.fetch;

// This fixture has no network fallback. The existing ZIP fixture only sees a synthetic, redacted request.
globalThis.fetch = async (url, options) => {
  const suffix = String(url).replace("https://image.novelai.net/ai/", "");
  if (suffix === "encode-vibe") {
    return new Response(Buffer.from("synthetic opaque Vibe bytes"), { status: 201, headers: { "content-type": "application/binary" } });
  }
  if (suffix !== "generate-image") throw new Error("Unexpected request in the Vibe fixture");
  const payload = JSON.parse(options.body);
  const p = payload.parameters;
  await appendFile(path.join(process.env.CHAESSI_USER_DATA_DIR, "vibe-calls.jsonl"), JSON.stringify({
    model: payload.model, action: payload.action, keys: Object.keys(p),
    count: p.reference_image_multiple.length, normalized: p.reference_strength_multiple,
  }) + "\n");
  p.reference_image_multiple = ["synthetic-vendor-echo-marker"];
  const response = await syntheticGenerate(url, { ...options, body: JSON.stringify(payload) });
  return new Response(response.body, { status: 201, headers: response.headers });
};
