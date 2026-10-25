# v3.8.0 release verification

This record distinguishes application checks, mocked provider responses, actual portable execution and earlier live image comparisons. It contains no personal profile or test source.

## Verified behavior / 확인한 동작 / 確認した動作

- Camera: +40° at 1.1 → 1.5 keeps the camera and untouched 0.1 weight; +50° → +40° reproduces 1.5. Multiple knots, model/slot/source separation, non-owned prose and mixed expressions have focused coverage.
- Intervention: ordinary text, structural camera edits, explicit manual mode, OFF → workbench edit → reconnect, incomplete input cancellation, correction reset, source restore and undo remain usable.
- Requests: mock tests compare prepared/direct requests with History, reject stale revisions and wrong sources, and preserve the in-flight snapshot while later edits reach the following request. No control movement generates automatically.
- 한국어: 원본 보존·가중치 보정·직접 편집·오류 취소·카메라 관리 재연결과 다음 요청 반영을 구분해 확인했습니다. 자동 변환의 모델 품질을 완전한 자세 고정으로 표현하지 않습니다.
- 日本語：元画像の保持、重みの補正、直接編集、エラーの取り消し、管理への再接続、次の要求への反映を分けて確認しました。自動変換を完全な姿勢固定として説明していません。

## Automated and Electron checks

| Scope | Passed | Provider |
|---|---:|---|
| Full unit suite | 89 | Local / mock |
| Existing regression scripts | 21 | Local / mock |
| Camera preparation, stale requests and History | 8 | Mock |
| Actual Electron camera workflow | 22 | Mock |
| Existing workbench workflow, including V5 High/Medium T2I/I2I/Inpaint | 21 | Mock |
| V5 saved work, revisions, language, legacy reading and restart | 6 | Mock |
| Focused camera and translation checks after final error translations | 25 | Local |

The initial sandbox run encountered temporary-file rename/link restrictions; the isolated unrestricted retry passed. A test initially sent camera input before the source dialog closed; its wait condition was fixed. Portable tests isolate their temporary extraction directories to avoid concurrent test cleanup collisions. Electron does not expose the native Browser window-bounds CDP command, so the small-layout check uses supported viewport emulation. These test-harness failures are retained in the development evidence and are not counted as passes.

## Portable release checks

The final EXE passed 6 camera checks, 3 new-profile checks, 7 existing-feature checks and 6 upgrade checks. Final candidate results: camera correction/editing/local preparation/save/restart; a new empty profile; all 42 chapters in all three languages (126 localized chapter views), local pictures and zoom; Canvas/History/import; composition controls, round Inpaint brush, Pixel Snap and resolutions; and an isolated v3.7.0 → v3.8.0 upgrade. Camera UI and contextual help are checked in all three languages at a 960 × 640 viewport.

The upgrade fixture includes V4.5 and V5 records, full/Base/Character/outfit/UC/settings presets, categories, Wildcards, positions and language. Before intentional editing, every original data-file hash must remain unchanged. The editable original backup remains unchanged after Save/revisions/Save As/restart. Real user profiles and stored credentials are not copied into these tests.

The portable remains Windows x64, with the existing app ID and external profile path. It is unsigned. Source/package scanning excludes personal data and credential-shaped values. 282 packaged runtime/source assets match byte for byte; the build-generated package metadata reports version 3.8.0. See the Release asset and SHA256SUMS.txt for the binary checksum; the published download is separately downloaded and launched before final completion is reported.

Candidate asset: `Chaessi-Preset-v3.8.0-x64.exe`, **153184753 bytes**. SHA-256: `a73efc7810864dd3916d6ea1cf147e16d9def77a7ca9e4a45a1c40664bf0f335`.

## Scope and remaining limits

No new live NovelAI calls were needed for this release finalization. The earlier 18 live comparisons used separate clothed, nonsexual synthetic prompts. They are not a regeneration of every personal source image. Exact pose, hands, head, gaze and background preservation remain model limitations; independent pan/tilt/height/roll effects can be unstable. The gaze experiment starts off. PNG/WebP metadata alone does not carry every camera session and correction record.

Real credentials, billing attribution, every possible prompt and macOS/Linux were not tested in the finalization suite. No guarantee of zero generation cost is made.

The inherited lockfile reports four production dependency advisories (two high, two moderate) in npm audit: body-parser, fast-uri, ip-address and zod. This camera release does not perform an unrelated dependency-major migration. The application HTTP server uses native Node HTTP; the bundled MCP server uses local stdio, not Express/body-parser HTTP transport. This narrows exposed paths but is not a claim that the dependencies are vulnerability-free. [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [body-parser advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828).

## Reproduce

Use Node.js and installed project dependencies, plus Playwright via `CHAESSI_PLAYWRIGHT` if it is not installed locally. All executable checks require Windows.

`node --test tests/*.test.mjs` · `node scripts/run-regressions.mjs` · `node scripts/verify-camera-requests.mjs` · `node scripts/verify-camera-workflow.mjs`.

Set `CHAESSI_NEW_PORTABLE` to the release EXE, then run `scripts/verify-portable-camera.mjs`, `scripts/verify-portable-release.mjs` and `scripts/verify-portable-features.mjs`. For `scripts/verify-upgrade-portable.mjs`, also set `CHAESSI_OLD_PORTABLE` to official v3.7.0 and `CHAESSI_UPGRADE_BASELINE` to an untouched v3.7.0 source checkout. These use synthetic isolated profiles and no paid provider calls.
