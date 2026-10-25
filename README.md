# CHAESSI PRESET v3.8.0

**NovelAI로 생성하고, CHAESSI PRESET으로 관리하고, 완성하세요.**<br>
**Generate with NovelAI. Organize and finish with CHAESSI PRESET.**<br>
**NovelAI で生成し、CHAESSI PRESET で管理して仕上げる。**

[**⬇ Windows x64 Portable 다운로드 / Download / ダウンロード**](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/download/v3.8.0/Chaessi-Preset-v3.8.0-x64.exe) · [Release Notes](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.8.0) · [SHA256SUMS.txt](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/download/v3.8.0/SHA256SUMS.txt) · [Buy Me a Coffee](https://buymeacoffee.com/magiconcert)

설치·Node.js 불필요 / No installer or separate Node.js / インストール・Node.js 不要

[한국어](#user-ko) · [English](#user-en) · [日本語](#user-ja) · [개발자 / Developers / 開発者](#developer-ko)

![Independent greenhouse source, preserved original and full generated result](https://github.com/DooMokDdongGae/Chaessi-Preset/raw/v3.8.0/assets/manuals/examples/greenhouse-composition.webp)

① 새 원본 / New source / 新しい元画像 · ② 원본 보존 / Preserved original / 元画像を保持 · ③ 전체 생성 / Full generated / 生成結果全体

![Actual local Pixel Snap comparison](https://github.com/DooMokDdongGae/Chaessi-Preset/raw/v3.8.0/assets/manuals/en/pixel-snap-detail.png)

실제 새 예제·실제 앱 화면. 결과는 조건에 따라 달라집니다. / New independent examples and actual UI; results vary. / 新作の独立例と実画面。結果は条件によって異なります。

<a id="user-ko"></a>
## 한국어

### v3.8.0: 직접 보정하며 탐색하는 카메라

이미 생성된 이미지의 조건으로 다른 구도를 탐색합니다. **자동 태그 변환을 출발점으로 삼되, 사용자가 원하는 위치에서 강도를 보정하고 문구를 직접 고쳐가며 구도를 탐색합니다.**

- History·최근 결과·NAI 메타데이터 이미지에서 시작하고, 모르는 초기 기준만 확인합니다. 이미지가 자동 I2I 입력이 되는 것은 아닙니다.
- 구체의 손잡이와 8방향 버튼으로 양쪽 앞사선·측면·뒤사선·후면과 중간 방향을 선택합니다. 제자리 팬·틸트, 높이, 프레이밍, 롤, 출력 비율도 조정합니다.
- +40°에서 앞사선 1.1을 1.5로 고쳐도 위치와 다른 가중치는 그대로입니다. +50°로 이동해도 보정이 이어지고 +40°에서 재현됩니다. 여러 위치의 보정과 개별 되돌리기를 지원합니다.
- 인물·옷·행동·배경과 카메라 문구를 직접 편집합니다. 수동 문구를 우선하거나 카메라 관리에 다시 연결할 수 있고, 카메라를 끌 때도 유효한 현재 문구를 유지합니다.
- 카메라만 복귀·보정 해제·원본 전체 복원·취소를 구분합니다. 원본별 작업과 History의 카메라 기록을 재개하고, 결과는 명시적으로 선택할 때만 새 출발점이 됩니다.

**짧은 시작:** 이미지 선택 → 카메라로 새 구도 → 손잡이 이동 → 다음 생성 문구의 숫자나 문장 수정 → 이 구도로 생성 → 비교·수정·복귀. 조작만으로는 생성하지 않습니다. 정확한 자세·시선·배경 고정과 물리적 3D 재현은 보장하지 않습니다. 팬·틸트·높이와 시선 실험은 불안정할 수 있습니다.

[한국어 카메라 안내](docs/CAMERA.ko.md) · [상세 3개국어 릴리즈 노트](.github/releases/v3.8.0.md)

**NovelAI로 생성하고, CHAESSI PRESET으로 관리하고, 완성하세요.** 프롬프트와 캐릭터·의상 프리셋부터 이미지 생성, 구도 변경, 인페인트, 후속 보정과 저장까지 하나의 작업대에서 이어집니다.

프리셋 선택 → 프롬프트 편집 → NovelAI 생성 → 결과 확인 → 이미지 수정·확장·보정 → History 저장 → 다음 작업에 재사용

### v3.6.0 이후 새 기능

- **구도 넓히기:** 기존 원형 붓을 유지하면서 그림을 드래그로 이동하고, 모서리·회전 손잡이로 배치합니다. 프레임 테두리를 늘리면 빈 공간이 자동 마스크가 됩니다. 기존 Inpaint에서 칠한 마스크도 그대로 전달하고, 둥근 붓으로 더 칠하거나 지웁니다.
- **생성 전 확인과 계속 편집:** 실제 전송 이미지·생성 마스크·결과 반영 영역을 확인하고 캐릭터 설명과 위치를 추가합니다. 한 응답의 원본 보존/전체 생성 결과를 비교하고, 결과를 채택해 이어 그리거나 원본으로 다른 구도를 시도합니다. History의 저장 배치와 생성 전 JSON 편집 상태도 복원할 수 있습니다.
- **Pixel Snap:** 이미 있는 픽셀아트의 격자를 로컬에서 정돈합니다. 자동 추천·신뢰도, 수동 간격/시작 위치, 팔레트·색상·투명도·가장자리, 확대 비교, PNG 저장 배율과 History 연결을 제공합니다. 계정 없이 로컬 0 Anlas입니다. 일반 사진을 새 픽셀아트로 생성하는 도구가 아니며 공식 NovelAI와 알고리즘·출력이 동일하지 않습니다.
- **공식형 해상도 선택:** Small / Normal / Large / Wallpaper / Custom과 가로·세로·정사각형, 실제 W×H를 확인하고 적용하거나 취소합니다. Wallpaper Square는 제공하지 않습니다. Custom은 64의 배수·총 3,145,728픽셀 이하이며 자동 반올림하지 않습니다. High/Medium 전환에서도 크기를 유지하고, 큰 생성은 예상 비용을 확인합니다.
- **42장 통합 도움말:** 한국어·영어·일본어로 원본 열기 → 조작 → 마스크 확인 → 처리 → 비교 → 저장·이어하기를 안내합니다. 검색·목차·문맥 이동·이미지 확대가 오프라인에서 동작합니다. 새 온실 정원사와 직접 제작한 픽셀 예제를 사용합니다.

### 생성·프리셋·후속 작업

전체/Base Prompt/Character/의상 프리셋, 카테고리·하위 카테고리, 검색·정렬, Wildcard, Character Prompt·Position을 연결해 반복 작업의 재료를 관리합니다. Save / Save As, 미저장 표시, 이전 작업 복원과 Saved revisions로 편집 상태를 되짚을 수 있습니다. 생성과 처리 결과는 별도의 History PNG로 남아 원본·설정·다음 작업에 재사용됩니다.

신규 생성은 **NovelAI V5 Full High / Medium**, Text to Image / Image to Image / 기존 원형 붓 Inpaint를 지원합니다. Seed와 Character Prompt/Position을 사용합니다. Medium은 정해진 생성 설정을 사용하며 직접 쓴 Base/Character 제외 프롬프트는 적용하지 않습니다. High로 돌아갈 때 쓸 편집 원문은 유지합니다.

서버 기반 도구: **Upscale, Enhance / Max✨ Enhance, Remove Background, Line Art, Sketch, Colorize, Emotion, Declutter, Outpainting, Focused Inpaint**. 도구별 입력·출력 크기와 사용 조건이 다릅니다. **Canvas 직접 그리기·Pixel Snap은 로컬 처리**입니다. 구도 넓히기와 서버 기반 후속 편집은 NovelAI 생성 요청을 사용합니다.

### 시작·업데이트·호환성

Windows x64 Portable EXE를 폴더에 두고 실행합니다. 설치 프로그램이나 별도 Node.js가 필요하지 않습니다. 언어를 고르고, 온라인 생성에는 API Settings에서 본인의 NovelAI 토큰을 준비하세요. 프리셋을 편집해 한 장을 생성한 뒤 이미지 도구로 계속 수정하고 PNG를 저장합니다. 조작은 앱 정보 → Help Center에서 확인하세요. 예전 v3.4.0 PDF는 과거 참고 자료입니다.

기존 전체/Base/Character/의상 프리셋·분류·Wildcard·History·언어를 유지하며 강제 전체 변환을 하지 않습니다. V4.5의 과거 프리셋·History·PNG는 읽기·편집·저장이 가능하지만 **신규 V4.5 생성은 지원하지 않습니다**. 새 생성에는 V5를 고르세요.

업데이트 전 프리셋과 편집 JSON을 저장하고 앱을 종료한 뒤 **%APPDATA%\Chaessi Preset**(사용자 지정 실행이면 실제 데이터 폴더)을 별도 복사하세요. 기존 데이터를 그대로 두고 EXE만 교체합니다. 되돌릴 때는 종료 후 **이전 EXE와 그 버전에 맞는 백업을 함께** 사용하세요. 구버전이 새 구도/처리 기록을 모두 이해한다고 가정하지 마세요. 자동 업데이트와 종료 후 미저장 편집 자동 복구는 없습니다. [업데이트·되돌리기](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/docs/UPDATING.md)

### 계정·비용·제한

앱 사용은 무료지만 NovelAI 계정·생성 권한·이용료는 별도입니다. 서버 요청에는 설정과 계정 조건에 따라 Anlas 또는 V5 Stamina가 사용될 수 있습니다. 예상값과 실제 차감이 다를 수 있으며 큰 이미지나 작은 마스크도 항상 무료가 아닙니다. 토큰·개인 History·백업을 공유하지 마세요. 실패 시 유료 자동 재시도를 하지 않습니다.

V5 Precise Reference, Vibe Transfer, ControlNet, 일반 생성용 V5 Curated 선택, 영상·다중 배치 생성은 지원하지 않습니다. 한 번에 한 장씩 생성합니다. 원본 보존은 결과 반영 영역 밖의 변환된 원본에 대한 보호이며, 모든 도구에서 원본 전체가 불변이라는 뜻은 아닙니다. 경계 연결·인원수·마커 위치·자동 격자 정확도를 보장하지 않습니다. 구도 편집은 단일 이미지 평면의 배치이며 3D 회전·다중 레이어·원근 편집기는 아닙니다.

미서명 Windows EXE여서 보안 경고가 나타날 수 있습니다. 이 저장소의 다운로드와 아래 SHA-256을 확인하세요. 보안 보호 기능을 일괄 해제하지 마세요. macOS/Linux 배포·코드 서명·자동 업데이트는 제공하지 않습니다.

<a id="user-en"></a>
## English

### v3.8.0: a camera you can calibrate and edit

Explore another composition from an existing image’s conditions. **Start with automatic tag mapping, then calibrate strength at the position you want and edit the text yourself.**

- Start from History, the latest result or readable NAI image metadata. Confirm only missing baseline information. Selecting an image does not automatically make it I2I input.
- Drag the sphere handle or choose eight directions, including both front diagonals, sides, rear diagonals and back, with intermediate positions. Adjust pan/tilt in place, height, framing, roll and output aspect ratio.
- At +40°, changing diagonal 1.1 to 1.5 keeps the camera and other weights unchanged. The correction continues at +50° and reproduces at +40°. Multiple correction points and individual removal are supported.
- Edit identity, clothing, action, background and camera text. Keep manual text or reconnect camera control. Disabling camera retains the valid current text in the ordinary workbench.
- Reset camera, disable calibration, restore the source or undo. Resume source-specific work and History camera records. A result becomes a new source only when explicitly selected.

**Quick start:** select image → Explore with camera → move a handle → edit weights or text for the next generation → Generate this view → compare, edit or restore. Controls alone never generate. Exact pose, gaze, background and physical 3D reconstruction are not guaranteed. Pan/tilt/height and the gaze experiment can be unstable.

[English camera guide](docs/CAMERA.en.md) · [Detailed trilingual release notes](.github/releases/v3.8.0.md)

**Generate with NovelAI. Organize and finish with CHAESSI PRESET.** One connected workspace for prompts, character and outfit presets, image generation, composition editing, inpainting, finishing tools, and reusable results.

Choose a preset → edit prompts → generate with NovelAI → inspect → edit, expand and finish → save in History → reuse for the next task

### Composition, pixels and image sizes

- **Expand composition:** keep the familiar round brush while dragging the picture, resizing corners and using a rotation handle. Extend frame edges to select empty space automatically. Carry the mask from existing Inpaint, then paint or erase extra areas.
- **Review and continue:** inspect the actual source, generation mask and result application area; add character descriptions and positions. Compare preserved-original and full-generated variants from one response. Adopt a result to keep painting, or try another arrangement from the source. Restore saved placement from History or reopen a JSON editing session saved before generation.
- **Pixel Snap:** locally clean up an existing pixel-art grid. Use automatic suggestions and confidence, manual spacing/offsets, palette/color/transparency/edge settings, zoomed comparison, PNG export scale and History chaining. It costs 0 Anlas and needs no account. It does not generate pixel art from ordinary photos and is independent of the official NovelAI algorithm/output.
- **Official-style image sizes:** choose Small / Normal / Large / Wallpaper / Custom and an orientation, inspect exact W×H, then apply or cancel. Wallpaper Square is unavailable. Custom uses multiples of 64 and at most 3,145,728 pixels; values are never rounded silently. High/Medium switches preserve dimensions and large generations show an estimated-cost confirmation.
- **42-chapter Help Center:** Korean, English and Japanese guides follow open → manipulate → review masks → process → compare → save/continue. Contents, search, contextual links and image zoom work offline. Fresh greenhouse-gardener and hand-coded pixel examples illustrate the workflow.

### Generation, presets and finishing

Manage full/Base Prompt/Character/outfit presets, categories/subcategories, search/sorting, Wildcards and Character Prompt/Position as reusable production assets. Save / Save As, unsaved indicators, previous-work recovery and Saved revisions help revisit edits. Generated and processed results become separate History PNGs that can be reused as sources, settings or the next editing step.

New generation supports **NovelAI V5 Full High / Medium**, Text to Image / Image to Image / existing round-brush Inpaint, Seed and Character Prompt/Position. Medium uses fixed generation settings and does not apply custom Base/Character undesired prompts. Editing text is retained for a return to High.

Server-based tools: **Upscale, Enhance / Max✨ Enhance, Remove Background, Line Art, Sketch, Colorize, Emotion, Declutter, Outpainting and Focused Inpaint**. Each has its own input/output limits and service conditions. **Canvas drawing and Pixel Snap are local**. Composition generation and server finishing tools make NovelAI requests.

### Start, update and compatibility

Place the Windows x64 Portable EXE in a folder and run it; no installer or separate Node.js is required. Choose a language and supply your own NovelAI token in API Settings for online generation. Edit a preset, generate one image, continue in image tools, then save PNG. Find current instructions in App info → Help Center. The old v3.4.0 PDFs are historical references.

Existing full/Base/Character/outfit presets, categories, Wildcards, History and language remain usable without a forced library-wide conversion. Legacy V4.5 presets, History and PNG metadata remain readable, editable and savable; **new V4.5 generation is unsupported**. Choose V5 for new generation.

Before updating, save presets and editing JSON, close the app and back up **%APPDATA%\Chaessi Preset** (or the actual customized data folder). Keep external data and replace only the EXE. To roll back, close the app and use **the old EXE together with a backup from that version**. Do not assume an old version understands every new composition/processing record. There is no automatic updater or recovery of unsaved edits after quitting. [Update and rollback](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/docs/UPDATING.md)

### Account, cost and limits

The app is free; your NovelAI account, generation access and service usage are separate. Server requests may use Anlas or V5 Stamina depending on settings and account conditions. Estimates may differ from actual debit; large images or small masks are not always free. Never share tokens, personal History or backups. Failed paid requests are not retried automatically.

V5 Precise Reference, Vibe Transfer, ControlNet, a general-generation V5 Curated selector, video and multi-image batches are unsupported. Generation makes one image at a time. Preservation protects the transformed source outside the result application area; it does not mean every tool leaves the entire original unchanged. Seams, subject counts, marker accuracy and automatic grid detection are not guaranteed. Composition editing arranges a single image plane; it is not a 3D rotation, multilayer or perspective editor.

The Windows EXE is unsigned and Windows may warn. Verify the repository download and SHA-256 below; do not disable security protections wholesale. No macOS/Linux distribution, code-signing certificate or automatic updater is provided.

<a id="user-ja"></a>
## 日本語

### v3.8.0：自分で補正・編集できるカメラ

既存画像の条件から別の構図を探します。**自動タグ変換を出発点に、希望の位置で強さを補正し、文章を直接直して構図を探せます。**

- 履歴・最新結果・読み取れる NAI 画像メタデータから開始し、不明な基準だけ確認します。画像選択だけでは I2I 入力になりません。
- 球体ハンドルと8方向ボタンで左右の前斜め・側面・後ろ斜め・背面や中間方向を選びます。その場のパン・チルト、高さ、フレーミング、ロール、出力比率も調整できます。
- +40° で前斜め 1.1 を 1.5 にしても、位置と他の重みは変わりません。+50° にも補正が続き、+40° で再現します。複数の補正点と個別の取り消しに対応します。
- 人物・服・行動・背景・カメラの文章を直接編集できます。手動の文章を優先するかカメラ管理へ再接続できます。無効化しても有効な現在の文章を通常の作業台に残します。
- カメラだけの復帰、補正解除、全体復元、取り消しを使い分けます。元画像別の作業と履歴のカメラ記録を再開でき、結果を新しい出発点にするのは明示的に選んだ場合だけです。

**まずは：** 画像選択 → カメラで構図を探す → ハンドル移動 → 次の生成文の数値や文章を編集 → この構図で生成 → 比較・修正・復帰。操作だけでは生成しません。正確な姿勢・視線・背景の固定や物理的な3D再現は保証されません。パン・チルト・高さ・視線の実験は不安定な場合があります。

[日本語カメラガイド](docs/CAMERA.ja.md) · [3言語の詳細リリースノート](.github/releases/v3.8.0.md)

**NovelAI で生成し、CHAESSI PRESET で管理して仕上げる。** プロンプトやキャラクター・衣装プリセットの管理から、画像生成、構図編集、インペイント、仕上げ、履歴の再利用まで、一つの作業環境でつなぎます。

プリセットを選ぶ → 文章を編集 → NovelAI で生成 → 確認 → 画像を修正・拡張・仕上げ → 履歴に保存 → 次の作業で再利用

### v3.6.0 からの新機能

- **構図を広げる：** 使い慣れた丸いブラシを保ち、画像をドラッグで移動し、角と回転ハンドルで配置します。枠の辺を広げると空白が自動でマスクになります。既存 Inpaint のマスクを引き継ぎ、さらに塗る・消す操作もできます。
- **確認して編集を続ける：** 実際に送る画像・生成マスク・結果の適用範囲を確認し、人物の説明と位置を追加します。同じ応答から元画像を保持した結果と生成結果全体を比較します。採用した結果で描き続けるか、元画像で別の配置を試せます。履歴の配置や、生成前に保存した JSON 編集状態も復元できます。
- **Pixel Snap：** 既存のピクセルアートのグリッドをローカルで整理します。自動推定と信頼度、間隔・位置の手動調整、パレット・色・透明度・端の処理、拡大比較、PNG 保存倍率と履歴連携に対応。アカウント不要で 0 Anlas です。写真から新しいピクセルアートを生成する機能ではなく、公式 NovelAI と内部方式・出力が同一ではない独立実装です。
- **公式形式の画像サイズ選択：** Small / Normal / Large / Wallpaper / Custom と向きを選び、実際の W×H を確認して適用・キャンセルします。Wallpaper の正方形はありません。Custom は 64 の倍数・合計 3,145,728 画素以下で、自動で丸めません。High/Medium を切り替えてもサイズを保ち、大きい生成では推定費用を確認します。
- **全42章のヘルプ：** 韓国語・英語・日本語で、開く → 操作 → マスク確認 → 処理 → 比較 → 保存・続行を案内します。目次・検索・関連リンク・画像拡大はオフライン対応。新作の温室の庭師と手作りのピクセルアートを使っています。

### 生成・プリセット・仕上げ

全体/Base Prompt/Character/衣装プリセット、カテゴリ・下位分類、検索・並べ替え、Wildcard、Character Prompt/Position を繰り返し使う制作資産として管理します。Save / Save As、未保存表示、前の作業への復帰、Saved revisions で編集を振り返れます。生成・処理結果は別の履歴 PNG として残り、元画像・設定・次の編集に再利用できます。

新規生成は **NovelAI V5 Full High / Medium**、Text to Image / Image to Image / 既存の丸いブラシ Inpaint、Seed、Character Prompt/Position に対応します。Medium は固定設定を使い、独自の Base/Character 除外文を適用しません。High に戻る際の編集原文は保持します。

サーバー処理：**Upscale、Enhance / Max✨ Enhance、Remove Background、Line Art、Sketch、Colorize、Emotion、Declutter、Outpainting、Focused Inpaint**。入力・出力の上限や利用条件はツールごとに異なります。**Canvas の直接描画と Pixel Snap はローカル処理**です。構図生成とサーバー側の仕上げは NovelAI にリクエストします。

### 開始・更新・互換性

Windows x64 Portable EXE をフォルダに置いて起動します。インストーラーや別途 Node.js は不要です。言語を選び、オンライン生成には API Settings で自分の NovelAI トークンを設定してください。プリセットを編集して1枚生成し、画像ツールで続けて修正して PNG を保存します。最新手順はアプリ情報 → Help Center。旧 v3.4.0 PDF は過去の参考資料です。

既存の全体/Base/Character/衣装プリセット・分類・Wildcard・履歴・言語を引き継ぎ、ライブラリ全体の強制変換は行いません。旧 V4.5 プリセット・履歴・PNG 情報は読込・編集・保存できますが、**新規 V4.5 生成は非対応**です。新規生成には V5 を選びます。

更新前にプリセットと編集 JSON を保存し、終了して **%APPDATA%\Chaessi Preset**（独自設定なら実際のデータ先）をバックアップします。外部データを残し、EXE だけを交換してください。戻す場合は終了後、**旧 EXE とその版のバックアップを一緒に**使います。旧版が新しい構図・処理履歴をすべて理解するとは限りません。自動更新や終了後の未保存編集の自動復元はありません。 [更新と復元](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/docs/UPDATING.md)

### アカウント・費用・制限

アプリは無料ですが、NovelAI アカウント・生成権限・サービス利用料は別途必要です。サーバー処理は設定とアカウント条件により Anlas または V5 Stamina を使います。推定と実際の消費は異なる場合があり、大きい画像や小さいマスクが常に無料とは限りません。トークン・個人履歴・バックアップを共有しないでください。有料リクエストを失敗時に自動再試行しません。

V5 Precise Reference、Vibe Transfer、ControlNet、通常生成用 V5 Curated 選択、動画・複数画像の一括生成は非対応です。生成は1回1枚です。保持は結果の適用範囲外にある変換後の元画像を保護する意味で、全ツールが元画像全体を不変にするわけではありません。境界・人数・マーカー位置・自動グリッドの正確さは保証しません。構図編集は1枚の画像平面の配置であり、3D 回転・多層・遠近編集ではありません。

Windows EXE は未署名のため警告が出る場合があります。このリポジトリの配布先と下記 SHA-256 を確認し、保護機能を一括で無効にしないでください。macOS/Linux 版、コード署名証明書、自動更新は提供しません。

<a id="developer-ko"></a>
## 개발자용 — 한국어

소스 개발은 Windows x64, Node.js 22 이상과 npm을 사용합니다. 일반 사용자는 Portable EXE만 실행하면 됩니다. package.json의 버전이 기준이며 npm 빌드는 브라우저 버전 상수를 동기화합니다. 로컬 서버는 127.0.0.1에 바인딩하고 자격 증명은 서버/Electron 안전 저장소에서 처리합니다. 공개 예제에는 개인 데이터와 실제 토큰을 넣지 마세요.

```powershell
npm ci
npm run electron:dev
node --test tests/*.test.mjs
node scripts/run-regressions.mjs
npm run electron:dist
```

[개발·검증·패키징 상세](DEVELOPMENT.md#developer-ko) · [MIT](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Asset provenance](assets/manuals/ASSET_NOTICES.md)

<a id="developer-en"></a>
## Developer Guide — English

Source development uses Windows x64, Node.js 22+ and npm. End users only need the Portable EXE. package.json is the version source; npm build hooks synchronize the browser version constant. The local server binds to 127.0.0.1 and credentials are handled server-side with Electron secure storage. Keep real tokens and personal data out of public examples.

```powershell
npm ci
npm run electron:dev
node --test tests/*.test.mjs
node scripts/run-regressions.mjs
npm run electron:dist
```

[Development, verification and packaging](DEVELOPMENT.md#developer-en) · [MIT](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Asset provenance](assets/manuals/ASSET_NOTICES.md)

<a id="developer-ja"></a>
## 開発者ガイド — 日本語

ソース開発は Windows x64、Node.js 22 以上、npm を使用します。通常利用は Portable EXE のみで可能です。package.json を版の基準とし、npm のビルド処理でブラウザーの版定数を同期します。ローカルサーバーは 127.0.0.1 のみに接続し、認証はサーバーと Electron 安全ストレージで処理します。公開例に実トークンや個人データを含めないでください。

```powershell
npm ci
npm run electron:dev
node --test tests/*.test.mjs
node scripts/run-regressions.mjs
npm run electron:dist
```

[開発・検証・パッケージ詳細](DEVELOPMENT.md#developer-ja) · [MIT](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Asset provenance](assets/manuals/ASSET_NOTICES.md)
