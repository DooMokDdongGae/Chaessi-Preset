# Phase 4.5 — Subject Mapping + Position Pad + Actor-count Guard

## A. Subject Mapping

Base subject count는 NAI Character Prompt 개수가 아니라 실제 actor 목록의 preset category에서 계산한다.

| actor 구성 | Base |
|---|---|
| girl 1 | `1girl` |
| girl 2 | `2girls` |
| girl 1 + boy 1 | `1girl, 1boy` |
| boy 2 | `2boys` |

기본 subject는 `girl`, `boy`만 지원한다. `Director Slot`에는 subject token이 없어야 하고,
`Actor Anchor`에는 actor 성별 token이 정확히 한 번 있어야 하며, `Actor Modifier`에는
`girl`, `boy`, `1girl`, `1boy`, `2girls`, `2boys` 등이 없어야 한다. 저장 preset이나 shot
prompt에 잘못 들어온 선언은 제거하고 Base/Anchor를 다시 만든 뒤 `validateSubjectMapping()`으로 검사한다.

```text
Base                → 실제 actor count
Character 1         → Director
Character 2         → Actor 1 Anchor: girl/boy + identity
Character 3         → Actor 1 Modifier: outfit + action + expression + state
```

## B. Semantic Guard

`actor-count-semantic-guard.js`는 Director가 새로 만든 positive prompt만 검사한다. 저장 identity,
outfit, UC는 대상이 아니다. `another person`, `arriving guest`, `customer`, `someone`, `staff member`,
`passerby`, `couple`, `group`, `crowd` 등을 최소 필요 actor 수와 비교한다.

결과 예:

```json
{
  "type": "implicit-extra-actor",
  "term": "arriving guest",
  "declaredActors": 1,
  "minimumActors": 2,
  "location": "base.supplement",
  "resolution": "safe-rewrite"
}
```

검증된 deterministic rewrite는 현재 하나다.

```text
welcoming an arriving guest
→ holding a professional welcoming pose
```

탐지 기록은 rewrite 후에도 남는다. 나머지는 `warning`과 `requiresSemanticReview=true`로 반환하며
actor를 추가하거나 장면을 새로 만들지 않는다. `guest ledger`, `guest room`, `guest key` 등은
사람이 아니므로 제외한다. 직업이나 역할 자체를 묘사하는 `staff member` 등에는 false positive가
가능하므로 warning을 자동 오류로 승격하지 않는다.

두 actor가 선언된 `The woman welcomes the male guest`는 정상 통과한다. `crowd`와 `group`은
최소 3명으로 본다.

## C. Position Pad Integration

scene-plan/v2의 backward-compatible 선택 필드:

```json
{
  "characterPresetId": "character_actor_1",
  "visibleFeaturesPrompt": "",
  "scenePrompt": "left side, standing",
  "undesiredPrompt": "",
  "position": { "x": 0.30, "y": 0.55 }
}
```

좌표는 actor-level 속성이며 Anchor/Modifier가 별도 actor 위치를 갖지 않는다. Composer는 이를
NAI coordinate payload에 mapping한다. 명시 좌표가 없으면 해당 actor slot은 AI's Choice다.

| 후보 | payload 결과 | 판정 |
|---|---|---|
| A — Anchor custom, Modifier auto | `use_coords=false` | 현 builder에서는 전체 좌표가 비활성화되어 실험용 |
| B — 같은 좌표 | `use_coords=true` | **기본 권장** |
| C — x를 0.005 분리 | `use_coords=true` | 인위적 분리이며 결합 개선 근거가 없어 실험용 |

Character Prompt 1의 Director Slot과 3, 5…의 Modifier Slot은 독립 배우가 아니다. 실제 actor를
대표하는 Anchor Slot 2, 4, 6…의 좌표가 의미를 가진다. 현재 V5 builder는 모든 slot이 custom일
때만 `use_coords=true`가 되므로 방식 B에서는 비배우 slot에도 전송상 같은 좌표가 들어가지만,
이는 actor 수나 별도 위치 선언으로 계산하지 않는다.

Dry-run 증거는 `tmp/phase4-5/position-mapping.json`에 저장했다. slot order의 x가 감소하거나
`left` prompt와 x>0.5, `right` prompt와 x<0.5가 충돌하면 compilation을 거부한다.

방식 B의 실제 이미지상 결합 효과는 Phase 5 실제 생성에서 추가 actor가 나타나 완전히 입증되지
않았다. 당시 Director Slot의 depth 문장에도 actor 단서가 있어 좌표와 문장 중 어느 쪽이 주원인인지는
분리 실험 전까지 미확인이다.

## D. 테스트

| Test | 결과 |
|---|---|
| 1 girl | **PASS** |
| 2 girls | **PASS** |
| girl + boy | **PASS** |
| implicit actor | **PASS** |
| explicit second actor | **PASS** |
| position mapping A/B/C | **PASS** |
| position/order conflict | **PASS** |

추가로 Danbooru fallback, requiring conflict, 실제 category catalog 검사를 유지했다.

## E. Regression

Phase 1~4와 Phase 4.5를 합쳐 **19/19 PASS**했다. 기존 CLI test는 child process를 사용하므로
child 실행이 허용된 환경에서 전체 검사를 실행했다. 기존 v1 composition, CLI overwrite 방지,
Director 단일/화보/sequence 계약이 모두 유지됐다.

## F. 실제 이미지 테스트

수행하지 않았다. 방식 A는 dry-run에서 좌표 비활성화가 확인됐고 B/C는 payload 차이가 정확히
기록됐다. 실제 비교에는 동일 조건 3장이 필요하지만, Phase 4에서 이미 한 장을 사용했고 이번 단계의
목표는 semantic 구조 보정이다. 자동으로 추가 seed나 이미지를 소비하지 않았다.

## G. 다음 단계 추천

**1. Director → Composer → NAI 단일 이미지 완전 자동화**를 추천한다.

Anchor/Modifier subject 규칙, actor-level position, implicit actor guard가 갖춰졌다. 다음 단계는
Director 호출 결과를 Composer에 연결하고 structured warning 또는 safe rewrite를 사용자에게
보이는 단일 이미지 실행 흐름으로 묶는 것이다.
