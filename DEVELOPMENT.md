# Development — v3.7.0

[README](README.md) · [한국어](#developer-ko) · [English](#developer-en) · [日本語](#developer-ja)

<a id="developer-ko"></a>
## 개발자용 — 한국어

### 프로젝트와 Electron 구조

v3.7.0은 기존 프리셋·History 호환성을 유지하면서 V5 Full High/Medium과 이미지 완성 도구를 지원합니다. V4.5 어댑터·import 해석은 과거 자료 호환성을 위해 남기되 신규 V4.5 생성은 차단합니다. Electron main process는 로컬 Node 서버를 실행하고 sandbox/contextIsolation을 사용하는 renderer에 UI를 표시합니다. 서버는 `127.0.0.1`에만 바인딩하며 NovelAI 인증은 서버에서 처리합니다.

### 개발 환경과 실행

Windows x64, Node.js 22 이상, npm, Git을 준비하세요. 저장소 루트에서 실행합니다. 일반 사용자는 이 절차가 필요 없습니다.

```powershell
npm ci
npm start
# 브라우저: http://127.0.0.1:4174/
```

Electron 실행:

```powershell
npm run electron:dev
```

포트는 `PORT`로 바꿀 수 있습니다. 웹 개발 모드는 `.env.example`을 참고해 로컬 `.env` 또는 `NAI_ACCESS_TOKEN` 환경변수를 사용합니다. Electron은 기존 safeStorage 토큰을 서버 자식 프로세스에 메모리로 전달합니다. 실제 토큰, `.env`, 인증 헤더를 커밋하거나 로그로 남기지 마세요.

웹 개발 데이터는 기본적으로 프로젝트의 `data/`에 저장됩니다. `CHAESSI_USER_DATA_DIR`로 서버의 데이터 루트를 바꿀 수 있습니다. Electron은 `app.getPath("userData")`를 사용합니다. Windows의 일반 위치는 `%APPDATA%\Chaessi Preset`이며 EXE 내부에 사용자 데이터가 저장되지 않습니다.

### 주요 디렉터리와 모듈

| 경로 | 역할 |
| --- | --- |
| `index.html`, `styles.css`, `src/app.js` | 작업대 UI와 이벤트 연결 |
| `electron/` | 앱 창, 서버 실행/종료, preload, safeStorage |
| `server.mjs`, `src/api/client.js` | 로컬 HTTP API와 클라이언트 |
| `src/state/` | 기본값, 프리셋 스키마, 모델별 상태, 분류 |
| `src/adapters/` | V5 생성·과거 자료 호환 NovelAI payload |
| `src/services/` | 프리셋/History/Wildcard 저장, 응답 해석, 생성 준비 |
| `src/ui/` | Position Pad, 이미지 입력, 마스크, 토큰 카운터, Wildcard dialog |
| `src/ui/workbench-controller.js`, `workbench.css` | 작업대 배치·편집 확대·Character 구성 |
| `src/ui/i18n.js`, `translations.js`, `preset-sorting.js` | 언어·번역·정렬 |
| `src/ui/character-preset-preferences.js`, `delete-confirmation.js` | 번호 슬롯별 필터 기억·삭제 확인 |
| `src/ui/manual-content.js`, `manual-reader.js`, `multilingual.css` | 통합 도움말 내용·화면·다국어 스타일 |
| `assets/manuals/{ko,en,ja}/` | 세 언어의 실제 앱 스크린샷 |
| `src/importers/` | 이미지·JSON 메타데이터 → 내부 프리셋 |
| `assets/` | 앱 아이콘과 로컬 tokenizer 자료 |
| `manuals/` | 배포 PDF 4개와 원본 화면 이미지 |
| `tests/`, `test_*.js`, `scripts/` | 단위/통합/회귀/UI 검증과 설명서 제작 |

### Preset → Generation → History

```text
UI 편집 → 내부 Preset → /api/novelai/prepare
→ 랜덤 구문·Wildcard 확정 → 선택된 문장 토큰 확인
→ /api/novelai/generate → 모델/모드 어댑터 → NovelAI
→ 응답 이미지와 확정 프리셋 → generationStore → History
```

전체 프리셋과 Character/섹션 프리셋은 별도 파일 저장소입니다. Import도 내부 스키마로 변환한 뒤 어댑터를 거칩니다. raw JSON을 그대로 생성에 전달하지 않습니다. History에는 최종 요청 정보와 결과를 저장하며 I2I/Inpaint/Reference 이미지는 별도 소유 asset으로 관리합니다. 기존 저장 스키마와 legacy History를 유지합니다.

신규 작업의 V5 기본값과 모델이 생략된 과거 데이터의 V4.5 해석을 구분합니다. 슬롯별 카테고리 기억은 프리셋·History 적용과 분리된 UI 설정입니다.

### Wildcard 구조

`wildcard-store.js`는 `data/wildcards/<id>/wildcard.json`에 key/name/entries를 저장하고 원자적 쓰기와 직렬화된 변경을 처리합니다. Key는 고정되며 후보는 trim·빈 줄 제거·중복 제거합니다. 중첩 Wildcard는 거부합니다.

`generation-prompt-resolver.js`는 기존 랜덤 블록을 먼저 처리한 뒤 참조마다 Node `crypto.randomInt`로 전체 후보 중 하나를 독립 선택합니다. 후보 안의 기존 랜덤 블록도 확정합니다. Base/활성 Character에 적용하고 High에서만 사용자 UC를 확정합니다. Medium의 비활성 UC는 검사·추첨하지 않으며 원본 편집 프리셋은 수정하지 않습니다.

`/api/novelai/prepare`의 ID는 최대 32개, 5분 만료, 단일 사용 cache에 확정 프리셋을 보관합니다. Generate는 그 복사본을 소비하므로 UI 확인과 전송 사이에 다시 뽑지 않습니다. 준비 ID 없는 API 요청도 서버에서 확정합니다. History 복사본에서는 비활성 모델 템플릿과 import 원본 스냅샷을 제거하고, 후보 목록이나 선택 mapping을 추가하지 않습니다.

`wildcard-controller.js`가 관리 dialog와 삽입을 담당하고 `/api/wildcards`가 CRUD를 제공합니다. 프리셋 공유 시 Wildcard 목록은 TXT로 별도 이동해야 합니다.

### 저장·복원과 이미지 도구

Save/Save As와 저장 상태 anchor는 편집 상태·생성 snapshot과 구분합니다. Revisions는 덮어쓰기 전 프리셋을 보존하며 Previous work는 세션 상태입니다. 모델이 생략된 과거 자료의 V4.5 해석과 신규 V5 기본값을 구분하고, 데이터 전체를 일괄 변환하지 않습니다.

`src/image-tools/`는 계약·비용 계획·실행·PNG 무결성·기록을, `src/ui/image-tools-*.js`는 dialog·Canvas를 맡습니다. 원본을 덮어쓰지 않고 별도 PNG/History를 저장합니다. 예상 Anlas와 실제 차감을 구분하며 중단된 유료 요청을 자동 재시도하지 않습니다. 기존 Inpaint의 마스크·Padding·양자화·Strength/Noise·요청·합성은 보존합니다. Focused Inpaint는 별도 crop 경로에서 선택 밖 RGBA를 유지합니다.

[읽기 전용 MCP](mcp/README.md)는 저장된 자료를 조회하는 선택 기능입니다. 앱 실행이나 이미지 생성에 필수는 아닙니다.

### NovelAI payload 처리

生成は V5 Full のみです。High は `nai-diffusion-5-full`、Medium は `nai-diffusion-5-full-medium`、Inpaint は対応する `-inpainting` と `infill`を使います。V5 は multipart と長さ接頭 MessagePack 応答を扱います。T2I/I2I は公式に合わせた入力処理、既存 Inpaint は独立した `chaessi-inpaint-strategy` 方針です。

Medium は14 Steps・Euler Ancestral・Heavy UC、CFG Rescale 省略、Base/Character のユーザー UC を送らない契約です。編集用の UC と High 設定は保持し、履歴には実効値を記録します。Import は API model と PNG の値から Effort を復元します。Quality Tags と UC preset の実効 prompt、History、PNG の整合性を確認します。

生成元 PNG bytes は保持し、画像処理結果には別の加工記録を付けます。加工 PNG では元の生成モデル・prompt と加工ツール・実寸を区別してください。大きな Base64 と認証情報は保存 payload/sidecar から除きます。V4.5 の読込経路を新規生成の再開と混同しないでください。

### 빌드

```powershell
npm run electron:pack
npm run electron:dist
```

첫 명령은 `dist/win-unpacked/`, 두 번째는 `dist/Chaessi-Preset-v3.7.0-x64.exe`를 만듭니다. 파일 목록은 세 언어 도움말·화면, 기존 PDF 4개, MIT/타사 라이선스를 포함하며 `.env`, 사용자 데이터, logs, tmp, 테스트 산출물은 제외합니다. 설치 프로그램·코드 서명·자동 업데이트는 없습니다.

### 테스트와 설명서 유지보수

```powershell
npm run test:v360
npm run test:image-tools
npm run test:wildcard
npm run test:regression
npm run test:character-preset-preferences
npm run test:character-preset-ui
npm run test:character-preset-restart
npm run test:multilingual
node scripts/audit-ui-translations.mjs
npm run test:multilingual-ui
npm run test:workbench
node scripts/verify-distribution.mjs
```

Wildcard 검증은 V5 High/Medium의 각 생성 경로와 비활성 UC를 mock NovelAI로 확인합니다. 회귀 suite는 기존 21개 스크립트입니다. Electron 검증은 언어·작업 상태·정렬·도움말·삭제·카테고리 기억·작업대를 확인합니다. 기본 검증은 실제 NovelAI를 호출하지 않습니다. mock과 실서비스 검증을 구분해 보고하세요. 기존 생성 검증 범위는 [VERIFICATION.md](VERIFICATION.md)를 참고하세요.

선택 UI 검증에는 별도로 설치한 Playwright가 필요합니다 (`npm install --no-save --package-lock=false playwright`). 기본 UI 스크립트는 설치된 Edge를 사용합니다. 외부 모듈 위치는 `CHAESSI_PLAYWRIGHT`로 지정할 수 있습니다.

```powershell
node scripts/verify-ui.mjs
node scripts/verify-electron-manuals.mjs
npm run test:v360-workflow
npm run test:image-tools-ui
```

실제 생성 검증은 `NAI_ACCESS_TOKEN`을 제공했을 때만 수행되며 계정 사용량을 소비할 수 있습니다. 요청 capture는 인증 헤더 없이 body만 테스트 cache에 남깁니다. UI 스크립트는 설명서 화면 이미지를 갱신하므로 변경을 검토하세요.

Electron UI 검사는 `.cache`의 격리된 데이터로 실행합니다. `CHAESSI_ELECTRON`으로 실행 파일을 지정하고 배포 smoke에는 `CHAESSI_PACKAGED=1`을 사용할 수 있습니다. 배포 smoke는 버전·후원 링크·도움말 접근만 확인하며 실제 결제 페이지를 열지 않습니다. 기존 PDF는 보존 자료이며 새 통합 도움말은 PDF를 재생성할 필요가 없습니다.

### 언어·정렬·도움말과 후원 링크 유지보수

영어 source key에 한국어·일본어 번역을 대응시킵니다. `i18n.js`는 컨트롤을 교체하지 않고 표시만 갱신하며 선택 언어를 localStorage에 기억합니다. 프롬프트·사용자 이름·저장 카테고리 키·모델 식별자는 번역하지 않습니다.

`preset-sorting.js`는 `Intl.Collator`와 날짜 필드로 검색/필터 후, 페이지 분할 전에 정렬합니다. 6개 선택을 기억하며 없는 날짜는 오래된 값으로 처리합니다. Character 필터는 번호 슬롯별 localStorage 설정입니다.

도움말은 앱 내부 DOM으로 표시하며 `manual-content.js`의 같은 35개 장을 세 언어로 관리합니다. `assets/manuals`의 실제 화면을 사용하고 인터넷에 의존하지 않습니다. 내용 수정 시 목차·검색·확대·관련 도움말 이동과 번역 수준을 확인하세요.

앱 정보 후원 문구도 세 언어로 유지합니다. main process는 지정된 HTTPS 후원 주소만 `shell.openExternal`로 엽니다. 임의 사용자 URL을 외부 실행하도록 확대하지 마세요. 앱은 결제나 후원 페이지의 가격·반복 결제 설정을 처리하지 않습니다.

### Release 기본 절차

새 버전을 배포할 때는 공개 승인 후 버전·기능·회귀·패키징·비밀정보 검사를 완료합니다. EXE는 portable이며 서명·설치 프로그램·자동 업데이트는 없습니다. 포함 파일과 라이선스, 파일 크기·SHA-256을 기록하고 업로드를 검증합니다. 이전 PDF는 v3.4.0 보존 자료로 구분합니다.

새 정식 배포는 새 버전·태그·EXE·체크섬을 함께 검증합니다. 이미 발행한 태그를 이동하거나 이전 릴리스 자산을 교체하지 않습니다.


<a id="developer-en"></a>
## Developer Guide — English

### Project and Electron architecture

v3.7.0 preserves preset/History compatibility while adding V5 Full High/Medium and image finishing. V4.5 adapters/import interpretation remain for legacy records; new V4.5 generation is blocked. Electron's main process starts a local Node server and displays a sandboxed, context-isolated renderer. The server binds only to `127.0.0.1`. The renderer uses local HTTP APIs; NovelAI authentication stays on the server.

### Environment and development

Use Windows x64, Node.js 22 or later, npm and Git. Run these commands at the repository root. Regular users do not need this procedure.

```powershell
npm ci
npm start
# Browser: http://127.0.0.1:4174/
```

Run Electron:

```powershell
npm run electron:dev
```

Override the port with `PORT`. Web development can use a local `.env` based on `.env.example`, or the `NAI_ACCESS_TOKEN` environment variable. Electron passes its existing safeStorage token to the server child process in memory. Never commit real tokens, `.env` or authorization headers, or write them to logs.

Web development stores data in the project's `data/` by default. `CHAESSI_USER_DATA_DIR` overrides the server's data root. Electron uses `app.getPath("userData")`, typically `%APPDATA%\Chaessi Preset` on Windows. User data is outside the EXE.

### Main directories and modules

| Path | Responsibility |
| --- | --- |
| `index.html`, `styles.css`, `src/app.js` | Workbench UI and event wiring |
| `electron/` | Windows, server lifecycle, preload and safeStorage |
| `server.mjs`, `src/api/client.js` | Local HTTP API and client |
| `src/state/` | Defaults, preset schema, model state and categories |
| `src/adapters/` | V5 generation and legacy-compatible payloads |
| `src/services/` | Preset/History/Wildcard stores, response decoding and generation preparation |
| `src/ui/` | Position Pad, image intake, masks, token counters and Wildcard dialog |
| `src/ui/workbench-controller.js`, `workbench.css` | Workbench layout, large editor and Character organization |
| `src/ui/i18n.js`, `translations.js`, `preset-sorting.js` | Language, translation and sorting |
| `src/ui/character-preset-preferences.js`, `delete-confirmation.js` | Numbered-slot filter memory and deletion confirmation |
| `src/ui/manual-content.js`, `manual-reader.js`, `multilingual.css` | Integrated help content, reader and multilingual styles |
| `assets/manuals/{ko,en,ja}/` | Actual screenshots in three languages |
| `src/importers/` | Image/JSON metadata to internal presets |
| `assets/` | App icons and local tokenizer data |
| `manuals/` | Four shipped PDFs and source screenshots |
| `tests/`, `test_*.js`, `scripts/` | Unit/integration/regression/UI verification and manual generation |

### Preset → Generation → History

```text
UI editing → internal Preset → /api/novelai/prepare
→ resolve random blocks and Wildcards → count selected prompt tokens
→ /api/novelai/generate → model/mode adapter → NovelAI
→ response image and resolved preset → generationStore → History
```

Full presets and Character/section presets have separate file stores. Imports convert to the internal schema before using adapters; raw JSON is not sent directly for generation. History stores the final request and result, with separate owned I2I/Inpaint/Reference image assets. Existing schemas and legacy History remain supported.

Distinguish the V5 default for fresh work from V4.5 interpretation of older data with no model field. Slot category memory is a UI preference independent of applying presets or History.

### Wildcard architecture

`wildcard-store.js` stores key/name/entries in `data/wildcards/<id>/wildcard.json`, using atomic writes and serialized mutations. Keys remain fixed; entries are trimmed and blank/duplicate lines removed. Nested Wildcards are rejected.

`generation-prompt-resolver.js` first handles existing random blocks, then independently selects each reference from the complete candidate list with Node `crypto.randomInt`. Existing random blocks inside selected candidates are resolved too. It resolves Base/enabled Character fields and custom UC only in High. Inactive Medium UC is neither validated nor sampled; the editing preset stays unchanged.

`/api/novelai/prepare` IDs hold resolved presets in a single-use cache with a five-minute lifetime and a maximum of 32 entries. Generate consumes that copy, avoiding a second draw between UI confirmation and transport. Requests without a preparation ID also resolve on the server. History copies omit inactive model templates and imported source snapshots; no candidate library or selection mapping is added.

`wildcard-controller.js` manages the dialog and insertion; `/api/wildcards` provides CRUD. Move candidate lists separately as TXT when sharing presets.

### Recovery and image tools

Keep Save/Save As and saved-state anchors separate from editing state and generation snapshots. Revisions retain the preset before overwrite; Previous work is session state. Distinguish legacy records without a model (V4.5 interpretation) from fresh V5 defaults; do not force-convert the whole library.

`src/image-tools/` handles contracts, cost plans, execution, PNG integrity and records; `src/ui/image-tools-*.js` handles the dialog/Canvas. Save separate PNG/History results without overwriting the source. Separate estimated and actual Anlas; do not automatically retry interrupted paid requests. Preserve existing Inpaint masks, Padding, quantization, Strength/Noise, transport and compositing. Focused Inpaint uses a separate crop path and preserves unselected RGBA.

The optional [read-only MCP](mcp/README.md) queries saved material; it is not needed to run the app or generate.

### NovelAI payload handling

Generation uses V5 Full only: `nai-diffusion-5-full` for High, `nai-diffusion-5-full-medium` for Medium, and the respective `-inpainting` model with `infill` for Inpaint. V5 uses multipart and length-prefixed MessagePack responses. T2I/I2I follow official input handling; existing Inpaint keeps the separate `chaessi-inpaint-strategy` policy.

Medium requires 14 Steps, Euler Ancestral, Heavy UC, omitted CFG Rescale and no custom Base/Character UC. Editing UC and High settings remain stored; History records effective values. Import restores Effort from API model/PNG data. Check agreement between effective Quality/UC prompts, History and PNG metadata.

Keep source generation PNG bytes intact. Image processing creates separate records; distinguish source generation model/prompt from the processing tool and actual output dimensions. Exclude large Base64 and authentication data from stored payloads/sidecars. Legacy V4.5 reading must not re-enable generation.

### Build

```powershell
npm run electron:pack
npm run electron:dist
```

The first command produces `dist/win-unpacked/`; the second creates `dist/Chaessi-Preset-v3.7.0-x64.exe`. The file list includes three-language help/screenshots, four previous PDFs and MIT/third-party licenses, and excludes `.env`, user data, logs, tmp and test artifacts. There is no installer, code signing or auto-update.

### Tests and manual maintenance

```powershell
npm run test:v360
npm run test:image-tools
npm run test:wildcard
npm run test:regression
npm run test:character-preset-preferences
npm run test:character-preset-ui
npm run test:character-preset-restart
npm run test:multilingual
node scripts/audit-ui-translations.mjs
npm run test:multilingual-ui
npm run test:workbench
node scripts/verify-distribution.mjs
```

Wildcard tests cover V5 High/Medium generation paths and inactive UC with mocked NovelAI. The regression suite runs 21 existing scripts. Electron verification checks languages, work state, sorting, help, deletion, category memory and the workbench. Default verification does not contact real NovelAI. Report mocked and live results separately; see [VERIFICATION.md](VERIFICATION.md) for earlier generation coverage.

Optional UI verification requires separately installed Playwright (`npm install --no-save --package-lock=false playwright`). The UI script uses installed Edge by default. Set `CHAESSI_PLAYWRIGHT` for an external module location.

```powershell
node scripts/verify-ui.mjs
node scripts/verify-electron-manuals.mjs
npm run test:v360-workflow
npm run test:image-tools-ui
```

Live generation runs only when `NAI_ACCESS_TOKEN` is supplied and may consume account usage. Request capture stores bodies without authentication headers in the test cache. The UI script updates manual screenshots; review resulting changes.

Electron UI checks use isolated data under `.cache`. Set `CHAESSI_ELECTRON` for an executable and `CHAESSI_PACKAGED=1` for distribution smoke. The smoke check covers version, support link and help access without opening the real payment page. Previous PDFs are archives; the integrated guide does not require regenerating PDFs.

### Language, sorting, help and support link maintenance

Map English source keys to Korean/Japanese translations. `i18n.js` updates presentation without replacing controls and remembers the language in localStorage. Do not translate prompts, user names, stored category keys or model identifiers.

`preset-sorting.js` uses `Intl.Collator` and dates after search/filtering and before pagination. It remembers six choices and treats missing dates as old values. Character filters are numbered-slot localStorage preferences.

Help uses in-app DOM with the same 35 chapters in three languages in `manual-content.js`. It uses actual screenshots from `assets/manuals` without an internet dependency. When editing, check contents, search, zoom, contextual navigation and equivalent translation coverage.

Keep App Info support text in all three languages. The main process opens only the specified HTTPS support address with `shell.openExternal`. Do not extend it to arbitrary user-URL execution. The app does not handle payments or support-page pricing/recurring-payment settings.

### Basic Release procedure

For a new release, obtain publication approval, align versions and complete functional/regression, packaging and secret checks. The EXE is portable, unsigned and has no installer or updater. Record included files, licenses, asset sizes and SHA-256; verify uploads. Identify old PDFs as v3.4.0 archives.

Validate the new version, tag, EXE and checksum together. Never move published tags or replace assets of an earlier release.


<a id="developer-ja"></a>
## 開発者ガイド — 日本語

### プロジェクトと Electron 構成

v3.7.0 はプリセット・履歴の互換性を保ち、V5 Full High/Medium と画像仕上げを追加します。V4.5 アダプター・Import 解釈は旧資料のために残し、新規 V4.5 生成は拒否します。Electron の main process がローカル Node サーバーと sandbox/contextIsolation 有効の renderer を起動します。サーバーは `127.0.0.1` のみにバインドし、NovelAI 認証はサーバー側で処理します。

### 開発環境と起動

Windows x64、Node.js 22 以上、npm、Git を用意し、リポジトリのルートで実行します。一般ユーザーには不要な手順です。

```powershell
npm ci
npm start
# ブラウザー: http://127.0.0.1:4174/
```

Electron を起動するには次を使います。

```powershell
npm run electron:dev
```

`PORT` でポートを変更できます。Web 開発では `.env.example` を参考にしたローカル `.env`、または `NAI_ACCESS_TOKEN` を使います。Electron は safeStorage のトークンをサーバー子プロセスにメモリー経由で渡します。実際のトークン、`.env`、認証ヘッダーをコミットしたり、ログに残したりしないでください。

Web 開発のデータは既定で `data/` に保存し、`CHAESSI_USER_DATA_DIR` でサーバーのデータルートを変更できます。Electron は `app.getPath("userData")` を使い、Windows の一般的な場所は `%APPDATA%\Chaessi Preset` です。ユーザーデータは EXE の外にあります。

### 主なディレクトリとモジュール

| パス | 役割 |
| --- | --- |
| `index.html`, `styles.css`, `src/app.js` | 作業台 UI とイベント接続 |
| `electron/` | ウィンドウ、サーバーの起動・終了、preload、safeStorage |
| `server.mjs`, `src/api/client.js` | ローカル HTTP API とクライアント |
| `src/state/` | 既定値、プリセットスキーマ、モデル別状態、カテゴリ |
| `src/adapters/` | V5 生成と旧資料互換の payload |
| `src/services/` | 保存、応答解析、生成準備 |
| `src/ui/` | Position Pad、画像、マスク、トークン数、ワイルドカード |
| `src/ui/workbench-controller.js`, `workbench.css` | 作業台配置、拡大編集、Character 構成 |
| `src/ui/i18n.js`, `translations.js`, `preset-sorting.js` | 言語、翻訳、並び替え |
| `src/ui/character-preset-preferences.js`, `delete-confirmation.js` | 番号別フィルター記憶、削除確認 |
| `src/ui/manual-content.js`, `manual-reader.js`, `multilingual.css` | 統合ヘルプ内容、表示、多言語スタイル |
| `assets/manuals/{ko,en,ja}/` | 実際のアプリ画面の3言語版 |
| `src/importers/` | 画像・JSON メタデータを内部プリセットへ変換 |
| `assets/` | アイコン、ローカルトークナイザー |
| `manuals/` | 従来の PDF 4個と画面画像 |
| `tests/`, `test_*.js`, `scripts/` | 単体・統合・回帰・UI 検証と資料作成 |

### Preset → Generation → History

```text
UI 編集 → 内部 Preset → /api/novelai/prepare
→ ランダム構文・ワイルドカードを確定 → 選択文のトークン数確認
→ /api/novelai/generate → モデル/方式のアダプター → NovelAI
→ 応答画像と確定プリセット → generationStore → History
```

全体プリセットと Character/セクションプリセットは別の保存領域です。Import は内部スキーマに変換してからアダプターを使い、raw JSON を生成へ直接渡しません。履歴には最終リクエストと結果を保存し、I2I/Inpaint/Reference 画像は別の所有 asset として管理します。既存スキーマと legacy History を維持します。

新規作業の V5 既定値と、モデル欄のない過去データを V4.5 と解釈する処理を区別します。番号ごとのカテゴリ記憶は、プリセット・履歴の適用とは独立した UI 設定です。

### ワイルドカードの構成

`wildcard-store.js` は `data/wildcards/<id>/wildcard.json` に key/name/entries を原子的に保存し、変更を直列化します。キーは固定です。候補を trim し、空行・重複を除き、入れ子の参照を拒否します。

`generation-prompt-resolver.js` は従来のランダムブロックを処理してから、各参照で Node `crypto.randomInt` を使って候補全体から独立に選びます。候補内のランダムブロックも確定します。Base/有効な Character を処理し、独自 UC は High のみで確定します。Medium の無効な UC は検査・抽選せず、元の編集プリセットを変更しません。

`/api/novelai/prepare` の ID は最大32件、5分で失効、1回のみ使用する cache に確定プリセットを保存します。Generate は同じコピーを使い、確認から送信までの再抽選を防ぎます。ID のないリクエストもサーバーで確定します。履歴では非アクティブなモデルテンプレートと読み込み元のスナップショットを除き、候補ライブラリや選択 mapping は追加しません。

`wildcard-controller.js` は管理と挿入を担当し、`/api/wildcards` が CRUD を提供します。プリセットを共有する場合、候補リストは TXT として別途移します。

### 復元と画像ツール

Save/Save As と保存状態の anchor は編集状態・生成 snapshot と区別します。Revisions は上書き前を保持し、Previous work はセッション状態です。モデル欄のない旧資料の V4.5 解釈と新規 V5 の既定値を区別し、ライブラリ全体を強制変換しません。

`src/image-tools/` は契約・費用計画・実行・PNG 整合性・記録、`src/ui/image-tools-*.js` は dialog・Canvas を担当します。元画像を上書きせず別の PNG/履歴に保存します。推定 Anlas と実際の差引を区別し、中断した有料要求を自動再試行しません。既存 Inpaint のマスク・Padding・量子化・Strength/Noise・送信・合成を保ちます。Focused Inpaint は別の切出経路で選択外 RGBA を保持します。

[読取専用 MCP](mcp/README.md) は保存資料を参照する任意機能で、アプリ起動や生成には必須ではありません。

### NovelAI payload の処理

新規生成は V5 Full のみです。High は `nai-diffusion-5-full`、Medium は `nai-diffusion-5-full-medium`、Inpaint は各 `-inpainting` と `infill` を使います。V5 は multipart と長さ付き MessagePack 応答を処理します。T2I/I2I は公式の入力処理に合わせ、既存 Inpaint は独立した `chaessi-inpaint-strategy` 方針を保ちます。

Medium は14 Steps・Euler Ancestral・Heavy UC 固定、CFG Rescale 省略、独自の Base/Character UC を送信しません。編集中の UC と High 設定は保持し、履歴には実効値を記録します。Import は API model と PNG から Effort を復元します。Quality/UC を含む実効文章・履歴・PNG の一致を確認してください。

生成元 PNG bytes を保ち、画像加工は別の記録を作ります。元の生成モデル・文章と、加工ツール・実際の出力サイズを区別します。大きな Base64 と認証情報は保存 payload/sidecar から除きます。旧 V4.5 の読込処理で新規生成を再び有効にしないでください。

### ビルド

```powershell
npm run electron:pack
npm run electron:dist
```

それぞれ `dist/win-unpacked/` と `dist/Chaessi-Preset-v3.7.0-x64.exe` を作成します。ファイル一覧は3言語のヘルプと画面、従来の PDF 4個、MIT/第三者ライセンスを含み、`.env`・ユーザーデータ・ログ・tmp・テスト結果を除きます。インストーラー・コード署名・自動更新はありません。

### テストと資料の保守

```powershell
npm run test:v360
npm run test:image-tools
npm run test:wildcard
npm run test:regression
npm run test:character-preset-preferences
npm run test:character-preset-ui
npm run test:character-preset-restart
npm run test:multilingual
node scripts/audit-ui-translations.mjs
npm run test:multilingual-ui
npm run test:workbench
node scripts/verify-distribution.mjs
```

Wildcard 検証は V5 High/Medium の生成経路と無効 UC を mock NovelAI で確認します。回帰 suite は既存の21スクリプトです。Electron 検証は言語、作業状態、並び替え、ヘルプ、削除、カテゴリ記憶、作業台を確認します。通常の検証は実際の NovelAI を呼び出しません。mock と実サービスを分けて報告してください。従来の生成検証範囲は [VERIFICATION.md](VERIFICATION.md) を参照してください。

UI 検証には Playwright を別途用意します（`npm install --no-save --package-lock=false playwright`）。従来の UI スクリプトは既定で Edge を使います。外部モジュールは `CHAESSI_PLAYWRIGHT` で指定できます。

```powershell
node scripts/verify-ui.mjs
node scripts/verify-electron-manuals.mjs
npm run test:v360-workflow
npm run test:image-tools-ui
```

実際の生成検証は `NAI_ACCESS_TOKEN` を提供したときに実行され、利用枠を消費する場合があります。別途承認を得てください。リクエスト capture は認証ヘッダーを除いた body を cache に保存します。画面画像を更新する UI スクリプトの変更も確認してください。

Electron UI 検証は `.cache` の隔離データで実行します。`CHAESSI_ELECTRON` で実行ファイルを指定し、配布 smoke は `CHAESSI_PACKAGED=1` でパッケージを確認できます。smoke はバージョン、支援リンク、ヘルプへの移動だけを確認し、実際の決済ページは開きません。従来の PDF は保存資料で、統合ヘルプのための PDF 再制作は不要です。

### 言語・並び替え・ヘルプ・支援リンクの保守

英語 source key に韓国語・日本語の翻訳を対応させます。`i18n.js` はコントロールを置き換えず表示を更新し、言語を localStorage に記憶します。プロンプト、ユーザー名、保存カテゴリキー、モデル識別子を翻訳しないでください。

`preset-sorting.js` は検索・絞り込み後、ページ分割前に `Intl.Collator` と日付を使って並べます。6種類の選択を記憶し、日付のない項目は古い値として扱います。Character のフィルターは番号スロット別の localStorage 設定です。

ヘルプはアプリ内 DOM で表示し、`manual-content.js` の同じ35章を3言語で管理します。`assets/manuals` の実際の画面を使い、インターネットに依存しません。更新時は目次・検索・拡大・関連ヘルプへの移動と翻訳内容の同等性を確認してください。

アプリ情報の支援文も3言語で維持します。main process は指定した HTTPS 支援 URL だけを `shell.openExternal` で開きます。任意のユーザー URL を外部実行する機能に広げないでください。アプリは決済や支援サイトの価格・定期支援設定を処理しません。

### Release の基本手順

新しい版の配布は公開承認後、バージョン・機能・回帰・パッケージ・秘密情報を確認します。EXE は未署名 Portable で、インストーラー・自動更新はありません。同梱物・ライセンス・サイズ・SHA-256 を記録しアップロードを検証します。旧 PDF は v3.4.0 の保存資料です。

新しい正式版・タグ・EXE・チェックサムを一緒に検証します。公開済みタグを移動せず、以前の配布ファイルを交換しません。
