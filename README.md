# Chaessi Preset

Chaessi Preset is a local preset and payload manager for NovelAI V4.5 Full text-to-image generation.

Chaessi Preset은 NovelAI V4.5 Full text-to-image 생성을 위한 로컬 프리셋 / 페이로드 매니저입니다.

Current model:

현재 고정 모델:

```text
nai-diffusion-4-5-full
```

The app keeps this flow stable:

앱은 아래 흐름을 안정적으로 유지합니다.

```text
UI -> Internal Preset Schema -> Adapter -> NovelAI Payload -> NovelAI
```

Raw payload direct generation, inpaint, reference images, vibe transfer, precise reference, scene composition, video features, and multi-model support are intentionally not included in v1.1.

Raw payload 직접 생성, inpaint, reference image, vibe transfer, precise reference, scene composition, video 기능, multi-model 지원은 v1.1에 의도적으로 포함하지 않았습니다.

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
dist/Chaessi-Preset-v1.1.0-x64.exe
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
- NovelAI V4.5 Full text-to-image generation
- Internal preset schema and NovelAI payload adapter
- Image metadata import for supported PNG/WebP NovelAI metadata
- Raw JSON metadata import
- Full preset Save / Save As / Load
- Character prompt presets with Save / Save As / Load / Delete
- Character prompt preset categories and category filtering
- Character preset thumbnails
- Generation result preview and history
- Local result image save/delete
- Electron safeStorage token saving for the desktop app
- User presets and generations stored outside the app bundle through Electron userData

- 통합 로컬 작업대 UI
- NovelAI V4.5 Full text-to-image 생성
- internal preset schema와 NovelAI payload adapter
- 지원되는 PNG/WebP NovelAI metadata 이미지 import
- Raw JSON metadata import
- 전체 프리셋 Save / Save As / Load
- 캐릭터 프롬프트 프리셋 Save / Save As / Load / Delete
- 캐릭터 프롬프트 프리셋 분류와 분류 필터
- 캐릭터 프리셋 썸네일
- 생성 결과 preview와 history
- 로컬 결과 이미지 저장/삭제
- 데스크톱 앱용 Electron safeStorage 토큰 저장
- 사용자 프리셋과 생성 기록을 Electron userData를 통해 앱 번들 밖에 저장

## Character Prompt Preset Categories

Character Prompt Presets support categories for organizing a large module-style preset library. Categories are only for organization and filtering. They are not connected to Character Slot numbers, and every Character Slot can freely load presets from every category.

Character Prompt Preset은 큰 모듈형 프리셋 라이브러리를 정리하기 위한 분류(Category)를 지원합니다. 분류는 정리와 필터링 용도일 뿐입니다. 분류는 Character Slot 번호와 연결되지 않으며, 모든 Character Slot은 모든 분류의 프리셋을 자유롭게 불러올 수 있습니다.

Default categories:

기본 분류:

- 여성 캐릭터
- 남성 캐릭터
- 여성 아웃핏
- 남성 아웃핏
- 구도·카메라
- 배경·소품
- 조명
- 기타

Existing character prompt presets without category data are shown as `기타`.

분류 정보가 없는 기존 캐릭터 프롬프트 프리셋은 자동으로 `기타`로 표시됩니다.

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

Chaessi Preset v1.1 does not include raw payload direct generation, inpaint, reference images, vibe transfer, precise reference, scene composition, video features, multi-model support, installer, code signing, or auto-update.

Chaessi Preset v1.1에는 raw payload 직접 생성, inpaint, reference image, vibe transfer, precise reference, scene composition, video 기능, multi-model 지원, installer, code signing, auto-update가 포함되어 있지 않습니다.

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

MIT License. See `LICENSE`.

MIT License를 사용합니다. `LICENSE`를 확인하세요.
