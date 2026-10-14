# Chaessi Preset v3.6.0

프롬프트를 다듬고 저장·복원하며, 이미지 생성부터 최종 PNG 완성까지 이어 가는 NovelAI 작업대.

A Windows workbench for refining, saving and restoring prompts, then generating and finishing a PNG with NovelAI.

文章を調整・保存・復元し、画像生成から PNG の仕上げまで続けられる NovelAI 作業台。

**[Download v3.6.0](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.6.0)** · Windows x64 portable · [Buy Me a Coffee](https://buymeacoffee.com/magiconcert)

**목차 / Contents / 目次**

- [사용자용 — 한국어](#user-ko)
- [User Guide — English](#user-en)
- [ユーザーガイド — 日本語](#user-ja)
- [개발자용 — 한국어](#developer-ko)
- [Developer Guide — English](#developer-en)
- [開発者ガイド — 日本語](#developer-ja)

![Prompt and image workbench](assets/manuals/en/workbench.png)

<a id="user-ko"></a>
## 사용자용 — 한국어

### 글을 고치고, 한 장으로 확인하세요

프리셋을 불러와 글을 조금 고치고 PNG 한 장을 만들어 확인하세요. **저장**은 현재 프리셋을 갱신하고 **새 이름으로 저장**은 원본을 남긴 사본을 만듭니다. 미저장 표시, 저장 상태 복원, 이전 작업과 이전 저장 기록으로 다시 돌아갈 수 있습니다. 이미지 생성에는 본인의 NovelAI 계정과 인터넷 연결이 필요합니다.

### v3.6.0에서 달라진 점

- **V5 Full High / Medium**: 실제 Effort를 요청·History·PNG에서 함께 다룹니다. Medium은 14 Steps/Euler Ancestral/Heavy UC 고정이며 직접 쓴 Base/Character 제외 글은 보관하지만 생성에 쓰지 않습니다. High로 돌아오면 해당 설정을 복원합니다.
- **이미지 완성 도구**: Upscale ×2, Enhance, Max✨ Enhance, 배경 제거, 선화, 스케치, 채색, 표정, 정리, Canvas, Outpainting과 별도 Focused Inpaint.
- **그림 설명서**: 상단 첫 **앱 정보**에서 실제 버전·후원·도움말로 들어갑니다. 세 언어의 30개 장과 103개 그림을 오프라인으로 보고 검색·글자 크기·확대·현재 도구 도움말을 사용합니다.
- **예상 Anlas**: 실행 전 크기와 비용을 확인합니다. 추정과 실제 차감은 다를 수 있고 0 Anlas여도 계정 사용량이나 V5 스태미나를 쓸 수 있습니다.

기존 프리셋, Base/의상/Character 라이브러리, Wildcard와 `||A|B||`, Position Pad, T2I/I2I, 기존 붓 마스크 Inpaint, History와 PNG Import를 유지합니다. 기존 Inpaint의 마스크·Padding·강도·전송·합성 전략은 유지하며 Focused Inpaint로 자동 대체하지 않습니다.

### 다운로드와 업데이트

1. [Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.6.0)의 **`Chaessi-Preset-v3.6.0-x64.exe`**를 받습니다. `SHA256SUMS.txt`로 파일 해시를 확인할 수 있습니다.
2. Windows x64용 portable EXE를 실행합니다. 별도 설치나 Node.js가 필요하지 않으며 자동 업데이트는 제공하지 않습니다. 파일은 서명되지 않았습니다.
3. 상단에서 한국어/English/日本語를 고르고 **API 설정**에서 본인의 NovelAI 토큰을 저장합니다. 토큰은 PC의 암호화된 앱 저장소에 보관되며 공유하면 안 됩니다.
4. 글·High/Medium·크기·예상 비용을 확인하고 **이미지 한 장 생성**을 누릅니다. PNG와 프리셋은 각각 저장하세요.

**v3.5.0에서 업데이트:** 작업을 저장하고 앱을 완전히 닫습니다. `%APPDATA%\Chaessi Preset`을 백업한 뒤 EXE를 새 파일로 교체하세요. 데이터는 EXE와 별도로 보관됩니다. 저장하지 않은 글은 종료 후 자동 복구되지 않습니다. 기존 파일을 읽는 것만으로 일괄 변환하지 않으며 수정해서 저장한 프리셋은 새 형식이 될 수 있으므로, 이전 버전으로 돌아가려면 백업을 사용하세요. [업데이트 안내](docs/UPDATING.md).

### 저장·불러오기·Wildcard·Character

불러오기에서 이름 검색과 카테고리·하위 분류·이름/날짜 정렬을 함께 사용합니다. Base 옆 **Preset**은 문장 묶음을, 전체 **Save**는 작업대를 저장합니다. Character마다 글·제외 글·활성 상태·위치와 의상 프리셋을 관리합니다. 번호 슬롯별 마지막 분류 선택과 UI 언어는 재시작 후에도 기억합니다.

Wildcard에서 키 `tops`를 만들고 `white shirt`, `black shirt`, `blue shirt`를 한 줄씩 저장한 뒤 `__tops__`로 넣으세요. 생성에 사용할 후보는 한 번 확정되어 요청·History·PNG에 실제 글로 기록되고, 프리셋에는 참조가 남습니다. 같은 후보가 연달아 나와도 정상입니다. 다른 PC에서는 같은 키의 라이브러리도 준비하세요.

### PNG를 완성하는 흐름

**최근 결과 / History / 외부 PNG → 이미지 도구 → 설정 → 비용 확인 → 실행 → 결과 확인 → PNG 저장 → 다시 사용.**

Upscale은 가로·세로를 2배로, Enhance는 글과 원본을 참고해 다시 다듬고 Max는 전용 확대 처리로 만듭니다. Canvas는 펜·지우개·채우기·Undo/Redo·크기 변경·자르기를 로컬에서 사용합니다. Outpainting은 바깥 공간을 만들고 Focused Inpaint는 직사각형 부분을 처리해 선택 밖 픽셀을 보존합니다. 큰 그림의 작은 마스크가 항상 무료인 것은 아닙니다.

결과는 원본과 별도 History/PNG로 남습니다. 배경 제거의 Masked/Generated/Blend를 고르거나 다른 도구·I2I/Inpaint로 이어 쓰세요. 이미지 도구가 편집 중인 글을 자동으로 바꾸지 않습니다. 큰 결과가 생성 입력 한도를 넘으면 Canvas에서 먼저 줄이세요. 실패·통신 중단 시 완료와 차감을 확인하지 않은 채 반복 실행하지 마세요.

**V4.5 신규 생성은 종료했습니다.** 기존 V4.5 프리셋·History·PNG는 읽고 편집·저장할 수 있으며 새로 생성하려면 V5로 명시적으로 바꿉니다. 과거 참조 설정의 읽기 호환이 V5에서의 생성 지원을 뜻하지는 않습니다.

상단 **앱 정보 → 도움말 센터**를 기준으로 사용하세요. 이전 v3.4.0 PDF는 보존 자료로 앱에 남아 있습니다. PNG 저장은 그림을, 프리셋 저장은 글과 설정을 보관합니다. 삭제한 History나 프리셋은 앱에서 복구할 수 없습니다.

앱은 무료이며 후원 여부에 따른 기능 차이는 없습니다. 개발자 **DooMokDdongGae**를 [커피 한 잔당 USD $3의 일회성 후원](https://buymeacoffee.com/magiconcert)으로 응원할 수 있습니다. 금액과 일회성 방식을 후원 페이지에서 확인하세요. NovelAI 이용료는 별도입니다.

<a id="user-en"></a>
## User Guide — English

### Refine words and check one PNG

Load a preset, edit a little and inspect one generated PNG. **Save** updates the current preset; **Save As** keeps the original and creates a copy. An unsaved indicator, Restore saved, Previous work and Saved revisions help you return to earlier text. Generation requires your own NovelAI account and internet access.

### What is new

- **V5 Full High/Medium**, with actual Effort in requests, History and PNG imports. Medium fixes 14 Steps/Euler Ancestral/Heavy UC; custom Base/Character undesired text is retained but unused. Returning to High restores its settings.
- **Finishing tools:** Upscale ×2, Enhance, Max✨ Enhance, Remove Background, Line Art, Sketch, Colorize, Emotion, Declutter, Canvas, Outpainting and separate Focused Inpaint.
- **Illustrated help:** the first top menu, **App info**, contains version, help and optional support. Three languages share 30 chapters and 103 offline pictures, search, text sizing, zoom and contextual links.
- **Estimated Anlas:** check size and cost before running. Actual charges may differ; zero Anlas may still consume allowance or V5 Stamina.

Presets, Base/outfit/Character libraries, Wildcards and `||A|B||`, Position Pad, T2I/I2I, existing brush-mask Inpaint, History and PNG Import remain. Existing Inpaint mask, Padding, strength, transport and compositing behavior is preserved. Focused Inpaint is an explicit separate tool.

### Download, run and update

1. Get **`Chaessi-Preset-v3.6.0-x64.exe`** from the [Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.6.0); compare its hash with `SHA256SUMS.txt`.
2. Run this Windows x64 portable executable. No installer, Node.js or automatic updater is provided. The executable is unsigned.
3. Choose Korean/English/Japanese, then save your own NovelAI token in **API Settings**. It is kept in the PC’s encrypted app storage; never share it.
4. Check prompt, Effort, dimensions and cost, then **Generate one image**. Save the PNG and preset separately.

**Updating from v3.5.0:** save work and close the app, back up `%APPDATA%\Chaessi Preset`, then replace the EXE. Presets, Wildcards and History live outside the executable. Unsaved text is not restored after quitting. Reading does not bulk-convert the library; saving edits may use the new format. Keep your backup if reverting. [Update guide](docs/UPDATING.md).

### Your prompt library and PNG workflow

Search and filter by category/subcategory and name/date order. The Base **Preset** picker loads reusable text; the main Save stores the workbench. Each Character has prompts, enabled state, position and outfit presets. Numbered-slot categories and language preferences persist across restarts.

Create a Wildcard key `tops`, put `white shirt`, `black shirt`, `blue shirt` on separate lines and insert `__tops__`. Choices freeze once per generation; requests, History and PNG metadata contain the actual text while the editing preset retains references. Repeated choices are normal. Copy matching Wildcard definitions when moving presets to another PC.

**Latest result / History / uploaded PNG → Image tools → settings → review cost → run → inspect → Save PNG → reuse.** Upscale doubles both dimensions; Enhance redraws using the source and prompt; Max uses dedicated processing. Canvas offers local pen/eraser/fill, Undo/Redo, resize and crop. Outpainting adds outside space. Focused Inpaint processes a rectangle and preserves pixels outside it. A small mask on a large picture is not a promise of free usage.

Results are separate from sources. Select Masked/Generated/Blend after background removal, chain another tool or use it for I2I/Inpaint. Tool use does not automatically change workbench text. Resize large results before feeding them to a mode whose input limit they exceed. After an interruption, establish completion and charges before repeating a request.

**New V4.5 generation has ended.** Existing V4.5 presets, History and PNGs remain readable/editable/savable; explicitly switch to V5 to generate. Read compatibility with older reference settings does not make them supported for V5 generation.

Read current instructions in **App info → Help Center**. The older v3.4.0 PDFs remain archived in the app. PNG saving keeps the picture; preset saving keeps words/settings. Deleted presets and History cannot be recovered in the app.

All features are free regardless of support. You can support **DooMokDdongGae** with [a one-time USD $3 coffee](https://buymeacoffee.com/magiconcert); confirm the amount and one-time option there. NovelAI charges are separate.

<a id="user-ja"></a>
## ユーザーガイド — 日本語

### 文章を直して PNG 1枚で確認

プリセットを読み込み、少し編集して生成結果を見ます。**保存**は現在のプリセットを更新し、**名前を付けて保存**は元を残してコピーを作ります。未保存表示、保存状態への復元、前の作業、保存記録で以前の文章に戻れます。生成には自分の NovelAI アカウントとインターネットが必要です。

### 新しい機能

- **V5 Full High/Medium** と実際の Effort 認識。Medium は14 Steps/Euler Ancestral/Heavy UC 固定で手入力の Base/Character 除外文は保管しますが使いません。High に戻すと設定を復元します。
- **画像の仕上げ:** Upscale ×2、Enhance、Max✨ Enhance、背景除去、線画、スケッチ、着色、表情、整理、Canvas、Outpainting、別の Focused Inpaint。
- 上部先頭の**アプリ情報**にバージョン・ヘルプ・任意の支援を統合。3言語の30章・103枚の図をオフラインで検索・拡大できます。
- 実行前の**推定 Anlas**。実際の料金は異なる場合があり0 Anlas でも利用枠や V5 スタミナを使う場合があります。

既存のプリセット、Base/衣装/Character、Wildcard と `||A|B||`、Position Pad、T2I/I2I、筆マスク Inpaint、履歴、PNG Import を維持します。既存 Inpaint のマスク・Padding・強さ・送信・合成方式は変えず Focused Inpaint に自動で置き換えません。

### ダウンロード・更新

1. [Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.6.0) の **`Chaessi-Preset-v3.6.0-x64.exe`** を取得し `SHA256SUMS.txt` で確認します。
2. Windows x64 用 portable EXE を実行します。インストーラー・Node.js・自動更新は不要/非提供です。ファイルは未署名です。
3. 韓国語/English/日本語を選び **API 設定**に自分の NovelAI トークンを保存します。PC の暗号化された保存領域に保管します。他人に渡さないでください。
4. 文章・Effort・サイズ・費用を確認して**画像を1枚生成**を押し、PNG とプリセットを別々に保存します。

**v3.5.0 からの更新:** 保存して終了し `%APPDATA%\Chaessi Preset` をバックアップしてから EXE を交換します。データは EXE の外にあります。未保存文章は終了後に自動復元しません。読むだけで一括変換せず、編集保存時に新形式になる場合があります。旧版に戻す場合はバックアップを使います。[更新ガイド](docs/UPDATING.md)。

### ライブラリと画像

名前検索・カテゴリ/サブカテゴリ・名前/日付順で探します。Base の **Preset** は文章、全体の保存は作業台を扱います。Character ごとに文章・有効状態・位置・衣装を管理します。番号スロットの分類と言語は再起動後も保持します。

Wildcard のキー `tops` を作り `white shirt`、`black shirt`、`blue shirt` を1行ずつ保存し `__tops__` を挿入します。一度確定した文章を要求・履歴・PNG に記録し、プリセットには参照を残します。同じ候補の連続も正常です。別 PC では同じキーも用意します。

**最新結果 / 履歴 / 外部 PNG → 画像ツール → 設定 → 費用確認 → 実行 → 確認 → PNG 保存 → 再利用。** Upscale は縦横を2倍に、Enhance は元画像と文章で描き直し、Max は専用処理を使います。Canvas はペン・消しゴム・塗りつぶし・Undo/Redo・サイズ変更・切り抜きをローカルで行います。Outpainting は外側を描き足し Focused Inpaint は四角い選択外の画素を保持します。大きな絵の小さなマスクでも無料とは限りません。

結果は元画像と別に保存します。背景除去の Masked/Generated/Blend を選び、別ツールや I2I/Inpaint に渡せます。作業台の文章は自動変更しません。生成入力の上限を超えたら Canvas で縮小します。通信中断時は完了・課金を確認してから再試行します。

**V4.5 の新規生成は終了しました。** 過去のプリセット・履歴・PNG は読込/編集/保存でき、生成は明示的に V5 へ切り替えます。旧参照設定を読めることは V5 生成での対応を意味しません。

最新の説明は**アプリ情報 → ヘルプセンター**、v3.4.0 PDF は過去資料です。PNG 保存は絵、プリセット保存は文章・設定です。削除した項目はアプリで復元できません。全機能無料で、**DooMokDdongGae** を [USD $3 の単発支援](https://buymeacoffee.com/magiconcert)で応援できます。金額と単発方式を確認してください。NovelAI の料金は別です。

<a id="developer-ko"></a>
## 개발자용 — 한국어

Node.js 20 이상(배포 검증 Node 24/Electron 42)에서 `npm ci`, `npm start` 또는 `npm run electron:dev`를 사용합니다. MIT이며 의존성·자산 고지는 `THIRD_PARTY_NOTICES.md`, `assets/licenses/`, `assets/manuals/ASSET_NOTICES.md`에 있습니다. 버전은 `package.json`에서 바꾸고 `node scripts/sync-version.mjs`로 동기화합니다. `npm run electron:pack`은 unpacked, `npm run electron:dist`는 portable EXE용입니다. 비밀키·개인 데이터·빌드 결과를 Git에 넣지 마세요. [검증](VERIFICATION.md), [변경 이력](CHANGELOG.md), [선택 사항인 읽기 전용 MCP](mcp/README.md)도 참고하세요.

<a id="developer-en"></a>
## Developer Guide — English

Use Node.js 20+ (release verification: Node 24/Electron 42), `npm ci`, then `npm start` or `npm run electron:dev`. MIT; dependency/asset notices are in `THIRD_PARTY_NOTICES.md`, `assets/licenses/` and `assets/manuals/ASSET_NOTICES.md`. Edit `package.json` and run `node scripts/sync-version.mjs` to synchronize versions. `npm run electron:pack` builds unpacked files; `npm run electron:dist` builds the portable EXE. Never commit credentials, personal data or build output. See [verification](VERIFICATION.md), [changelog](CHANGELOG.md), and optional [read-only MCP](mcp/README.md).

<a id="developer-ja"></a>
## 開発者ガイド — 日本語

Node.js 20以上（配布検証 Node 24/Electron 42）で `npm ci` 後 `npm start` または `npm run electron:dev` を使います。MIT です。依存関係・資産の告知は `THIRD_PARTY_NOTICES.md`、`assets/licenses/`、`assets/manuals/ASSET_NOTICES.md` を参照してください。`package.json` の版を変え `node scripts/sync-version.mjs` で同期します。`npm run electron:pack` は unpacked、`npm run electron:dist` は portable EXE を作ります。秘密情報・個人データ・ビルド結果を Git に入れないでください。[検証](VERIFICATION.md)、[変更履歴](CHANGELOG.md)、任意の[読み取り専用 MCP](mcp/README.md)も参照できます。
