# Changelog

## v2.3.0

Chaessi Preset v2.3.0 adds NovelAI V4.5 Full Precise Reference conditioning without changing preset schemas or existing T2I, I2I, and Inpaint behavior when no reference is active.

### Added

- Precise Reference support for Text to Image, Image to Image, and Inpaint.
- Character, Style, and Character & Style reference types with Strength and Fidelity controls.
- Multiple ordered references with enable, disable, removal, active-count, cost, and compatibility warnings.
- Official V4.5 local reference preprocessing to centered PNGs at 1024x1536, 1536x1024, or 1472x1472.
- Separate History assets for the exact reference PNGs sent to NovelAI.

### Security

- Reference image Base64 is excluded from saved payload and sidecar JSON.
- Stored reference metadata is limited to safe asset paths, byte lengths, SHA256 hashes, dimensions, type, Strength, and Fidelity.
- Deleting History also deletes its reference assets.

### Compatibility

- Existing Text to Image, Image to Image, and Inpaint payloads remain unchanged when Precise Reference is not used.
- Main Preset and Character Prompt Preset schemas, Character Slots, categories, Random Prompt Resolver, Token Counter, and legacy History remain unchanged.
- Corrected stale app-version metadata so package, server health, preset metadata, and generation sidecars consistently report 2.3.0.

## v2.2.1

Chaessi Preset v2.2.1 corrects edit-time Random Prompt token counting without changing Generate-time resolution or NovelAI payloads.

### Fixed

- Random Prompt counters now display only the maximum token count among fully resolved alternatives.
- Exact evaluation remains available for up to 256 combinations.
- Larger sets use a tokenizer-based maximum estimate instead of unresolved syntax, delimiter tokens, or summed alternatives.
- Warning colors and overflow status use the maximum resolved or estimated count.

### Compatibility

- Generate-time Random Prompt resolution, saved preset source text, preset schemas, Character Slots, categories, adapters, and NovelAI payloads are unchanged.

## v2.2.0

Chaessi Preset v2.2.0 adds exact local prompt token counters for NovelAI V4.5 Full without changing preset schemas or NovelAI payload mapping.

### Added

- Offline T5-compatible token counting for Base Prompt, Undesired Content, and Character Prompt/Undesired fields.
- Per-field token counts with shared positive and negative context totals and the confirmed 512-token limit.
- Exact minimum-maximum token ranges for manageable Random Prompt Resolver combinations.
- Local tokenizer assets and Apache 2.0 third-party attribution packaged with the portable app.

### Validation

- Local counts match 32 of 32 synthetic vectors observed in the official NovelAI V4.5 Full UI, including whitespace, punctuation, emphasis syntax, Korean, Japanese, Unicode, and limit boundaries.
- Generate-time validation recounts the resolved random-prompt copy and warns on overflow without changing saved preset text.

### Compatibility

- Preset schemas, Character Slot structure, category storage, adapters, payload mapping, T2I/I2I/Inpaint, History, and safeStorage token handling are unchanged.

## v2.1.0

Chaessi Preset v2.1.0 adds an add-only Category Manager for organizing Character Prompt Presets without changing the existing preset schema or generation flow.

### Added

- User-defined top-level Character Prompt Preset categories.
- One level of user-defined subcategories under any built-in or custom category.
- Category settings persistence under Electron userData across app restarts and portable EXE replacement.
- Dynamic category and subcategory options in preset saving and filtering UI.

### Compatibility

- Built-in categories and their existing clothing subcategories remain available.
- Unregistered legacy category and subCategory strings are preserved and remain filterable.
- Existing presets without a category continue to use the default category.
- Character Prompt Preset schema, Character Slot structure, adapters, payloads, and Generate behavior are unchanged.

## v2.0.0

Chaessi Preset v2.0.0 expands the local NovelAI V4.5 Full workflow to integrated Text to Image, Image to Image, and Inpaint generation while preserving existing user data compatibility.

### Added

- Integrated Text to Image, Image to Image, and Inpaint workflows.
- PNG, WebP, and JPEG source image support.
- Image to Image Strength and Noise controls with original source resolution preservation.
- Inpaint Brush, Eraser, brush size, Undo, Redo, Clear Mask, and Hide Mask tools.
- Reuse of History results as Image to Image or Inpaint sources.
- Separate storage for source, selection mask, and transmitted generation mask assets, with related asset cleanup when History is deleted.

### Changed

- Inpaint generation masks use full-resolution binary values aligned to NovelAI's 8x8 block behavior after 16px Generation Padding.
- NovelAI raw Inpaint PNGs are stored directly as final images and History results.
- Removed local final compositing to reduce style and sharpness discontinuities and visible gray boundaries.

