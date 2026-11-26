import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { decodePngPixels, encodeRgbPng, encodeRgbaPng } from "../src/services/generation-image-utils.js";
import { appendPngText, receivedImageToPng, referenceInputPng } from "../src/services/generation-png.js";
import { parseNovelAiPngMetadata } from "../src/importers/nai-metadata.js";
import { applyVibes, createVibeEncoder, prepareVibes } from "../src/services/vibe-transfer.js";
import { effectiveVibeStrengths, estimateVibeCost } from "../src/services/vibe-cost.js";
import { importVibeFile, tryImportVibeFile } from "../src/services/vibe-import.js";
import { crc32 } from "../src/image-tools/png-integrity.js";
import { redactPayloadAssets } from "../src/adapters/novelai-v45-generation-modes.js";
import { NOVELAI_V45_FULL_MODEL as model } from "../src/state/model-profiles.js";

const png = encodeRgbPng(Buffer.from([120, 50, 30]), 1, 1);
const encoding = Buffer.from("synthetic-vibe-embedding").toString("base64");
const hash = input => createHash("sha256").update(input).digest("hex");
const card = { model, encoding_base64: encoding, information_extracted: 0.7, strength: 0.8 };
const t2i = { model, mode: "text-to-image" };
const input = { model, image_base64: png.toString("base64"), information_extracted: 0.7 };

test("encode sends only pixels and extraction settings, coalesces variants and never stores files", async () => {
  const calls = [];
  const encoder = createVibeEncoder({ getToken: () => "fixture-only", fetchImpl: async (url, options) => {
    assert.equal(url, "https://image.novelai.net/ai/encode-vibe");
    const payload = JSON.parse(options.body);
    assert.deepEqual(Object.keys(payload).sort(), ["image", "information_extracted", "model"]);
    assert.equal(payload.model, model);
    assert.ok(!Buffer.from(payload.image, "base64").includes("fixture-private-metadata"));
    calls.push(payload.information_extracted);
    return new Response(Buffer.from(encoding, "base64"), { status: 201, headers: { "Content-Type": "application/binary" } });
  } });
  const tagged = appendPngText(png, "Comment", "fixture-private-metadata").toString("base64");
  const first = await Promise.all([encoder.encode(input), encoder.encode({ ...input, image_base64: tagged })]);
  assert.deepEqual(calls, [0.7]);
  assert.deepEqual(first.map(item => item.encoding_anlas).sort(), [0, 2]);
  assert.equal((await encoder.encode({ ...input, strength: 0.45 })).encoding_anlas, 0);
  assert.equal((await encoder.encode({ ...input, information_extracted: 0.25 })).encoding_anlas, 2);
  assert.equal((await encoder.encode(input)).encoding_anlas, 0);
  assert.deepEqual(calls, [0.7, 0.25]);
});

test("invalid or interrupted encoding has no automatic retry or cached failure", async () => {
  let calls = 0;
  const encoder = createVibeEncoder({ getToken: () => "fixture-only", fetchImpl: async () => {
    calls++;
    throw new Error("fixture timeout");
  } });
  for (const overrides of [{ model: "nai-diffusion-5-full" }, { information_extracted: 4 }, { image_base64: "not an image" }]) {
    await assert.rejects(encoder.encode({ ...input, ...overrides }));
  }
  assert.equal(calls, 0);
  await assert.rejects(encoder.encode(input), /balance/);
  assert.equal(calls, 1);
  await assert.rejects(encoder.encode(input), /balance/);
  assert.equal(calls, 2);
});

