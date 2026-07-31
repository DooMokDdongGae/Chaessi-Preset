# Chaessi Preset

Chaessi Preset is a local preset and payload manager for NovelAI V4.5 Full text-to-image, image-to-image, and inpaint generation.

Chaessi Preset은 NovelAI V4.5 Full text-to-image, image-to-image, inpaint 생성을 위한 로컬 프리셋 / 페이로드 매니저입니다.

Text to Image and Image to Image model:

Text to Image와 Image to Image 모델:

```text
nai-diffusion-4-5-full
```

Inpaint mode automatically uses the matching inpainting model internally; it is not a user-selectable multi-model feature.

Inpaint 모드는 내부적으로 대응 inpainting 모델을 자동 사용하며, 사용자가 모델을 선택하는 multi-model 기능은 아닙니다.

```text
nai-diffusion-4-5-full-inpainting
```

The app keeps this flow stable:

앱은 아래 흐름을 안정적으로 유지합니다.

```text
UI -> Internal Preset Schema -> Adapter -> NovelAI Payload -> NovelAI
```

Chaessi Preset v2.3.0 adds Precise Reference conditioning to Text to Image, Image to Image, and Inpaint while keeping preset schemas, Character Slots, saved data, and existing generation modes compatible.

Chaessi Preset v2.3.0은 Text to Image, Image to Image, Inpaint에 Precise Reference conditioning을 추가하며, preset schema, Character Slot, 저장 데이터 및 기존 생성 모드의 호환성을 유지합니다.

Raw payload direct generation, Vibe Transfer, Character Slot-specific reference binding, scene composition, video features, and user-selectable multi-model support are intentionally not included in v2.3.0.

Raw payload 직접 생성, Vibe Transfer, Character Slot별 reference 연결, scene composition, video 기능, 사용자 선택형 multi-model 지원은 v2.3.0에 의도적으로 포함하지 않았습니다.

## Quick Start

Windows users do not need Node.js, npm, Git, or any development tools to use the portable EXE.

일반 Windows 사용자는 portable EXE를 사용하기 위해 Node.js, npm, Git 같은 개발 도구를 설치할 필요가 없습니다.

Download the EXE from GitHub Releases, run it, open **API Settings**, and save your NovelAI token.

GitHub Releases에서 EXE를 다운로드해 실행한 뒤, **API Settings**를 열고 NovelAI 토큰을 저장하면 됩니다.

What regular users need:

일반 사용자에게 필요한 것:

- Windows PC
- NovelAI account
- NovelAI access token
- Chaessi Preset portable EXE

- Windows PC
- NovelAI 계정
- NovelAI access token
- Chaessi Preset portable EXE

## Portable EXE

Current release build:

현재 릴리즈 빌드:

```text
dist/Chaessi-Preset-v2.3.0-x64.exe
```

The EXE is portable. You can move it to another folder and run it from there. User presets, character presets, token storage, and generation history are stored separately from the EXE, so replacing the EXE does not remove saved app data.

EXE는 portable 형식입니다. 다른 폴더로 옮겨서 실행할 수 있습니다. 사용자 프리셋, 캐릭터 프리셋, 토큰 저장소, 생성 기록은 EXE와 분리되어 저장되므로 EXE를 교체해도 저장된 앱 데이터는 삭제되지 않습니다.

The current release does not include an installer, code signing, or auto-update.

현재 릴리즈에는 installer, code signing, auto-update가 포함되어 있지 않습니다.

## Token Setup

Open **API Settings** in the app and save your NovelAI token.

앱에서 **API Settings**를 열고 NovelAI 토큰을 저장합니다.

Chaessi Preset stores the saved token with Electron `safeStorage` as encrypted local token data under the app userData directory. The token value is not shown again after saving and is not returned by API responses.

Chaessi Preset은 저장된 토큰을 Electron `safeStorage`를 사용해 앱 userData 디렉터리 아래에 암호화된 로컬 토큰 데이터로 저장합니다. 저장 후 토큰 값은 다시 표시되지 않으며 API 응답으로도 반환되지 않습니다.

