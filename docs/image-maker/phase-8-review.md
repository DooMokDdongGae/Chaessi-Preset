# Chaessi Image Maker Phase 8 검토 보고서

## A. Pipeline

Phase 8은 Image Maker의 Director 공급 단계만 Codex Bridge로 연결했다.

```text
Image Maker request
→ compact Director context
→ installed Codex CLI (codex exec)
→ JSON capture
→ scene-plan/v2 validation
→ Phase 6/7 preflight
→ manual Generate
```

핵심 구현은 `src/services/codex-director-bridge.js`의
`createCodexDirectorBridge()`, `buildDirectorContext()`, `inspectCodexClient()`,
`invokeCodexExec()`, `parseCodexPlan()`이다. `src/services/image-maker-api.js`가
`getDirectorStatus()`와 `createDirectorPlan()`을 노출하고, `server.mjs`가
`GET /api/image-maker/director/status`와 `POST /api/image-maker/director-plan`으로 연결한다.
Electron은 `electron/server-process.mjs`에서 설치된 Codex CLI를 찾아 서버에 전달한다.

브리지는 OpenAI API, 별도 API key, LLM gateway, NovelAI 호출을 추가하지 않는다. 현재 로그인된
Codex 클라이언트를 `codex exec` 비대화형 모드로 실행하며, 읽기 전용 sandbox와 빈 작업 디렉터리를
사용한다. 공식 비대화형 실행, 인증, CLI 동작 문서는 [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode),
[Codex auth](https://learn.chatgpt.com/docs/auth), [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)를
기준으로 삼았다.

실제 환경 확인:

- 실행 파일: `%LOCALAPPDATA%\\OpenAI\\Codex\\bin\\8e5b6932251c2c1c\\codex.exe`
- 버전: `codex-cli 0.153.4`
- 인증: `Logged in using ChatGPT`
- 모델/추론: 현재 Codex 설정을 사용하며 브리지에 모델을 하드코딩하지 않음
- API key: 브리지와 Director context에 없음
- 사용량: Codex 계정 사용량을 사용하며, last-message 실행 결과에 신뢰할 수 있는 token 수가 없으므로 추정하지 않음

## B. Context

Codex에는 다음만 보낸다.

- 자연어 request, mode, count
- 실제 preset ID와 버전 identity
- Character의 제한된 semantic tag 요약
- Outfit의 제한된 semantic tag 요약
- 선택된 Style/Quality의 이름, category, version
- Base의 width, height, aspect ratio
- actor의 girl/boy 성별과 seed 정책. 단일 actor나 배치가 지정되지 않은 경우 position은 `null`로 둘 수 있고, 실제 다인 배치에서만 normalized 좌표를 사용한다.
- 기존 Image Director 지시문과 scene-plan/v2 출력 계약

다음은 보내지 않고 artifact에도 저장하지 않는다.

- 전체 base prompt와 undesired prompt
- NovelAI steps, sampler, guidance 등의 실행 파라미터
- 작가 recipe와 민감한 preset metadata
- 인증 토큰, 환경변수, raw process log

Structured output schema는 `src/state/scene-plan-v2.schema.json`으로 전달한다. 응답은 plain JSON
또는 JSON fenced block 하나만 허용한다. JSON 외 자연어를 앞뒤에서 공격적으로 잘라내거나 복구하지
않으며, count, mode, preset selection, scene-plan/v2 계약을 모두 검증한다.

## C. Cache and artifacts

성공한 계획은 request/mode/count, preset ID와 버전, canvas, instruction hash를 포함한 cache key로
저장한다. 같은 요청은 Codex 프로세스를 다시 시작하지 않고 cache hit로 처리한다. `Regenerate`는
cache를 우회하고 새 계획이 검증된 뒤에만 기존 cache를 교체한다. 이전 UI 계획은 새 호출이 성공할
때까지 유지된다.

실행별 artifact는 다음 위치에 저장한다.

```text
data/image-maker-director-runs/<invocation-id>/
  director-request.json
  director-context.json
  director-plan.json
  director-result.json
```

Codex의 임시 `codex-final-message.txt`는 파싱 직후 삭제한다. 실패 artifact에는 public error code만
남기며 process stdout/stderr를 저장하지 않는다.

## D. UI

Image Maker 화면에 `Create Director Plan`과 `Regenerate`를 추가했다. 현재는 Codex가 실제 계획을
만들고, 기존 `Import Plan`/`Use Pasted Plan` 수동 경로도 유지한다. 계획 생성 중 버튼을 잠그고
가짜 퍼센트는 표시하지 않는다. 성공하면 shot card를 만들고 반드시 사람이 확인한 뒤 Preflight를
실행한다. `needs-review` 또는 실패면 Generate를 잠그고, 이전 계획과 실행 상태를 보존한다.

실제 Electron UI에서 실제 catalog와 Codex Bridge를 사용해 count 2 editorial 요청을 생성했다.
Codex 응답으로 shot card 2개가 표시됐고, 수정된 위치 검사를 거쳐 `Ready 2 / 2 shots ready`가
표시됐다. Generate 버튼은 활성화됐지만 이 UI 확인에서는 클릭하지 않아 NAI 비용을 추가하지 않았다.

## E. Error and safety behavior

공개 오류 코드는 `CODEX_NOT_AVAILABLE`, `CODEX_NOT_AUTHENTICATED`, `CODEX_TIMEOUT`,
`CODEX_PROCESS_FAILED`, `CODEX_INVALID_OUTPUT`, `CODEX_SCHEMA_INVALID`,
`CODEX_COUNT_MISMATCH`, `CODEX_CANCELLED`다. 자동 retry는 없다. Codex 실패 시 기존 plan을
덮어쓰지 않고, NovelAI 요청도 발생시키지 않는다. API client는 이제 서버의 `type`, `code`,
structured details를 Error 객체에 보존해 UI가 코드별 메시지를 표시할 수 있다.

Composer의 위치 검사는 `right hand`, `screen right` 같은 손·몸 방향을 actor 배치로 오인하지
않도록 실제 배치 문구만 판정한다. 이 수정은 브리지 계획의 shot 1 preflight 거짓 양성을 제거했고,
기존의 명백한 `standing on the left` 충돌 검사는 유지한다.

## F. Tests

실제 Codex 호출과 mock 기반 검사를 함께 수행했다.

| 검증 | 결과 |
|---|---|
| Editorial 3-shot 실제 Codex 계획 | PASS |
| 동일 요청 cache hit, Codex 호출 0회 | PASS |
| 명시적 Regenerate 실제 재호출 | PASS |
| Sequence 3-shot carriesFrom/action progression | PASS |
| plain/fenced JSON capture | PASS |
| invalid output/schema/count/timeout/not-available | PASS |
| 실제 UI Create Plan → shot cards → Preflight READY 2/2 | PASS |
| 기존 Phase 1~7 및 Phase 8 연계 영역 | 45/45 PASS |
| Phase 8 bridge 테스트 | 6/6 PASS |
| 전체 지정 회귀 묶음 | **51/51 PASS** |

추가로 `node --check`와 `git diff --check`를 실행했다. `adapter_smoke_test.js`처럼 오래된 독립
smoke가 stale 환경변수로 NAI를 호출하는 전체 glob 실행은 회귀 수에 포함하지 않았다.

## G. Separate safeStorage generation check

브리지와 분리해 현재 Electron의 Chaessi `safe_storage` token provider와 generationStore를 실제로
1회 확인했다. 자동 retry 없이 HTTP 200, PNG, metadata sidecar, payload artifact가 생성됐다.

- generation ID: `2026-09-09_114921_189ddd`
- model: `nai-diffusion-5-full`
- seed: `3454424995`
- resolution: `832 × 1216`
- PNG: `C:\\Users\\user\\AppData\\Roaming\\Chaessi Preset\\data\\generations\\2026-09-09\\2026-09-09_114921_189ddd.png`

이 이미지는 저장·인증 경로 확인용이며, Phase 8 Codex 계획에서 생성한 추가 NAI 이미지가 아니다.

## H. Remaining issues

확인된 사항:

- Codex CLI가 설치되지 않았거나 ChatGPT 로그인이 풀리면 계획 생성이 중단되고 수동 plan import를
  사용할 수 있다.
- CLI의 schema 제약상 structured schema에는 모든 property가 required여야 하고 `uniqueItems`를
  사용할 수 없었다. 현재 응답 schema는 이를 반영한다.
- Codex 계정 quota/usage는 Codex 클라이언트 정책을 따르며 브리지가 임의로 우회하지 않는다.
- 실제 렌더 이미지의 부수 인물·소품은 renderer artifact 정책에 따라 후검수 영역이다.

아직 하지 않은 작업:

- Codex Bridge의 HTTP 취소 버튼과 완전한 crash recovery
- 자동화된 vision 의미 검토
- multi-shot batch의 병렬 실행, retry/resume
- Deep Danbooru, e621, Node standalone, Preview API 수정

## I. Next step

다음 단계로 **Director UX 개선**을 추천한다. 계획의 cache hit, manual fallback, preflight 충돌
원인을 한 화면에서 더 분명히 보여주면 Codex 사용량을 아끼면서도 사용자가 생성 전에 연출을
빠르게 수정할 수 있다.
