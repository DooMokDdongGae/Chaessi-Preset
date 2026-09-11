# Phase 4 — NovelAI Prompt Rules + Preset Composer v2

## A. NovelAI 공식 규칙 조사

공식 URL과 세부 판정은 [novelai-prompting-rules.md](./novelai-prompting-rules.md)에 고정했다.
핵심 확인 사항은 다음과 같다.

- V5 Full은 자연어·다국어 prompt, 재설계된 positioning, 다인물 최대 22명을 지원한다.
- base는 장면·스타일과 subject count, 개별 character prompt는 숫자 없는 subject와 해당 인물 정보를 담당한다.
- prompt 순서는 대체로 위→아래, 왼쪽→오른쪽 위치와 맞추고 자연어로 보강한다.
- actor별 UC는 다른 character prompt로의 정보 누출을 줄이는 수단이다.
- `source#hug`/`target#hug`, 양쪽의 `mutual#hug`가 공식 interaction 문법이며 항상 확실하지는 않다.
- 별도 character prompt와 단일 `|` 다인물 문법은 혼용할 수 없다.
- `{}`/`[]`, V4+ numerical emphasis, V4.5+ negative emphasis, `||...|...||` randomizer 규칙을 확인했다.
- Prompt Chunk는 UI 재사용 자산이며 Composer는 확장된 문자열을 처리한다.

## B. 사용자 Chaessi Convention

사용자가 검증한 slot 패턴을 다음 mapping으로 보존했다.

```text
Character 1 = Director(camera, shot size, viewpoint, framing, composition)
Character 2 = Actor 1 Identity
Character 3 = Actor 1 Outfit + action + expression + state
Character 4 = Actor 2 Identity
Character 5 = Actor 2 Outfit + action + expression + state
```

`compileDirectorSlot()`은 pose/action/gaze/expression을 읽지 않는다. 해당 정보는
`compileActorSlot()`이 Actor Scene Slot에 넣는다. 공식 문서와 구별되는 이 방식은
`USER-CONVENTION`으로 기록했다.

## C. Composer v2 구조

구현 파일은 다음과 같다.

- `src/services/preset-catalog-v2.js`
  - `createComposerPresetCatalog()`
  - 실제 ID, 내부 ID 일치, category, enabled, V5 model, actor/outfit 성별을 검사한다.
- `src/services/preset-composer-v2.js`
  - `compileScenePlanV2Shot()`
  - `compileDirectorSlot()`
  - `mapSemanticSlotsToNaiCharacters()`
- `src/services/danbooru-tag-resolver.js`
  - `loadDanbooruTagResolver()`
  - `createDanbooruTagResolver()`

```text
Director plan
→ semantic Director/Actor slots
→ NAI character array
→ resolved preset
→ existing buildModeGeneratePayload()
→ V5 payload validation
```

기존 v1 Composer, server, UI, generationStore, production adapter는 수정하지 않았다.

## D. Danbooru Resolver

사용 데이터:

- 별도 로컬 `Jio7/danbooru-tags-classified` 체크아웃
- 별도 로컬 `danbooru-tag-rag`의 `danbooru-tags.csv`

classified CSV의 tag/category/count와 RAG CSV의 tag/post_count/한국어 `키워드:`를 메모리 index로
만든다. exact tag는 `exact`, 유일한 alias는 `high`, 복수·category 불일치는 `candidate`, 나머지는
`natural-language`다. 자동 prompt 치환은 exact/high만 수행한다. 실제 smoke compilation에서
`standing`, `holding_book`, `looking_at_viewer`가 양쪽 자산의 exact로 확인됐고 호텔·조명 표현은
자연어로 남았다.

`requiring.txt`는 action → attire 검증에 사용한다. 요구 attire가 outfit prompt에 없으면
`requirement-conflict`와 action/requires/currentOutfit을 반환하고 행동을 새로 만들지 않는다.
embedding 기반 deep search는 호출하지 않았다.

## E. Merge/Replace Policy

전체 정책은 [preset-composition-policy.md](./preset-composition-policy.md)에 기록했다.

- identity preserve
- outfit replace
- explicit style replace, null이면 base style preserve
- quality/lighting/global scene append
- camera shot별 replace
- action/expression actor scene append
- background/global relation base append
- 기존 base character array 전체 replace

이 정책은 현재 UI에서 Base preset 적용과 character slot 적용이 각각 대상 문자열/slot을 교체하는
동작을 조사한 뒤 정했다.

