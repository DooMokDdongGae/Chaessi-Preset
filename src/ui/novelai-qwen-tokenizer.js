const DEFAULT_ASSET = "/assets/tokenizers/qwen35-tokenizer.deflate";

export async function loadNovelAiQwenTokenizer(assetUrl = DEFAULT_ASSET) {
  const response = await fetch(assetUrl);
  if (!response.ok) throw new Error(`Could not load V5 tokenizer asset (${response.status}).`);
  if (typeof DecompressionStream !== "function") throw new Error("This runtime cannot decompress the packaged V5 tokenizer.");
  const stream = response.body.pipeThrough(new DecompressionStream("deflate-raw"));
  const definition = JSON.parse(new TextDecoder().decode(await new Response(stream).arrayBuffer()));
  return new NovelAiQwenTokenizer(definition);
}

export class NovelAiQwenTokenizer {
  constructor(definition) {
    if (!definition?.vocab || !Array.isArray(definition?.merges) || !definition?.config?.splitRegex) {
      throw new Error("Unsupported V5 tokenizer asset.");
    }
    this.encoder = Object.assign(Object.create(null), definition.vocab);
    this.specials = Object.create(null);
    for (const token of definition.specialTokens || []) this.specials[token] = this.encoder[token];
    this.config = definition.config;
    this.cache = new Map();
    this.splitRegex = new RegExp(this.config.splitRegex, "gu");
    this.bpeRanks = new Map(definition.merges.map((pair, index) => [`${pair[0]}\0${pair[1]}`, index]));
    this.byteToChar = makeByteEncoder();
    this.specialTokens = Object.keys(this.specials).sort((a, b) => b.length - a.length);
  }

  count(text) { return this.encode(text).length; }

  encode(value) {
    let text = String(value ?? "");
    if (this.config.normalization) text = text.normalize(this.config.normalization);
    const ids = [];
    for (const part of splitSpecialTokens(text, this.specialTokens)) {
      if (Object.hasOwn(this.specials, part)) { ids.push(this.specials[part]); continue; }
      for (const match of part.matchAll(this.splitRegex)) {
        const unicode = [...new TextEncoder().encode(match[0])].map((byte) => this.byteToChar[byte]).join("");
        ids.push(...this.toBpe(unicode));
      }
    }
    return ids;
  }

  toBpe(token) {
    if (this.config.ignoreMerges && this.encoder[token] !== undefined) return [this.encoder[token]];
    if (this.cache.has(token)) return this.cache.get(token);
    let parts = [...token];
    while (parts.length > 1) {
      let bestRank = Infinity;
      let bestIndex = -1;
      for (let index = 0; index < parts.length - 1; index += 1) {
        const rank = this.bpeRanks.get(`${parts[index]}\0${parts[index + 1]}`);
        if (rank !== undefined && rank < bestRank) { bestRank = rank; bestIndex = index; }
      }
      if (bestIndex < 0) break;
      const left = parts[bestIndex];
      const right = parts[bestIndex + 1];
      const merged = [];
      for (let index = 0; index < parts.length;) {
        if (parts[index] === left && parts[index + 1] === right) { merged.push(left + right); index += 2; }
        else { merged.push(parts[index]); index += 1; }
      }
      parts = merged;
    }
    const ids = parts.flatMap((part) => this.encoder[part] !== undefined ? [this.encoder[part]] : []);
    this.cache.set(token, ids);
    return ids;
  }
}

function splitSpecialTokens(text, specials) {
  if (!specials.length) return [text];
  const pattern = new RegExp(`(${specials.map(escapeRegex).join("|")})`, "g");
  return text.split(pattern).filter(Boolean);
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function makeByteEncoder() {
  const bytes = [...range(33, 127), ...range(161, 173), ...range(174, 256)];
  const codepoints = [...bytes];
  let extra = 0;
  for (let byte = 0; byte < 256; byte += 1) if (!bytes.includes(byte)) { bytes.push(byte); codepoints.push(256 + extra); extra += 1; }
  return Object.fromEntries(bytes.map((byte, index) => [byte, String.fromCodePoint(codepoints[index])]));
}

function range(start, end) { return Array.from({ length: end - start }, (_, index) => start + index); }
