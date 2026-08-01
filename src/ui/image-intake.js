const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

export async function inspectImageFiles(files, options = {}) {
  const input = [...(files || [])];
  if (!input.length) throw new Error("Choose at least one image.");
  const items = [];
  try {
    for (const file of input) items.push(await inspectImageFile(file, options));
    return items;
  } catch (error) {
    releaseImageIntakeItems(items);
    throw error;
  }
}

export async function inspectImageFile(file, {
  source = "file-picker",
  inspectMetadata,
  createPreview = true,
  decodeImage = decodeImageDimensions,
} = {}) {
  if (!(file instanceof Blob)) throw new Error("The selected item is not an image file.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be smaller than 30 MB.");
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mimeType = detectImageMimeFromBytes(header);
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) throw new Error("Use a PNG, WebP, or JPEG image.");
  const fileName = safeImageFileName(file.name, mimeType);
  const normalizedFile = file.type === mimeType && file.name === fileName
    ? file
    : new File([file], fileName, { type: mimeType, lastModified: file.lastModified || Date.now() });
  const dimensions = await decodeImage(normalizedFile);
  if (!dimensions.width || !dimensions.height) throw new Error("Image dimensions could not be read.");
  let metadata = null;
  let metadataError = "";
  if (inspectMetadata) {
    try {
      metadata = await inspectMetadata(normalizedFile);
    } catch (error) {
      metadataError = String(error?.message || "Metadata could not be inspected.");
    }
  }
  return {
    file: normalizedFile,
    mimeType,
    fileName,
    byteLength: normalizedFile.size,
    width: dimensions.width,
    height: dimensions.height,
    source,
    metadata,
    metadataError,
    previewUrl: createPreview ? URL.createObjectURL(normalizedFile) : "",
  };
}

export function releaseImageIntakeItems(items) {
  for (const item of items || []) {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item) item.previewUrl = "";
  }
}

export function detectImageMimeFromBytes(bytes) {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (value.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => value[index] === byte)) return "image/png";
  if (value.length >= 12 && ascii(value, 0, 4) === "RIFF" && ascii(value, 8, 12) === "WEBP") return "image/webp";
  if (value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff) return "image/jpeg";
  return "";
}

export function hasImportableNovelAiMetadata(result) {
  if (!result?.ok || !result?.parsed) return false;
  const detected = result.detected || {};
  if (detected.has_raw_payload || detected.has_v4_prompt || detected.has_v4_negative_prompt || detected.has_character_prompts || detected.has_params) return true;
  const parsed = result.parsed;
  return Boolean(parsed.base_prompt || parsed.undesired || parsed.characters?.length || Object.keys(parsed.params || {}).length);
}

export function getImageDestinationAvailability(itemCount, preciseReferenceCapacity) {
  const multiple = Number(itemCount) > 1;
  return {
    imageToImage: !multiple,
    inpaint: !multiple,
    preciseReference: itemCount > 0 && itemCount <= preciseReferenceCapacity,
  };
}

export function getImageFilesFromTransfer(transfer) {
  const files = [...(transfer?.files || [])].filter((file) => file instanceof Blob);
  if (files.length) return files;
  return [...(transfer?.items || [])]
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile?.())
    .filter((file) => file instanceof Blob);
}

export function hasFileTransfer(transfer) {
  return [...(transfer?.types || [])].includes("Files");
}


async function decodeImageDimensions(file) {
  const bitmap = await createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function safeImageFileName(value, mimeType) {
  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
  const cleaned = String(value || "clipboard-image")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .trim()
    .slice(0, 160);
  return cleaned || `image${extension}`;
}

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}
