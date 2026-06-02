# Changelog

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
