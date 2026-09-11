# Phase 8.2 Migration Matrix

## Recorded bases

- Authoritative Chaessi Preset v3.2.1 commit: `1fe382f860a618f68a151d953fc5682867d67c6f`
- Image Maker source base commit: `95a33648a142d3c3b5a80b42d04bef878776f67c` (`v3.1.1`)
- Image Maker source state: uncommitted Phase 0–8.1A working tree on `codex/v3.1.1-work`
- Migration branch: `codex/image-maker-v3.2.1-port`
- Porting rule: preserve v3.2.1 and adapt Image Maker to it; do not overwrite v3.2.1 core files with v3.1.1 copies.

## Pre-port baseline

The v3.2.1 worktree was clean before this document was added. The existing non-Electron automated suite passed: 21 Node test files, 21 passed, 0 failed. The standalone Position Pad review scripts also exited successfully when included in the command.

## File and feature mapping

| Image Maker file or feature | v3.1.1 Image Maker state | v3.2.1 destination | Planned treatment | v3.2.1 behavior to preserve |
| --- | --- | --- | --- | --- |
| Director request and scene-plan contracts | New files under `src/state/` | Same service boundary | Port, then validate against current preset/model state | Current model profiles and preset schema |
| Codex Image Director instructions and schema docs | New docs and examples | `docs/image-maker/`, `examples/image-maker/` | Port | No runtime core dependency |
| Codex Director Bridge | New `src/services/codex-director-bridge.js` | Same service boundary | Port and adapt executable handoff | Existing Electron startup and NovelAI auth separation |
| Composer v2 | New `src/services/preset-composer-v2.js` | Same service boundary | Port and bind to v3.2.1 catalog/build path | v3.2.1 V5 adapter and payload semantics |
| Preset Catalog v2 | New `src/services/preset-catalog-v2.js` | Same service boundary | Port and validate against actual v3.2.1 stores | Character, section preset IDs and type gates |
| Character subject / Outfit independence | Phase 8.1A policy and tests | Catalog, Director docs, Composer/guard tests | Port unchanged | Preset type mismatch remains an error |
| Actor semantic guard | New service | Same service boundary | Port | Existing prompt data remains unchanged |
| Local Danbooru resolver | New service and local index contract | Same service boundary | Port | No web lookup and no preset migration |
| Single-image runner and run store | New services | Same service boundary | Port and reuse v3.2.1 generation endpoint/store | Existing generation ID, PNG, sidecar, payload storage |
| Multi-shot runner and run store | New services | Same service boundary | Port | Sequential generation, preflight-before-cost, partial failure records |
| Renderer artifact policy | New service/docs | Same service boundary | Port | Structural validation remains separate from renderer observations |
| Image Maker API facade | New service | Same service boundary | Port | Server owns filesystem and credentials |
| Image Maker UI controller/state | New files under `src/ui/` | Same service boundary | Port and integrate with current shell | Current Position Pad, History, performance controls |
| `server.mjs` endpoints | Modified core file | v3.2.1 `server.mjs` | Manual merge only | V5 T2I/I2I/Inpaint, V4.5, auth, data root, history bulk delete |
| `electron/server-process.mjs` Codex path handoff | Modified core file | v3.2.1 Electron bootstrap | Manual merge only | safeStorage NovelAI token provider and portable launch behavior |
| `index.html` workspace and Image Maker view | Modified core file | v3.2.1 UI shell | Manual merge only | Latest Position Pad and History controls |
| `styles.css` Image Maker styles | Modified core file | v3.2.1 stylesheet | Manual merge only | v3.2.1 Position Pad, History, and performance styling |
| `src/app.js` UI wiring | Modified core file | v3.2.1 app controller | Manual merge only | 32-coordinate Position Pad, 0.001 precision, History selection/navigation |
| `src/api/client.js` Image Maker API methods | Modified core file | v3.2.1 API client | Manual merge only | Existing generation and history API behavior |
| `src/services/generation-store.js` direct lookup | Modified in both lines | v3.2.1 generation store | Keep v3.2.1 implementation; add only missing Image Maker lookup contract if required | History bulk delete, modal navigation ordering, stored asset rules |
| CLI entry | New `cli/chaessi.mjs` | Same optional thin layer | Port | Backend remains the source of truth |
| Image Maker tests | New root tests | Same names | Port, then adapt only v3.1.1 implementation assumptions | Requirements and 52-test behavior remain intact |
| v3.2.1 Position Pad | Absent in v3.1.1 base | `src/ui/character-position-pad.js` plus current payload wiring | Preserve; map scene actor coordinates into current payload format | 32 coordinates, 0.001 precision |
| v3.2.1 History improvements | Absent in v3.1.1 base | History UI modules, store and server routes | Preserve | Batch delete and modal navigation |
| Package metadata and Electron build | v3.1.1 package version | v3.2.1 package files | Keep v3.2.1 files; verify packaging includes new source/docs where applicable | Version 3.2.1 and portable Electron structure |

## Merge checks

1. Port independent Image Maker files and tests.
2. Manually merge the server, Electron handoff, API client, UI shell, app controller, and stylesheet.
3. Resolve compilation and contract differences in favor of v3.2.1.
4. Run the Image Maker suite and the v3.2.1 baseline suite.
5. Verify Position Pad, History, I2I/Inpaint, token source, and Electron packaging.
6. Perform one no-retry Electron Image Maker generation only after all preflight checks pass.

## Final outcome

| Area | Final treatment | Result |
| --- | --- | --- |
| Independent Image Maker services, state contracts, UI controller/state, CLI, examples, and Phase 1–8.1A tests | Ported as independent files | PASS |
| `server.mjs` | Added only Image Maker imports, construction, and routes to the v3.2.1 server | PASS |
| `electron/server-process.mjs` | Added Codex CLI discovery/environment handoff to the v3.2.1 safeStorage bootstrap | PASS |
| `index.html`, `src/app.js`, `styles.css` | Three-way merge followed by manual conflict resolution; both workspaces, Position Pad, History, and Image Maker remain | PASS |
| `src/api/client.js` | Preserved structured error fields and fixed object-valued `details` so the public message remains readable | PASS |
| `src/services/generation-store.js` | Left at the authoritative v3.2.1 implementation | PASS |
| V5 builder/adapter and generation mode adapters | Left at the authoritative v3.2.1 implementation | PASS |
| `package.json` and Electron build configuration | Left at version 3.2.1; unpacked Electron packaging completed | PASS |
| Image Maker count | v2 positive integer contract now accepts `1`, allowing one-cost UI E2E while preserving multi-shot counts | PASS |
| Existing Image Maker runs | No conversion; Recent Runs read 14 existing/current manifests | PASS |

The only three merge conflicts were the Image Maker detail dialog placement, Image Maker server routes next to the new History batch route, and the simultaneous Position Pad/Image Maker imports and initialization in `src/app.js`. Each conflict was resolved by keeping both v3.2.1 and Image Maker behavior.
