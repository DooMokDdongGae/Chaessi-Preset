const make=(id,image,ko,en,ja)=>({id,image,ko,en,ja,illustrations:[]});
export const compositionChapters=[
 make('composition','composition-layout',
 ['구도 넓히기: 그림 배치·테두리·붓','그림을 작게 놓거나 돌린 뒤 주변 배경을 이어 그립니다. 계단의 스트리트 패션 인물 예제를 따라 해 보세요.',[
  '이미지 도구에서 PNG를 열고 구도 넓히기를 누릅니다. 이미 Inpaint에서 칠했다면 그 화면의 구도 넓히기를 누르세요. 원본과 둥근 붓 마스크가 함께 넘어갑니다. 직접 그리기에서 만든 픽셀도 이어서 사용할 수 있습니다.',
  '그림 배치에서 그림 안을 드래그해 이동합니다. 모서리 원을 끌면 크기, 위쪽 원을 끌면 각도가 바뀝니다. 휠은 화면만 확대하며 저장 크기는 바꾸지 않습니다. 화면 이동은 화면을 끌어 보는 도구입니다.',
  '테두리 늘리기를 누르고 프레임 가장자리 손잡이를 바깥으로 끕니다. 진한 파란 빈 공간은 자동 생성 영역입니다. 그림을 다시 옮기면 빈 영역도 다시 계산됩니다.',
  '둥근 붓으로 그림 안에서 추가로 바꿀 곳을 칠합니다. 밝은 하늘색은 직접 칠한 영역입니다. 지우개는 직접 칠한 곳만 지우며, 빈 공간의 자동 선택은 남습니다. Undo/Redo로 배치와 붓 작업을 되돌립니다.'
 ],'직접 그리기(Canvas)는 픽셀을 직접 바꾸는 로컬 편집입니다. 기존 Outpainting은 숫자로 여백을 더하고, 구도 넓히기는 그림 배치와 테두리 손잡이를 사용합니다. 이 화면의 프레임이 최종 결과 크기이며, 화면 확대와 별개입니다. 8픽셀 단위·총 3,145,728픽셀 이하를 확인하세요.'],
 ['Expand composition: arrange, extend and paint','Place a smaller or rotated picture and draw the surrounding background. Follow the street portrait on the outdoor stairs.',[
  'Open a PNG in Image tools and press Expand composition. If you already painted in Inpaint, use its Expand composition button to carry the original and round-brush mask together. You can also continue with pixels edited in Draw pixels.',
  'In Arrange picture, drag inside the picture to move it. Drag a corner circle to resize or the circle above it to rotate. The wheel zooms only the view, not the saved dimensions. Pan view drags the view.',
  'Choose Extend frame and drag an edge handle outward. Dark blue empty space is selected automatically for generation. Moving the picture recalculates that empty area.',
  'Use Round brush to paint extra areas inside the picture. Light cyan marks your strokes. Erase mask removes hand-painted selection while empty space stays selected. Undo/Redo reverses placement and brush edits.'
 ],'Draw pixels (Canvas) edits pixels locally. Existing Outpainting adds margins by number; Expand composition uses placement and frame handles. The frame determines output dimensions, separately from view zoom. Output uses 8-pixel steps and at most 3,145,728 pixels.'],
 ['構図を広げる：配置・枠・ブラシ','画像を小さく置いたり回転し、周囲の背景を描き足します。屋外の階段にいる人物の例で試してください。',[
  '画像ツールでPNGを開き、構図を広げるを押します。Inpaintで塗った場合はその画面の構図を広げるから元画像と丸いブラシのマスクを一緒に渡せます。直接描いたピクセルも使えます。',
  '画像を配置で絵の内側をドラッグして移動します。角の丸でサイズ、上の丸で角度を変えます。ホイールは表示だけを拡大し保存サイズは変えません。表示を移動は画面をドラッグします。',
  '枠を広げるを選び、辺のハンドルを外へ引きます。濃い青の空白が自動生成範囲です。画像を動かすと空白も再計算します。',
  '丸いブラシで絵の中の追加変更範囲を塗ります。明るい水色が手塗りです。消しゴムは手塗りだけを消し、空白は選択されたままです。Undo/Redoで配置とブラシ編集を戻します。'
 ],'直接描画(Canvas)はピクセルを変えるローカル編集です。従来のOutpaintingは数値で余白を足し、構図を広げるは配置と枠のハンドルを使います。枠が最終出力サイズで、表示倍率とは別です。出力は8画素単位、合計3,145,728画素以下です。']),
 make('composition-characters','composition-characters',
 ['구도 넓히기: 새 캐릭터 넣기','새로 연 공간에 다른 인물을 추가합니다. 야외 계단 예제는 기존 인물의 오른쪽에 베이지 블라우스·청바지를 입고 빨간 가방을 든 두 번째 성인을 요청한 실제 사례입니다.',[
  '그림을 옮기거나 테두리를 늘려 새 인물이 들어갈 공간을 만듭니다. 원본 내부에 넣으려면 그 자리도 둥근 붓으로 칠하세요.',
  '장면 프롬프트에 전체 상황과 인물 수를 적습니다. 예를 들어 두 성인이 야외 계단에 있는 장면이라고 설명합니다. 여기의 글은 현재 구도에만 적용됩니다.',
  '캐릭터를 펼치고 캐릭터 추가를 누릅니다. 새 인물의 외형과 행동을 적은 뒤 캐릭터 위치 도구에서 번호 마커를 원하는 자리로 끕니다. 마커 위치 사용 상태도 확인하세요.',
  '이미지·마스크 확인에서 인물이 들어갈 곳이 흰색인지 봅니다. 크기·예상 비용을 확인하고 이 구도로 생성을 누른 뒤 실제 위치와 인물 수를 확인합니다.'
 ],'기존 캐릭터는 그림을 따라 움직이고 새 캐릭터는 출력 화면에 고정됩니다. 마커는 모델의 위치 힌트이므로 정확한 좌표나 인원수를 보장하지 않습니다.'],
 ['Expand composition: add a character','Add another person in newly opened space. The real outdoor stairway example asks for a second adult to the right of the original subject.',[
  'Move the picture or extend the frame to make room. To add someone inside the original, paint that location with Round brush too.',
  'Describe the whole scene and subject count in Scene prompt, for example two adults on an outdoor stairway. Edits here apply only to this composition.',
  'Expand Characters and press Add character. Describe appearance and action, then use Character positions to drag the numbered marker. Check Use marker positions.',
  'In Review image and mask, make sure the intended space is white. Check size and estimated cost, generate, then inspect actual placement and subject count.'
 ],'Existing characters follow the picture; new characters attach to the output frame. Markers are model hints and do not guarantee exact locations or subject counts.'],
 ['構図を広げる：新しい人物を追加','広げた空間に別の人物を追加します。実際の屋外の階段例は元の人物の右に別の大人を依頼しています。',[
  '絵を動かすか枠を広げて場所を作ります。元画像の内側に追加する場合は丸いブラシでその場所も塗ります。',
  'シーンプロンプトに全体の状況と人数を書きます。例えば大人二人が屋外の階段にいる場面と説明します。ここでの編集はこの構図だけに適用されます。',
  'キャラクターを開き、キャラクターを追加を押します。外見と動作を書き、位置ツールの番号マーカーを移動します。マーカー位置を使用も確認します。',
  '画像・マスクを確認し、人物の場所が白か見ます。サイズと推定費用を確認して生成し、実際の位置と人数を確認します。'
 ],'既存の人物は画像を追従し、新しい人物は出力枠に固定します。マーカーはモデルへのヒントであり、正確な位置や人数を保証しません。']),
 make('composition-results','composition-review',
 ['구도 넓히기: 확인·결과 비교·경계 보정','생성 전에 실제 전송할 원본과 마스크를 보고, 완료 후 두 결과를 비교합니다.',[
  '이미지·마스크 확인을 누릅니다. 전송할 원본, 생성 마스크, 결과 반영 영역을 확인하세요. 생성 마스크의 흰색이 모델에 다시 그리도록 요청하는 곳이며, Padding 때문에 주변까지 넓어질 수 있습니다.',
  '이 구도로 생성을 누릅니다. 원본 보존 결과는 선택 영역과 경계 연결 부분을 반영하고, 전체 생성 결과는 모델이 돌려준 그림 전체를 사용합니다. 결과 버튼만 바꾸는 것은 새 유료 생성이 아닙니다.',
  '경계가 어색하면 두 결과를 확대 비교합니다. 원본을 정확히 보존할수록 배경 연결선이 남을 수 있습니다. 생성 설정의 경계 연결 폭을 조절하거나 결과 채택 후 이어서 수정을 눌러 둥근 붓으로 경계 양쪽을 칠해 보정하세요.',
  '마음에 드는 결과는 PNG 저장으로 내보냅니다. 결과를 채택하면 그 PNG에서 새 붓 작업을 시작합니다. 원본으로 다른 구도 시도는 원래 그림과 배치로 돌아가며 기존 History 결과는 남습니다.'
 ],'결과 반영 영역의 흰색/회색이 최종 합성 대상입니다. 원본 내부 보존과 자연스러운 연결이 항상 함께 보장되지는 않습니다. 설정이나 붓을 바꾸면 다시 확인해야 생성할 수 있습니다.'],
 ['Expand composition: review, compare and repair seams','Inspect the exact source and mask before generating, then compare two result variants.',[
  'Press Review image and mask. Inspect Prepared source, Generation mask and Result application mask. White in the generation mask asks the model to redraw; Padding can expand it around the edges.',
  'Generate the composition. Preserved original applies selected areas and the blend boundary; Full generated result uses the entire model output. Switching the result button is not another paid generation.',
  'If a seam looks awkward, compare both at high zoom. Exact source preservation can leave visible joins. Adjust Blend boundary in Generation settings, or adopt the result and use Round brush across both sides of the seam for follow-up.',
  'Save the preferred PNG. Adopting it starts a fresh brush session on that PNG. Try another arrangement returns to the original picture and placement while keeping previous results in History.'
 ],'White/gray in Result application mask marks the final compositing area. Exact preservation and seamless continuation are not always both achievable. Changes to settings or strokes require a new review.'],
 ['構図を広げる：確認・結果比較・境界修正','生成前に実際に送る元画像とマスクを確認し、完了後に二つの結果を比較します。',[
  '画像・マスクを確認を押し、送信用画像、生成マスク、結果の適用範囲を見ます。生成マスクの白が描き直す場所です。Paddingで周辺まで広がる場合があります。',
  'この構図で生成します。元画像を保持した結果は選択範囲と境界を反映し、生成結果全体はモデルの絵を全て使います。結果を切り替えるだけでは再生成料金はかかりません。',
  '境界が不自然なら両方を拡大比較します。元画像の正確な保持で継ぎ目が残る場合があります。境界の接続幅を変えるか結果を採用し、丸いブラシで境界の両側を塗って再修正します。',
  '好きな結果をPNG保存します。採用するとそのPNGから新しいブラシ編集を始めます。元画像で別の構図を試すと元の絵と配置に戻り、以前の結果は履歴に残ります。'
 ],'結果の適用範囲の白・灰色が合成対象です。元画像の保持と自然な接続が常に両立するとは限りません。設定や筆を変えたら再確認が必要です。']),
 make('composition-restore','composition-restore',
 ['구도 넓히기: History 복원과 편집 상태 저장','생성 후의 배치 복원과 생성 전 JSON 저장은 쓰는 시점이 다릅니다.',[
  '생성을 마친 그림은 History에서 크게 연 뒤 이미지 도구를 누릅니다. 저장된 배치 다시 편집으로 원래 원본·붓 마스크·배치·캐릭터를 복원합니다.',
  '아직 생성하지 않았거나 다른 컴퓨터에서 이어 하려면 구도 화면의 편집 상태 저장을 눌러 JSON 파일을 보관합니다. 원본과 마스크도 파일에 포함됩니다.',
  '다음에 편집 상태 열기에서 JSON을 선택합니다. 미저장 작업을 교체할지 확인하고, 복원된 배치와 프롬프트를 살펴본 뒤 이미지·마스크를 다시 확인합니다.',
  '완성 PNG만 저장한 경우에는 새 원본으로 쓸 수 있지만 원래의 편집 레시피를 모두 되살리지는 못합니다. 계속 수정할 작업은 JSON 또는 구도 History도 함께 보관하세요.'
 ],'자동 초안 복구는 제공하지 않습니다. 앱을 닫기 전 JSON을 저장하세요. JSON에는 프롬프트와 원본 이미지가 들어 있으므로 공유 전에 내용을 확인하세요.'],
 ['Expand composition: History restore and editing files','History restores a generated composition; a JSON editing file can preserve work before generation.',[
  'Open a completed image in History, then Image tools. Reopen saved arrangement restores the original source, brush mask, placement and characters.',
  'Before generation, or to continue on another computer, press Save editing session in the composition screen. The JSON includes the source and mask.',
  'Choose the JSON with Open editing session. Confirm replacement of unsaved work, inspect placement and prompts, then review the source and mask again.',
  'A saved final PNG can become a new source, but does not restore every original editing instruction. Keep the JSON or composition History when you need editable placement.'
 ],'Automatic draft recovery is unavailable. Save JSON before quitting. It contains prompts and original image data; inspect it before sharing.'],
 ['構図を広げる：履歴復元と編集ファイル','生成後の履歴復元と、生成前にも使えるJSON保存は用途が異なります。',[
  '完成した絵を履歴で開き、画像ツールへ。保存した配置を再編集で元画像・筆マスク・配置・人物を復元します。',
  '生成前や別のパソコンで続けたい場合は編集状態を保存でJSONを保管します。元画像とマスクも含みます。',
  '編集状態を開くでJSONを選びます。未保存作業の置換を確認し、配置と文章を見て、画像・マスクをもう一度確認します。',
  '完成PNGだけでも新しい元画像にできますが、元の編集指示は全て復元できません。配置を編集したい場合はJSONか構図の履歴も保管してください。'
 ],'自動下書き復元はありません。終了前にJSONを保存してください。文章と元画像データを含むため、共有前に確認してください。'])
];

