const BRACKET_PATTERN = /[\[\]{}]/g;
const WEIGHT_PATTERN = /-?\d*\.?\d*::/g;

export class NovelAiT5Tokenizer {
  constructor(definition) {
    validateDefinition(definition);
    this.unknownId = definition.unknownId;
    this.eosId = definition.eosId;
    this.root = createTrie(definition.vocab, this.unknownId);
  }

  encode(text) {
    const pieces = pretokenize(text);
    return [...pieces.flatMap((piece) => encodePiece(piece, this.root, this.unknownId)), this.eosId];
  }

  count(text) {
    return this.encode(text).length;
  }
}

export async function loadNovelAiT5Tokenizer(
  assetUrl = "/assets/tokenizers/google-t5-small-vocab.json",
  fetchFn = globalThis.fetch,
) {
  if (typeof fetchFn !== "function") throw new Error("Tokenizer asset loader is unavailable.");
  const response = await fetchFn(assetUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Tokenizer asset request failed (${response.status}).`);
  return new NovelAiT5Tokenizer(await response.json());
}

export function preprocessNovelAiT5Text(text) {
  return String(text ?? "")
    .replace(BRACKET_PATTERN, "")
    .replace(WEIGHT_PATTERN, "");
}

function pretokenize(text) {
  const normalized = preprocessNovelAiT5Text(text);
  if (normalized === "") return [];
  return normalized.split(/\s+/u).map((word) => `▁${word}`);
}

function createTrie(vocab, unknownId) {
  const root = createTrieNode();
  vocab.forEach(([piece, score], id) => {
    if (id <= unknownId || piece.startsWith("<extra_id_")) return;
    let node = root;
    for (const character of piece.split("")) {
      if (!node.children.has(character)) node.children.set(character, createTrieNode());
      node = node.children.get(character);
    }
    node.token = { id, score };
  });
  return root;
}

function createTrieNode() {
  return { children: new Map(), token: null };
}

function encodePiece(text, root, unknownId) {
  const characters = text.split("");
  const best = Array(characters.length + 1).fill(null);
  best[0] = { score: 0, ids: [] };

  for (let start = 0; start < characters.length; start += 1) {
    if (!best[start]) continue;
    let node = root;
    let matched = false;
    for (let end = start; end < characters.length; end += 1) {
      node = node.children.get(characters[end]);
      if (!node) break;
      if (!node.token) continue;
      matched = true;
      const next = end + 1;
      const candidate = {
        score: best[start].score + node.token.score,
        ids: [...best[start].ids, node.token.id],
      };
      if (!best[next] || candidate.score > best[next].score) best[next] = candidate;
    }

    if (!matched || !best[start + 1]) {
      const candidate = {
        score: best[start].score,
        ids: [...best[start].ids, unknownId],
      };
      if (!best[start + 1] || candidate.score > best[start + 1].score) {
        best[start + 1] = candidate;
      }
    }
  }

  return best[characters.length]?.ids ?? [unknownId];
}

function validateDefinition(definition) {
  if (!definition || definition.schema !== "chaessi-tokenizer-vocab/v1") {
    throw new Error("Unsupported tokenizer asset.");
  }
  if (!Array.isArray(definition.vocab) || !definition.vocab.length) {
    throw new Error("Tokenizer vocabulary is empty.");
  }
  if (!Number.isInteger(definition.unknownId) || !Number.isInteger(definition.eosId)) {
    throw new Error("Tokenizer special token IDs are invalid.");
  }
}