const BINARY_PART_NAMES = Object.freeze(["image", "mask"]);

export function createNovelAiMultipartBody(payload, assets = {}) {
  const body = new FormData();
  for (const partName of BINARY_PART_NAMES) {
    const bytes = assets[partName];
    if (!bytes) continue;
    body.append(partName, new Blob([bytes], { type: "image/png" }), "blob");
  }
  body.append("request", new Blob([JSON.stringify(payload)], { type: "application/json" }));
  return body;
}

export const NOVELAI_MULTIPART_BINARY_PARTS = BINARY_PART_NAMES;
