# Phase 3 — Image Director 검증 보고 (2026-09-08)

## 구현 범위

- 재사용 지시문: [codex-image-director.md](codex-image-director.md)
- v2 계약 설명: [scene-plan-v2.md](scene-plan-v2.md)
- 런타임 prototype: `src/state/image-director-contract.js`
- 입력 3종과 결과 scene-plan 3종: `examples/image-maker/`
- 자동 테스트: `test_image_director_contract.js`

기존 `server.mjs`, adapter, generation store, UI, v1 scene-plan과 Composer는 수정하지 않았다.
실제 NAI 요청도 수행하지 않았다.

## 자동 검사와 의미 검토의 경계

| 자동 검사 | Codex 의미 검토 |
|---|---|
| schema, 필드, 타입, enum, ID 형식 | 사용자 요구가 실제로 충족되는가 |
| count와 shots 길이, index와 ID 중복 | preset의 실제 외형·의상 내용을 존중하는가 |
| 미선택 character ID 참조 | 카메라와 행동이 자연스럽고 물리적으로 가능한가 |
| locked location/outfit 문자열 변경 | 다른 단어를 써도 시각적으로 중복되는가 |
| sequence의 carriesFrom 선행 참조 | 표정·시선·조명이 intent와 맞는가 |
| 정확한 카메라/포즈/표정 서명 중복 | 가림과 화면 면적이 실제 생성에 충분한가 |
| close-up+전신 이동, head crop+표정 등 일부 모순 | NAI 태그가 유효하고 토큰 예산에 맞는가 |
| 감독 필드를 generation 객체에 넣는 구조 오류 | supplement가 필요한 관계만 명확히 설명하는가 |

## Test A — 단일 이미지: PASS

- 입력: [director-request-single.json](../../examples/image-maker/director-request-single.json)
- 결과: [director-single.json](../../examples/image-maker/director-single.json)
- 자동 검사: PASS, errors 0, warnings 0.
- 의미 검토: 한 장만 설계해 불필요한 멀티샷이 없다. 창틀을 잡은 손, 읽히는 얼굴 옆면,
  비와 도시 반사를 가시성 의무로 명시했다. medium/three-quarter는 세 요소를 함께 담을 수 있다.
  조명은 실내의 따뜻한 측광과 외부의 차가운 반사광으로 공간 관계를 만든다.
- preset 존중: 실제 basePresetId만 참조하고 외형·의상 prompt를 다시 만들지 않는다.
- 현재 실행성: character/undesired override가 없어 `projectShotToScenePlanV1()`으로 손실 없이
  현 v1 Composer 계약으로 변환됨을 테스트했다.

## Test B — 동일 장소·의상 6장 화보: PASS

- 입력: [director-request-editorial-6.json](../../examples/image-maker/director-request-editorial-6.json)
- 결과: [director-editorial-6.json](../../examples/image-maker/director-editorial-6.json)
- 자동 검사: PASS, errors 0, warnings 0.
- 다양성: establishing/low, full-body/side, cowboy/front-oblique, close-up/three-quarter,
  wide/high-angle, hand detail/oblique의 여섯 조합이다. 포즈는 정적 소개, 걷기, 안내 동작,
  초상, 카트 이동, 카드 정리로 나뉘고 표정도 welcoming/focused/attentive/confident/energetic/
  crop-out으로 구분된다. 정확한 camera+pose+expression 중복이 없다.
- continuity: location과 outfitState 문자열이 전 shot에서 동일하다. 기본 따뜻한 로비 광원은
  유지하면서 광원의 방향과 배경 비율만 바꾼다. ledger, luggage cart, key card는 안정된 prop ID다.
- 가시성: 전신 샷은 보행과 신발, 서비스 샷은 손과 ledger, close-up은 얼굴,
  detail은 손과 key card를 각각 우선한다. 인물을 무리하게 한 프레임에 모두 넣지 않는다.
