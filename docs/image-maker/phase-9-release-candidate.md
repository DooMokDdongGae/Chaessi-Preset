# Chaessi Preset + Image Maker — Phase 9 Release Candidate

작성일: 2026-09-12

## A. Proposed Version

제안 버전은 **v3.3.0**이다. Image Maker, Codex Image Director, multi-shot preflight/generation과 Gallery는 기존 v3.2.1 API 및 사용자 데이터와 호환되는 큰 신규 기능이므로 SemVer minor release가 적절하다.

현재 `package.json`과 생성된 기술 검증용 portable 파일은 사용자 승인 전까지 **3.2.1**을 유지한다. tag, GitHub Release, 공개 업로드와 배포 공지는 만들지 않았다.

## B. Release Scope

- 기존 Preset Workshop과 별개의 top-level Image Maker workspace
- 자연어 request, Character / Outfit / Style / Quality 선택
- Codex Image Director를 통한 `scene-plan/v2` 생성
- Editorial / Sequence 및 사용자 지정 shot count
- Shot Cards, Director Intent, shot overview, continuity와 position 표시
- 전체 shot preflight, safe rewrite, needs-review와 stale-state generation 차단
- 기존 Composer와 NovelAI adapter를 재사용하는 순차 multi-shot generation
- partial-failure 기록과 중복 생성 방지
- Gallery, prompt / metadata / payload 보기, shot-plan 연결
- Director Plan cache, Manual Plan fallback, Recent Runs, request/plan 재사용

## C. Existing Feature Preservation

| 기능 | 결과 | 근거 |
| --- | --- | --- |
| V5 T2I | PASS | V5 contract/support 및 Image Maker payload tests |
| V5 I2I | PASS | `test_v5_generation_modes.js` |
| V5 Inpaint | PASS | V5 multipart/inpaint 및 composite tests |
| V4.5 T2I/I2I/Inpaint | PASS | generation modes regression |
| Position Pad | PASS | 32-slot wiring, 0.001 coordinate migration test |
| History | PASS | bulk delete, navigation, direct lookup tests |
| Preset Workshop | PASS | migration coexistence test와 packaged app smoke |
| preset / generationStore | PASS | 기존 schema/store regression |
| safeStorage token path | PASS | Electron provider와 frontend secret tests |

Image Maker는 기존 Preset Workshop, History 또는 generationStore를 대체하지 않는다.

## D. Requirements

- Windows x64
- 실제 이미지 생성을 위한 사용자의 NovelAI 계정과 기존 Chaessi safeStorage token
- 자동 Director를 위한 Codex CLI와 ChatGPT 로그인
- runtime Director 기본값: `gpt-5.6-terra`, reasoning `medium`

Codex는 장면 계획을 만들고, Chaessi는 preset/prompt/payload를 구성하며, NovelAI가 이미지를 생성한다. 별도의 OpenAI API key를 Chaessi에 입력하지 않는다.

## E. Fallback

Codex CLI가 없거나 로그인, 사용량 또는 timeout 문제가 있어도 Preset Workshop은 정상 동작한다. Image Maker는 `Paste Plan`, `Import Plan`, `Use Pasted Plan`으로 수동 `scene-plan/v2`를 받을 수 있다.

자동화 테스트에서 Connected / Login required / Codex unavailable 상태와 Manual Plan 사용 가능 여부를 확인했다. 동일 입력의 검증된 plan은 cache에서 읽을 수 있다.

## F. Packaging

`npm run electron:dist`로 Windows portable 후보를 생성했다.

| 항목 | 값 |
| --- | --- |
| 기술 검증 파일 | `dist/Chaessi-Preset-v3.2.1-x64.exe` |
| 크기 | 97,877,404 bytes / 93.34 MiB |
| SHA-256 | `3FEB9963F3921566ECDDD32B4759FC30F4812CC2CEACD88643052C64E26AEA43` |
| packaged version | 3.2.1 |
| proposed public filename | `Chaessi-Preset-v3.3.0-x64.exe` |

격리된 user-data와 4191 포트에서 packaged app을 실행해 health, Image Maker catalog와 Director status를 확인했다. 결과는 v3.2.1, catalog PASS, Codex CLI 0.153.4 / ChatGPT authentication / `gpt-5.6-terra` / medium이다. 테스트 프로세스와 포트는 종료했다.

패키지에는 runtime에 필요한 `docs/image-maker/codex-image-director.md`가 포함된다. `data`, `.env`, tests, benchmark 결과, scripts, tmp, logs와 개인 run artifact는 포함되지 않는다. electron-builder는 기존 non-ASAR portable 구성을 경고했지만 빌드와 실행은 성공했다.

