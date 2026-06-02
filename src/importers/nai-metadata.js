import { gunzipSync, inflateSync } from "node:zlib";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { parseRawJsonImport } from "./raw-json-import.js";

export function parseNovelAiPngMetadata(buffer) {
  const warnings = [];
  try {
    const metadata = readPngMetadataChunks(buffer);
    const texts = Object.entries(metadata.text).map(([keyword, text]) => ({ keyword, text }));
    const candidate = findMetadataCandidate(texts);
    const hasPngTextChunks = texts.length > 0;

    if (candidate) {
      const parsed = parseRawJsonImport(candidate.text);
      parsed.source_type = "novelai_png";
      parsed.metadata_source = candidate.keyword.startsWith("png_") ? candidate.keyword : `png_text:${candidate.keyword}`;
      parsed.detected = {
        image_type: "png",
        has_png_text_chunks: hasPngTextChunks,
        has_exif: metadata.hasExif,
        has_json_candidate: true,
        ...parsed.detected,
      };
      parsed.warnings = [
        ...parsed.warnings,
        ...warnings,
        `Imported PNG metadata candidate: ${candidate.keyword}.`,
      ];
      return parsed;
    }

    const stealthCandidate = extractStealthPngMetadata(buffer);
    if (stealthCandidate) {
      try {
        const parsed = parseRawJsonImport(stealthCandidate.text);
        parsed.source_type = "novelai_png";
        parsed.metadata_source = stealthCandidate.format;
        parsed.detected = {
          image_type: "png",
          has_png_text_chunks: hasPngTextChunks,
          has_exif: metadata.hasExif,
          has_json_candidate: true,
          has_stealth_metadata: true,
          ...parsed.detected,
        };
        parsed.warnings = [
          ...parsed.warnings,
          ...warnings,
          `Imported PNG stealth metadata: ${stealthCandidate.format}.`,
        ];
        return parsed;
      } catch {
        return emptyPngImportResult({
          hasPngTextChunks,
          hasExif: metadata.hasExif,
          hasStealthMetadata: true,
          warnings: [
            ...warnings,
            "PNG stealth metadata was detected but did not contain valid JSON.",
          ],
        });
      }
    }

    if (!candidate) {
      return emptyPngImportResult({
        hasPngTextChunks,
        hasExif: metadata.hasExif,
        hasStealthMetadata: false,
        warnings: [
          ...warnings,
          hasPngTextChunks
            ? "PNG text chunks were found, but no JSON metadata candidate was detected."
            : "No PNG text chunks found.",
          metadata.hasExif
            ? "PNG eXIf chunk was found, but no NovelAI JSON metadata candidate was detected."
            : "No PNG eXIf chunk found.",
          "No PNG stealth metadata detected.",
        ],
      });
    }
  } catch (error) {
    return emptyPngImportResult({
      hasPngTextChunks: false,
      hasExif: false,
      hasStealthMetadata: false,
      warnings: [
        error?.message || String(error),
      ],
    });
  }
}

function emptyPngImportResult({ hasPngTextChunks, hasExif = false, hasStealthMetadata = false, warnings }) {
  return {
    ok: true,
    source_type: "novelai_png",
    metadata_source: hasPngTextChunks ? "png_text" : hasExif ? "png_exif" : hasStealthMetadata ? "png_stealth" : "none",
    detected: {
      image_type: "png",
      has_png_text_chunks: hasPngTextChunks,
      has_exif: hasExif,
      has_json_candidate: false,
      has_stealth_metadata: hasStealthMetadata,
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
    warnings,
  };
}

function findMetadataCandidate(texts) {
  const preferredKeywords = ["Comment", "Description", "UserComment", "ImageDescription", "parameters", "Software", "Generation Data"];
  const ordered = [
    ...preferredKeywords.flatMap((keyword) => texts.filter((item) => item.keyword === keyword)),
    ...texts.filter((item) => !preferredKeywords.includes(item.keyword)),
  ];

  for (const item of ordered) {
    const text = String(item.text || "").trim();
    if (!looksJsonLike(text)) continue;
    try {
      JSON.parse(text);
      return item;
    } catch {
      continue;
    }
  }
  return null;
}

function looksJsonLike(value) {
  return value.startsWith("{") || value.startsWith("[");
}

function readPngMetadataChunks(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (!isPng(buffer)) {
    throw new Error("Not a PNG file.");
  }

  const text = {};
  let hasExif = false;
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > buffer.length) break;
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "tEXt") {
      const nul = data.indexOf(0);
      if (nul > 0) {
        text[data.subarray(0, nul).toString("latin1")] = data.subarray(nul + 1).toString("utf8");
      }
    }
    if (type === "zTXt") {
      const nul = data.indexOf(0);
      if (nul > 0 && data[nul + 1] === 0) {
        text[data.subarray(0, nul).toString("latin1")] = inflateSync(data.subarray(nul + 2)).toString("utf8");
      }
    }
    if (type === "iTXt") {
      const parsed = parseInternationalText(data);
      if (parsed) text[parsed.keyword] = parsed.text;
    }
    if (type === "eXIf") {
      hasExif = true;
      Object.assign(text, parseExif(data));
      extractJsonCandidatesFromText(data.toString("utf8")).forEach((candidate, index) => {
        text[`png_exif_json_${index + 1}`] = candidate;
      });
    }
    if (type === "IEND") break;
    offset = dataEnd + 4;
  }
  extractJsonCandidatesFromText(buffer.toString("utf8")).forEach((candidate, index) => {
    text[`png_binary_json_${index + 1}`] = candidate;
  });
  return { text, hasExif };
}

