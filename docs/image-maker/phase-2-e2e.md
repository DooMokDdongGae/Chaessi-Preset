# Phase 2 — 실제 1장 검증 (2026-09-08)

## 판정과 검증 범위

Image Maker 요청 → 기존 Chaessi API → NovelAI → PNG/sidecar/payload 저장은 **1회 성공**.
단, 실제 생성 요청은 이미 실행 중인 Electron 소유 3.2.1 서버(4174)가 처리했다.
새 Node 단독 3.1.1 서버는 별도 4175에서 GUI 없이 실행·health·프리셋 조회·인증 가용성을
확인하고 종료했다. **Node 단독 서버를 통한 실제 생성까지는 미검증**이다.
따라서 모든 단계를 한 Node 단독 프로세스로 통과했다고 보고하지 않는다.

## A. 실행 환경

- 실제 생성: `http://127.0.0.1:4174`, Chaessi Preset 3.2.1 기존 Electron backend, PID 12864.
- 임시 압축 해제 경로에서 portable Electron 실행 파일을 확인했다.
- 기존 portable EXE에서 실행된 자식 프로세스임을 확인했다.
- 실제 생성 인증: token-status 응답 `safe_storage`. 값은 출력·기록하지 않음.
- 단독 검증: 현재 workspace의 `node server.mjs`, PORT=4175,
  `CHAESSI_USER_DATA_DIR=%APPDATA%\Chaessi Preset`, 버전 3.1.1.
- 단독 인증 가용성: `env`, 프로세스 시작 전 NAI_ACCESS_TOKEN 미설정, 프로젝트 .env에 값 존재.
  토큰의 원격 유효성은 이 경로로 시험하지 않음.
- 실제 데이터 root: Electron `app.getPath("userData")`.
- generation root: 위 root의 `data\generations`.
- 원본 preset: `preset_2cc76fdfa1a8`; API와 backend 객체 전체 deep equality 확인.

## B. E2E 결과

| 단계 | 결과 |
|---|---|
| GUI 없는 단독 Node 서버 실행 | PASS (별도 4175, 생성 미실행) |
| health | PASS (4174/4175 각각 확인) |
| preset load | PASS (각 API와 파일 backend 동등) |
| compose | PASS |
| V5 request/payload validation | PASS |
| NAI request | PASS, POST 정확히 1회, HTTP 200 |
| image response | PASS, sidecar response_container=msgpack |
| PNG save | PASS, signature/IHDR/비어 있지 않은 파일 확인 |
| sidecar/metadata save | PASS, status=success, error=null, generation_id 일치 |
| payload save | PASS, 전송 전 actual builder 결과와 deep equality |
| original data unchanged | PASS, 기존 파일 해시 전부 유지 |
| GUI 조작·포커스 사용 없음 | PASS |
| 동일 Node 단독 서버에서 실제 NAI 생성 | 미검증 |

## C. 생성 결과

- ID: `2026-09-08_081252_8bcc02`
- 모델: `nai-diffusion-5-full`, text-to-image, n_samples=1.
- 해상도: 832 × 1216, seed=12345, steps=14.
- PNG: Electron userData 아래 `data/generations/<date>/<generation-id>.png` (1,675,641 bytes)
- sidecar/metadata: 같은 폴더의 `2026-09-08_081252_8bcc02.json` (54,262 bytes)
- payload: 같은 폴더의 `2026-09-08_081252_8bcc02.payload.json` (12,765 bytes)
- PNG 육안 확인: 의상을 착용한 인물과 야경. 이번 단계에서는 연출 품질 평가를 하지 않음.

## D. 데이터 보호

원본 preset SHA-256은 Phase 1과 동일:
`8430613fc986e0a53c1de29e4d56fa2b33e50545dfec3f2b6e7ac5ae73e8c057`.
사용자 `data` 아래 기존 파일 전체 SHA-256 비교에서 변경/삭제 0개.
추가 파일은 위 generation PNG/JSON/payload JSON 3개뿐이다.
production의 src/electron/cli, server.mjs, index.html, styles.css, package 파일,
.gitignore, README 해시 유지. 기존 사용자 변경 사항을 수정하지 않았다.
원본·Phase 1 요청은 유지하고 Phase 2의 비노출 요청 사본만 작성했다.
새 데이터 이동/복사/초기화는 없었으며 검증용 프로세스만 종료하고 기존 앱은 유지했다.

## E. 발견된 문제

1. 요청 사전 검사에서 노골적인 성기 묘사와 성적 표현을 발견했다. 그대로 생성하지 않고
   메모리의 preset 사본에서 해당 표현을 제거하고 성인/의상 착용을 명시했다.
   동일 scene-plan, preset ID, 모델, 파라미터, seed를 유지했다. 원문과 바이트 동일한
   요청을 생성한 것은 아니다. 원본 프리셋 및 기존 production 코드 수정은 없다.
2. 검증 스크립트의 포트 소유 확인 오류: child spawn 직후 health 응답만 확인해
   이미 실행 중인 4174 서버를 새 서버로 오인했다. 응답 버전 3.2.1과 safe_storage를
   보고 발견했으며 OS 포트 PID/부모/실행 파일 경로로 확인했다.
   이 문제는 인증/저장/payload 실패가 아닌 **검증 하네스의 서버 식별 문제**다.
   보고서의 초기 tokenSource/단독 서버 판정을 정정했다. 실패를 감추기 위한 재생성은 하지 않았다.
3. 추가 검증에서는 별도 4175 사용 및 자기 child의 실제 listen 로그를 기다린 뒤
   3.1.1 버전 확인으로 보완했다. 추가 생성 POST는 0회.
4. 향후 하네스는 생성 전에 포트 점유/실제 서버 버전/인증 출처/데이터 root를 확정해야 한다.
   최초 `tmp/image-maker-phase2.mjs`는 감사용으로만 보존하며 재실행하면 attempt ledger가
   차단한다. production 엔진 수정 필요는 이번 결과에서 발견하지 못했다.

## F. preview API

**다음 단계에서 수정** 권장. V5 실제 경로가 성공했으므로 preview도 동일 prepare/builder를
공유할 가치가 크다. 단순 모델 분기부터 테스트하고 img2img/inpaint/참조 이미지의 전처리까지
한 번에 옮기는 큰 리팩터링은 피한다. 현재 E2E는 preview를 사용하지 않았다.

## G. 다음 우선 작업 하나

**A. Codex Image Director 지시문 구축.** 설계 결과가 실제 생성 저장으로 이어지는 것은
확인됐으므로 원본 연출 규칙을 scene-plan 작성·검토 규칙으로 만드는 것이 사용자 목표에
가장 직접적이다. 단독 서버 실제 생성 검증의 빈칸은 남기고, 별도 승인 없이 추가 비용을
소모하는 재시험은 하지 않는다.

## 증거 파일

- `tmp/image-maker-phase2/report.json`: 서버 식별 정정 반영 최종 결과.
- `tmp/image-maker-phase2/headless-check.json`: 별도 Node 단독 확인 결과.
- `tmp/image-maker-phase2/attempt.json`: 정확히 1회 요청 ledger, 자동 재시도 없음.
- 같은 폴더의 scene-plan/resolved-preset/request-body/payload 및 before/after 해시 목록.
- 이 문서는 기존 .gitignore의 docs/ 제외 규칙에 따라 로컬에 보존된다.
