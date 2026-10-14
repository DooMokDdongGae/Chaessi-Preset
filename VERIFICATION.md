# v3.6.0 release verification

Verified on 2026-10-15 against the release candidate, not only earlier development builds. All application GUI tests used isolated profiles and synthetic libraries. No real user profile was overwritten.

## Automated checks

- **51 unit/contract/HTTP tests passed**, covering High/Medium, Wildcard freezing, PNG/RGBA/metadata, History, revisions, image operations, token guards, multilingual help and optional read-only MCP.
- **21 legacy regression scripts passed**, including mask padding/quantization/compositing, generation modes, image intake, History navigation/deletion and character categories.
- Inpaint's six protected core files match the validated baseline. High Inpaint requests still match the independent frozen v3.5.0 fixture. Release work did not change those algorithms.
- Runtime dependency audit: **0 known vulnerabilities** with `npm audit --omit=dev`. This does not claim that the entire application or development toolchain is free of every vulnerability.

Run the unit suite with:

```sh
node --test tests/illustrated-help.test.mjs tests/image-tools.test.mjs tests/v360.test.mjs tests/mcp.test.mjs tests/multilingual-workbench.test.mjs tests/wildcard.test.mjs tests/wildcard-endpoint.test.mjs tests/character-preset-preferences.test.mjs
npm run test:regression
```

## Actual Electron UI

- Prompt workflow: **6 scenarios passed** (Save/Save As/revisions/restore/previous work, Effort, Wildcards, History/Import, V4.5 read compatibility, restart).
- Image tools: **11 scenarios passed**, including Director variants, Canvas, Outpaint/Focus, large RGBA PNG and source reuse.
- Multilingual workbench: **15 checks passed**; source/mask/text preservation, Character/Position, sorting, deletion confirmation, contextual help and minimum-size windows.
- Illustrated help: **4 aggregate checks passed**, covering 36 contextual tool links, App info/support routing, 30 chapters × 3 languages, all images, search, zoom, return focus/work and 960×640 text/scroll behavior.
- The packaged unpacked executable also passed actual Electron version/profile/support-link checks. The exact external support URL is reused; unrelated/lookalike/file destinations do not open external browsers.

## Actual portable executable

The distributed Windows x64 portable EXE was executed, rather than treating an unpacked build as an installer test.

- A **new isolated profile** passed startup, App info version, all 90 localized chapter views/103 pictures, image zoom, native PNG/RGBA Canvas save, History, PNG Import and restart with saved preset/History/language.
- **Actual v3.5.0 → actual v3.6.0 portable upgrade** passed 6 scenarios. Synthetic v3.5.0 data was created by the old version's own stores, then read by both executables using the same isolated profile.
- The **14 original data files** remained byte-identical during read-only use. An intentional Save changed only its target preset; Save As/revisions added separate files. The untouched original source library remained unchanged.
- Base/Character/outfit/UC/settings presets, custom categories, Wildcards, Character coordinates, V4.5/V5 History, old V4.5 PNG Import, saved revisions and restart persistence were checked.
- Portable extraction uses a separate temporary directory per launch, preventing shared extraction cleanup from disturbing a quick restart or another isolated test instance.

The portable tests are `scripts/verify-portable-release.mjs` and `scripts/verify-upgrade-portable.mjs`. Set `CHAESSI_NEW_PORTABLE`, `CHAESSI_OLD_PORTABLE`, `CHAESSI_UPGRADE_BASELINE` and, when needed, `CHAESSI_PLAYWRIGHT` to your local test inputs. They never select an installed user's profile.

## Assets, secrets and limits

The package contains 30 chapters, 90 actual UI screenshots and 13 result layouts. Asset notices and native dependency licenses are included. Source/package audits exclude account stores, credentials, raw paid API responses, personal libraries, temporary results and internal development reports.

No new NovelAI image API calls or Anlas expenditure were required for this release task. Mock provider GUI calls are not represented as live generation. Earlier actual provider validation informed the adapters; current release verification independently retested their contracts.

The distribution is an **unsigned portable EXE**, not an installer. Installer upgrade and code-signing trust were not tested or claimed. Arbitrary real-world library size, every DPI/Windows configuration, every account billing tier and every live image/setting combination are outside this verification. Unsaved edits are not restored after quitting; keep backups for rollback from newly saved preset formats.
