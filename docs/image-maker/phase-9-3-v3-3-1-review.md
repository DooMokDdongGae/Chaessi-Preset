# Chaessi Preset v3.3.1 — Image Maker UX / Workflow Review

## Before / after

v3.3.0의 기본 흐름은 `고정 preset 선택 → Create Director Plan → Run Preflight → Generate`였다.
v3.3.1의 기본 흐름은 `자연어 요청 → 필요한 preset만 선택적으로 추가 → Generate → 이미지와 최종 prompt`다.
Director Plan, 개별 Preflight, import/paste와 raw JSON은 삭제하지 않고 Advanced recovery 영역으로 옮겼다.

## Source of truth

- preset category와 목록: 기존 `presetStore.listPresets()` 및
  `characterPresetStore.listCharacterPresets()` 결과를 `/api/image-maker/catalog`에서 그대로 투영한다.
- generation settings: Generate 시 `syncPresetFromForm()`으로 갱신한 `state.currentPreset`과
  `generationModeController.getGenerateRequest()`가 권위 있는 입력이다.
- scene direction: Codex Director가 자연어 요청과 optional preset block의 작은 의미 요약만 사용한다.
- payload: Composer가 기존 `buildModeGeneratePayload()` 경로를 호출한다. V4.5/V5와
  T2I/I2I/Inpaint용 builder를 복제하지 않았다.

## Request and preset blocks

`chaessi-image-request/v3`는 request, Editorial/Sequence, count, optional `presetBlocks`, 그리고
Workshop generation summary를 가진다. preset block은 `global` 또는 `actor-N` scope, 실제 store,
실제 category와 preset ID를 보존한다. 0개, 동일 category의 여러 block, 삭제와 입력 순서를 지원한다.
명시적인 사람 수가 자연어에 있으면 synthetic actor binding 수에 반영하고, actor block이 있으면 가장
큰 actor scope까지 확장한다.

## Automatic orchestration

일반 Generate는 현재 입력을 검증하고 planning revision에 맞는 plan이 없을 때만 Codex Director를
호출한다. 이어서 전체-shot Preflight를 수행하고 READY일 때만 기존 sequential runner를 시작한다.
NEEDS REVIEW와 FAILED에서는 NovelAI 호출 전에 멈춘다. 기존 plan cache와 중복 generation 방지는
그대로 유지한다.

## Generation settings and stale state

Director planning revision에는 request, count, editorial/sequence, preset blocks, model, generation mode,
width와 height가 포함된다. Steps, Scale, CFG rescale, Sampler, Seed, UC, Quality와 transparent setting은
render revision에 포함된다. render-only 변경은 기존 plan을 유지하고 Preflight만 무효화한다. 최종
Composer와 payload는 항상 최신 Workshop preset snapshot을 사용한다.

## Final Prompt

Result card는 이미지, shot, seed, resolution 다음에 Final NovelAI Prompt를 우선 표시한다. Prompt detail은
실제 저장된 payload의 Positive, Character slot, Negative/Undesired 문자열을 사람이 읽을 수 있는 text로
보여주며 그대로 복사할 수 있다. Shot Plan, Metadata와 Payload는 접힌 Technical details에 남겼다.

## Compatibility

기존 Preset Workshop, V4.5/V5 T2I/I2I/Inpaint builders, Position Pad, actor Anchor/Modifier mapping,
generationStore, History, safeStorage, Codex Bridge/cache, Manual Plan fallback과 Character/Outfit independence
정책을 유지한다. 공개된 v3.3.0 tag와 release asset은 변경하지 않았다.

## Validation

- request-only v3 workflow multi-shot dry-run: PASS
- optional real-store preset blocks: PASS
- V5 and V4.5 authoritative Workshop settings propagation: PASS
- renderer-only stale-state split: PASS
- natural-language actor binding inference: PASS
- human-readable/copyable final prompt wiring: PASS
- full regression: **108 / 108 PASS**
- browser UI smoke: request-only Generate enablement, optional preset block, and Advanced recovery controls PASS
- packaged Electron smoke: `npm run electron:pack`, isolated Local API health `version = 3.3.1` PASS

## Known limitations

- Manual Plan은 synthetic v3 binding ID와 현재 request의 mode/count를 맞춰야 한다.
- 자연어 actor-count 추론은 명시적인 수나 명확한 girl/boy, woman/man, 여성/남성 표현을 우선한다.
  모호한 군중 표현은 semantic review 대상이 될 수 있다.
- 실제 NovelAI 생성에는 사용자 token과 비용이 필요하므로 자동 회귀는 payload 및 dry-run을 중심으로 한다.
