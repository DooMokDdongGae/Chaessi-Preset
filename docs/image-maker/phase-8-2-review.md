# Chaessi Image Maker Phase 8.2 검토 보고서

## A. Base

```text
v3.2.1 base commit: 1fe382f860a618f68a151d953fc5682867d67c6f
Image Maker source base commit: 95a33648a142d3c3b5a80b42d04bef878776f67c
Image Maker source state: uncommitted Phase 0–8.1A working tree on codex/v3.1.1-work
migration branch: codex/image-maker-v3.2.1-port
```

현재 작업 저장소의 로컬 `v3.2.1` 태그는 다른 커밋 `9613df1`을 가리켰다. 깨끗한 배포 저장소
별도 기준 저장소의 `main`, `origin/main`, `v3.2.1`이 모두 가리키는
`1fe382f`를 authoritative base로 사용했다. 기존 v3.1.1 작업 폴더와 미커밋 변경은 덮어쓰거나
reset하지 않았다.

## B. Migration Matrix

세부 표는 `phase-8-2-migration-matrix.md`에 있다.

- 그대로 포팅: Image Maker service/state/UI controller, CLI, examples, docs, 지정 테스트
- manual merge: `server.mjs`, `electron/server-process.mjs`, `index.html`, `src/app.js`,
  `styles.css`, `src/api/client.js`
- v3.2.1 유지: `generation-store.js`, V5/V4.5 adapter, preset schema/store, Position Pad,
  History modules, package/build configuration
- v3.2.1 기준 보정: 구조화 API 오류의 `details` 객체가 `[object Object]`로 표시되지 않도록
  public message와 details를 분리했다. 한 장 UI E2E를 위해 v2 count를 양의 정수로 정리했다.

## C. v3.2.1 Preservation

| 기능 | 결과 | 검증 |
| --- | --- | --- |
| V5 T2I | PASS | V5 adapter/contract tests와 실제 Image Maker 생성 |
| V5 I2I | PASS | adapter, multipart, RGBA source 회귀 |
| V5 Inpaint | PASS | native infill payload, mask/storage 회귀 |
| V4.5 T2I/I2I/Inpaint | PASS | 기존 generation mode 회귀 |
| Position Pad | PASS | 기존 UI 보존, 0.001 precision, 32-slot cap migration test |
| History | PASS | batch delete 및 modal navigation 회귀 |
| Preset Workshop | PASS | UI 공존, preset/model/generation wiring 및 기존 회귀 |
| Portable Electron | PASS | `npm run electron:pack`으로 `dist/win-unpacked` 생성 |

실제 NAI 비용은 Image Maker E2E 한 장에만 사용했다. Workshop의 별도 실사 생성은 하지 않았다.

## D. Image Maker

최종 흐름은 다음과 같다.

```text
v3.2.1 Electron
→ Image Maker UI
→ actual preset catalog
→ Codex CLI Director Bridge
→ scene-plan/v2 card
→ complete preflight
→ Composer v2 / v3.2.1 V5 payload
→ existing /api/novelai/generate
→ existing generationStore
→ Image Maker Gallery / Recent Runs
```

UI, manual plan fallback, plan cache, semantic guard, cross-gender Outfit 정책, single/multi runner,
sequential generation, partial failure, prompt/metadata/payload detail, Recent Runs를 유지했다.

## E. Authentication

```text
Codex: codex-cli 0.153.4, Logged in using ChatGPT
NovelAI: configured, source = safe_storage
safeStorage: existing Electron token provider, storage = electron_safe_storage
```

Codex Bridge는 `CHAESSI_CODEX_EXECUTABLE`만 server child에 전달한다. NovelAI token은 기존
safeStorage → token provider → server 흐름을 사용한다. Frontend와 생성 artifact에서 token 문자열은
발견되지 않았다.

## F. Cross-gender Outfit

실제 UI에서 다음 조합을 선택했다.

```text
Character: 민서 (남성 캐릭터)
Outfit: 플래드 클럽 돌 (여성 의상)
```

Codex plan 1 shot이 생성됐고 Preflight는 `Ready — 1 / 1 shots ready`였다. gender compatibility
warning이나 review는 없었다. 반면 Outfit selector에 Character preset을 넣는 실제 type mismatch는
계속 `preset-category-mismatch`로 차단된다.

## G. Position

