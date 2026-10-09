// English source text is the stable presentation key. User data is never a key.
const rows = `
Support Chaessi Preset	Chaessi Preset 개발 후원	Chaessi Preset の開発を応援
If Chaessi Preset helps you, please consider a one-time donation of $3 for a coffee.	Chaessi Preset이 도움이 되었다면 커피 한 잔 값인 $3로 일회성 후원을 부탁드립니다.	Chaessi Preset が役に立ったら、コーヒー1杯分の $3 を一度だけご支援いただけると嬉しいです。
☕ Buy Me a Coffee	☕ 개발자에게 커피 한 잔	☕ コーヒーで開発を応援
Chaessi Preset is free to use.	Chaessi Preset은 무료로 사용할 수 있습니다.	Chaessi Preset は無料で利用できます。
Support is optional. All features are available without donating.	후원은 선택사항입니다. 후원 없이도 모든 기능을 사용할 수 있습니다.	支援は任意です。支援しなくてもすべての機能を利用できます。
Opens Buy Me a Coffee in your browser. Check the amount and choose one-time support there.	브라우저에서 Buy Me a Coffee가 열립니다. 후원 페이지에서 금액을 확인하고 일회성 후원을 선택해 주세요.	ブラウザーで Buy Me a Coffee が開きます。支援ページで金額を確認し、単発の支援を選んでください。
Help	도움말	ヘルプ
Help Center	도움말 센터	ヘルプセンター
ⓘ Help Center	ⓘ 도움말 센터	ⓘ ヘルプセンター
Open Help Center	도움말 센터 열기	ヘルプセンターを開く
App info and help	앱 정보 및 도움말	アプリ情報とヘルプ
App info & Help	앱 정보 및 도움말	アプリ情報とヘルプ
Preset name…	프리셋 이름…	プリセット名…
prompt	프롬프트	プロンプト
undesired	제외 프롬프트	除外プロンプト
Clearing	삭제 중	削除中
{field} exceed the {n}-token context. NovelAI will truncate the excess.	{field}가 문맥 한도 {n}토큰을 넘었습니다. NovelAI가 초과 부분을 잘라냅니다.	{field} が文脈上限の {n}トークンを超えています。NovelAI は超過部分を切り詰めます。
Error details: {details}	오류 상세: {details}	エラーの詳細: {details}
Category name is required.	카테고리 이름을 입력하세요.	カテゴリ名を入力してください。
Subcategory name is required.	하위 카테고리 이름을 입력하세요.	サブカテゴリ名を入力してください。
V5 Stamina {value}	V5 스태미나 {value}	V5 スタミナ {value}
unknown	알 수 없음	不明
Unknown	알 수 없음	不明
{n} images · {source}	이미지 {n}장 · {source}	画像 {n}枚 · {source}
Strength numeric value	변경 강도 숫자 값	変更の強さの数値
Fidelity numeric value	충실도 숫자 값	忠実度の数値
Precise Reference dimensions could not be read.	정밀 참조 이미지 크기를 읽지 못했습니다.	精密参照の画像サイズを読み取れませんでした。
Could not encode Precise Reference.	정밀 참조 이미지를 변환하지 못했습니다.	精密参照の画像を変換できませんでした。
Character preset not found.	캐릭터 프리셋을 찾지 못했습니다.	キャラクタープリセットが見つかりません。
Preset not found.	프리셋을 찾지 못했습니다.	プリセットが見つかりません。
Response was not JSON.	서버 응답을 읽을 수 없습니다.	サーバーの応答を読み取れません。
{n} character presets loaded. {count} shown. Select a card to load into {target}.	캐릭터 프리셋 {n}개를 불러왔습니다. {count}개 표시 중. {target}에 불러올 카드를 선택하세요.	キャラクタープリセットを {n}件読み込みました。{count}件表示中。{target} に読み込むカードを選択してください。
Character {n} / {name}	캐릭터 {n} / {name}	キャラクター {n} / {name}
{n} tokens | context {context} / {limit}	{n} 토큰 | 전체 문맥 {context} / {limit}	{n} トークン | 共通文脈 {context} / {limit}
Seed {value}	시드 {value}	シード {value}
{n} steps	{n} 스텝	{n} ステップ
scale {value}	강도 {value}	強さ {value}
seed {value}	시드 {value}	シード {value}
rescale {value}	재조정 {value}	リスケール {value}
strength {value}	변경 강도 {value}	変更の強さ {value}
noise {value}	노이즈 {value}	ノイズ {value}
feather {value}%	경계 부드러움 {value}%	境界のぼかし {value}%
padding {value}px	여백 {value}px	余白 {value}px
original on	원본 합성 켜짐	元画像合成オン
original off	원본 합성 꺼짐	元画像合成オフ
Maximum estimated token count.	최대 예상 토큰 수.	最大推定トークン数。
Could not create thumbnail.	미리 보기를 만들지 못했습니다.	サムネイルを作成できませんでした。
Could not load thumbnail image.	미리 보기 이미지를 불러오지 못했습니다.	サムネイル画像を読み込めませんでした。
Unavailable	사용 불가	利用不可
unknown size	크기 알 수 없음	サイズ不明
Select History item	히스토리 선택	履歴を選択
Delete target changed. Please try again.	삭제 대상이 바뀌었습니다. 다시 시도하세요.	削除対象が変わりました。もう一度お試しください。
Generate One Image	이미지 한 장 생성	画像を1枚生成
Idle.	준비됨.	待機中。
Up	위로	上へ
Down	아래로	下へ
View Large	크게 보기	拡大表示
Reuse	재사용	再利用
Apply Params	설정 적용	設定を適用
Selected prompt for this request	이번 생성에 선택된 프롬프트	今回の生成に選ばれたプロンプト
Paint the area NovelAI should regenerate. Unpainted areas are preserved.	NovelAI가 다시 그릴 부분을 칠하세요. 칠하지 않은 부분은 보존됩니다.	NovelAI に描き直してほしい部分を塗ります。塗っていない部分は保持されます。
Generation Padding	생성 여백	生成範囲の余白
Expands the binary region sent to NovelAI before 8x8 mask alignment.	NovelAI에 보낼 마스크 영역을 넓힌 뒤 8×8 격자에 맞춥니다.	NovelAI に送るマスク領域を広げてから 8×8 の格子に合わせます。
Mask tool	마스크 도구	マスクのツール
Add files, drop images here, or focus this panel and paste.	파일을 추가하거나 이미지를 끌어 놓으세요. 이 영역에서 붙여넣기도 가능합니다.	ファイルを追加するか、画像をドロップします。この領域に貼り付けることもできます。
No Precise References selected.	선택한 정밀 참조가 없습니다.	精密参照が選択されていません。
No additional reference cost.	추가 참조 비용 없음.	参照の追加費用なし。
Type	유형	種類
Style	그림체	画風
Character & Style	캐릭터와 그림체	キャラクターと画風
Remove Precise Reference	정밀 참조 제거	精密参照を取り外す
Local generation records saved by the server.	이 앱에 저장된 생성 기록입니다.	このアプリに保存した生成記録です。
No character presets in this category.	이 카테고리에 프리셋이 없습니다.	このカテゴリにプリセットがありません。
No character prompts. Add one or import metadata with characters.	캐릭터를 추가하거나 캐릭터가 있는 메타데이터를 가져오세요.	キャラクターを追加するか、キャラクターを含むメタデータを読み込んでください。
No generations yet.	아직 생성한 이미지가 없습니다.	まだ生成画像がありません。
No imported character prompts.	가져온 캐릭터 프롬프트가 없습니다.	取り込んだキャラクタープロンプトがありません。
No subcategories yet.	하위 카테고리가 없습니다.	サブカテゴリがありません。
Previous PDF guides (v3.4.0)	이전 PDF 설명서 (v3.4.0)	以前の PDF マニュアル (v3.4.0)
App guide / 전체 앱 설명서	전체 앱 설명서	アプリ全体のマニュアル
Wildcard guide / Wildcard 설명서	와일드카드 설명서	ワイルドカードのマニュアル
From your first prompt to presets, image tools, and History.	프롬프트부터 프리셋, 이미지 도구, 히스토리까지.	プロンプトからプリセット、画像ツール、履歴まで。
Create a list, insert a reference, and generate with a selected candidate.	후보를 만들고 참조를 넣어 선택한 후보로 생성합니다.	候補を作成し、参照を挿入して選ばれた候補で生成します。
Choose one destination. Metadata import is a separate optional action.	사용처를 고르세요. 메타데이터 가져오기는 별도로 선택합니다.	用途を選択します。メタデータの取り込みは別の任意操作です。
Untitled	이름 없음	名前なし
Example: __tops__	예: __tops__	例: __tops__
{n} candidates	후보 {n}개	候補 {n}件
{n} active / {total} total	사용 {n}개 / 전체 {total}개	有効 {n}件 / 全 {total}件
Adds {n} Image Anlas per generated image.	이미지 한 장마다 Image Anlas {n}가 추가됩니다.	生成画像1枚ごとに Image Anlas {n}が追加されます。
Precise Reference added.	정밀 참조를 추가했습니다.	精密参照を追加しました。
{n} Precise References added.	정밀 참조 {n}개를 추가했습니다.	精密参照を {n}件追加しました。
Strength above 1 can overconstrain pose, composition, or style.	강도가 1보다 크면 자세·구도·그림체가 지나치게 제한될 수 있습니다.	強さが1を超えるとポーズ、構図、画風を強く制限する場合があります。
Multiple Character references blend together; they do not map to separate Character Slots.	여러 캐릭터 참조는 함께 섞이며 각 슬롯에 따로 연결되지 않습니다.	複数のキャラクター参照は混ざり、個別のスロットには対応しません。
High Style reference strength may overpower the surrounding Inpaint area.	그림체 참조 강도가 높으면 부분 수정 주변 영역에 영향을 줄 수 있습니다.	画風参照が強いと部分修正の周辺領域にも影響する場合があります。
Open a large prompt editor	확대 프롬프트 편집기 열기	拡大プロンプトエディターを開く
Position (Advanced)	위치 (상세)	位置 (詳細)
Fold Character {n}	캐릭터 {n} 접기	キャラクター {n} を折りたたむ
Character {n} position	캐릭터 {n} 위치	キャラクター {n} の位置
Selected: Character {n}	선택: 캐릭터 {n}	選択: キャラクター {n}
Overlap warning: {pairs} are closer than 0.1. Generation is still allowed.	겹침 안내: {pairs}의 거리가 0.1보다 작습니다. 생성은 가능합니다.	重なりの案内: {pairs} の距離が 0.1 未満です。生成は可能です。
{name} · original {original} · transmitted {transmitted}	{name} · 원본 {original} · 전송 {transmitted}	{name} · 元画像 {original} · 送信 {transmitted}
Generate or view an image first.	먼저 이미지를 생성하거나 보세요.	先に画像を生成するか表示してください。
Choose one source image for Image to Image or Inpaint.	이미지 생성이나 부분 수정에는 원본 한 장을 선택하세요.	画像生成や部分修正には元画像を1枚選んでください。
Drop one source image here. Use Open Image for multiple references.	여기에는 원본 한 장을 놓으세요. 여러 참조는 이미지 열기를 사용하세요.	ここには元画像を1枚ドロップしてください。複数の参照は画像を開くから追加します。
Source image ready.	원본 이미지가 준비되었습니다.	元画像の準備ができました。
Source image is too large. Use an image with 4,194,304 pixels or fewer.	원본 이미지가 너무 큽니다. 4,194,304픽셀 이하를 사용하세요.	元画像が大きすぎます。4,194,304 ピクセル以下の画像を使ってください。
Could not load the selected generation image.	선택한 결과 이미지를 불러오지 못했습니다.	選択した生成画像を読み込めませんでした。
Finish or close the current image intake first.	현재 이미지 가져오기를 끝내거나 닫으세요.	現在の画像取り込みを完了するか閉じてください。
Image to Image accepts one source image.	이미지로 생성에는 원본 한 장을 사용합니다.	画像から生成には元画像を1枚使います。
Inpaint accepts one source image.	부분 수정에는 원본 한 장을 사용합니다.	部分修正には元画像を1枚使います。
Only {n} Precise Reference slots are available.	정밀 참조 슬롯 {n}개를 더 사용할 수 있습니다.	精密参照スロットはあと {n}個使えます。
Only {n} Precise Reference slot is available.	정밀 참조 슬롯 {n}개를 더 사용할 수 있습니다.	精密参照スロットはあと {n}個使えます。
{n} images exceed the {remaining} remaining Precise Reference slots.	이미지 {n}장이 남은 정밀 참조 슬롯 {remaining}개보다 많습니다.	画像 {n}枚は残りの精密参照スロット {remaining}個を超えています。
Multiple images can be added to Precise Reference. Image to Image and Inpaint require one image.	여러 이미지는 정밀 참조에 추가할 수 있습니다. 이미지 생성과 부분 수정은 원본 한 장이 필요합니다.	複数の画像は精密参照に追加できます。画像生成と部分修正には元画像が1枚必要です。
NovelAI metadata detected. Import is optional and separate from image routing.	NovelAI 메타데이터를 찾았습니다. 이미지 사용과 별도로 가져올 수 있습니다.	NovelAI メタデータを検出しました。画像の用途とは別に任意で読み込めます。
No importable NovelAI metadata detected.	가져올 NovelAI 메타데이터가 없습니다.	取り込める NovelAI メタデータがありません。
Metadata imported. You can still choose an image destination.	메타데이터를 가져왔습니다. 이미지 사용처도 고를 수 있습니다.	メタデータを読み込みました。画像の用途も選択できます。
NovelAI token saved in secure local storage.	NovelAI 토큰이 안전한 로컬 저장소에 저장되어 있습니다.	NovelAI トークンを安全なローカル領域に保存しています。
NovelAI token configured from environment or local .env.	환경 설정 또는 로컬 .env의 NovelAI 토큰을 사용합니다.	環境設定またはローカル .env の NovelAI トークンを使っています。
NovelAI token is not configured.	NovelAI 토큰이 설정되지 않았습니다.	NovelAI トークンが設定されていません。
The selected item is not an image file.	선택한 항목은 이미지 파일이 아닙니다.	選択した項目は画像ファイルではありません。
Images must be smaller than 30 MB.	이미지는 30 MB보다 작아야 합니다.	画像は 30 MB 未満にしてください。
Use a PNG, WebP, or JPEG image.	PNG, WebP, JPEG 이미지를 사용하세요.	PNG、WebP、JPEG の画像を使ってください。
Image dimensions could not be read.	이미지 크기를 읽을 수 없습니다.	画像サイズを読み取れませんでした。
Use 1-64 lowercase letters, numbers, single underscores or hyphens for the key.	키는 영문 소문자·숫자·단일 밑줄·하이픈으로 1~64자까지 쓸 수 있습니다.	キーは英小文字、数字、単一の下線、ハイフンで1～64文字にしてください。
Each candidate must be one line of text.	후보는 한 줄씩 입력하세요.	候補は1行に1つ入力してください。
Add at least one candidate.	후보를 하나 이상 입력하세요.	候補を1件以上入力してください。
Wildcard exceeds 100,000 candidates or 5 MB of text.	와일드카드는 후보 100,000개 또는 텍스트 5 MB를 넘을 수 없습니다.	ワイルドカードは候補100,000件またはテキスト5 MB を超えられません。
Candidates cannot contain another Wildcard reference.	후보에는 다른 와일드카드 참조를 넣을 수 없습니다.	候補に別のワイルドカード参照は入れられません。
Wildcard not found.	와일드카드를 찾지 못했습니다.	ワイルドカードが見つかりません。
The reference key cannot change. Create a new Wildcard instead.	참조 키는 바꿀 수 없습니다. 새 와일드카드를 만드세요.	参照キーは変更できません。新しいワイルドカードを作ってください。
This reference key already exists.	이미 사용 중인 참조 키입니다.	この参照キーはすでに使われています。
Built-in	기본 제공	組み込み
Updated {date}	수정일 {date}	更新日時 {date}
{kind} | {n} subcategories	{kind} | 하위 카테고리 {n}개	{kind} | サブカテゴリ {n}件
Source	원본	ソース
Image	이미지	画像
Warnings	주의 사항	注意事項
Language	언어	言語
Prompt & Image Workbench	프롬프트와 이미지 작업대	プロンプトと画像のワークベンチ
Workbench	작업대	ワークベンチ
Workspace	작업 공간	ワークスペース
Presets	프리셋	プリセット
Preset	프리셋	プリセット
History	히스토리	履歴
Image / JSON	이미지 / JSON	画像 / JSON
ⓘ Manuals	ⓘ 설명서	ⓘ マニュアル
Wildcards	와일드카드	ワイルドカード
Wildcard	와일드카드	ワイルドカード
Open Image	이미지 열기	画像を開く
API Settings	API 설정	API 設定
App info and manuals	앱 정보 및 설명서	アプリ情報とマニュアル
checking	확인 중	確認中
Edit prompts	프롬프트 편집	プロンプト編集
Image result	이미지 결과	生成画像
Prompt and result workbench	프롬프트와 결과 작업대	プロンプトと結果のワークベンチ
Small window pane	작은 창의 화면 선택	小さいウィンドウの表示切替
Resize prompt and image panes	프롬프트와 이미지 영역 크기 조절	プロンプトと画像領域の幅を調整
History gallery	히스토리 갤러리	履歴ギャラリー
Current Preset	현재 프리셋	現在のプリセット
Edit the prompt, characters, and settings used for generation.	이미지에 사용할 프롬프트, 캐릭터, 설정을 편집하세요.	生成に使うプロンプト、キャラクター、設定を編集します。
Save	저장	保存
Save As	새 이름으로 저장	名前を付けて保存
Load	불러오기	読み込み
Delete	삭제	削除
Delete Selected	선택 항목 삭제	選択項目を削除
Close	닫기	閉じる
Cancel	취소	キャンセル
Name	이름	名前
Prompt	프롬프트	プロンプト
Base prompt	베이스 프롬프트	ベースプロンプト
Base Prompt	베이스 프롬프트	ベースプロンプト
Base	베이스	ベース
Undesired	제외 프롬프트	除外プロンプト
Undesired Content	제외 프롬프트	除外プロンプト
Expand editor	확대 편집	拡大編集
Generation Settings	생성 설정	生成設定
All settings apply to the current workbench.	모든 설정은 현재 작업대에 적용됩니다.	すべての設定は現在の作業に適用されます。
More settings	상세 설정	詳細設定
Model	모델	モデル
Width	너비	幅
Height	높이	高さ
Steps	스텝 수	ステップ数
Scale	프롬프트 강도	プロンプトの強さ
CFG rescale	CFG 재조정	CFG リスケール
Sampler	샘플러	サンプラー
Seed	시드	シード
Random	무작위	ランダム
random	무작위	ランダム
Noise schedule	노이즈 스케줄	ノイズスケジュール
Noise	노이즈	ノイズ
UC preset	제외 태그 프리셋	除外タグのプリセット
Heavy	강하게	強め
Light	가볍게	軽め
Furry Focus	퍼리 중심	ファーリー向け
Human Focus	사람 중심	人物向け
None	없음	なし
none	없음	なし
Quality tags	품질 태그	品質タグ
Quality Tags	품질 태그	品質タグ
Standard	표준	標準
Transparent Background	투명 배경	透明背景
Dynamic SM	동적 SM	動的 SM
Dynamic threshold	동적 임계값	動的しきい値
Character Prompts	캐릭터 프롬프트	キャラクタープロンプト
Add Character	캐릭터 추가	キャラクターを追加
Character	캐릭터	キャラクター
Characters	캐릭터	キャラクター
Character {n}	캐릭터 {n}	キャラクター {n}
Imported Character {n}	가져온 캐릭터 {n}	読み込んだキャラクター {n}
Character {n} · {field}	캐릭터 {n} · {field}	キャラクター {n} · {field}
Position	위치	位置
AI's Choice	AI 자동 배치	AI におまかせ
Custom	직접 배치	手動配置
Position Pad	위치 패드	位置パッド
Drag a numbered marker to position an active character.	번호 표시를 끌어 캐릭터 위치를 정하세요.	番号マーカーをドラッグしてキャラクターの位置を決めます。
Reset selected to center	선택 캐릭터를 중앙으로	選択キャラクターを中央へ
Character position pad	캐릭터 위치 패드	キャラクター位置パッド
Select a character marker	캐릭터 번호를 선택하세요	キャラクターの番号を選択してください
Section Libraries	부분 프리셋 보관함	部分プリセットのライブラリ
List	목록	一覧
Apply	적용	適用
Params	생성 설정	生成設定
Slot	슬롯	スロット
Save Slot	슬롯 저장	スロットを保存
Apply to Slot	슬롯에 적용	スロットに適用
NovelAI API Settings	NovelAI API 설정	NovelAI API 設定
NovelAI Token	NovelAI 토큰	NovelAI トークン
Checking NovelAI token status...	NovelAI 토큰 확인 중…	NovelAI トークンを確認中…
Paste token to save securely	토큰을 붙여 넣어 안전하게 저장하세요	トークンを貼り付けて安全に保存
Refresh Token Status	토큰 상태 새로고침	トークン状態を更新
Save Token	토큰 저장	トークンを保存
Clear Saved Token	저장된 토큰 삭제	保存したトークンを削除
Manage the saved token and account status.	저장된 토큰과 계정 상태를 관리하세요.	保存したトークンとアカウント状態を管理します。
Image & metadata	이미지와 메타데이터	画像とメタデータ
Open an image or import raw NovelAI JSON.	이미지를 열거나 NovelAI JSON을 가져오세요.	画像を開くか NovelAI JSON を読み込みます。
Image Intake	이미지 가져오기	画像の取り込み
Open an image, choose its destination, and optionally import NovelAI metadata.	이미지를 열고 사용처를 고르세요. NovelAI 메타데이터도 가져올 수 있습니다.	画像を開いて用途を選びます。NovelAI メタデータも読み込めます。
Unified Image Input	이미지 입력	画像の入力
Imported image preview	가져온 이미지 미리 보기	取り込んだ画像のプレビュー
Drop PNG, WebP, or JPEG here	PNG, WebP, JPEG를 여기로 끌어 놓으세요	PNG、WebP、JPEG をここにドロップ
or paste an image anywhere to choose its destination	또는 이미지를 붙여 넣고 사용처를 고르세요	画像を貼り付けて用途を選ぶこともできます
Text Paste	텍스트 붙여넣기	テキスト貼り付け
Paste prompt text here	프롬프트를 여기에 붙여 넣으세요	プロンプトをここに貼り付け
Use as Base	베이스에 사용	ベースに使用
Use as Undesired	제외 프롬프트에 사용	除外プロンプトに使用
Advanced / Debug Raw JSON Import	고급 / 원본 JSON 가져오기	詳細 / 元の JSON を読み込む
Paste NovelAI raw parameters JSON	NovelAI 원본 설정 JSON을 붙여 넣으세요	NovelAI の元の設定 JSON を貼り付け
Paste valid raw JSON to import automatically.	올바른 JSON을 붙여 넣으면 자동으로 가져옵니다.	有効な JSON を貼り付けると自動で読み込みます。
Import Raw JSON	원본 JSON 가져오기	元の JSON を読み込む
Import Result	가져온 결과	取り込み結果
Apply to Current Preset	현재 프리셋에 적용	現在のプリセットに適用
No import yet.	아직 가져온 항목이 없습니다.	まだ取り込んでいません。
Preview imported data	가져온 데이터 미리 보기	取り込んだデータのプレビュー
Imported Character Prompts	가져온 캐릭터 프롬프트	取り込んだキャラクタープロンプト
Character JSON	캐릭터 JSON	キャラクター JSON
Generate	생성	生成
Create one image from the current preset.	현재 프리셋으로 이미지 한 장을 생성합니다.	現在のプリセットから画像を1枚生成します。
Generation mode	생성 방식	生成方式
Text to Image	텍스트로 생성	テキストから生成
Image to Image	이미지로 생성	画像から生成
Inpaint	부분 수정	部分修正
Source Image	원본 이미지	元画像
No source image selected.	원본 이미지가 없습니다.	元画像が選択されていません。
Choose Image	이미지 선택	画像を選択
Use Latest Result	최근 결과 사용	最新の結果を使用
Remove	제거	取り外す
Strength	변경 강도	変更の強さ
Noise	노이즈	ノイズ
Brush	붓	ブラシ
Eraser	지우개	消しゴム
Brush size	붓 크기	ブラシのサイズ
Undo	되돌리기	元に戻す
Redo	다시 실행	やり直す
Clear Mask	마스크 지우기	マスクを消去
Show Mask	마스크 표시	マスクを表示
Hide Mask	마스크 숨기기	マスクを非表示
Mask opacity	마스크 투명도	マスクの不透明度
Inpaint padding	부분 수정 여백	部分修正の余白
Padding	여백	余白
Precise Reference	정밀 참조	精密参照
Add Reference	참조 추가	参照を追加
Clear All	모두 지우기	すべて消去
Reference type	참조 유형	参照の種類
Fidelity	충실도	忠実度
Your next image starts here	다음 이미지를 여기서 시작하세요	次の画像をここから作りましょう
Edit a prompt, then Generate.	프롬프트를 편집하고 생성 버튼을 누르세요.	プロンプトを編集し、生成を押してください。
Current preset details	현재 프리셋 상세	現在のプリセットの詳細
Large prompt editor	확대 프롬프트 편집기	拡大プロンプトエディター
Changes are applied as you type. Close or Esc to return.	입력 즉시 반영됩니다. 닫기 또는 Esc로 돌아가세요.	入力はすぐに反映されます。閉じるか Esc で戻ります。
Browse & load	찾아서 불러오기	探して読み込む
Save & manage	저장 및 관리	保存と管理
Search presets	프리셋 검색	プリセットを検索
Name or category…	이름 또는 카테고리…	名前またはカテゴリ…
Search	검색	検索
Sort	정렬	並び替え
Name A–Z	이름순	名前の昇順
Name Z–A	이름 역순	名前の降順
Recently modified	최근 수정순	更新日時の新しい順
Oldest modified	오래된 수정순	更新日時の古い順
Recently created	최근 생성순	作成日時の新しい順
Oldest created	오래된 생성순	作成日時の古い順
Seed, model, date…	시드, 모델, 날짜…	シード、モデル、日付…
All models	모든 모델	すべてのモデル
Mode	생성 방식	生成方式
All modes	모든 생성 방식	すべての生成方式
Thumbnail size	미리 보기 크기	サムネイルのサイズ
Keep in workbench	작업대에 표시	ワークベンチに表示
Apply Preset	프리셋 적용	プリセットを適用
Apply Seed	시드 적용	シードを適用
Apply Settings	설정 적용	設定を適用
Use as Source	원본 이미지로 사용	元画像として使用
Load History	히스토리 불러오기	履歴を読み込む
Refresh	새로고침	更新
Select to delete	선택해서 삭제	選択して削除
Select displayed	표시된 항목 선택	表示項目を選択
Clear selection	선택 해제	選択を解除
Cancel selection	선택 취소	選択をキャンセル
Delete selected	선택 항목 삭제	選択項目を削除
No generation yet.	아직 생성한 이미지가 없습니다.	まだ生成していません。
No History loaded.	불러온 히스토리가 없습니다.	履歴を読み込んでいません。
View	보기	表示
Download	다운로드	ダウンロード
Generation Preview	이미지 미리 보기	生成画像のプレビュー
No image selected.	선택된 이미지가 없습니다.	画像が選択されていません。
History details	히스토리 상세	履歴の詳細
History ID	히스토리 ID	履歴 ID
Created	생성일	作成日時
Metadata	메타데이터	メタデータ
Previous, newer History item	이전, 더 최근 히스토리	前の、より新しい履歴
Next, older History item	다음, 더 오래된 히스토리	次の、より古い履歴
Delete selected History?	선택한 히스토리를 삭제할까요?	選択した履歴を削除しますか？
No History selected.	선택한 히스토리가 없습니다.	履歴が選択されていません。
Result images and all assets owned by the selected History items will also be deleted.	선택한 히스토리의 결과 이미지와 관련 파일도 함께 삭제됩니다.	選択した履歴の生成画像と関連ファイルも削除されます。
This cannot be recovered from Chaessi Preset after deletion.	삭제 후에는 앱에서 복구할 수 없습니다.	削除後はアプリから復元できません。
Delete this item?	이 항목을 삭제할까요?	この項目を削除しますか？
The saved item will be removed. Your current prompt stays unchanged.	저장된 항목이 삭제됩니다. 현재 편집 중인 프롬프트는 유지됩니다.	保存項目を削除します。編集中のプロンプトはそのままです。
This Character slot and its unsaved prompt will be removed. Saved presets are kept.	이 캐릭터 슬롯과 편집 내용이 삭제됩니다. 저장된 프리셋은 유지됩니다.	このキャラクタースロットと編集中の内容を削除します。保存済みプリセットは残ります。
This History image, metadata and associated files will be permanently deleted.	이 히스토리의 이미지, 메타데이터, 관련 파일이 영구 삭제됩니다.	この履歴の画像、メタデータ、関連ファイルを完全に削除します。
The saved NovelAI token will be removed. You will need to enter it again to generate.	저장된 NovelAI 토큰이 삭제됩니다. 생성하려면 다시 입력해야 합니다.	保存した NovelAI トークンを削除します。生成には再入力が必要です。
Presets containing __{key}__ will need another Wildcard. Existing generated images are kept.	__{key}__를 쓰는 프리셋은 다른 와일드카드가 필요합니다. 기존 생성 이미지는 유지됩니다.	__{key}__ を使うプリセットには別のワイルドカードが必要です。生成済み画像は残ります。
Save Preset	프리셋 저장	プリセットを保存
Save the current prompt, characters, params, and thumbnail.	현재 프롬프트, 캐릭터, 설정, 미리 보기를 저장합니다.	現在のプロンプト、キャラクター、設定、サムネイルを保存します。
Preset name	프리셋 이름	プリセット名
No thumbnail	미리 보기 없음	サムネイルなし
Thumbnail	미리 보기	サムネイル
Use the latest generated image or choose an image file.	최근 생성 이미지를 쓰거나 이미지 파일을 선택하세요.	最新の生成画像を使うか、画像ファイルを選択します。
Use Current Image	현재 이미지 사용	現在の画像を使用
Choose File	파일 선택	ファイルを選択
Clear	지우기	消去
Ready.	준비됨.	準備完了。
Load Preset	프리셋 불러오기	プリセットを読み込む
Choose a saved preset to replace the current preset.	저장된 프리셋을 선택하면 현재 작업에 불러옵니다.	保存したプリセットを選び、現在の作業に読み込みます。
No presets loaded.	불러온 프리셋이 없습니다.	プリセットを読み込んでいません。
No saved presets yet.	저장된 프리셋이 없습니다.	保存したプリセットはまだありません。
Character Prompt Preset	캐릭터 프롬프트 프리셋	キャラクタープロンプトのプリセット
Character slot	캐릭터 슬롯	キャラクタースロット
Category	카테고리	カテゴリ
Subcategory	하위 카테고리	サブカテゴリ
Category filter	카테고리 필터	カテゴリで絞り込み
Subcategory filter	하위 카테고리 필터	サブカテゴリで絞り込み
All categories	모든 카테고리	すべてのカテゴリ
All subcategories	모든 하위 카테고리	すべてのサブカテゴリ
Refresh List	목록 새로고침	一覧を更新
Manage Categories	카테고리 관리	カテゴリの管理
No preset selected.	선택한 프리셋이 없습니다.	プリセットが選択されていません。
Add categories and one level of subcategories.	카테고리와 한 단계의 하위 카테고리를 추가하세요.	カテゴリと1階層のサブカテゴリを追加します。
Categories	카테고리	カテゴリ
Subcategories	하위 카테고리	サブカテゴリ
New category	새 카테고리	新しいカテゴリ
Add Category	카테고리 추가	カテゴリを追加
Parent category	상위 카테고리	親カテゴリ
New subcategory	새 하위 카테고리	新しいサブカテゴリ
Add Subcategory	하위 카테고리 추가	サブカテゴリを追加
Drop image to choose destination	이미지를 놓고 사용처를 고르세요	画像をドロップして用途を選択
Save many candidates. Each generation chooses one at random.	많은 후보를 저장하세요. 생성마다 하나를 무작위로 선택합니다.	候補を保存すると、生成ごとに1つをランダムに選びます。
+ New Wildcard	+ 새 와일드카드	+ 新しいワイルドカード
Reference key	참조 키	参照キー
Candidates - one per line	후보 — 한 줄에 하나씩	候補 — 1行に1つ
Equal chance for every unique candidate. Repeats are possible. Empty lines and duplicate lines are removed on save. Keys stay fixed after saving. Candidates may use ||A|B||, but cannot reference other Wildcards.	중복 없는 후보마다 선택 확률이 같습니다. 반복 선택될 수 있습니다. 저장 시 빈 줄과 중복 줄은 제거됩니다. 저장한 키는 고정됩니다. 후보에 ||A|B||는 사용할 수 있지만 다른 와일드카드는 참조할 수 없습니다.	各候補の選択確率は同じです。連続で同じ候補が出ることもあります。保存時に空行と重複行を除きます。保存後のキーは固定です。候補に ||A|B|| は使えますが、別のワイルドカードは参照できません。
Import TXT	TXT 가져오기	TXT を読み込む
Export TXT	TXT 내보내기	TXT を書き出す
Sample	시험 선택	試しに選ぶ
Insert into prompt	프롬프트에 삽입	プロンプトに挿入
Create a Wildcard or select one from the list.	와일드카드를 만들거나 목록에서 선택하세요.	ワイルドカードを作るか、一覧から選択します。
App info & Manuals	앱 정보 및 설명서	アプリ情報とマニュアル
Open integrated guide	통합 설명서 열기	統合マニュアルを開く
Read the complete guide, including Wildcards, without internet.	와일드카드를 포함한 전체 설명서를 인터넷 없이 읽을 수 있습니다.	ワイルドカードを含む全機能の説明をオフラインで読めます。
Integrated guide	통합 사용 설명서	統合マニュアル
Contents	목차	目次
Search guide	설명서 검색	マニュアルを検索
Text size	글자 크기	文字サイズ
No matching chapters.	일치하는 설명이 없습니다.	一致する章がありません。
Click an image to enlarge.	그림을 누르면 크게 볼 수 있습니다.	画像をクリックすると拡大できます。
Previous	이전	前へ
Next	다음	次へ
Fold	접기	折りたたむ
Expand	펼치기	展開
Enabled	사용 중	有効
Disabled	사용 안 함	無効
On	켜짐	オン
Off	꺼짐	オフ
Empty prompt	빈 프롬프트	空のプロンプト
Loading tokenizer...	토큰 계산기 준비 중…	トークン計算を準備中…
Token count unavailable	토큰 수를 계산할 수 없음	トークン数を計算できません
Wildcard | counted after selection at Generate	와일드카드 | 생성 시 후보 선택 후 계산	ワイルドカード | 生成時の候補選択後に計算
Disabled | excluded from context	사용 안 함 | 문맥에서 제외	無効 | 文脈から除外
Generating	생성 중	生成中
Generating one image...	이미지 한 장 생성 중…	画像を1枚生成中…
Generation saved.	생성 결과가 저장되었습니다.	生成結果を保存しました。
Generation deleted with image, sidecar, and payload.	이미지와 관련 메타데이터, 요청 기록이 삭제되었습니다.	画像、メタデータ、リクエスト記録を削除しました。
History loaded.	히스토리를 불러왔습니다.	履歴を読み込みました。
History image shown. Prompt edits unchanged.	히스토리 이미지를 표시합니다. 편집 내용은 유지됩니다.	履歴画像を表示しました。編集中の内容はそのままです。
Loading generation details…	생성 상세 불러오는 중…	生成の詳細を読み込み中…
Generation details loaded.	생성 상세를 불러왔습니다.	生成の詳細を読み込みました。
Generation details could not be loaded.	생성 상세를 불러오지 못했습니다.	生成の詳細を読み込めませんでした。
Preset saved.	프리셋을 저장했습니다.	プリセットを保存しました。
Preset saved as new.	새 프리셋으로 저장했습니다.	新しいプリセットとして保存しました。
Preset loaded.	프리셋을 불러왔습니다.	プリセットを読み込みました。
Preset deleted.	프리셋을 삭제했습니다.	プリセットを削除しました。
Saving	저장 중	保存中
Saving as a new preset.	새 프리셋으로 저장합니다.	新しいプリセットとして保存します。
Saving current preset.	현재 프리셋을 저장합니다.	現在のプリセットを保存します。
Select a section preset first.	먼저 부분 프리셋을 선택하세요.	部分プリセットを先に選択してください。
Section preset applied.	부분 프리셋을 적용했습니다.	部分プリセットを適用しました。
Section preset deleted.	부분 프리셋을 삭제했습니다.	部分プリセットを削除しました。
Select a character preset first.	먼저 캐릭터 프리셋을 선택하세요.	キャラクタープリセットを先に選択してください。
Character preset applied.	캐릭터 프리셋을 적용했습니다.	キャラクタープリセットを適用しました。
Character preset deleted.	캐릭터 프리셋을 삭제했습니다.	キャラクタープリセットを削除しました。
Character preset loaded into Base Prompt.	프리셋을 베이스 프롬프트에 불러왔습니다.	プリセットをベースプロンプトに読み込みました。
No character slot selected.	선택한 캐릭터 슬롯이 없습니다.	キャラクタースロットが選択されていません。
No character in that slot.	해당 슬롯에 캐릭터가 없습니다.	そのスロットにキャラクターがいません。
No preset context selected.	프리셋 적용 대상을 선택하세요.	プリセットの適用先を選択してください。
Select a character preset or use Save As.	캐릭터 프리셋을 선택하거나 새 이름으로 저장하세요.	プリセットを選ぶか、名前を付けて保存してください。
Select a saved preset to overwrite, or use Save As to create a new one.	덮어쓸 프리셋을 선택하거나 새 이름으로 저장하세요.	上書きするプリセットを選ぶか、名前を付けて保存します。
Generate or select an image first.	먼저 이미지를 생성하거나 선택하세요.	先に画像を生成するか選択してください。
Using current image as thumbnail.	현재 이미지를 미리 보기로 사용합니다.	現在の画像をサムネイルに使用します。
Using selected file as thumbnail.	선택한 파일을 미리 보기로 사용합니다.	選択したファイルをサムネイルに使用します。
Thumbnail cleared. Save to update the preset.	미리 보기를 지웠습니다. 저장하면 반영됩니다.	サムネイルを消去しました。保存すると反映されます。
No latest generation to delete.	삭제할 최근 결과가 없습니다.	削除する最新の結果がありません。
No viewed generation to delete.	삭제할 이미지가 없습니다.	削除する画像がありません。
History deletion is already in progress.	히스토리를 삭제 중입니다.	履歴の削除はすでに実行中です。
Select at least one History item to delete.	삭제할 히스토리를 하나 이상 선택하세요.	削除する履歴を1件以上選択してください。
Deletion has not started.	아직 삭제하지 않았습니다.	まだ削除していません。
Selected History could not be deleted.	선택한 히스토리를 삭제하지 못했습니다.	選択した履歴を削除できませんでした。
This generation has no seed.	이 결과에는 시드가 없습니다.	この結果にはシードがありません。
This generation has no reusable params.	이 결과에는 재사용할 설정이 없습니다.	この結果には再利用できる設定がありません。
This generation has no internal preset snapshot.	이 결과에는 저장된 프리셋 정보가 없습니다.	この結果には保存したプリセット情報がありません。
Generation params applied to current preset.	생성 설정을 현재 작업에 적용했습니다.	生成設定を現在の作業に適用しました。
Generation preset applied to current preset.	히스토리의 프리셋을 현재 작업에 적용했습니다.	履歴のプリセットを現在の作業に適用しました。
Paste a NovelAI token first.	먼저 NovelAI 토큰을 붙여 넣으세요.	先に NovelAI トークンを貼り付けてください。
NovelAI token saved.	NovelAI 토큰을 저장했습니다.	NovelAI トークンを保存しました。
Saved NovelAI token cleared.	저장된 NovelAI 토큰을 삭제했습니다.	保存した NovelAI トークンを削除しました。
Anlas unavailable	Anlas 확인 불가	Anlas を確認できません
V5 Stamina unavailable	V5 스태미나 확인 불가	V5 スタミナを確認できません
Choose at least one image.	이미지를 하나 이상 선택하세요.	画像を1枚以上選択してください。
Metadata imported explicitly. Open another image to replace it.	메타데이터를 가져왔습니다. 다른 이미지를 열면 바뀝니다.	メタデータを読み込みました。別の画像を開くと置き換わります。
Selected NovelAI metadata imported.	선택한 NovelAI 메타데이터를 가져왔습니다.	選択した NovelAI メタデータを読み込みました。
Paste raw JSON first.	먼저 원본 JSON을 붙여 넣으세요.	先に元の JSON を貼り付けてください。
Waiting for valid JSON.	올바른 JSON을 기다립니다.	有効な JSON を待っています。
Valid JSON detected. Importing automatically...	JSON을 자동으로 가져오는 중…	有効な JSON を自動で読み込み中…
Imported automatically.	자동으로 가져왔습니다.	自動で読み込みました。
Paste text first.	먼저 텍스트를 붙여 넣으세요.	先にテキストを貼り付けてください。
Text applied to base prompt.	텍스트를 베이스 프롬프트에 적용했습니다.	テキストをベースプロンプトに適用しました。
Text applied to undesired prompt.	텍스트를 제외 프롬프트에 적용했습니다.	テキストを除外プロンプトに適用しました。
Import something first.	먼저 데이터를 가져오세요.	先にデータを読み込んでください。
Import applied to current preset.	가져온 내용을 현재 프리셋에 적용했습니다.	取り込んだ内容を現在のプリセットに適用しました。
Choose a destination.	사용처를 선택하세요.	用途を選択してください。
NovelAI Metadata	NovelAI 메타데이터	NovelAI メタデータ
Settings / Seed	설정 / 시드	設定 / シード
Import Selected Metadata	선택한 메타데이터 가져오기	選択したメタデータを読み込む
Edit candidates, then Save. The key stays the same.	후보를 편집하고 저장하세요. 키는 유지됩니다.	候補を編集して保存します。キーは変わりません。
No Wildcards. Click + New Wildcard.	와일드카드가 없습니다. + 새 와일드카드를 누르세요.	ワイルドカードがありません。+ 新しいワイルドカードを押してください。
Discard unsaved Wildcard changes?	저장하지 않은 와일드카드 변경을 버릴까요?	未保存のワイルドカードの変更を破棄しますか？
Choose a Wildcard and click Insert into prompt.	와일드카드를 고르고 프롬프트에 삽입을 누르세요.	ワイルドカードを選び、プロンプトに挿入を押します。
Choose a key, add one candidate per line, then Save.	키를 정하고 한 줄에 후보 하나씩 넣은 뒤 저장하세요.	キーを決め、1行に候補を1つずつ入力して保存します。
The prompt field changed. Close this window and open Wildcard again.	프롬프트 칸이 바뀌었습니다. 창을 닫고 와일드카드를 다시 여세요.	プロンプト欄が変わりました。閉じてワイルドカードを開き直してください。
Wildcard deleted.	와일드카드를 삭제했습니다.	ワイルドカードを削除しました。
TXT file must be 5 MB or smaller.	TXT 파일은 5 MB 이하여야 합니다.	TXT ファイルは 5 MB 以下にしてください。
Imported candidates. Click Save to keep them.	후보를 가져왔습니다. 저장 버튼을 누르세요.	候補を読み込みました。保存してください。
Add a candidate first.	먼저 후보를 넣으세요.	先に候補を入力してください。
{n} candidates | {d} duplicate lines{dirty}	후보 {n}개 | 중복 {d}줄{dirty}	候補 {n}件 | 重複 {d}行{dirty}
 | Unsaved changes	 | 저장하지 않은 변경	 | 未保存の変更
Reference: __{key}__	참조: __{key}__	参照: __{key}__
Saved {n} candidates. Every candidate has an equal chance.	후보 {n}개를 저장했습니다. 모든 후보의 선택 확률이 같습니다.	候補 {n}件を保存しました。選択確率はすべて同じです。
Inserted __{key}__.	__{key}__를 삽입했습니다.	__{key}__ を挿入しました。
Sample only: {value}	시험 선택: {value}	試しに選択: {value}
{n} presets loaded.	프리셋 {n}개를 불러왔습니다.	プリセットを {n}件読み込みました。
{n} / {total} records	{n} / {total}개 기록	{n} / {total}件の記録
{n} selected	{n}개 선택됨	{n}件選択中
Load {n} more ({shown}/{total})	{n}개 더 보기 ({shown}/{total})	あと {n}件を表示 ({shown}/{total})
All {n} loaded	전체 {n}개 표시됨	全 {n}件を表示中
Load more	더 보기	さらに表示
{n} chars	{n}자	{n}文字
{n} enabled	{n}개 사용 중	{n}件有効
{name} saved.	{name} 저장 완료.	{name} を保存しました。
{name} saved as new.	{name} 새 이름으로 저장 완료.	{name} を新規保存しました。
{name} saved as a new character preset.	{name} 새 캐릭터 프리셋으로 저장 완료.	{name} を新しいキャラクタープリセットとして保存しました。
Seed {seed} applied to current preset.	시드 {seed}를 현재 작업에 적용했습니다.	シード {seed} を現在の作業に適用しました。
Switched to {model}. Incompatible data remains preserved.	{model}로 바꿨습니다. 호환되지 않는 데이터도 보존됩니다.	{model} に切り替えました。非対応のデータも保持します。
This model supports {n} Character Prompt slots.	이 모델은 캐릭터 슬롯 {n}개를 지원합니다.	このモデルはキャラクタースロットを {n}個使えます。
{model}: up to {n} Character Prompt slots.	{model}: 캐릭터 슬롯 최대 {n}개.	{model}: キャラクタースロットは最大 {n}個。
{n} additional V5 character slots are preserved but excluded from {model} generation.	추가 V5 캐릭터 슬롯 {n}개는 보존되지만 {model} 생성에서 제외됩니다.	追加の V5 スロット {n}個は保持されますが、{model} の生成からは除外されます。
V5 Full: Text to Image, Image to Image, and Inpaint are available. Precise Reference and SMEA are preserved but disabled.	V5: 텍스트 생성, 이미지 생성, 부분 수정을 지원합니다. 정밀 참조와 SMEA 설정은 보존되지만 사용하지 않습니다.	V5: テキスト生成、画像生成、部分修正に対応します。精密参照と SMEA の設定は保持しますが使用しません。
V4.5 Full: existing Text to Image, Image to Image, Inpaint, and Precise Reference remain available.	V4.5: 텍스트 생성, 이미지 생성, 부분 수정, 정밀 참조를 지원합니다.	V4.5: テキスト生成、画像生成、部分修正、精密参照に対応します。
V5 Full Precise Reference is not supported. References are preserved for V4.5.	V5는 정밀 참조를 지원하지 않습니다. 참조는 V4.5용으로 보존됩니다.	V5 は精密参照に対応していません。参照は V4.5 用に保持します。
Could not save Preset category preferences on this device. This selection may not survive an app restart.	카테고리 선택을 저장하지 못했습니다. 재시작하면 유지되지 않을 수 있습니다.	カテゴリ選択を保存できませんでした。再起動すると保持されない場合があります。
Add-only category management. Existing names are not changed or deleted.	카테고리는 추가만 할 수 있습니다. 기존 이름은 바뀌거나 삭제되지 않습니다.	カテゴリは追加できます。既存の名前は変更・削除しません。
Slot {n}	슬롯 {n}	スロット {n}
Choose a saved character preset to load into {target}, or use Save As to create a new one.	{target}에 불러올 프리셋을 선택하거나 새 이름으로 저장하세요.	{target} に読み込むプリセットを選ぶか、名前を付けて保存してください。
Character preset selected. Load will replace {target}; Save overwrites the preset.	프리셋 선택됨. 불러오기는 {target}를 바꾸고, 저장은 선택한 프리셋을 덮어씁니다.	プリセットを選択しました。読み込みは {target} を置き換え、保存は選択したプリセットを上書きします。
Includes enabled Quality Tags and all enabled Character Prompts in the shared context.	품질 태그와 사용 중인 캐릭터 프롬프트가 공유 문맥에 포함됩니다.	有効な品質タグとキャラクタープロンプトを共通文脈に含めます。
Includes the selected UC preset and all enabled Character Undesired fields in the shared context.	선택한 제외 태그와 캐릭터 제외 프롬프트가 공유 문맥에 포함됩니다.	選択した除外タグと有効なキャラクター除外プロンプトを共通文脈に含めます。
This field count is shown with the shared Base and enabled Character context total.	이 칸의 토큰 수와 베이스·캐릭터의 공유 문맥 전체 수를 표시합니다.	この欄のトークン数とベース・キャラクターの共通文脈の合計を表示します。
No additional metadata.	추가 메타데이터 없음.	追加メタデータなし。
Size	크기	サイズ
Import	가져오기	取り込み
Token	토큰	トークン
{n} History items will be deleted.	히스토리 {n}개를 삭제합니다.	履歴 {n}件を削除します。
{n} History item will be deleted.	히스토리 {n}개를 삭제합니다.	履歴 {n}件を削除します。
Deleting… (0/{n})	삭제 중… (0/{n})	削除中… (0/{n})
Deleted {n}, already missing {missing}, failed {failed}.	삭제 {n}개, 이미 없음 {missing}개, 실패 {failed}개.	削除 {n}件、存在しない項目 {missing}件、失敗 {failed}件。
여성 캐릭터	여성 캐릭터	女性キャラクター
남성 캐릭터	남성 캐릭터	男性キャラクター
여성 의상	여성 의상	女性の衣装
남성 의상	남성 의상	男性の衣装
구도·카메라	구도·카메라	構図・カメラ
배경·소품	배경·소품	背景・小物
조명	조명	照明
그림체	그림체	画風
품질	품질	品質
기타	기타	その他
Casual / 캐주얼	캐주얼	カジュアル
Street / 스트리트	스트리트	ストリート
Sporty / 스포티	스포티	スポーティー
Office / 오피스	오피스	オフィス
Girly / 걸리	걸리	ガーリー
Glam / 글램	글램	グラム
Boudoir / 부두아르	부두아르	ブドワール
Uniform / 유니폼	유니폼	ユニフォーム
Dandy / 댄디	댄디	ダンディ
`.trim().split('\n');
export const messages = Object.fromEntries(rows.map(row => { const [en, ko, ja] = row.split('\t'); return [en, { en, ko, ja }]; }));
for (const [key, en] of Object.entries({ '여성 캐릭터': 'Female characters', '남성 캐릭터': 'Male characters', '여성 의상': 'Female outfits', '남성 의상': 'Male outfits', '구도·카메라': 'Composition / Camera', '배경·소품': 'Background / Props', '조명': 'Lighting', '그림체': 'Art style', '품질': 'Quality', '기타': 'Other' })) messages[key].en = en;
for (const key of Object.keys(messages).filter(key => key.includes(' / ') && /[가-힣]/.test(key))) messages[key].en = key.split(' / ')[0];
