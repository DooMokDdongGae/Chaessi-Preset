# Chaessi Image Maker Phase 6 검토 보고서

## A. Multi-shot Architecture

실행 흐름은 다음과 같다.

```text
chaessi-image-request/v2
→ scene-plan/v2 전체 검증
→ exact duplicate 감사
→ shot seed 확정
→ 모든 shot Phase 5 dry-run preflight
→ 전체 ready 판정
→ Local API 공통 preflight
→ shot별 Phase 5 pipeline 순차 실행
→ multi-run manifest
```

- 요청 계약: `src/state/image-maker-multi-request.js`
- orchestration: `src/services/image-maker-multi-runner.js`
- artifact/manifest: `src/services/image-maker-multi-run-store.js`
- 렌더 결과 분류: `src/services/image-maker-render-review.js`
- CLI: `node cli/chaessi.mjs multi-generate ...`

새 생성 builder를 만들지 않고 각 shot을 `runImageMakerRequest()`에 투영한다. Position은 기존
정책대로 실제 actor의 Anchor와 Modifier에 동일 좌표를 적용하며, 좌표가 없는 slot은 따로
고려하지 않는다.

## B. Request Contract

`chaessi-image-request/v2`는 `request`, `count`, `mode`, `presets`, `generation`을 분리한다.
`mode`는 `editorial` 또는 `sequence`이며 `count`는 2 이상의 사용자 지정 정수다. 실행기는
임의의 최대 shot 수를 두지 않으며 `shots.length === count`를 강제한다.

base seed가 있으면 shot N의 seed는 `baseSeed + N - 1`로 확정한다. base seed가 null이면 run
준비 시 한 번 결정한 뒤 모든 artifact와 manifest에 실제 값을 저장한다.

## C. Director

Editorial은 identity/outfit/location을 공유하는 독립 구도를, sequence는 `carriesFrom`과 상태를
통해 이어지는 행동을 표현한다. 다양성 검사는 shot size, camera angle, placement, pose, action,
gaze, expression이 모두 같은 명백한 복제만 자동 차단한다. 한두 개의 핵심 변화로 충분한 경우
나머지 필드를 강제로 바꾸지 않는다.

## D. Preflight

전체 scene-plan 검증과 중복 감사를 먼저 수행한 뒤 모든 shot을 dry-run한다. 각 shot은 semantic
guard, safe rewrite, Composer v2, resolved preset, V5 payload validation을 통과해야 한다. 한 shot이라도
`needs-review` 또는 `failed`이면 모든 NovelAI 호출을 차단한다.

생성 직전에는 Local API health, 인증 경로, data root, base preset을 한 번 더 확인한다.

## E. Generation

모든 shot이 ready인 경우 shot 순서대로 한 장씩 생성한다. 자동 retry와 병렬 요청은 없다.
실패하면 그 shot에서 중단하고 완료된 결과를 보존하며 multi-run을 `partial-failure`로 기록한다.

## F. Artifact

```text
data/image-maker-runs/<multi-run-id>/
  request.json
  director-plan.json
  preflight-report.json
  multi-run-manifest.json
  visual-review.json
  shots/<shot-id>/preflight/...
  shots/<shot-id>/execution/...
```

shot의 execution 폴더는 Phase 5의 request, director plan, guard report, resolved preset, payload,
generation result, run manifest를 그대로 사용한다. PNG와 sidecar는 기존 generationStore에 저장하고
multi manifest가 generation ID와 경로를 참조한다.

## G. Tests

| 테스트 | 결과 |
|---|---|
| Editorial 3 shots | PASS |
| Sequence 4 shots | PASS |
| 사용자 지정 count 7 | PASS |
| exact duplicate detection | PASS |
| 한 invalid shot의 전체 비용 차단 | PASS |
| shot별 position variation | PASS |
| 순차 실행과 partial failure | PASS |
| renderer artifact 분류 | PASS |

Phase 1~6 전체 테스트는 33/33 PASS다.

## H. Actual Generation

실제 V5 editorial 2장을 자동 retry 없이 순차 생성했다.

| Shot | Generation ID | Seed | Resolution |
|---|---|---:|---|
| shot-001 | `2026-09-09_002000_5c33bc` | 26060901 | 832×1216 |
| shot-002 | `2026-09-09_002001_b2f25c` | 26060902 | 832×1216 |

run ID는 `phase6_editorial2_e2e_20260909_001`이며 실제 generation POST는 정확히 2회였다.

## I. Visual Review

- shot-001: 주인공 한 명이 왼쪽에 배치됐고 장부, viewer gaze, 밝은 현대식 로비가 반영됐다.
  eye-level front three-quarter 구도는 읽히지만 요청한 medium보다 넓게 렌더됐다.
- shot-002: 주인공 한 명이 오른쪽에 배치됐고 full-body, profile 계열, 낮은 시점과 창 쪽 시선이
  첫 shot과 구분됐다. 장부 외에 긴 말린 물체와 천 장식이 추가됐다.

두 shot은 camera, placement, action에서 의미 있게 달랐고 structural intent는 통과했다.
shot-002의 추가 소품과 장식은 prompt 구조에 없으므로 `renderer-artifact` observation으로 기록했다.

## J. Renderer Artifact Policy

Director/Composer/payload가 올바른 actor 수와 관계를 전달했는데 결과에만 사람이 추가된 경우,
또는 모델이 임의의 소품·배경 장식을 추가한 경우 pipeline 실패로 처리하지 않는다. structural
failure는 Base count, actor list, 관계, 위치, 행동이 계획과 다르게 컴파일된 증거가 있을 때만 쓴다.
기존 Phase 5/5.5 기록은 당시 판정으로 보존했다.

## K. 다음 단계 추천

다음 단계로 **Image Maker Frontend**를 추천한다. arbitrary count와 mode를 받고 preflight/review,
shot별 진행 상태, 생성 결과를 보여주는 UI를 연결하면 현재 실행기를 사용자가 직접 운용할 수 있다.
