const rows=`
Fine tuning	세부 조정	詳細調整
Image size	이미지 크기	画像サイズ
Choose a size, then an orientation.	크기와 가로·세로 방향을 선택하세요.	サイズと向きを選んでください。
Small	작게	小
Normal	보통	標準
Large	크게	大
Wallpaper	배경화면	壁紙
Custom	직접 입력	カスタム
Landscape	가로	横長
Portrait	세로	縦長
Square	정사각형	正方形
Not available	지원하지 않음	利用不可
Apply size	이 크기 적용	サイズを適用
Swap width and height	가로·세로 바꾸기	縦横を交換
This exact size will be used for generation.	표시된 크기 그대로 생성합니다.	表示されたサイズで生成します。
Choose Landscape or Portrait for Wallpaper.	배경화면은 가로 또는 세로를 선택하세요.	壁紙は横長か縦長を選んでください。
Larger images may cost Anlas. Review the estimate before generating.	큰 이미지는 Anlas가 소모될 수 있습니다. 생성 전 예상 비용을 확인하세요.	大きな画像はAnlasを消費する場合があります。生成前に見積もりを確認してください。
Width and height must be whole numbers of at least 64 pixels.	가로와 세로는 64 이상인 정수여야 합니다.	幅と高さは64以上の整数にしてください。
Width and height must be multiples of 64. Values are not rounded automatically.	가로와 세로는 64의 배수여야 합니다. 자동으로 반올림하지 않습니다.	幅と高さは64の倍数にしてください。自動で丸めません。
The image must contain no more than 3,145,728 pixels.	전체 픽셀 수가 3,145,728 이하여야 합니다.	総ピクセル数は3,145,728以下にしてください。
Generate {width} × {height} at {effort}? Estimated {cost} Anlas.	{width} × {height} · {effort}로 생성할까요? 예상 비용은 {cost} Anlas입니다.	{width} × {height}・{effort}で生成しますか？推定{cost} Anlasです。
Clean up an existing pixel-art grid. Local processing · 0 Anlas.	기존 픽셀 아트의 격자를 정돈합니다. 로컬 처리 · 0 Anlas.	既存のピクセルアートを整えます。ローカル処理・0 Anlas。
Suggest grid	격자 추천	グリッドを推定
Use suggested grid	추천 격자 적용	推定グリッドを適用
Grid width	가로 격자 간격	横グリッド間隔
Grid height	세로 격자 간격	縦グリッド間隔
X offset	가로 시작 위치	横オフセット
Y offset	세로 시작 위치	縦オフセット
Click a pixel boundary in the original to set the grid offset.	원본의 픽셀 경계를 클릭하면 격자 시작 위치를 맞춥니다.	元画像のピクセル境界をクリックして位置を合わせます。
Edge cells	가장자리 격자	端のセル
Keep partial edge cells	잘린 가장자리 격자도 유지	端の不完全なセルを保持
Crop partial edge cells	완전한 격자만 남기기	完全なセルだけ残す
Palette	팔레트	パレット
Keep source colors	원본 색 유지	元の色を保持
Automatic palette reduction	색 수 자동 줄이기	色数を自動で削減
Limit colors	최대 색 수 지정	色数を指定
Maximum colors	최대 색 수	最大色数
Alpha	투명도	透明度
Keep transparency	원본 투명도 유지	元の透明度を保持
Binary transparency	불투명·투명으로 정리	不透明・透明に整理
Alpha threshold	투명도 기준값	透明度のしきい値
PNG export scale	저장할 PNG 배율	保存PNGの倍率
Grid {logical}; PNG {output}	논리 격자 {logical} · 저장 PNG {output}	論理グリッド {logical}・保存PNG {output}
Reset settings	설정 초기화	設定をリセット
Preview Pixel Snap	Pixel Snap 미리보기	Pixel Snapプレビュー
Cancel processing	처리 취소	処理をキャンセル
Save result to History	결과를 History에 저장	結果を履歴に保存
View zoom	화면 확대	表示倍率
Show pixel grid	픽셀 격자 표시	ピクセルグリッドを表示
Original	원본	元画像
Pixel Snap result	Pixel Snap 결과	Pixel Snapの結果
Both previews use crisp nearest-neighbor display. Export scale changes the saved PNG; view zoom does not.	미리보기는 픽셀 경계를 선명하게 표시합니다. 저장 배율은 PNG 크기를 바꾸고, 화면 확대는 보기만 바꿉니다.	プレビューはピクセルを鮮明に表示します。保存倍率はPNGサイズを、表示倍率は表示だけを変更します。
Still PNG only. Processing uses decoded 8-bit sRGB; the original file is kept unchanged.	정지 PNG를 지원합니다. 처리 결과는 8비트 sRGB이며, 원본 파일은 그대로 보존합니다.	静止PNGに対応。処理結果は8ビットsRGBで、元ファイルはそのまま保持します。
Preview after changing settings.	설정을 바꾼 뒤 미리보기를 눌러주세요.	設定変更後にプレビューしてください。
Choose a grid or request a suggestion.	격자를 직접 맞추거나 격자 추천을 눌러주세요.	グリッドを設定するか推定してください。
Analyzing pixel grid…	픽셀 격자 분석 중…	ピクセルグリッドを解析中…
Processing locally…	로컬 처리 중…	ローカル処理中…
Suggested {x} × {y}; confidence {confidence}	추천 간격 {x} × {y} · 신뢰도 {confidence}	推定間隔 {x} × {y}・信頼度 {confidence}
Low	낮음	低
Grid is uncertain. Set grid size and offset manually.	격자가 불확실합니다. 간격과 시작 위치를 직접 조절하세요.	グリッドが不確かです。間隔と位置を手動で調整してください。
Review the suggestion before applying it.	추천 격자를 확인한 뒤 적용하세요.	推定を確認してから適用してください。
Preview ready. The original is unchanged.	미리보기가 준비됐습니다. 원본은 유지됩니다.	プレビューの準備完了。元画像は変更されません。
Pixel Snap failed. Try a smaller PNG.	Pixel Snap 처리에 실패했습니다. 더 작은 PNG로 시도하세요.	Pixel Snapに失敗しました。小さいPNGで試してください。
Processing canceled. The original is unchanged.	처리를 취소했습니다. 원본은 유지됩니다.	処理をキャンセルしました。元画像は変更されません。
Pixel Snap saved to History. 0 Anlas.	Pixel Snap 결과를 History에 저장했습니다. 0 Anlas.	Pixel Snapを履歴に保存しました。0 Anlas。
Offsets must be smaller than their grid sizes.	시작 위치는 해당 격자 간격보다 작아야 합니다.	オフセットはグリッド間隔より小さくしてください。
Pixel Snap supports up to 16 megapixels and 16,384 pixels per side.	Pixel Snap은 최대 1,677만 픽셀, 한 변 16,384픽셀까지 지원합니다.	Pixel Snapは最大16メガピクセル、一辺16,384ピクセルに対応します。
Choose a PNG no larger than 64 MB.	64MB 이하의 PNG를 선택하세요.	64MB以下のPNGを選んでください。
Animated PNG is not supported. Choose a still PNG.	움직이는 PNG는 지원하지 않습니다. 정지 PNG를 선택하세요.	アニメーションPNGは非対応です。静止PNGを選んでください。
Incomplete PNG.	PNG 파일이 불완전합니다.	PNGファイルが不完全です。
No complete cell fits. Keep partial edge cells or reduce the grid size.	완전한 격자가 남지 않습니다. 가장자리 격자를 유지하거나 간격을 줄이세요.	完全なセルが残りません。端のセルを保持するか間隔を小さくしてください。
`.trim().split('\n');
export const pixelResolutionMessages=Object.fromEntries(rows.map(row=>{const [en,ko,ja]=row.split('\t');return [en,{en,ko,ja}];}));