Token status may show:

토큰 상태는 다음 중 하나로 표시될 수 있습니다.

```text
safe_storage
env
none
```

You can clear only the saved app token with **Clear Saved Token**. Environment variables are not deleted by the app.

**Clear Saved Token**은 앱에 저장된 토큰만 삭제합니다. 환경변수는 앱에서 삭제하지 않습니다.

Development mode can still use a local `.env` file or environment variable:

개발 모드에서는 로컬 `.env` 파일이나 환경변수를 계속 사용할 수 있습니다.

```env
NAI_ACCESS_TOKEN=YOUR_NOVELAI_ACCESS_TOKEN_HERE
```

Never commit `.env` or real tokens.

`.env`나 실제 토큰은 절대 커밋하지 마세요.

## Local Data

Development mode stores runtime data under the project-local `data/` directory.

개발 모드는 런타임 데이터를 프로젝트 로컬 `data/` 디렉터리에 저장합니다.

Electron and portable EXE mode store user data under Electron `app.getPath("userData")`.

Electron 및 portable EXE 모드는 사용자 데이터를 Electron `app.getPath("userData")` 아래에 저장합니다.

On Windows this is typically:

Windows에서는 일반적으로 다음 위치입니다.

```text
%APPDATA%\Chaessi Preset\
```

User data includes:

사용자 데이터에는 다음 항목이 포함됩니다.

```text
data/presets/
data/character-presets/
data/character-preset-categories/categories.json
data/base-prompts/
data/undesired-prompts/
data/params-presets/
data/generations/
secure-store/tokens.json
```

Existing project-local user data is copied into userData on first Electron use when the corresponding target folders do not already exist.

기존 프로젝트 로컬 사용자 데이터는 Electron을 처음 사용할 때, 대응하는 대상 폴더가 아직 없으면 userData로 복사됩니다.

## Features

- Integrated local workbench UI
- NovelAI V4.5 Full Text to Image / Image to Image / Inpaint generation
- Internal preset schema and NovelAI payload adapter
- Exact local NovelAI V4.5 Full prompt token counters with shared context totals
- Image metadata import for supported PNG/WebP NovelAI metadata
- Raw JSON metadata import
- Full preset Save / Save As / Load
- Character prompt presets with Save / Save As / Load / Delete
- Character prompt preset categories, one-level subcategories, and add-only Category Manager
- Base Prompt has a Preset button and can use the existing Character Prompt Preset library
- Character Prompt Presets can be loaded into Base Prompt or Character Slots from their own Preset buttons
- Character preset thumbnails
- Generation result preview and history
- Local result image save/delete
- Electron safeStorage token saving for the desktop app
- User presets and generations stored outside the app bundle through Electron userData

- 통합 로컬 작업대 UI
- NovelAI V4.5 Full Text to Image / Image to Image / Inpaint 생성
- internal preset schema와 NovelAI payload adapter
- 공유 context 합계를 포함하는 NovelAI V4.5 Full 공식 일치 로컬 프롬프트 토큰 카운터
- 지원되는 PNG/WebP NovelAI metadata 이미지 import
- Raw JSON metadata import
- 전체 프리셋 Save / Save As / Load
- 캐릭터 프롬프트 프리셋 Save / Save As / Load / Delete
- 캐릭터 프롬프트 프리셋 분류, 1단계 하위 분류, 추가 전용 Category Manager
- Base Prompt에 Preset 버튼이 있으며 기존 Character Prompt Preset 라이브러리를 사용할 수 있음
- 각 영역의 Preset 버튼에서 Character Prompt Preset을 Base Prompt 또는 Character Slot에 로드 가능
- 캐릭터 프리셋 썸네일
- 생성 결과 preview와 history
- 로컬 결과 이미지 저장/삭제
- 데스크톱 앱용 Electron safeStorage 토큰 저장
- 사용자 프리셋과 생성 기록을 Electron userData를 통해 앱 번들 밖에 저장

## Prompt Token Counters