- 의미상 주의: editorial shot은 시간 순서가 아니라 독립 화보 변형이다. prop 상태는 각 shot의
  연출 소품 상태이며 carriesFrom을 쓰지 않는다. 향후 UI가 이를 sequence처럼 표시하면 안 된다.
- 실행성: 예제 preset ID는 구조 예시이며 실제 저장소 존재 여부를 검사하지 않았다. 인물별
  scenePrompt를 현 v1 Composer가 지원하지 않아 v2 Composer 확장이 필요하다.

## Test C — 4컷 연속 장면: PASS

- 입력: [director-request-sequence-4.json](../../examples/image-maker/director-request-sequence-4.json)
- 결과: [director-sequence-4.json](../../examples/image-maker/director-sequence-4.json)
- 자동 검사: PASS, errors 0, warnings 0.
- 행동 연속성: 손을 뻗음 → 손잡이 인계 → 오른손으로 이동 → 프런트 옆에 세우고 놓음.
  suitcase ID는 고정되고 각 상태가 앞 shot에서 이어진다.
- 공간·방향: 입구 → 중앙 통로 → 프런트로 이동하며 screen-left 진행을 유지한다.
  모든 후속 shot의 carriesFrom이 바로 앞 shot을 참조한다.
- 카메라와 가시성: 시작 wide, 손 인계 medium, 이동 full-body, 종료 cowboy로 행동에 필요한
  화면 면적을 배정한다. rear three-quarter 샷은 얼굴을 일부 profile로만 요구해 시점과 모순되지 않는다.
- 의상과 조명: hotel uniform 상태는 locked이고, 같은 따뜻한 로비 광원에 입구의 차가운 빛과
  프런트의 보조광을 장소 이동에 따라 더한다.
- 실행성: 실제 preset 존재와 tag 유효성은 미검증이며, multi-shot/character Composer가 필요하다.

## 확인된 구조적 한계

1. 자동 검사는 자연어 동의어로 위장한 시각적 중복이나 모든 물리 모순을 판별하지 못한다.
2. preset ID 형식과 참조 관계만 검사하며 실제 데이터 루트에서의 존재·카테고리 일치는 검사하지 않는다.
3. 빈 visibleFeaturesPrompt의 의미는 “원본 사용”이지만, 현재 Composer에는 이를 shot별로
   해석하는 코드가 없다.
4. style/quality/outfit 선택의 merge/replace 우선순위와 충돌 정책은 아직 정의되지 않았다.
5. v2는 계획 계약이며 batch 상태, retry, resume, generation ID를 담는 실행 manifest가 아니다.
6. prompt token 길이, Danbooru tag 존재, quality의 no-text와 대사 충돌은 Composer 검증 대상이다.
7. Node 단독 실제 생성과 V5 preview builder 통합은 각각 미완료 TODO다.

## Danbooru 태그 자산 추가 조사

### 원본 Prompt Set Generator의 처리 범위

원본 `prompt_set_core.py`의 `SYSTEM_PROMPT`는 흔하고 객관적이며 시각화 가능한 Danbooru
태그를 우선하고, 태그로 표현하기 어려운 관계·접촉·가림·공간 기하만 자연어 supplement로
보완하도록 지시한다. `resources/danbooru_sex_tags.txt`는 설정에 따라 system prompt에
참고 어휘로 추가된다. `compose_variant()`는 외형, 의상, 행동, 대사를 조립한다.

그러나 원본에는 다음 기능이 없다.

- 전체 Danbooru 태그 사전 검색
- 일반 태그의 실제 존재 여부와 철자·alias 검증
- 태그 카테고리와 사용 빈도에 따른 후보 제한
- 태그 가중치의 의미 분석과 자동 최적화
- 의상과 행동 태그의 전제조건을 이용한 모순 검사

따라서 원본의 자산은 **태그를 장면 안에서 어떤 역할로 배치할지에 관한 설계 지식**이며,
태그 데이터베이스 자체는 아니다.

