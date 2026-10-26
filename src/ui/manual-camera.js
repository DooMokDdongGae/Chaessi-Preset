// Complete camera workflow, shared chapter structure and equal steps in all locales.
export const cameraChapters = [
  {id:'camera-start',image:'camera-source',
    ko:['카메라: 원본에서 시작하기','이미 만든 그림의 프롬프트와 설정으로 다른 구도를 탐색합니다. 자동 대응은 출발점이며 직접 고쳐 쓰는 것이 정상적인 사용입니다.',[
      'History에서 그림을 크게 열고 카메라로 새 구도를 누르세요. 최근 생성 결과의 같은 버튼에서도 시작할 수 있습니다.',
      '외부 PNG/WebP는 이미지 열기에서 NAI 생성 메타데이터를 읽은 뒤 카메라 버튼을 누르세요. 메타데이터가 없으면 장면을 자동 분석하거나 프롬프트를 추정하지 않습니다.',
      '원본 문구에 있는 방향·상하 시점·프레이밍을 기준으로 삼습니다. 없는 정보나 좌우가 모호한 항목만 확인하세요. 그림과 다르면 그림과 기준이 다르면 수정에서 바로잡습니다.',
      'V4.5 자료는 읽고 편집할 수 있지만 새 생성에는 작업대에서 V5 Full로 명시적으로 전환해야 합니다. 전환 후 High/Medium과 설정을 확인하세요.'
    ],'그림의 3D 복원이나 정확한 재촬영 기능이 아닙니다. 원본 선택만으로 I2I 입력을 보내지 않습니다. 원본 파일과 기존 History를 덮어쓰지 않습니다.'],
    en:['Camera: start from an existing image','Explore another composition using an existing image’s prompt and settings. Automatic mapping is a starting point; editing it yourself is a normal part of the workflow.',[
      'Open a picture in History and press Explore with camera. The same button is available on the latest generation result.',
      'For an external PNG/WebP, use Open Image, read its NAI generation metadata, then choose the camera button. Images without readable metadata are not automatically analyzed and their prompts are not guessed.',
      'Direction, elevation and framing found in the source text establish the baseline. Confirm only missing or ambiguous information. Use Edit baseline if it differs from the picture to correct it.',
      'V4.5 records remain readable and editable. Explicitly switch to V5 Full in the workbench before generating, then check High/Medium and the settings.'
    ],'This is not 3D reconstruction or an exact reshoot. Selecting an image does not automatically send it as I2I input. Source files and existing History are not overwritten.'],
    ja:['カメラ：既存の画像から始める','生成済み画像のプロンプトと設定を使って別の構図を探します。自動対応は出発点で、自分で修正することも通常の使い方です。',[
      '履歴で画像を大きく開き、「カメラで構図を探す」を押します。最新の生成結果にも同じボタンがあります。',
      '外部 PNG/WebP は「画像を開く」で NAI 生成メタデータを読み、カメラボタンを選びます。読み取れる情報がない画像を自動分析したり、プロンプトを推測したりしません。',
      '元の文章にある方向・上下の視点・フレーミングを基準にします。不足や左右が曖昧な項目だけ確認します。絵と異なる場合は「絵と基準が違う場合は修正」で直します。',
      'V4.5 の資料は読み込み・編集できます。新規生成の前にワークベンチで V5 Full に明示的に切り替え、High/Medium と設定を確認してください。'
    ],'3D 復元や正確な再撮影ではありません。画像を選んだだけでは I2I 入力として送信されません。元ファイルや既存の履歴は上書きしません。']},
  {id:'camera-controls',image:'camera-source',
    ko:['카메라: 손잡이와 방향','구체 위 위치 이동과 제자리 팬·틸트는 서로 다른 촬영 목표입니다. 도식은 입력 장치이며 결과 미리보기가 아닙니다.',[
      '구체의 카메라 손잡이를 직접 끌어 좌우 방향과 상하 시점을 바꾸세요. 8방향 버튼으로 정면·양쪽 앞사선·측면·뒤사선·후면을 빠르게 선택하고, 드래그로 중간 방향을 찾습니다.',
      '좌우 표시는 피사체 기준입니다. 정면에서 바라보는 화면의 좌우와 다를 수 있습니다. 원본에서 몇 도 이동했는지 표시를 함께 확인하세요.',
      '제자리 팬·틸트 패드는 카메라 위치를 그대로 두고 바라보는 방향을 요청합니다. 구체 이동은 피사체 주위에서 보는 위치를 바꿉니다.',
      '높이 레일은 카메라의 물리적 높이, 거리·프레이밍은 얼마나 넓게 담을지, 롤은 화면 기울기를 요청합니다. 세로·정사각·가로 버튼은 실제 출력 크기를 바꿉니다. 자세한 크기는 아래 생성 설정에서도 고칠 수 있습니다.'
    ],'휠이나 Shift 조합을 몰라도 조작할 수 있습니다. 각도는 범주를 대표하는 목표값으로 실제 결과를 측정한 값이 아닙니다. 높이와 상하 시점도 별도 상태이며 모델이 항상 독립적으로 반영하지는 않습니다.'],
    en:['Camera: handles and directions','Orbiting and pan/tilt in place describe different camera goals. The diagram is an input control, not a result preview.',[
      'Drag the camera handle on the sphere to change direction and elevation. The eight buttons select front, both front diagonals, sides, rear diagonals and back; drag to explore intermediate positions.',
      'Left and right are relative to the subject. They may differ from screen left/right when viewing the subject from the front. Check the displayed change from the source.',
      'The pan/tilt pad requests a change in where the camera points while its position stays fixed. Orbiting changes the viewing position around the subject.',
      'Height requests physical camera height; distance/framing controls how much is included; roll requests frame rotation. Portrait, square and landscape change actual output dimensions, which can also be edited in generation settings.'
    ],'No wheel or Shift shortcut is required. Angles are representative targets, not measurements of the generated image. Height and elevation are separate states, but the model may not reflect them independently.'],
    ja:['カメラ：ハンドルと方向','周囲の移動と、その場でのパン・チルトは異なる撮影目標です。図は入力用で、結果のプレビューではありません。',[
      '球体のカメラハンドルをドラッグして方向と上下の視点を変えます。8方向ボタンで正面・左右の前斜め・側面・後ろ斜め・背面を選び、ドラッグで中間の方向を探します。',
      '左右は被写体を基準にしています。正面から見た画面の左右とは異なる場合があります。元画像からの変化量も確認してください。',
      'パン・チルトのパッドは位置を変えずにカメラの向きを変える指定です。球体上の移動は被写体の周囲で見る位置を変えます。',
      '高さは物理的なカメラの高さ、距離・フレーミングは写す範囲、ロールは画面の傾きを指定します。縦・正方形・横は実際の出力サイズを変えます。下部の生成設定でもサイズを編集できます。'
    ],'ホイールや Shift の組み合わせを知らなくても操作できます。角度は区分を代表する目標値で、生成画像の測定値ではありません。高さと上下視点も別の状態ですが、モデルが独立して反映するとは限りません。']},
  {id:'camera-calibration',image:'camera-calibration',
    ko:['카메라: 현재 위치에서 가중치 보정','카메라 위치는 촬영 목표이고, 가중치는 표현의 강도입니다. 숫자를 고쳐도 위치를 역산해서 움직이지 않습니다.',[
      '새 v2 작업에서 정면 기준 +40°로 이동하면 앞사선 표현 하나가 1.2로 제안됩니다. 현재 카메라 적용 후 · 다음 생성에 사용할 문구에서 이 숫자만 1.5로 바꿔 보세요. 1.2는 비교 시험용 기본값이며 최적값으로 검증되지 않았습니다.',
      '카메라는 +40°에 그대로 있습니다. +50°에서도 같은 앞사선 구간 안에서 보정이 이어지고, +90°에서는 측면 표현 하나를 사용합니다. +40°로 돌아오면 1.5가 재현됩니다. 인접 방향을 섞거나 가중치를 각도로 역산하지 않습니다.',
      '다른 위치에도 보정할 수 있습니다. 같은 위치의 같은 표현을 다시 고치면 이전 보정을 갱신합니다. 왕복해도 누적되지 않으며 측면·후면에서 앞사선 표현이 계속 붙지는 않습니다.',
      '보정 기록은 원본별 작업의 모델/Effort·슬롯·축·표현에 연결됩니다. 다른 원본으로 전파하지 않습니다. High/Medium을 바꾸면 해당 조건의 기록을 사용합니다. 보정 적용 해제, 다시 적용 또는 기록의 개별 되돌리기로 조절하세요.'
    ],'숫자는 조작 예시이며 실제 +40° 결과를 보장하지 않습니다. 지원 입력은 -10~10, 소수 셋째 자리까지입니다. 다른 축을 바꾸어도 보정한 축의 위치는 바뀌지 않습니다.'],
    en:['Camera: calibrate weights at the current position','Position is your camera target; weight is the strength of an expression. Editing a number does not move the camera by reverse-calculating an angle.',[
      'In new v2 work, +40° from a front baseline proposes one front-diagonal expression at 1.2. In After camera adjustments · text for the next generation, change that number to 1.5. The initial 1.2 is a comparison baseline, not a validated optimum.',
      'The camera stays at +40°. At +50° the correction continues within the same diagonal sector; +90° selects one side expression. Returning to +40° reproduces 1.5. Adjacent directions are not mixed and weights are not converted back to angles.',
      'You can correct multiple positions. Editing the same expression at the same position replaces that correction. Repeated travel does not accumulate values, and a front-diagonal expression does not remain attached at the side or back.',
      'Corrections belong to this source’s work, model/Effort, field, axis and expression. They do not propagate to another source. Switching High/Medium uses the records for those conditions. Disable calibration, enable it again or remove an individual correction from the records.'
    ],'These numbers explain controls; they do not guarantee an actual +40° image. Input supports -10 to 10 and up to 3 decimal places. Changing another axis does not move the corrected axis.'],
    ja:['カメラ：現在位置で重みを補正','位置は撮影目標、重みは表現の強さです。数値を直しても角度を逆算してカメラを動かしません。',[
      '新しいv2作業では正面基準から+40°で前斜めの表現1つを1.2で提案します。「カメラ適用後・次の生成に使う文章」で数値を1.5に変えます。1.2は比較試験用の初期値で、最適値として検証された値ではありません。',
      'カメラは+40°のままです。+50°でも同じ前斜め区間内で補正が続き、+90°では側面の表現1つを選びます。+40°に戻すと1.5を再現します。隣り合う方向を混ぜず、重みから角度を逆算しません。',
      '複数の位置を補正できます。同じ位置・表現を直すと補正が更新されます。往復しても値は累積せず、側面や背面まで前斜めの表現が付いてくることもありません。',
      '記録はその元画像の作業・モデル/Effort・入力欄・軸・表現に属します。別の元画像には伝わりません。High/Medium 切り替え時はその条件の記録を使います。補正の適用解除・再適用、または記録から個別に戻せます。'
    ],'数値は操作例で、実際に +40° の画像になる保証ではありません。入力は -10～10、小数点以下3桁までです。他の軸を変えても補正した軸の位置は変わりません。']},
  {id:'camera-editing',image:'camera-editing',
    ko:['카메라: 직접 고쳐서 이어가기','모델이 손·옷·배경이나 가려질 부분을 다르게 그리면 문구를 직접 고쳐 이어가세요. 자동 자세 분석이나 가시성 추론으로 대체하지 않습니다.',[
      '다음 생성 문구에서 관리 중인 표현의 숫자만 바꾸면 가중치 보정입니다. 인물·의상·행동·포즈·배경 문구도 직접 수정할 수 있습니다.',
      '카메라 태그를 추가·삭제·교체해서 자동 관리와 충돌하면 수동 문구 유지 상태가 됩니다. 수정한 문구를 우선 사용하며 손잡이를 움직여도 조용히 덮어쓰지 않습니다.',
      '다시 패널과 연결하려면 이 문구의 카메라 관리 재개를 누릅니다. 이전 문구는 복귀·편집 취소로 되찾을 수 있습니다. 카메라 비활성화는 현재 유효한 문구를 일반 작업대로 전달하므로 직접 편집을 이어갈 수 있습니다.',
      '이 구도로 생성을 눌러 요청하세요. 생성 중 편집은 다음 요청에 반영되고 전송된 요청은 당시 스냅샷을 유지합니다. 실제 전송 문구에서 기존 품질·UC 처리 후 내용도 확인할 수 있습니다.'
    ],'가중치 보정과 문장 자체 수정은 다른 동작입니다. 미완성 문법은 먼저 수정하거나 취소해야 생성할 수 있으며, 손 놓기나 편집만으로 자동 생성하지 않습니다.'],
    en:['Camera: edit and continue','If the model changes a hand, outfit, background or something that should be hidden, edit the text and continue. This is not replaced with automatic pose or visibility inference.',[
      'Changing only a managed expression’s number in the next-generation text is calibration. You can also edit identity, outfit, action, pose and background text directly.',
      'Adding, deleting or replacing camera tags can conflict with automatic control. The field then uses manual text. Your edit takes priority and moving a handle does not silently overwrite it.',
      'Press Reconnect camera control for this field to resume panel management. Undo reset / edit recovers the previous text. Disable camera, keep current text transfers the valid output to the ordinary workbench so you can keep editing.',
      'Press Generate this view to send a request. Edits during generation apply to the next request; the sent request retains its starting snapshot. Actual request shows text after existing quality/UC processing.'
    ],'Weight calibration and structural text editing are different actions. Fix or cancel incomplete syntax before generating. Releasing a handle or editing text never generates automatically.'],
    ja:['カメラ：直接直して作業を続ける','手・服・背景・隠れる部分が意図と違う場合は文章を直接直して続けます。自動の姿勢分析や可視性推論に置き換える機能ではありません。',[
      '次の生成文で管理対象の数値だけを変えると重みの補正です。人物・服装・行動・ポーズ・背景の文章も直接編集できます。',
      'カメラタグの追加・削除・置換が自動管理と競合すると、手動の文章を使う状態になります。修正を優先し、ハンドルを動かしても黙って上書きしません。',
      '「この文章のカメラ管理を再開」でパネルと再接続できます。以前の文章は「復帰・編集を取り消す」で戻せます。「現在の文章を残してカメラを無効化」は有効な出力文を通常の作業台へ渡し、直接編集を続けられます。',
      '「この構図で生成」で送信します。生成中の編集は次のリクエストに適用され、送信済みの内容は開始時のスナップショットを維持します。「実際の送信内容」で品質・UC 処理後の文章も確認できます。'
    ],'数値の補正と文章の構造の編集は別の操作です。未完了の構文は修正または取り消してから生成します。ドラッグ終了や編集だけで自動生成はしません。']},
  {id:'camera-recovery',image:'camera-editing',
    ko:['카메라: 잘못된 입력 복구','입력 오류는 내용이 삭제되는 이유가 아닙니다. 오류를 고치거나 취소하고 같은 작업을 이어갈 수 있습니다.',[
      '1.처럼 미완성인 숫자나 닫히지 않은 ::는 화면에 남고 생성이 차단됩니다. 숫자·문법을 완성하거나 현재 미완성 편집 취소를 누르세요. 취소 전 내용도 복귀·편집 취소로 복구할 수 있습니다.',
      '0과 음수도 -10~10 범위에서 입력할 수 있습니다. 이는 표현을 억제하는 요청일 수 있으며 위치 이동을 뜻하지 않습니다. 지원 범위를 넘거나 소수 자릿수가 많으면 오류 안내를 따르세요.',
      '기본값이 작은 위치에서 크게 보정하면 이동 후 보간 결과가 범위를 넘을 수 있습니다. 보정 위치로 돌아가 낮추거나 보정 기록에서 해당 보정을 되돌리거나 보정 적용 해제를 누릅니다. 값을 조용히 잘라 전송하지 않습니다.',
      '혼합 가중치 묶음은 비카메라 내용을 보호하기 위해 적용 보류될 수 있습니다. 문구를 직접 정리하거나 수동 상태로 사용하세요. 전체를 다시 시작하려면 원본 전체 복원 후 필요하면 취소할 수 있습니다.'
    ],'다른 원본으로 전환하거나 카메라 적용을 쓰지 않는 기존 작업을 계속할 수도 있습니다. 오류를 무시해 예전 정상값을 최신 입력처럼 보내지 않습니다.'],
    en:['Camera: recover from invalid input','An input error does not delete your work. Fix it or cancel the edit and continue.',[
      'An unfinished number such as 1. or an unclosed :: remains visible and blocks generation. Complete it or press Cancel current incomplete edit. Undo reset / edit can recover the canceled input.',
      'Zero and negative values are accepted within -10 to 10. They may suppress an expression; they do not mean camera movement. Follow the error guidance for out-of-range values or excessive decimal places.',
      'A large correction where the base weight is small can exceed the supported range after movement. Return to its point and reduce it, remove that correction in the records, or disable calibration. Values are never silently clipped for transmission.',
      'A mixed weight group may be held to protect non-camera content. Edit its structure yourself or use manual text. Restore entire source starts again from the original conditions and can be undone.'
    ],'You can switch sources or continue ordinary work without camera application. An error never causes an old valid value to be sent as though it were your latest input.'],
    ja:['カメラ：入力エラーから復帰する','入力エラーがあっても作業内容は削除しません。修正または取り消して続けられます。',[
      '1. のような未完了の数値や閉じていない :: は画面に残り、生成を止めます。完成させるか「現在の未完了の編集を取り消す」を押します。取り消した入力も「復帰・編集を取り消す」で復元できます。',
      '0 と負の値も -10～10 の範囲で入力できます。表現を抑制する指定になる場合があり、カメラ移動を意味しません。範囲や小数桁のエラーは案内に従って直します。',
      '基本値が小さい位置で大きく補正すると、移動後の補間値が範囲を超える場合があります。補正点に戻して値を下げるか、記録から個別に戻すか、補正の適用を解除します。黙って値を切り詰めて送信しません。',
      '混在する重みのグループはカメラ以外の内容を守るため保留されることがあります。自分で構造を整理するか手動の文章を使います。「元の条件をすべて復元」で最初に戻り、必要なら取り消せます。'
    ],'別の元画像へ切り替えたり、カメラを使わない通常の作業を続けたりできます。以前の正常値を最新の入力と偽って送信しません。']},
  {id:'camera-records',image:'camera-calibration',
    ko:['카메라: 비교·기록·복귀','원본별 작업과 생성 결과를 구분해서 보관합니다. 새 결과는 비교 대상이며 자동으로 새 원본이 되지 않습니다.',[
      '왼쪽에서 원본과 새 결과를 비교하세요. 결과를 이어서 기준으로 쓰려면 이 결과를 새 출발점으로를 명시적으로 선택합니다. 저장된 카메라 기록 재개와는 별도 작업입니다.',
      '카메라만 복귀는 원본 기준 위치로 돌아가고 문구·크기·보정 기록은 유지합니다. 보정 적용 해제는 위치를 움직이지 않습니다. 개별 보정도 기록에서 되돌릴 수 있습니다.',
      '원본 전체 복원은 원래 문구·시드·크기·생성 설정을 복원하고 보정은 보관한 채 적용 해제합니다. 복귀·편집 취소는 직전 복귀나 복원을 취소합니다. 작업 원본 목록에서 다른 원본으로 갔다 돌아오면 해당 작업을 재개합니다.',
      '로컬 데이터 폴더의 data/camera에 원본별 작업과 선택한 가져오기 이미지가 저장됩니다. 생성 결과의 History JSON에는 camera_context가 추가됩니다. 이 기록으로 재개할 때는 보정 숫자에서 각도를 다시 추정하지 않습니다.'
    ],'일반 PNG/WebP만 복사하면 생성 메타데이터는 읽을 수 있어도 모든 카메라 작업·보정 기록이 따라가는 것은 아닙니다. 앱 데이터와 History를 백업하세요. 저장된 기록과 실제 문구가 충돌하면 자동 재개하지 않습니다.'],
    en:['Camera: compare, save and restore','Source-specific work and generated results are stored separately. A new result is a comparison, not an automatic replacement source.',[
      'Compare the source and new result on the left. Explicitly choose Use this result as a new source to establish another baseline. This is separate from resuming its saved camera record.',
      'Reset camera only returns to the source baseline while retaining text, size and correction records. Disable calibration leaves the position unchanged. Individual corrections can also be removed from the records.',
      'Restore entire source restores original text, seed, size and generation settings while retaining disabled corrections. Undo reset / edit undoes the previous reset or restore. Switch sources and return in Working source to resume that source’s work.',
      'The local data/camera folder stores source-specific work and selected imported images. Generation History JSON adds camera_context. Resuming this record uses stored camera coordinates instead of estimating angles from corrected weights.'
    ],'Copying only a normal PNG/WebP may preserve generation metadata but does not carry every camera session and correction. Back up application data and History. Conflicting stored records and actual text are not resumed automatically.'],
    ja:['カメラ：比較・記録・復帰','元画像ごとの作業と生成結果は分けて保存します。新しい結果は比較用で、自動的に元画像を置き換えません。',[
      '左で元画像と新しい結果を比べます。別の基準にするには「この結果を新しい出発点にする」を明示的に選びます。保存されたカメラ記録の再開とは別の作業です。',
      '「カメラだけを戻す」は基準位置へ戻し、文章・サイズ・補正記録は保持します。「補正の適用を解除」は位置を動かしません。記録から個別の補正も戻せます。',
      '「元の条件をすべて復元」は元の文章・シード・サイズ・生成設定に戻し、補正は保存して適用解除します。「復帰・編集を取り消す」で直前の復帰や復元を取り消します。作業の元画像一覧で別の画像へ移り、戻るとその作業を再開します。',
      'ローカルデータの data/camera に元画像ごとの作業と選んだ読み込み画像を保存します。生成履歴の JSON に camera_context を追加します。この記録からの再開は補正値で角度を推定せず、保存した座標を使います。'
    ],'通常の PNG/WebP だけをコピーしても、生成メタデータ以外のすべての作業・補正記録が付いてくるわけではありません。アプリデータと履歴をバックアップしてください。記録と実際の文章が矛盾する場合は自動再開しません。']},
  {id:'camera-limits',image:'camera-source',
    ko:['카메라: 한계와 생성 비용','원하는 위치와 표현 강도를 탐색하는 도구입니다. 모델이 모든 장면 조건을 완벽히 지키지는 못합니다.',[
      '드래그·가중치 편집·초기 기준 확인·비율 변경만으로는 요청하지 않습니다. 생성 버튼을 눌렀을 때 기존 계정·모델·설정에 따른 비용 안내를 확인합니다.',
      '시드가 같아도 자세·손·팔·고개·시선·배경·사물의 일관성을 보장하지 않습니다. 실제 결과가 다르면 문구나 가중치를 직접 고쳐 다시 생성하세요.',
      '제자리 팬·틸트, 물리적 높이와 상하 시점의 독립 효과는 불안정할 수 있습니다. 한 값씩 바꾸어 비교하세요. 롤도 실제 각도와 회전 방향을 정밀 보장하지 않습니다.',
      '시선 실험은 기본 꺼짐입니다. 켜면 충분히 방향을 옮겼을 때 명확한 looking at viewer 제약만 해제하며 looking over shoulder 같은 고개 자세 문구는 유지합니다. 이것도 시선·고개 고정을 보장하지 않습니다.'
    ],'실제 생성에는 인터넷과 NovelAI 계정·생성 권한이 필요하며 Anlas 또는 V5 Stamina 조건을 따릅니다. 무료 생성으로 소개하지 않습니다. 코드·mock·Electron 동작 검증과 모델의 이미지 품질 검증은 서로 다릅니다.'],
    en:['Camera: limits and generation costs','Explore a target position and expression strength. The model cannot preserve every scene condition perfectly.',[
      'Dragging, editing weights, confirming a baseline and changing aspect ratio do not send generation requests. When you press Generate, follow the existing cost guidance for your account, model and settings.',
      'The same seed does not guarantee consistent pose, hands, arms, head, gaze, background or objects. If a result differs from your intent, edit the text or weights and generate again.',
      'Independent pan/tilt in place and separation of physical height from elevation can be unstable. Compare one control at a time. Roll does not guarantee an exact image angle or rotation direction either.',
      'The gaze experiment is off by default. When enabled and the direction changes sufficiently, it releases only clear looking at viewer constraints while retaining head-pose text such as looking over shoulder. It does not guarantee fixed gaze or head pose.'
    ],'Live generation requires internet and a NovelAI account with generation access and follows Anlas or V5 Stamina conditions. Generation is not advertised as free. Code, mock and Electron checks are distinct from image-quality testing.'],
    ja:['カメラ：制限と生成費用','目標の位置と表現の強さを探す道具です。モデルが場面の全条件を完全に守るとは限りません。',[
      'ドラッグ・重みの編集・基準の確認・比率変更だけでは生成リクエストを送りません。生成を押したときに、既存のアカウント・モデル・設定による費用案内を確認します。',
      '同じシードでも姿勢・手・腕・頭・視線・背景・物体の一貫性は保証されません。意図と違えば文章や重みを直接直して再生成します。',
      'その場のパン・チルトや物理的な高さと上下視点の独立した効果は不安定な場合があります。一つずつ変えて比較してください。ロールも正確な画像角度や回転方向を保証しません。',
      '視線の実験は初期状態ではオフです。有効にして方向を十分に変えると、明確な looking at viewer の制約だけを外し、looking over shoulder など頭の姿勢の文章は保持します。視線・頭の固定を保証するものではありません。'
    ],'実際の生成にはインターネットと生成権限のある NovelAI アカウントが必要で、Anlas または V5 スタミナの条件に従います。無料生成として案内しません。コード・mock・Electron の検証と画像品質の検証は別です。']},
];

