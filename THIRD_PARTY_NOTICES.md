# Third-Party Notices

## OpenAI CLIP tokenizer merge data

Director prompt counting uses the first 48,894 byte-BPE merge rules from OpenAI CLIP. Every merge line in NovelAI's current public CLIP tokenizer was compared with the upstream merge file before packaging. The JavaScript tokenizer is independently implemented.

- Source: https://github.com/openai/CLIP
- Merge file: https://openaipublic.azureedge.net/clip/bpe_simple_vocab_16e6.txt.gz
- License: MIT
- Included asset: `assets/tokenizers/clip-merges.deflate`
- License text: `assets/licenses/openai-clip-LICENSE`
- Common NFC text and basic HTML entities are normalized. Python ftfy's repair of malformed legacy text is not reproduced; rewrite corrupted text before use.

## Model Context Protocol SDK and Zod

The optional local, read-only MCP connection uses the official TypeScript SDK
and Zod for protocol transport and tool argument validation.

- Project: `@modelcontextprotocol/sdk`
- Source: https://github.com/modelcontextprotocol/typescript-sdk
- License: MIT (included with the installed package)
- Project: `zod`
- Source: https://github.com/colinhacks/zod
- License: MIT (included with the installed package)

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

## sharp and libvips

Version 3.6 uses sharp 0.35.5 to decode NovelAI WebP results and produce PNGs while preserving alpha. Inpaint PNG results bypass conversion.

- sharp: https://github.com/lovell/sharp — Apache License 2.0
- libvips: https://github.com/libvips/libvips — LGPL-2.1-or-later
- The Windows prebuilt `@img/sharp-win32-x64` package declares `Apache-2.0 AND LGPL-3.0-or-later`; its included LICENSE and dependency notices remain in the native package.
- The separate native runtime and its dependency notices are included under `node_modules/@img/` when packaging. No upstream library source is modified.

## Illustrated help assets

The illustrated help screenshots and teaching layouts are project-authored. Generated sample provenance and NovelAI service ownership terms are recorded in `assets/manuals/ASSET_NOTICES.md` and `assets/manuals/examples/provenance.json`. No private user image or saved preset is used.
