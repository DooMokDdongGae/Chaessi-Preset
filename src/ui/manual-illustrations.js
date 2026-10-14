export const illustrations={
 'tool-canvas':[['canvas','① 원본 ② 실제 Canvas에서 하늘색 선을 그리고 저장한 PNG. AI 생성이 아닌 직접 편집 예시예요.','① Source ② PNG actually drawn with a cyan stroke and saved in Canvas. This is manual editing, not AI generation.','① 元画像 ② Canvas で水色の線を描いて保存した実際の PNG。AI 生成ではなく手動編集です。']],
 'tool-upscale':[['upscale','① 원본 → ② 실제 ×2 결과. 같은 비율로 축소해서 배치했어요.','① Source → ② actual ×2 result, displayed at a common scale.','① 元画像 → ② 実際の2倍結果。同じ縮小率で配置。'],['upscale-detail','같은 부분을 확대해서 비교한 안내 그림이에요. ① 원본 ② 업스케일.','Matching details enlarged for explanation: ① source ② Upscale.','同じ部分を説明用に拡大：① 元画像 ② アップスケール。']],
 'tool-enhance':[['enhance','① 원본 ② High Enhance 실제 결과. 표정·세부가 바뀔 수 있어요.','① Source ② actual High Enhance. Expression and details can change.','① 元画像 ② 実際の High Enhance。表情や細部が変わる場合があります。']],
 'tool-max-enhance':[['max-enhance','① 원본 ② High Max 실제 결과. 일반 Enhance 예시와 비교해 보세요.','① Source ② actual High Max. Compare with the ordinary Enhance chapter.','① 元画像 ② 実際の High Max。通常強化の章とも比較してください。']],
 'tool-bg-removal':[['bg-removal','① 원본 ② Masked ③ Generated ④ Blend. 체크무늬는 설명용 투명 표시예요.','① Source ② Masked ③ Generated ④ Blend. Checkerboard illustrates transparency.','① 元画像 ② Masked ③ Generated ④ Blend。市松模様は透明の説明表示です。']],
 'tool-lineart':[['lineart','① 색 그림 ② 실제 선화 결과.','① Colored source ② actual Line Art output.','① 色付きの元画像 ② 実際の線画結果。']],
 'tool-sketch':[['sketch','① 원본 ② 실제 Sketch 결과. Line Art와 선의 느낌을 비교하세요.','① Source ② actual Sketch output. Compare the strokes with Line Art.','① 元画像 ② 実際の Sketch。Line Art と線の雰囲気を比べます。']],
 'tool-colorize':[['colorize','① 실제 선화 ② 이번 도움말용 실제 채색. 흰 실험복·파랑/빨강 머리를 요청했지만 모든 색 지시가 정확히 일치하지는 않았어요.','① Actual line art ② new real Colorize output. White lab coats and blue/red hair were requested; not every color instruction was followed exactly.','① 実際の線画 ② 今回の実際の着色結果。白い実験服と青/赤の髪を指定しましたが、すべての色指定が一致したわけではありません。']],
 'tool-emotion':[['emotion','① 원본 ② Happy를 선택한 실제 결과. 두 얼굴 모두 영향을 받을 수 있어요.','① Source ② actual Happy result. Both faces can be affected.','① 元画像 ② Happy の実際の結果。両方の顔に影響する場合があります。']],
 'tool-declutter':[['declutter','① 설명을 위해 말풍선과 글자를 합성한 입력 ② 실제 Declutter 결과. 글자뿐 아니라 다른 세부도 달라졌어요.','① Input with an explicitly added teaching speech bubble and text ② actual Declutter result. Other details changed too.','① 説明用に吹き出しと文字を合成した入力 ② 実際の Declutter 結果。他の細部も変わりました。']],
 'tool-outpaint':[['outpaint','① 원본 ② 오른쪽 128픽셀 확장 실제 결과. 테두리 주변도 확인하세요.','① Source ② actual 128-pixel right extension. Inspect the seam too.','① 元画像 ② 右128画素拡張の実際の結果。境界も確認します。']],
 'tool-focused-inpaint':[['focused-inpaint','① 원본 ② 설명용 빨간 선택 표시 (256,160 / 256×256) ③ 실제 High 결과. 선택 밖 픽셀 보존을 검사했어요.','① Source ② explanatory red selection (256,160 / 256×256) ③ actual High result. Unselected pixels were verified unchanged.','① 元画像 ② 説明用の赤い選択表示（256,160 / 256×256）③ 実際の High 結果。選択外の画素保持を検証済みです。']],
};
export function attachIllustrations(chapters){for(const c of chapters)c.illustrations=(illustrations[c.id]??[]).map(([name,ko,en,ja])=>({file:name+'.webp',caption:{ko,en,ja}}));}
