# Chaessi Image Maker — Phase 8.1B Review

## A. Available Models

2026-09-10에 이 PC의 ChatGPT 로그인 상태인 Codex CLI `0.153.4`와 로컬 모델
카탈로그를 확인했다. `codex login status`는 `Logged in using ChatGPT`를 반환했다.

| 모델 | 로컬 카탈로그 기본 effort | 로컬 카탈로그가 표시한 effort |
| --- | --- | --- |
| `gpt-6-astra` | low | low, medium, high, xhigh, max, ultra |
| `gpt-5.6-sol` | low | low, medium, high, xhigh, max, ultra |
| `gpt-5.6-terra` | medium | low, medium, high, xhigh, max, ultra |
| `gpt-5.6-luna` | medium | low, medium, high, xhigh, max |
| `gpt-5.5` | medium | low, medium, high, xhigh |

사용자의 개발용 Codex 기본 설정은 `gpt-6-astra / low`였다. CLI 선택 방식은 다음과
같이 실제 `codex exec --help`와 호출로 확인했다.

```text
codex exec --model <MODEL> -c model_reasoning_effort="<EFFORT>"
```

Codex 설정 키와 명시적 model/config override 우선순위는
[OpenAI Codex Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)를
기준으로 확인했다. 실제 관찰값은
[`models-observed.json`](../../benchmarks/image-director/models-observed.json)에 기록했다.

## B. Benchmark

고정 benchmark는 다음 네 사례를 사용했다.

1. 단일 actor editorial 6장
2. 두 actor interaction editorial 6장
3. 6컷 action sequence
4. overhead, floor-level low angle, edge placement, foreground/background staging,
   asymmetric composition을 요구한 difficult direction 6장

모든 구성은 같은 Director 지시문, request, preset summary, canvas, schema 및 자동 평가기를
사용했다. 각 요청은 `--ephemeral`, read-only sandbox, structured output으로 한 번만 호출했다.
Image Maker plan cache는 우회했고 retry는 0회였다. Codex 서비스의 자동 prefix cache는 CLI에서
강제로 끄지 않았으며, 실제 usage에 나타난 cached input을 그대로 기록했다.

| Model / effort | Editorial | 2 Actor | Sequence | Difficult | 평균 시간 |
| --- | --- | --- | --- | --- | ---: |
| `gpt-5.6-luna / low` | FAIL | PASS | FAIL | PASS | 54.442초 |
| `gpt-5.6-luna / medium` | PASS | FAIL | FAIL | PASS | 56.434초 |
| `gpt-5.6-terra / low` | PASS | FAIL | PASS | PASS | 50.859초 |
| `gpt-5.6-terra / medium` | **PASS** | **PASS** | **PASS** | **PASS** | **49.217초** |
| `gpt-6-astra / low` | FAIL | PASS | FAIL | FAIL | 122.254초 |

모든 20회 호출은 process success, JSON schema, count, actor ID/order 및 preset 보존을
통과했다. 표의 FAIL은 그 이후의 continuity audit, semantic guard 또는 실제 Composer
preflight에서 발생했다.

신뢰 가능한 CLI usage 값도 반환됐다.

| Model / effort | Input | Cached input | Output |
| --- | ---: | ---: | ---: |
| `gpt-5.6-luna / low` | 75,267 | 0 | 11,031 |
| `gpt-5.6-luna / medium` | 75,267 | 0 | 11,476 |
| `gpt-5.6-terra / low` | 81,527 | 14,080 | 10,191 |
| `gpt-5.6-terra / medium` | 81,527 | 33,280 | 9,770 |
| `gpt-6-astra / low` | 85,099 | 0 | 15,475 |

전체 raw plan과 평가 결과는
[`benchmark-results.json`](../../benchmarks/image-director/results/benchmark-results.json)과
각 구성/사례 하위 directory에 보존했다. NovelAI 요청은 0회다.

## C. Failures

`gpt-5.6-luna / low`는 단일 actor 호텔 장면에 선언되지 않은 `guest` cue를 다시 넣어
semantic guard에 차단됐다. Sequence에서는 같은 기록실의 세부 구역을 서로 다른 locked
`location` 문자열로 기록했다.

`gpt-5.6-luna / medium`은 2인 화보에서 prop 상태를 locked `location` 문자열에 섞어 shot마다
location을 변경했다. Sequence에서는 location과 outfitState를 `continuous from shot_...`처럼
shot마다 달리 써 exact locked continuity를 위반했다.

`gpt-5.6-terra / low`는 2인 화보 한 shot에서 오른쪽 actor가 왼쪽 actor를 향한다는 문구를
썼다. 현재 Position validator가 이 방향 문구를 위치 cue로 읽어 Composer preflight를 차단했다.
연출 자체의 좌우 배치는 맞았지만 현재 production 경로 호환성 기준으로 FAIL을 유지했다.

