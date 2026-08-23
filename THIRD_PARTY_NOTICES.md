# Third-Party Notices

## Google T5 tokenizer vocabulary

Chaessi Preset includes a compact vocabulary derived from the `tokenizer.json` file for `google-t5/t5-small`.

- Project: Text-to-Text Transfer Transformer (T5)
- Source: https://huggingface.co/google-t5/t5-small/blob/main/tokenizer.json
- Upstream project: https://github.com/google-research/text-to-text-transfer-transformer
- License: Apache License 2.0
- Included asset: `assets/tokenizers/google-t5-small-vocab.json`
- License text: `assets/tokenizers/LICENSE-APACHE-2.0.txt`

The Chaessi Preset T5 tokenizer implementation is independent JavaScript code.

## Qwen 3.5 tokenizer data

Chaessi Preset includes a deflate-packaged representation of the vocabulary,
merge rules, special tokens, normalization, and pre-tokenization pattern from
the Qwen 3.5 tokenizer used for NovelAI Diffusion V5 token counting.

- Project: Qwen 3.5
- Source: https://huggingface.co/Qwen/Qwen3.5-9B/blob/main/tokenizer.json
- Upstream project: https://github.com/QwenLM/Qwen
- License: Apache License 2.0
- Included asset: `assets/tokenizers/qwen35-tokenizer.deflate`
- License text: `assets/tokenizers/LICENSE-APACHE-2.0.txt`

The packaged vocabulary, merges, and special-token IDs were verified against
the upstream Qwen 3.5 tokenizer. The Chaessi Preset BPE implementation is
independent JavaScript code.

## @msgpack/msgpack

Chaessi Preset uses `@msgpack/msgpack` to decode NovelAI's length-prefixed
MessagePack image generation stream.

- Project: @msgpack/msgpack
- Source: https://github.com/msgpack/msgpack-javascript
- License: ISC