Chaessi Preset counts NovelAI V4.5 Full prompt tokens locally and offline with a T5-compatible tokenizer validated against the official NovelAI UI. Base Prompt and enabled Character Prompts show their own token count plus the shared positive context total. Undesired Content and enabled Character Undesired fields use a separate shared negative context. The confirmed limit is 512 tokens per context; values at 80% are highlighted and values over the limit are shown in red without blocking Generate, matching the official warning behavior.

Chaessi Preset은 NovelAI 공식 UI와 대조 검증한 T5 호환 tokenizer로 NovelAI V4.5 Full 프롬프트 토큰을 로컬·오프라인에서 계산합니다. Base Prompt와 활성 Character Prompt는 각 입력란의 토큰 수와 공유 positive context 합계를 함께 표시합니다. Undesired Content와 활성 Character Undesired는 별도의 shared negative context를 사용합니다. 확인된 한도는 context당 512 tokens이며, 80% 이상은 경고색, 초과는 빨간색으로 표시하되 공식 UI의 경고 동작처럼 Generate를 차단하지 않습니다.

Random prompt blocks display the maximum token count among fully resolved alternatives. Up to 256 combinations are evaluated exactly; larger sets use a tokenizer-based maximum estimate without counting unresolved delimiters or summing every option. At Generate time, the existing Random Prompt Resolver creates a copy, the selected fields are counted exactly, and only the resolved copy is sent. Saved presets keep the original `||a|b|c||` syntax.

랜덤 프롬프트 블록은 완전히 확정된 선택지 조합 중 최대 토큰 수 하나만 표시합니다. 256개 이하 조합은 정확히 계산하고, 이를 초과하면 미확정 구분자를 세거나 모든 선택지를 합산하지 않고 tokenizer 기반 최대 예상값을 사용합니다. Generate 시점에는 기존 Random Prompt Resolver가 복사본을 만들고 실제 선택된 입력을 정확히 다시 계산한 뒤 resolved copy만 전송합니다. 저장된 preset에는 원본 `||a|b|c||` 문법이 유지됩니다.

## Generation Modes

**Text to Image** keeps the existing v1.5.1 generation flow and remains the default mode.

**Text to Image**는 기존 v1.5.1 생성 흐름을 그대로 유지하며 기본 모드입니다.

**Image to Image** accepts PNG, WebP, or JPEG source images. Use **Strength** to control how strongly the result departs from the source and **Noise** to control added variation. The source image is transmitted at its original dimensions without stretching.

**Image to Image**는 PNG, WebP, JPEG source image를 지원합니다. **Strength**로 원본에서 얼마나 변화할지 조절하고, **Noise**로 추가 변화를 조절합니다. Source image는 비율을 왜곡하지 않고 원본 크기로 전송됩니다.

**Inpaint** uses the source image as a canvas. Paint the region to regenerate with **Brush**, remove mask pixels with **Eraser**, and use **Undo**, **Redo**, or **Clear Mask** as needed. Source and mask dimensions must match, and an empty mask cannot be generated.

**Generation Padding** expands the selection sent to NovelAI from 0 to 32 pixels, with a verified default of 16px. After padding, the full-resolution generation mask is aligned to uniform 8x8 binary blocks. White pixels regenerate and black pixels preserve.

**Generation Padding**은 NovelAI로 보내는 선택 영역을 0~32px 확장하며, 검증된 기본값은 16px입니다. Padding 적용 후 전체 해상도의 generation mask를 균일한 8x8 이진 블록으로 정렬합니다. 흰색 픽셀은 재생성하고 검정 픽셀은 보존합니다.

**Inpaint**는 source image를 작업 캔버스로 사용합니다. 다시 생성할 영역을 **Brush**로 칠하고, **Eraser**로 마스크를 지우며, 필요하면 **Undo**, **Redo**, **Clear Mask**를 사용합니다. Source와 mask 크기는 같아야 하며 빈 mask로는 생성할 수 없습니다.