### Compatibility

- Existing preset schema, Character Slot structure, saved presets, user data, and History records remain compatible.
- Existing Text to Image generation, payload mapping, and Random Prompt Resolver behavior remain unchanged.
- Existing History records from earlier Inpaint implementations remain readable without migration.

## v1.6.3

Chaessi Preset v1.6.3 aligns Inpaint generation masks with the verified NovelAI V4.5 behavior and stores the raw NovelAI result directly.

### Changed

- Generation masks are full-resolution binary PNG masks aligned to uniform 8x8 blocks after padding.
- Generation Padding now defaults to 16px.
- NovelAI raw Inpaint PNGs are saved directly as final images and History results.
- Removed local final compositing that could make style and sharpness changes more visible across the generated region.
- Removed the Feather control and feather cursor ring because they no longer affect the final image.

### Compatibility

- Existing History records with feather or composite-era metadata remain readable without migration.
- Selection masks and transmitted generation masks remain separate History assets and are deleted with their History record.
- Text to Image, Image to Image, preset schema, Character Slot structure, payload mapping, and Random Prompt Resolver behavior are unchanged.


## v1.6.2

Chaessi Preset v1.6.2 removes visible Inpaint boundary artifacts by separating the mask sent to NovelAI from the mask used for final compositing.

### Added

- Added Generation Padding from 0 to 32 pixels, with a verified 12px default.
- Added a separate expanded binary generation mask for NovelAI requests.
- Added local soft-mask compositing that preserves original pixels outside the logical mask.
- Added separate History storage for logical masks and transmitted generation masks.

### Changed

- Inpaint History now stores the final composite PNG instead of the raw NovelAI response.
- NovelAI response metadata is preserved when the final composite PNG is encoded.

### Compatibility

- Text to Image and Image to Image payloads are unchanged.
- The Inpaint model, action, request type, preset schema, Character Slot structure, Random Prompt Resolver, token storage, and legacy History loading remain unchanged.

## v1.6.1

Chaessi Preset v1.6.1 improves Inpaint mask edges and makes brush size and feathering visible at the pointer.

### Added

- Added a Feather control for soft Brush and Eraser falloff.
- Added an optional Add Original Image setting, recorded safely in generation metadata.
- Added a round Brush/Eraser cursor with separate tool styling and an inner hard-core ring.

### Changed

- Separated the logical grayscale mask from the cyan visual overlay.
- Preserved 0-255 grayscale mask strength when exporting the full-size RGB PNG mask.
- Added stroke interpolation so fast pointer movement does not leave gaps.
- Add Original Image defaults to off after live ON/OFF QA showed more visible seams when enabled on some images.

### Compatibility

- Text to Image and Image to Image payloads are unchanged.
- The existing Inpaint request contract, preset schema, Character Slot structure, token storage, and History asset lifecycle remain unchanged.

## v1.6.0

Chaessi Preset v1.6.0 adds Image to Image and Inpaint workflows while preserving the existing preset schema and Text to Image payload flow.

### Added

- Added Text to Image / Image to Image / Inpaint mode selection in the Generate workspace.
- Added PNG, WebP, and JPEG source image input with preview, drag-and-drop, removal, and History result reuse.
- Added Image to Image Strength and Noise controls.
- Added full-image Inpaint mask canvas with Brush, Eraser, brush size, Undo, Redo, Clear Mask, and mask visibility controls.
- Added the confirmed NovelAI V4.5 Full inpaint request flow using `nai-diffusion-4-5-full-inpainting`, `infill`, and `NativeInfillingRequest`.
- Added mode-aware History metadata and separate source/mask generation assets.

### Security and Storage

- Source and mask Base64 values are not written into payload or sidecar JSON files.
- Source and mask images are stored as separate generation assets and removed with their History record.
- Tokens and authorization values remain excluded from API responses, logs, payload files, and sidecars.

### Compatibility

- Text to Image remains the default and its v1.5.1 payload is unchanged.
- Preset schema, Character Slot structure, and existing Text to Image adapter remain unchanged.
- Random Prompt Resolver runs before all three generation modes without modifying saved presets.
- Legacy History records without a mode are treated as Text to Image.
- Advanced Crop / Composite is not included in this release.
## v1.5.1

Chaessi Preset v1.5.1 adds optional subcategories for `남성 의상` Character Prompt Presets by extending the existing clothing preset workflow.

### Added

- Added male clothing subcategory selection and filtering.
- Added `Dandy / 댄디` while retaining the seven shared clothing subcategories.

