# v3.8.2 — 업데이트 · Updating · 更新

## 한국어

1. 편집을 저장하고 실행 중인 모든 버전을 종료합니다.
2. 기본 데이터 폴더 `%APPDATA%\Chaessi Preset` 전체를 별도로 백업합니다. 저장 위치를 바꾼 경우 실제 폴더를 백업하세요.
3. 공식 Release에서 EXE와 SHA256SUMS.txt를 받고 체크섬을 확인합니다. 데이터를 지우지 말고 EXE만 교체합니다.
4. 새 EXE를 실행합니다. 같은 데이터 폴더를 여러 버전에서 동시에 열지 마세요. 이전 버전으로 돌아갈 때는 그 버전의 EXE와 대응하는 백업을 함께 사용합니다.

기존 프리셋, 캐릭터·의상, 분류, Wildcard, 설정, 이미지와 History는 유지됩니다. 기존 데이터를 일괄 변환하지 않습니다. 구형 카메라 정보는 History에서 읽을 수 있지만 이전 세션·보정값의 편집·재실행·변환은 지원하지 않습니다. 이전 카메라 작업을 실행하려면 v3.8.1과 해당 버전의 데이터 백업을 사용하세요. V4.5 자료는 읽기·편집·저장할 수 있으며 새 생성에는 V5를 선택해야 합니다.

이미지나 History에서 새 카메라를 시작하면 정면 0°의 T2I로 시작합니다. 저장된 v3.8.2 카메라 작업을 직접 재개하면 저장한 각도·문구를 복원합니다. 앱 재시작 후 자동으로 재개하지 않으며 입력 이미지와 마스크는 카메라 작업에 저장하지 않습니다. I2I/Inpaint로 작업할 때는 따로 준비하세요.

다른 이름으로 저장은 별도 프리셋을 만듭니다. 자동 업데이트나 종료 후 미저장 편집의 자동 복구는 제공하지 않습니다. 토큰·개인 History·원본 프롬프트·전체 데이터 폴더를 공유하지 마세요.

이 문서와 온라인 도움말은 v3.8.2 사용법을 최신 상태로 유지합니다. 배포된 EXE 안의 도움말과 소스 태그에 고정된 문서는 배포 당시 내용으로 보존됩니다.

[Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.8.2) · [README](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/README.ko.md) · [Camera](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/docs/CAMERA.ko.md)

## English

1. Save edits and close all running versions.
2. Back up the whole data folder, normally `%APPDATA%\Chaessi Preset`. If you changed the location, back up the actual folder.
3. Download the EXE and SHA256SUMS.txt from the official Release and verify the checksum. Replace the EXE while keeping your data.
4. Run the new EXE. Do not open the same data folder in multiple versions at once. To roll back, use the earlier EXE together with its matching backup.

Existing presets, characters/outfits, categories, Wildcards, settings, images and History remain available without a forced batch conversion. Legacy camera details can be read in History, but old sessions/calibration cannot be edited, rerun or converted. Use v3.8.1 with a matching data backup to run earlier camera work. V4.5 records remain readable, editable and saveable; select V5 for new generation.

Starting a new camera from an image or History starts in T2I at front 0°. Explicitly resuming saved v3.8.2 camera work restores its angles and wording. Work does not resume automatically after restart. Camera work does not save input images or masks: prepare those separately for I2I/Inpaint.

Save As creates a separate preset. Automatic updates and recovery of unsaved edits after exit are unavailable. Never share tokens, personal History, original prompts or the full data folder.

This document and online help are maintained for v3.8.2. Help inside the released EXE and documents fixed to the source tag retain their release-time content.

[Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.8.2) · [README](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/README.en.md) · [Camera](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/docs/CAMERA.en.md)

## 日本語

1. 編集を保存し、起動中のすべてのバージョンを終了します。
2. データフォルダ全体を別途バックアップします。既定は `%APPDATA%\Chaessi Preset` です。保存先を変えている場合は実際のフォルダを使ってください。
3. 公式ReleaseからEXEとSHA256SUMS.txtを取得し、チェックサムを確認します。データを削除せずEXEだけを交換します。
4. 新しいEXEを実行します。同じデータフォルダを複数のバージョンで同時に開かないでください。旧版に戻すときは、その版のEXEと対応するバックアップを併用します。

既存のプリセット、人物・衣装、分類、Wildcard、設定、画像、履歴は保持し、一括強制変換しません。旧カメラ情報は履歴で読めますが、旧セッション・補正値の編集・再実行・変換には対応しません。以前のカメラ作業を実行するにはv3.8.1と対応するデータバックアップを使ってください。V4.5資料は読み込み・編集・保存でき、新しい生成にはV5を選びます。

画像や履歴から新しいカメラを始めると、正面0°のT2Iで開始します。保存済みのv3.8.2カメラ作業を明示的に再開すると角度と文章を復元します。再起動後の自動再開はありません。入力画像とマスクはカメラ作業に保存しないため、I2I/Inpaintでは別途準備してください。

名前を付けて保存は別のプリセットを作ります。自動更新と終了後の未保存編集の自動復旧はありません。トークン・個人履歴・原文・データフォルダ全体を共有しないでください。

この文書とオンラインヘルプはv3.8.2向けに更新します。配布済みEXE内のヘルプとソースタグに固定された文書は、公開時の内容を保持します。

[Release](https://github.com/DooMokDdongGae/Chaessi-Preset/releases/tag/v3.8.2) · [README](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/README.ja.md) · [Camera](https://github.com/DooMokDdongGae/Chaessi-Preset/blob/main/docs/CAMERA.ja.md)
