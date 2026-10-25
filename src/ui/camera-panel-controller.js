import {getJson,postJson} from '../api/client.js';
import {createCameraSession,confirmBaseline,moveCamera,compileCamera,editCameraOutput,resetCamera,resetCalibration,restoreSource,undoCamera,resumeManagedField,serializeCamera,syncCameraDraft,cancelCameraEdit,detachCamera,reconnectCamera,CAMERA_LABELS} from '../camera/camera-model.js';
import {t,translateText,getLanguage} from './i18n.js';
import {promptFields,readField,scanPrompt} from '../camera/prompt-spans.js';
import {wrapAngle} from '../camera/calibration.js';

const names=['정면','오른쪽 앞','오른쪽','오른쪽 뒤','후면','왼쪽 뒤','왼쪽','왼쪽 앞'];
const clone=x=>structuredClone(x),clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const signed=n=>(n>0?'+':'')+Math.round(n*10)/10;
const evidenceLabel=value=>String(value).startsWith('user-confirmed')?'사용자 확인':String(value).startsWith('saved generation')?'저장된 생성 기록':value==='actual-prompt category'?'원본 문구의 범주':'저장된 확인 기록';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createCameraPanelController({getPreset,setPreset,onOpen,onClose,onGenerate,showToast,isGenerating=()=>false}){
  const root=document.getElementById('cameraView'),$=s=>root.querySelector(s),all=s=>[...root.querySelectorAll(s)];
  const style=document.createElement('link');style.rel='stylesheet';style.href='/src/ui/camera-panel.css';document.head.append(style);
  const activeNotice=document.createElement('button');activeNotice.id='cameraActiveNotice';activeNotice.type='button';activeNotice.textContent='카메라 보정 적용 중';activeNotice.hidden=true;document.getElementById('dockCommand').append(activeNotice);
  root.innerHTML=`<div class="camera-toolbar"><h2>카메라 · 가중치 보정</h2><div class="camera-row"><label>작업 원본 <select id="cameraSessionPicker"><option value="">원본 선택</option></select></label><button id="cameraDisable" type="button">카메라 비활성화</button></div></div>
    <div id="cameraEmpty" class="summary">History나 최근 결과의 ‘카메라로 새 구도’, 또는 이미지 가져오기의 카메라 버튼에서 시작하세요.</div>
    <div id="cameraBody" hidden><div class="camera-layout"><section class="camera-images"><div><div class="camera-image-label" id="cameraSourceLabel"></div><img id="cameraSourceImage" alt="보존된 카메라 원본"></div><div><div class="camera-image-label">새 결과 · 기준본은 그대로 유지</div><img id="cameraResultImage" class="camera-result" alt="카메라 생성 비교 결과"><button type="button" id="cameraResultAsSource" hidden>이 결과를 새 출발점으로</button></div><div class="camera-baseline-summary"><div id="cameraBaselineText" class="camera-status"></div><div id="cameraBaselineChoices" class="camera-baselines" hidden></div></div></section>
    <section class="camera-controls"><div class="camera-row"><strong>중심 주위 이동</strong><span class="muted">카메라를 직접 잡아 이동</span></div><div class="camera-stage"><svg role="img" aria-label="카메라 위치 입력용 구체 도식"></svg><button type="button" id="cameraOrbitHandle" class="camera-grab" aria-label="카메라 위치 손잡이">카메라</button></div><div id="cameraPositionText" class="camera-status"></div><div class="camera-bearings">${[0,45,90,135,180,-135,-90,-45].map((v,i)=>`<button type="button" data-camera-yaw="${v}">${names[i]}</button>`).join('')}</div>
    <div class="camera-tools"><div><strong>제자리 팬·틸트</strong><div class="camera-pad" data-camera-pad="aim"><button type="button" class="camera-handle" data-camera-handle="aim" aria-label="팬·틸트 손잡이">＋</button></div><div id="cameraAimText" class="muted"></div></div><div><strong>롤 · 화면 기울기</strong><div class="camera-pad" data-camera-pad="roll"><button type="button" class="camera-handle" data-camera-handle="roll" aria-label="롤 손잡이">↻</button></div><div id="cameraRollText" class="muted"></div></div>
    <div><strong>카메라 높이</strong><div class="camera-rail" data-camera-pad="height"><button type="button" class="camera-handle" data-camera-handle="height" aria-label="높이 손잡이">↕</button></div><div class="camera-scale"><span>바닥</span><span>허리</span><span>눈</span><span>머리 위</span></div></div><div><strong>거리·프레이밍</strong><div class="camera-rail" data-camera-pad="framing"><button type="button" class="camera-handle" data-camera-handle="framing" aria-label="프레이밍 손잡이">↔</button></div><div class="camera-scale"><span>가까이</span><span>허벅지까지</span><span>넓게</span></div></div></div>
    <div class="camera-row"><span>출력</span><button type="button" data-camera-size="832,1216">세로</button><button type="button" data-camera-size="1024,1024">정사각</button><button type="button" data-camera-size="1216,832">가로</button><span id="cameraSizeText" class="muted"></span></div><div class="camera-status">촬영 목표 입력 도식 · 각도는 범주 대표값입니다.<br>팬·틸트·높이·롤의 독립 효과와 시선 보존은 실험적입니다.</div>
    <label><input type="checkbox" id="cameraReleaseViewer"> 시선 실험: 이동 시 looking at viewer 제약 해제</label></section></div>
    <section class="camera-output"><div class="camera-row"><strong>현재 카메라 적용 후 · 다음 생성에 사용할 문구</strong><label>관리 위치 <select id="cameraField"></select></label></div><textarea id="cameraEffectivePrompt" spellcheck="false" aria-label="카메라 적용 후 직접 편집할 생성 문구"></textarea><div id="cameraEditState" class="camera-status" role="status" aria-live="polite"></div><div id="cameraErrors" class="camera-status error" role="alert"></div>
    <div class="camera-actions"><button id="cameraReset" type="button">카메라만 복귀</button><button id="cameraCorrectionReset" type="button">보정 적용 해제</button><button id="cameraCorrectionEnable" type="button">보정 다시 적용</button><button id="cameraRestore" type="button">원본 전체 복원</button><button id="cameraUndo" type="button">복귀·편집 취소</button><button id="cameraResume" type="button" hidden>이 문구의 카메라 관리 재개</button><button id="cameraGenerate" type="button" class="primary">이 구도로 생성</button></div>
    <div class="camera-status">카메라만 복귀: 문구·크기·보정 기록 유지 / 전체 복원: 원본 문구·설정으로 복원, 보정은 보관 후 적용 해제 / 취소 가능</div>
    <details><summary>사용자 보정 기록 · 해당 표현의 주변 구간에 적용</summary><div id="cameraCalibrationList" class="camera-calibrations"></div></details><details><summary>실제 전송 문구 · 기존 품질·UC 처리 포함</summary><pre id="cameraFinalPayload" class="camera-final-payload">생성 준비 후 확인할 수 있습니다.</pre></details></section></div>`;
  let session=null,timer=null,saveChain=Promise.resolve(),suppress=false,lastResult=null,baselineEditing=false;
  for(const id of ['cameraSourceLabel','cameraSessionPicker','cameraErrors','cameraEditState','cameraBaselineText','cameraPositionText','cameraAimText','cameraRollText','cameraHeightText','cameraCalibrationList','cameraField'])$('#'+id)?.setAttribute('data-no-i18n','');
  const cancelEdit=document.createElement('button');cancelEdit.type='button';cancelEdit.id='cameraCancelEdit';cancelEdit.textContent='현재 미완성 편집 취소';cancelEdit.hidden=true;$('#cameraUndo').after(cancelEdit);cancelEdit.onclick=()=>mutate(()=>cancelCameraEdit(session));
  const help=document.createElement('button');help.type='button';help.textContent='카메라 사용 안내';help.id='cameraHelp';$('.camera-toolbar').append(help);help.onclick=()=>document.dispatchEvent(new CustomEvent('chaessi:open-manual',{detail:{chapter:'camera-start'}}));
  const busyNote=document.createElement('div');busyNote.id='cameraBusyNote';busyNote.className='camera-status';busyNote.textContent='생성 중에도 편집할 수 있습니다. 수정은 다음 요청에 반영됩니다.';$('#cameraEffectivePrompt').after(busyNote);
  const baselineEdit=document.createElement('button');baselineEdit.type='button';baselineEdit.id='cameraEditBaseline';baselineEdit.textContent='그림과 기준이 다르면 수정';$('#cameraBaselineText').after(baselineEdit);
  baselineEdit.onclick=()=>{baselineEditing=!baselineEditing;baselineChoices();};
  $('[data-camera-pad=height]').insertAdjacentHTML('afterend','<div id="cameraHeightText" class="muted"></div>');
  async function refreshList(){const response=await getJson('/api/camera/sessions');$('#cameraSessionPicker').innerHTML=`<option value="">${t('원본 선택')}</option>`+response.items.map(s=>`<option value="${escape(s.id)}">${escape(s.label||s.id)}</option>`).join('');if(session)$('#cameraSessionPicker').value=session.source.id;}
  function save(){if(!session)return Promise.resolve();clearTimeout(timer);const value=clone(session);const task=()=>postJson('/api/camera/sessions/'+encodeURIComponent(value.source.id),{session:value});saveChain=saveChain.then(task,task).catch(e=>{showToast(t('카메라 작업 저장 실패: {message}',{message:translateText(e.message)}),true);throw e;});return saveChain;}
  function scheduleSave(){clearTimeout(timer);timer=setTimeout(()=>void save().catch(()=>{}),300);}
  function applyDraft(){suppress=true;try{setPreset(clone(session.draft));}finally{suppress=false;}}
  function mutate(fn,{draft=false,message=''}={}){if(!session)return;try{fn();if(draft)applyDraft();render();scheduleSave();if(message)$('#cameraEditState').textContent=t(message);}catch(e){$('#cameraErrors').textContent=translateText(e.message);}}
  function draw(){
    if(!session||root.hidden)return;const box=$('.camera-stage'),svg=$('.camera-stage svg'),w=box.clientWidth,h=box.clientHeight,cx=w/2,cy=h/2,r=Math.min(w*.32,103),rad=Math.PI/180;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);const p=(a,e)=>[cx+r*Math.sin(a*rad)*Math.cos(e*rad),cy+r*(.38*Math.cos(a*rad)*Math.cos(e*rad)-.93*Math.sin(e*rad))];
    const path=points=>points.map((q,i)=>(i?'L':'M')+q.map(v=>v.toFixed(1)).join(' ')).join(' ')+'Z';let marks='';
    for(const e of [-60,-30,0,30,60])marks+=`<path class="camera-grid" d="${path(Array.from({length:73},(_,i)=>p(i*5,e)))}"/>`;
    for(const a of [0,45,90,135])marks+=`<path class="camera-grid" d="${path(Array.from({length:73},(_,i)=>{const t=i*5*rad;return [cx+r*Math.sin(a*rad)*Math.cos(t),cy+r*(.38*Math.cos(a*rad)*Math.cos(t)-.93*Math.sin(t))]}))}"/>`;
    const known=session.camera.yaw!==null,pos=known?p(session.camera.yaw,session.camera.elevation??0):[cx,cy];
    marks+=`<circle class="camera-center" cx="${cx}" cy="${cy}" r="5"/><text x="${cx}" y="${cy-14}" text-anchor="middle">중심</text><text x="${cx}" y="20" text-anchor="middle">뒤쪽</text><text x="${cx}" y="${h-12}" text-anchor="middle">인물 정면 ↓</text><text x="10" y="44">인물 왼쪽</text><text x="${w-10}" y="44" text-anchor="end">인물 오른쪽</text>`;
    if(known)marks+=`<line class="camera-ray" x1="${cx}" y1="${cy}" x2="${pos[0]}" y2="${pos[1]}"/>`;
    if(session.baseline.yaw!==null){const b=p(session.baseline.yaw,session.baseline.elevation??0);marks+=`<circle class="camera-grid" cx="${b[0]}" cy="${b[1]}" r="8" stroke-dasharray="3 3"/>`;}
    svg.innerHTML=marks;const handle=$('#cameraOrbitHandle');handle.style.left=pos[0]+'px';handle.style.top=pos[1]+'px';handle.textContent=known?'카메라':'기준 확인';handle.disabled=!known;handle.style.borderStyle=known&&Math.cos(session.camera.yaw*rad)<0?'dashed':'solid';
  }
  function baselineChoices(){
    const missing=['yaw','elevation','framing'].filter(a=>baselineEditing||session.baseline[a]===null);const holder=$('#cameraBaselineChoices');holder.hidden=!missing.length;
    const options={yaw:[['0','정면'],['45','오른쪽 앞'],['90','오른쪽 측면'],['135','오른쪽 뒤'],['180','후면'],['-135','왼쪽 뒤'],['-90','왼쪽 측면'],['-45','왼쪽 앞']],elevation:[['0','눈높이 시점'],['35','위에서'],['80','거의 수직 위'],['-35','아래에서'],['-80','거의 수직 아래']],framing:[['0','클로즈업'],['.25','상반신'],['.5','허벅지까지'],['.75','전신'],['1','넓은 샷']]};
    const key=session.source.id+'|'+getLanguage()+'|'+baselineEditing+'|'+missing.join('|');if(holder.dataset.missing===key)return;holder.dataset.missing=key;holder.innerHTML=missing.length?'<strong>'+(baselineEditing?'원본 기준 직접 수정 · 기존 보정은 보관 후 적용 해제':'모르는 원본 기준만 확인')+'</strong><br>'+missing.map(a=>`<label>${CAMERA_LABELS[a]}<select data-baseline-axis="${a}"><option value="">${baselineEditing?'이 항목 유지':'선택하세요'}</option>${options[a].map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label>`).join('')+'<button type="button" id="cameraConfirmBaseline">선택한 기준 기록</button>':'';
    holder.querySelector('button')?.addEventListener('click',()=>mutate(()=>{const values={};holder.querySelectorAll('select').forEach(s=>{if(s.value!=='')values[s.dataset.baselineAxis]=Number(s.value);});if(!Object.keys(values).length)return;session.checkpoint=clone({...session,checkpoint:null});if(Object.keys(values).some(a=>session.baseline[a]!==null&&session.baseline[a]!==values[a]))session.calibrationEnabled=false;baselineEditing=false;confirmBaseline(session,values);}));
  }
  function render(){
    activeNotice.hidden=!session?.enabled;
    const placeholder=$('#cameraSessionPicker option[value=""]');if(placeholder)placeholder.textContent=t('원본 선택');
    for(const img of all('img[alt]')){img.dataset.sourceAlt||=img.alt;img.alt=t(img.dataset.sourceAlt);}
    $('#cameraEmpty').hidden=Boolean(session);$('#cameraBody').hidden=!session;if(!session)return;
    cancelEdit.hidden=!session.pending?.[session.field];busyNote.hidden=!isGenerating();
    const compiled=compileCamera(session),f=compiled.fields[session.field],active=document.activeElement;
    lastResult=session.latestResult||null;if(lastResult){$('#cameraResultImage').src=lastResult.url;$('#cameraResultAsSource').hidden=false;}else{$('#cameraResultImage').removeAttribute('src');$('#cameraResultAsSource').hidden=true;}
    $('#cameraSourceLabel').textContent=session.source.label||session.source.id;if(session.source.imageUrl)$('#cameraSourceImage').src=session.source.imageUrl;else $('#cameraSourceImage').removeAttribute('src');
    const known=session.baseline.yaw!==null;$('#cameraBaselineText').textContent=t('원본 기준: {bearing} / {elevation} / 프레이밍 {framing}',{bearing:t(known?names[Math.round(((session.baseline.yaw+360)%360)/45)%8]:'방향 미확인'),elevation:session.baseline.elevation===null?t('상하 시점 미확인'):t('상하 대표값 {value}°',{value:session.baseline.elevation}),framing:session.baseline.framing??t('미확인')})+'\n'+Object.entries(session.evidence).map(([a,v])=>`${t(CAMERA_LABELS[a])}: ${t(evidenceLabel(v))}`).join(' · ');
    baselineChoices();$('#cameraPositionText').textContent=(known?t('{bearing} · 원본에서 {value}°',{bearing:t(names[Math.round(((session.camera.yaw+360)%360)/45)%8]),value:signed(wrapAngle(session.camera.yaw-session.baseline.yaw))}):t('방향 기준을 먼저 확인하세요'))+' / '+t('상하 {value}',{value:session.camera.elevation===null?t('미확인'):signed(session.camera.elevation-(session.baseline.elevation??0))+'°'});
    all('[data-camera-yaw]').forEach(b=>{b.disabled=!known;b.setAttribute('aria-pressed',String(known&&Math.abs(wrapAngle(Number(b.dataset.cameraYaw)-session.camera.yaw))<.1));});
    const aim=$('[data-camera-handle=aim]');aim.style.left=(50+(session.camera.pan||0)*32)+'%';aim.style.top=(50-(session.camera.tilt||0)*30)+'%';$('#cameraAimText').textContent=t('팬 {pan} · 틸트 {tilt} (조작량)',{pan:signed(session.camera.pan*100),tilt:signed(session.camera.tilt*100)});
    const rr=(session.camera.roll??0)*Math.PI/180,roll=$('[data-camera-handle=roll]');roll.style.left=(50+Math.sin(rr)*28)+'%';roll.style.top=(50-Math.cos(rr)*29)+'%';$('#cameraRollText').textContent=session.camera.roll===null?t('원본 유지 · 기울기 미확인'):t('목표 {value}°',{value:signed(session.camera.roll)});
    for(const a of ['height','framing'])$(`[data-camera-handle=${a}]`).style.left=(12+(session.camera[a]??.5)*76)+'%';
    $('#cameraHeightText').textContent=session.camera.height===null?t('원본 유지 · 물리적 높이 미확인'):t('높이 조작값 {value}',{value:Math.round(session.camera.height*100)});
    $('#cameraSizeText').textContent=`${session.draft.params.width} × ${session.draft.params.height}`;$('#cameraReleaseViewer').checked=Boolean(session.releaseViewer);
    const fields=promptFields(session.draft),fieldOptions=fields.map(f=>`<option value="${f.key}">${translateText(f.label)}</option>`).join('');if($('#cameraField').innerHTML!==fieldOptions)$('#cameraField').innerHTML=fieldOptions;$('#cameraField').value=session.field;
    if(active!==$('#cameraEffectivePrompt'))$('#cameraEffectivePrompt').value=session.pending[session.field]?.text??f?.text??readField(session.draft,session.field)??'';
    const records=Object.entries(session.calibrations).flatMap(([key,list])=>list.map((k,i)=>({key,index:i,...k}))),manual=session.manual[session.field]!==undefined;
    $('#cameraEditState').textContent=t(manual?'수동 문구 유지 · 관리 재개 가능':records.length&&session.calibrationEnabled?'사용자 보정 적용 · 카메라 위치는 그대로':'기본 대응 적용')+'\n'+compiled.notes.map(n=>translateText(n)).join('\n');
    const errors=[...compiled.errors,...Object.values(session.pending).map(p=>p.error)];if(session.draft.params.model!=='nai-diffusion-5-full')errors.push('V4.5 읽기 자료입니다. 기존 작업대에서 V5로 명시적으로 전환해야 생성할 수 있습니다.');
    $('#cameraErrors').textContent=[...new Set(errors)].map(e=>String(e).split('; ').map(part=>translateText(part)).join('; ')).join('\n');$('#cameraGenerate').disabled=errors.length>0||!session.enabled||isGenerating();
    $('#cameraResume').hidden=!manual;$('#cameraUndo').disabled=!session.checkpoint;$('#cameraCorrectionEnable').disabled=session.calibrationEnabled||!records.length;$('#cameraCorrectionReset').disabled=!session.calibrationEnabled||!records.length;
    $('#cameraCalibrationList').innerHTML=records.length?records.map(r=>`<div>${escape(t(CAMERA_LABELS[r.axis]))} · ${r.axis==='yaw'&&Number.isFinite(r.cameraValue)?t('원본에서 {value}°',{value:signed(wrapAngle(r.cameraValue-session.baseline.yaw))}):t('조작값 {value}',{value:r.cameraValue??r.x})} · ${escape(r.label||r.term)}: ${r.base} → ${r.value} (${String(r.context).endsWith('|medium')?'Medium':'High'}) <button type="button" data-remove-calibration="${escape(r.key)}" data-knot="${r.index}">${t('이 보정 되돌리기')}</button></div>`).join(''):t('아직 보정 기록이 없습니다. 생성 문구의 숫자를 직접 수정하세요. 지원 범위 -10~10, 소수 셋째 자리.');
    draw();
  }
  async function openSource({preset,source,record=null,confirmed={}}){
    if(session)await save();
    const saved=(await getJson('/api/camera/sessions/'+encodeURIComponent(source.id))).session;
    session=saved||record&&{...clone(record),source:{...record.source,imageUrl:record.source.imageUrl||source.imageUrl},draft:clone(record.draft),pending:{},checkpoint:null}||createCameraSession({preset,source,confirmed});
    baselineEditing=false;session.enabled=true;session.pending||={};session.manual||={};session.checkpoint??=null;applyDraft();onOpen();render();await save();await refreshList();
  }
  async function switchSession(id){if(!id)return;const stored=(await getJson('/api/camera/sessions/'+encodeURIComponent(id))).session;if(!stored)return;await openSource({preset:stored.sourcePreset,source:stored.source});}
  function drag(el,initial,move){el.addEventListener('pointerdown',event=>{if(!session||event.button!==0||Object.keys(session.pending).length)return;event.preventDefault();el.setPointerCapture(event.pointerId);const start=initial(event);const update=e=>mutate(()=>move(e,start));const end=()=>{el.removeEventListener('pointermove',update);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);void save().catch(()=>{});};el.addEventListener('pointermove',update);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);});}
  drag($('#cameraOrbitHandle'),e=>({x:e.clientX,y:e.clientY,yaw:session.camera.yaw,elevation:session.camera.elevation}),(e,a)=>{moveCamera(session,'yaw',a.yaw+(e.clientX-a.x)*1.1);if(a.elevation!==null)moveCamera(session,'elevation',a.elevation-(e.clientY-a.y)*.65);});
  $('#cameraOrbitHandle').addEventListener('keydown',e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();mutate(()=>moveCamera(session,['ArrowLeft','ArrowRight'].includes(e.key)?'yaw':'elevation',(session.camera[['ArrowLeft','ArrowRight'].includes(e.key)?'yaw':'elevation']??0)+(['ArrowRight','ArrowUp'].includes(e.key)?5:-5)));});
  for(const type of ['aim','roll','height','framing']){const handle=$(`[data-camera-handle=${type}]`);drag(handle,()=>null,e=>{const box=$(`[data-camera-pad=${type}]`).getBoundingClientRect(),x=(e.clientX-box.left)/box.width,y=(e.clientY-box.top)/box.height;if(type==='aim'){moveCamera(session,'pan',clamp((x-.5)/.32,-1,1));moveCamera(session,'tilt',clamp((.5-y)/.3,-1,1));}else moveCamera(session,type,type==='roll'?Math.atan2(x-.5,.5-y)*180/Math.PI:clamp((x-.12)/.76,0,1));});handle.addEventListener('keydown',e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();const axis=type==='aim'?(['ArrowUp','ArrowDown'].includes(e.key)?'tilt':'pan'):type;mutate(()=>moveCamera(session,axis,(session.camera[axis]??0)+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1)*(axis==='roll'?5:.05)));});}
  all('[data-camera-yaw]').forEach(b=>b.addEventListener('click',()=>mutate(()=>moveCamera(session,'yaw',Number(b.dataset.cameraYaw)))));
  all('[data-camera-size]').forEach(b=>b.addEventListener('click',()=>mutate(()=>{const [w,h]=b.dataset.cameraSize.split(',').map(Number);session.draft.params.width=w;session.draft.params.height=h;session.revision++;},{draft:true})));
  $('#cameraEffectivePrompt').addEventListener('input',e=>mutate(()=>{const result=editCameraOutput(session,session.field,e.target.value);if(result.kind==='draft')applyDraft();}));
  $('#cameraField').addEventListener('change',e=>mutate(()=>{session.field=e.target.value;session.revision++;}));
  $('#cameraReleaseViewer').addEventListener('change',e=>mutate(()=>{session.releaseViewer=e.target.checked;session.revision++;}));
  $('#cameraReset').onclick=()=>mutate(()=>resetCamera(session));$('#cameraCorrectionReset').onclick=()=>mutate(()=>resetCalibration(session));
  $('#cameraCorrectionEnable').onclick=()=>mutate(()=>{session.calibrationEnabled=true;session.revision++;});
  $('#cameraRestore').onclick=()=>mutate(()=>restoreSource(session),{draft:true});$('#cameraUndo').onclick=()=>mutate(()=>{session=undoCamera(session);},{draft:true});
  $('#cameraResume').onclick=()=>mutate(()=>resumeManagedField(session),{draft:true,message:'카메라 관리를 다시 연결했습니다. 복귀·편집 취소로 이전 문구를 복구할 수 있습니다.'});
  $('#cameraCalibrationList').addEventListener('click',e=>{const b=e.target.closest('[data-remove-calibration]');if(!b)return;mutate(()=>{session.checkpoint=clone({...session,checkpoint:null});session.calibrations[b.dataset.removeCalibration].splice(Number(b.dataset.knot),1);session.revision++;});});
  $('#cameraDisable').onclick=()=>{if(!session)return;try{const plain=detachCamera(session);suppress=true;try{setPreset(plain);}finally{suppress=false;}void save().catch(()=>{});activeNotice.hidden=true;onClose();}catch(e){$('#cameraErrors').textContent=translateText(e.message);}};
  $('#cameraGenerate').onclick=()=>onGenerate();$('#cameraSessionPicker').onchange=e=>void switchSession(e.target.value).catch(e=>showToast(e.message,true));
  $('#cameraResultAsSource').onclick=()=>{if(lastResult)document.dispatchEvent(new CustomEvent('chaessi:camera-result-source',{detail:{id:lastResult.id}}));};
  new ResizeObserver(draw).observe($('.camera-stage'));void refreshList().catch(()=>{});
  activeNotice.onclick=()=>{onOpen();render();};
  document.addEventListener('chaessi:language-change',render);
  return {
    openSource,flush:save,render,
    resume(){if(session){reconnectCamera(session,getPreset());applyDraft();onOpen();render();scheduleSave();}else{onOpen();render();}},
    deactivate(){if(session){session.enabled=false;scheduleSave();}activeNotice.hidden=true;},
    snapshot(){return session?.enabled?clone(session):null;},
    request(preset){if(!session?.enabled)return null;this.syncPreset(preset);const output=compileCamera(session);if(output.errors.length)throw new Error(output.errors.join('; '));if(Object.keys(session.pending).length)throw new Error('완전한 가중치 숫자를 입력하세요.');return {...serializeCamera(session),pending:clone(session.pending)};},
    syncPreset(preset){if(suppress||!session?.enabled||JSON.stringify(session.draft)===JSON.stringify(preset))return;syncCameraDraft(session,preset);render();scheduleSave();},
    finalPayload(payload){$('#cameraFinalPayload').textContent=JSON.stringify(payload,null,2);},
    async received(response,url,sourceId){
      const result={id:response.generation.id,url};
      if(session?.source.id===sourceId){session.latestResult=result;render();await save();}
      else if(sourceId){await save();const stored=(await getJson('/api/camera/sessions/'+encodeURIComponent(sourceId))).session;if(stored){stored.latestResult=result;await postJson('/api/camera/sessions/'+encodeURIComponent(sourceId),{session:stored});}}
    },
  };
}
