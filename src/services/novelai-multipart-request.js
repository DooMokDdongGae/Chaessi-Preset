import { createHmac, randomBytes } from "node:crypto";

const BINARY_PART_NAMES = Object.freeze(["image", "mask"]);
const cacheNamespace = randomBytes(32);

export function createNovelAiMultipartBody(payload, assets = {}) {
  const body = new FormData();
  for (const partName of BINARY_PART_NAMES) {
    const bytes = assets[partName];
    if (!bytes) continue;
    body.append(partName, new Blob([bytes], { type: "image/png" }), "blob");
  }
  let request = payload;
  if (assets.directorReferences?.length) {
    const parts = new Map();
    const cached = assets.directorReferences.map((bytes, index) => {
      const key = createHmac("sha256", cacheNamespace).update(bytes.toString("base64")).digest("hex");
      if (!parts.has(key)) {
        const name = `director_ref_${index}`;
        body.append(name, new Blob([bytes], { type: "image/png" }), "blob");
        parts.set(key, name);
      }
      return { cache_secret_key: key, data: parts.get(key) };
    });
    // Always include the bytes. No second paid request on cache expiry or an ambiguous response.
    request = { ...payload, parameters: { ...payload.parameters, director_reference_images_cached: cached } };
  }
  body.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
  return body;
}

export const NOVELAI_MULTIPART_BINARY_PARTS = BINARY_PART_NAMES;
