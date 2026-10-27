export function describeReusedArtwork(chapters) {
  for(const c of chapters.filter(c=>!c.id.startsWith('camera-')))c.imageNote={
    ko:'v3.8.1의 공개용 사용자 작품과 실제 기능 화면을 재사용한 참고 자료입니다. 새 카메라 화면은 별도 카메라 장에서 확인합니다. 개인 원문 프롬프트는 포함하지 않습니다.',
    en:'Reused public v3.8.1 user artwork and actual feature screenshots. New camera screens are in the camera chapters. Original private prompts are not included.',
    ja:'v3.8.1の公開用ユーザー作品と実機能画面を再利用した参考資料です。新カメラはカメラの章を参照してください。非公開の原文は含みません。'};
  const result=chapters.find(c=>c.id==='image-tools')?.illustrations?.find(i=>i.screenshot==='tool-result');
  if(result)result.caption={ko:'사용자 작품에 하늘색 선을 그리고 Canvas로 저장한 기존 실제 결과입니다.',en:'An earlier actual Canvas result: a cyan stroke on user artwork.',ja:'ユーザー作品に水色の線を描いてCanvasで保存した以前の実際の結果です。'};
}
