# Chaessi Image Maker Phase 7 검토 보고서

## A. UI Architecture

기존 화면 상단에 `Preset Workshop`과 `Image Maker` workspace tab을 두고, Image Maker를 별도
top-level view로 추가했다. 화면 로직은 `src/ui/image-maker-controller.js`, 순수 상태 투영은
`src/ui/image-maker-state.js`, 서버 연결은 `src/services/image-maker-api.js`가 담당한다.

Frontend는 Composer, NovelAI adapter, generationStore를 직접 호출하지 않는다. 다음 API를 통해
기존 Phase 5/6 실행기를 사용한다.

```text
GET  /api/image-maker/catalog
POST /api/image-maker/preflight
POST /api/image-maker/generate
GET  /api/image-maker/runs
GET  /api/image-maker/runs/:runId
GET  /api/image-maker/runs/:runId/shots/:shotId/:detail
```

## B. Request Panel

사용자는 자연어 요청, Editorial/Sequence, 임의의 양의 정수 count, Base, Character, Outfit,
선택적인 Style/Quality와 base seed를 입력한다. 실제 preset catalog를 기존 preset store와
character preset store에서 읽으며 ID는 화면에 노출하지 않고 option value로 유지한다.

## C. Director Plan

Phase 7에서는 LLM을 호출하지 않는다. 외부에서 작성한 `scene-plan/v2`를 JSON textarea에
붙여넣거나 파일로 불러온다. plan 공급과 preflight/generation 호출이 분리되어 있으므로 향후
Codex Bridge는 plan 공급 부분만 교체할 수 있다.

## D. Shot Preview

각 shot card에는 shot 번호, framing, camera angle/view, placement, pose/action, gaze,
expression, 실제 actor position, sequence continuity를 읽기 쉬운 형태로 표시한다. 원본 shot
JSON은 `Details` 안에 접어 두었다.

## E. Preflight

`Run Preflight`는 Phase 6 multi-runner를 dry-run으로 실행하므로 NAI 호출은 0회다. 전체 상태와
shot별 `READY`, `NEEDS REVIEW`, `FAILED`를 표시한다. semantic guard의 safe rewrite는 원문과
수정문을 표시하고, review 또는 failure가 하나라도 있으면 Generate를 비활성화한다.

## F. Generation

모든 shot이 ready일 때만 실제 count가 포함된 Generate 버튼을 활성화한다. 클릭 직후 버튼을
비활성화하고 operation ID를 사용해 같은 동작의 중복 요청을 막는다. UI는 run ID로 실제
manifest를 polling하며 순차 shot 상태와 완료 수를 표시한다. 실패한 shot에서 기존 runner가
멈추고, 완료된 결과는 그대로 유지한다. 자동 retry는 없다.

## G. Result Gallery

완료된 generation을 shot 순서로 표시하고 generation ID, seed, resolution을 함께 보여준다.
각 결과에서 실제 저장 artifact를 기반으로 다음을 열 수 있다.

- Prompt: Base, Character slot들, Undesired
- EXIF / Metadata: generationStore sidecar
- Payload: execution artifact의 raw V5 payload

기존 completed multi-run도 Recent Image Maker Runs에서 다시 열 수 있다. New Request는 화면
입력만 초기화하고 기존 이미지와 run artifact를 삭제하지 않는다.

## H. Security

renderer는 data root나 임의의 로컬 경로를 직접 읽지 않는다. 이미지와 artifact는 서버 API를
통해서만 조회한다. NovelAI token은 API 응답, UI state, DOM, renderer source, run artifact에
포함되지 않는다. server의 기존 인증 처리도 변경하지 않았다.

## I. Tests

| Phase 7 테스트 | 결과 |
|---|---|
| Preset catalog 분류 | PASS |
| Request state 변환과 arbitrary count | PASS |
| 3-shot plan card 투영 | PASS |
| READY 시 Generate 활성 | PASS |
| NEEDS REVIEW 시 Generate 차단 | PASS |
| 순차 progress 투영 | PASS |
| 완료 gallery shot 순서 | PASS |
| partial failure 결과 보존 | PASS |
| token/frontend secret safety 및 중복 클릭 방지 | PASS |
| 화면/API wiring | PASS |

