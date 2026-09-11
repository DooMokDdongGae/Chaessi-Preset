# Preset Composer v2 Composition Policy

## 처리 경로

```text
chaessi-scene-plan/v2 shot
→ 실제 preset ID/category/enabled 검증
→ Base + semantic Director/Anchor/Modifier slots
→ NAI character slot 번호 매핑
→ randomizer 확정
→ resolved chaessi-preset/v2
→ buildModeGeneratePayload()
→ validateV5Payload()
```

## Merge / Replace 규칙

| 요소 | 정책 | 근거 |
|---|---|---|
| base preset | params, sources, metadata 및 기본 base/UC를 보존 | 기존 V5 설정과 저장 자산이 실행 기준이다. |
| 기존 base character slots | replace | 이전 장면의 camera/identity/outfit 누출을 막고 v2 semantic slots로 다시 만든다. |
| character identity | preserve | 저장된 identity prompt/UC를 Anchor Slot에 사용한다. 기존 subject 선언을 제거한 뒤 `girl` 또는 `boy`를 정확히 한 번 앞에 둔다. |
| visible features | append | Director가 현재 보이는 원본 특징만 추가할 수 있다. 빈 값이면 identity를 재작성하지 않는다. |
| outfit | replace | Actor Modifier Slot은 선택된 outfit ID 하나를 사용한다. base의 기존 outfit slot은 남기지 않으며 outfit 안의 subject token도 제거한다. |
| actor action/pose/expression/state | append | shot별 `scenePrompt`를 선택 outfit 뒤에 붙인다. expression은 actor 단위이며 Director Slot에 넣지 않는다. Modifier의 subject token은 제거한다. |
| style | explicit replace | `stylePresetId`가 있으면 base positive/UC를 해당 style preset으로 교체한다. UI에서 component preset을 Base에 로드할 때의 replace 동작을 따른다. null이면 base prompt/UC를 보존한다. |
| quality | append | 선택 quality preset의 positive/UC를 base에 추가한다. NovelAI quality toggle suffix는 builder가 별도로 처리한다. |
| camera | shot replace | 기존 camera character slot을 폐기하고 선택 camera preset 및 shot camera metadata로 Director Slot을 만든다. |
| lighting | append to Base | 여러 actor와 공간 전체에 적용되는 전역 조명으로 취급한다. |
| background/environment | append to Base | `generation.mainPrompt`와 supplement에서 subject count를 제거한 뒤 전역 scene 정보로 추가한다. |
| global undesired | append | style/base UC 뒤에 quality, lighting, shot UC 순으로 추가한다. |
| actor undesired | scoped append | identity UC는 Identity Slot, outfit UC와 shot actor UC는 Scene Slot에 둔다. |

단순 문자열 append가 의미 충돌을 만들 수 있는 outfit과 camera는 이전 slot을 보존하지 않는다.
동명 preset은 사용하지 않으며 ID가 실제 파일 내부 ID와 같은지도 검사한다.

## 실제 category 계약

| 선택 필드 | 허용 category |
|---|---|
| `characterPresetIds[]` | `여성 캐릭터`, `남성 캐릭터` |
| `outfitPresetIds[]` | `여성 의상`, `남성 의상` |
| `stylePresetId` | `그림체` |
| `qualityPresetId` | `품질` |
| `cameraPresetId` | `구도·카메라` |
| `lightingPresetId` | `조명` |

outfit 배열은 비어 있거나 actor 수와 같아야 한다. Character의 `girl`/`boy` subject와 Outfit의
여성/남성 분류는 독립적이다. `여성 캐릭터 + 남성 의상`, `남성 캐릭터 + 여성 의상`을 포함해
사용자가 선택한 Outfit을 그대로 허용하며, Outfit category는 정렬·검색·분류 metadata일 뿐
selection restriction이 아니다. 다만 Character 필드에는 캐릭터 category, Outfit 필드에는 의상
category가 들어가야 하는 preset type 검사는 유지한다. 모든 component preset은
`enabled !== false`이고 prompt가 비어 있지 않아야 한다.

## Semantic slot과 NAI 번호

```text
Director Slot       → Character 1
Actor 1 Anchor      → Character 2
Actor 1 Modifier    → Character 3
Actor 2 Anchor      → Character 4
Actor 2 Modifier    → Character 5
...
```

기본 `same` 정책에서는 Anchor/Modifier 쌍이 actor-level center 하나를 공유한다. 명시적
`generation.characters[].position`이 없으면 left/right 표현 또는 actor 순서로 좌표를 추론한다.
Director Slot은 중앙에 둔다. 최종 mapping은
`naiSlotMap`에 기록하여 번호를 business logic에 흩어 놓지 않는다.

`anchor-only`는 Modifier가 auto라 현 builder의 all-custom 조건을 깨고 `use_coords=false`가 된다.
`near-same`은 좌표를 인위적으로 0.005 분리한다. 기본값은 actor 의미를 그대로 보존하면서
`use_coords=true`가 되는 `same`이다.

## Danbooru와 interaction validation

- 이미 주어진 태그 → exact → 한국어 `키워드:` alias → 명확한 category 순으로만 판정한다.
- `exact`와 유일 alias인 `high`만 태그로 쓴다.
- `candidate`와 미확인 표현은 원문 자연어를 유지한다.
- embedding semantic search는 기본 compilation에서 호출하지 않는다.
- `requiring.txt`의 action 전제 의상이 outfit prompt에 없으면 `requirement-conflict`를 반환한다.
- `source#`, `target#`, `mutual#`의 action은 로컬 action tag로 확인하고 짝을 검사한다.
- 별도 character array를 쓰므로 randomizer 해소 뒤 단일 `|`가 남으면 거부한다.

## 현재 경계

Composer는 shot 하나만 컴파일한다. retry, resume, batch 순서, multi-shot manifest, Frontend 상태는
다루지 않는다. 자연어가 암시하는 사람 수와 실제 렌더링 결과까지 결정적으로 보장하지 못한다.
