# Phase 5.5 — Position 실사 비교 및 추가 인물 원인 분리

## A. 실험 조건

두 dry-run은 동일 request, scene-plan, prompt, seed, model, resolution, preset, camera, background,
lighting, pose, action, expression, undesired를 사용했다. Prompt-only SHA-256도 두 run 모두
`0f02c0d699b88ba524951569e9aea950732e8beede44a447a74762d359ca9bdf`로 일치했다.

- seed: `25050901`
- model: `nai-diffusion-5-full`
- resolution: `832×1216`
- actor coordinate: `(0.30, 0.55)`
- 유일한 변수: `positionPolicy=anchor-only` 대 `positionPolicy=same`

Director Slot에는 사람 명사와 인칭 대명사를 사용하지 않았다. production builder, adapter,
server, generationStore, UI는 실험을 위해 수정하지 않았다.

## B. Dry-run 비교

| 항목 | Run A | Run B |
|---|---|---|
| 정책 | Anchor only | Anchor + Modifier same |
| Anchor coords | custom `(0.30, 0.55)` | custom `(0.30, 0.55)` |
| Modifier coords | AI's Choice | custom `(0.30, 0.55)` |
| `use_coords` | `false` | `true` |
| payload validation | **PASS** | **PASS** |
| prompt hash | 동일 | 동일 |

현재 V5 builder는 모든 Character Prompt slot이 custom일 때만 `use_coords=true`로 만든다. Run A는
Anchor 좌표가 payload에 들어 있어도 전역 좌표 사용이 꺼지므로 의미 있는 custom-position 이미지
실험이 아니다. 따라서 `UNTESTABLE_WITH_CURRENT_BUILDER`로 판정하고 이미지를 생성하지 않았다.

## C. 실제 생성

Run B만 실제 NovelAI 요청 1회를 보냈다. 첫 실행 시도
`phase5_5_B_20260909_001`은 Local API health 전에 중단됐고 generation POST는 0회였다. API를
복구한 뒤 `phase5_5_B_20260909_002`에서 generation POST 1회로 완료했다. 자동 retry는 없었다.

| 항목 | Run A | Run B |
|---|---|---|
| 생성 여부 | 아니오 | 예 |
| HTTP | 해당 없음 | **PASS** |
| actor 수 | 미측정 | 2 |
| identity | 미측정 | **PASS** |
| outfit | 미측정 | **PASS** |
| position | 미측정 | **PASS** — 주인공이 왼쪽에 배치됨 |
| extra actor | 미측정 | **FAIL** — 데스크 뒤 남성 1명 추가 |

Run B generation ID는 `2026-09-08_233524_5ebf76`이다. 실제 저장 payload의 prompt hash도 dry-run
B와 같았다. 원본 base preset SHA-256은
`8430613fc986e0a53c1de29e4d56fa2b33e50545dfec3f2b6e7ac5ae73e8c057`로 유지됐다.

## D. 판정

**Inconclusive**

Director Slot의 `bellhop`, `her`를 제거한 뒤에도 Run B에서 두 번째 인물이 생성됐다. 따라서
Phase 5의 actor cue가 추가 인물의 필수 원인은 아니다. 그러나 Run A가 현재 builder에서 좌표를
활성화할 수 없어 Modifier coordinate만 제거한 실제 대조군을 얻지 못했다. 결과는 Modifier의
동일 좌표, Anchor/Modifier 분할, camera-only Character Prompt slot 자체 중 어느 하나를 단독
원인으로 확정하지 못한다. Anchor/Modifier 및 Director Slot 구조는 계속 의심 대상이다.

## E. Composer 정책 제안

**Position mapping 재설계 필요**

현재 `same` 정책을 안전하다고 판정할 근거가 없고, `anchor-only`는 production builder에서
`use_coords=false`가 되어 요청 좌표가 비활성화된다. 정책을 즉시 바꾸기보다, 비배우 slot을
좌표 계산과 actor 해석에서 분리하면서 실제 Anchor 좌표를 활성화할 수 있는 payload 표현부터
설계해야 한다.

## F. Artifact

- `tmp/phase5-5/run-a-dry/`
- `tmp/phase5-5/run-b-dry/`
- `tmp/phase5-5/position-comparison.json`
- `<dataRoot>/data/image-maker-runs/phase5_5_B_20260909_002/`

실제 run에는 request, Director plan, guard report, resolved preset, payload, generation result,
semantic review, position comparison, run manifest를 저장했다.

## G. Regression

Phase 1~5 전체 **25/25 PASS**. `git diff --check`도 통과했다.

## H. 다음 단계

**2. Position 추가 실험**을 추천한다. 다음 실험은 이미지를 늘리기 전에, 비배우 Director/Modifier
slot이 있어도 Anchor 2, 4, 6…의 좌표만 실제 actor coordinate로 적용할 수 있는 payload 설계를
먼저 검증해야 한다.
