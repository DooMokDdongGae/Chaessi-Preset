# Updating to v3.8.0 / 업데이트 / 更新

## 한국어

업데이트 전 프리셋과 편집 JSON을 저장하고 앱을 종료한 뒤 **%APPDATA%\Chaessi Preset**(사용자 지정 실행이면 실제 데이터 폴더)을 별도 복사하세요. 기존 데이터를 그대로 두고 EXE만 교체합니다. 되돌릴 때는 종료 후 **이전 EXE와 그 버전에 맞는 백업을 함께** 사용하세요. 구버전이 새 구도/처리 기록을 모두 이해한다고 가정하지 마세요. 자동 업데이트와 종료 후 미저장 편집 자동 복구는 없습니다.

기존 전체/Base/Character/의상 프리셋·분류·Wildcard·History·언어를 유지하며 강제 전체 변환을 하지 않습니다. V4.5의 과거 프리셋·History·PNG는 읽기·편집·저장이 가능하지만 **신규 V4.5 생성은 지원하지 않습니다**. 새 생성에는 V5를 고르세요.

데이터 폴더의 data/에는 전체·Base·Character·의상 프리셋, 카테고리, Wildcard와 History가 있습니다. secure-store 등 나머지 프로필도 함께 백업하세요. 앱이 실행 중이면 복사가 불완전할 수 있습니다. 백업을 공개하거나 다른 사람에게 보내지 마세요. 암호화 토큰은 PC에 연결되어 다른 PC에서 다시 입력해야 할 수 있습니다.

v3.7.0으로 돌아갈 때는 [v3.7.0 Portable](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.7.0) 와 업데이트 전 백업을 함께 사용하세요. v3.8.0 JSON·새 도구 상태는 구버전에서 복원되지 않을 수 있습니다.

미서명 Windows EXE여서 보안 경고가 나타날 수 있습니다. 이 저장소의 다운로드와 Release의 SHA-256을 확인하세요. 보안 보호 기능을 일괄 해제하지 마세요. macOS/Linux 배포·코드 서명·자동 업데이트는 제공하지 않습니다.

## English

Before updating, save presets and editing JSON, close the app and back up **%APPDATA%\Chaessi Preset** (or the actual customized data folder). Keep external data and replace only the EXE. To roll back, close the app and use **the old EXE together with a backup from that version**. Do not assume an old version understands every new composition/processing record. There is no automatic updater or recovery of unsaved edits after quitting.

Existing full/Base/Character/outfit presets, categories, Wildcards, History and language remain usable without a forced library-wide conversion. Legacy V4.5 presets, History and PNG metadata remain readable, editable and savable; **new V4.5 generation is unsupported**. Choose V5 for new generation.

The data/ folder holds full/Base/Character/outfit presets, categories, Wildcards and History. Back up the rest of the profile, including secure-store, as well. Close the app first to obtain a consistent copy. Never publish or share the backup. Encrypted credentials may be tied to this PC and require re-entry on another PC.

To return to v3.7.0, use [v3.7.0 Portable](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.7.0) together with the pre-update backup. v3.8.0 JSON and new tool states may not restore in the old version.

The Windows EXE is unsigned and Windows may warn. Verify the repository download and SHA-256 on the Release; do not disable security protections wholesale. No macOS/Linux distribution, code-signing certificate or automatic updater is provided.

## 日本語

更新前にプリセットと編集 JSON を保存し、終了して **%APPDATA%\Chaessi Preset**（独自設定なら実際のデータ先）をバックアップします。外部データを残し、EXE だけを交換してください。戻す場合は終了後、**旧 EXE とその版のバックアップを一緒に**使います。旧版が新しい構図・処理履歴をすべて理解するとは限りません。自動更新や終了後の未保存編集の自動復元はありません。

既存の全体/Base/Character/衣装プリセット・分類・Wildcard・履歴・言語を引き継ぎ、ライブラリ全体の強制変換は行いません。旧 V4.5 プリセット・履歴・PNG 情報は読込・編集・保存できますが、**新規 V4.5 生成は非対応**です。新規生成には V5 を選びます。

data/ には全体・Base・Character・衣装プリセット、分類、Wildcard、履歴があります。secure-store を含む他のプロファイルも一緒に保存します。整合性のあるコピーのため、先にアプリを終了してください。バックアップを公開・共有しないでください。暗号化認証は PC に結び付くため、別 PC では再入力が必要な場合があります。

v3.7.0 に戻す場合は [v3.7.0 Portable](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.7.0) と更新前のバックアップを一緒に使います。v3.8.0 の JSON や新しいツール状態は旧版で復元できない場合があります。

Windows EXE は未署名のため警告が出る場合があります。このリポジトリの配布先とRelease の SHA-256 を確認し、保護機能を一括で無効にしないでください。macOS/Linux 版、コード署名証明書、自動更新は提供しません。

## Camera work / 카메라 작업 / カメラ作業

카메라 작업과 원본별 보정은 프로필의 `data/camera`에, 생성 당시 기록은 History의 `camera_context`에 보관됩니다. 앱을 종료한 뒤 프로필 전체를 백업하세요. PNG/WebP 파일만 복사하면 모든 보정 기록이 함께 이동하는 것은 아닙니다. v3.7.0은 이 기능을 지원하지 않습니다.

Camera sessions and per-source corrections live in the profile’s `data/camera`; generation snapshots are saved in History as `camera_context`. Close the app and back up the whole profile. Copying only a PNG/WebP does not carry every correction. v3.7.0 does not support this feature.

カメラ作業と元画像別の補正はプロファイルの `data/camera`、生成時の記録は履歴の `camera_context` に保存されます。終了後にプロファイル全体をバックアップしてください。PNG/WebP だけのコピーでは全補正は移りません。v3.7.0 はこの機能に対応していません。
