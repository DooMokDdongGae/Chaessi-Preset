import {confirmAction} from './confirmation.js';
import {getJson,postJson} from '../api/client.js';
import {createCompositionEditor} from './composition-editor.js';
import {t} from './i18n.js';

const dataUrl = value => 'data:image/png;base64,'+value;
export function createCompositionController({getPreset,onSaved,onUseSource,showToast}) {
  const dialog=document.createElement('dialog');dialog.id='compositionDialog';dialog.className='composition-dialog';
  dialog.innerHTML=`<header class="dialog-header"><div><h2>Expand composition</h2><p>Arrange the picture, fill empty space, and touch up with the round brush.</p></div><button type="button" id="compositionClose">Close</button></header>
  <div class="composition-layout"><section id="compositionEditor"></section><aside class="composition-sidebar">
    <div class="actions"><button id="compositionUpload">Choose image</button><button id="compositionExport">Save editing session</button><button id="compositionImport">Open editing session</button></div>
    <input id="compositionFile" type="file" accept="image/png,image/jpeg,image/webp" hidden><input id="compositionDraftFile" type="file" accept="application/json,.json" hidden>
    <details><summary>Size and placement</summary><div class="tool-grid"><label>Width<input id="compositionWidth" type="number" step="8" min="64" max="4096"></label><label>Height<input id="compositionHeight" type="number" step="8" min="64" max="4096"></label></div><button id="compositionApplySize">Apply output size</button><div class="tool-grid"><label>Picture scale (%)<input id="compositionScale" type="number" min="5" max="800" step="1"></label><label>Angle (°)<input id="compositionAngle" type="number" min="-180" max="180"></label></div><button id="compositionApplyPlacement">Apply placement</button><button id="compositionReset">Center original picture</button></details>
    <details open><summary>Scene prompt</summary><p>Changes here apply only to this composition.</p><textarea id="compositionPrompt" rows="3" data-no-i18n></textarea><label>Undesired content<textarea id="compositionNegative" rows="2" data-no-i18n></textarea></label><button id="compositionCurrentPrompt">Copy current workbench prompt</button></details>
    <details><summary>Characters</summary><p>Place a new character in the blue area or paint space for it.</p><label><input id="compositionUseCoords" type="checkbox">Use marker positions</label><div id="compositionCharacters"></div><button id="compositionAddCharacter">Add character</button></details>
    <details><summary>Generation settings</summary><label>Effort<select id="compositionEffort"><option value="high">High</option><option value="medium">Medium</option></select></label><label>Inpaint Strength<input id="compositionStrength" type="number" min="0" max="1" step="0.05" value="1"></label><label>Image Strength<input id="compositionImageStrength" type="number" min="0" max="1" step="0.05" value="0.7"></label><label>Image Noise<input id="compositionNoise" type="number" min="0" max="1" step="0.05" value="0"></label><label>Padding (px)<input id="compositionPadding" type="number" min="0" max="32" step="8" value="16"></label><label>Blend boundary (px)<input id="compositionSeam" type="number" min="0" max="32" step="1" value="8"></label><p>The original interior is preserved. The selected area and boundary can change.</p></details>
    <div class="composition-submit"><button id="compositionReview" class="primary">Review image and mask</button><div id="compositionCost" role="status"></div><button id="compositionRun" class="primary" disabled>Generate expanded image</button></div>
  </aside></div><footer id="compositionStatus" role="status" aria-live="polite">Ready.</footer>
  <section id="compositionPreview" class="composition-preview" hidden><h3>Ready to send</h3><p>These are the exact image and mask prepared for this generation. White areas can change.</p><div class="composition-preview-grid"><figure><img id="compositionPreviewSource" alt="Prepared source"><figcaption>Source image</figcaption></figure><figure><img id="compositionPreviewMask" alt="Generation mask"><figcaption>Generation mask</figcaption></figure><figure><img id="compositionPreviewApply" alt="Result application mask"><figcaption>Result application mask</figcaption></figure></div><p id="compositionPreparedPrompt" data-no-i18n></p></section>
  <section id="compositionResult" class="composition-result" hidden><h3>Saved result</h3><img id="compositionResultImage" alt="Completed result"><div class="actions"><button id="compositionProtected">Preserved original</button><button id="compositionFull">Full generated result</button><button id="compositionAdopt">Use result and keep editing</button><button id="compositionBranch">Try another arrangement</button><button id="compositionUseInpaint">Use for Inpaint</button><a id="compositionDownload" download>Save PNG</a></div><p>Adopting the result starts a fresh brush session. The original arrangement stays in History.</p></section>`;
  document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);
  const help=document.createElement('button');help.id='compositionHelp';help.type='button';help.textContent='Help';help.onclick=()=>document.dispatchEvent(new CustomEvent('chaessi:open-manual',{detail:{chapter:'composition'}}));$('compositionClose').before(help);
  let busy=false,prepared=null,result=null,parentId=null,sourceId=null,charSignature='',revision=0,lastSavedRevision=-1;
  const editor=createCompositionEditor($('compositionEditor'),{onChange:()=>{invalidate();syncControls();},onStatus:status});
  function status(message,error=false){$('compositionStatus').textContent=error?t('Error details: {details}',{details:message}):t(message);$('compositionStatus').classList.toggle('error',error);}
  function invalidate(){revision++;prepared=null;$('compositionRun').disabled=true;$('compositionPreview').hidden=true;$('compositionCost').textContent=t('Review after editing.');}
  function syncControls(){
    const r=editor.getRecipe(),p=editor.getPreset();if(!r)return;
    const set=(id,value)=>{if(document.activeElement!==$(id))$(id).value=value;};
    set('compositionWidth',r.frame.width);set('compositionHeight',r.frame.height);set('compositionScale',Math.round(r.transform.scale*100));set('compositionAngle',Math.round(r.transform.angle*180/Math.PI));
    set('compositionPrompt',p.prompt_parts.base);set('compositionNegative',p.prompt_parts.undesired);
    const chars=p.prompt_parts.characters||[];$('compositionUseCoords').checked=chars.filter(c=>c.enabled!==false&&c.prompt.trim()).every(c=>c.position_mode==='custom');
    const sig=JSON.stringify(chars.map(c=>[c.id,c.prompt,c.undesired,c.enabled]));
    if(sig!==charSignature){charSignature=sig;const list=$('compositionCharacters');list.replaceChildren();chars.forEach((c,i)=>{
      const row=document.createElement('fieldset');row.className='composition-character';const legend=document.createElement('legend');legend.textContent=t('Character')+' '+(i+1)+' · '+t(r.bindings[i]==='frame'?'Attached to frame':'Follows picture');row.append(legend);
      const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=c.enabled!==false;enabled.setAttribute('aria-label',t('Enable character'));enabled.onchange=()=>editor.editCharacter(i,{enabled:enabled.checked});row.append(enabled);
      for(const [key,label]of [['prompt','Character prompt'],['undesired','Undesired content']]){const input=document.createElement('textarea');input.rows=2;input.value=c[key]||'';input.dataset.noI18n='';input.setAttribute('aria-label',t(label));input.onchange=()=>editor.editCharacter(i,{[key]:input.value});row.append(input);}list.append(row);
    });}
  }
  function locked(value){busy=value;editor.setLocked(value);dialog.querySelectorAll('aside button,aside input,aside select,aside textarea,header button,.composition-result button').forEach(el=>el.disabled=value);$('compositionRun').disabled=value||!prepared;}
  function settings(){return {effort:$('compositionEffort').value,inpaint_strength:Number($('compositionStrength').value),image_strength:Number($('compositionImageStrength').value),image_noise:Number($('compositionNoise').value),padding:Number($('compositionPadding').value),seam:Number($('compositionSeam').value)};}
  function setSettings(s={}){for(const [id,key,fallback]of [['compositionEffort','effort','high'],['compositionStrength','inpaint_strength',1],['compositionImageStrength','image_strength',.7],['compositionNoise','image_noise',0],['compositionPadding','padding',16],['compositionSeam','seam',8]])$(id).value=s[key]??fallback;}
  async function loadSession(session,mode='move'){
    if(session.schema!=='chaessi.composition-draft.v1'||!session.preset?.prompt_parts||session.preset.params?.model!=='nai-diffusion-5-full')throw new Error('Choose a V5 composition session.');
    await editor.load({sourceUrl:dataUrl(session.source_png),manualUrl:session.manual_mask_png?dataUrl(session.manual_mask_png):null,composition:session.recipe,prompt:session.preset,brushSize:session.brush_size,maskVisible:session.mask_visible,mode});
    sourceId=null;parentId=session.parent_id||null;result=null;charSignature='';invalidate();setSettings(session.settings);syncControls();$('compositionResult').hidden=true;status('Ready.');
  }
  async function loadImage(item,mode='move'){
    if(!item)return;
    if(item.source_png){await loadSession({schema:'chaessi.composition-draft.v1',...item,preset:item.preset||getPreset()},mode);return;}
    let prompt=getPreset(),url=item.url,localUrl=null,meta=null;
    if(item.id){meta=(await getJson('/api/generations/'+encodeURIComponent(item.id))).generation;if(meta.internal_preset?.params?.model==='nai-diffusion-5-full')prompt=meta.internal_preset;}
    if(item.file){url=localUrl=URL.createObjectURL(item.file);}
    try{await editor.load({sourceUrl:url,prompt,mode});}finally{if(localUrl)URL.revokeObjectURL(localUrl);}
    sourceId=item.id||null;parentId=item.id||null;result=null;charSignature='';invalidate();setSettings({effort:prompt.params.effort});syncControls();$('compositionResult').hidden=true;status('Ready.');
  }
  async function open(item,options={}){
    if(busy)return;
    if((item||options.restoreId)&&editor.isDirty()&&!await confirmAction(t('Replace the current composition? Save the editing session to keep it.')))return;
    if(!dialog.open)dialog.showModal();locked(true);
    try {if(options.restoreId){const data=await getJson('/api/image-tools/composition-session?id='+encodeURIComponent(options.restoreId));await loadSession(data.session);}
      else if(item)await loadImage(item,options.mode||'move');else if(!editor.getRecipe()){status('Choose an image first.');}else{editor.fit();}
    }catch(e){status(e.message,true);showToast(e.message,true);}finally{locked(false);}
  }
  async function review(){
    if(busy)return;
    // onchange from the focused prompt runs before this click; freeze one revision.
    let state;try{state=editor.export();}catch(e){status(e.message,true);return;}
    const rev=revision;locked(true);prepared=null;
    try{
      const body={tool:'composition',prompt_source:'current',preset:state.preset,settings:{...settings(),composition:state.recipe,manual_mask_png:state.manual_mask_png}};
      if(sourceId)body.source_id=sourceId;else{body.source_png=state.source_png;if(parentId)body.composition_parent_id=parentId;}
      const response=await postJson('/api/image-tools/prepare',body);
      if(revision!==rev)throw new Error('The composition changed. Review it again.');
      prepared={...response,revision:rev};const p=response.plan;
      for(const [id,key]of [['compositionPreviewSource','source'],['compositionPreviewMask','mask'],['compositionPreviewApply','apply']])$(id).src=dataUrl(p.preview[key].png);
      $('compositionPreparedPrompt').textContent=p.prompt_preview;$('compositionPreview').hidden=false;
      $('compositionCost').textContent=t('Estimated {anlas} Anlas',{anlas:p.cost.anlas??t('Unknown')})+` · ${p.request_size.width} × ${p.request_size.height}`;
      status('Reviewed. Generate when the image and white mask match your intent.');
      $('compositionPreview').scrollIntoView({block:'nearest',behavior:'smooth'});
    }catch(e){invalidate();status(e.message,true);}finally{locked(false);}
  }
  async function display(response){
    result=response;editor.markSaved();lastSavedRevision=revision;
    $('compositionResult').hidden=false;$('compositionResultImage').src='/'+response.generation.image_path;
    $('compositionDownload').href='/'+response.generation.image_path;$('compositionDownload').download=response.generation.id+'.png';
    $('compositionProtected').classList.toggle('is-active',response.operation.selected_variant===0);$('compositionFull').classList.toggle('is-active',response.operation.selected_variant===1);
    status(t('PNG saved to History. Actual Anlas: {anlas}',{anlas:response.operation.actual_anlas??t('Unknown')}));
    await onSaved(response);$('compositionResult').scrollIntoView({block:'start',behavior:'smooth'});
  }
  async function run(){if(!prepared||busy||prepared.revision!==revision)return;const id=prepared.prepared_id;prepared=null;locked(true);try{await display(await postJson('/api/image-tools/run',{prepared_id:id}));}catch(e){status(e.message,true);}finally{locked(false);}}
  async function variant(index){if(!result||busy||result.operation.selected_variant===index)return;locked(true);try{await display(await postJson('/api/image-tools/variant',{id:result.generation.id,index}));}catch(e){status(e.message,true);}finally{locked(false);}}
  function close(){if(!busy)dialog.close();}
  $('compositionClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  window.addEventListener('beforeunload',e=>{if(editor.isDirty()||busy){e.preventDefault();e.returnValue='';}});
  $('compositionReview').onclick=review;$('compositionRun').onclick=run;
  $('compositionUpload').onclick=()=>$('compositionFile').click();$('compositionFile').onchange=async()=>{const file=$('compositionFile').files[0];$('compositionFile').value='';if(file)await open({file});};
  $('compositionImport').onclick=()=>$('compositionDraftFile').click();$('compositionDraftFile').onchange=async()=>{const file=$('compositionDraftFile').files[0];$('compositionDraftFile').value='';if(!file||busy)return;locked(true);try{if(file.size>48*1024*1024)throw new Error('Session file is too large.');const session=JSON.parse(await file.text());if(editor.isDirty()&&!await confirmAction(t('Replace the current composition? Save the editing session to keep it.')))return;await loadSession({...session,parent_id:null});}catch(e){status(e.message,true);}finally{locked(false);}};
  $('compositionExport').onclick=()=>{try{const state=editor.export(),session={schema:'chaessi.composition-draft.v1',...state,settings:settings()},url=URL.createObjectURL(new Blob([JSON.stringify(session)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='chaessi-composition.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(e){status(e.message,true);}};
  $('compositionApplySize').onclick=()=>editor.setFrame(Number($('compositionWidth').value),Number($('compositionHeight').value));
  $('compositionApplyPlacement').onclick=()=>editor.setPlacement({scale:Number($('compositionScale').value)/100,angle:Number($('compositionAngle').value)*Math.PI/180});$('compositionReset').onclick=()=>editor.resetPlacement();
  for(const id of ['compositionPrompt','compositionNegative'])$(id).onchange=()=>editor.setPrompt($('compositionPrompt').value,$('compositionNegative').value);
  $('compositionCurrentPrompt').onclick=()=>{editor.replacePreset(getPreset());charSignature='';syncControls();};
  $('compositionAddCharacter').onclick=()=>{editor.addCharacter('');charSignature='';syncControls();$('compositionCharacters').lastElementChild?.querySelector('textarea')?.focus();};
  $('compositionUseCoords').onchange=()=>editor.setCharacterPositions($('compositionUseCoords').checked);
  for(const id of ['compositionEffort','compositionStrength','compositionImageStrength','compositionNoise','compositionPadding','compositionSeam'])$(id).oninput=invalidate;
  $('compositionProtected').onclick=()=>variant(0);$('compositionFull').onclick=()=>variant(1);
  $('compositionAdopt').onclick=async()=>{if(!result)return;try{if(revision!==lastSavedRevision&&!await confirmAction(t('Replace the current composition? Save the editing session to keep it.')))return;await loadImage({id:result.generation.id,url:'/'+result.generation.image_path},'brush');dialog.scrollTop=0;editor.fit();}catch(e){status(e.message,true);}};
  $('compositionBranch').onclick=()=>{invalidate();$('compositionResult').hidden=true;editor.setTool('move');dialog.scrollTop=0;editor.fit();};
  $('compositionUseInpaint').onclick=async()=>{if(result){await onUseSource('/'+result.generation.image_path,'inpaint');close();}};
  // Files dropped over the editor replace the source; internal drags never trigger intake.
  for(const name of ['dragenter','dragover','drop'])$('compositionEditor').addEventListener(name,e=>{if(!Array.from(e.dataTransfer?.types||[]).includes('Files'))return;e.preventDefault();e.stopPropagation();if(name==='drop'&&!busy){const files=[...e.dataTransfer.files];if(files.length===1&&files[0].type.startsWith('image/'))void open({file:files[0]});}});
  return {open,isBusy:()=>busy};
}
