import {CAMERA_RULES,LEGACY_CAMERA_RULES,compileCamera} from '../camera/camera-model.js';
import {createSingleDirectionWork,legacyCalibrationCandidates,importLegacyCalibrations} from '../camera/camera-migration.js';
import {t,translateText} from './i18n.js';

// Preview uses a detached copy. Cancel never writes either work record.
export function createCameraRulesDialog({root,getSession,onCommit,onError}){
  const row=document.createElement('div');row.className='camera-rule-summary';
  row.innerHTML='<div id="cameraRuleText" class="camera-status" data-no-i18n></div><button type="button" id="cameraNewRules">새 단일 방향 작업으로 복사</button><button type="button" id="cameraImportLegacy">이전 보정 선택 가져오기</button><div id="cameraConflicts" class="camera-status" data-no-i18n></div>';
  root.querySelector('.camera-output').prepend(row);
  const dialog=document.createElement('dialog');dialog.id='cameraRulesDialog';dialog.className='camera-rules-dialog';
  dialog.innerHTML='<h3>단일 방향 작업 미리보기</h3><p>원래 작업은 보존됩니다. 선택한 보정의 절대값만 새 계산에 적용합니다.</p><p>선택할 수 없는 보정은 이전 기록에 보관됩니다.</p><div id="cameraImportCandidates" data-no-i18n></div><div class="camera-rule-previews"><label>현재 문구<textarea id="cameraRulesBefore" readonly></textarea></label><label>적용 후 문구<textarea id="cameraRulesAfter" readonly></textarea></label></div><div class="camera-actions"><button type="button" id="cameraRulesCancel">취소</button><button type="button" id="cameraRulesApply">선택 적용</button></div>';
  root.append(dialog);
  const $=selector=>root.querySelector(selector);
  const reasons={source:'다른 원본',context:'모델 또는 Effort가 다름',field:'슬롯이 달라짐',manual:'수동 문구 유지 중',position:'위치 기록 없음',expression:'이 위치에서 선택되지 않는 표현',value:'올바르지 않은 보정값'};
  let original,base,preview;
  const text=session=>{const result=compileCamera(session);return result.fields[session.field]?.text||'';};
  function updatePreview(){
    preview=structuredClone(base);
    const ids=[...dialog.querySelectorAll('input:checked')].map(input=>input.value);
    if(ids.length)importLegacyCalibrations(preview,ids);
    $('#cameraRulesAfter').value=text(preview);
    $('#cameraRulesApply').disabled=original.rules===CAMERA_RULES&&!ids.length;
  }
  function open(){try{
    original=structuredClone(getSession());
    base=original.rules===LEGACY_CAMERA_RULES?createSingleDirectionWork(original,{id:'camera2_'+crypto.randomUUID().replaceAll('-','')}):structuredClone(original);
    const holder=$('#cameraImportCandidates');holder.replaceChildren();
    const candidates=legacyCalibrationCandidates(base);
    if(!candidates.length)holder.textContent=t('가져올 이전 보정이 없습니다.');
    for(const candidate of candidates){
      const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=candidate.id;input.disabled=!candidate.eligible;input.addEventListener('change',updatePreview);
      const p=candidate.point;label.append(input,document.createTextNode(` ${p.field} · ${p.cameraValue} · ${p.label}: ${p.value}${candidate.eligible?'':' — '+t(reasons[candidate.reason])}`));holder.append(label);
    }
    $('#cameraRulesBefore').value=text(original);updatePreview();dialog.showModal();
  }catch(error){onError(translateText(error.message));}}
  $('#cameraNewRules').onclick=open;$('#cameraImportLegacy').onclick=open;
  $('#cameraRulesCancel').onclick=()=>dialog.close();
  $('#cameraRulesApply').onclick=async()=>{try{
    const current=getSession();
    if(current.source.id!==original.source.id||current.revision!==original.revision)throw new Error('Camera source or revision changed. Prepare the request again.');
    await onCommit(preview);dialog.close();
  }catch(error){onError(translateText(error.message));}};
  return {render(session,compiled){
    $('#cameraNewRules').hidden=session.rules!==LEGACY_CAMERA_RULES;
    $('#cameraImportLegacy').hidden=session.rules!==CAMERA_RULES||!session.legacyCalibrationArchive;
    $('#cameraNewRules').disabled=Object.keys(session.pending||{}).length>0;
    $('#cameraImportLegacy').disabled=Object.keys(session.pending||{}).length>0;
    $('#cameraRuleText').textContent=t(session.rules===LEGACY_CAMERA_RULES?'이전 v1 작업 · 당시의 혼합 계산 유지':'단일 방향 v2 · 위치는 연속 이동, 축마다 대표 표현 하나')+'\n'+(compiled.fields[session.field]?.expressions||[]).map(e=>`${e.text}: ${e.weight}`).join(' · ');
    const conflicts=compiled.conflicts||[];
    $('#cameraConflicts').textContent=conflicts.length?t('수동·다른 문구의 카메라 조건도 확인하세요. 원문은 유지됩니다.')+'\n'+conflicts.map(c=>`${c.field} · ${c.start+1}: ${c.text}`).join('\n'):'';
  }};
}
