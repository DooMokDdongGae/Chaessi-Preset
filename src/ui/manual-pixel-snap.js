export const pixelSnapChapter={id:'tool-pixel-snap',image:'pixel-snap',illustrations:[{screenshot:'pixel-snap-detail',caption:{ko:'동일한 새 픽셀 아트의 실제 400% 확대 비교입니다. 화면 확대와 PNG 저장 배율은 별개입니다.',en:'An actual 400% comparison of the same new pixel artwork. View zoom and PNG export scale are separate.',ja:'同じ新作ピクセルアートの実際の400%比較。表示倍率とPNG保存倍率は別です。'}}],
  ko:['Pixel Snap: 픽셀 아트 격자 정돈','이미 있는 픽셀 아트의 흐릿하거나 어긋난 격자를 정돈합니다. 일반 그림을 새 픽셀 아트로 생성하는 도구는 아닙니다.',[
    '이미지 도구 → Pixel Snap에서 PNG를 엽니다. 계정이나 토큰 없이 로컬에서 처리하며 비용은 0 Anlas입니다.',
    '격자 추천을 누르고 신뢰도를 확인한 뒤 추천 격자 적용을 누릅니다. 불확실하면 가로·세로 간격과 시작 위치를 직접 맞춥니다. 원본의 픽셀 경계를 클릭해 시작 위치를 정할 수 있습니다.',
    '미리보기에서 원본과 결과를 비교합니다. 화면 확대는 보기만 바꾸고, 저장할 PNG 배율은 논리 픽셀을 정수 배율로 확대합니다. 세부 조정에서 팔레트와 투명도, 잘린 가장자리 처리를 고를 수 있습니다.',
    'PNG 저장으로 내보내거나 결과를 History에 저장합니다. History 저장 후 다른 도구나 I2I/Inpaint로 이어갈 수 있습니다. 설정 되돌리기와 처리 취소는 원본을 바꾸지 않습니다. 공식 Pixel Snap과 같은 격자 정돈 목적의 독립 구현이며, 옵션이나 결과가 완전히 같지는 않습니다.'
  ],'정지 PNG, 최대 64MB·1,677만 픽셀·한 변 16,384픽셀을 지원합니다. 결과는 8비트 sRGB입니다. 혼합 격자·심한 흐림·일반 사진의 자동 추천은 정확하지 않을 수 있으므로 확대해서 확인하세요. 원본 색 유지도 셀 대표색을 선택하므로 작은 디테일이 바뀔 수 있습니다.'],
  en:['Pixel Snap: clean up a pixel-art grid','Clean up blurry or uneven cells in existing pixel art. This does not generate new pixel art from an ordinary illustration.',[
    'Open Image tools → Pixel Snap and choose a PNG. Processing is local, requires no account or token and costs 0 Anlas.',
    'Suggest a grid, check its confidence, then use the suggestion. If uncertain, adjust horizontal/vertical spacing and offsets manually. Click a pixel boundary in the original to set the offset.',
    'Preview and compare original and result. View zoom changes only the display; PNG export scale enlarges logical pixels by an integer. Fine tuning offers palette, transparency and partial-edge-cell options.',
    'Save PNG directly or save the result to History. From History, continue with another tool or I2I/Inpaint. Undo settings or cancel processing without modifying the original. This independent implementation shares the official Pixel Snap grid-cleanup purpose, but its options and output are not identical.'
  ],'Still PNG only, up to 64 MB, 16 megapixels and 16,384 pixels per side. Output is 8-bit sRGB. Mixed grids, heavy blur and photographs can confuse detection; inspect at high zoom. Keeping source colors still selects one representative per cell, which can change small details.'],
  ja:['Pixel Snap：ピクセルアートのグリッド整理','既存のピクセルアートのぼやけたセルや不揃いなグリッドを整えます。通常のイラストから新しいピクセルアートを生成する機能ではありません。',[
    '画像ツール → Pixel Snap でPNGを開きます。アカウントやトークンなしでローカル処理し、費用は0 Anlasです。',
    'グリッドを推定し、信頼度を確認して適用します。不確かな場合は縦横の間隔と位置を手動で調整します。元画像のピクセル境界をクリックすると位置を合わせられます。',
    '元画像と結果を比較します。表示倍率は表示だけ、保存倍率は論理ピクセルを整数倍に拡大します。詳細調整ではパレット、透明度、端の不完全なセルを設定できます。',
    'PNG保存か履歴への保存を選びます。履歴保存後は別ツールやI2I/Inpaintで続けられます。設定を元に戻す操作や処理キャンセルで元画像は変更されません。公式Pixel Snapと同じグリッド整理を目的とした独立実装ですが、設定や結果は同一ではありません。'
  ],'静止PNG、最大64MB・16メガピクセル・一辺16,384ピクセルに対応。結果は8ビットsRGBです。混合グリッド、強いぼけ、写真では推定が不正確になる場合があります。拡大して確認してください。元の色を保持する設定でもセルごとの代表色を選ぶため、細部は変わる場合があります。']};

export function updateResolutionGuide(chapters){
  const c=chapters.find(c=>c.id==='settings');
  c.image='resolution-picker';
  c.illustrations=[{screenshot:'resolution-custom',caption:{ko:'직접 입력에서 실제 픽셀 크기를 확인합니다. 적용은 반영하고 취소는 이전 값을 유지합니다.',en:'Custom shows exact pixels. Apply changes the workbench; Cancel preserves the previous size.',ja:'カスタムで実際の画素数を確認。適用で変更し、キャンセルは前のサイズを維持します。'}}];
  c.ko[2][0]='아래 이미지 크기를 눌러 작게·보통·크게·배경화면과 가로·세로·정사각형을 고릅니다. 표시된 실제 픽셀 크기를 확인하고 적용하세요. 직접 입력은 64의 배수, 총 3,145,728픽셀 이하여야 하며 자동 반올림하지 않습니다.';
  c.en[2][0]='Press Image size in the bottom bar. Choose Small, Normal, Large or Wallpaper and an orientation, then apply the displayed pixel size. Custom dimensions must be multiples of 64 and total at most 3,145,728 pixels; values are never rounded automatically.';
  c.ja[2][0]='下の画像サイズを押し、小・標準・大・壁紙と向きを選び、実際のピクセル数を確認して適用します。カスタムは64の倍数、総3,145,728ピクセル以下で、自動では丸めません。';
  c.ko[3]+=' 배경화면 정사각형은 지원하지 않습니다. 1,048,576픽셀을 넘는 크기는 생성 전 예상 Anlas 확인창이 나옵니다. High/Medium을 바꿔도 크기는 유지됩니다. 이미지 기반 모드는 원본 크기를 사용합니다.';
  c.en[3]+=' Wallpaper has no square preset. Sizes above 1,048,576 pixels require an estimated-Anlas confirmation before generation. High/Medium changes preserve size. Source-image modes use the source dimensions.';
  c.ja[3]+=' 壁紙の正方形はありません。1,048,576ピクセルを超えるサイズは生成前に推定Anlasを確認します。High/Mediumを変更してもサイズは維持します。画像入力モードは元画像のサイズを使います。';
}
