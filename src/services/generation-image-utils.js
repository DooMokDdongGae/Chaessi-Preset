import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_PIXELS = 4_194_304;
const PRESERVED_METADATA_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf"]);

export function decodeBase64Png(value, label) {
  const text = String(value || "").trim();
  const clean = text.includes(",") ? text.slice(text.indexOf(",") + 1) : text;
  if (!clean || !/^[A-Za-z0-9+/=\r\n]+$/.test(clean)) throw imageError(`${label} must be base64 PNG data.`);
  const bytes = Buffer.from(clean, "base64");
  const size = readPngSize(bytes, label);
  return { bytes, ...size };
}

export function readPngSize(bytes, label = "image") {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE) || buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw imageError(`${label} must be a PNG image.`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height) throw imageError(`${label} dimensions are invalid.`);
  if (width * height > MAX_IMAGE_PIXELS) {
    throw imageError(`${label} is too large. Use an image with 4,194,304 pixels or fewer.`);
  }
  return { width, height };
}

export function assertMatchingDimensions(source, mask, width, height) {
  if (source.width !== width || source.height !== height) {
    throw imageError(`Source image dimensions ${source.width}x${source.height} do not match transmitted ${width}x${height}.`);
  }
  if (mask && (mask.width !== width || mask.height !== height)) {
    throw imageError(`Mask dimensions ${mask.width}x${mask.height} do not match source image ${width}x${height}.`);
  }
}

export function assertMaskHasPaintedPixels(maskBytes) {
  const decoded = decodePngPixels(maskBytes, "mask image");
  const mask = pngPixelsToMask(decoded);
  if (mask.some((value) => value > 0)) return;
  throw imageError("Inpaint mask is empty. Paint at least one area before generating.");
}

export function normalizePngToRgb(bytes, label = "image") {
  const decoded = decodePngPixels(bytes, label);
  return encodeRgbPng(pngPixelsToRgb(decoded), decoded.width, decoded.height);
}

export function decodePngPixels(bytes, label = "image") {
  const buffer = Buffer.from(bytes);
  const { width, height } = readPngSize(buffer, label);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const channels = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]).get(colorType);
  if (bitDepth !== 8 || !channels) throw imageError(`${label} must use 8-bit grayscale or RGB pixels.`);
  if (buffer[28] !== 0) throw imageError(`${label} must be a non-interlaced PNG.`);

  const idat = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idat.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
    if (type === "IEND") break;
  }
  if (!idat.length) throw imageError(`${label} has no image data.`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length !== (stride + 1) * height) throw imageError(`${label} pixel data is incomplete.`);
  const pixels = Buffer.alloc(stride * height);
  let rawOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[rawOffset + x];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      pixels[y * stride + x] = unfilter(filter, value, left, up, upperLeft);
    }
    rawOffset += stride;
  }
  return { pixels, width, height, colorType, bytesPerPixel: channels };
}

export function pngPixelsToRgb(decoded) {
  const rgb = Buffer.alloc(decoded.width * decoded.height * 3);
  for (let index = 0; index < decoded.width * decoded.height; index += 1) {
    const sourceOffset = index * decoded.bytesPerPixel;
    const targetOffset = index * 3;
    if (decoded.colorType === 0 || decoded.colorType === 4) {
      rgb[targetOffset] = decoded.pixels[sourceOffset];
      rgb[targetOffset + 1] = decoded.pixels[sourceOffset];
      rgb[targetOffset + 2] = decoded.pixels[sourceOffset];
    } else {
      rgb[targetOffset] = decoded.pixels[sourceOffset];
      rgb[targetOffset + 1] = decoded.pixels[sourceOffset + 1];
      rgb[targetOffset + 2] = decoded.pixels[sourceOffset + 2];
    }
  }
  return rgb;
}

export function pngPixelsToAlpha(decoded) {
  const alpha = Buffer.alloc(decoded.width * decoded.height, 255);
  if (decoded.colorType !== 4 && decoded.colorType !== 6) return alpha;
  for (let index = 0; index < decoded.width * decoded.height; index += 1) {
    alpha[index] = decoded.pixels[index * decoded.bytesPerPixel + decoded.bytesPerPixel - 1];
  }
  return alpha;
}

export function pngPixelsToMask(decoded) {
  const mask = Buffer.alloc(decoded.width * decoded.height);
  const alpha = pngPixelsToAlpha(decoded);
  for (let index = 0; index < decoded.width * decoded.height; index += 1) {
    const offset = index * decoded.bytesPerPixel;
    const value = decoded.colorType === 0 || decoded.colorType === 4
      ? decoded.pixels[offset]
      : Math.max(decoded.pixels[offset], decoded.pixels[offset + 1], decoded.pixels[offset + 2]);
    mask[index] = Math.round((value * alpha[index]) / 255);
  }
  return mask;
}

export function encodeRgbPng(rgb, width, height, { metadataSourceBytes } = {}) {
  const expectedLength = width * height * 3;
  if (rgb.length !== expectedLength) throw imageError("RGB pixel data length does not match image dimensions.");
  const rgbBuffer = Buffer.from(rgb);
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const targetOffset = y * (stride + 1);
    raw[targetOffset] = 0;
    rgbBuffer.copy(raw, targetOffset + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    ...extractMetadataChunks(metadataSourceBytes),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function extractMetadataChunks(bytes) {
  if (!bytes) return [];
  const buffer = Buffer.from(bytes);
  if (buffer.length < 12 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return [];
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) break;
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (PRESERVED_METADATA_CHUNKS.has(type)) chunks.push(buffer.subarray(offset, end));
    offset = end;
    if (type === "IEND") break;
  }
  return chunks;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return result;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function unfilter(filter, value, left, up, upperLeft) {
  if (filter === 0) return value;
  if (filter === 1) return (value + left) & 255;
  if (filter === 2) return (value + up) & 255;
  if (filter === 3) return (value + Math.floor((left + up) / 2)) & 255;
  if (filter === 4) return (value + paeth(left, up, upperLeft)) & 255;
  throw imageError(`Unsupported PNG filter type ${filter}.`);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function imageError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.type = "invalid_generation_image";
  error.publicMessage = message;
  return error;
}
