import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NovelAiT5Tokenizer } from "./src/ui/novelai-t5-tokenizer.js";

const definition = JSON.parse(await readFile(
  new URL("./assets/tokenizers/google-t5-small-vocab.json", import.meta.url),
  "utf8",
));
const tokenizer = new NovelAiT5Tokenizer(definition);
const officialCounts = [
  ["", 1],
  ["girl", 2],
  ["1girl", 3],
  ["girl, blue eyes", 5],
  ["masterpiece, best quality, highres", 9],
  ["a woman standing beside a window", 9],
  ["girl,blue eyes", 6],
  ["girl , blue eyes", 6],
  ["girl\ngirl\n\nblue eyes", 5],
  ["1.5::blue eyes::", 3],
  ["-1::blurry::", 3],
  ["{blue eyes}", 3],
  ["[blue eyes]", 3],
  ["character focus, source#standing, target#sitting", 13],
  ["A woman is standing beside a large window while soft morning light enters the room.", 19],
  ["창가에 한 여성이 서 있다", 16],
  ["여성, 파란 눈, 검은 머리", 17],
  ["café, naïve, 日本語, 한국어", 18],
  ["girl, girl, girl", 6],
  ["girl ", 3],
  [" girl", 3],
  ["  ", 3],
  ["é", 3],
  ["é", 4],
  ["Ａ", 3],
  ["A", 2],
  ["café", 2],
  ["café", 3],
  ["🙂", 4],
  ["girl blue", 3],
  ["girl\nblue", 3],
  ["girl\n\nblue", 3],
];

for (const [text, count] of officialCounts) {
  assert.equal(tokenizer.count(text), count, `Count differs for ${JSON.stringify(text)}`);
}

assert.deepEqual(tokenizer.encode("girl, blue eyes"), [3202, 6, 1692, 2053, 1]);
assert.deepEqual(tokenizer.encode("1.5::blue eyes::"), [1692, 2053, 1]);
assert.deepEqual(tokenizer.encode("girl "), [3202, 3, 1]);
assert.deepEqual(tokenizer.encode("🙂"), [3, 2, 2, 1]);
assert.deepEqual(tokenizer.encode("é"), [3, 15, 2, 1]);

console.log(`NovelAI T5 tokenizer vectors passed: ${officialCounts.length}/${officialCounts.length}.`);