# NovelAI Prompting Rules for Chaessi Composer v2

조사일: 2026-09-08. 이 문서는 generation마다 웹을 다시 조회하지 않기 위한 로컬 기준이다.
공식 문서에서 확인한 사실, 사용자가 실제로 써 온 Chaessi 슬롯 방식, 프로젝트가 정한 자동화
정책을 각각 `OFFICIAL`, `USER-CONVENTION`, `PROJECT-POLICY`로 표시한다.

## 공식 출처

- NovelAI Documentation, [Image Generation Models](https://docs.novelai.net/en/image/models/)
- NovelAI Documentation, [Multi-Character Prompting](https://docs.novelai.net/en/image/multiplecharacters/)
- NovelAI Documentation, [Image Generation Basics](https://docs.novelai.net/en/image/basics/)
- NovelAI Documentation, [Tagging](https://docs.novelai.net/en/image/tags/)
- NovelAI Documentation, [Strengthening & Weakening Vectors](https://docs.novelai.net/en/image/strengthening-weakening/)
- NovelAI Documentation, [Prompt Randomizer](https://docs.novelai.net/en/image/promptrandomizer/)
- NovelAI Documentation, [Prompt Chunks](https://docs.novelai.net/en/image/promptchunks/)
- NovelAI Documentation, [Add Quality Tags Toggle](https://docs.novelai.net/en/image/qualitytags/)
- NovelAI Documentation, [Prompt Mixing](https://docs.novelai.net/en/image/promptmixing/)

## 모델과 일반 prompt

| 구분 | 규칙 |
|---|---|
| OFFICIAL | V5 Full은 자연어 이해, 일본어 등 다국어 prompt, 재설계된 character positioning, 다인물 prompt에서 최대 22명의 서로 다른 캐릭터를 지원한다. |
| OFFICIAL | V5 Full base prompt의 표기상 최대 문맥은 약 1,471 effective tokens다. 지나치게 길고 중복된 prompt는 피한다. |
| OFFICIAL | 태그와 자연어를 함께 사용할 수 있다. 중요한 주제와 지시는 prompt 앞 절반에 두는 것이 권장된다. |
| OFFICIAL | 태그는 쉼표와 공백으로 구분한다. 일반 권장 순서는 subject count, character, series, 그 밖의 요소다. |
| OFFICIAL | dataset tag는 base prompt 맨 앞에서 가장 잘 작동한다. V5 전용 complexity tag에는 `low/medium/high/ultra complexity`가 있다. |
| PROJECT-POLICY | Composer는 Director의 명확한 태그는 유지하고 exact/high로 결정되는 로컬 태그만 표준화한다. 나머지는 자연어로 보존한다. |
| PROJECT-POLICY | intent, shot purpose, continuity reason, carriesFrom 같은 감독 metadata는 prompt에 넣지 않는다. |

V5의 Add Quality Tags에서 light는 `very aesthetic, amazing quality, no text`, standard는
`very aesthetic, masterpiece, no text`를 prompt 끝에 더한다. Chaessi V5 builder는 이 동작을
`qualityPreset`과 `tag_hint_qt`로 처리하므로 Composer가 같은 suffix를 다시 작성하지 않는다.

## Multi-Character Prompting

| 구분 | 규칙 |
|---|---|
| OFFICIAL | base prompt는 장면과 스타일 등 전역 정보를 담당하고, 각 character prompt는 한 캐릭터를 기술하여 정보 누출을 줄인다. |
| OFFICIAL | `2girls`, `1girl, 1boy` 같은 수량 태그는 base에 둔다. 개별 character prompt에는 `girl`, `boy`, `other`처럼 숫자 없는 subject를 쓴다. |
| OFFICIAL | character prompt 순서는 보통 위에서 아래, 왼쪽에서 오른쪽 배치를 따른다. 지정 위치와 prompt 순서가 충돌하지 않아야 하며 자연어로 위치를 보강할 수 있다. |
| OFFICIAL | 한 캐릭터의 정보가 다른 캐릭터로 새면 해당 character의 Undesired Content로 막을 수 있다. |
| OFFICIAL | 별도 character prompt box/array 방식이 권장된다. 대안인 단일 `|` 구분 문법과 character prompt box는 혼용할 수 없다. |
| OFFICIAL | V4 이상에서 단일 `|`는 다인물 구분자다. V3 이하의 prompt mixing과 의미가 다르다. |
| USER-CONVENTION | Character 1은 camera/framing 전용 Director Slot이고, 이후 슬롯은 Actor별 Anchor/Modifier 쌍이다. Anchor에만 `girl`/`boy`를 한 번 쓰고 Modifier에는 subject token을 쓰지 않는다. |
| PROJECT-POLICY | Composer v2는 character array만 출력하며 randomizer 해소 뒤 남은 `|`를 거부한다. |

공식 문서는 각 character prompt가 한 캐릭터를 설명하는 방식을 제시한다. Director Slot을 별도
character prompt로 사용하는 것은 공식 규칙이 아니라 사용자가 실제 결과를 검증한 Chaessi 운용법이다.
Composer는 이를 보존하지만, V5의 character prompt 의미와 다른 사용이라는 사실은 계속 추적한다.

## Interaction / Action Tags

| 구분 | 규칙 |
|---|---|
| OFFICIAL | 행동 주체의 character prompt에는 `source#action`, 대상에는 `target#action`을 둔다. |
| OFFICIAL | 두 캐릭터가 같은 행동을 서로에게 하면 양쪽에 `mutual#action`을 둘 수 있다. |
| OFFICIAL | 공식 예시는 포옹하는 쪽에 `source#hug`, 포옹받는 쪽에 `target#hug`를 사용한다. |
| OFFICIAL | 이 문법은 항상 신뢰할 수 있는 것은 아니지만 다인물 상호작용에 도움이 될 수 있다. |
| PROJECT-POLICY | interaction의 action 부분이 로컬 태그 자산에서 확인되고 source/target 또는 두 mutual이 짝을 이룰 때만 자동 compilation을 허용한다. |
| PROJECT-POLICY | 확인되지 않은 interaction tag는 만들지 않는다. 관계를 자연어로 유지하거나 명시적 validation 오류를 반환한다. |
| USER-CONVENTION | actor별 행동과 표정은 그 Actor의 Scene Slot에 둔다. Character 1에 actor 표정을 넣지 않는다. |

복잡한 거리, 시선, 앞뒤 관계는 base supplement나 actor scene의 자연어로 보강할 수 있다.
다만 단일 인물 shot에서 `arriving guest`처럼 제2 인물을 암시하는 문장은 count tag와 UC가 있어도
실제 인물을 추가할 수 있으므로 별도 경고 대상으로 본다.

## Strengthening, Randomizer, Chunks

| 구분 | 규칙 |
|---|---|
| OFFICIAL | `{}`는 해당 범위의 focus를 1.05배, `[]`는 1.05로 나눈다. 중첩하면 반복 적용된다. UC에서는 강한 항목이 더 강하게 회피된다. |
| OFFICIAL | V4 이상에서 `1.5::text ::`, `0.5::text ::` 형태의 numerical emphasis를 지원한다. 음수 emphasis는 V4.5 이상에서 지원한다. |
| OFFICIAL | `::`는 열린 bracket emphasis를 닫는 역할도 한다. 명시적으로 범위를 닫는 것이 권장된다. |
| OFFICIAL | Prompt Randomizer는 `||red|blue||`처럼 이중 bar로 감싸고 내부 단일 bar로 선택지를 나눈다. 같은 seed라도 randomizer 선택은 바뀔 수 있다. |
| OFFICIAL | Prompt Chunk는 UI의 재사용 자산이며 `!macro:Name!`으로 중첩할 수 있다. 단일 `|`나 닫히지 않은 numerical emphasis를 담은 중첩 chunk는 주의해야 한다. |
| PROJECT-POLICY | Composer는 저장 preset의 emphasis 문자열을 분해하거나 재가중하지 않는다. randomizer는 기존 resolver로 한 번 확정한 뒤 payload를 만든다. |
| PROJECT-POLICY | Prompt Chunk 이름은 API payload의 안정된 계약으로 사용하지 않고, 이미 확장된 실제 문자열만 처리한다. |

## 구현에 고정한 판정

1. base subject count는 저장 문자열을 신뢰하지 않고 선택된 actor category에서 다시 계산한다.
2. individual slot의 숫자 subject와 `solo`는 제거하고 `girl`, `boy`, `other` 하나를 앞에 둔다.
3. actor expression/action은 Actor Modifier Slot에만 들어가며 subject token은 Anchor에만 들어간다.
4. position은 actor 순서와 left/right 표현을 함께 사용한다.
5. 22개 제한은 v2가 생성한 실제 NAI character prompt 수에 적용한다.
6. 공식 문서가 보장하지 않는 prompt 의미는 `PROJECT-POLICY`나 `USER-CONVENTION`으로만 기록한다.
