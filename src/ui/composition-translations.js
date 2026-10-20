const rows = `
Empty space	빈 영역: 자동 선택	空白：自動選択
Hand-painted mask	붓으로 직접 칠한 영역	ブラシで手塗りした範囲
Expand composition	구도 넓히기	構図を広げる
Paint to edit	붓으로 수정	ブラシで修正
Draw pixels	직접 그리기	直接描く
Arrange picture	그림 배치	画像を配置
Extend frame	테두리 늘리기	枠を広げる
Round brush	둥근 붓	丸いブラシ
Erase mask	칠한 곳 지우기	塗った範囲を消す
Character positions	캐릭터 위치	キャラクター位置
Pan view	화면 이동	表示を移動
Fit view	화면에 맞춤	全体表示
Composition tools	구도 편집 도구	構図編集ツール
Composition canvas	구도 편집 화면	構図編集画面
Clear hand-painted mask	직접 칠한 영역 지우기	手塗り範囲をクリア
View	화면	表示
Resize picture	그림 크기 조절	画像サイズを調整
Rotate picture	그림 회전	画像を回転
Arrange the picture, fill empty space, and touch up with the round brush.	그림을 배치하고 빈 곳을 채운 뒤, 둥근 붓으로 원하는 부분을 수정하세요.	画像を配置して空白を埋め、丸いブラシで修正します。
Drag the picture. Corner circles resize it; the top handle rotates it.	그림을 드래그해 이동하세요. 모서리 원은 크기, 위쪽 손잡이는 회전입니다.	画像をドラッグして移動。角の丸でサイズ、上のハンドルで回転します。
Drag an edge handle to open space. The blue empty area will be generated.	가장자리 손잡이를 끌어 여백을 만드세요. 파란 빈 영역이 생성됩니다.	辺のハンドルをドラッグして余白を作ります。青い空白が生成されます。
Paint additional areas with the round brush. Empty space is already selected.	추가로 바꿀 곳을 둥근 붓으로 칠하세요. 빈 영역은 이미 자동 선택되어 있습니다.	追加で変える部分を丸いブラシで塗ります。空白は自動選択されています。
Erase hand-painted areas. Empty space stays selected automatically.	직접 칠한 부분을 지웁니다. 빈 영역의 자동 선택은 유지됩니다.	手塗り部分を消します。空白の自動選択は維持されます。
Drag a numbered marker. New characters stay attached to the output frame.	번호 마커를 드래그하세요. 새 캐릭터는 출력 화면에 붙어 있습니다.	番号マーカーをドラッグ。新キャラクターは出力枠に固定されます。
Drag to move the view. The wheel zooms the view without resizing the picture.	드래그로 화면을 이동하세요. 휠은 그림 크기를 바꾸지 않고 화면만 확대합니다.	ドラッグで表示を移動。ホイールは画像サイズを変えず表示だけ拡大します。
Choose image	이미지 선택	画像を選ぶ
Save editing session	편집 상태 저장	編集状態を保存
Open editing session	편집 상태 열기	編集状態を開く
Size and placement	크기·배치 숫자 조절	サイズ・配置の数値調整
Apply output size	출력 크기 적용	出力サイズを適用
Picture scale (%)	그림 배율 (%)	画像倍率 (%)
Angle (°)	각도 (°)	角度 (°)
Apply placement	배치 적용	配置を適用
Center original picture	원래 크기로 가운데 배치	元のサイズで中央配置
Scene prompt	장면 프롬프트	シーンプロンプト
Changes here apply only to this composition.	여기서 바꾼 프롬프트는 이 구도 작업에만 적용됩니다.	ここでの変更はこの構図にのみ適用されます。
Undesired content	제외할 내용	除外する内容
Copy current workbench prompt	작업창 프롬프트 가져오기	作業画面のプロンプトをコピー
Place a new character in the blue area or paint space for it.	새 인물은 파란 영역에 배치하거나, 들어갈 자리를 붓으로 칠하세요.	新人物は青い部分に配置するか、必要な場所を塗ってください。
Use marker positions	마커 위치 사용	マーカー位置を使用
Attached to frame	출력 화면에 고정	出力枠に固定
Follows picture	그림을 따라 이동	画像と一緒に移動
Enable character	캐릭터 사용	キャラクターを有効化
Add character	캐릭터 추가	キャラクターを追加
Character prompt	캐릭터 프롬프트	キャラクタープロンプト
Generation settings	생성 설정	生成設定
Completed result	완성된 결과	完成した結果
Save PNG	PNG 저장	PNGを保存
Blend boundary (px)	경계 연결 폭 (px)	境界の接続幅 (px)
The original interior is preserved. The selected area and boundary can change.	원본 내부는 보존합니다. 선택 영역과 경계 연결 부분은 바뀔 수 있습니다.	元画像の内側を保持。選択範囲と境界は変更されます。
Review image and mask	이미지·마스크 확인	画像・マスクを確認
Generate expanded image	이 구도로 생성	この構図で生成
Ready to send	전송 준비 확인	送信内容を確認
These are the exact image and mask prepared for this generation. White areas can change.	이번 생성에 실제로 보낼 이미지와 마스크입니다. 흰색 영역이 변경 대상입니다.	実際に送信する画像とマスクです。白い部分が変更対象です。
Prepared source	전송할 원본	送信用画像
Source image	원본 이미지	元画像
Generation mask	생성 마스크	生成マスク
Result application mask	결과 반영 영역	結果の適用範囲
Saved result	저장된 결과	保存した結果
Preserved original	원본 보존 결과	元画像を保持した結果
Full generated result	전체 생성 결과	生成結果全体
Use result and keep editing	결과 채택 후 이어서 수정	結果を採用して編集を続ける
Try another arrangement	원본으로 다른 구도 시도	元画像で別の構図を試す
Adopting the result starts a fresh brush session. The original arrangement stays in History.	결과를 채택하면 새 붓 작업을 시작합니다. 원래 배치는 History에 남습니다.	結果を採用すると新しいブラシ編集が始まります。元の配置は履歴に残ります。
Review after editing.	편집 후 이미지·마스크를 확인하세요.	編集後に画像・マスクを確認してください。
Choose an image first.	먼저 이미지를 선택하세요.	最初に画像を選んでください。
Replace the current composition? Save the editing session to keep it.	현재 구도를 바꿀까요? 보관하려면 먼저 편집 상태를 저장하세요.	現在の構図を置き換えますか？残す場合は先に編集状態を保存してください。
Reviewed. Generate when the image and white mask match your intent.	확인되었습니다. 이미지와 흰색 영역이 의도와 맞으면 생성하세요.	確認済み。画像と白い範囲が意図どおりなら生成してください。
Reopen saved arrangement	저장된 배치 다시 편집	保存した配置を再編集
Review image and mask before generating.	생성 전에 이미지와 마스크를 확인하세요.	生成前に画像とマスクを確認してください。
`.trim().split('\n');
export const compositionMessages = Object.fromEntries(rows.map(row=>{const [en,ko,ja]=row.split('\t');return [en,{en,ko,ja}];}));