test("encoded-vibe request follows card order and official multi-strength normalization", () => {
  const refs = [card, { ...card, strength: -0.4 }, { ...card, strength: 0.8 }];
  const selection = prepareVibes({ ...t2i, references: refs });
  const payload = applyVibes({ model, parameters: { seed: 3 } }, selection);
  assert.deepEqual(payload.parameters.reference_image_multiple, refs.map(ref => ref.encoding_base64));
  assert.deepEqual(payload.parameters.reference_strength_multiple, [0.4, -0.2, 0.4]);
  assert.equal(payload.parameters.normalize_reference_strength_multiple, true);
  assert.equal(payload.parameters.reference_information_extracted_multiple, undefined);
  assert.deepEqual(effectiveVibeStrengths([2.5], true), [2.5]);
  assert.deepEqual(effectiveVibeStrengths([0, 0], true), [0, 0]);
  assert.deepEqual(effectiveVibeStrengths([0.2, 0.3], true), [0.2, 0.3]);
  assert.deepEqual(effectiveVibeStrengths([-2.5, 2.5], false), [-2.5, 2.5]);
  const redacted = redactPayloadAssets(payload);
  assert.ok(!JSON.stringify(redacted).includes(encoding));
  assert.equal(redacted.parameters.reference_image_multiple[0].sha256, hash(Buffer.from(encoding, "base64")));
  assert.equal(payload.parameters.reference_image_multiple[0], encoding);
});

test("unsupported actions, models, malformed cards, duplicate feature families and oversize selections fail locally", () => {
  for (const overrides of [{ model: "nai-diffusion-5-full" }, { mode: "inpaint" }, { mode: "image-to-image" },
    { references: Array(17).fill(card) }, { references: [{...card, strength: Infinity}] },
    { references: [{...card, information_extracted: 2}] }, { references: [{...card, encoding_base64: "invalid"}] },
    { preciseCount: 1 }, { normalize: "true" }]) {
    assert.throws(() => prepareVibes({ ...t2i, references: [card], ...overrides }));
  }
  assert.equal(prepareVibes({ model: "nai-diffusion-5-full", mode: "inpaint", references: [] }), null);
});

test("V4.5 cost uses the pre-V5 base, sampler and Opus allowance; Vibe surcharge survives free base", () => {
  const params = { width: 832, height: 1216, steps: 23 };
  assert.deepEqual(estimateVibeCost(params, 5), { base: 17, surcharge: 2, total: 19, allowanceTotal: 2, conditional: true });
  assert.equal(estimateVibeCost(params, 16, true).total, 24);
  assert.equal(estimateVibeCost({ ...params, sm: true, sm_dyn: true }, 1, false).total, 24);
  assert.equal(estimateVibeCost({ ...params, steps: 30 }, 1, true).total, 21);
});

function exported(type) {
  const original = png.toString("base64");
  const key = type === "encoding" ? "unknown" : hash("information_extracted:0.7");
  return { identifier: "novelai-vibe-transfer", version: 1, type, name: "fixture",
    id: hash(type === "encoding" ? encoding : original),
    ...(type === "image" && { image: original, thumbnail: "data:image/png;base64," + original }),
    encodings: { "v4-5full": { [key]: { params: { information_extracted: 0.7 }, encoding } } },
    importInfo: { model, information_extracted: 0.7, strength: -0.2 } };
}

test("official single and bundle include original, thumbnail and cache or an immutable encoding-only card", async () => {
  const bundle = { identifier: "novelai-vibe-transfer-bundle", version: 1, vibes: [exported("image"), exported("encoding")] };
  const cards = await importVibeFile(new File([JSON.stringify(bundle)], "fixture.naiv4vibebundle"));
  assert.equal(cards.length, 2);
  assert.equal(cards[0].original.type, "image/png");
  assert.deepEqual(Buffer.from(await cards[0].thumbnail.arrayBuffer()), png);
  assert.equal(cards[1].original, null);
  assert.deepEqual(cards[0].encodings, [{ model, informationExtracted: 0.7, encoding }]);
  assert.equal(cards[1].strength, -0.2);
  assert.equal(cards[1].enabled, true);
  for (const overrides of [{ id: "0".repeat(64) }, { version: 2 }, { importInfo: { model, mask: "fixture", information_extracted: 0.7, strength: 0.1 } }]) {
    await assert.rejects(importVibeFile(new File([JSON.stringify({ ...exported("image"), ...overrides })], "invalid.naiv4vibe")));
  }
});

