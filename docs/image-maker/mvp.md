# Chaessi Image Maker — backend MVP

## 계약과 실행

V5 전체 프리셋 + 전역 scene 텍스트 → resolved preset → 검증된 V5 payload.
GUI, DOM, Electron, 서버 시작, 토큰 로드, NAI 호출, 데이터 이관은 수행하지 않는다.
기존 프로젝트 파일은 수정하지 않고 새 모듈과 CLI를 추가했다.

```powershell
node cli/chaessi.mjs presets --data-root "%APPDATA%\Chaessi Preset"
node cli/chaessi.mjs dry-run --data-root "%APPDATA%\Chaessi Preset" --input examples/image-maker/scene-plan.json --out-dir tmp/my-image-maker-run
node --test test_image_maker_backend.js
```

출력 폴더의 부모는 존재해야 하고 출력 폴더 자체는 없어야 한다. 기존 출력은 덮어쓰지 않는다.
완료는 CLI 종료 코드 0과 manifest 존재로 판단한다. 쓰기 실패 시 일부 파일이 남을 수 있다.

## 모듈 역할

- `src/state/scene-plan.js`: scene-plan/v1 런타임 검증. 현재 basePresetId, request,
  scene.mainPrompt/supplement, overrides.seed만 지원. 알 수 없는 필드는 조용히 무시하지 않고 거부.
- `src/services/preset-composer.js`: composeScenePlan(plan, basePreset), prepareResolvedPreset(preset).
  복제 후 append하고 기존 랜덤 resolver/모델 분기 builder/검증기를 사용. 파일·네트워크 IO 없음.
- `src/services/image-maker-backend.js`: 명시적 dataRoot, 읽기 전용 목록/로드/prepare.
  기존 createPresetStore().getPreset() 사용. 목록에서 디렉터리를 만드는 기존 listPresets()는 사용하지 않음.
- `cli/chaessi.mjs`: 얇은 JSON 입출력 계층. presets, dry-run 지원.
- `examples/image-maker/scene-plan.json`: 이 PC에서 확인한 실제 V5 preset ID 예시. 다른 PC에서는 교체.
- `test_image_maker_backend.js`: 입력 보존, 원본 파일 보존, 검증 거부, payload 재현 및 CLI overwrite 거부.

Frontend는 브라우저에서 Node 모듈을 직접 import하지 않고 동일 backend를 호출하는 서버
라우트를 향후 얇게 추가한다. Codex·스크립트는 동일 JSON/모듈 또는 CLI를 사용할 수 있다.

```js
import { createImageMakerBackend } from '../../src/services/image-maker-backend.js';
const backend = await createImageMakerBackend({ dataRoot: absoluteRoot });
const prepared = await backend.prepare(scenePlan);
// prepared.resolvedPreset / payload / requestBody / validation
```

## 출력과 조합 정책

- resolved-preset.json: 기존 chaessi-preset/v2, scene-plan 필드 섞지 않음.
- payload.json: buildModeGeneratePayload(..., {mode:'text-to-image'})의 V5 결과.
- request-body.json: 기존 POST /api/novelai/generate가 받는 `{preset}`.
- manifest.json: 설계 입력, 데이터 루트, 검증, 확정 seed, 전송하지 않았다는 상태.

base 문자열/가중치/캐릭터/negative/생성 파라미터는 유지한다. mainPrompt는 쉼표로,
supplement는 개행으로 추가한다. 의미 중복이나 기존 의상·배경과의 충돌을 자동 수정하지 않는다.
request는 감독의 원래 지시를 기록하는 메타데이터이며 payload에 넣지 않는다.
overrides.seed는 0~4294967295 정수만 허용. 생략 시 기존 seed 또는 builder의 랜덤 seed를
한 번 확정한다. 랜덤 prompt는 기존 resolver로 한 번 해석하며 미해결 || 블록은 거부한다.
V4.5를 V5로 자동 변환하지 않는다. 한 번에 1장만 허용. 모델의 기본 품질/UC 변환은 기존
V5 adapter에 맡긴다. 기존 validator 통과가 의미적 품질, 토큰 길이, 원격 API 수락까지
보증하지는 않는다.

## 데이터/인증 확인 결과