## J. Regression

Phase 1~6 기존 33개와 Phase 7 신규 10개를 함께 실행해 **43/43 PASS**했다. 새 파일과 수정된
JavaScript의 syntax check 및 `git diff --check`도 통과했다.

## K. 실제 UI E2E

Chrome에서 실제 사용자 data root와 preset catalog를 사용해 다음 흐름을 확인했다.

```text
Image Maker 진입
→ 실제 preset 선택
→ count 2 / editorial
→ 외부 scene-plan/v2 준비
→ shot card 2개 표시
→ preflight READY 2/2
→ Generate 2 Images 클릭
→ 실제 backend status polling
```

생성 run ID는 `ui_generate_32387702_b0e3_4c15_951b_741ea606bfd4`, seed는 26070901과
26070902, 해상도는 832×1216이었다. 실제 NAI 요청은 shot-001에서 **1회** 전송됐고 HTTP 401을
받아 자동 retry 없이 중단됐다. 상태는 `failed`, 완료 수는 0/2이며 shot-002는 요청하지 않았다.
이 검증은 Electron child process가 아닌 별도 standalone UI 시험 서버(4197)에서 수행됐다. 이
프로세스는 Electron safeStorage를 복호화할 수 없어 로컬 환경변수의 별도 토큰을 사용했다.

따라서 standalone 시험 서버에서 새 PNG까지 도달하는 UI E2E는 **AUTH 단계에서 미완료**다. UI의 실패
표시와 재조회는 확인했으며, 새로고침 후에도 다음 정보가 표시됐다.

```text
Shot 01 FAILED
Shot 02 READY
Local API request failed with HTTP 401.
```

Gallery와 상세보기는 기존 completed run `phase6_editorial2_e2e_20260909_001`을 UI에서 다시
열어 검증했다. 두 결과가 shot 순서대로 표시됐고 Prompt, EXIF/Metadata, Payload가 각각 실제
artifact 내용으로 열렸다.

## L. 남은 문제

Confirmed:

- Phase 7 UI에서 request → plan → preflight → generate click → backend 상태 추적이 연결된다.
- completed/failed run을 다시 열고 gallery와 실패 원인을 복원할 수 있다.
- 실제 Chaessi Electron 서버(4174)는 저장된 NovelAI token을 `safe_storage` source로 읽으며
  동일 token으로 account API가 정상 응답한다.
- Image Maker는 token을 따로 받지 않고 Chaessi의 `/api/novelai/generate`를 호출하므로 실제 앱에서는
  Preset Workshop과 같은 token provider를 공유한다.
- 새 코드로 Chaessi Electron 앱을 다시 시작한 뒤 Image Maker catalog와 화면이 4174에서 정상
  로드되고 기존 Anlas/V5 Stamina 정보가 표시되는 것을 확인했다.
- Electron 밖에서 띄운 standalone 시험 서버의 별도 환경변수 token은 HTTP 401을 반환한다.

Unconfirmed:

- Electron safeStorage가 연결된 실제 Chaessi 앱에서 수행하는 새로운 Phase 7 UI run의 PNG 저장과
  즉시 gallery 전환은 이번 실행에서 확인하지 못했다. 같은 backend 경로의 기존 Phase 6
  completed 결과는 UI에서 정상 조회됐다.
- file chooser는 UI에 구현되어 있으나 현재 자동화 환경이 OS file picker 조작을 차단해 수동 선택은
  실사하지 못했다. JSON paste 경로는 확인했다.

## M. 다음 단계 추천

다음 단계로 **Codex Bridge**를 추천한다. 현재 UI에서 외부 JSON으로 공급하는 Director Plan만
Bridge 출력으로 교체하면 자연어 요청부터 plan 생성까지 연결할 수 있다. 새 생성 E2E는 현재 실행된
Chaessi Electron 앱의 safeStorage 공유 경로에서 retry 없이 한 번 재검증하면 된다.
