import { writeFile } from "node:fs/promises";
import path from "node:path";
import { encode } from "@msgpack/msgpack";
import { encodeRgbPng } from "../src/services/generation-image-utils.js";
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith("https://image.novelai.net/ai/generate-image")) return nativeFetch(url, options);
  const payload = typeof options.body === "string" ? JSON.parse(options.body) : JSON.parse(await options.body.get("request").text());
  // Save only the body, without headers, credentials or embedded source assets.
  const clean = structuredClone(payload);
  delete clean.parameters.image; delete clean.parameters.mask;
  await writeFile(path.join(process.env.CHAESSI_USER_DATA_DIR, "captured-request.json"), JSON.stringify(clean));
  const image = encodeRgbPng(Buffer.alloc(64 * 64 * 3, 180), 64, 64);
  if (payload.model.includes("diffusion-5")) {
    const frame = Buffer.from(encode({ event_type: "final", image }));
    const header = Buffer.alloc(4); header.writeUInt32BE(frame.length);
    return new Response(Buffer.concat([header, frame]), { status: 200, headers: { "content-type": "application/msgpack" } });
  }
  const name = Buffer.from("image.png"), header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(image.length, 18); header.writeUInt32LE(image.length, 22); header.writeUInt16LE(name.length, 26);
  const local = Buffer.concat([header, name, image]);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt32LE(image.length, 20); central.writeUInt32LE(image.length, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length, 16);
  return new Response(Buffer.concat([local, central, name, end]), { status: 200, headers: { "content-type": "application/zip" } });
};
