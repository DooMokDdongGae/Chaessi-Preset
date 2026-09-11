# Chaessi Image Maker — Phase 8.3 Review

## A. Director Status UX

- Image Maker 상단에 `Connected`, `Director unavailable`, `Director login required` 상태를 표시한다.
- 연결 상태에는 runtime Director 모델과 reasoning effort를 표시한다. 현재 기본값은 `GPT 5.6 Terra / Medium`이다.
- Codex executable 경로, stderr, 내부 hash는 기본 화면에 표시하지 않는다.
- Director Plan에는 `Cached`, `Generated now`, `Manual Plan`, `Reused Plan` source badge를 표시한다.
- 실제 UI에서 `Connected · GPT 5.6 Terra / Medium`과 fresh/cache 상태를 확인했다.

## B. Shot UX

- Shot card는 camera, placement, pose/action, gaze/expression을 먼저 보여준다.
- Position은 `Left`, `Center`, `Right`로 요약하고, normalized 좌표는 `Advanced details` 안에 둔다.
- `shot.intent`를 `Director Intent`로 표시하며 추가 Codex 호출을 만들지 않는다.
- compact shot overview로 여러 shot의 framing, placement, gaze를 한 줄씩 비교할 수 있다.
- Editorial은 `Independent compositions`, Sequence는 `Continuous action`으로 구분한다.
- Sequence shot은 `Continues from Shot NN`을 표시한다.

## C. Preflight UX

- `READY`, `NEEDS REVIEW`, `FAILED`를 사람이 읽는 요약과 함께 표시한다.
- 내부 issue code는 기본 설명으로 번역한다. 예를 들어 actor cue는 “undeclared extra person” 가능성으로 표시한다.
- 문제가 있는 shot card만 강조하며 review summary와 progress item에서 해당 card로 이동할 수 있다.
- safe rewrite는 `Auto-adjusted` 아래에 원문과 수정문을 함께 표시한다.

## D. Stale State

- request, plan, preflight마다 deterministic revision을 계산한다.
- request, mode, count, preset, seed가 바뀌면 기존 plan을 삭제하지 않고 `Director Plan needs refresh` 상태로 둔다.
- plan을 만든 입력과 현재 입력이 다르면 Preflight와 Generate를 모두 잠근다.
- 현재 plan에 대한 Preflight revision이 없거나 달라지면 Generate를 잠근다.
- 실제 UI에서 count를 1에서 2로 바꿨을 때 `Plan Out of Date`, Preflight disabled, Generate disabled를 확인했다.

## E. Manual Fallback

- Director가 unavailable, unauthenticated, usage-limited 상태여도 `Paste Plan`, `Import Plan`, `Use Pasted Plan`을 그대로 사용할 수 있다.
- Director 생성 실패 시 검증된 기존 plan을 유지한다.
- 사용 한도 오류는 cached/manual plan 사용 가능성을 안내하며 새 API 결제를 제안하지 않는다.

## F. Result UX

- Gallery는 shot 번호, seed, resolution을 먼저 표시한다.
- Prompt, Metadata, Payload는 secondary action으로 둔다.
- 동일한 높이의 image card grid로 multi-shot 비교를 지원한다.
- `View Shot Plan`으로 결과에서 대응하는 Director card로 이동한다.
- `Rendered details may differ from the Director plan.` 안내를 표시한다.

## G. Run History

- Recent Runs에 date/time, request summary, mode, count, status를 표시한다.
- `Use This Request Again`은 request, mode, count, presets를 입력 panel로 복사하며 Codex를 호출하지 않는다.
- `Reuse Director Plan`은 저장된 plan을 명시적으로 가져오고 Preflight를 다시 요구한다.
- `Cached`는 동일 입력 자동 재사용, `Reused Plan`은 사용자 선택에 따른 과거 plan 재사용으로 구분한다.

## H. Codex Usage

Codex scene-plan 생성 호출은 다음 두 동작에서만 발생한다.

- `Create Director Plan`
- `Regenerate Plan`

Shot card/advanced details 열기, overview 이동, Preflight, Gallery, Prompt/Metadata/Payload 보기, Recent Runs, request/plan 재사용은 Director plan 생성을 호출하지 않는다. Director status refresh는 CLI 설치·로그인 상태 probe만 수행하며 scene-plan을 생성하지 않는다.

## I. Tests

`test_image_maker_ux.js`의 신규 테스트 9개가 PASS했다.

| Test | Result |
| --- | --- |
| Director status | PASS |
| Cache badge | PASS |
| Shot overview | PASS |
| Review navigation identity | PASS |
| Stale plan | PASS |
| Stale preflight / Generate guard | PASS |
| Manual fallback | PASS |
| Result / plan link and run reuse | PASS |
| No extra Director plan calls | PASS |

## J. Regression

- 전체 `test_*.js`: **91/91 PASS**
- Electron directory package: **PASS**
- v3.2.1 version, Workshop, V4.5, V5 T2I/I2I/Inpaint, Position Pad, History, safeStorage, Image Maker, Bridge/cache regressions 포함

## K. Electron E2E

2026-09-11 실제 v3.2.1 Electron process와 해당 process가 제공한 local UI/API에서 다음 흐름을 검증했다.

```text
request
→ Director status Connected
→ Create Director Plan
→ one readable shot card
→ Preflight READY
→ Generate 1 Image
→ completed Gallery
→ View Shot Plan
→ Recent Runs / Reuse controls
```

- Request: `고요한 호텔 로비 프런트 데스크 옆에 한 명의 여성 직원이 닫힌 장부를 들고 서 있는 세련된 세로 화보`
- Mode / count: `editorial / 1`
- Director: `gpt-5.6-terra / medium`
- Director invocation: 1 fresh generation; reload 후 동일 입력 cache hit도 확인
- NovelAI Local API calls: 1
- Run ID: `ui_generate_4bbdd9a9_a5f2_424d_b273_5f88c6c7e429`
- Generation ID: `2026-09-11_100813_d46c21`
- Model: `nai-diffusion-5-full`
- Seed: `113388827`
- Resolution: `832 × 1216`
- Status: `completed`
- PNG: `data/generations/2026-09-11/2026-09-11_100813_d46c21.png`

Visual observation: plan은 한 명의 직원, 우측 배치, 장부를 든 전신 구도를 지시했다. 렌더에는 세 명이 나타났으며 가운데 인물의 의상과 행동이 plan과 달랐다. Director plan, Composer payload, declared actor 구조에는 추가 actor 지시가 없으므로 기존 Renderer Artifact Policy에 따라 pipeline 실패가 아닌 renderer observation으로 기록한다. 자동 retry나 추가 생성은 수행하지 않았다.

## L. Next Recommendation

**Public release preparation**을 다음 단계로 추천한다. v3.2.1 기능 보존, Director runtime, Image Maker 사용자 흐름과 실제 generation 연결이 확인됐으므로 현재 UX와 알려진 renderer observation을 release note와 사용자 안내에 고정하는 단계가 적절하다.
