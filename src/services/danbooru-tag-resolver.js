import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const CLASSIFIED_FILES = new Set([
  "action", "attire", "character", "count", "expression", "feature", "meme",
  "meta", "object", "other", "series", "setting", "style",
]);

export async function loadDanbooruTagResolver({ classifiedDir, ragCsvPath }) {
  const tagMap = new Map();
  const aliasMap = new Map();
  const requirements = new Map();

  if (classifiedDir) {
    const entries = await readdir(classifiedDir, { withFileTypes: true });
    for (const entry of entries) {
      const category = path.basename(entry.name, ".csv");
      if (!entry.isFile() || !entry.name.endsWith(".csv") || !CLASSIFIED_FILES.has(category)) continue;
      const rows = parseCsv(await readFile(path.join(classifiedDir, entry.name), "utf8"));
      for (const row of rows.slice(1)) addTag(tagMap, row[0], "classified", category, Number(row[1]) || 0);
    }
    const requiringPath = path.join(classifiedDir, "requiring.txt");
    try {
      const lines = (await readFile(requiringPath, "utf8")).split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const item = JSON.parse(line);
        requirements.set(normalizeTag(item.tag), (item.required_attires || []).map(normalizeTag));
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  if (ragCsvPath) {
    const rows = parseCsv(await readFile(ragCsvPath, "utf8"));
    for (const row of rows.slice(1)) {
      const [name, category, count, description = ""] = row;
      const tag = addTag(tagMap, name, "rag", category, Number(count) || 0);
      if (!tag) continue;
      const semanticCategory = inferRagCategory(description);
      if (semanticCategory) tag.categories.add(semanticCategory);
      for (const alias of extractAliases(description)) {
        const key = normalizeLookup(alias);
        if (!key) continue;
        if (!aliasMap.has(key)) aliasMap.set(key, new Set());
        aliasMap.get(key).add(tag.name);
      }
    }
  }

  return createDanbooruTagResolver({ tagMap, aliasMap, requirements });
}

export function createDanbooruTagResolver({ tagMap = new Map(), aliasMap = new Map(), requirements = new Map() } = {}) {
  return {
    resolve(intent, { category, fallbackText } = {}) {
      const exactName = normalizeTag(intent);
      const exact = tagMap.get(exactName);
      if (exact && categoryMatches(exact, category)) {
        return {
          intent,
          tag: exact.name,
          resolution: "exact",
          sources: [...exact.sources].sort(),
          requirements: requirements.get(exact.name) || [],
        };
      }
      const aliases = [...(aliasMap.get(normalizeLookup(intent)) || [])]
        .map((name) => tagMap.get(name)).filter((tag) => tag && categoryMatches(tag, category));
      if (aliases.length === 1) {
        const tag = aliases[0];
        return {
          intent,
          tag: tag.name,
          resolution: "high",
          sources: [...tag.sources].sort(),
          requirements: requirements.get(tag.name) || [],
        };
      }
      if (aliases.length > 1 || exact) {
        return {
          intent,
          tag: null,
          resolution: "candidate",
          candidates: aliases.length ? aliases.map((tag) => tag.name) : [exact.name],
          text: fallbackText || String(intent),
        };
      }
      return { intent, tag: null, resolution: "natural-language", text: fallbackText || String(intent) };
    },

    resolvePromptFragments(text, { category } = {}) {
      const results = [];
      const output = String(text || "").split(",").map((fragment) => {
        const value = fragment.trim();
        if (!value || hasPromptSyntax(value) || looksLikeSentence(value)) return value;
        const result = this.resolve(value, { category, fallbackText: value });
        results.push(result);
        return ["exact", "high"].includes(result.resolution) ? result.tag : value;
      }).filter(Boolean).join(", ");
      return { text: output, results };
    },

    validateRequirements({ actionTags, outfitPrompt }) {
      const outfit = normalizeTag(outfitPrompt);
      const conflicts = [];
      for (const action of actionTags.map(normalizeTag)) {
        const required = requirements.get(action) || [];
        const missing = required.filter((item) => !containsTagConcept(outfit, item));
        if (missing.length) conflicts.push({
          type: "requirement-conflict",
          action,
          requires: required,
          missing,
          currentOutfit: String(outfitPrompt || ""),
        });
      }
      return conflicts;
    },

    hasTag(name, category) {
      const tag = tagMap.get(normalizeTag(name));
      return Boolean(tag && categoryMatches(tag, category));
    },
  };
}

function addTag(tagMap, rawName, source, category, count) {
  const name = normalizeTag(rawName);
  if (!name) return null;
  const item = tagMap.get(name) || { name, sources: new Set(), categories: new Set(), counts: {} };
  item.sources.add(source);
  item.categories.add(String(category));
  item.counts[source] = Math.max(item.counts[source] || 0, count || 0);
  tagMap.set(name, item);
  return item;
}

function categoryMatches(tag, expected) {
  if (!expected) return true;
  const aliases = {
    action: new Set(["action"]), attire: new Set(["attire"]),
    expression: new Set(["expression"]), camera: new Set(["camera"]),
    setting: new Set(["setting"]), style: new Set(["style"]),
  };
  const allowed = aliases[expected] || new Set([String(expected)]);
  return [...tag.categories].some((value) => allowed.has(value));
}

function inferRagCategory(description) {
  const value = String(description || "").trim();
  if (value.startsWith("[행동")) return "action";
  if (["[의상", "[복장"].some((prefix) => value.startsWith(prefix))) return "attire";
  if (["[표정", "[감정"].some((prefix) => value.startsWith(prefix))) return "expression";
  if (["[포즈/구도", "[구도", "[카메라"].some((prefix) => value.startsWith(prefix))) return "camera";
  if (["[배경", "[장소", "[환경"].some((prefix) => value.startsWith(prefix))) return "setting";
  if (["[화풍", "[스타일"].some((prefix) => value.startsWith(prefix))) return "style";
  return null;
}

function extractAliases(description) {
  const match = String(description).match(/키워드:\s*([^\n]+)/i);
  return match ? match[1].split(/[,/]/).map((value) => value.trim()).filter(Boolean) : [];
}

function containsTagConcept(prompt, required) {
  if (!required) return true;
  const escaped = required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|_)${escaped}(?:_|$)`).test(prompt);
}

function hasPromptSyntax(value) {
  return /[{}[\]|:]|^-?\d+(?:\.\d+)?::/.test(value);
}

function looksLikeSentence(value) {
  return /[.!?]$/.test(value) || value.split(/\s+/).length > 7;
}

function normalizeLookup(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeTag(value) {
  return normalizeLookup(value).replace(/\s+/g, "_");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}