function parseInternationalText(data) {
  const nul = data.indexOf(0);
  if (nul <= 0 || nul + 2 >= data.length) return null;
  const keyword = data.subarray(0, nul).toString("latin1");
  const compressionFlag = data[nul + 1];
  const compressionMethod = data[nul + 2];
  let cursor = nul + 3;
  const languageEnd = data.indexOf(0, cursor);
  if (languageEnd < 0) return null;
  cursor = languageEnd + 1;
  const translatedEnd = data.indexOf(0, cursor);
  if (translatedEnd < 0) return null;
  cursor = translatedEnd + 1;
  const rawText = data.subarray(cursor);
  const text = compressionFlag === 1 && compressionMethod === 0
    ? inflateSync(rawText).toString("utf8")
    : rawText.toString("utf8");
  return { keyword, text };
}

function isPng(buffer) {
  return buffer.length >= 8 && buffer.toString("hex", 0, 8) === "89504e470d0a1a0a";
}

function parseExif(data) {
  const text = {};
  if (!data || data.length < 8) return text;
  const byteOrder = data.toString("ascii", 0, 2);
  const little = byteOrder === "II";
  if (!little && byteOrder !== "MM") return text;
  const read16 = (pos) => little ? data.readUInt16LE(pos) : data.readUInt16BE(pos);
  const read32 = (pos) => little ? data.readUInt32LE(pos) : data.readUInt32BE(pos);

  const parseIfd = (ifdOffset, depth = 0) => {
    if (depth > 2 || ifdOffset < 0 || ifdOffset + 2 > data.length) return;
    const entries = read16(ifdOffset);
    for (let index = 0; index < entries; index += 1) {
      const entry = ifdOffset + 2 + index * 12;
      if (entry + 12 > data.length) return;
      const tag = read16(entry);
      const format = read16(entry + 2);
      const count = read32(entry + 4);
      const valueOffset = read32(entry + 8);
      const bytesPerFormat = { 1: 1, 2: 1, 7: 1 }[format] || 1;
      const byteLength = count * bytesPerFormat;
      const valueStart = byteLength <= 4 ? entry + 8 : valueOffset;
      if (valueStart < 0 || valueStart + byteLength > data.length) continue;
      const rawValue = data.subarray(valueStart, valueStart + byteLength);
      const value = decodeExifText(rawValue);
      if (tag === 0x010e) text.ImageDescription = value;
      if (tag === 0x9286) text.UserComment = value;
      if (tag === 0x8769) parseIfd(valueOffset, depth + 1);
    }
  };

  parseIfd(read32(4));
  return text;
}

function decodeExifText(bytes) {
  const asciiPrefix = "ASCII\0\0\0";
  const unicodePrefix = "UNICODE\0";
  const raw = bytes.toString("utf8").replace(/\0+$/g, "");
  if (raw.startsWith(asciiPrefix)) return raw.slice(asciiPrefix.length).replace(/\0+$/g, "");
  if (raw.startsWith(unicodePrefix)) {
    try {
      return new TextDecoder("utf-16be").decode(bytes.subarray(unicodePrefix.length)).replace(/\0+$/g, "");
    } catch {
      return raw.slice(unicodePrefix.length).replace(/\0+$/g, "");
    }
  }
  return raw;
}

function extractJsonCandidatesFromText(text) {
  const candidates = [];
  const needles = ['{"input"', '{"prompt"', '{"v4_prompt"', '{"raw_payload"', '{"generation"', '{"parameters"'];
  for (const needle of needles) {
    let start = text.indexOf(needle);
    while (start >= 0) {
      const candidate = extractBalancedJson(text, start);
      if (candidate) candidates.push(candidate);
      start = text.indexOf(needle, start + needle.length);
    }
  }
  return [...new Set(candidates)];
}

