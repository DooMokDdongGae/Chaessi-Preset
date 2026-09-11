# Chaessi Image Maker Phase 8.1A 검토 보고서

## A. 기존 차단 원인

`src/services/preset-catalog-v2.js`의 `resolveSelections()`가 Character와 Outfit을 각각 올바른
preset type으로 읽은 뒤, 두 category를 다시 성별로 변환해 서로 같지 않으면
`outfit-category-mismatch`를 발생시키고 있었다.

```text
여성 캐릭터 + 남성 의상 → reject
남성 캐릭터 + 여성 의상 → reject
```

Phase 8 UI에서 `민서(남성 캐릭터) + 플래드 클럽 돌(여성 의상)`이 막힌 직접 원인이 이
compatibility gate였다.

## B. 수정 정책

성별 compatibility 비교와 그 전용 `genderForCategory()` 함수를 제거했다. 다음 type 검사는
그대로 유지한다.

- Character selector: `여성 캐릭터` 또는 `남성 캐릭터`
- Outfit selector: `여성 의상` 또는 `남성 의상`
- Style selector: `그림체`
- Quality selector: `품질`
- Camera/Lighting selector: 각 전용 category
- preset ID, enabled 상태, 비어 있지 않은 prompt, base V5 model 검사
- Outfit 배열이 비어 있거나 actor 수와 같아야 하는 count 검사

Outfit의 여성/남성 metadata는 catalog 분류와 검색에 남지만 actor subject의 착용 권한으로는
사용하지 않는다.

## C. Director / Composer / Guard 영향

Image Director 지시문에 USER-CONVENTION을 추가해 선택된 Outfit을 subject에 따라 경고, 교체,
fallback하지 못하게 했다. Composer는 Character category로 Base/Anchor의 `girl` 또는 `boy`만
결정하고, 선택된 Outfit prompt는 성별과 관계없이 Actor Modifier에 그대로 컴파일한다.
Semantic Guard는 사람 수와 암시된 추가 actor만 검사하므로 교차 성별 Outfit 조합에서 warning이나
`needs-review`를 만들지 않는다.

Frontend catalog는 원래부터 Character 선택과 무관하게 `여성 의상`, `남성 의상`을 모두 반환했다.
이 동작을 회귀 테스트로 고정했다.

## D. Tests

| 조합 | 결과 |
|---|---|
| girl actor + female outfit | PASS |
| girl actor + male outfit | PASS |
| boy actor + male outfit | PASS |
| boy actor + female outfit | PASS |
| outfitPresetId에 Character preset ID 지정 | FAIL as expected (`preset-category-mismatch`) |

각 정상 조합은 catalog resolve뿐 아니라 Composer compile까지 실행했다. Base subject count와 Anchor
subject는 Character만 따르고, 교차 Outfit prompt는 Modifier에 보존되며 Semantic Guard issue는 0개다.

추가로 structured output에서 허용한 `position: null`을 JavaScript scene-plan 계약도 받아들이도록
일치시켰다. 이는 단일 actor의 AI's Choice 위치를 유지하며, 좌표 객체가 있을 때의 0~1 검사는
그대로 유지한다.

## E. UI Recheck

실제 Electron UI와 사용자 preset catalog에서 다음 조합을 사용했다.

```text
Character: 민서 (남성 캐릭터)
Outfit: 플래드 클럽 돌 (여성 의상)
Mode: Editorial
Count: 2
```

실제 Codex Bridge가 2-shot plan을 만들었고 shot card 2개가 표시됐다. Preflight 결과는
`Ready — 2 / 2 shots ready`였으며, 성별/Outfit 조합으로 인한 warning, review, failure는 없었다.

## F. E2E

UI plan의 첫 shot을 Phase 5 단일 실행기로 전달해 NovelAI를 정확히 1회 호출했다. 자동 retry는
없었으며 Local API, NovelAI 응답, generationStore, run artifact 검증이 모두 통과했다.

- status: `completed`
- Local API generation calls: `1`
- generation ID: `2026-09-09_123001_17c28b`
- model: `nai-diffusion-5-full`
- seed: `3454424995`
- resolution: `832 × 1216`
- PNG: Electron userData 아래 `data/generations/<date>/<generation-id>.png`
- run: Electron userData 아래 `data/image-maker-runs/<run-id>`

Resolved preset은 `Base: 1boy`, Anchor의 `boy` identity, Modifier의 선택된 plaid bra/skirt Outfit
prompt를 보존했다. 렌더 결과에는 중앙 남성 외에 여성 두 명이 추가되고 중앙 남성은 suit로
표현됐다. 이는 payload 구조에는 없는 renderer-added artifact 및 Outfit adherence 관찰로 기록하며,
이번 Phase의 category gate나 pipeline 실패로 분류하지 않는다.

## G. Regression

Phase 1~8 지정 테스트 묶음을 다시 실행해 **52/52 PASS**했다.

- scene-plan/Director contract: 6 PASS
- Composer/catalog: 12 PASS
- Image Maker backend: 3 PASS
- single runner: 6 PASS
- multi runner: 8 PASS
- Frontend: 11 PASS
- Codex Bridge: 6 PASS

JavaScript syntax check와 `git diff --check`도 오류 없이 통과했다. 기존 preset 파일과 사용자
데이터는 수정하지 않았다.
