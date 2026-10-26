// Presentation strings only. Prompts, filenames and calibration expression labels stay verbatim.
const rows = `
카메라	Camera	カメラ
카메라로 새 구도	Explore with camera	カメラで構図を探す
카메라 보정 적용 중	Camera adjustments active	カメラ調整を適用中
카메라 · 가중치 보정	Camera · weight calibration	カメラ・重みの補正
작업 원본	Working source	作業の元画像
원본 선택	Choose a source	元画像を選択
카메라 비활성화	Disable camera, keep current text	現在の文章を残してカメラを無効化
History나 최근 결과의 ‘카메라로 새 구도’, 또는 이미지 가져오기의 카메라 버튼에서 시작하세요.	Start with Explore with camera in History, the latest result, or image import.	履歴・最新結果の「カメラで構図を探す」、または画像読み込みのカメラボタンから始めます。
보존된 카메라 원본	Preserved camera source	保持されたカメラ元画像
새 결과 · 기준본은 그대로 유지	New result · source stays unchanged	新しい結果・基準の元画像はそのまま
카메라 생성 비교 결과	Camera comparison result	カメラ生成の比較結果
이 결과를 새 출발점으로	Use this result as a new source	この結果を新しい出発点にする
중심 주위 이동	Orbit the subject	被写体の周囲を移動
카메라를 직접 잡아 이동	Drag the camera handle	カメラのハンドルをドラッグ
카메라 위치 입력용 구체 도식	Sphere for entering the target camera position	目標カメラ位置を入力する球体図
카메라 위치 손잡이	Camera position handle	カメラ位置のハンドル
제자리 팬·틸트	Pan / tilt in place	その場でパン・チルト
팬·틸트 손잡이	Pan / tilt handle	パン・チルトのハンドル
롤 · 화면 기울기	Roll · frame rotation	ロール・画面の傾き
롤 손잡이	Roll handle	ロールのハンドル
카메라 높이	Camera height	カメラの高さ
높이 손잡이	Height handle	高さのハンドル
거리·프레이밍	Distance / framing	距離・フレーミング
프레이밍 손잡이	Framing handle	フレーミングのハンドル
바닥	Floor	床
허리	Waist	腰
눈	Eyes	目
머리 위	Above head	頭上
가까이	Close	近く
허벅지까지	Thigh framing	太ももまで
넓게	Wide	広く
출력	Output	出力
정사각	Square	正方形
촬영 목표 입력 도식 · 각도는 범주 대표값입니다.	Target camera diagram · angles represent view categories.	撮影目標を入力する図です。角度は視点の区分を代表する値です。
팬·틸트·높이·롤의 독립 효과와 시선 보존은 실험적입니다.	Independent pan, tilt, height, roll and gaze preservation are experimental.	パン・チルト・高さ・ロールの独立した効果と視線の保持は実験的です。
시선 실험: 이동 시 looking at viewer 제약 해제	Gaze experiment: release looking at viewer when moving	視線の実験：移動時に looking at viewer の制約を外す
현재 카메라 적용 후 · 다음 생성에 사용할 문구	After camera adjustments · text for the next generation	カメラ適用後・次の生成に使う文章
관리 위치	Managed field	管理する入力欄
카메라 적용 후 직접 편집할 생성 문구	Editable generation text after camera adjustments	カメラ適用後に直接編集する生成文
카메라만 복귀	Reset camera only	カメラだけを戻す
보정 적용 해제	Disable calibration	補正の適用を解除
보정 다시 적용	Enable calibration again	補正を再適用
원본 전체 복원	Restore entire source	元の条件をすべて復元
복귀·편집 취소	Undo reset / edit	復帰・編集を取り消す
현재 미완성 편집 취소	Cancel current incomplete edit	現在の未完了の編集を取り消す
이 문구의 카메라 관리 재개	Reconnect camera control for this field	この文章のカメラ管理を再開
이 구도로 생성	Generate this view	この構図で生成
카메라만 복귀: 문구·크기·보정 기록 유지 / 전체 복원: 원본 문구·설정으로 복원, 보정은 보관 후 적용 해제 / 취소 가능	Camera reset keeps text, size and calibration records. Full restore restores source text/settings and disables retained calibration. Undo is available.	カメラだけの復帰は文章・サイズ・補正記録を保持。全体復元は元の文章・設定に戻し、補正を保存して適用解除。取り消しもできます。
사용자 보정 기록 · 해당 표현의 주변 구간에 적용	Calibration records · applied near each expression's control point	補正記録・各表現の補正点付近に適用
실제 전송 문구 · 기존 품질·UC 처리 포함	Actual request · including quality / UC processing	実際の送信内容・品質とUCの処理を含む
생성 준비 후 확인할 수 있습니다.	Available after generation is prepared.	生成の準備後に確認できます。
그림과 기준이 다르면 수정	Edit baseline if it differs from the picture	絵と基準が違う場合は修正
카메라 사용 안내	Camera guide	カメラの使い方
생성 중에도 편집할 수 있습니다. 수정은 다음 요청에 반영됩니다.	You can edit during generation. Changes apply to the next request.	生成中も編集できます。変更は次のリクエストに反映されます。
정면	Front	正面
오른쪽 앞	Front right	右前
오른쪽	Right	右
오른쪽 뒤	Rear right	右後ろ
후면	Back	背面
왼쪽 뒤	Rear left	左後ろ
왼쪽	Left	左
왼쪽 앞	Front left	左前
오른쪽 측면	Right side	右側面
왼쪽 측면	Left side	左側面
중심	Center	中心
뒤쪽	Rear	後ろ
인물 정면 ↓	Subject front ↓	被写体の正面 ↓
인물 왼쪽	Subject's left	被写体の左
인물 오른쪽	Subject's right	被写体の右
기준 확인	Check baseline	基準を確認
눈높이 시점	Eye-level view	目の高さの視点
위에서	From above	上から
거의 수직 위	Almost overhead	ほぼ真上
아래에서	From below	下から
거의 수직 아래	Almost underneath	ほぼ真下
클로즈업	Close-up	クローズアップ
상반신	Upper body	上半身
전신	Full body	全身
넓은 샷	Wide shot	ワイドショット
원본 기준 직접 수정 · 기존 보정은 보관 후 적용 해제	Edit source baseline · previous calibration is retained but disabled	元画像の基準を修正・既存の補正を保存して適用解除
모르는 원본 기준만 확인	Confirm only missing source information	不明な元画像の基準だけを確認
이 항목 유지	Keep this item	この項目は維持
선택하세요	Choose	選択してください
선택한 기준 기록	Save selected baseline	選んだ基準を記録
사용자 확인	Confirmed by user	ユーザーによる確認
저장된 생성 기록	Saved generation record	保存された生成記録
원본 문구의 범주	Source prompt category	元の文章の区分
저장된 확인 기록	Saved confirmation	保存された確認記録
방향	Direction	方向
상하 시점	Elevation	上下の視点
제자리 팬	Pan in place	その場でパン
제자리 틸트	Tilt in place	その場でチルト
롤	Roll	ロール
방향 미확인	Direction unknown	方向は未確認
상하 시점 미확인	Elevation unknown	上下の視点は未確認
미확인	Unknown	未確認
상하 대표값 {value}°	Representative elevation {value}°	上下視点の代表値 {value}°
원본 기준: {bearing} / {elevation} / 프레이밍 {framing}	Source baseline: {bearing} / {elevation} / framing {framing}	元画像の基準：{bearing} / {elevation} / フレーミング {framing}
{bearing} · 원본에서 {value}°	{bearing} · {value}° from source	{bearing}・元画像から {value}°
방향 기준을 먼저 확인하세요	Confirm the source direction first	先に元画像の方向を確認してください
상하 {value}	Elevation {value}	上下 {value}
팬 {pan} · 틸트 {tilt} (조작량)	Pan {pan} · tilt {tilt} (control values)	パン {pan}・チルト {tilt}（操作量）
원본 유지 · 기울기 미확인	Keep source · roll unknown	元を維持・傾きは未確認
목표 {value}°	Target {value}°	目標 {value}°
원본 유지 · 물리적 높이 미확인	Keep source · physical height unknown	元を維持・物理的な高さは未確認
높이 조작값 {value}	Height control {value}	高さの操作値 {value}
수동 문구 유지 · 관리 재개 가능	Manual text active · camera control can be reconnected	手動の文章を使用中・カメラ管理を再開できます
사용자 보정 적용 · 카메라 위치는 그대로	User calibration applied · camera position unchanged	ユーザー補正を適用・カメラ位置はそのまま
기본 대응 적용	Default mapping applied	基本の対応を適用
이 보정 되돌리기	Remove this correction	この補正を戻す
원본에서 {value}°	{value}° from source	元画像から {value}°
조작값 {value}	Control value {value}	操作値 {value}
아직 보정 기록이 없습니다. 생성 문구의 숫자를 직접 수정하세요. 지원 범위 -10~10, 소수 셋째 자리.	No corrections yet. Edit a number in the generation text. Supported range: -10 to 10, up to 3 decimal places.	補正記録はまだありません。生成文の数値を直接編集してください。対応範囲は -10～10、小数点以下3桁までです。
V4.5 읽기 자료입니다. 기존 작업대에서 V5로 명시적으로 전환해야 생성할 수 있습니다.	This is a V4.5 record. Explicitly switch to V5 in the workbench before generating.	V4.5 の資料です。生成するにはワークベンチで明示的に V5 へ切り替えてください。
카메라 관리를 다시 연결했습니다. 복귀·편집 취소로 이전 문구를 복구할 수 있습니다.	Camera control reconnected. Undo reset / edit restores the previous text.	カメラ管理を再接続しました。「復帰・編集を取り消す」で以前の文章に戻せます。
완전한 가중치 숫자를 입력하세요.	Enter a complete weight number.	重みの数値を最後まで入力してください。
카메라 작업 저장 실패: {message}	Camera work could not be saved: {message}	カメラ作業を保存できませんでした：{message}
수동 문구 유지 · 카메라 관리 재개를 누르면 연결합니다.	Manual text is used. Press Reconnect camera control to manage it again.	手動の文章を使用します。カメラ管理の再開を押すと再接続します。
{field}: 혼합 가중치 묶음을 보존했습니다. 해당 축은 적용 보류.	{field}: mixed weight group preserved; this axis is held.	{field}：混在する重みのグループを保持し、この軸の適用を保留しました。
모델/Effort가 바뀌어 이전 보정을 보류했습니다. 원래 조건에서는 재사용됩니다.	Previous model/Effort corrections are held and reused when those conditions return.	以前のモデル・Effort の補正は保留され、元の条件に戻ると再利用されます。
시선 실험: looking at viewer 제약 해제. 고개 자세 문구는 유지.	Gaze experiment: looking at viewer released; head-pose text retained.	視線の実験：looking at viewer の制約を外し、頭の姿勢の文章は保持。
관리하던 슬롯이 삭제되거나 비활성화됐습니다. 활성 문구를 선택하세요. 기존 보정은 보관 중입니다.	The managed slot was removed or disabled. Choose an active field. Its corrections are retained.	管理中のスロットが削除または無効化されました。有効な入力欄を選んでください。補正は保存されています。
{field}: 삭제되거나 비활성화된 문구의 수동 편집과 보정을 보관 중입니다.	{field}: manual edits and corrections are retained for the removed or disabled field.	{field}：削除・無効化された入力欄の手動編集と補正を保存しています。
먼저 원본의 {field} 기준을 확인하세요.	Confirm the source {field} baseline first.	先に元画像の {field} の基準を確認してください。
저장된 카메라 기록과 실제 프롬프트가 다릅니다. 기준을 확인해야 합니다.	The saved camera record differs from the actual prompt. Check the source before resuming.	保存したカメラ記録と実際のプロンプトが異なります。再開する前に基準を確認してください。
이 History에는 재사용할 생성 조건이 없습니다.	This History record has no reusable generation conditions.	この履歴には再利用できる生成条件がありません。
카메라 패널에는 읽을 수 있는 NAI 생성 메타데이터가 필요합니다.	The camera panel needs readable NAI generation metadata.	カメラパネルには読み取れる NAI 生成メタデータが必要です。
Weight needs a complete number with at most 3 decimal places.	가중치는 소수 셋째 자리 이내의 완전한 숫자여야 합니다. 입력을 수정하거나 미완성 편집을 취소하세요.	重みは小数点以下3桁以内の完全な数値で入力します。修正するか未完了の編集を取り消してください。
Supported camera weights: -10 to 10.	카메라 가중치 지원 범위는 -10~10입니다. 값을 수정하거나 편집을 취소하세요.	カメラの重みは -10～10 に対応します。値を直すか編集を取り消してください。
Interpolated weight exceeds the supported range. Adjust this calibration.	이동 후 보간된 가중치가 -10~10을 넘었습니다. 보정 위치로 돌아가 값을 낮추거나, 보정 기록에서 해당 보정을 되돌리거나 적용을 해제하세요.	移動後の補間値が -10～10 を超えました。補正点に戻って値を下げるか、記録からその補正を戻すか適用を解除してください。
Incomplete or invalid camera prompt edit.	카메라 문구 편집이 미완성이거나 잘못되었습니다. 입력을 수정하거나 미완성 편집을 취소하세요.	カメラ文の編集が未完了または無効です。入力を修正するか未完了の編集を取り消してください。
Finish the invalid prompt edit before moving the camera.	입력을 수정하거나 미완성 편집을 취소한 뒤 카메라를 움직이세요.	入力を修正するか未完了の編集を取り消してからカメラを動かしてください。
Fix or cancel the incomplete edit before disabling camera. Your input is retained.	카메라를 끄기 전에 잘못된 입력을 수정하거나 미완성 편집을 취소하세요. 입력은 보존됩니다.	カメラを無効にする前に入力を修正するか未完了の編集を取り消してください。入力は保持されます。
Unexpected closing ::	예상하지 않은 닫는 ::가 있습니다. 문법을 수정하거나 편집을 취소하세요.	対応する開始がない :: があります。構文を直すか編集を取り消してください。
Unclosed numeric weight (::)	가중치의 닫는 ::가 없습니다. 문법을 수정하거나 편집을 취소하세요.	重みを閉じる :: がありません。構文を直すか編集を取り消してください。
Unclosed {kind}	{kind} 구문이 닫히지 않았습니다. 문법을 수정하거나 편집을 취소하세요.	{kind} の構文が閉じていません。修正するか編集を取り消してください。
Camera prompt field unavailable.	활성 카메라 문구를 선택하세요.	有効なカメラの入力欄を選んでください。
Invalid camera baseline.	원본 기준값이 올바르지 않습니다. 기준 수정에서 다시 선택하세요.	元画像の基準値が無効です。基準の編集から選び直してください。
Invalid camera control.	카메라 조작값이 올바르지 않습니다. 손잡이나 방향 버튼으로 다시 지정하세요.	カメラ操作値が無効です。ハンドルまたは方向ボタンで指定し直してください。
Unsupported camera rule version.	이 카메라 기록의 버전을 지원하지 않습니다. 원본 이미지를 새 출발점으로 선택하세요.	このカメラ記録の版には対応していません。元画像を新しい出発点として選択してください。
Camera field is not available.	해당 문구 위치를 사용할 수 없습니다. 관리 위치를 다시 선택하세요.	その入力欄は使用できません。管理する欄を選び直してください。
Invalid camera session.	카메라 작업 기록이 올바르지 않습니다. 다른 저장 작업을 선택하거나 원본에서 다시 시작하세요.	カメラ作業の記録が無効です。別の保存済み作業を選ぶか元画像から再開してください。
Only an active camera expression can be calibrated.	현재 적용 중인 카메라 표현만 보정할 수 있습니다. 위치를 확인하거나 문구를 직접 편집하세요.	現在適用中のカメラ表現だけを補正できます。位置を確認するか文章を直接編集してください。
Camera prompt slot no longer exists.	해당 캐릭터 문구 슬롯이 없습니다. 관리 위치를 다시 선택하세요.	そのキャラクター入力欄は存在しません。管理する欄を選び直してください。
Invalid camera source ID.	원본 식별자가 올바르지 않습니다. History나 이미지 가져오기에서 원본을 다시 선택하세요.	元画像の識別子が無効です。履歴または画像の読み込みから選び直してください。
Camera session is too large.	카메라 작업 기록이 저장 한도를 넘었습니다. 현재 문구를 프리셋으로 저장하고 새 원본에서 시작하세요.	カメラ作業の記録が保存上限を超えました。現在の文章をプリセットに保存し、新しい元画像から始めてください。
Source image hash mismatch.	원본 이미지의 무결성 확인에 실패했습니다. 파일을 다시 가져오세요.	元画像の整合性を確認できませんでした。ファイルを読み込み直してください。
Camera source exceeds 30 MiB.	카메라 원본은 30 MiB 이하만 지원합니다. 메타데이터를 유지한 더 작은 파일을 선택하세요.	カメラの元画像は30 MiB以下に対応します。メタデータを保持した小さいファイルを選んでください。
Camera metadata sources support PNG and WebP.	카메라 메타데이터 원본은 PNG와 WebP를 지원합니다. 지원 파일을 선택하세요.	カメラのメタデータ読み込みはPNGとWebPに対応します。対応ファイルを選択してください。
Invalid source image hash.	원본 이미지 식별값이 올바르지 않습니다. 파일을 다시 가져오세요.	元画像の識別値が無効です。ファイルを読み込み直してください。
Camera source mismatch.	저장하려는 작업과 원본이 다릅니다. 원본 작업을 다시 선택하세요.	保存する作業と元画像が一致しません。元の作業を選び直してください。
Camera uses text-to-image conditions; change the generation mode explicitly.	카메라는 텍스트 기반 생성 조건을 사용합니다. 생성 방식을 T2I로 직접 바꾸세요.	カメラはテキストからの生成条件を使います。生成方式をT2Iに切り替えてください。
Camera record is too large.	전송할 카메라 기록이 너무 큽니다. 현재 문구를 저장하고 새 원본에서 시작하세요.	送信するカメラ記録が大きすぎます。現在の文章を保存し、新しい元画像から始めてください。
Invalid camera source snapshot.	저장된 원본 생성 조건이 올바르지 않습니다. 원본 이미지나 History를 다시 선택하세요.	保存された元の生成条件が無効です。元画像または履歴を選び直してください。
Incomplete camera record.	카메라 기록이 완전하지 않습니다. 다른 저장 작업을 선택하거나 원본에서 다시 시작하세요.	カメラ記録が不完全です。別の保存済み作業を選ぶか元画像から再開してください。
Invalid camera coordinate.	카메라 좌표가 올바르지 않습니다. 카메라만 복귀하거나 원본에서 다시 시작하세요.	カメラ座標が無効です。カメラだけを戻すか元画像から再開してください。
Camera comparisons require an explicit source seed.	카메라 비교에는 원본의 확정 시드가 필요합니다. 시드를 직접 입력한 뒤 다시 생성하세요.	カメラ比較には確定した元のシードが必要です。シードを入力してから再度生成してください。
Camera uses text-to-image conditions.	카메라는 텍스트 기반 생성을 사용합니다. 생성 방식을 T2I로 바꾸세요.	カメラはテキストからの生成を使います。生成方式をT2Iに切り替えてください。
Camera source or revision changed. Prepare the request again.	원본이나 편집 상태가 바뀌었습니다. 최신 문구를 확인하고 생성 버튼을 다시 누르세요.	元画像または編集状態が変わりました。最新の文章を確認し、生成ボタンを押し直してください。
새 단일 방향 작업으로 복사	Copy to a new single-direction work	単一方向の新しい作業にコピー
이전 보정 선택 가져오기	Select legacy calibrations to import	以前の補正を選んで読み込む
단일 방향 작업 미리보기	Preview single-direction work	単一方向の作業プレビュー
원래 작업은 보존됩니다. 선택한 보정의 절대값만 새 계산에 적용합니다.	The original work is preserved. Only selected absolute calibration values are applied to the new calculation.	元の作業は保持されます。選択した補正の絶対値だけを新しい計算に適用します。
선택할 수 없는 보정은 이전 기록에 보관됩니다.	Unavailable calibrations remain in the legacy record.	選択できない補正は以前の記録に保持されます。
현재 문구	Current text	現在の文章
적용 후 문구	Text after applying	適用後の文章
선택 적용	Apply selection	選択を適用
가져올 이전 보정이 없습니다.	No legacy calibrations to import.	読み込む以前の補正はありません。
다른 원본	Different source	元画像が異なります
모델 또는 Effort가 다름	Different model or Effort	モデルまたはEffortが異なります
슬롯이 달라짐	Slot has changed	スロットが変更されています
수동 문구 유지 중	Manual text is active	手動の文章を保持中
위치 기록 없음	No recorded position	位置の記録がありません
이 위치에서 선택되지 않는 표현	Expression not selected at this position	この位置では選択されない表現
올바르지 않은 보정값	Invalid calibration value	無効な補正値
이전 v1 작업 · 당시의 혼합 계산 유지	Legacy v1 work · original blended calculation retained	以前のv1作業 · 当時の混合計算を維持
단일 방향 v2 · 위치는 연속 이동, 축마다 대표 표현 하나	Single-direction v2 · continuous position, one representative expression per axis	単一方向v2 · 位置は連続移動、各軸の代表表現は1つ
수동·다른 문구의 카메라 조건도 확인하세요. 원문은 유지됩니다.	Check camera conditions in manual or other text too. Original text is retained.	手動・他の文章にあるカメラ条件も確認してください。原文は保持されます。
Unsupported camera rule version.	지원하지 않는 카메라 규칙입니다. 원래 기록은 보존됩니다.	未対応のカメラ規則です。元の記録は保持されます。
Invalid camera calibration.	카메라 보정 기록을 확인하세요. 보정 적용 해제로 복구할 수 있습니다.	カメラ補正の記録を確認してください。補正を解除して復旧できます。
Invalid camera migration.	이전 작업을 새 작업으로 복사할 수 없습니다.	以前の作業を新しい作業にコピーできません。
Select camera calibrations to import.	가져올 보정을 선택하세요.	読み込む補正を選択してください。
Camera calibration is not compatible.	조건이 일치하지 않아 이 보정을 가져올 수 없습니다.	条件が一致しないため、この補正を読み込めません。
`.trim().split('\n');
export const cameraMessages=Object.fromEntries(rows.map(row=>{
  const [key,second,ja]=row.split('\t');
  return [key,{ko:/[가-힣]/.test(key)?key:second,en:/[가-힣]/.test(key)?second:key,ja}];
}));
