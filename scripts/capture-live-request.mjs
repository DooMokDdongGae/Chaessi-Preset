// Test-only preload: retain request bodies for local verification; never retain headers or tokens.
import { writeFile } from "node:fs/promises";
import path from "node:path";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith("https://image.novelai.net/ai/generate-image")) {
    const payload = typeof options.body === "string" ? JSON.parse(options.body) : JSON.parse(await options.body.get("request").text());
    const name = payload.model.includes("diffusion-5") ? "v5" : "v45";
    await writeFile(path.join(process.env.CHAESSI_VERIFY_DIR, `request-${name}.json`), JSON.stringify(payload, null, 2));
  }
  return originalFetch(url, options);
};