NovelAI's raw Inpaint PNG is used directly as the final image and History result. No local feather/composite pass is applied. Source, selection mask, and transmitted generation mask remain separate generation-time assets; payload and sidecar JSON do not contain full image Base64 data.

NovelAI의 raw Inpaint PNG를 최종 이미지와 History 결과로 그대로 사용합니다. 로컬 Feather/Composite 처리는 적용하지 않습니다. Source, selection mask, 실제 전송 generation mask는 생성 시점의 별도 자산으로 보관되며 payload와 sidecar JSON에는 전체 이미지 Base64 데이터가 들어가지 않습니다.

Advanced Crop -> Generate -> Composite is not included in v2.3.0.

고급 Crop -> Generate -> Composite는 v2.3.0에 포함되지 않습니다.

## Precise Reference

Precise Reference is optional global generation conditioning available in Text to Image, Image to Image, and Inpaint. It is separate from Character Slots and is not stored inside preset schemas.

Precise Reference는 Text to Image, Image to Image, Inpaint에서 선택적으로 사용하는 전역 generation conditioning입니다. Character Slot과 분리되어 있으며 preset schema 내부에는 저장되지 않습니다.

Each reference can be enabled or disabled and configured as **Character**, **Style**, or **Character & Style**. **Strength** controls how strongly the reference influences the result, while **Fidelity** controls how closely its details are followed. The slider range is 0 to 1 in 0.05 steps; the numeric input also supports finite values outside that range, including negative values, as in the official NovelAI UI.

각 reference는 활성화하거나 비활성화할 수 있으며 **Character**, **Style**, **Character & Style** 중 하나로 설정합니다. **Strength**는 결과에 미치는 영향의 크기를, **Fidelity**는 세부 특징을 얼마나 충실히 따를지를 조절합니다. 슬라이더 범위는 0부터 1까지 0.05 간격이며, 숫자 입력란에서는 공식 NovelAI UI와 같이 음수를 포함한 범위 밖의 유한 값도 사용할 수 있습니다.

Multiple Character references are blended together; they are not assigned to separate Character Slots. Precise Reference adds 5 Image Anlas per active reference for each generated image. Inpaint may need lower Style or Character & Style Strength/Fidelity values to avoid overpowering the surrounding image.

여러 Character reference는 서로 섞여 적용되며 각 Character Slot에 따로 배정되지 않습니다. Precise Reference는 생성 이미지 한 장마다 활성 reference 하나당 Image Anlas 5가 추가됩니다. Inpaint에서는 주변 이미지보다 reference 영향이 과해지지 않도록 Style 또는 Character & Style의 Strength/Fidelity를 낮춰야 할 수 있습니다.

Reference images are prepared locally as centered PNGs using the official V4.5 reference sizes. Only the prepared bytes are sent for generation. History stores those transmitted PNGs as separate assets, while payload and sidecar JSON keep only safe paths, byte lengths, hashes, and settings instead of image Base64.

Reference 이미지는 공식 V4.5 reference 크기에 맞춘 중앙 정렬 PNG로 로컬에서 준비되며, 준비된 bytes만 생성 요청에 사용됩니다. History에는 실제 전송 PNG를 별도 asset으로 저장하고, payload와 sidecar JSON에는 이미지 Base64 대신 안전한 경로, byte length, hash, 설정값만 기록합니다.

Vibe Transfer, reference preset libraries, and Character Slot-specific reference binding are not included in v2.3.0.

Vibe Transfer, reference preset library, Character Slot별 reference 연결은 v2.3.0에 포함되지 않습니다.
## Character Prompt Preset Categories

Character Prompt Presets support categories for organizing a large module-style preset library. Categories are only for organization and filtering. They are not connected to Character Slot numbers, and every Character Slot can freely load presets from every category.

Character Prompt Preset은 큰 모듈형 프리셋 라이브러리를 정리하기 위한 분류(Category)를 지원합니다. 분류는 정리와 필터링 용도일 뿐입니다. 분류는 Character Slot 번호와 연결되지 않으며, 모든 Character Slot은 모든 분류의 프리셋을 자유롭게 불러올 수 있습니다.