function extractBalancedJson(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") inString = true;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const candidate = text.slice(start, index + 1);
        return isJson(candidate) ? candidate : null;
      }
    }
  }
  return null;
}

function isJson(value) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function extractStealthPngMetadata(buffer) {
  const decoded = decodePngRgbaPixels(buffer);
  if (decoded) {
    const result = extractStealthMetadataFromRgba(decoded);
    if (result) return result;
  }

  const scriptPath = fileURLToPath(new URL("./webp-stealth-extract.py", import.meta.url));
  if (!existsSync(scriptPath)) return null;

  for (const pythonPath of getPythonCandidates()) {
    const result = spawnSync(pythonPath, [scriptPath], {
      input: buffer,
      encoding: "utf8",
      maxBuffer: 25 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.error || result.status !== 0) continue;
    try {
      const parsed = JSON.parse(result.stdout || "null");
      if (parsed?.format && typeof parsed.text === "string") return parsed;
      if (parsed === null) return null;
    } catch {
      // Try the next Python candidate.
    }
  }
  return null;
}

function decodePngRgbaPixels(buffer) {
  try {
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    const idatParts = [];
    let offset = 8;
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd > buffer.length) break;
      const data = buffer.subarray(dataStart, dataEnd);
      if (type === "IHDR") {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        bitDepth = data[8];
        colorType = data[9];
        interlace = data[12];
      }
      if (type === "IDAT") idatParts.push(data);
      if (type === "IEND") break;
      offset = dataEnd + 4;
    }

    if (!width || !height || bitDepth !== 8 || colorType !== 6 || interlace !== 0 || !idatParts.length) {
      return null;
    }

    const inflated = inflateSync(Buffer.concat(idatParts));
    const channels = 4;
    const bytesPerPixel = 4;
    const stride = width * channels;
    const output = Buffer.alloc(stride * height);
    let sourceOffset = 0;
    for (let y = 0; y < height; y += 1) {
      const filter = inflated[sourceOffset];
      sourceOffset += 1;
      const row = inflated.subarray(sourceOffset, sourceOffset + stride);
      sourceOffset += stride;
      const outStart = y * stride;
      const priorStart = (y - 1) * stride;
      for (let x = 0; x < stride; x += 1) {
        const raw = row[x];
        const left = x >= bytesPerPixel ? output[outStart + x - bytesPerPixel] : 0;
        const up = y > 0 ? output[priorStart + x] : 0;
        const upLeft = y > 0 && x >= bytesPerPixel ? output[priorStart + x - bytesPerPixel] : 0;
        output[outStart + x] = (raw + pngFilterPredictor(filter, left, up, upLeft)) & 0xff;
      }
    }
    return { data: output, width, height, channels };
  } catch {
    return null;
  }
}

function pngFilterPredictor(filter, left, up, upLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  if (filter === 4) return paethPredictor(left, up, upLeft);
  return 0;
}

function paethPredictor(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function extractStealthMetadataFromRgba({ data, width, height, channels }) {
  if (!width || !height || channels < 4) return null;
  const magics = ["stealth_pngcomp", "stealth_pnginfo"];
  const readBit = (bitIndex) => {
    const x = Math.floor(bitIndex / height);
    const y = bitIndex % height;
    if (x >= width) throw new Error("Stealth metadata is truncated.");
    return data[(y * width + x) * channels + 3] & 1;
  };
  const readBytes = (bitOffset, byteLength) => {
    const output = Buffer.alloc(byteLength);
    for (let byteIndex = 0; byteIndex < byteLength; byteIndex += 1) {
      let value = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value << 1) | readBit(bitOffset + byteIndex * 8 + bit);
      }
      output[byteIndex] = value;
    }
    return output;
  };
  const magic = magics.find((candidate) => readBytes(0, candidate.length).toString("utf8") === candidate);
  if (!magic) return null;

  const payloadBitLength = readBytes(magic.length * 8, 4).readUInt32BE(0);
  const payloadByteLength = Math.ceil(payloadBitLength / 8);
  const payloadBitOffset = magic.length * 8 + 32;
  if (payloadBitOffset + payloadBitLength > width * height) return null;

  const payloadBytes = readBytes(payloadBitOffset, payloadByteLength);
  const text = magic === "stealth_pngcomp"
    ? gunzipSync(payloadBytes).toString("utf8")
    : payloadBytes.toString("utf8");
  return {
    format: magic,
    text: text.replace(/\0+$/g, ""),
  };
}

function getPythonCandidates() {
  const candidates = [
    process.env.CHAESSI_PYTHON,
    "python",
    path.join(
      os.homedir(),
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "python",
      "python.exe",
    ),
  ].filter(Boolean);
  return [...new Set(candidates)];
}