### Compatibility

- Existing male clothing presets without a subcategory remain valid and load normally.
- Female clothing subcategories and existing preset storage format are unchanged.
- Character Slot structure, preset schema, NovelAI adapter, and payload mapping are unchanged.

## v1.5.0

Chaessi Preset v1.5.0 resolves random prompt blocks immediately before generation, while keeping saved presets unchanged.

### Added

- Added Generate-time random prompt block resolution for `||red|blue|black||` syntax.
- Random blocks are resolved before the NovelAI payload is built.
- Resolved values apply to Base Prompt, Undesired, and Character Slot prompt/undesired fields.

### Compatibility

- Saved preset data remains unchanged.
- Internal preset schema is unchanged.
- Character Slot structure is unchanged.
- NovelAI adapter and payload mapping are unchanged.
- NovelAI image metadata receives the resolved prompt because the resolved payload is sent to NovelAI.

## v1.4.1

Chaessi Preset v1.4.1 expands the Character Prompt Preset category list without changing preset storage, Character Slot behavior, or NovelAI payload mapping.

### Added

- Added `그림체` category.
- Added `품질` category.

### Compatibility

- Existing categories remain unchanged.
- Existing uncategorized presets still fall back to `기타`.
- Female clothing subCategory behavior is unchanged.

## v1.4.0

Chaessi Preset v1.4.0 makes Base Prompt feel like "Character Prompt 0" for preset management, without changing the actual Character Slot structure or NovelAI payload mapping.

### Added

- Preset button in the Base Prompt area.
- Base Prompt can open the existing Character Prompt Preset dialog directly.
- Saving from Base Prompt stores the current Base Prompt as `prompt` and current Undesired as `undesired` in the existing Character Prompt Preset store.
- Loading from Base Prompt replaces the current Base Prompt and Undesired fields with the selected preset values.

### Changed

- Removed the v1.3.0 Load target dropdown from the Character Prompt Preset dialog.
- Character Prompt Preset load target is now determined by where the dialog was opened:
  - Base Prompt Preset button loads into Base Prompt.
  - Character Slot Preset button loads into that slot.

### Compatibility

- Full Preset Save / Save As / Load remains unchanged.
- Character Prompt Preset storage remains unchanged.
- Character Slot 1-6 structure is unchanged.
- Category and subCategory behavior is unchanged.
- Internal preset schema and NovelAI adapter are unchanged.
- NovelAI payload mapping is unchanged.

## v1.3.0

Chaessi Preset v1.3.0 allows saved Character Prompt Presets to be loaded into the Base Prompt area as reusable prompt modules.

### Added

- Character Prompt Presets can now be loaded into Base Prompt.
- Character Prompt Preset dialog now has a load target selector:
  - Base Prompt
  - Slot 1
  - Slot 2
  - Slot 3
  - Slot 4
  - Slot 5
  - Slot 6

### Behavior

- Loading into Base Prompt replaces the current Base Prompt and Undesired values with the selected preset's prompt and undesired content.
- Loading into Character Slots keeps the existing v1.2.0 slot behavior.
- The dialog still closes automatically after a successful load.
- Failed loads, missing selections, and validation errors keep the dialog open.

### Compatibility

- Full Preset Save / Save As / Load remains unchanged.
- Character Prompt Preset storage remains unchanged.
- Character Slot structure is unchanged.
- NovelAI payload mapping is unchanged.
- Internal preset schema and NovelAI adapter are unchanged.

## v1.2.0

Chaessi Preset v1.2.0 improves the Character Prompt Preset category system with female clothing subcategories and category name cleanup.

### Added

- Optional `subCategory` support for Character Prompt Presets.
- Female clothing subcategory selector in the Character Prompt Preset save modal.
- Female clothing subcategory filter in the Character Prompt Preset list modal.
- Female clothing subcategories:
  - Casual / 캐주얼
  - Street / 스트리트
  - Sporty / 스포티
  - Office / 오피스
  - Girly / 걸리
  - Glam / 글램
  - Boudoir / 부두아르
  - Uniform / 유니폼

### Changed

- Renamed `여성 아웃핏` to `여성 의상`.
- Renamed `남성 아웃핏` to `남성 의상`.
- Character Preset cards now show `여성 의상 / subCategory` when a female clothing subcategory exists.

### Compatibility

- Existing `여성 아웃핏` character presets are displayed as `여성 의상`.
- Existing `남성 아웃핏` character presets are displayed as `남성 의상`.
- Existing uncategorized presets still fall back to `기타`.
- Subcategory data is optional, so legacy presets remain valid.
- Character Slot structure and NovelAI payload mapping are unchanged.