Saved Character Prompt Presets can also be loaded into Base Prompt through the Preset button in the Base Prompt area. Loading into Base Prompt uses replace behavior: the current Base Prompt and Undesired fields are replaced with the selected preset's prompt and undesired content. Append, merge, tag sorting, and duplicate removal are not performed.

저장된 Character Prompt Preset은 Base Prompt 영역의 Preset 버튼을 통해 Base Prompt에도 로드할 수 있습니다. Base Prompt로 로드할 때는 Replace 방식으로 동작합니다. 현재 Base Prompt와 Undesired 입력값이 선택한 프리셋의 prompt 및 undesired content로 교체됩니다. Append, merge, 태그 정렬, 중복 제거는 수행하지 않습니다.

The Character Prompt Preset dialog no longer uses a Load target dropdown. The target is decided by the button that opened the dialog: Base Prompt's Preset button loads into Base Prompt, and each Character Slot's Preset button loads into that slot.

Character Prompt Preset dialog는 더 이상 Load target 드롭다운을 사용하지 않습니다. 로드 대상은 dialog를 연 버튼으로 결정됩니다. Base Prompt의 Preset 버튼은 Base Prompt로 로드하고, 각 Character Slot의 Preset 버튼은 해당 슬롯으로 로드합니다.

Full Preset Save / Save As / Load is still the full workbench snapshot flow. Character Prompt Preset loading into Base Prompt does not replace or reduce Full Preset behavior.

전체 Preset Save / Save As / Load는 여전히 작업대 전체 스냅샷 흐름입니다. Character Prompt Preset을 Base Prompt에 로드하는 기능은 전체 Preset 기능을 대체하거나 축소하지 않습니다.

Default categories:

기본 분류:

- 여성 캐릭터
- 남성 캐릭터
- 여성 의상
- 남성 의상
- 구도·카메라
- 배경·소품
- 조명
- 그림체
- 품질
- 기타

Use **Manage Categories** to add a new top-level category or one level of subcategories under any built-in or custom category. New values appear immediately in the Save/Save As selectors and list filters. v2.1.0 is add-only: rename, delete, reorder, and deeper category trees are not included.

**Manage Categories**에서 새 상위 카테고리를 추가하거나 built-in 및 사용자 카테고리 아래에 1단계 하위 카테고리를 추가할 수 있습니다. 새 항목은 Save/Save As 선택지와 목록 필터에 즉시 반영됩니다. v2.1.0은 추가만 지원하며 이름 변경, 삭제, 순서 변경, 더 깊은 카테고리 트리는 포함하지 않습니다.

Custom category settings are stored at `data/character-preset-categories/categories.json` under Electron userData. Unregistered legacy category and subCategory strings remain visible, filterable, and unchanged when a preset is loaded or saved again.

사용자 카테고리 설정은 Electron userData 아래 `data/character-preset-categories/categories.json`에 저장됩니다. 등록되지 않은 legacy category 및 subCategory 문자열도 계속 표시되고 필터링되며, 프리셋을 다시 불러오거나 저장해도 임의로 바뀌지 않습니다.

Existing character prompt presets without category data are shown as `기타`.

분류 정보가 없는 기존 캐릭터 프롬프트 프리셋은 자동으로 `기타`로 표시됩니다.

The old `여성 아웃핏` category is displayed as `여성 의상`, and the old `남성 아웃핏` category is displayed as `남성 의상` for compatibility.

기존 `여성 아웃핏` 분류는 호환성을 위해 `여성 의상`으로 표시되고, 기존 `남성 아웃핏` 분류는 `남성 의상`으로 표시됩니다.

`여성 의상` supports optional subcategories:

`여성 의상`은 선택형 하위 카테고리를 지원합니다.

- Casual / 캐주얼
- Street / 스트리트
- Sporty / 스포티
- Office / 오피스
- Girly / 걸리
- Glam / 글램
- Boudoir / 부두아르
- Uniform / 유니폼

`남성 의상` supports the same optional clothing subcategory flow, using `Dandy / 댄디` in place of the female clothing `Girly / 걸리` category:

