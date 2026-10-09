# Chaessi Preset v3.5.0

NovelAI를 위한 Windows 프롬프트·프리셋 작업대 / A Windows prompt and preset workbench for NovelAI / NovelAI のための Windows 用プロンプト・プリセット作業台。

**목차 / Contents / 目次**

- [사용자용 — 한국어](#user-ko)
- [User Guide — English](#user-en)
- [ユーザーガイド — 日本語](#user-ja)
- [개발자용 — 한국어](#developer-ko)
- [Developer Guide — English](#developer-en)
- [開発者ガイド — 日本語](#developer-ja)

<a id="user-ko"></a>
## 사용자용 — 한국어

### 어떤 앱인가요?

Chaessi Preset은 NovelAI로 그림을 만들 때 자주 쓰는 문장과 설정을 저장하고 다시 불러오는 앱입니다. 인물, 옷, 배경, 그림체를 프리셋으로 정리하고, 결과를 History에서 다시 볼 수 있습니다. 그림 생성에는 본인의 NovelAI 계정과 인터넷 연결이 필요합니다.

v3.5.0은 기존 기능과 데이터 형식을 유지하면서 작업대 UI, 한국어·영어·일본어 전환, 프리셋 정렬, 통합 도움말과 삭제 확인을 개선한 버전입니다. 새 작업은 V5를 우선하며 기존 V4.5 작업도 불러옵니다.

### 주요 기능

- 전체 프리셋과 Character Prompt Preset 저장·불러오기, 분류와 썸네일 관리
- Base Prompt, Undesired Content, 여러 Character Prompt와 생성 설정 편집
- V5 캐릭터 위치를 움직이는 Position Pad
- 글로 생성, 이미지 변형, 선택 영역 다시 그리기
- V4.5 Precise Reference와 PNG/WebP/JPEG 이미지 입력·메타데이터 가져오기
- 기존 `||A|B|C||` 랜덤 문법과 새 Wildcard 라이브러리
- 생성 결과 미리보기·저장, History 탐색·재사용·삭제
- 프롬프트와 결과를 나란히 보는 작업대, 영역 너비 조절과 작은 창에서의 화면 전환
- 선택하면 넓어지는 Base/Character 편집창과 긴 글을 위한 별도 확대 편집
- Character 접기·켜기·순서 조절과 번호 슬롯별 카테고리 기억
- 세 언어 UI와 이름순·역순, 생성일·수정일 기준 프리셋 정렬
- 한국어·영어·일본어 오프라인 도움말 센터: 목차·검색·글자 크기·실제 화면 확대·관련 기능 도움말

### 설치와 실행

1. [GitHub Releases](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.5.0)에서 v3.5.0의 `Chaessi-Preset-v3.5.0-x64.exe`를 받습니다.
2. 원하는 폴더에 놓고 실행합니다. Windows x64용 portable 앱이므로 별도 설치나 Node.js가 필요하지 않습니다.
3. 상단에서 **한국어 / English / 日本語**를 선택합니다. 다음 실행에서도 기억합니다.
4. **API 설정 (API Settings)**에서 본인의 NovelAI access token을 저장합니다.
5. 프롬프트와 설정을 확인한 뒤 **이미지 한 장 생성 (Generate one image)**을 누릅니다.

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

편집칸을 선택하면 넓어지고 확대 편집으로 긴 글을 편하게 고칠 수 있습니다. 생성 결과는 옆에서 계속 확인하며 아래 생성 바와 상세 설정으로 옵션을 조절합니다. 언어 변경·화면 이동·도움말 열기로 현재 프롬프트·설정·이미지 결과가 초기화되지 않습니다. 앱 종료 후 저장하지 않은 편집 내용의 자동 복원은 제공하지 않으므로 종료 전에 저장하세요.

### 프리셋 찾기와 정렬

전체 프리셋과 Character 프리셋에서 검색·카테고리·하위 카테고리 필터와 정렬을 함께 사용할 수 있습니다. **이름순 / 이름 역순 / 최근 수정 / 오래된 수정 / 최근 생성 / 오래된 생성**을 선택하며 선택을 기억합니다.

이름은 현재 UI 언어의 비교 규칙으로 정렬하고 숫자는 자연 순서로 비교합니다. 사용자 프리셋·카테고리 이름과 프롬프트는 번역하지 않습니다. 일본어 한자의 읽는 법을 추측해 이름을 바꾸지 않으며, 날짜가 없는 과거 항목은 가장 오래된 값으로 취급합니다.

### Character / Outfit / Position

**Add Character**로 인물 입력칸을 추가하세요. 각 인물의 Prompt와 Undesired를 따로 쓰고, 그 인물 옆 **Preset**에서 저장한 문장을 불러옵니다. 접기·펼치기, 켜기·끄기, 위·아래 이동으로 정리할 수 있습니다.

각 **번호 슬롯**은 마지막으로 선택한 카테고리와 하위 카테고리를 기억합니다. 재시작, 전체 프리셋 불러오기, History 적용 후에도 번호별 선택을 유지하며 직접 다른 카테고리를 고르면 새 선택을 기억합니다. 캐릭터 이름에 따라 이동하는 설정은 아닙니다.

의상은 Character Prompt Preset의 **여성 의상 / 남성 의상** 분류에 저장해 찾아 쓰세요. 두 의상 분류의 하위 목록은 한글 이름 기준 가나다순입니다. **Manage Categories**에서는 분류와 한 단계 하위 분류를 추가할 수 있습니다.

V5에서 **Custom** 위치를 고르면 Position Pad가 나타납니다. 번호가 붙은 점을 끌어서 해당 인물이 자리할 위치를 정하세요. **AI’s Choice**는 위치를 모델에 맡깁니다. 여러 점을 같은 곳에 두면 겹칠 수 있으며, 지정 위치가 결과에 정확히 반영되는 것은 보장되지 않습니다.

### Wildcard: 긴 후보 목록을 쉽게 쓰기

1. 왼쪽 **와일드카드 (Wildcards)**에서 새 항목을 만듭니다.
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

새 작업은 V5를 우선합니다. 기존 V4.5 프리셋·History는 해당 모델과 설정을 복원합니다. 모델별로 지원하지 않는 옵션은 비활성화하며 기존 값은 보존합니다.

**Text to Image**는 글로 새 그림을 만듭니다. **Image to Image**는 원본 그림을 바꾸며 Strength와 Noise로 변화를 조절합니다. **Inpaint**는 Brush로 칠한 부분을 다시 그립니다. Eraser, Undo, Redo, Clear Mask를 사용할 수 있으며 빈 선택 영역으로는 생성할 수 없습니다.

**Open Image**, 붙여넣기, 드래그 앤 드롭으로 PNG/WebP/JPEG를 넣고 사용할 곳을 선택하세요. 이미지의 NovelAI 설정은 메타데이터 가져오기를 직접 선택했을 때만 적용됩니다. V4.5 **Precise Reference**는 Character, Style 또는 둘 모두를 참고하도록 이미지와 강도를 설정합니다.

### History

검색·모델/생성 방식 필터·썸네일 크기로 결과를 찾고 그림을 클릭하면 확대해 당시 Prompt와 설정을 확인합니다. 좌우 버튼이나 방향키로 이전·다음 그림을 보세요. 결과를 저장하거나 작업대로 재사용할 수 있습니다.

삭제 버튼은 저장·불러오기와 떨어져 있으며 확인창에서 대상과 영향을 확인하고 취소하거나 실행합니다. History 선택 모드의 일괄 삭제도 유지됩니다. 확인 후 삭제하면 해당 결과와 소유한 관련 파일은 영구 삭제됩니다.

### 앱 안에서 도움말 읽기

왼쪽 **도움말 센터** 또는 상단 **v3.5.0 → 앱 정보 및 도움말 → 도움말 센터 열기**를 누릅니다. 한국어·영어·일본어 통합 설명서에 Wildcard 사용법까지 포함되어 있습니다.

목차·검색·이전/다음·글자 크기·실제 앱 스크린샷 확대를 사용하세요. 기능 옆 **? 도움말**은 해당 설명으로 바로 이동합니다. 닫으면 같은 작업을 이어갑니다. 도움말은 인터넷 없이 작동하며 PDF를 따로 받을 필요가 없습니다. 기존 한국어·영어 PDF 4개는 앱 정보의 **이전 PDF 설명서 (v3.4.0)**에 보존했습니다. 일본어 설명서는 도움말 센터로 제공합니다.

### 커피 한 잔으로 개발 후원

CHAESSI PRESET은 무료로 제공됩니다. 프로그램이 도움이 되었다면 개발자 **DooMokDdongGae**에게 [Buy Me a Coffee](https://buymeacoffee.com/magiconcert)로 **커피 한 잔당 USD $3의 일회성 후원**을 할 수 있습니다. 앱 정보에도 후원 버튼이 있습니다.

후원은 선택사항이며 후원 없이도 모든 기능을 사용할 수 있습니다. 링크는 외부 브라우저에서 열립니다. 후원 페이지에서 금액을 확인하고 일회성 후원을 선택해 주세요. 후원과 NovelAI 이용료는 별개입니다.

### 주의사항

프롬프트와 입력 이미지는 생성 요청에 사용되어 NovelAI로 전송됩니다. 결과 이미지에 프롬프트가 포함될 수 있으니 공유 전에 확인하세요. 토큰과 개인정보를 프롬프트에 쓰지 마세요. History와 프리셋은 로컬 데이터이므로 PC를 바꿀 때 따로 백업해야 합니다.

이 앱은 서명되지 않은 실행 파일이라 Windows가 신뢰 경고를 표시할 수 있습니다. 공식 저장소의 Release 파일인지 확인하세요. V5 Precise Reference, Vibe Transfer, ControlNet, V5 Curated, 영상 생성은 지원하지 않습니다. MIT 라이선스이며 타사 구성요소 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.

<a id="user-en"></a>
## User Guide — English

### What is Chaessi Preset?

Chaessi Preset saves and reuses prompts and settings for making pictures with NovelAI. Organize people, outfits, backgrounds and styles as presets, and revisit results in History. Generation requires your own NovelAI account and an internet connection.

v3.5.0 preserves existing features and data formats while improving the workbench UI, Korean/English/Japanese switching, preset sorting, integrated help and deletion confirmation. Fresh work starts with V5; existing V4.5 work can still be loaded.

### Main features

- Full and Character Prompt Preset saving/loading, categories and thumbnails
- Base Prompt, Undesired Content, multiple Character Prompts and generation settings
- V5 Position Pad for moving characters
- Text generation, image transformation and repainting selected areas
- V4.5 Precise Reference and PNG/WebP/JPEG intake with optional metadata import
- Existing `||A|B|C||` random syntax and a new Wildcard library
- Result preview/save and History browsing, reuse and deletion
- Prompts and results side by side, adjustable panel width and view switching in smaller windows
- Base/Character fields that expand when selected and a separate large editor for long text
- Character folding, enable/disable, reordering and category memory per numbered slot
- Three UI languages and name/reverse-name, creation/modification date sorting
- Offline Korean/English/Japanese Help Center with contents, search, text size, actual screenshot zoom and contextual help

### Download and run

1. Download `Chaessi-Preset-v3.5.0-x64.exe` from v3.5.0 in [GitHub Releases](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.5.0).
2. Put it in a folder and run it. This is a portable Windows x64 app; no installer or Node.js is required.
3. Choose **한국어 / English / 日本語** at the top. Your choice is remembered on the next launch.
4. Save your own NovelAI access token in **API Settings**.
5. Check your prompt and settings, then click **Generate one image**.

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

Selecting a field expands it; use the large editor for long text. Keep viewing results beside your editing area, and adjust options in the bottom generation bar or More settings. Language changes, navigation and help keep your current prompts, settings and result. Unsaved edits are not automatically restored after closing the app, so save before quitting.

### Find and sort presets

Combine search, category/subcategory filters and sorting in the full preset library and Character picker. Choose **Name A–Z / Name Z–A / Recently modified / Oldest modified / Recently created / Oldest created**. Your choice is remembered.

Name sorting follows the selected UI language's comparison rules with natural numeric ordering. User preset/category names and prompts are not translated. Japanese kanji readings are not inferred to rewrite names; missing dates in older entries are treated as the oldest values.

### Character / Outfit / Position

Click **Add Character**, give each character its own Prompt and Undesired text, and use its **Preset** button to load saved text. Fold/Expand, On/Off and Up/Down help organize characters.

Each **numbered slot** remembers its last category and subcategory, including after restarting, loading a full preset or applying History. Choosing a different category updates that slot's memory. This preference follows the slot number rather than a character's name.

Store outfits in the Character Prompt Preset categories **여성 의상 / 남성 의상** (female/male clothing). Both subcategory lists sort by their Korean names. **Manage Categories** adds categories and one level of subcategories.

With V5, choose **Custom** positioning to show the Position Pad. Drag each numbered marker to position that character. **AI’s Choice** lets the model decide. Nearby markers may overlap; exact placement in the generated image is not guaranteed.

### Wildcards: use a long candidate list

1. Open **Wildcards** on the left and create an entry.
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

Fresh work starts with V5. Existing V4.5 presets and History restore that model and its settings. Unsupported options are disabled while their existing values are preserved.

**Text to Image** makes a new picture from text. **Image to Image** transforms a source picture using Strength and Noise. **Inpaint** redraws the area painted with Brush. Eraser, Undo, Redo and Clear Mask are available; an empty selection cannot be generated.

Use **Open Image**, paste or drag and drop PNG/WebP/JPEG files, then choose their destination. NovelAI settings from an image apply only when you explicitly import metadata. V4.5 **Precise Reference** uses reference images and influence controls for Character, Style or both.

### History

Find results with search, model/mode filters and thumbnail sizes. Click a picture to enlarge it and inspect its Prompt and settings. Use navigation buttons or arrow keys to browse, save results or reuse them in the workbench.

Delete controls are separated from Save/Load. Read the target and impact in the confirmation dialog, then cancel or delete. History selection mode still supports bulk deletion. Confirming permanently removes results and their owned related files.

### Read help inside the app

Open **Help Center** on the left, or **v3.5.0 → App info & Help → Open Help Center** at the top. The integrated Korean/English/Japanese guide covers Wildcards along with the whole app.

Use contents, search, previous/next, text size and zoomable actual screenshots. **? Help** beside a feature jumps to its topic. Close help to continue the same task. Help works offline; no separate PDF is needed. Four existing Korean/English PDFs remain under **Previous PDF guides (v3.4.0)** in App Info. Japanese documentation is provided through the Help Center.

### Support development with a coffee

CHAESSI PRESET is free to use. If it helps you, you can support developer **DooMokDdongGae** with **a one-time donation of USD $3 per coffee** through [Buy Me a Coffee](https://buymeacoffee.com/magiconcert). App Info also has the support button.

Support is optional. All features are available without donating. The link opens in your external browser; check the amount and choose one-time support on that page. Donations and NovelAI usage charges are separate.

### Notes

Prompts and input images are used in generation requests sent to NovelAI. Result images may contain prompts, so inspect them before sharing. Never put tokens or personal information in prompts. History and presets are local data and need a separate backup when moving PCs.

The executable is unsigned, so Windows may show a trust warning. Check that it came from the official repository's Release. V5 Precise Reference, Vibe Transfer, ControlNet, V5 Curated and video generation are unsupported. The app uses the MIT license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party notices.

<a id="user-ja"></a>
## ユーザーガイド — 日本語

### どんなアプリですか？

Chaessi Preset は、NovelAI で画像を生成するときのプロンプトと設定を保存し、再利用するアプリです。キャラクター、衣装、背景、画風をプリセットにまとめ、結果を見ながら文章を編集できます。生成にはご自身の NovelAI アカウントとインターネット接続が必要です。

v3.5.0 は既存の機能とデータ形式を維持しながら、作業台 UI、韓国語・英語・日本語の切り替え、プリセットの並び替え、統合ヘルプ、削除確認を改善しました。新しい作業では V5 を優先し、既存の V4.5 の作業も読み込めます。

### 主な機能

- 全体・Character Prompt Preset の保存と読み込み、カテゴリ・サムネイル管理
- Base Prompt、Undesired Content、複数の Character Prompt、生成設定の編集
- V5 Position Pad によるキャラクターの配置
- テキスト生成、画像変換、選択した領域の描き直し
- V4.5 Precise Reference、PNG/WebP/JPEG の取り込みと任意のメタデータ読み込み
- 従来の `||A|B|C||` とワイルドカードの候補ライブラリ
- 結果のプレビュー・保存、履歴の検索・再利用・削除
- プロンプトと結果の横並び表示、領域幅の調整、小さいウィンドウでの表示切り替え
- 選択すると広がる Base/Character の入力欄と長文用の拡大エディター
- キャラクターの折りたたみ、有効・無効、順序変更、番号ごとのカテゴリ記憶
- 3言語の UI と名前順・逆順、作成日・更新日による並び替え
- 3言語のオフラインヘルプ：目次・検索・文字サイズ・実際の画面の拡大・関連機能からの移動

### ダウンロードと起動

1. [GitHub Releases](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.5.0) の v3.5.0 から `Chaessi-Preset-v3.5.0-x64.exe` をダウンロードします。
2. 好きなフォルダーに置いて起動します。Windows x64 用のポータブルアプリなので、インストールや Node.js は不要です。
3. 上部で **한국어 / English / 日本語** を選びます。次回の起動でも記憶します。
4. **API 設定 (API Settings)** でご自身の NovelAI アクセストークンを保存します。
5. プロンプトと設定を確認し、画像生成ボタンを押します。

プリセットと履歴は EXE とは別に保存されます。EXE を新しいバージョンに置き換えても保存済みデータは維持されますが、大切なデータは先にバックアップしてください。自動更新やインストーラーはありません。

### NovelAI の準備

アカウントで画像生成が可能か、利用枠や残高が十分かを確認します。**API Settings** にトークンを保存すると、保存した値は再表示しません。**Clear Saved Token** で削除できます。トークンを他人に渡したり、画面上で公開したりしないでください。

トークンは、この PC の暗号化されたアプリ保存領域に保管されます。認証エラーの場合はアカウントとトークンを確認してください。生成費用は NovelAI のアカウント・モデル・設定によって変わります。

### プリセットの基本

1. **Name** に分かりやすい名前を入力します。
2. **Base Prompt** に描きたい内容、**Undesired Content** に避けたい内容を書きます。
3. モデル、サイズ、Steps、Seed などを選びます。迷ったら既定値から始めてください。
4. **Save** で全体の作業を保存し、別のコピーには **Save As** を使います。
5. プリセットを読み込み、画像を生成します。

Base Prompt の隣の **Preset** は再利用する文章を読み込みます。現在の Prompt と Undesired を選んだ内容に置き換え、実際のプリセット名を **Name** に表示します。全体の作業を保存する機能とは対象範囲が異なります。

選択すると入力欄が広がり、長文は拡大エディターで編集できます。横で結果を見ながら、下部の生成バーと詳細設定で調整してください。言語変更、画面移動、ヘルプでも編集中のプロンプト・設定・結果を維持します。終了後に未保存の編集を自動復元する機能はないため、終了前に保存してください。

### プリセットの検索と並び替え

全体プリセットと Character の選択画面で、検索、カテゴリ・サブカテゴリの絞り込み、並び替えを組み合わせられます。**名前順 / 名前逆順 / 更新が新しい順 / 更新が古い順 / 作成が新しい順 / 作成が古い順**を選び、選択を記憶します。

名前順は選んだ UI 言語の比較規則を使い、数字も自然な順序で比較します。ユーザーのプリセット名・カテゴリ名・プロンプトは翻訳しません。漢字の読みを推測して名前を変えることはなく、日付のない古い項目は最も古い値として扱います。

### Character / Outfit / Position

**Add Character** で入力欄を作り、それぞれの Prompt と Undesired を書きます。そのキャラクターの **Preset** で保存した文章を読み込めます。折りたたみ・展開、オン・オフ、上・下で整理できます。

各**番号スロット**は最後に選んだカテゴリとサブカテゴリを記憶します。再起動、全体プリセットの読み込み、履歴の適用後も番号ごとに維持します。別のカテゴリを選ぶと更新します。キャラクターの名前に付いて移動する設定ではありません。

衣装は女性・男性衣装のカテゴリ（韓国語表示では **여성 의상 / 남성 의상**）から探せます。この2種類のサブカテゴリは韓国語名の順序を維持します。**Manage Categories** ではカテゴリと1段階のサブカテゴリを追加できます。

V5 で **Custom** の配置を選ぶと Position Pad が表示されます。番号付きの点をドラッグして位置を指定してください。**AI's Choice** ではモデルが決めます。近い点は重なる場合があり、正確な位置反映は保証されません。

### ワイルドカード：1行に1つの候補

1. 左の **Wildcards** で新しい項目を作ります。
2. 名前を `上着`、キーを `tops` にします。
3. 候補を1行に1つずつ入力して **Save** します。

```text
white shirt
black shirt
blue shirt
red shirt
```

4. プロンプト横の **Wildcard** から選んで挿入するか、直接 `__tops__` と書きます。

```text
1girl, solo, __tops__, __poses__, ||indoors|outdoors||
```

この例では `poses` も作り、`standing`、`sitting`、`walking` をそれぞれ別の行に保存してください。Base、Undesired、Character で複数のキーを使えます。

生成ごとに候補全体から1つを同じ確率で選びます。`blue shirt` が選ばれれば、実際のリクエスト、履歴、結果画像の NovelAI メタデータにはその文章が入ります。プリセットには `__tops__` が残り、次の生成で再抽選します。同じ候補が連続する場合もあります。

- 保存時に空行と重複行を除きます。
- キーは英小文字・数字・`-`・`_` を使います。保存後のキーは固定ですが、名前と候補は編集できます。
- **Import TXT / Export TXT** で長いリストを移せます。**Sample** は試しに選ぶ機能で、次回の生成候補を固定しません。
- 候補に `||A|B||` は使えますが、別のワイルドカードは参照できません。
- キーが存在しない場合やリストが空の場合は生成エラーになります。別の PC では同じキーの候補リストも用意してください。
- 履歴の再利用はそのとき選ばれた文章を使います。再抽選には元のプリセットを読み込んでください。

### 生成方式と対応モデル

| 機能 | NovelAI V4.5 Full | NovelAI V5 Full |
| --- | --- | --- |
| Text to Image | 対応 | 対応 |
| Image to Image | 対応 | 対応 |
| Inpaint | 対応 | 対応 |
| Character Prompt | 最大6個 | 最大32個 |
| Precise Reference | 対応 | 非対応 |
| V5 Position Pad | 対象外 | 対応 |

新しい作業では V5 を優先します。既存の V4.5 プリセットや履歴を読み込むと、モデルと設定を復元します。非対応のオプションは無効になりますが、既存の値は保持します。

**Text to Image** は文章から新しい画像を生成します。**Image to Image** は元画像を変更し、Strength と Noise で変化を調整します。**Inpaint** は Brush で塗った部分を描き直します。Eraser、Undo、Redo、Clear Mask を使えます。空のマスクでは生成できません。

**Open Image**、貼り付け、ドラッグ＆ドロップで PNG/WebP/JPEG を取り込み、使用先を選んでください。画像内の設定はメタデータ読み込みを明示的に選んだときだけ適用します。V4.5 **Precise Reference** は画像と強さを指定し、Character、Style、または両方を参考にします。

### 履歴と削除

検索、モデル/生成方式の絞り込み、サムネイルサイズで結果を探します。画像を押すと拡大し、そのときの Prompt と設定を確認できます。移動ボタンや矢印キーで前後を見て、保存や作業台での再利用ができます。

削除ボタンは保存・読み込みから離して配置しています。確認画面で対象と影響を読み、キャンセルまたは削除します。履歴の選択モードによる一括削除も使えます。確定すると結果とそれに属する関連ファイルを完全に削除します。

### アプリ内のヘルプを読む

左の**ヘルプセンター**、または上部の **v3.5.0 → アプリ情報とヘルプ → ヘルプセンターを開く**を押します。韓国語・英語・日本語の統合ガイドにワイルドカードの使い方も含まれます。

目次、検索、前後の移動、文字サイズ、実際の画面の拡大を使えます。機能横の **? ヘルプ**は対応する説明へ移動します。閉じると同じ作業を続けられます。オフラインで動き、PDF の別途ダウンロードは不要です。既存の韓国語・英語 PDF 4個はアプリ情報の **以前の PDF ガイド (v3.4.0)** に残しています。日本語の説明書はヘルプセンターで提供します。

### コーヒー1杯で開発を応援

CHAESSI PRESET は無料で利用できます。役に立ったら、開発者 **DooMokDdongGae** を [Buy Me a Coffee](https://buymeacoffee.com/magiconcert) で**コーヒー1杯あたり USD $3 の単発の支援**で応援できます。アプリ情報にも支援ボタンがあります。

支援は任意です。支援しなくてもすべての機能を利用できます。リンクは外部ブラウザーで開きます。支援ページで金額を確認し、単発の支援を選んでください。支援と NovelAI の利用料金は別です。

### 注意事項

プロンプトと入力画像は生成リクエストで NovelAI に送信されます。結果画像にプロンプトが含まれる場合があるため共有前に確認してください。プロンプトにトークンや個人情報を書かないでください。PC を変えるときはローカルのプリセット・ワイルドカード・履歴を別途バックアップしてください。

実行ファイルは未署名のため Windows の警告が表示される場合があります。公式リポジトリの Release から取得したか確認してください。V5 Precise Reference、Vibe Transfer、ControlNet、V5 Curated、動画生成には対応していません。MIT ライセンスで、第三者の告知は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にあります。

<a id="developer-ko"></a>
## 개발자용 — 한국어

### 프로젝트와 Electron 구조

v3.5.0은 기존 v3.4.2 프리셋·History 데이터와 V4.5/V5 어댑터를 유지하며 작업대와 도움말을 확장합니다. Electron main process는 로컬 Node 서버를 실행하고 sandbox/contextIsolation을 사용하는 renderer에 UI를 표시합니다. 서버는 `127.0.0.1`에만 바인딩합니다. renderer는 로컬 HTTP API를 사용하며 NovelAI 인증은 서버에서 처리합니다.

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

첫 명령은 `dist/win-unpacked/`, 두 번째는 `dist/Chaessi-Preset-v3.5.0-x64.exe`를 만듭니다. 파일 목록은 세 언어 도움말·화면, 기존 PDF 4개, MIT/타사 라이선스를 포함하며 `.env`, 사용자 데이터, logs, tmp, 테스트 산출물은 제외합니다. 설치 프로그램·코드 서명·자동 업데이트는 없습니다.

### 테스트와 설명서 유지보수

```powershell
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

Wildcard 테스트는 8개이며 양 모델 × T2I/I2I/Inpaint의 6개 HTTP 경로를 mock NovelAI로 검증합니다. 회귀 suite는 기존 21개 스크립트입니다. Electron 검증은 언어·작업 상태·정렬·도움말·삭제·카테고리 기억·작업대를 확인합니다. 기본 검증은 실제 NovelAI를 호출하지 않습니다. mock과 실서비스 검증을 구분해 보고하세요. 기존 생성 검증 범위는 [VERIFICATION.md](VERIFICATION.md)를 참고하세요.

선택 UI 검증에는 별도로 설치한 Playwright가 필요합니다 (`npm install --no-save --package-lock=false playwright`). 기본 UI 스크립트는 설치된 Edge를 사용합니다. 외부 모듈 위치는 `CHAESSI_PLAYWRIGHT`로 지정할 수 있습니다.

```powershell
node scripts/verify-ui.mjs
node scripts/verify-electron-manuals.mjs
```

실제 생성 검증은 `NAI_ACCESS_TOKEN`을 제공했을 때만 수행되며 계정 사용량을 소비할 수 있습니다. 요청 capture는 인증 헤더 없이 body만 테스트 cache에 남깁니다. UI 스크립트는 설명서 화면 이미지를 갱신하므로 변경을 검토하세요.

Electron UI 검사는 `.cache`의 격리된 데이터로 실행합니다. `CHAESSI_ELECTRON`으로 실행 파일을 지정하고 배포 smoke에는 `CHAESSI_PACKAGED=1`을 사용할 수 있습니다. 배포 smoke는 버전·후원 링크·도움말 접근만 확인하며 실제 결제 페이지를 열지 않습니다. 기존 PDF는 보존 자료이며 새 통합 도움말은 PDF를 재생성할 필요가 없습니다.

### 언어·정렬·도움말과 후원 링크 유지보수

영어 source key에 한국어·일본어 번역을 대응시킵니다. `i18n.js`는 컨트롤을 교체하지 않고 표시만 갱신하며 선택 언어를 localStorage에 기억합니다. 프롬프트·사용자 이름·저장 카테고리 키·모델 식별자는 번역하지 않습니다.

`preset-sorting.js`는 `Intl.Collator`와 날짜 필드로 검색/필터 후, 페이지 분할 전에 정렬합니다. 6개 선택을 기억하며 없는 날짜는 오래된 값으로 처리합니다. Character 필터는 번호 슬롯별 localStorage 설정입니다.

도움말은 앱 내부 DOM으로 표시하며 `manual-content.js`의 같은 11개 주제를 세 언어로 관리합니다. `assets/manuals`의 실제 화면을 사용하고 인터넷에 의존하지 않습니다. 내용 수정 시 목차·검색·확대·관련 도움말 이동과 번역 수준을 확인하세요.

앱 정보 후원 문구도 세 언어로 유지합니다. main process는 지정된 HTTPS 후원 주소만 `shell.openExternal`로 엽니다. 임의 사용자 URL을 외부 실행하도록 확대하지 마세요. 앱은 결제나 후원 페이지의 가격·반복 결제 설정을 처리하지 않습니다.

### Release 기본 절차

PRIVATE에서 구현·기능·회귀 검증을 완료한 뒤 공개 승인을 받습니다. package/lock/default/server/README 버전을 맞추고 비밀정보·개인 PC 경로·런타임 데이터·PRIVATE 배포 기록을 공개 대상에서 제외합니다.

승인된 결과물을 PUBLIC에 반영하고 새 공개 커밋에 `v3.5.0` tag를 만듭니다. 완료된 동일 기능·회귀 테스트를 반복하지 않고 빌드·포함 파일·업로드 등 배포 자체만 확인합니다. 새 Draft Release에 portable EXE와 Release Notes를 준비하고 업로드 완료 후 Publish합니다. 세 언어 도움말은 앱에 포함되며 별도 일본어 PDF는 필요하지 않습니다. 이전 PDF를 별도 첨부할 때는 v3.4.0 자료임을 명시합니다.

이전 tag와 Release를 수정·삭제하지 않습니다. 라이선스 고지와 EXE의 크기·SHA-256을 유지하세요. 공개 승인이 없으면 PRIVATE 커밋·push에서 멈춥니다.

<a id="developer-en"></a>
## Developer Guide — English

### Project and Electron architecture

v3.5.0 extends the workbench and help while preserving existing v3.4.2 preset/History data and V4.5/V5 adapters. Electron's main process starts a local Node server and displays the UI in a renderer with sandbox/contextIsolation enabled. The server binds only to `127.0.0.1`. The renderer uses local HTTP APIs; NovelAI authentication happens on the server.

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

The first command produces `dist/win-unpacked/`; the second creates `dist/Chaessi-Preset-v3.5.0-x64.exe`. The file list includes three-language help/screenshots, four previous PDFs and MIT/third-party licenses, and excludes `.env`, user data, logs, tmp and test artifacts. There is no installer, code signing or auto-update.

### Tests and manual maintenance

```powershell
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

The eight Wildcard tests include six HTTP paths covering both models × T2I/I2I/Inpaint with mocked NovelAI. The regression suite runs 21 existing scripts. Electron verification checks languages, work state, sorting, help, deletion, category memory and the workbench. Default verification does not contact real NovelAI. Report mocked and live results separately; see [VERIFICATION.md](VERIFICATION.md) for earlier generation coverage.

Optional UI verification requires separately installed Playwright (`npm install --no-save --package-lock=false playwright`). The UI script uses installed Edge by default. Set `CHAESSI_PLAYWRIGHT` for an external module location.

```powershell
node scripts/verify-ui.mjs
node scripts/verify-electron-manuals.mjs
```

Live generation runs only when `NAI_ACCESS_TOKEN` is supplied and may consume account usage. Request capture stores bodies without authentication headers in the test cache. The UI script updates manual screenshots; review resulting changes.

Electron UI checks use isolated data under `.cache`. Set `CHAESSI_ELECTRON` for an executable and `CHAESSI_PACKAGED=1` for distribution smoke. The smoke check covers version, support link and help access without opening the real payment page. Previous PDFs are archives; the integrated guide does not require regenerating PDFs.

### Language, sorting, help and support link maintenance

Map English source keys to Korean/Japanese translations. `i18n.js` updates presentation without replacing controls and remembers the language in localStorage. Do not translate prompts, user names, stored category keys or model identifiers.

`preset-sorting.js` uses `Intl.Collator` and dates after search/filtering and before pagination. It remembers six choices and treats missing dates as old values. Character filters are numbered-slot localStorage preferences.

Help uses in-app DOM with the same 11 topics in three languages in `manual-content.js`. It uses actual screenshots from `assets/manuals` without an internet dependency. When editing, check contents, search, zoom, contextual navigation and equivalent translation coverage.

Keep App Info support text in all three languages. The main process opens only the specified HTTPS support address with `shell.openExternal`. Do not extend it to arbitrary user-URL execution. The app does not handle payments or support-page pricing/recurring-payment settings.

### Basic Release procedure

Complete implementation and functional/regression verification in PRIVATE, then obtain publication approval. Align package/lock/default/server/README versions. Exclude secrets, personal PC paths, runtime data and PRIVATE distribution records from publication.

Apply the approved result to PUBLIC and tag its new public commit `v3.5.0`. Do not repeat identical completed functional/regression tests; check the build, included files and uploads as distribution work. Prepare the portable EXE and Release Notes in a new Draft Release, then Publish after all uploads finish. Three-language help ships in the app; a separate Japanese PDF is unnecessary. Identify any separately attached previous PDFs as v3.4.0 material.

Do not modify/delete earlier tags or Releases. Preserve license notices and EXE size/SHA-256. Without publication approval, stop at PRIVATE commit/push.

<a id="developer-ja"></a>
## 開発者ガイド — 日本語

### プロジェクトと Electron 構成

v3.5.0 は既存の v3.4.2 のプリセット・履歴データと V4.5/V5 アダプターを維持しながら、作業台とヘルプを拡張します。Electron の main process はローカル Node サーバーを起動し、sandbox/contextIsolation を有効にした renderer に UI を表示します。サーバーは `127.0.0.1` にのみバインドします。renderer はローカル HTTP API を使い、NovelAI 認証はサーバーで処理します。

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
| `src/adapters/` | V4.5/V5 のモデル・生成方式別 NovelAI payload |
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

`generation-prompt-resolver.js` は従来のランダムブロックを処理してから、各参照で Node `crypto.randomInt` を使って候補全体から独立に選びます。候補内のランダムブロックも確定します。Base/Undesired/有効な Character を処理し、編集中の元プリセットは変更しません。

`/api/novelai/prepare` の ID は最大32件、5分で失効、1回のみ使用する cache に確定プリセットを保存します。Generate は同じコピーを使い、確認から送信までの再抽選を防ぎます。ID のないリクエストもサーバーで確定します。履歴では非アクティブなモデルテンプレートと読み込み元のスナップショットを除き、候補ライブラリや選択 mapping は追加しません。

`wildcard-controller.js` は管理と挿入を担当し、`/api/wildcards` が CRUD を提供します。プリセットを共有する場合、候補リストは TXT として別途移します。

### NovelAI payload の処理

選択モデルは `nai-diffusion-4-5-full` と `nai-diffusion-5-full` です。Inpaint はそれぞれの `-inpainting` モデルと `infill` を使います。V4.5 は ZIP 応答、V5 は multipart リクエストと長さ付き MessagePack 応答を処理します。最終 PNG bytes はメタデータを書き直さず保持します。

アダプターが Quality/UC、キャラクター、位置、生成方式の設定を対応させます。履歴と PNG の最終 prompt は、V5 の自動 quality tag も含めた送信値を基準に確認します。大きな画像 Base64 と認証情報は、保存 payload/sidecar から除きます。

### ビルド

```powershell
npm run electron:pack
npm run electron:dist
```

それぞれ `dist/win-unpacked/` と `dist/Chaessi-Preset-v3.5.0-x64.exe` を作成します。ファイル一覧は3言語のヘルプと画面、従来の PDF 4個、MIT/第三者ライセンスを含み、`.env`・ユーザーデータ・ログ・tmp・テスト結果を除きます。インストーラー・コード署名・自動更新はありません。

### テストと資料の保守

```powershell
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

ワイルドカード検証は8件で、両モデル × T2I/I2I/Inpaint の6つの HTTP 経路を mock NovelAI で検証します。回帰 suite は既存の21スクリプトです。Electron 検証は言語、作業状態、並び替え、ヘルプ、削除、カテゴリ記憶、作業台を確認します。通常の検証は実際の NovelAI を呼び出しません。mock と実サービスを分けて報告してください。従来の生成検証範囲は [VERIFICATION.md](VERIFICATION.md) を参照してください。

UI 検証には Playwright を別途用意します（`npm install --no-save --package-lock=false playwright`）。従来の UI スクリプトは既定で Edge を使います。外部モジュールは `CHAESSI_PLAYWRIGHT` で指定できます。

```powershell
node scripts/verify-ui.mjs
node scripts/verify-electron-manuals.mjs
```

実際の生成検証は `NAI_ACCESS_TOKEN` を提供したときに実行され、利用枠を消費する場合があります。別途承認を得てください。リクエスト capture は認証ヘッダーを除いた body を cache に保存します。画面画像を更新する UI スクリプトの変更も確認してください。

Electron UI 検証は `.cache` の隔離データで実行します。`CHAESSI_ELECTRON` で実行ファイルを指定し、配布 smoke は `CHAESSI_PACKAGED=1` でパッケージを確認できます。smoke はバージョン、支援リンク、ヘルプへの移動だけを確認し、実際の決済ページは開きません。従来の PDF は保存資料で、統合ヘルプのための PDF 再制作は不要です。

### 言語・並び替え・ヘルプ・支援リンクの保守

英語 source key に韓国語・日本語の翻訳を対応させます。`i18n.js` はコントロールを置き換えず表示を更新し、言語を localStorage に記憶します。プロンプト、ユーザー名、保存カテゴリキー、モデル識別子を翻訳しないでください。

`preset-sorting.js` は検索・絞り込み後、ページ分割前に `Intl.Collator` と日付を使って並べます。6種類の選択を記憶し、日付のない項目は古い値として扱います。Character のフィルターは番号スロット別の localStorage 設定です。

ヘルプはアプリ内 DOM で表示し、`manual-content.js` の同じ11テーマを3言語で管理します。`assets/manuals` の実際の画面を使い、インターネットに依存しません。更新時は目次・検索・拡大・関連ヘルプへの移動と翻訳内容の同等性を確認してください。

アプリ情報の支援文も3言語で維持します。main process は指定した HTTPS 支援 URL だけを `shell.openExternal` で開きます。任意のユーザー URL を外部実行する機能に広げないでください。アプリは決済や支援サイトの価格・定期支援設定を処理しません。

### Release の基本手順

PRIVATE で実装と機能・回帰検証を終えた後、公開承認を得ます。package/lock/default/server/README のバージョンを合わせ、秘密情報・個人 PC のパス・通常利用のデータ・PRIVATE 配布記録を公開対象から除きます。

承認済みの成果を PUBLIC に反映し、新しい公開コミットに `v3.5.0` tag を作ります。完了した同一の機能・回帰検証は繰り返さず、ビルド・同梱ファイル・アップロードなど配布自体を確認します。新しい Draft Release に portable EXE と Release Notes を準備し、アップロード完了後に Publish します。3言語のヘルプはアプリに含むため、日本語 PDF の別途制作は不要です。従来の PDF を別途添付する場合は v3.4.0 資料と明記します。

過去の tag・Release を変更・削除しません。ライセンス告知と EXE のサイズ・SHA-256 を保持してください。公開承認がなければ PRIVATE のコミット・push で止めます。