export function attachCompositionHelp(chapters){
 const at=chapters.findIndex(c=>c.id==='tool-pixel-snap');chapters.splice(at<0?chapters.length:at,0,...compositionChapters);
 const extra=(id,screenshot,ko,en,ja)=>chapters.find(c=>c.id===id).illustrations.push({screenshot,caption:{ko,en,ja}});
 extra('composition','composition-frame','프레임 가장자리를 끌어 늘리면 파란 빈 영역이 자동 선택됩니다.','Drag frame edges; blue empty space is selected automatically.','枠の辺をドラッグし、青い空白を確認します。');
 extra('composition','composition-mask','진한 빈 영역과 밝은 직접 칠한 영역을 구분하세요.','Distinguish dark empty space from light hand-painted strokes.','濃い空白と明るい手塗りを区別します。');
 extra('composition-results','composition-results','두 결과는 동일한 실제 생성 응답에서 나왔습니다. 버튼 선택만으로 재생성하지 않습니다.','Both variants come from one real response; switching does not regenerate.','二つは同じ実際の応答です。切替だけでは再生成しません。');
 extra('composition-restore','composition-json','생성 전 편집 상태는 JSON으로 저장하고 다시 열 수 있습니다.','Save and reopen JSON before generation.','生成前でもJSONで保存・再読込できます。');
 const result=(id,file,ko,en,ja)=>chapters.find(c=>c.id===id).illustrations.push({file,caption:{ko,en,ja}});
 result('composition-results','street-composition.webp','① 새 원본 ② 원본 보존 ③ 전체 생성. 같은 실제 응답의 두 합성 방식을 비교합니다.','① New source ② Preserved original ③ Full generated result. Two treatments of one real response.','① 新しい元画像 ② 元画像を保持 ③ 生成結果全体。同じ実際の応答を二つの方法で表示。');
 result('composition-characters','street-character.webp','① 첫 확장 ② 오른쪽 두 번째 성인 추가의 실제 결과. 마커가 항상 이 결과를 보장하지는 않습니다.','① Initial expansion ② Actual second adult added on the right. Markers do not guarantee this result.','① 最初の拡張 ② 右に別の大人を追加した実際の結果。マーカーは結果を保証しません。');
 result('composition-results','street-brush.webp','① 확장 결과 ② 둥근 붓에서 만든 실제 생성 마스크 ③ Medium 후속 결과. 경계 주변을 칠한 한 사례이며 완전한 연결을 보장하지 않습니다.','① Expansion ② Actual generation mask from Round brush ③ Medium follow-up. One seam-painting example, not a guarantee of seamless results.','① 拡張結果 ② 丸いブラシから作った実際の生成マスク ③ Mediumで再修正。一例であり完全な接続の保証ではありません。');
}
