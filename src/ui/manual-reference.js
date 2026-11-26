// Offline help uses current controls captured through supported GUI interaction.
const chapter = (id, ko, en, ja, illustrations = []) => ({
  id, image: null, ko, en, ja, illustrations,
  imageFile: id === 'reference-library' ? 'v5-current-library.jpg'
    : id === 'v5-reference' ? 'v5-current-overview.jpg' : 'v5-current-reference.jpg',
  imageNote: {
    ko:'설명용 단색 참조를 사용한 한국어 화면입니다.',
    en:'Korean interface shown with a plain-color demonstration reference.',
    ja:'説明用の単色参照を使った韓国語の画面です。',
  },
});

export const referenceChapters = [
  chapter('v5-reference',
    ['V5 이미지 참조 시작하기', '그림을 참고해 인물·그림체·의상을 요청합니다. 이미지를 붙였다고 바로 생성하거나 보관함에 저장하지는 않습니다.', [
      '작업대에서 V5 Full, High, 텍스트 생성을 선택하고 이미지 참조를 펼칩니다. V5 Precise는 이 조합에서만 적용합니다.',
      '참조 추가로 PNG·JPEG·WebP를 선택하거나 참조 패널에 파일을 놓습니다. 이미지가 클립보드에 있다면 참조 패널에 포커스를 둔 뒤 붙여넣습니다. 파일 선택·드롭·붙여넣기는 같은 카드 목록으로 들어갑니다.',
      '최대 16개 카드에서 유형·강도·사용 중을 정합니다. 위로·아래로는 참조 순서를 바꾸고, 제거는 현재 카드만 없앱니다. 저장된 보관함 항목과 원본 파일은 지우지 않습니다.',
      '사용 준비 수와 등록 수를 구분해서 읽습니다. 사용 중을 끈 카드와 현재 모델·모드에서 보류한 카드는 생성 요청에 포함하지 않습니다.',
      'Medium, I2I, Inpaint 또는 다른 모델로 바꿔도 현재 카드 편집은 유지합니다. 다시 지원 조합으로 돌아와 적용 수를 확인하세요. V5 Precise+Inpaint와 V5 Vibe는 지원하지 않습니다.',
      '생성 전에 크기·문구·총 예상 비용을 확인합니다. 생성 버튼을 직접 눌러야 이미지를 만들며, 참조를 추가하거나 도움말을 여는 동작은 생성하지 않습니다.',
    ], '전송할 참조는 픽셀로 변환하고 V5 크기 버킷에 맞춰 중앙을 자를 수 있습니다. 카드의 원본 크기·중앙 자르기 표시를 확인하세요. 원본 파일 자체는 바꾸지 않습니다. Windows OS 파일 드롭의 최종 GUI 시험은 미완료입니다. 파일 선택·붙여넣기 경로를 이용할 수 있으며 드롭은 실사용 후 확인합니다. Vibe Transfer는 지원하지 않습니다. 기존 V4.5 프리셋과 History는 읽을 수 있으며 생성하려면 V5 Full로 전환하세요.'],
    ['Start with V5 image references', 'Use an image to guide a character, style or outfit. Adding it does not generate an image or save a library entry.', [
      'In Workbench choose V5 Full, High and Text to Image, then expand Image references. V5 Precise applies only in this combination.',
      'Use Add Reference to select PNG, JPEG or WebP, drop files onto the reference panel, or focus that panel and paste an image already on the clipboard. All three intake routes add to the same card list.',
      'Set Type, Strength and Enabled on up to 16 cards. Up/Down changes reference order. Remove drops only the current card, keeping saved library entries and source files.',
      'Distinguish ready references from registered cards. Disabled cards and references held for the current model or mode are omitted from generation requests.',
      'Switching to Medium, I2I, Inpaint or another model keeps the edited cards. Return to the supported combination and recheck the ready count. V5 Precise+Inpaint and V5 Vibe are not supported.',
      'Review size, prompt and total estimated cost before generation. Only pressing Generate creates an image; adding references or opening help does not generate.',
    ], 'Submitted references are converted to pixels and may be center-cropped to a V5 size bucket. Check the original dimensions and center-crop indicator on the card. Source files remain unchanged. The final Windows OS file-drop GUI check remains unverified. File selection and paste are available; drop will be checked during practical use. Vibe Transfer is not supported. Existing V4.5 presets and History remain readable; switch to V5 Full before generating.'],
    ['V5 画像参照を始める', '画像から人物・画風・衣装の特徴を参照します。追加するだけでは生成やライブラリ保存は行いません。', [
      '作業台で V5 Full・High・テキスト生成を選び、画像参照を開きます。V5 Precise はこの組み合わせだけで適用します。',
      '参照を追加から PNG・JPEG・WebP を選ぶか、参照パネルへファイルをドロップします。クリップボードに画像があればパネルにフォーカスして貼り付けます。どの入口も同じカード一覧へ追加します。',
      '最大16枚のカードで種類・強度・使用中を設定します。上へ・下へで順番を変え、削除で現在のカードだけを外します。保存済み項目や元ファイルは削除しません。',
      '使用準備数と登録数を区別します。無効なカードと現在のモデル・モードで保留した参照は生成要求に含めません。',
      'Medium・I2I・Inpaint・別モデルに変えてもカードの編集は保持します。対応する組み合わせに戻して適用数を確認してください。V5 Precise+Inpaint と V5 Vibe は非対応です。',
      '生成前にサイズ・文章・推定総費用を確認します。生成ボタンを押したときだけ画像を作ります。参照追加やヘルプ表示では生成しません。',
    ], '送信する参照は画素に変換し、V5 のサイズ枠に合わせて中央を切り取る場合があります。カードの元サイズ・中央切り取り表示を確認してください。元ファイル自体は変更しません。Windows OS ファイルドロップの最終 GUI 試験は未確認です。ファイル選択・貼り付けを利用でき、ドロップは実使用後に確認します。Vibe Transfer は非対応です。既存の V4.5 プリセット・履歴は読み込めます。生成するには V5 Full に切り替えてください。']),

  chapter('v5-reference-types',
    ['참조 유형·의상 선호·강도', '참조 유형은 어떤 특징을 가져올지 정하는 선택입니다. 같은 의상 선호와 의상 유형은 서로 다른 조작입니다.', [
      '캐릭터(Character)는 인물 특징을 참고합니다. 같은 의상 선호를 켜면 원본 의상을 함께 선호하며, 끄면 인물 참조를 유지하면서 의상 선호를 풉니다.',
      '그림체(Style)는 채색·질감·그림의 느낌을 참고합니다. 의상이나 구도까지 영향을 받을 수 있어 특정 요소만 완벽히 분리한다고 보장하지 않습니다.',
      '캐릭터와 그림체(Character & Style)는 두 역할을 함께 요청합니다. 이 유형에서도 같은 의상 선호를 켜거나 끌 수 있습니다.',
      '의상(Outfit)은 별도의 카드 유형입니다. 캐릭터 카드의 체크를 켜는 것과 같지 않습니다. 다른 캐릭터 참조와 의상 카드를 섞어 사용할 수 있습니다.',
      '강도(Strength) 슬라이더 또는 숫자를 조절합니다. 작은 값부터 한 조건씩 비교하세요. 높은 값이 더 좋은 결과나 정확한 복제를 보장하지 않습니다.',
      '여러 유형을 섞고 순서를 바꿀 수 있습니다. 사용 중을 끄면 카드는 남지만 요청에서 제외합니다. 순서만으로 우선순위를 단정하지 말고 같은 시드와 조건으로 결과를 비교하세요.',
    ], 'Character의 의상 선호 효과는 입력에 따라 달라집니다. OFF여도 의상 특징이 남을 수 있습니다. 원본과 같은 자세·얼굴·의상의 완전 복제를 보장하지 않습니다.'],
    ['Reference types, outfit preference and Strength', 'Type chooses which features to guide. Prefer same outfit and the Outfit type are different controls.', [
      'Character guides character features. Prefer same outfit ON also favors the source outfit; OFF retains character guidance without that outfit preference.',
      'Style guides rendering, materials and the look of the picture. Clothing and composition may also change; it does not promise perfect separation of features.',
      'Character & Style requests both roles. Prefer same outfit is available for this type too.',
      'Outfit is a separate card type, rather than the checkbox on a Character card. You can combine a character reference with a different Outfit card.',
      'Adjust the Strength slider or numeric field. Start low and compare one change at a time. Higher values do not guarantee better results or exact copies.',
      'Mix reference types and change their order. Disabling a card keeps it but omits it from requests. Do not assume priority from order alone; compare results using matching seeds and settings.',
    ], 'The effect of outfit preference varies by input. Clothing features may remain with OFF. An identical pose, face or outfit is not guaranteed.'],
    ['参照の種類・同じ衣装を優先・強度', '種類は参考にする特徴を選びます。「同じ衣装を優先」と「衣装」タイプは別の操作です。', [
      'Character は人物の特徴を参照します。同じ衣装を優先をオンにすると元の衣装も優先し、オフでは人物参照を維持しながら衣装の優先を外します。',
      'Style は塗り・質感・絵の雰囲気を参照します。衣装や構図にも影響する場合があり、特徴の完全な分離は保証しません。',
      'Character & Style は両方の役割を要求します。この種類でも同じ衣装を優先を切り替えられます。',
      'Outfit は独立したカードの種類です。Character カードのチェックと同じではありません。人物参照と別の衣装カードを混ぜて使えます。',
      'Strength のスライダーか数値を調整します。小さい値から一条件ずつ比較してください。高い値が良い結果や正確な複製を保証するわけではありません。',
      '種類を混ぜ、順序を変えられます。無効にしたカードは残りますが要求には含めません。順番だけで優先度を決めつけず、同じシードと条件で比べます。',
    ], '衣装優先の効果は入力によって異なります。オフでも衣装の特徴が残る場合があります。同一の姿勢・顔・衣装の完全な再現を保証しません。'], [

    ]),

  chapter('v5-reference-cost',
    ['참조 적용 수와 비용', '등록한 카드 수와 실제 적용 수는 다를 수 있습니다. 예상 비용은 생성 설정과 계정 상태를 함께 반영합니다.', [
      '이미지 참조 위쪽에서 사용 준비 / 등록 수를 읽습니다. 예를 들어 사용을 끈 카드나 보류한 카드가 있으면 등록 수보다 준비 수가 적습니다.',
      '적용되는 V5 Precise 참조 한 장은 출력 이미지 한 장당 5 Anlas를 더합니다. 적용 2장이면 참조 비용은 10 Anlas입니다.',
      '아래 생성 버튼 주변의 총 예상 비용도 확인합니다. 기본 생성 비용은 크기·Steps·계정 사용량에 따라 달라지며 참조 추가 비용과 별도입니다.',
      '적용 참조를 2장에서 3장으로 늘리면 참조 추가 비용은 10에서 15 Anlas가 됩니다. 같은 적용 수에서 강도만 바꿔도 참조 추가 비용은 늘지 않습니다.',
      '지원하지 않는 모델·모드에서는 카드를 보류하고 그 참조의 추가 비용을 계산하지 않습니다. 목록이 남아 있는 것과 요청에 적용되는 것은 다릅니다.',
      '카드 편집·모델 전환·보관함 저장/불러오기만으로 유료 생성이나 인코딩을 하지 않습니다. 생성 후 실제 계정 차감과 결과를 확인하세요.',
    ], '총 예상 비용은 현재 크기·Steps·계정 상태에 따른 안내입니다. 참조 비용만 보지 말고 생성 전에 총액을 확인하세요. 실제 차감은 생성 후 계정 상태와 함께 확인합니다.'],
    ['Ready references and cost', 'Registered cards and applied references can differ. Estimated cost also depends on generation settings and account status.', [
      'Read ready / registered above Image references. Disabled or held cards can make the ready count smaller than the registered count.',
      'Each applied V5 Precise reference adds 5 Anlas per output image. Two applied references add 10 Anlas.',
      'Also check the total estimate near Generate. Base generation cost depends on size, Steps and account usage, separately from the reference fee.',
      'Increasing applied references from two to three changes the additional reference fee from 10 to 15 Anlas. Changing Strength alone with the same applied count does not increase the reference fee.',
      'Unsupported models or modes hold the cards and do not count their additional fee. Keeping a card in the list is different from applying it to the request.',
      'Editing cards, switching models or saving/loading the library does not trigger paid generation or encoding. Check the actual account charge and result after generating.',
    ], 'The total estimate reflects the current size, Steps and account status. Check the full amount before generating, rather than the reference fee alone. Check the actual charge and account status after generation.'],
    ['適用数と費用を確認する', '登録したカード数と実際の適用数は異なる場合があります。推定費用は生成設定・アカウント状態も反映します。', [
      '画像参照の上にある使用準備数 / 登録数を読みます。無効や保留のカードがあると準備数は少なくなります。',
      'V5 Precise は適用する参照1枚につき、出力画像1枚あたり5 Anlasを加算します。参照2枚なら追加費用は10 Anlasです。',
      '生成ボタン付近の推定総費用も確認します。基本生成費用はサイズ・Steps・使用量で変わり、参照追加費用とは別です。',
      '適用する参照を2枚から3枚に増やすと追加費用は10から15 Anlasになります。同じ適用数で強度だけを変えても参照料金は増えません。',
      '非対応のモデル・モードではカードを保留し、その追加費用を数えません。一覧に残ることと要求への適用は別です。',
      'カード編集・モデル切替・ライブラリ保存や読み込みだけでは有料生成・エンコードを行いません。生成後に実際の差額と結果を確認してください。',
    ], '推定総費用は現在のサイズ・Steps・アカウント状態に応じた案内です。参照料金だけでなく生成前に総額を確認してください。実際の差額は生成後のアカウント状態と合わせて確認します。'], [
    ]),

  chapter('reference-library',
    ['개별·구성 레퍼런스 보관함', '레퍼런스 보관함은 Base/Character 프롬프트 프리셋과 독립적입니다. 직접 저장한 이미지 참조와 옵션을 다시 사용합니다.', [
      '이미지 참조 아래 레퍼런스 보관함을 엽니다. 저장할 참조에서 현재 구성 전체 또는 카드 한 장을 고르고 보관함 이름을 입력합니다.',
      '저장된 항목을 선택하지 않은 상태에서 저장하면 새 항목을 만듭니다. 항목 하나를 선택한 뒤 저장하면 같은 범위의 기존 항목을 확인 후 덮어씁니다.',
      '다른 이름으로 저장은 선택한 기존 항목을 보존하고 새 항목을 만듭니다. 이름 변경은 선택한 항목의 이름을 바꾸며 현재 카드의 설정을 덮어쓰는 저장과 다릅니다.',
      '불러오기는 개별 항목이면 현재 목록 뒤에 추가합니다. 구성 전체면 현재 참조 목록을 교체하며 기존 카드가 있을 때 확인합니다. 카드 유형·순서·강도·활성 상태·의상 옵션을 복원합니다.',
      '여러 저장 항목을 체크하고 선택 삭제를 누른 뒤 확인할 수 있습니다. 삭제는 선택한 보관함 항목과 그 보관 데이터만 대상으로 하며 원래 고른 외부 이미지·프롬프트 프리셋·History는 지우지 않습니다.',
      '사용 중인 카드를 편집해도 보관함은 자동 갱신하지 않습니다. 저장하지 않은 임시 카드가 필요하면 명시적으로 저장하세요. 프롬프트 프리셋이나 History를 저장하는 것만으로 참조 원본을 보관하지 않습니다.',
    ], '모델·모드 전환은 현재 목록을 보존하지만 앱 종료 후 임시 목록 복원을 보장하지 않습니다. 불러온 옛 구성에 Vibe 자료가 있어도 삭제하지 않고 보존하되 적용하지 않습니다. 구성 교체 확인을 취소하면 현재 참조를 유지합니다.'],
    ['Single and set reference library', 'The Reference library is independent of Base/Character prompt presets. Reuse image references and options that you explicitly save.', [
      'Open Reference library below Image references. In References to save, choose Entire current set or one card, then enter a Library name.',
      'Save with no saved entry selected creates an entry. Selecting one entry and pressing Save overwrites an entry of the same scope after confirmation.',
      'Save as keeps the selected entry and creates another. Rename changes the selected entry name; it is different from saving the current card settings over that entry.',
      'Load appends a single reference to the current list. Loading a set replaces the reference list and asks for confirmation if it has cards. Type, order, Strength, enabled state and outfit preference are restored.',
      'Check several saved entries, press Delete selected and confirm. Deletion affects those library entries and their stored data, keeping the original external images, prompt presets and History.',
      'Editing current cards does not automatically update the library. Explicitly save temporary cards you want to keep. Saving a prompt preset or History entry alone does not archive reference originals.',
    ], 'Model/mode changes keep the current list, but temporary cards are not guaranteed to return after quitting. Old sets containing Vibe data are preserved rather than deleted; they are not applied. Cancelling set replacement retains the current references.'],
    ['単体・構成の参照ライブラリ', '参照ライブラリは Base/Character のプロンプトプリセットと独立しています。明示的に保存した画像参照と設定を再利用します。', [
      '画像参照の下の参照ライブラリを開きます。保存する参照で現在の構成全体かカード1枚を選び、保存名を入力します。',
      '保存済み項目を選ばず保存すると新しい項目を作ります。1項目を選んで保存すると、同じ範囲の項目を確認後に上書きします。',
      '名前を付けて保存は選択項目を残して別項目を作ります。名前の変更は選択項目の名前を変える操作で、現在のカード設定で上書き保存する操作とは異なります。',
      '単体の読み込みは現在の一覧の末尾に追加します。構成の読み込みは一覧を置換し、カードがある場合に確認します。種類・順番・強度・有効状態・衣装オプションを復元します。',
      '複数項目をチェックし、選択した項目を削除して確認できます。対象は選んだ保存項目と保管データです。元の外部画像・プロンプトプリセット・履歴は削除しません。',
      '現在のカードを編集してもライブラリは自動更新しません。残したい一時カードは明示的に保存してください。プロンプトプリセットや履歴の保存だけでは参照原本を保管しません。',
    ], 'モデル・モード切替では一覧を保持しますが、終了後の一時カード復元は保証しません。古い構成に Vibe データがあっても削除せず保持し、適用しません。構成置換をキャンセルすると現在の参照を保持します。'], [
    ]),
];
