# `chaessi-scene-plan/v2` 계약

v2는 감독 메타데이터와 생성 문자열을 분리하고, 한 장·독립 화보·연속 장면을 같은 구조로
표현한다. 실행 설정을 새로 만드는 payload 형식이 아니며 preset 선택과 shot 계획이다.

## 최상위 구조

| 필드 | 의미 |
|---|---|
| `schema` | `chaessi-scene-plan/v2` |
| `request` | 사용자의 원문 의도 |
| `mode` | `single`, `editorial`, `sequence` |
| `count` | 1 이상의 사용자 지정 정수, shots 길이와 같음 |
| `presetSelections` | base 및 character/outfit/style/quality/camera/lighting ID |
| `continuity` | identity/outfit/location/props/screenDirection의 locked/tracked/free 정책 |
| `shots` | 순서가 있는 shot 목록 |

`presetSelections`는 null과 빈 배열을 명시한다. `basePresetId`는 현재 v1 Composer 연결을
위해 필수다. 캐릭터별 생성 항목은 선택된 `characterPresetIds`만 참조할 수 있다.

## shot 구조

- `id`, `index`: `shot_001` 형식의 안정된 ID와 1부터 연속되는 순서.
- `intent`, `rhythmRole`, `direction`: 감독과 Frontend가 표시·수정할 연출 메타데이터.
  rhythmRole은 establishing/hero/portrait/action/service/transition/detail/resolution 중 하나이고,
  실제 프레이밍인 direction.shotSize와 별개다.
- `continuity`: 현재 location/outfitState, 안정된 prop ID와 상태, 진행 방향, 이전 shot 참조.
- `generation`: Chaessi Composer가 소비할 실제 문자열과 선택적 seed.

`direction`은 shotSize, cameraHeight/Angle, viewpoint, bodyOrientation, pose, action, gaze,
expression, subjectPlacement, depth, lighting, visibilityRequirements를 분리한다.
`generation.characters`에는 characterPresetId, 현재 보이는 외형, 인물별 동작·위치,
인물별 undesired를 둔다. 선택 필드 `position: { x, y }`는 0~1 범위의 actor-level normalized
좌표다. Anchor와 Modifier가 같은 actor를 기술하므로 둘의 원본 위치는 하나다. 좌표가 없으면
AI's Choice로 둔다. 전역 undesired는
`generation.undesiredPrompt`다.

`visibleFeaturesPrompt: ""`는 원본 캐릭터 preset을 그대로 쓰라는 뜻이다. 값을 쓸 때는
현재 샷에서 실제 보이는 원본 특징만 사용해야 하며 새로운 정체성을 창작하는 필드가 아니다.

기본 Image Maker의 subject type은 `여성 캐릭터 → girl`, `남성 캐릭터 → boy`만 지원한다.
Base count는 generation character 항목 수와 category에서 계산한다. NAI Character Prompt slot
수는 Director 1개와 actor별 Anchor/Modifier 2개이므로 actor count와 같지 않다.

Character subject와 Outfit 분류는 서로 독립적이다. Outfit의 여성/남성 category는 preset type과
분류를 나타내지만 actor에게 입힐 수 있는지를 제한하지 않는다. Director와 Composer는 사용자가
선택한 Outfit ID를 성별 조합 때문에 교체하거나 거부하지 않는다.

## 검증 경계

[image-director-contract.js](../../src/state/image-director-contract.js)는 엄격한 필드·타입·ID,
count/index/reference, locked 상태, sequence carriesFrom, 정확한 샷 서명 중복과 몇 가지 알려진
시점 모순을 검사한다. 실제 preset ID 존재 여부, 시각적으로 비슷한 샷, 물리적 자연스러움,
사용자 의도 충족, 태그 품질은 의미 검토 또는 미래 Composer가 검사한다.

멀티샷 요청은 `chaessi-image-request/v2`로 받고 `count`를 임의의 프로젝트 상한으로 자르지
않는다. 다만 각 shot은 고유 ID와 연속 index를 가져야 하며 `shots.length === count`를
만족해야 한다. Phase 6 실행기는 전체 shot을 먼저 preflight한 뒤 기존 단일-shot Composer와
생성 경로로 순차 실행한다.

현 v1으로 손실 없이 실행 가능한 shot은 `generation.characters`와 undesired override가 없는
경우뿐이다. `projectShotToScenePlanV1()`은 그런 shot을 기존 `chaessi-scene-plan/v1`으로
변환하고, 정보 손실이 생기는 shot은 거부한다.

대표 예제:

- [단일 이미지](../../examples/image-maker/director-single.json)
- [6장 화보](../../examples/image-maker/director-editorial-6.json)
- [4컷 연속 장면](../../examples/image-maker/director-sequence-4.json)