### 로컬 자산 1 — 기존 `danbooru-tag-rag`

- 위치: 개발 PC의 별도 로컬 `danbooru-tag-rag` 저장소(배포 제외)
- 원본 사전: `danbooru-tags.csv`, 114,092행/114,092개 고유 태그.
- 필드: `name`, `category`, `post_count`, `description`.
- description에는 한국어 정의와 별칭이 들어 있다.
- category 0/1/3/4/5를 general/artist/copyright/character/meta로 구분한다.
- 로컬 multilingual-e5-large embedding과 로컬 llama.cpp용 OpenAI 호환 endpoint를 사용하도록
  구성되어 별도 유료 LLM API 없이 운용할 수 있다.
- `/api/direct_search`와 로컬 CSV 자동완성 경로가 있으며, 최종 후보를 DB 태그 집합과
  대조해 존재하지 않는 태그를 제거하는 코드 경로가 있다.
- 현재 CSV는 post_count 50 이상으로 구성되어 있어 매우 희귀한 태그가 일부 제외된다.

이 자산은 한국어 자연어를 의미 후보로 바꾸고, 태그 설명·별칭을 제공하고, 최종 태그가
로컬 사전에 실제 존재하는지 검사하는 데 적합하다.

### 로컬 자산 2 — `Jio7/danbooru-tags-classified`

- 위치: 개발 PC의 별도 로컬 `Jio7/danbooru-tags-classified` 체크아웃(배포 제외)
- 출처 remote: `https://huggingface.co/datasets/Jio7/danbooru-tags-classified`
- 확인 commit: `90da0a2bc51724d2b28aef1f3f2a422663a2ede3`.
- README metadata의 라이선스 표시는 MIT다. 별도 LICENSE 파일은 확인되지 않았다.
- 14개 CSV, 총 191,162행/191,110개 고유 태그.
- 주요 분류: artist 83,355, character 57,653, series 12,405, attire 9,646,
  object 4,227, feature 2,930, action 2,500, setting 893, expression 285,
  style 209, count 31. 각 파일은 `tag,count` 형식이다.
- 기존 RAG 사전과 110,763개가 겹친다. classified에만 80,347개,
  기존 사전에만 3,329개가 있다. 두 자료는 수집 시점과 필터가 다르므로 한쪽의
  post_count를 절대적인 최신값으로 간주하지 않는다.
- 52개 태그가 둘 이상의 분류 파일에 중복된다. 예: `bag`은 attire/object,
  `bed`는 object/setting, `double_v`는 action/expression이다. 소비자는 단일 분류로
  강제하기보다 다중 역할을 허용해야 한다.
- README는 분류가 LLM으로 수행되었고 수작업 검증되지 않았다고 명시한다.
  특히 `other.csv`에는 노이즈가 있을 수 있으므로 category는 권위가 아닌 힌트다.
- 일부 action/expression/feature/object 행의 count가 0이며 전체에서 5개가 확인됐다.
  count 0 태그는 자동 추천에서 제외하거나 낮은 신뢰도로 표시하는 편이 안전하다.

이 자산은 Director가 `action`, `attire`, `expression`, `feature`, `setting`, `style`별로
검색 범위를 좁히고, 화보의 연출 축마다 후보를 꺼내는 데 적합하다. 한국어 설명과 alias가
없으므로 기존 RAG를 대신하는 단독 의미 검색 사전으로는 부족하다.

### `requiring.txt`의 활용과 주의점

`requiring.txt`는 JSON Lines 393개이며 109개 의상 전제조건을 다룬다. 예를 들어
`skirt_lift`는 `skirt`, `open_jacket`은 `jacket`이 필요하다고 기록한다. 이는 다음 검증에 유용하다.

