# Phase 5 — Director → Composer → NAI 단일 이미지 자동화

## A. Pipeline

`runImageMakerRequest()`가 다음 순서를 한 실행 단위로 묶는다.

```text
chaessi-image-request/v1
→ provided scene-plan/v2
→ actor-count 및 Director Slot semantic guard
→ 실제 preset catalog
→ Composer v2
→ V5 payload validation
→ loopback Chaessi Local API preflight
→ NovelAI 요청 1회
→ generationStore 파일 검증
→ run manifest
```

핵심 구현은 `src/services/image-maker-runner.js`, 저장 계층은
`src/services/image-maker-run-store.js`, 입력 계약은 `src/state/image-maker-request.js`다.
CLI entry는 `node cli/chaessi.mjs direct-generate`이며 Director LLM 호출 대신 제공된 v2 plan을
소비한다.

## B. Run Artifact

`<dataRoot>/data/image-maker-runs/<run-id>/`에 다음을 저장한다.

- `request.json`
- `director-plan.json`
- `guarded-plan.json`: safe rewrite가 실제로 적용된 경우에만 생성
- `guard-report.json`
- `resolved-preset.json`
- `payload.json`
- `generation-result.json`
- `run-manifest.json`

PNG, sidecar, payload는 기존 generationStore에 저장하고 manifest는 그 상대 경로를 참조한다.
상태는 `prepared`, `needs-review`, `ready`, `generating`, `completed`, `failed` 중 하나다. 기존 run
directory는 덮어쓰지 않으므로 completed run의 중복 생성도 차단된다.

## C. Guard

`welcoming an arriving guest`는 검증된 safe rewrite를 적용한 뒤 계속한다. 안전한 rewrite가 없는
추가 actor 단서는 `needs-review`로 끝내고 Local API를 호출하지 않는다. 실제 E2E 검토에서
camera-only Director Slot의 `bellhop ... behind her`가 별도 인물 단서가 될 가능성을 발견했다.
이후 guard는 Director Slot으로 들어가는 direction 필드의 사람 명사와 인칭 대명사도
`director-slot-actor-cue`로 차단한다.

## D. 실제 E2E

| 단계 | 결과 |
|---|---|
| request | **PASS** |
| Director plan | **PASS** |
| guard | **PASS** |
| Composer | **PASS** |
| payload | **PASS** |
| NAI HTTP | **PASS** |
| PNG/sidecar/payload save | **PASS** |
| manifest | **PASS** |
| semantic render | **FAIL** |

실제 생성은 한 번만 수행했다.

- run: `phase5_e2e_20260909_001`
- generation: `2026-09-08_152726_573cac`
- model: `nai-diffusion-5-full`
- seed: `25050901`
- resolution: `832×1216`
- Local API generation POST: 1회

원본 base preset SHA-256은 실행 전후 모두
`8430613fc986e0a53c1de29e4d56fa2b33e50545dfec3f2b6e7ac5ae73e8c057`로 같았다.

## E. 의미 검토

주인공 여성은 화면 왼쪽, 호텔 유니폼, 장부를 든 자세, 밝은 로비/리셉션이라는 주요 연출을
대체로 만족했다. 그러나 중앙과 오른쪽에 큰 남성 형상이 추가되어 선언 actor 1명과 실제 인물
2명이 불일치했다. run manifest의 semantic review를 `SEMANTIC_RENDER` 실패로 기록했다.

원인 후보는 camera-only Director Slot의 actor 단서와 비배우 slot의 coordinate 결합이다.
actor 단서 차단은 구현하고 수정 예제의 dry-run이 `ready`임을 확인했다. 좌표 원인은 같은 조건의
추가 실사 비교를 하지 않았으므로 미확인이다.

## F. Tests

Phase 1~4.5 회귀와 Phase 5 신규 검사를 합쳐 **25/25 PASS**했다. 신규 검사는 clean single actor,
safe rewrite, needs-review/no-call, duplicate run, dry-run/no-call, Director Slot actor-cue/no-call을
포함한다.

## G. 다음 단계

**Position 실사 비교**를 추천한다. 실제 actor를 대표하는 Anchor Slot 2, 4, 6…만 의미 있는
좌표로 취급한다는 사용자 convention을 유지하면서, Director/Modifier 비배우 slot의 좌표가 V5
렌더에서 actor 분리에 미치는 영향을 최소 이미지 비교로 확인해야 한다.
