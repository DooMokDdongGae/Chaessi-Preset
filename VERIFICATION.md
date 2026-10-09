# Chaessi Preset verification

## v3.5.0 final release verification — 2026-10-09

- Existing regressions: **21/21 PASS**. Wildcard unit/mock HTTP: **8/8 PASS**. Slot preference unit checks: **5/5 PASS**. Language/sorting/help unit checks: **5/5 PASS**. Static translation coverage: **PASS**.
- Actual Electron workbench: **21/21 PASS**, including presets, focused/large editing, Wildcards, Position Pad, History and V4.5/V5 × T2I/I2I/Inpaint with a mock provider.
- Actual Electron multilingual/help/state/deletion scenarios: **15/15 PASS**. Character picker in isolated Edge: **8/8 PASS**. Actual Electron quit/restart and main/History preset compatibility: **4/4 PASS**.
- Built Electron application: **6/6 PASS**, including v3.5.0, isolated data, exact KO/EN/JA support labels, fixed external-browser URL, three-language help/images and rejection of unrelated URLs. No renderer errors.
- Package/source bytes checked for equality; 33 local help screenshots, four archived v3.4.0 PDFs, tokenizer assets, MIT/Apache/third-party notices included. Environment, credentials, user data and development artifacts excluded.
- Final build is unsigned. Support is optional, one-time USD $3 per coffee, without feature restrictions.
- Initial UI runs stopped on a missing local Electron path and an obsolete hard-coded version assertion. The runtime path and version-aware test were corrected; all affected scenarios passed on rerun. No application functionality changed for these corrections.
- **Not run:** new live NovelAI calls or real payments. Generation verification in this release task used a mock provider; tests did not access production user data. Other PCs and high-DPI behavior were not newly tested.

## Persistent-category correction — PRIVATE, 2026-10-09

The requested scope includes app restart and loading main/History presets. The session-only behavior in the published v3.4.1 implementation below is superseded by this PRIVATE correction; no existing Public Release has been changed.

- Numbered-field category preferences now live in the Electron/browser profile's localStorage (`chaessi.character-preset-categories.v1`). Only category/subcategory pairs are stored, for up to 32 fields. Main/History preset loading and temporary UI state resets do not overwrite them.
- `npm run test:character-preset-preferences`: **5/5 passed**, covering independent fields including field 32, explicit replacement/All categories, defensive copies, invalid stored data and storage failures.
- `npm run test:character-preset-ui`: **8/8 passed**, covering independent filters and cards, Character/Base loading, direct changes, reorder/delete/re-add, model/tab/enable changes, main preset loading, page reload, reusable prompts and Wildcard preparation.
- `npm run test:character-preset-restart`: **4/4 passed in the actual Electron app**. Quit/relaunch with an isolated profile retains two selections; loading a different real stored main preset and applying a real stored History preset preserve them; explicitly selecting another category and All categories persists across a second quit/relaunch. No renderer errors.
- Existing Wildcard unit/HTTP integration: **8/8 passed**. Existing regression scripts: **21/21 passed**. Local HTTP and temporary-file checks ran with normal permissions after the sandbox blocked them.
- Synthetic local fixtures only; no live NovelAI generation, production data or saved credentials were used. Preset/generation schemas, generation adapters and PDFs are unchanged. README is the v3.4.0 original.
- Preferences are tied to numbered fields, not to character content imported into those fields. Clearing the app's browser profile would clear these local preferences. Storage failure is reported in the UI rather than silently promising restart persistence.

The user approved publishing this verified correction as v3.4.2. PUBLIC work only updates release metadata, builds and publishes; no feature, regression or PDF verification is rerun. The README and guides shipped with v3.4.1 are reused unchanged.

## v3.4.1 PRIVATE verification — 2026-10-09

Baseline: v3.4.0 private source (`03c9d9f`), whose tracked files match the published v3.4.0 source except the historical CHANGELOG. No user presets, credentials, or production History were changed.

- Actual local app in headless Edge, isolated synthetic data: `npm run test:character-preset-ui`, **8/8 UI scenarios passed**.
- Verified reopening restores category, subcategory and matching cards; two slots remain independent; loading a Character Preset preserves the slot's filter and exact prompt.
- Verified direct category/subcategory changes, categories with no children, All categories and All subcategories; Base Prompt filter isolation and actual loaded Name/Prompt.
- Verified model/tab/enable changes, character reorder/delete/add, saving without UI fields, and resetting preferences on main preset load. The UI preference is session-only and is not persisted in preset files.
- Verified Wildcard creation through the UI and preparation of saved Character/Base references and legacy `||...||` syntax. The new UI test does not contact NovelAI or use saved credentials.
- Existing Wildcard unit/HTTP integration suite: **8/8 passed**, including V4.5/V5 × T2I/I2I/Inpaint final request/History matching against a mocked provider.
- Existing regression suite: **21/21 passed** (categories, both models and generation modes, History, image intake, Inpaint, references, token counters and UI controls).
- No renderer JavaScript errors. Browsing preferences reuse existing per-character UI state; preset schemas, generation adapters, Wildcard logic and bundled PDFs are unchanged.

PRIVATE verification is complete. Publication requires user approval; PUBLIC work must use this verified commit without repeating feature or regression tests. v3.4.0 tags and Release remain untouched.

## v3.4.0 verification (historical)

Baseline: **v3.2.1**. This release adds Wildcards and guides to that workbench. It does not include the v3.3.x Image Maker workspace; earlier releases remain available.

## Implemented scope