```text
Director가 행동 태그 후보 선택
→ 선택된 outfit preset의 의상 태그 확인
→ required_attires 충족
→ 충족하면 유지
→ 불충족이면 행동 태그 교체 또는 의미 검토 경고
```

단, 실제 교차 검사에서 requiring의 행동 태그 중 classified CSV에도 있는 것은 54개,
기존 RAG 사전에는 383개였다. 따라서 requiring 관계를 classified CSV 내부 참조만으로
검증하면 대부분을 잃는다. 관계 파일의 tag와 required_attires는 두 사전의 합집합에 대해
검사하고, 한쪽에만 있는 항목은 source와 신뢰도를 함께 기록해야 한다.

### e621의 역할

e621 태그는 일반적인 pose/object 일부가 Danbooru와 겹치지만 furry·anthro 중심의 분류와
용례를 가진다. NAI 일반 인물·의상·애니메이션 장면의 기본 사전으로 사용하지 않는다.
향후 furry 또는 비인간 캐릭터 모드를 명시적으로 지원할 때 별도의 namespace와 adapter를
두고 보조 후보 사전으로 사용하는 것이 적절하다. 이번 조사에서는 로컬 e621 데이터의
정확한 경로와 포맷을 확정하지 않았다.

### 권장 Local Danbooru Tag Resolver

두 Danbooru 자산은 다음처럼 결합한다.

```text
Image Director의 시각 개념
→ classified 분류로 action/attire/expression/setting 등 검색 범위 제한
→ 기존 RAG의 한국어 정의·별칭·embedding으로 의미 후보 검색
→ 두 사전의 교집합을 높은 신뢰도 후보로 우선
→ 한쪽에만 있는 후보는 source/count와 함께 낮은 신뢰도로 유지
→ requiring 관계로 행동·의상 전제조건 검사
→ 최종 태그·자연어 잔차·검증 근거를 scene-plan에 전달
```

추천기는 post_count를 품질 점수로 오해하지 않고, 지나치게 희귀하거나 오타 가능성이 있는
후보를 완화하는 보조 신호로만 사용한다. artist/character/series 태그는 일반 외형·행동 검색과
분리해 특정 캐릭터가 속성 검색을 오염시키지 않게 한다. category 중복은 오류가 아니라
여러 역할의 증거로 보존한다.

구현 시 Resolver의 출력은 단순 문자열보다 다음과 같은 근거 포함 구조가 적합하다.

```json
{
  "tag": "looking_at_viewer",
  "roles": ["feature"],
  "postCount": 4163487,
  "sources": ["classified", "rag"],
  "confidence": "high",
  "matchedIntent": "카메라를 바라봄",
  "requirements": []
}
```

Director는 후보와 근거를 사용해 장면을 설계하고, 최종 payload에 들어갈 문자열은 Composer가
확정한다. 이를 통해 Director가 존재하지 않는 태그를 창작하거나 preset의 의상과 모순되는
행동 태그를 선택하는 위험을 줄일 수 있다.

## 다음 단계 판정

**Local Danbooru Tag Resolver를 포함한 Preset Composer 확장**을 먼저 권장한다. 이것은 후보를
둘로 나눈 별도 단계가 아니라, Director가 만든 시각 개념을 실제 preset 문자열로 확정하는
하나의 Composer 작업이다. Director는 캐릭터·의상·스타일·품질 ID와 인물별 shot prompt를
손실 없이 표현하지만 현재 v1 Composer는 이를 실행하지 못한다. 이 간극을 먼저 메워야
Director 결과를 실제 한 장과 이후 multi-shot 실행기가 같은 규칙으로 사용할 수 있다.

첫 범위는 실제 preset ID·카테고리 검증, 두 Danbooru 사전 로드와 exact lookup, category별 후보,
requiring 검사, merge/replace 우선순위, v2 shot 하나를 resolved preset으로 컴파일하는 기능까지로
제한한다. embedding 검색과 batch 실행은 그 다음 단계로 둔다.