Image Maker actor position은 v3.2.1 preset의 `centers`와 `position_mode`로 변환된 뒤 기존 V5 builder가
`characterPrompts[].center`와 `use_coords`를 만든다. 지정 좌표는 소수점 셋째 자리까지 보존되며,
기본 정책은 Anchor와 Modifier에 동일 actor 좌표를 준다. 이번 단일 actor plan은 position을 지정하지
않아 AI's Choice였고 실제 payload의 `use_coords`는 `false`였다.

## H. Tests

| 묶음 | 결과 |
| --- | --- |
| Phase 1–8.1A 지정 Image Maker tests | 52/52 PASS |
| Phase 8.2 migration tests | 8/8 PASS |
| v3.2.1 기존 regression files | 21/21 PASS |
| JavaScript syntax / diff whitespace | PASS |
| Electron unpacked packaging | PASS |

Migration tests는 v3.2.1 catalog, cross-gender Outfit와 type gate, 0.001 좌표 및 32-slot cap,
Codex Bridge, 2-shot dry-run, Workshop/History/Position Pad 공존, count 1 orchestration, structured API
오류 표시를 검사한다.

## I. Electron E2E

```text
request: 현대적인 호텔 로비의 남성 직원 편집 화보
count: 1
mode: editorial
generation ID: 2026-09-09_131610_71d31c
seed: 3412768098
model: nai-diffusion-5-full
resolution: 832 x 1216
PNG: Electron userData 아래 `data/generations/<date>/<generation-id>.png`
run: Electron userData 아래 `data/image-maker-runs/<run-id>`
```

버전 3.2.1, Codex/ChatGPT 인증, safeStorage token source, Director plan, shot card, Preflight READY,
NovelAI 성공 응답, PNG/sidecar/payload, completed manifest, Gallery 1 card를 확인했다. Generate는 한 번만
호출했고 자동 retry는 없었다.

렌더 결과에는 payload에 선언된 남성 actor 외에 여성 한 명이 추가됐고 선택한 Outfit은 주로 그 여성에게
적용됐다. payload는 `1boy`, male Anchor, 선택 Outfit Modifier를 유지하므로 renderer-added artifact와
Outfit adherence 관찰로 기록한다. Phase 6 정책에 따라 포팅 구조 실패로 판정하지 않는다.

## J. User Data

기존 preset, generation, token, metadata를 이동·변환·삭제·덮어쓰지 않았다. 실제 E2E가 새 Director
artifact, Image Maker run, PNG, sidecar, payload를 기존 data root 아래에 추가했다. Runner의 base preset
전후 hash 검사도 통과했다. Recent Runs에서 기존 및 현재 manifest 14개를 변환 없이 읽었다.

## K. Confirmed Issues

- 두 저장소의 `v3.2.1` 태그가 서로 다른 커밋을 가리켜 배포 저장소의 `1fe382f`를 명시적으로 선택해야 했다.
- 새 worktree의 첫 packaging은 `node_modules` 부재로 Electron 버전을 찾지 못했다. 기존 설치 의존성을
  junction으로 연결한 뒤 같은 package/lock 환경에서 packaging이 통과했다.
- 구조화 API 오류의 object `details`가 UI에서 `[object Object]`로 표시될 수 있어 message 선택 로직을 수정했다.
- 실제 렌더에는 추가 인물과 Outfit adherence 편차가 있었다. 전달 payload와 저장 구조는 정상이다.

## L. Unconfirmed

- V5 I2I/Inpaint와 V4.5 모드는 자동 adapter/multipart/storage 회귀까지만 수행했고 실제 NAI 요청은 보내지 않았다.
- Preset Workshop에서 별도의 실제 NAI 생성은 비용 절약을 위해 수행하지 않았다.
- `electron:pack`의 unpacked build는 확인했지만 public portable EXE release와 서명 배포는 범위대로 수행하지 않았다.
- 모든 과거 Image Maker artifact schema를 전수 열람하지는 않았다. 현재 Recent Runs 목록은 기존 항목을 정상 표시한다.

## M. Next step

다음 단계로 **Director model optimization**을 추천한다. 포팅된 Bridge와 cache가 v3.2.1에서 실제로
검증됐으므로, 동일 benchmark로 Director 전용 모델 비용과 scene-plan 품질을 비교할 수 있다.
