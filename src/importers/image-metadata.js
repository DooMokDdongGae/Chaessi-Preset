import { parseNovelAiPngMetadata } from "./nai-metadata.js";
import { isWebp, parseWebpMetadataAsync } from "./webp-metadata.js";

export async function parseImageMetadata(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  const imageType = detectImageType(buffer);
  if (imageType === "png") return parseNovelAiPngMetadata(buffer);
  if (imageType === "webp") return await parseWebpMetadataAsync(buffer);
  if (imageType === "jpeg") return emptyUnsupportedResult({
    imageType,
    warning: "JPEG EXIF/XMP metadata import is not implemented yet.",
  });
  return emptyUnsupportedResult({
    imageType: "unknown",
    warning: "Unsupported image type for metadata import.",
  });
}

export function detectImageType(buffer) {
  if (isPng(buffer)) return "png";
  if (isWebp(buffer)) return "webp";
  if (isJpeg(buffer)) return "jpeg";
  return "unknown";
}

function isPng(buffer) {
  return buffer.length >= 8 && buffer.toString("hex", 0, 8) === "89504e470d0a1a0a";
}

function isJpeg(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function emptyUnsupportedResult({ imageType, warning }) {
  return {
    ok: true,
    source_type: imageType,
    metadata_source: "none",
    detected: {
      image_type: imageType,
      has_exif: false,
      has_xmp: false,
      has_json_candidate: false,
      has_raw_payload: false,
      has_v4_prompt: false,
      has_v4_negative_prompt: false,
      has_character_prompts: false,
      has_params: false,
    },
    parsed: {
      base_prompt: "",
      undesired: "",
      characters: [],
      params: {},
      raw_payload: null,
    },
    warnings: [warning],
  };
}