- Node 개발 root에서 전체 preset 1개와 V4.5 구성을 확인했다.
- Electron 사용자 데이터의 `data/presets`에서 실제 preset 존재를 확인했다.
- 선택: `preset_2cc76fdfa1a8`, V5 가장맘에드는 얼굴과 눈 - yoya kidmo G 컬러.
- Electron 코드는 app.getPath('userData')를 CHAESSI_USER_DATA_DIR로 자식 서버에 전달한다.
  현재 켜진 Electron 프로세스의 경로를 조회한 것은 아니며, 위 위치는 디스크의 실제 데이터 확인이다.
- 이 작업 환경의 CHAESSI_USER_DATA_DIR와 NAI_ACCESS_TOKEN은 미설정. 프로젝트 .env는 존재한다.
  .env 내용/토큰 값/암호화 토큰은 읽거나 출력하지 않았다. 토큰 유효성은 미확인이다.
- backend는 환경변수 root를 자동 추정하지 않는다. 명시적 root를 요구하며 기존 서버의
  migrateProjectDataToUserData()를 호출하지 않는다. 사용자 저장소에는 쓰지 않는다.

## 기존 Local API 연결 준비

request-body.json은 기존 `POST /api/novelai/generate`용이며 raw payload를 제출하는 파일이 아니다.
서버는 요청의 preset을 검증하고 동일 builder로 재구성하여 generationStore에 저장한다.
실제 연결 전 확인할 사항:

1. 대상 서버가 사용하는 DATA_ROOT가 의도한 generation 저장 위치인지 확인.
2. Node 환경/.env 또는 Electron 암호화 저장소→자식 프로세스 중 사용할 인증 경로 확인.
3. 준비한 request-body.json을 한 번 POST. 자동 재시도는 중복 생성 가능성이 있어 하지 않음.
4. 반환된 generation.image_path/sidecar_path/payload_path 확인.

MVP는 이 계약 파일까지만 준비한다. 인증/대상 서버 데이터 루트가 확인되지 않았으므로
실제 HTTP 생성 요청은 수행하지 않았다. 새 NAI 클라이언트나 서버 자동 실행 기능은 없다.
기존 `/api/payload/preview`의 V4.5 고정 문제는 이번 변경 범위 밖으로 유지했다.

## 확장

지원하지 않는 character/outfit/style/quality/camera/lighting/characters/shots/count는 현재 거부한다.
필드를 검증기와 composer에 함께 추가하거나 의미가 바뀌면 schema v2로 올린다.
핵심은 CLI가 아니라 scene-plan → prepared-generation 계약이므로 다른 호출 계층을 붙일 수 있다.
권장 순서: 인증·저장 위치 확인 후 한 장 E2E → Director 지시문 → 프리셋 조합 확장 →
multi-shot/완료 manifest → Frontend → Codex 자동 호출 Bridge 조사.

## 2026-09-08 검증 기록

| 검증 | 결과 |
|---|---|
| 실제 Electron 저장소 V5 preset 읽기 | PASS |
| mainPrompt/supplement 결합 | PASS |
| scene-plan / resolved preset / V5 payload 검증 | 모두 PASS, warnings 0 |
| 고정 seed | 12345 |
| request-body로 서버와 같은 resolver/builder 재실행 | payload deep equality PASS |
| 원본 preset 파일 SHA-256 전후 비교 | PASS |
| 원본 감사 사본 해시 비교 | PASS |
| node --test test_image_maker_backend.js | 3개 PASS |
| GUI/DOM 없이 실행 | PASS |
| 실제 NAI 요청·이미지 저장 | 미실행 |

실제 dry-run 결과: `tmp/image-maker-mvp-dry-run/`의 resolved-preset.json,
payload.json, request-body.json, manifest.json, verification.json.
기존 preset SHA-256: `8430613fc986e0a53c1de29e4d56fa2b33e50545dfec3f2b6e7ac5ae73e8c057`.
테스트 러너는 최초 샌드박스 자식 프로세스 실행이 EPERM으로 차단되어 승인 실행으로
재시도한 뒤 통과했다. 테스트는 임시 fixture만 쓰고 외부 API를 호출하지 않는다.
