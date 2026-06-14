# Changelog

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