## F. 테스트 결과

| Test | 결과 |
|---|---|
| 1인 | **PASS** |
| 2인 독립 | **PASS** |
| 2인 interaction | **PASS** |
| alias/natural fallback | **PASS** |
| requiring conflict | **PASS** |
| 실제 ID/category catalog | **PASS** |
| Phase 1~3 회귀 포함 전체 | **PASS, 14/14** |

테스트 코드는 `test_preset_composer_v2.js`다. 일반 sandbox에서는 기존 CLI test의 child process가
`EPERM`으로 막혀, 동일 테스트를 child process 실행이 허용된 환경에서 다시 실행해 14개가 모두 통과했다.

## G. 실제 V5 compilation

- 입력: `examples/image-maker/composer-v2-single-plan.json`
- base preset: `preset_2cc76fdfa1a8`
- actor identity: `character_ab4f6e6420b8` (`여성 캐릭터`, enabled)
- outfit: `character_0eaf3848aafa` (`여성 의상`, enabled)
- subject count: `1girl`
- semantic/NAI slots: 3개 — Director, Actor 1 Identity, Actor 1 Scene
- payload model: `nai-diffusion-5-full`
- seed: `24090401`
- `use_coords`: true
- preset validation: PASS
- payload validation: PASS
- 전송 전 payload와 저장 payload deep equality: PASS

증거는 `tmp/phase4/compilation.json`, `resolved-preset.json`, `payload.json`에 보존했다.

## H. 실제 이미지 생성

- generation ID: `2026-09-08_140004_3911be`
- HTTP: 200, 요청 1회, 자동 retry 없음
- backend: 실행 중인 Chaessi Preset 3.2.1 Electron backend, port 4174
- token source: `safe_storage`, 값은 출력·저장하지 않음
- PNG: Electron userData 아래 `data/generations/<date>/<generation-id>.png`
- sidecar: 같은 폴더의 `2026-09-08_140004_3911be.json`
- payload: 같은 폴더의 `2026-09-08_140004_3911be.payload.json`
- PNG 크기: 1,466,907 bytes, 832×1216
- 원본 preset unchanged: PASS

기술 경로는 성공했다. 육안 검토에서는 의상, 책, 로비, daylight, 인물 중심 framing이 표현됐다.
그러나 `1girl`과 `extra people, background characters` UC에도 supplement의 “arriving guest”가
화면 오른쪽 남성 인물로 렌더링됐다. 따라서 **payload E2E는 PASS**, 단일 인물이라는 의미 의무는
**FAIL**이다. 한 장 제한에 따라 재생성하지 않았다.

## I. 남은 문제

확인된 문제:

- 단일 actor 자연어가 guest/customer 등 다른 사람을 암시하면 subject count와 UC보다 강하게 작용할 수 있다.
- 사용자 Director Slot convention은 실제 요청에 수용됐지만 공식 문서가 정의한 actor별 character prompt 용도와 다르다.
- classified category는 LLM 분류라 오분류 가능성이 있으며 RAG alias는 description의 `키워드:`에 의존한다.
- 현재 v2의 outfit 연결은 `characterPresetIds`와 `outfitPresetIds` 배열 순서에 의존한다.
- 공식 22명은 distinct character 설명이며, 프로젝트는 보수적으로 생성되는 NAI slot 총수에도 22 제한을 적용했다.

미확인 문제:

- 세 명 이상에서 Identity/Scene 쌍과 V5 positioning의 안정성
- 다수 interaction이 동시에 있을 때 source/target 짝의 상대 actor 식별 정확도
- custom category와 `기타` preset의 역할 승인 정책
- Node 단독 실제 생성과 V5 preview builder 통합

## J. 다음 단계 추천

**1. Director → Composer → NAI 단일 이미지 완전 자동화**를 우선 추천한다.

이번 E2E에서 배관보다 중요한 남은 간극이 드러났다. Director가 단일 actor를 요청하면서 다른 사람을
암시하는 자연어를 만들면 Composer의 구조 검사가 통과해도 이미지 headcount가 깨진다. 다음 단계에서는
actor count와 자연어 등장인물 언급을 교차 검사하고, off-frame 관계를 prompt에서 명확히 처리하며,
컴파일 결과의 의미 감사를 자동 호출 경로에 넣어야 한다. 이 경로가 안정된 뒤 multi-shot 실행기로
확장하는 것이 적절하다.