`gpt-6-astra / low`도 세 사례에서 `toward frame left/right`, `reaching ... to the left` 같은
몸 방향·동작 문구가 Position validator의 위치 cue로 해석되어 preflight가 막혔다. 이는
구도 품질 저하보다 현재 validator와 상세 서술의 상호작용에 가깝지만, 실제 자동 생성 경로가
차단되므로 기본 모델 acceptance에는 실패다.

## D. Quality Review

`gpt-5.6-terra / medium`은 네 사례에서 모두 6개의 고유 camera signature와 6개의 고유
pose/action 조합을 만들었다. 단일 actor 화보의 placement는 5종, 나머지 세 사례는 6종이었다.
정확히 반복된 shot은 없었다.

2인 화보는 매 shot에서 두 actor의 좌우 좌표 순서를 유지했고, 같은 장부를 가리키기, 건네기,
서명하기, 시선 교환, 최종 인계를 구분했다. Sequence는 enter → approach shelf → remove ledger
→ carry/open → compare → write note의 순서를 지켰고, 동일한 `ledger_001` 상태와 exact locked
location/outfitState를 계승했다. Difficult set은 overhead, floor-level low angle, corner/edge
placement, foreground/background depth, asymmetric composition을 모두 포함했다.

연출은 schema를 채우기 위한 동의어 교체에 그치지 않았고, 각 shot에서 카메라·배치·행동의
관계가 실제로 달랐다. 미세 렌더 품질은 NovelAI를 호출하지 않았으므로 평가하지 않았다.

`gpt-5.6-sol`과 `gpt-5.5`는 호출하지 않았다. 단계형 탐색에서 Luna 다음의 balanced 후보인
Terra medium이 모든 기준을 충족한 시점에 중단했기 때문이다. 더 무거운 workhorse 또는 이전
세대 모델을 추가 호출하는 것은 최소 모델을 찾는 결론을 바꾸지 않고 사용량만 늘린다.

## E. Resource Review

측정된 평균 시간은 Terra medium 49.217초, Terra low 50.859초, Luna low 54.442초,
Luna medium 56.434초, Astra low 122.254초였다. 동일 계열 안에서도 서비스 상태와 provider
cache의 영향을 받으므로 작은 시간 차이를 일반 성능 순위로 확대 해석하지 않는다.

이 표본에서는 Terra medium이 유일하게 4/4를 통과하면서 output token도 9,770으로 가장
적었다. Luna는 더 가벼운 모델이지만 두 effort 모두 2/4였고, 자동 생성 전에 사람이 고쳐야
하는 plan 비율이 높아 전체 자원 절약으로 이어지지 않는다.

## F. Recommendation

Image Director runtime 기본 후보는 **`gpt-5.6-terra / medium`**이다.

이는 가장 큰 모델이 아니라, 현재 production validator와 네 종류의 연출 요청을 retry 없이
모두 통과한 가장 가벼운 검증 후보다. Luna를 기본으로 사용하기에는 structural/continuity
실패가 반복됐다. Astra는 이 benchmark에서 시간이 길고 상세 방향 문구가 Position audit과
충돌했다.

## G. Production Change

`src/services/codex-director-bridge.js`의 Image Director runtime 기본값을
`gpt-5.6-terra / medium`으로 설정했다. 개발용 `~/.codex/config.toml`은 수정하지 않아
`gpt-6-astra / low`를 그대로 유지한다.

`CHAESSI_CODEX_DIRECTOR_MODEL`과 `CHAESSI_CODEX_DIRECTOR_REASONING_EFFORT` 환경 변수는
계속 runtime override로 사용할 수 있다. 자동 fallback과 retry는 추가하지 않았다.

향후 UI의 `Auto / Fast / Quality` 선택은 이 runtime override 계층에 매핑할 수 있다. 이번
Phase에서는 검증되지 않은 Luna를 Fast 기본값으로 노출하거나 UI 옵션을 추가하지 않았다.

모델 또는 effort 변경 뒤 과거 모델의 cached plan이 재사용되지 않도록 Director cache identity에
runtime model/effort를 포함했다. 일반 runtime cache 자체는 유지된다.

## H. Regression

Bridge 단위 테스트에 runtime default, explicit override, cache 분리 검증을 추가했다.
전체 `test_*.js` 29개 파일에서 **82/82 PASS**했다. Bridge는 7/7 PASS했고 UI, plan cache,
Composer, semantic guard, multi-shot, v3.2.1 V5 T2I/I2I/Inpaint, History 및 Position Pad
회귀도 함께 통과했다.