// Preserve the seven chapter IDs and released artwork. Label the old screenshots
// explicitly while the private implementation is being evaluated.
const ruleHelp={
  ko:{controls:'새 v2 작업은 위치를 연속 저장하되 방향·상하 시점·높이·프레이밍마다 대표 표현 하나를 선택합니다. 방향 구간은 중심각의 ±22.5°이며 시작 포함·끝 제외입니다. 경계에서 태그가 바뀌어도 손잡이 위치는 고정 각도로 튀지 않습니다.',saved:'이전 v1 작업과 History는 당시 혼합 계산으로 재개됩니다. 새 단일 방향 작업으로 복사를 누르면 미리보기에서 가져올 보정을 선택할 수 있습니다. 같은 원본·모델/Effort·슬롯·표현·위치에 맞는 절대값만 가져오며, 선택 불가 기록은 이전 작업에 남습니다. 취소는 아무것도 바꾸지 않고, 적용하면 별도 v2 작업이 저장됩니다. v2에서도 이전 보정 선택 가져오기와 복귀·편집 취소를 사용할 수 있습니다.',editing:'다른 슬롯이나 수동 문구에 카메라 조건이 남으면 위치와 문구를 표시합니다. 원문은 유지되므로 직접 확인하고 수정하세요.',recovery:'이전 v1 계산이나 팬·틸트·롤 보정에서 이동 후 지원 범위를 넘으면 값을 낮추거나 해당 보정을 되돌리거나 보정 적용 해제를 누르세요. 값을 조용히 잘라 보내지 않습니다.',image:'v3.8.0 조작 화면 참고용입니다. 혼합 숫자가 보이면 이전 v1 예시이며, 새 v2 방식은 아래 절차를 따르세요.'},
  en:{controls:'New v2 work stores continuous positions but selects one representative expression for each direction, elevation, height and framing axis. Direction sectors span ±22.5° around each center and include their start but exclude their end. A tag change at a boundary does not snap the handle.',saved:'Legacy v1 work and History resume the original blended calculation. Copy to a new single-direction work opens a preview where you can select calibrations. Only absolute values matching source, model/Effort, field, expression and position can be imported; unavailable records stay in the original work. Cancel changes nothing; Apply creates a separate v2 work. In v2, Select legacy calibrations to import and Undo reset / edit remain available.',editing:'Camera conditions left in manual text or other fields are shown with their location. Original text is retained for you to inspect and edit.',recovery:'If movement exceeds the supported range in legacy v1 or pan/tilt/roll calibration, reduce the value, remove that correction or disable calibration. Values are not silently clipped.',image:'v3.8.0 controls shown for reference. Blended numbers illustrate legacy v1; follow the steps below for new v2 work.'},
  ja:{controls:'新しいv2作業は位置を連続的に保存し、方向・上下視点・高さ・フレーミングの各軸で代表表現を1つ選びます。方向の区間は中心角の±22.5°で、始点を含み終点を含みません。境界でタグが変わってもハンドルは固定角度へ飛びません。',saved:'以前のv1作業と履歴は当時の混合計算で再開します。「単一方向の新しい作業にコピー」で補正を選ぶプレビューを開きます。同じ元画像・モデル/Effort・スロット・表現・位置に合う絶対値だけを読み込み、選べない記録は元の作業に残します。キャンセルは何も変えず、適用すると別のv2作業を保存します。v2でも以前の補正の読み込みと「復帰・編集を取り消す」が使えます。',editing:'手動の文章や他の欄に残ったカメラ条件は場所と文章を表示します。原文は保持するので、自分で確認して修正してください。',recovery:'以前のv1計算やパン・チルト・ロール補正で移動後に対応範囲を超える場合は、値を下げるか、その補正を戻すか、補正を解除します。値を黙って切り詰めて送信しません。',image:'v3.8.0の操作画面を参考として表示しています。混合された数値は以前のv1の例です。新しいv2は下の手順を参照してください。'}
};
for(const chapter of cameraChapters){
  chapter.imageNote=Object.fromEntries(Object.entries(ruleHelp).map(([locale,help])=>[locale,help.image]));
  for(const [locale,help] of Object.entries(ruleHelp)){
    if(chapter.id==='camera-controls')chapter[locale][2][0]+=' '+help.controls;
    if(chapter.id==='camera-editing')chapter[locale][2][1]+=' '+help.editing;
    if(chapter.id==='camera-recovery')chapter[locale][2][2]=help.recovery;
    if(chapter.id==='camera-records')chapter[locale][2][3]+=' '+help.saved;
  }
}
