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
  c.image='resolution-v385';
  c.illustrations=[{screenshot:'resolution-custom',caption:{ko:'직접 입력 예시(v3.8.1). 가로와 세로를 확인한 뒤 적용하거나 취소할 수 있습니다.',en:'Custom size example from v3.8.1. Check the width and height, then apply or cancel.',ja:'v3.8.1のカスタムサイズの例です。幅と高さを確認して適用するか、キャンセルできます。'}}];
  c.imageNote = {
    ko: 'v3.8.5의 보통 크기 5개입니다. 기본 세로(832 × 1216)가 선택되어 있습니다.',
    en: 'The five Large sizes in v3.8.5. Tall portrait (960 × 1664) is selected.',
    ja: 'v3.8.5の「大」で選べる5つのサイズです。ロング縦長（960 × 1664）が選択されています。',
  };
  c.ko[2].splice(0, 1,
    '작업대 아래 「이미지 크기」를 누르세요. 가로는 옆으로 넓고 세로는 위아래로 길며 정사각형은 두 변이 같습니다. 두 숫자는 가로 × 세로 픽셀입니다.',
    '「보통」에서 기본 가로 1216 × 832, 와이드 가로 1344 × 768, 기본 세로 832 × 1216, 롱 세로 768 × 1344, 정사각형 1024 × 1024 중에서 고르세요. 처음 시작하는 크기는 기본 세로입니다.',
    '여러 인물이나 넓은 배경에는 기본 가로보다 더 넓게 펼쳐진 와이드 가로를 써 보세요. 전신을 담을 공간이 필요하면 기본 세로보다 길쭉한 롱 세로를 써 보세요. 실제 구도와 인물이 담기는 범위는 프롬프트와 생성 결과에 따라 달라집니다.',
    '더 많은 픽셀이 필요하면 「크게」를 고르세요. 기본 가로 1536 × 1024, 와이드 가로 1664 × 960, 기본 세로 1024 × 1536, 롱 세로 960 × 1664, 정사각형 1472 × 1472를 제공합니다. 생성 전 예상 비용을 확인하세요.',
    '「이 크기 적용」으로 현재 작업대의 크기를 바꿉니다. 프롬프트와 카메라 설정, 저장된 프리셋의 크기는 유지됩니다. 직접 입력은 가로·세로 각각 64의 배수, 총 3,145,728픽셀 이하입니다. 「가로·세로 바꾸기」로 두 값을 교환할 수 있습니다.',
  );
  c.en[2].splice(0, 1,
    'Choose “Image size” at the bottom of the workbench. Landscape is wider than it is tall, portrait is taller, and square has equal sides. Sizes are shown as width × height in pixels.',
    'Under “Normal”, choose Standard landscape 1216 × 832, Wide landscape 1344 × 768, Standard portrait 832 × 1216, Tall portrait 768 × 1344, or Square 1024 × 1024. The starting size is Standard portrait.',
    'Try Wide landscape for a group or a broad background. It gives you a wider frame than Standard landscape. Tall portrait gives you a longer frame for a full-length figure than Standard portrait. The prompt and generation result still determine how the figure is framed.',
    'For more pixels choose “Large”. It offers Standard landscape 1536 × 1024, Wide landscape 1664 × 960, Standard portrait 1024 × 1536, Tall portrait 960 × 1664, and Square 1472 × 1472. Check the estimated cost before generating.',
    'Choose “Apply size” to change the current workbench dimensions. Prompts, camera settings and sizes in saved presets stay as they are. Custom width and height must each be multiples of 64 and total at most 3,145,728 pixels. Use “Swap width and height” to exchange them.',
  );
  c.ja[2].splice(0, 1,
    '作業台の下にある「画像サイズ」を押します。横長は横に広く、縦長は縦に長く、正方形は縦横が同じです。数値は幅 × 高さ（ピクセル）です。',
    '「標準」では標準横長 1216 × 832、ワイド横長 1344 × 768、標準縦長 832 × 1216、ロング縦長 768 × 1344、正方形 1024 × 1024 を選べます。初期値は標準縦長です。',
    '複数人や広い背景には、標準横長より横に広いワイド横長を試してください。全身を収める余白が欲しいときは、標準縦長より縦に長いロング縦長が使えます。実際の構図や人物が収まる範囲はプロンプトと生成結果によって変わります。',
    'より多くの画素が必要なら「大」を選びます。標準横長 1536 × 1024、ワイド横長 1664 × 960、標準縦長 1024 × 1536、ロング縦長 960 × 1664、正方形 1472 × 1472 があります。生成前に推定費用を確認してください。',
    '「サイズを適用」で現在の作業台のサイズを変更します。プロンプト、カメラ設定、保存済みプリセットのサイズは維持されます。カスタムの幅と高さはそれぞれ64の倍数で、総画素数は3,145,728以下です。「縦横を交換」で2つの値を入れ替えられます。',
  );
  c.ko[3]+=' 배경화면 정사각형은 지원하지 않습니다. 1,048,576픽셀을 넘는 크기는 생성 전 예상 Anlas 확인창이 나옵니다. High/Medium을 바꿔도 크기는 유지됩니다. 이미지 기반 모드는 원본 크기를 사용합니다.';
  c.en[3]+=' Wallpaper has no square preset. Sizes above 1,048,576 pixels require an estimated-Anlas confirmation before generation. High/Medium changes preserve size. Source-image modes use the source dimensions.';
  c.ja[3]+=' 壁紙の正方形はありません。1,048,576ピクセルを超えるサイズは生成前に推定Anlasを確認します。High/Mediumを変更してもサイズは維持します。画像入力モードは元画像のサイズを使います。';
}