## G. Security

- Local API bind: `127.0.0.1`
- Codex child process: `shell: false`, `--ephemeral`, read-only sandbox, timeout과 출력 크기 제한
- Codex 실행 파일 탐지: 환경 override, LocalAppData의 설치 버전 탐색, PATH fallback. 개발 PC의 version hash 경로를 하드코딩하지 않음
- NovelAI token: 기존 Electron safeStorage/provider만 사용하고 Image Maker에 별도 저장소를 만들지 않음
- run/artifact endpoints: ID와 root containment validation 유지
- JSON/manual plan: contract 및 payload validation 후에만 generation 가능
- packaged source secret scan: 개인 절대 경로와 credential 형태 문자열 0건

## H. License

- Chaessi Preset: MIT
- Google T5 tokenizer asset: Apache-2.0 notice와 license text 포함
- Qwen 3.5 tokenizer asset: Apache-2.0 notice와 license text 포함
- `@msgpack/msgpack`: ISC notice 포함
- Prompt Set Generator: 설계 규칙만 참고했으며 원본 Python source 사본은 배포 소스에서 제거했다. 확인되지 않은 upstream license의 코드를 public package에 포함하지 않는다.
- Danbooru: resolver 코드만 포함하며 대형 CSV/RAG/e621 dataset은 저장소와 public package에 포함하지 않는다.

## I. Documentation

- `README.md`: Image Maker 개요, 역할, 요구사항, Codex 설정, 빠른 시작, Editorial/Sequence, Preflight/cache, Manual Plan, Outfit 독립 정책, renderer 차이와 privacy
- `CHANGELOG.md`: proposed v3.3.0 초안
- 공개용 익명 fixture 스크린샷:
  - `docs/images/image-maker/image-maker-main.png`
  - `docs/images/image-maker/director-plan.png`
  - `docs/images/image-maker/preflight.png`
  - `docs/images/image-maker/gallery.png`

스크린샷 fixture는 Sample Character, Tailored Navy Uniform과 미술관 editorial request를 사용한다. 개인 preset, generation 또는 절대 경로를 표시하지 않는다. Gallery 이미지는 개인정보가 없는 Chaessi 브랜드 sample asset이다.

## J. Tests

| 검사 | 결과 |
| --- | --- |
| 기존 Phase 1–8.3 regression | 91 / 91 PASS |
| Phase 9 release checks | 7 / 7 PASS |
| 전체 | **98 / 98 PASS** |
| screenshot fixture preflight | 3 / 3 READY, NovelAI 0회 |
| portable build | PASS |
| packaged app clean-profile smoke | PASS |
| packaged content/privacy scan | PASS |

Phase 9에서 NovelAI 요청은 보내지 않았다. 실제 생성 경로는 generation 관련 코드가 바뀌지 않았고 Phase 8.3 Electron E2E의 generation `2026-09-11_100813_d46c21`로 이미 확인됐다.

## K. Known Limitations

- NovelAI renderer는 Director Plan에 없는 사람, 소품 또는 스타일 장식을 추가할 수 있다.
- framing, outfit, pose와 표정이 계획과 완전히 일치한다고 보장하지 않는다.
- 자동 Director 사용 가능 여부와 한도는 사용자의 ChatGPT/Codex 계정에 따라 달라진다.
- Codex가 없을 때 자동 계획은 사용할 수 없으며 Manual Plan이 필요하다.
- 기존 portable build는 ASAR를 사용하지 않아 패키지 내부 소스가 일반 파일로 배치된다. secret과 사용자 데이터는 포함되지 않는다.
- Gallery 문서 스크린샷은 실제 생성물이 아닌 익명 브랜드 sample을 사용한다.

## L. Release Files

사용자 승인 후 최종 릴리스에서 준비할 파일:

- `Chaessi-Preset-v3.3.0-x64.exe`
- 해당 파일의 SHA-256
- v3.3.0 README와 CHANGELOG
- 네 장의 Image Maker 스크린샷
- LICENSE와 THIRD_PARTY_NOTICES

현재 로컬 RC 산출물은 버전 승인 전 검증용 `Chaessi-Preset-v3.2.1-x64.exe` 한 개다.

## M. Readiness

**READY FOR USER APPROVAL**

남은 작업은 승인된 버전으로 package/app 표시를 갱신하고 최종 EXE를 다시 빌드해 새 hash를 산출하는 것이다. 공개 tag, GitHub Release, upload와 announcement는 별도 명시적 승인 후에만 수행한다.
