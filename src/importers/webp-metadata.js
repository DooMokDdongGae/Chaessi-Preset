import { parseRawJsonImport } from "./raw-json-import.js";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const require = createRequire(import.meta.url);

export function parseWebpMetadata(buffer) {
  const warnings = [];
  try {
    const chunks = readWebpChunks(buffer);
    const hasExif = chunks.some((chunk) => chunk.type === "EXIF");
    const hasXmp = chunks.some((chunk) => chunk.type === "XMP ");
    const candidates = extractWebpMetadataCandidates(buffer, chunks);
    const candidate = findJsonMetadataCandidate(candidates);

    if (!candidate) {
      return emptyWebpImportResult({
        hasExif,
        hasXmp,
        hasJsonCandidate: false,
        warnings: [
          ...warnings,
          "metadata_found_but_no_novelai_payload_detected",
        ],
      });
    }

    const parsed = parseRawJsonImport(candidate.text);
    parsed.source_type = "webp";
    parsed.metadata_source = candidate.keyword;
    parsed.detected = {
      image_type: "webp",
      has_exif: hasExif,
      has_xmp: hasXmp,
      has_json_candidate: true,
      ...parsed.detected,
    };
    parsed.warnings = [
      ...parsed.warnings,
      ...warnings,
      `Imported WEBP metadata candidate: ${candidate.keyword}.`,
    ];
    return parsed;
  } catch (error) {
    return emptyWebpImportResult({
      hasExif: false,
      hasXmp: false,
      hasJsonCandidate: false,
      warnings: [error?.message || String(error)],
    });
  }
}

export async function parseWebpMetadataAsync(buffer) {
  const baseResult = parseWebpMetadata(buffer);
  if (baseResult.detected?.has_json_candidate) return baseResult;

  const stealthResult = await extractStealthWebpMetadata(buffer);
  if (!stealthResult) return baseResult;

  try {
    const parsed = parseRawJsonImport(stealthResult.text);
    parsed.source_type = "webp";
    parsed.metadata_source = stealthResult.format;
    parsed.detected = {
      image_type: "webp",
      has_exif: Boolean(baseResult.detected?.has_exif),
      has_xmp: Boolean(baseResult.detected?.has_xmp),
      has_json_candidate: true,
      has_stealth_metadata: true,
      ...parsed.detected,
    };
    parsed.warnings = [
      ...parsed.warnings,
      ...(baseResult.warnings || []).filter((warning) => warning !== "metadata_found_but_no_novelai_payload_detected"),
      `Imported WEBP stealth metadata: ${stealthResult.format}.`,
    ];
    return parsed;
  } catch {
    return {
      ...baseResult,
      detected: {
        ...baseResult.detected,
        has_stealth_metadata: true,
      },
      warnings: [
        ...(baseResult.warnings || []),
        "WEBP stealth metadata was detected but did not contain valid JSON.",
      ],
    };
  }
}

export function isWebp(buffer) {
  return buffer.length >= 12
    && buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WEBP";
}

function emptyWebpImportResult({ hasExif, hasXmp, hasJsonCandidate, warnings }) {
  return {
    ok: true,
    source_type: "webp",
    metadata_source: hasExif || hasXmp ? "webp_exif_or_xmp" : "none",
    detected: {
      image_type: "webp",
      has_exif: hasExif,
      has_xmp: hasXmp,
      has_json_candidate: hasJsonCandidate,
      has_stealth_metadata: false,
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

async function extractStealthWebpMetadata(buffer) {
  const sharp = loadSharp();
  if (!sharp) return extractStealthWebpMetadataWithPython(buffer);

  let decoded;
  try {
    decoded = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    return extractStealthWebpMetadataWithPython(buffer);
  }
  const { data, info } = decoded;
  const { width, height, channels } = info;
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
  const startsWithMagic = (magic) => readBytes(0, magic.length).toString("utf8") === magic;
  const magic = magics.find(startsWithMagic);
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

function extractStealthWebpMetadataWithPython(buffer) {
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

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    const bundledModules = path.join(
      os.homedir(),
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "node_modules",
    );
    if (!existsSync(bundledModules)) return null;
    try {
      const sharpPath = require.resolve("sharp", { paths: [bundledModules] });
      return require(sharpPath);
    } catch {
      return null;
    }
  }
}

function extractWebpMetadataCandidates(buffer, chunks) {
  const candidates = [];
  for (const chunk of chunks) {
    if (chunk.type === "EXIF") {
      candidates.push(...extractExifTextCandidates(chunk.data));
      candidates.push({ keyword: "webp_exif_raw", text: chunk.data.toString("utf8") });
    }
    if (chunk.type === "XMP ") {
      candidates.push({ keyword: "webp_xmp", text: chunk.data.toString("utf8") });
    }
  }
  candidates.push(...extractJsonCandidatesFromBinary(buffer).map((text, index) => ({
    keyword: `webp_binary_json_${index + 1}`,
    text,
  })));
  return candidates;
}

function extractExifTextCandidates(buffer) {
  // Minimal EXIF scan: rather than interpreting every TIFF tag, collect UTF-8
  // text ranges and JSON-like substrings. This keeps the importer dependency-free
  // while still supporting UserComment/ImageDescription-style embedded payloads.
  const text = buffer.toString("utf8");
  return extractJsonCandidatesFromText(text).map((candidate, index) => ({
    keyword: `webp_exif_json_${index + 1}`,
    text: candidate,
  }));
}

function findJsonMetadataCandidate(candidates) {
  for (const item of candidates) {
    const directText = String(item.text || "").trim();
    if (isJson(directText)) return { ...item, text: directText };

    for (const candidate of extractJsonCandidatesFromText(directText)) {
      if (isJson(candidate)) return { ...item, text: candidate };
    }
  }
  return null;
}

function readWebpChunks(buffer) {
  if (!isWebp(buffer)) throw new Error("Not a WEBP file.");
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = Math.min(dataStart + size, buffer.length);
    chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) });
    offset = dataStart + size + (size % 2);
  }
  return chunks;
}

function extractJsonCandidatesFromBinary(buffer) {
  return extractJsonCandidatesFromText(buffer.toString("utf8"));
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