test("reference PNGs retain RGB, transparency outside the packet and normal prompt metadata but discard reference bytes", async () => {
  const width = 64, height = 32;
  const pixels = Buffer.alloc(width * height * 4, 255);
  const message = Buffer.from('{"fixture":"source-only-encoding"}');
  const bits = Buffer.alloc(4);
  bits.writeUInt32BE(message.length * 8);
  const packet = Buffer.concat([Buffer.from("stealth_pnginfo"), bits, message]);
  for (let bit = 0; bit < packet.length * 8; bit++) {
    const index = ((bit % height) * width + Math.floor(bit / height)) * 4 + 3;
    pixels[index] = 254 | ((packet[bit >> 3] >> (7 - bit % 8)) & 1);
  }
  pixels[pixels.length - 1] = 15;
  const vendor = appendPngText(encodeRgbaPng(pixels, width, height), "Comment",
    JSON.stringify({ reference_image_multiple: [encoding], image_cache_secret_key: "vendor cache key" }));
  const ordinary = await receivedImageToPng(vendor, { model, parameters: {} });
  assert.equal(ordinary.imageBytes, vendor);
  const cleanedInput = await referenceInputPng(vendor);
  const raw = decodePngPixels(cleanedInput);
  const expected = Buffer.alloc(pixels.length, 255);
  expected[expected.length - 1] = 15;
  assert.deepEqual(raw.pixels, expected);
  for (const [target, parameters] of [[model, { reference_image_multiple: [encoding] }],
    ["nai-diffusion-5-full", { director_reference_descriptions: [{ caption: { base_caption: "costume", char_captions: [] } }] }]]) {
    const result = await receivedImageToPng(vendor, { model: target, input: "synthetic subject", parameters: { ...parameters,
      seed: 123, negative_prompt: "fixture negative" } });
    assert.deepEqual(decodePngPixels(result.imageBytes).pixels, expected);
    assert.equal(result.requestMetadataOnly, true);
    assert.equal(parseNovelAiPngMetadata(result.imageBytes).parsed.base_prompt, "synthetic subject");
    assert.equal(parseNovelAiPngMetadata(result.imageBytes).parsed.params.model, target);
    assert.ok(!result.imageBytes.includes(encoding));
    assert.ok(!result.imageBytes.includes("vendor cache key"));
  }
});

test("PNG-wrapped official exports restore ordered Vibes even after rename, while normal PNG remains an image", async () => {
  const json = JSON.stringify({ identifier: "novelai-vibe-transfer-bundle", version: 1, vibes: [exported("encoding"), exported("image")] });
  const text = Buffer.from(json).toString("base64");
  const embedded = appendPngText(png, "naidata", text);
  const type = Buffer.from("zTXt");
  const data = Buffer.concat([Buffer.from("naidata\0\0"), deflateSync(Buffer.from(text))]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), chunk.length - 4);
  const compressed = Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
  for (const [bytes, name] of [[embedded, "looks-like-a-regular.png"], [compressed, "renamed.dat"]]) {
    const cards = await importVibeFile(new File([bytes], name));
    assert.equal(cards.length, 2);
    assert.equal(cards[0].original, null);
    assert.deepEqual(cards[0].encodings, cards[1].encodings);
  }
  assert.equal(await tryImportVibeFile(new File([png], "photo.png")), null);
  await assert.rejects(importVibeFile(new File([png], "missing.naiv4vibebundle.png")), /missing/i);
  const truncated = Buffer.from(embedded);
  truncated.writeUInt32BE(0xffffffff, 8);
  await assert.rejects(importVibeFile(new File([truncated], "bad.png")), /length/i);
});
