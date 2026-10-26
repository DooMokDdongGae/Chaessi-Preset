# Local MCP verification

Verified on 2026-10-10 against the PRIVATE v3.5.0 workbench baseline. No new application release version is assigned.

## Completed

- `npm run test:mcp`: 11 tests passed. Includes an actual stdio SDK client/server handshake, seven read-only tools, arbitrary/multiple category filters, app-identical locale/date/name sorting, pagination across 104 presets, mutation detection, final History prompt reads, original PNG byte equality, invalid inputs, secret exclusion, junction/path escape rejection, missing data/images and large-image fallback.
- Saved-data coverage: V4.5 and V5 T2I, I2I and Inpaint records created with the existing adapters/stores. Wildcard and legacy random blocks resolve before saving; the MCP reads the final request prompts and Character captions.
- `npm run test:regression`: 21 existing regression scripts passed.
- `npm run test:multilingual`: 5 tests passed, including the unchanged UI sorting behavior after extracting its shared comparator.
- `npm run test:wildcard`: 8 tests passed, including mock-provider request/History checks for both models and all three generation modes.
- `scripts/verify-mcp-local.mjs`: actual installed-app saved data was read over stdio. Category/preset/History lookup and original image access succeeded. No incomplete records were skipped. Before/after file-content fingerprints matched. User names, prompts, paths and image contents are not copied into this report.
- `npm run electron:pack`: PRIVATE local unpacked build succeeded.
- `scripts/verify-mcp-package.mjs`: the packaged Electron executable ran the MCP as a Node process, completed the handshake and read a synthetic saved preset. Runtime code/dependencies were present; app data, environment files and test scripts were excluded.
- `npm audit --omit=dev`: zero reported production-dependency vulnerabilities at verification time.
- Local Codex MCP registration was added and its enabled state, stdio command and selected data-root configuration were confirmed.

## Boundaries

The app's UI and generation behavior are unchanged. The MCP reads saved disk data and does not access unsaved editor text, generate images, delete files, strip metadata, make JPGs, build HTML or publish posts. No paid live NovelAI request was made for this change; generation regression coverage used isolated fixtures/mock responses.

The MCP does not invent category provenance for historical images. Existing History saves overall preset labels and final prompts, but individual applied Character Preset category/name linkage is not reliable. The caller may apply a user-agreed creation-order convention separately.

An already-running Codex session may need its MCP connection refreshed or the local client restarted before the new tools become visible. Registration is not a claim that every existing session has already refreshed its tool catalog.

The build is local and PRIVATE. No PUBLIC repository, tag or Release was changed. No source README rewrite or application version bump was made.
