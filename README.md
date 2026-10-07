# Chaessi Preset v3.4.0

NovelAI를 위한 Windows 프롬프트·프리셋 작업대 / A Windows prompt and preset workbench for NovelAI.

**목차 / Contents**

- [사용자용 — 한국어](#user-ko)
- [User Guide — English](#user-en)
- [개발자용 — 한국어](#developer-ko)
- [Developer Guide — English](#developer-en)

<a id="user-ko"></a>
## 사용자용 — 한국어

### 어떤 앱인가요?

Chaessi Preset은 NovelAI로 그림을 만들 때 자주 쓰는 문장과 설정을 저장하고 다시 불러오는 앱입니다. 인물, 옷, 배경, 그림체를 프리셋으로 정리하고, 결과를 History에서 다시 볼 수 있습니다. 그림 생성에는 본인의 NovelAI 계정과 인터넷 연결이 필요합니다.

v3.4.0은 v3.2.1 작업대를 기준으로 Wildcard와 그림 설명서를 추가한 버전입니다.

### 주요 기능

- 전체 프리셋과 Character Prompt Preset 저장·불러오기, 분류와 썸네일 관리
- Base Prompt, Undesired Content, 여러 Character Prompt와 생성 설정 편집
- V5 캐릭터 위치를 움직이는 Position Pad
- 글로 생성, 이미지 변형, 선택 영역 다시 그리기
- V4.5 Precise Reference와 PNG/WebP/JPEG 이미지 입력·메타데이터 가져오기
- 기존 `||A|B|C||` 랜덤 문법과 새 Wildcard 라이브러리
- 생성 결과 미리보기·저장, History 탐색·재사용·삭제
- 앱 안에서 열 수 있는 한국어·영어 PDF 설명서 4개

### 설치와 실행

1. [v3.4.0 Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.4.0)에서 `Chaessi-Preset-v3.4.0-x64.exe`를 받습니다.
2. 원하는 폴더에 놓고 실행합니다. Windows x64용 portable 앱이므로 별도 설치나 Node.js가 필요하지 않습니다.
3. **API Settings**를 열고 본인의 NovelAI access token을 저장합니다.
4. 프롬프트와 설정을 확인한 뒤 **Generate**를 누릅니다.

EXE만 새 파일로 교체해도 저장된 앱 데이터는 유지됩니다. 사용자 프리셋과 History는 EXE와 별도로 저장됩니다. 중요한 데이터는 업데이트 전에 백업하세요. 자동 업데이트와 설치 프로그램은 제공하지 않습니다.

### NovelAI 사용 준비

NovelAI 계정에서 이미지 생성이 가능한지, 사용량과 잔액이 충분한지 확인하세요. **API Settings**에 토큰을 입력하고 저장하면 이후 토큰 값은 다시 표시하지 않습니다. **Clear Saved Token**으로 앱에 저장한 토큰을 지울 수 있습니다. 토큰을 다른 사람에게 보내거나 화면에 공개하지 마세요.

토큰은 이 PC의 암호화된 앱 저장소에 보관됩니다. API 인증 오류가 나면 계정 상태와 토큰을 확인하세요. 생성 비용은 NovelAI의 계정·모델·설정에 따라 달라집니다.

### Preset 기본 사용법

1. **Name**에 알아보기 쉬운 이름을 씁니다.
2. **Base Prompt**에는 그리고 싶은 내용을, **Undesired Content**에는 피하고 싶은 내용을 씁니다.
3. 모델, 크기, Steps, Seed 등 설정을 고릅니다. 모르면 기본값부터 시작하세요.
4. **Save**로 전체 작업대를 저장하고, 새 이름으로 남기려면 **Save As**를 씁니다.
5. 저장한 프리셋을 불러오고 **Generate**를 누릅니다.

Base Prompt 옆 **Preset**은 재사용할 문장 모음을 불러오는 버튼입니다. 선택한 항목의 Prompt와 Undesired로 현재 입력을 교체하고, **Name**에 실제 프리셋 이름을 표시합니다. 전체 작업대를 저장하는 Save와는 범위가 다릅니다.

### Character / Outfit / Position

**Add Character**로 인물 입력칸을 추가하세요. 각 인물의 Prompt와 Undesired를 따로 쓰고, 그 인물 옆 **Preset**에서 저장한 문장을 불러올 수 있습니다. 분류는 인물 슬롯 번호와 연결되지 않습니다.

의상은 Character Prompt Preset의 **여성 의상 / 남성 의상** 분류에 저장해 찾아 쓰세요. 두 의상 분류의 하위 목록은 한글 이름 기준 가나다순입니다. **Manage Categories**에서는 분류와 한 단계 하위 분류를 추가할 수 있습니다.

V5에서 **Custom** 위치를 고르면 Position Pad가 나타납니다. 번호가 붙은 점을 끌어서 해당 인물이 자리할 위치를 정하세요. **AI’s Choice**는 위치를 모델에 맡깁니다. 여러 점을 같은 곳에 두면 겹칠 수 있으며, 지정 위치가 결과에 정확히 반영되는 것은 보장되지 않습니다.

### Wildcard: 긴 후보 목록을 쉽게 쓰기

1. 상단 **Wildcards** → **New**를 누릅니다.
2. Key에 `tops`, Name에 `상의`를 씁니다.
3. 후보를 한 줄에 하나씩 적고 **Save**합니다.

```text
white shirt
black shirt
blue shirt
red shirt
```

4. 프롬프트 옆 **Wildcard** 버튼에서 항목을 선택하고 **Insert**합니다. 직접 `__tops__`를 적어도 됩니다.

```text
1girl, solo, __tops__, __poses__, ||indoors|outdoors||
```

`poses`도 만들어야 위 예제가 동작합니다. 예를 들어 `standing`, `sitting`, `walking`을 각각 한 줄에 저장하세요. Base, Undesired, Character의 입력에서 여러 Wildcard를 함께 사용할 수 있습니다.

생성할 때마다 전체 후보 중 하나를 같은 확률로 선택합니다. `blue shirt`가 뽑히면 실제 요청과 History, 결과 이미지의 NovelAI 메타데이터에는 선택된 문장이 들어갑니다. 프리셋에는 `__tops__`가 남아 다음에 다시 뽑을 수 있습니다. 같은 후보가 연속으로 나오는 것도 정상입니다.

- 빈 줄과 같은 후보의 중복은 저장할 때 정리됩니다.
- Key는 영문 소문자·숫자·`-`·`_`로 만듭니다. 저장한 Key는 바꿀 수 없고 Name과 후보는 수정할 수 있습니다.
- **Import TXT / Export TXT**로 긴 목록을 가져오거나 내보내고, **Sample**로 예시 하나를 볼 수 있습니다. Sample은 실제 생성 선택을 고정하지 않습니다.
- 후보 안에 기존 `||A|B||`는 쓸 수 있지만 다른 Wildcard 참조는 넣을 수 없습니다.
- 없는 Key나 빈 목록은 생성 오류를 표시합니다. 다른 PC에서도 프리셋을 쓰려면 같은 Key의 Wildcard 목록을 준비하세요.
- History를 재사용하면 당시 선택된 문장을 사용합니다. 새로 뽑으려면 원래 프리셋을 불러오세요.

### 생성 방식과 지원 모델

| 기능 | NovelAI V4.5 Full | NovelAI V5 Full |
| --- | --- | --- |
| Text to Image | 지원 | 지원 |
| Image to Image | 지원 | 지원 |
| Inpaint | 지원 | 지원 |
| Character Prompt | 최대 6개 | 최대 32개 |
| Precise Reference | 지원 | 지원하지 않음 |
| V5 Position Pad | 해당 없음 | 지원 |

**Text to Image**는 글로 새 그림을 만듭니다. **Image to Image**는 원본 그림을 바꾸며 Strength와 Noise로 변화를 조절합니다. **Inpaint**는 Brush로 칠한 부분을 다시 그립니다. Eraser, Undo, Redo, Clear Mask를 사용할 수 있으며 빈 선택 영역으로는 생성할 수 없습니다.

**Open Image**, 붙여넣기, 드래그 앤 드롭으로 PNG/WebP/JPEG를 넣고 사용할 곳을 선택하세요. 이미지의 NovelAI 설정은 메타데이터 가져오기를 직접 선택했을 때만 적용됩니다. V4.5 **Precise Reference**는 Character, Style 또는 둘 모두를 참고하도록 이미지와 강도를 설정합니다.

### History

생성한 그림을 클릭하면 크게 보고 당시의 Prompt와 설정을 확인할 수 있습니다. 좌우 버튼 또는 방향키로 이전·다음 그림을 보세요. 결과를 저장하거나 프리셋으로 재사용할 수 있습니다. 선택 모드에서 여러 기록을 삭제할 수 있으며, 확인 후 삭제하면 해당 결과와 소유한 관련 파일도 영구 삭제됩니다.

### 그림 설명서 열기

상단 **v3.4.0** 버튼을 눌러 **App info & Manuals**를 엽니다. 다음 PDF가 앱의 별도 창에서 열립니다. 파일 폴더를 찾을 필요가 없습니다.

| 설명서 | 한국어 | English |
| --- | --- | --- |
| 전체 앱 | [전체 앱 설명서](manuals/app-ko.pdf) | [App guide](manuals/app-en.pdf) |
| Wildcard | [Wildcard 설명서](manuals/wildcard-ko.pdf) | [Wildcard guide](manuals/wildcard-en.pdf) |

위 PDF는 Release에서도 따로 받을 수 있습니다.

### 주의사항

프롬프트와 입력 이미지는 생성 요청에 사용되어 NovelAI로 전송됩니다. 결과 이미지에 프롬프트가 포함될 수 있으니 공유 전에 확인하세요. 토큰과 개인정보를 프롬프트에 쓰지 마세요. History와 프리셋은 로컬 데이터이므로 PC를 바꿀 때 따로 백업해야 합니다.

이 앱은 서명되지 않은 실행 파일이라 Windows가 신뢰 경고를 표시할 수 있습니다. 공식 저장소의 Release 파일인지 확인하세요. V5 Precise Reference, Vibe Transfer, ControlNet, V5 Curated, 영상 생성은 지원하지 않습니다. MIT 라이선스이며 타사 구성요소 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.

<a id="user-en"></a>
## User Guide — English

### What is Chaessi Preset?

Chaessi Preset saves and reuses prompts and settings for making pictures with NovelAI. Organize people, outfits, backgrounds and styles as presets, and revisit results in History. Generation requires your own NovelAI account and an internet connection.

v3.4.0 adds Wildcards and illustrated guides to the v3.2.1 workbench.

### Main features

- Full and Character Prompt Preset saving/loading, categories and thumbnails
- Base Prompt, Undesired Content, multiple Character Prompts and generation settings
- V5 Position Pad for moving characters
- Text generation, image transformation and repainting selected areas
- V4.5 Precise Reference and PNG/WebP/JPEG intake with optional metadata import
- Existing `||A|B|C||` random syntax and a new Wildcard library
- Result preview/save and History browsing, reuse and deletion
- Four Korean/English PDF guides accessible inside the app

### Download and run

1. Download `Chaessi-Preset-v3.4.0-x64.exe` from the [v3.4.0 Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.4.0).
2. Put it in a folder and run it. This is a portable Windows x64 app; no installer or Node.js is required.
3. Open **API Settings** and save your own NovelAI access token.
4. Check your prompt and settings, then click **Generate**.

Replacing the EXE keeps saved app data. Presets and History are stored separately from the executable. Back up important data before updating. There is no automatic updater or installer.

### Prepare NovelAI

Check that your NovelAI account can generate images and has enough available usage or balance. Enter and save your token in **API Settings**; the saved value is not displayed again. **Clear Saved Token** removes the app's saved token. Do not share your token or expose it on screen.

The token is stored in encrypted app storage on this PC. For authentication errors, check your account and token. Generation costs depend on your NovelAI account, model and settings.

### Basic Preset workflow

1. Enter a recognizable **Name**.
2. Write what you want in **Base Prompt** and what to avoid in **Undesired Content**.
3. Choose the model, size, Steps, Seed and other settings. Start with defaults if unsure.
4. **Save** stores the full workbench; **Save As** creates a separate named copy.
5. Load a saved preset and click **Generate**.

The **Preset** button beside Base Prompt loads a reusable prompt module. It replaces the current Prompt and Undesired values and displays the loaded preset's actual name in **Name**. Its scope differs from saving the full workbench.

### Character / Outfit / Position

Click **Add Character** to add a character field. Give each character its own Prompt and Undesired text, and use that character's **Preset** button to load saved text. Categories are independent of slot numbers.

Store outfits in the Character Prompt Preset categories **여성 의상 / 남성 의상** (female/male clothing). Both subcategory lists sort by their Korean names. **Manage Categories** adds categories and one level of subcategories.

With V5, choose **Custom** positioning to show the Position Pad. Drag each numbered marker to position that character. **AI’s Choice** lets the model decide. Nearby markers may overlap; exact placement in the generated image is not guaranteed.

### Wildcards: use a long candidate list

1. Click the top **Wildcards** button, then **New**.
2. Set Key to `tops` and Name to `Tops`.
3. Enter one candidate per line and click **Save**.

```text
white shirt
black shirt
blue shirt
red shirt
```

4. Click **Wildcard** beside a prompt field, choose the entry and click **Insert**. You can also type `__tops__` directly.

```text
1girl, solo, __tops__, __poses__, ||indoors|outdoors||
```

Create `poses` too for this example to work, with `standing`, `sitting` and `walking` on separate lines. Multiple Wildcards can be used in Base, Undesired and Character fields.

Each generation selects one candidate from the complete list with equal probability. If `blue shirt` is chosen, the selected text goes into the actual request, History and the result's NovelAI image metadata. The preset keeps `__tops__` for future selections. Consecutive repeats are normal.

- Blank lines and duplicate candidates are removed on save.
- Keys use lowercase English letters, numbers, `-` and `_`. Saved keys are fixed; names and candidates can be edited.
- **Import TXT / Export TXT** moves large lists. **Sample** previews one choice without fixing the next generation's selection.
- Candidates may contain existing `||A|B||` blocks, but cannot contain another Wildcard reference.
- Missing keys or empty lists produce a generation error. To use a preset on another PC, prepare Wildcard lists with the same keys there.
- Reusing History uses the text selected at that time. Load the original preset to select again.

### Generation modes and supported models

| Feature | NovelAI V4.5 Full | NovelAI V5 Full |
| --- | --- | --- |
| Text to Image | Supported | Supported |
| Image to Image | Supported | Supported |
| Inpaint | Supported | Supported |
| Character Prompt | Up to 6 | Up to 32 |
| Precise Reference | Supported | Not supported |
| V5 Position Pad | Not applicable | Supported |

**Text to Image** makes a new picture from text. **Image to Image** transforms a source picture using Strength and Noise. **Inpaint** redraws the area painted with Brush. Eraser, Undo, Redo and Clear Mask are available; an empty selection cannot be generated.

Use **Open Image**, paste or drag and drop PNG/WebP/JPEG files, then choose their destination. NovelAI settings from an image apply only when you explicitly import metadata. V4.5 **Precise Reference** uses reference images and influence controls for Character, Style or both.

### History

Click a generated picture to enlarge it and inspect its Prompt and settings. Use the navigation buttons or arrow keys to browse previous/next pictures. Save results or reuse them as presets. Selection mode can delete multiple records; confirming deletion permanently removes results and their owned related files.

### Open illustrated guides

Click the top **v3.4.0** button to open **App info & Manuals**. These PDFs open in separate app windows; you do not need to find their folders.

| Guide | 한국어 | English |
| --- | --- | --- |
| Whole app | [Korean app guide](manuals/app-ko.pdf) | [App guide](manuals/app-en.pdf) |
| Wildcard | [Korean Wildcard guide](manuals/wildcard-ko.pdf) | [Wildcard guide](manuals/wildcard-en.pdf) |

The same PDFs are available separately in the Release.

### Notes

Prompts and input images are used in generation requests sent to NovelAI. Result images may contain prompts, so inspect them before sharing. Never put tokens or personal information in prompts. History and presets are local data and need a separate backup when moving PCs.

The executable is unsigned, so Windows may show a trust warning. Check that it came from the official repository's Release. V5 Precise Reference, Vibe Transfer, ControlNet, V5 Curated and video generation are unsupported. The app uses the MIT license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party notices.

<a id="developer-ko"></a>
## 개발자용 — 한국어

### 프로젝트와 Electron 구조

v3.4.0은 v3.2.1의 프리셋 스키마와 V4.5/V5 어댑터를 유지합니다. Electron main process는 로컬 Node 서버를 실행하고, sandbox/contextIsolation을 사용하는 renderer에 작업대를 표시합니다. 서버는 `127.0.0.1`에만 바인딩합니다. renderer는 로컬 HTTP API를 사용하며 NovelAI 인증은 서버에서 처리합니다.

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
| `src/adapters/` | V4.5/V5 모델·모드별 NovelAI payload |
| `src/services/` | 프리셋/History/Wildcard 저장, 응답 해석, 생성 준비 |
| `src/ui/` | Position Pad, 이미지 입력, 마스크, 토큰 카운터, Wildcard dialog |
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

### Wildcard 구조

`wildcard-store.js`는 `data/wildcards/<id>/wildcard.json`에 key/name/entries를 저장하고 원자적 쓰기와 직렬화된 변경을 처리합니다. Key는 고정되며 후보는 trim·빈 줄 제거·중복 제거합니다. 중첩 Wildcard는 거부합니다.

`generation-prompt-resolver.js`는 기존 랜덤 블록을 먼저 처리한 뒤 참조마다 Node `crypto.randomInt`로 전체 후보 중 하나를 독립 선택합니다. 후보 안의 기존 랜덤 블록도 확정합니다. Base/Undesired/활성 Character에 적용하며 원본 편집 프리셋은 수정하지 않습니다.

`/api/novelai/prepare`의 ID는 최대 32개, 5분 만료, 단일 사용 cache에 확정 프리셋을 보관합니다. Generate는 그 복사본을 소비하므로 UI 확인과 전송 사이에 다시 뽑지 않습니다. 준비 ID 없는 API 요청도 서버에서 확정합니다. History 복사본에서는 비활성 모델 템플릿과 import 원본 스냅샷을 제거하고, 후보 목록이나 선택 mapping을 추가하지 않습니다.

`wildcard-controller.js`가 관리 dialog와 삽입을 담당하고 `/api/wildcards`가 CRUD를 제공합니다. 프리셋 공유 시 Wildcard 목록은 TXT로 별도 이동해야 합니다.

### NovelAI payload 처리

선택 모델은 `nai-diffusion-4-5-full`, `nai-diffusion-5-full`입니다. Inpaint는 각 모델의 `-inpainting` 변형과 `infill`을 사용합니다. V4.5 응답은 ZIP, V5는 multipart 요청과 길이 접두 MessagePack 응답 흐름을 사용합니다. 최종 PNG bytes를 유지하며 이미지 메타데이터를 임의로 재작성하지 않습니다.

어댑터가 Quality/UC 옵션과 캐릭터·위치·모드 설정을 매핑합니다. History 최종 prompt와 반환 PNG의 NovelAI prompt는 전송값 기준으로 검증합니다. V5 자동 quality tag도 포함해야 합니다. 큰 이미지 Base64와 인증정보는 저장 payload/sidecar에서 제외합니다.

### 빌드

```powershell
npm run electron:pack
npm run electron:dist
```

첫 명령은 `dist/win-unpacked/`, 두 번째는 `dist/Chaessi-Preset-v3.4.0-x64.exe`를 만듭니다. `package.json`의 파일 목록에 PDF 4개가 포함되며 `.env`, 사용자 데이터, logs, tmp, 테스트 산출물은 제외됩니다. 설치 프로그램·코드 서명·자동 업데이트는 없습니다.

### 테스트와 설명서 유지보수

```powershell
npm run test:wildcard
npm run test:regression
```

Wildcard 테스트는 8개이며 양 모델 × T2I/I2I/Inpaint의 6개 HTTP 경로를 mock NovelAI로 검증합니다. 회귀 suite는 기존 21개 스크립트입니다. 기본 테스트는 실제 NovelAI를 호출하지 않습니다. [VERIFICATION.md](VERIFICATION.md)에 범위와 실제 생성 검증 결과가 있습니다.

선택 UI 검증에는 별도로 설치한 Playwright가 필요합니다 (`npm install --no-save --package-lock=false playwright`). 기본 UI 스크립트는 설치된 Edge를 사용합니다. 외부 모듈 위치는 `CHAESSI_PLAYWRIGHT`로 지정할 수 있습니다.

```powershell
node scripts/verify-ui.mjs
node scripts/verify-electron-manuals.mjs
```

실제 생성 검증은 `NAI_ACCESS_TOKEN`을 제공했을 때만 수행되며 계정 사용량을 소비할 수 있습니다. 요청 capture는 인증 헤더 없이 body만 테스트 cache에 남깁니다. UI 스크립트는 설명서 화면 이미지를 갱신하므로 변경을 검토하세요.

PDF 재생성에는 Python, ReportLab, pypdf와 Windows Malgun Gothic 폰트가 필요합니다. `python scripts/build-manuals.py`로 제작하고, PDF 4개의 텍스트·페이지 수와 렌더된 모든 페이지를 확인하세요. Git은 `.gitattributes`의 PDF binary 규칙으로 bytes를 보존합니다.

### Release 기본 절차

버전과 공개 승인을 확인하고 README/CHANGELOG 및 package/lock/default/server 버전을 맞춥니다. 테스트, 화면 검증, PDF viewer, 빌드 포함 파일·개인 경로·비밀정보 검사를 완료하세요. 공개 저장소에는 공개 대상 파일만 반영하고 개인 개발 기록이나 런타임 데이터를 가져오지 않습니다.

새 공개 커밋에서 버전 tag를 생성하고 정식 빌드를 검증합니다. 새 GitHub Release에 portable EXE, 한국어/영어 앱·Wildcard PDF 4개와 Release Notes를 첨부합니다. 이전 tag와 Release를 수정하지 않습니다. MIT 및 tokenizer의 라이선스 고지를 유지하세요.

<a id="developer-en"></a>
## Developer Guide — English

### Project and Electron architecture

v3.4.0 preserves the v3.2.1 preset schema and V4.5/V5 adapters. Electron's main process starts a local Node server and displays the workbench in a renderer with sandbox/contextIsolation enabled. The server binds only to `127.0.0.1`. The renderer uses local HTTP APIs; NovelAI authentication happens on the server.

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
| `src/adapters/` | NovelAI payloads for V4.5/V5 models and modes |
| `src/services/` | Preset/History/Wildcard stores, response decoding and generation preparation |
| `src/ui/` | Position Pad, image intake, masks, token counters and Wildcard dialog |
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

### Wildcard architecture

`wildcard-store.js` stores key/name/entries in `data/wildcards/<id>/wildcard.json`, using atomic writes and serialized mutations. Keys remain fixed; entries are trimmed and blank/duplicate lines removed. Nested Wildcards are rejected.

`generation-prompt-resolver.js` first handles existing random blocks, then independently selects each reference from the complete candidate list with Node `crypto.randomInt`. Existing random blocks inside selected candidates are resolved too. It processes Base/Undesired/enabled Character fields without modifying the editing preset.

`/api/novelai/prepare` IDs hold resolved presets in a single-use cache with a five-minute lifetime and a maximum of 32 entries. Generate consumes that copy, avoiding a second draw between UI confirmation and transport. Requests without a preparation ID also resolve on the server. History copies omit inactive model templates and imported source snapshots; no candidate library or selection mapping is added.

`wildcard-controller.js` manages the dialog and insertion; `/api/wildcards` provides CRUD. Move candidate lists separately as TXT when sharing presets.

### NovelAI payload handling

Selectable models are `nai-diffusion-4-5-full` and `nai-diffusion-5-full`. Inpaint uses each model's `-inpainting` variant with `infill`. V4.5 responses use ZIP; V5 uses multipart requests and length-prefixed MessagePack responses. Final PNG bytes are preserved without rewriting image metadata.

Adapters map Quality/UC options, characters, positions and mode settings. History's final prompt and the returned PNG's NovelAI prompt are verified against transmitted text, including automatic V5 quality tags. Large image Base64 and authentication information are excluded from stored payloads/sidecars.

### Build

```powershell
npm run electron:pack
npm run electron:dist
```

The first command produces `dist/win-unpacked/`; the second creates `dist/Chaessi-Preset-v3.4.0-x64.exe`. The `package.json` file list includes all four PDFs and excludes `.env`, user data, logs, tmp and test artifacts. There is no installer, code signing or auto-update.

### Tests and manual maintenance

```powershell
npm run test:wildcard
npm run test:regression
```

The eight Wildcard tests include six HTTP paths covering both models × T2I/I2I/Inpaint with mocked NovelAI. The regression suite runs 21 existing scripts. Default tests do not contact real NovelAI. See [VERIFICATION.md](VERIFICATION.md) for coverage and live generation results.

Optional UI verification requires separately installed Playwright (`npm install --no-save --package-lock=false playwright`). The UI script uses installed Edge by default. Set `CHAESSI_PLAYWRIGHT` for an external module location.

```powershell
node scripts/verify-ui.mjs
node scripts/verify-electron-manuals.mjs
```

Live generation runs only when `NAI_ACCESS_TOKEN` is supplied and may consume account usage. Request capture stores bodies without authentication headers in the test cache. The UI script updates manual screenshots; review resulting changes.

To rebuild PDFs, use Python, ReportLab, pypdf and the Windows Malgun Gothic font. Run `python scripts/build-manuals.py`, then verify text/page counts and every rendered page of all four PDFs. The PDF binary rule in `.gitattributes` preserves their bytes in Git.

### Basic Release procedure

Confirm the version and publication approval, and align README/CHANGELOG with package/lock/default/server versions. Complete tests, UI checks, PDF viewer checks and a build-file audit for personal paths and secrets. Publish only intended source files; do not import private development history or runtime data.

Create the version tag from the new public commit and verify the formal build. Attach the portable EXE, four Korean/English app/Wildcard PDFs and Release Notes to a new GitHub Release. Do not modify earlier tags or Releases. Preserve MIT and tokenizer license notices.