## v1.1.1

Chaessi Preset v1.1.1 improves preset dialog flow by closing dialogs automatically after successful save and load actions.

### Fixed

- Character Prompt Preset dialog now closes after successful Save.
- Character Prompt Preset dialog now closes after successful Save As.
- Character Prompt Preset dialog now closes after successful Load into Slot.

### Notes

- Full Preset Save, Save As, and Load already closed their dialogs after successful actions.
- Dialogs remain open when validation fails, saving/loading fails, or no preset is selected.
- Preset schemas, Character Slot structure, Character Prompt Preset categories, and NovelAI payload mapping are unchanged.

## v1.1.0

Chaessi Preset v1.1.0 adds category-based organization for Character Prompt Presets while keeping Character Slots independent and unrestricted.

### Added

- Preset Category System for Character Prompt Presets.
- Category selector when saving Character Prompt Presets.
- Category filter in the Character Preset modal.
- Default preset categories:
  - 여성 캐릭터
  - 남성 캐릭터
  - 여성 아웃핏
  - 남성 아웃핏
  - 구도·카메라
  - 배경·소품
  - 조명
  - 기타
- Legacy uncategorized preset fallback to `기타`.

### Improved

- Large preset library browsing.
- Preset organization workflow.
- Character Prompt Preset cards now show category labels.

### Notes

- Categories are only for organization and filtering.
- Categories are not connected to Character Slot numbers.
- Every Character Slot can freely load presets from every category.
- Character Slot structure and NovelAI generation payload mapping are unchanged.

## v1.0.0

Chaessi Preset v1.0.0 is the first public desktop release for local NovelAI V4.5 Full preset and payload management.

### Added

- Portable Windows Electron app.
- Integrated Chaessi Preset workbench UI.
- Fixed NovelAI model flow for `nai-diffusion-4-5-full`.
- Internal preset schema and NovelAI V4.5 Full payload adapter.
- Full preset Save / Save As / Load.
- Full preset thumbnails.
- Character prompt preset Save / Save As / Load / Delete.
- Character preset thumbnails.
- PNG/WebP metadata import for supported NovelAI metadata.
- Raw JSON metadata import.
- Automatic import apply into the current preset.
- Generation result preview.
- Generation history view/save/delete.
- Token Settings UI.
- Electron safeStorage encrypted local token storage.
- Runtime token sync between Token Settings and the local generation server.
- Electron userData storage for presets, character presets, section presets, generations, and secure token blobs.
- Simplified Import Metadata UX.
- Simplified Generation Result and History card UX.
- Hidden default Electron application menu.

### Security

- Token values are not displayed after saving.
- Token Settings API returns status only, not token values.
- Saved tokens are encrypted through Electron safeStorage.
- The saved NovelAI token is injected into the local server child process environment at runtime.
- Payload files, sidecar files, preset files, and history records are checked to avoid secret-like values.
- `.env`, secrets, logs, tmp folders, project-local `data/`, private docs, and local test artifacts are excluded from packaged output.

### Still Excluded

- Raw payload direct generation.
- Inpaint.
- Canvas / crop / brush / composite tools.
- Reference image features.
- Vibe transfer.
- Precise reference.
- Scene composer.
- Video features.
- Multi-model support.
- Installer.
- Code signing.
- Auto-update.
- Full OS Credential Manager/keytar integration.

### Notes

- The app is distributed as a portable EXE.
- User data is stored outside the app bundle through Electron userData.
- Replacing the EXE should not remove saved presets or token storage.
- The executable is currently unsigned, so Windows may show a trust warning.

## v0.9

Chaessi Preset 0.9 was the stable pre-Electron baseline.

Recovery points:

```text
tag: v0.9
branch: chaessi-preset-0.9
commit: 9b54e8c
```

Included:

- Single integrated workbench UI.
- Chaessi Preset branding.
- Internal preset schema.
- NovelAI V4.5 Full adapter.
- Fixed model: `nai-diffusion-4-5-full`.
- Preset Save / Save As / Load.
- Preset thumbnails.
- Character prompt editing and character preset handling.
- PNG/WebP/stealth metadata import.
- Raw JSON import.
- Local generation through the server.
- Generation history view/save/delete/restore.
- SecretStore / TokenProvider foundation on main after v0.9.

Architecture rules:

- Preserve `internal preset schema -> adapter -> NovelAI payload`.
- Do not use raw payloads directly for generation.
- Do not expose Builder/debug in the normal UI.
- Do not regress toward a NovelAI UI clone.
