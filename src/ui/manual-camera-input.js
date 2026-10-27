const chapter=(id,image,ko,en,ja)=>({id,image,ko,en,ja});
export const absoluteCameraChapters=[
 chapter('camera-absolute','camera-absolute',
 ['첫 생성부터 쓰는 절대 카메라','새 이미지와 기존 이미지 모두 정면 0°를 기준으로 원하는 구도를 지정합니다.',[
 '작업대에 Base와 Character 문구를 준비하고 왼쪽 절대 카메라를 누릅니다. 원본 이미지 없이 바로 사용할 수 있습니다.',
 '카메라 ON을 선택합니다. 새 카메라는 정면 0°, 상하 0°, 상반신으로 시작합니다. 이전 이미지의 방향을 묻지 않습니다.',
 '구체를 좌우로 끌면 방향, 위아래로 끌면 상하 시점이 바뀝니다. 방향 버튼과 키보드 화살표도 사용할 수 있습니다. Home은 정면으로 돌아갑니다.',
 '카메라 OFF를 선택하면 카메라 전용 문구를 추가하지 않고 기존 수동 프롬프트로 생성합니다.'
 ],'구체는 장면 중심 (0.5, 0.5)을 기준으로 한 입력 도식입니다. 실제 장면을 회전시키거나 개별 Character Position을 움직이지 않습니다.'],
 ['Absolute camera from the first image','Choose a target view from front 0° for both new and reused images.',[
 'Prepare Base and Character prompts, then open Absolute camera on the left. No source image is required.',
 'Turn Camera ON. New work starts at front 0°, elevation 0°, upper body. The app never asks for the source viewing angle.',
 'Drag horizontally for direction and vertically for elevation. Direction buttons and arrow keys also work; Home returns to front.',
 'Turn Camera OFF to use the ordinary manual prompt without an added camera block.'
 ],'The sphere is an input diagram centered on the scene (0.5, 0.5). It does not rotate a physical scene or change Character Position coordinates.'],
 ['最初の生成から使う絶対カメラ','新規画像も既存画像も、正面0°を基準に目標の構図を指定します。',[
 'BaseとCharacterの文章を準備し、左の絶対カメラを開きます。元画像は不要です。',
 'カメラONを選びます。新しい作業は正面0°・上下0°・上半身から始まり、元画像の方向は質問しません。',
 '横ドラッグで方向、縦ドラッグで上下視点を変えます。方向ボタンと矢印キーも使えます。Homeで正面に戻ります。',
 'カメラOFFでは専用文章を追加せず、通常の手動プロンプトを使用します。'
 ],'球体はシーン中心(0.5, 0.5)の入力図です。実際の場面を回転したりCharacter Positionを動かしたりしません。']),
 chapter('camera-framing','camera-absolute',
 ['방향·샷 크기·구도','서로 다른 축을 따로 조절하고 같은 축의 상충 표현을 섞지 않습니다.',[
 '방향은 정면·앞사선·측면·뒤사선·후면 중 하나로 출력됩니다. 좌우 측면은 모두 from side를 사용할 수 있습니다.',
 '거리 / 샷 크기를 움직이거나 목록에서 클로즈업·상반신·허벅지·전신·넓은 샷을 선택합니다. 실제 미터 단위 거리가 아닙니다.',
 '상하 시점은 from above 또는 from below로 표현합니다. 중앙 구간에는 상하 태그를 추가하지 않습니다.',
 '추가 구도 조절에서 높이·팬·틸트·롤을 사용할 수 있습니다. 이미지 크기 버튼은 기존 해상도 선택기를 엽니다. I2I/Inpaint의 원본 크기는 자동 변경하지 않습니다.'
 ],'좌우 구별, 정밀한 물리 각도, 팬·틸트의 독립 효과는 보장되지 않습니다. 높이·팬·틸트는 실험적 문구입니다.'],
 ['Direction, shot size and framing','Control independent axes without blending contradictory directions.',[
 'Direction chooses front, three-quarter front, side, three-quarter rear or behind. Both left and right side may use from side.',
 'Use the distance slider or choose close-up, upper body, cowboy shot, full body or wide shot. This describes framing, not meters.',
 'Elevation adds from above or from below. The neutral band adds no elevation phrase.',
 'Additional framing options expose height, pan, tilt and roll. Image size opens the existing resolution picker. I2I/Inpaint source dimensions remain unchanged.'
 ],'Exact left/right orientation, physical angles and independent pan/tilt effects are not guaranteed. Height, pan and tilt wording is experimental.'],
 ['方向・ショットサイズ・構図','各軸を個別に調整し、同じ軸の対立する方向を混ぜません。',[
 '正面・斜め前・側面・斜め後ろ・背面のいずれかを出力します。左右の側面はどちらもfrom sideになる場合があります。',
 '距離スライダーか一覧でクローズアップ・上半身・太ももまで・全身・ワイドを選びます。実際の距離ではなくフレーミングです。',
 '上下視点はfrom aboveまたはfrom belowを追加します。中央の範囲では上下タグを追加しません。',
 '追加調整には高さ・パン・チルト・ロールがあります。画像サイズは既存の解像度選択を開きます。I2I/部分修正の元サイズは自動変更しません。'
 ],'左右の正確さ、物理角度、独立したパン・チルト効果は保証しません。高さ・パン・チルトの文章は実験的です。']),
 chapter('camera-wording','camera-wording',
 ['Base 전용 문구와 직접 편집','원문과 생성용 Base 사본을 나누어 관리합니다.',[
 '카메라 문구는 샷 크기 → 방향 → 상하 → 높이 → 팬 → 틸트 → 롤 순서로 Base 앞에 붙습니다. Character 문구를 이동하거나 재작성하지 않습니다.',
 '각 행에서 강도를 수정합니다. 1은 중립값이며, -10~10의 수를 입력할 수 있습니다. 0은 그 행을 생략하며 음수는 개념 억제·반전을 의도하므로 원하는 방향과 달라질 수 있습니다.',
 '문구 칸에서 직접 표현을 바꿀 수 있습니다. 직접 쓴 문구는 구체를 움직여도 유지되며 해당 행의 자동 버튼으로 좌표 기반 표현에 돌아갑니다.',
 '1. 같은 미완성 숫자는 오류로 표시되고 생성·저장을 막습니다. 숫자를 완성하거나 고치세요. 강도 수정은 구체 위치를 바꾸지 않습니다.'
 ],'가중치는 방향을 섞는 비율이 아닙니다. 기본값 1이나 문구의 효과를 실제 이미지에서 최적값으로 검증한 것은 아닙니다.'],
 ['Base-only wording and direct editing','Keep editing originals separate from the generated Base copy.',[
 'Camera phrases precede Base in this order: shot, direction, elevation, height, pan, tilt, roll. Character text is never moved or rewritten.',
 'Edit each strength between -10 and 10. One is neutral; zero omits that row. Negative emphasis can suppress or invert an idea and may oppose the intended view.',
 'Edit wording directly. Manual text survives sphere movement; Auto on that row returns to coordinate-derived wording.',
 'An incomplete number such as 1. remains visible and blocks saving/generation. Complete or correct it. Weight edits never move the sphere.'
 ],'Weights are emphasis, not direction mixing ratios. Neither the initial value 1 nor the wording is established as optimal in real images.'],
 ['Base専用文章と直接編集','編集原文と生成用Baseのコピーを分けて保持します。',[
 'ショット・方向・上下・高さ・パン・チルト・ロールの順でBaseの先頭に追加します。Characterの文章は移動も再構成もしません。',
 '各行の強さを-10～10で編集します。1は中立、0はその行を省略します。負の強調は概念を抑制・反転し、意図した方向と逆になる場合があります。',
 '文章を直接編集できます。球体を動かしても保持され、その行の自動ボタンで座標由来の文章に戻ります。',
 '1.のような未完成数値は表示を保持し、保存・生成を止めます。入力を完成させてください。強さの変更では球体は動きません。'
 ],'強さは方向の混合比率ではありません。初期値1や文章の効果を実画像で最適と確認したわけではありません。']),
 chapter('camera-review','camera-review',
 ['수동 표현 충돌과 생성 전 확인','실제 전송할 문구를 읽고 결정합니다.',[
 '기존 Base·Character의 명시적인 카메라 태그를 찾으면 위치와 문구를 표시합니다. 포즈·고개·시선 문장을 임의로 해석해 삭제하지 않습니다.',
 '선택적으로 생성용 Base 사본에서 독립된 정확한 카메라 태그만 제외할 수 있습니다. 원문은 보존하며, 묶음 표현과 Character 태그는 남겨 둡니다.',
 '작업대로 돌아와 Generate를 누르면 Wildcard가 한 번 결정되고 품질·UC를 포함한 최종 문구가 표시됩니다. 남은 수동 표현을 유지하려면 명시적으로 체크합니다. 취소하고 원문을 고칠 수도 있습니다.',
 '확인한 조건으로 생성을 눌렀을 때만 전송합니다. 요청이 시작된 뒤 바꾼 값은 진행 중인 요청에 영향을 주지 않습니다.'
 ],'자유 문장 전체의 의미 충돌은 자동 판정하지 않습니다. 최종 문구를 확인하세요. 신규 카메라의 실제 NovelAI 이미지 품질 검증은 아직 수행하지 않았습니다.'],
 ['Manual conflicts and final review','Read and decide which prompts will actually be sent.',[
 'Explicit camera tags in Base and Character are listed with their locations. Pose, head and gaze prose is not interpreted or deleted.',
 'Optionally exclude exact standalone camera tags from the generated Base copy. Originals stay intact; grouped expressions and Character tags remain.',
 'Return to the workbench and press Generate. Wildcards resolve once and final prompts include quality and UC. Explicitly check to retain remaining manual expressions, or cancel and edit the originals.',
 'Only Generate reviewed image sends the request. Later edits do not change the request already in progress.'
 ],'The app cannot resolve every semantic conflict in free prose. Read the final text. Actual NovelAI image quality for the new camera has not yet been tested.'],
 ['手動表現の競合と最終確認','実際に送信する文章を読んで判断します。',[
 'Base・Characterの明示的なカメラタグを位置とともに表示します。姿勢・頭・視線の文章を解釈して削除しません。',
 '生成用Baseのコピーから単独の正確なカメラタグだけを除外できます。原文は保持し、グループ表現とCharacterタグは残します。',
 '作業台で生成を押すとWildcardを一度だけ確定し、品質・UCを含む最終文章を表示します。残った手動表現を保持する場合は明示的にチェックします。キャンセルして原文を編集することもできます。',
 '確認した条件で生成を押したときだけ送信します。開始後の編集は進行中のリクエストに影響しません。'
 ],'自由文章の意味の競合をすべて判定することはできません。最終文章を確認してください。新カメラの実際のNovelAI画質はまだ検証していません。']),
 chapter('camera-reuse','camera-reuse',
 ['이미지·History·저장 작업 재사용','새 카메라 시작과 저장한 v3.8.2 작업 재개를 구분합니다.',[
 '이미지의 생성 정보로 시작에서 메타데이터가 있는 PNG/WebP를 선택합니다. 문구·설정을 가져오고 정면 0°의 새 카메라로 시작합니다. 자동 I2I는 사용하지 않습니다.',
 'History를 크게 열고 새 절대 카메라를 누르면 이전 촬영 방향과 관계없이 정면 0°에서 시작합니다. 과거 카메라 기록은 읽기 전용으로 확인할 수 있습니다.',
 'v3.8.2 카메라 재개는 해당 버전의 History에 저장된 카메라와 원래 편집 문구를 복원합니다. 과거 v3.8.0/1 보정값은 변환하지 않습니다.',
 '카메라 작업 저장은 문구·설정·카메라를 별도 파일로 저장합니다. 종료 후 선택한 작업 재개로 불러옵니다. 재개는 Text to Image이며 입력 이미지·마스크는 따로 준비합니다.'
 ],'프리셋·History·기존 카메라 폴더는 덮어쓰지 않습니다. 새 작업의 구도·인물·배경 결과가 이전 이미지와 정확히 같을 것이라고 보장하지 않습니다.'],
 ['Reuse images, History and saved work','Distinguish a new camera from resuming a saved v3.8.2 camera.',[
 'Start from image metadata accepts a PNG/WebP with readable generation data. It imports prompts/settings and starts a new camera at front 0° without automatic I2I.',
 'Open History and choose New absolute camera to start at 0° regardless of the old view. Legacy camera metadata can be inspected read-only.',
 'Resume v3.8.2 camera restores its recorded state and original editing prompts. v3.8.0/1 calibration is never converted.',
 'Save camera work writes prompts/settings/camera to a separate file. Resume selected work after restarting. Resuming uses Text to Image; prepare source images/masks separately.'
 ],'Existing presets, History and legacy camera files are not overwritten. The model may change composition, people and backgrounds.'],
 ['画像・履歴・保存作業の再利用','新しいカメラの開始とv3.8.2作業の再開を区別します。',[
 '画像の生成情報から開始で、情報を読めるPNG/WebPを選びます。文章と設定を読み込み、正面0°から始めます。I2Iは自動で使いません。',
 '履歴を開いて新しい絶対カメラを選ぶと、以前の視点に関係なく0°から始まります。旧カメラ情報は読み取り専用で確認できます。',
 'v3.8.2カメラを再開は記録した状態と編集原文を復元します。v3.8.0/1の補正値は変換しません。',
 'カメラ作業を保存で文章・設定・カメラを別ファイルに保存します。再起動後に選択した作業を再開できます。Text to Imageで再開するので入力画像・マスクは別に準備します。'
 ],'既存プリセット・履歴・旧カメラファイルを上書きしません。構図・人物・背景が元画像と同じになることは保証しません。']),
];