- File-based shared Wildcard library, `__key__` references, one candidate per line, search, editing, samples, TXT import/export, insertion into Base/Undesired/Character fields.
- Independent uniform selection over all unique entries. Empty/duplicate lines normalize on save. Saved keys remain fixed. Candidate random blocks are supported; nested Wildcard references are rejected.
- Server-owned generation preparation with a five-minute, bounded, single-use cache. The exact prepared preset is used for transport and storage. Saved editing presets remain reusable.
- Generation snapshots omit inactive model templates, disabled characters and imported source snapshots. No Wildcard definition, selection mapping or candidate library is added to image metadata or History.
- Base Prompt Preset loading applies its actual name. Clothing subcategories use the Korean part of bilingual labels for sorting, including persisted/custom entries.
- Version button opens App info & Manuals. Four bundled PDFs open in sandboxed local Electron PDF windows.

## Automated checks

- `node --test tests/wildcard.test.mjs tests/wildcard-endpoint.test.mjs`: **8/8 passed**.
- Coverage: 1,000 candidate indexes including first/middle/last; independent repeated references; all prompt fields; legacy pipe blocks; missing/empty keys; source immutability; store persistence, duplicate-key conflicts and deletion; prepared result expiry/reuse/eviction; Korean ordering.
- HTTP integration covers **V4.5/V5 × T2I/I2I/Inpaint (6 paths)**. Test-only provider responses use the existing ZIP/MessagePack decoders. Captured outbound bodies match History; prepared prompts remain fixed after editing the library.
- `node scripts/run-regressions.mjs`: **21/21 existing v3.2.1 regression scripts passed**, covering both models, generation modes, image intake, Inpaint masks, Precise Reference, token counters, character categories, direct History lookup, paging, bulk delete and navigation.

## Actual UI and live provider checks

- Headless Edge used the actual app served from the worktree and isolated test data. No production presets/History were changed.
- Created multiple Wildcards; inserted references into Base and opened Character insertion; saved reusable references in a Main Preset; loaded a Base Prompt Preset and verified Name; verified Korean order in both clothing filters.
- Imported **500 candidates** through the file input, removed duplicate/blank lines, exported 500 lines, sampled and deleted the test library through the UI.
- Real NovelAI **V4.5 T2I and V5 T2I** generated successfully with two Wildcards and a legacy random block. The transport body, History final prompt, and returned PNG NovelAI metadata were compared and matched, including V5 quality tags. Undesired metadata matched the outgoing negative prompt. Original editor references remained unchanged.
- PNG metadata is read using the app's actual PNG importer. The final image bytes are not rewritten. "EXIF" here refers to the available NovelAI image metadata; this does not fabricate an EXIF chunk if the response has none.
- Live checks used the app's existing encrypted token reader. Credentials were passed in memory only and were never retained in request captures, logs or committed artifacts.
- Live I2I/Inpaint provider calls were not needed for this change; their six combined model/mode paths were verified through HTTP integration and existing mode regressions. Real generated results were also routed through the UI into I2I and Inpaint.
- `node scripts/verify-electron-manuals.mjs`: all **4 PDFs opened in the actual Electron PDF viewer** via App info & Manuals. MIME type, HTTP success and local viewer URLs were verified; viewer screenshots were inspected.

## Manuals

- `manuals/app-ko.pdf` and `manuals/app-en.pdf`: 13 pages each.
- `manuals/wildcard-ko.pdf` and `manuals/wildcard-en.pdf`: 7 pages each.
- Real app screenshots, short numbered steps, matching button names, embedded Korean font, bookmarks and page numbers.
- All 40 pages rendered with Poppler and were visually reviewed. Text extraction/page counts and authoring overflow checks passed.
- Rebuild with `scripts/build-manuals.py` using ReportLab and pypdf. Screenshot sources are in `manuals/screenshots/`. UI/live helpers are opt-in developer scripts; normal tests never contact NovelAI.

## Release verification

Version is **3.4.0**. Publication was explicitly approved. Final automated checks, packaged runtime/PDF checks and distribution audits are recorded below before publication. Earlier tags and release assets remain unchanged.

### Final release checks

- README is one file with a top table of contents and four Korean/English user/developer sections. Relative guide links and all four anchors were checked.
- Final Wildcard suite: 8/8 passed. Existing regression suite: 21/21 passed.
- Final actual UI check passed multiple Wildcards, 500-candidate import/export, insertion, reusable preset references, loaded Name and both Korean clothing filters. No additional live provider calls were made during publication; the earlier V4.5/V5 T2I request/History/PNG comparisons remain the live evidence.
- Official Windows x64 portable build succeeded. The packaged desktop runtime used isolated user data, displayed v3.4.0, and opened all four PDF guides in its actual PDF viewer.
- The portable launcher itself started its local server and desktop window endpoint successfully. Full PDF viewer checks were completed with the packaged executable from the same build.
- 65 packaged source/asset files match the approved workbench bytes; no runtime data, environment files, credentials or test artifacts are shipped. Public sources use portable verification paths, with no personal absolute paths in README or PDFs.
- PDF text/privacy checks: 13/13/7/7 pages. All guides are bundled and also attached as separate release assets.
- Runtime npm dependency audit: zero reported vulnerabilities. The unchanged development/build dependency tree has npm audit advisories; those development tools are excluded from the application bundle.
- EXE size: 102,763,826 bytes. SHA-256: C9EC62222A84583AE0E4EB42A04F8E204489AA75E089C7A3447F0E2129785D40.