`남성 의상`도 동일한 선택형 의상 하위 카테고리 흐름을 지원하며, 여성 의상의 `Girly / 걸리` 대신 `Dandy / 댄디`를 사용합니다.

- Casual / 캐주얼
- Street / 스트리트
- Sporty / 스포티
- Office / 오피스
- Dandy / 댄디
- Glam / 글램
- Boudoir / 부두아르
- Uniform / 유니폼

## Security Rules

Tokens must not appear in:

토큰은 다음 위치에 나타나면 안 됩니다.

- console logs
- API responses
- preset files
- payload files
- sidecar files
- history records
- browser UI plain text

- 콘솔 로그
- API 응답
- 프리셋 파일
- payload 파일
- sidecar 파일
- history 기록
- 브라우저 UI 일반 텍스트

The desktop app uses Electron safeStorage encrypted local token storage. At runtime, the decrypted NovelAI token is injected into the local server child process environment so the existing TokenProvider / EnvSecretStore request path can remain stable.

데스크톱 앱은 Electron safeStorage 기반 암호화 로컬 토큰 저장소를 사용합니다. 런타임에는 복호화된 NovelAI 토큰을 로컬 서버 child process 환경에 주입하여 기존 TokenProvider / EnvSecretStore 요청 경로를 안정적으로 유지합니다.

This is safer than plaintext `.env` storage for normal desktop use, but it is not a separate cloud secret manager, not a DRM system, and not a complete OS Credential Manager/keytar integration.

이는 일반 데스크톱 사용에서 plaintext `.env` 저장보다 안전하지만, 별도 클라우드 secret manager도 아니고 DRM 시스템도 아니며 완전한 OS Credential Manager/keytar 통합도 아닙니다.

## Limitations

Chaessi Preset v2.3.0 does not include raw payload direct generation, Vibe Transfer, Character Slot-specific reference binding, reference preset libraries, advanced crop/composite, scene composition, video features, user-selectable multi-model support, installer, code signing, or auto-update.

Chaessi Preset v2.3.0에는 raw payload 직접 생성, Vibe Transfer, Character Slot별 reference 연결, reference preset library, 고급 crop/composite, scene composition, video 기능, 사용자 선택형 multi-model 지원, installer, code signing, auto-update가 포함되어 있지 않습니다.

## For Developers

The commands in this section are for developers only. Regular Windows users do not need them to use the portable EXE.

이 섹션의 명령은 개발자용입니다. 일반 Windows 사용자는 portable EXE를 사용하기 위해 이 명령들이 필요하지 않습니다.

Install dependencies:

의존성 설치:

```powershell
npm install
```

Run the local web server:

로컬 웹 서버 실행:

```powershell
npm run start
```

Then open:

그 다음 아래 주소를 엽니다.

```text
http://127.0.0.1:4174/
```

Run the Electron desktop shell:

Electron 데스크톱 셸 실행:

```powershell
npm run electron:dev
```

Build the portable Windows executable:

Portable Windows 실행 파일 빌드:

```powershell
npm run electron:dist
```

## Build Exclusions

Packaged output excludes:

패키징 결과물에서는 다음 항목을 제외합니다.

- `.env`
- secrets
- logs
- tmp folders
- project-local `data/`
- private docs and archive folders
- local test scripts and generated smoke-test artifacts

- `.env`
- secrets
- logs
- tmp 폴더
- 프로젝트 로컬 `data/`
- private docs 및 archive 폴더
- 로컬 테스트 스크립트와 생성된 smoke-test 산출물

## License

MIT License. See `LICENSE`. The packaged T5 tokenizer vocabulary is derived from Google T5 under Apache License 2.0; see `THIRD_PARTY_NOTICES.md`.

MIT License를 사용합니다. `LICENSE`를 확인하세요. 패키지에 포함된 T5 tokenizer vocabulary는 Apache License 2.0의 Google T5에서 파생되었으며 `THIRD_PARTY_NOTICES.md`를 확인할 수 있습니다.
