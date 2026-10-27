# Updating to v3.8.2 / 업데이트 / 更新

Download Windows x64 Portable and SHA256SUMS.txt from [v3.8.2 Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.8.2). Save edits, close every version, and back up the complete actual data folder before replacing the EXE. The default is %APPDATA%\Chaessi Preset; custom/development paths may differ. Do not run two versions against one active profile.

업데이트 전 편집을 저장하고 모든 버전을 종료한 뒤 실제 데이터 폴더 전체를 백업하세요. 데이터를 지우지 않고 EXE를 교체합니다. 기본 경로는 %APPDATA%\Chaessi Preset입니다. 신규 카메라의 실제 NovelAI 이미지 품질은 미검증입니다.

更新前に保存して全バージョンを終了し、実際のデータフォルダ全体をバックアップしてください。データを残してEXEを交換します。既定は%APPDATA%\Chaessi Presetです。新カメラの実際のNovelAI画質は未検証です。

## Preserved data

The app ID app.chaessi.preset and normal data path are unchanged. Preset v2/v3, Character/outfit assets, Base/UC/settings presets, categories, Wildcards, images and History keep their existing readers. No forced batch conversion occurs. V4.5 data remains readable/editable; switch explicitly to V5 for new generation.

Old camera_context sidecars and data/camera/sessions remain intact. History shows old camera context read-only. Old sessions/calibration cannot be edited, rerun or converted by v3.8.2. Use v3.8.1 with a matching backup for the old engine. Older versions may not understand new camera records.

New work uses absolute-camera/1 under data/camera-input-v382. Startup is OFF; only explicit resume restores saved state. New-camera actions from images/History start at front 0°. PNG/WebP generation metadata is supported; JPEG generation metadata is not. Camera start/resume selects T2I and does not save input images/masks. Prepare them separately for I2I/Inpaint.

Save As makes a separate preset. Keep original images and version-appropriate backups. Automatic updates and recovery of unsaved edits after exit are unavailable. Never distribute credentials, secure-store files, personal History, source prompts or the full data folder.

[한국어](CAMERA.ko.md) · [English](CAMERA.en.md) · [日本語](CAMERA.ja.md) · [v3.8.1 archive](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.8.1)
