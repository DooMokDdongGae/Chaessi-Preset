import {getJson,postJson} from '../api/client.js';
import {t} from './i18n.js';
import {createToolCanvas} from './image-tools-canvas.js';
import {loadDirectorTokenizer} from './director-tokenizer.js';
import {EMOTIONS,MAGNITUDES,GENERATION_PIXEL_LIMIT} from '../image-tools/contracts.js';
const TOOLS=[['upscale','Upscale ×2'],['enhance','Enhance'],['max-enhance','Max✨ Enhance'],['bg-removal','Remove Background'],['lineart','Line Art'],['sketch','Sketch'],['colorize','Colorize'],['emotion','Emotion'],['declutter','Declutter'],['declutter-keep-bubbles','Declutter (keep bubbles)'],['canvas','Canvas'],['outpaint','Outpainting'],['focused-inpaint','Focused Inpaint']];
export function getImageToolLabel(value){return t(TOOLS.find(([id])=>id===value)?.[1]??'Image tools');}
export function createImageToolsController({getLatest,getViewed,getPreset,onSaved,onUseSource,showToast}) {
  const dialog=document.createElement('dialog');dialog.id='imageToolsDialog';dialog.className='image-tools-dialog';
  dialog.innerHTML=`<header class="dialog-header"><div><h2>Image tools</h2><p>Keep the original PNG and finish a separate result.</p></div><button id="toolClose" type="button">Close</button></header>
    <div class="image-tools-layout"><aside><button id="toolUpload" type="button">Choose PNG</button><input id="toolFile" type="file" accept="image/png" hidden><label>Tool<select id="toolKind">${TOOLS.map(([v,label])=>`<option value="${v}">${label}</option>`).join('')}</select></label>
    <div data-tool-group="enhance max-enhance outpaint focused-inpaint"><label>Prompt source<select id="toolPromptSource"><option value="original">Original used prompt</option><option value="current">Current workbench prompt</option></select></label><label>Effort<select id="toolEffort"><option value="high">High</option><option value="medium">Medium</option></select></label><p id="toolPromptInfo" class="summary" data-no-i18n></p></div>
    <div data-tool-group="enhance max-enhance"><label>Magnitude<select id="toolMagnitude"><option value="0">1</option><option value="1">2</option><option value="2" selected>3</option><option value="3">4</option><option value="4">5</option></select></label><label><input id="toolIndividual" type="checkbox">Individual settings</label><div id="toolIndividualSettings" hidden><label>Strength<input id="toolStrength" type="number" min="0" max="1" step="0.05" value="0.5"></label><label>Noise<input id="toolNoise" type="number" min="0" max="1" step="0.05" value="0"></label></div><label data-tool-group="enhance">Enhance scale<select id="toolFactor"><option value="1">×1</option><option value="1.5">×1.5</option><option value="2">×2</option></select></label></div>
    <div data-tool-group="colorize emotion"><label>Director prompt<textarea id="toolDirectorPrompt" maxlength="1000" rows="3" data-no-i18n></textarea></label><p>Director prompts use a separate 75-token CLIP context.</p><label>Defry<input id="toolDefry" type="number" min="0" max="5" step="1" value="0"></label><label data-tool-group="emotion">Emotion<select id="toolEmotion"><option value="neutral">Neutral</option><option value="happy">Happy</option><option value="sad">Sad</option><option value="angry">Angry</option><option value="scared">Scared</option><option value="surprised">Surprised</option><option value="tired">Tired</option><option value="excited">Excited</option></select></label></div>
    <div data-tool-group="outpaint"><p>Extend the canvas; retain the existing Inpaint strategy.</p><div class="tool-grid">${['left','top','right','bottom'].map(side=>`<label>${side[0].toUpperCase()+side.slice(1)}<input id="toolExtend-${side}" type="number" min="0" max="2048" step="8" value="${side==='right'?128:0}"></label>`).join('')}</div></div>
    <div data-tool-group="focused-inpaint canvas"><p>Drag on the image or enter a rectangle.</p><div class="tool-grid">${['x','y','width','height'].map((key,i)=>`<label>${['X','Y','Selection width','Selection height'][i]}<input id="toolRect-${key}" type="number" min="0" value="${i<2?0:128}"></label>`).join('')}</div><label data-tool-group="focused-inpaint">Context (px)<input id="toolContext" type="number" min="0" max="1024" value="64"></label></div>
    <div data-tool-group="outpaint focused-inpaint"><label>Inpaint Strength<input id="toolInpaintStrength" type="number" min="0" max="1" step="0.05" value="1"></label><label>Image Strength<input id="toolImageStrength" type="number" min="0" max="1" step="0.05" value="0.7"></label><label>Image Noise<input id="toolImageNoise" type="number" min="0" max="1" step="0.05" value="0"></label><label>Padding (px)<input id="toolPadding" type="number" min="0" max="128" step="8" value="16"></label></div>
    <div data-tool-group="canvas"><label>Brush<select id="toolBrush"><option value="pen">Pen</option><option value="eraser">Eraser</option><option value="fill">Fill</option></select></label><label>Color<input id="toolColor" type="color" value="#ff0000"></label><label>Brush size<input id="toolBrushSize" type="number" min="1" max="500" value="20"></label><div class="actions"><button id="toolUndo">Undo</button><button id="toolRedo">Redo</button><button id="toolCrop">Crop selection</button></div><div class="tool-grid"><label>Width<input id="toolCanvasWidth" type="number" min="1"></label><label>Height<input id="toolCanvasHeight" type="number" min="1"></label></div><button id="toolResize">Resize image</button></div>
    <button type="button" id="toolReview">Review operation</button><div id="toolCost" class="summary" role="status">Choose an image and review the operation.</div><button type="button" id="toolRun" disabled>Run and save PNG</button><button type="button" data-open-manual="image-tools">Help</button></aside>
    <section class="tool-image-stage"><div id="toolImageInfo" class="summary" data-no-i18n></div><div class="tool-canvas-wrap"><canvas id="toolCanvas"></canvas><div id="toolSelection" hidden></div></div><div id="toolVariants" class="actions"></div><div class="actions"><a id="toolDownload" download hidden>Save PNG</a><button id="toolUseI2I" hidden>Use for Image to Image</button><button id="toolUseInpaint" hidden>Use for Inpaint</button><button id="toolUseNext" hidden>Use result in another tool</button></div><div id="toolStatus" class="summary" role="status" aria-live="polite">Ready.</div></section></div>`;
  document.body.append(dialog);const $=id=>document.getElementById(id),num=id=>Number($(id).value);
  let source=null,prepared=null,busy=false,result=null,sourceUrl=null;
  $('toolEmotion').replaceChildren(...EMOTIONS.map(value=>new Option(value[0].toUpperCase()+value.slice(1),value)));
  $('toolBrush').append(new Option('Select','select'));
  const editor=createToolCanvas($('toolCanvas'),{onChange:()=>{invalidate();status('Unsaved canvas edits.');},getMode:()=>$('toolKind').value,getTool:()=>$('toolBrush').value,getColor:()=>$('toolColor').value,getSize:()=>$('toolBrushSize').value,onSelection:r=>{for(const [key,value]of Object.entries(r))$('toolRect-'+key).value=value;drawSelection();invalidate();}});
  let tokenizer=null;const tokenCount=document.createElement('small');tokenCount.id='toolDirectorTokens';$('toolDirectorPrompt').after(tokenCount);
  const updateCount=()=>tokenCount.textContent=tokenizer?`${tokenizer.count($('toolDirectorPrompt').value)} / 75 CLIP`:t('Token count unavailable');
  loadDirectorTokenizer().then(value=>{tokenizer=value;updateCount();}).catch(updateCount);$('toolDirectorPrompt').addEventListener('input',updateCount);
  function status(message,error=false){$('toolStatus').textContent=error?t('Error details: {details}',{details:message}):message;$('toolStatus').classList.toggle('error',error);}
  function invalidate(){prepared=null;$('toolRun').disabled=true;$('toolCost').textContent='Choose an image and review the operation.';}
  function render(){const tool=$('toolKind').value;dialog.querySelectorAll('[data-tool-group]').forEach(node=>node.hidden=!node.dataset.toolGroup.split(' ').includes(tool));$('toolIndividualSettings').hidden=!$('toolIndividual').checked;$('toolMagnitude').disabled=busy||$('toolIndividual').checked;$('toolSelection').hidden=tool!=='focused-inpaint'&&!(tool==='canvas'&&$('toolBrush').value==='select');drawSelection();}
  function rect(){return Object.fromEntries(['x','y','width','height'].map(key=>[key,num('toolRect-'+key)]));}
  function drawSelection(){const r=rect(),s=editor.size(),el=$('toolSelection');el.style.left=`${r.x/s.width*100}%`;el.style.top=`${r.y/s.height*100}%`;el.style.width=`${r.width/s.width*100}%`;el.style.height=`${r.height/s.height*100}%`;}
  function canDiscard(){return !editor.isDirty()||confirm(t('Discard unsaved canvas edits?'));}
  async function load(item){
    if(busy||!canDiscard())return;
    if(!item.id&&!item.file&&item.url){const response=await fetch(item.url);if(!response.ok)throw new Error('Could not open the selected image.');const blob=await response.blob();item={...item,file:new File([blob],'source.png',{type:blob.type})};}
    if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;}
    source=item;result=null;invalidate();
    $('toolCompletedResult')?.remove();
    if(item.file){sourceUrl=URL.createObjectURL(item.file);item.url=sourceUrl;}
    await editor.load(item.url);const s=editor.size();$('toolImageInfo').textContent=`${s.width} × ${s.height}`;$('toolCanvasWidth').value=s.width;$('toolCanvasHeight').value=s.height;
    dialog.querySelector('.tool-image-stage').scrollTop=0;
    for(const [key,value] of Object.entries({x:0,y:0,width:Math.min(128,s.width),height:Math.min(128,s.height)}))$('toolRect-'+key).value=value;
    $('toolVariants').replaceChildren();['toolDownload','toolUseI2I','toolUseInpaint','toolUseNext'].forEach(id=>$(id).hidden=true);
    if(item.id){const data=await getJson('/api/generations/'+encodeURIComponent(item.id));$('toolEffort').value=data.generation.internal_preset?.params?.effort??'high';$('toolPromptInfo').textContent=data.generation.internal_preset?.prompt_parts?.base??'';}
    else {$('toolPromptInfo').textContent='';$('toolEffort').value='high';}
    status('Ready.');render();
  }
  function settings(){const tool=$('toolKind').value;const s={};
    if(['enhance','max-enhance','outpaint','focused-inpaint'].includes(tool))s.effort=$('toolEffort').value;
    if(['enhance','max-enhance'].includes(tool)){s.magnitude=num('toolMagnitude');s.factor=num('toolFactor');if($('toolIndividual').checked){s.strength=num('toolStrength');s.noise=num('toolNoise');}}
    if(['colorize','emotion'].includes(tool)){s.prompt=$('toolDirectorPrompt').value;s.defry=num('toolDefry');if(tool==='emotion')s.emotion=$('toolEmotion').value;}
    if(tool==='outpaint')s.extension=Object.fromEntries(['left','top','right','bottom'].map(key=>[key,num('toolExtend-'+key)]));
    if(tool==='focused-inpaint'){s.selection=rect();s.context=num('toolContext');}
    if(['outpaint','focused-inpaint'].includes(tool)){s.inpaint_strength=num('toolInpaintStrength');s.image_strength=num('toolImageStrength');s.image_noise=num('toolImageNoise');s.padding=num('toolPadding');}
    if(tool==='canvas'){s.edited_png=editor.base64();s.edit_summary={output_size:editor.size()};}
    return s;
  }
  function setBusy(value){busy=value;dialog.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);$('toolCanvas').style.pointerEvents=value?'none':'';$('toolRun').disabled=value||!prepared;render();}
  async function review(){if(!source)return status(t('Choose PNG'),true);setBusy(true);try {
    const body={tool:$('toolKind').value,settings:settings(),prompt_source:$('toolPromptSource').value};
    if(source.id)body.source_id=source.id;else body.source_png=await fileBase64(source.file);
    if(body.prompt_source==='current')body.preset=getPreset();
    const response=await postJson('/api/image-tools/prepare',body);prepared=response;
    const p=response.plan,c=p.cost;
    $('toolPromptInfo').textContent=p.prompt_preview??'';
    $('toolCost').textContent=t(c.anlas===null?'Estimated cost unavailable.':c.kind==='conditional'?'Estimated {anlas} Anlas; may use Opus allowance.':'Estimated {anlas} Anlas',{anlas:c.anlas})+(c.stamina===true?' · '+t('Uses Opus allowance'):'')+` · ${p.expected_output_size.width} × ${p.expected_output_size.height}`;
    status('Ready.');
  }catch(e){invalidate();status(e.message,true);}finally{setBusy(false);}}
  async function display(response){result=response;editor.markSaved();const meta=response.operation;status(t('PNG saved to History. Actual Anlas: {anlas}',{anlas:meta.actual_anlas??t('Unknown')}));$('toolImageInfo').textContent=`${meta.actual_output_size.width} × ${meta.actual_output_size.height} · ${getImageToolLabel(meta.tool)}`;
    // Keep input on screen until the user explicitly chooses to chain the result.
    $('toolDownload').href='/'+response.generation.image_path;$('toolDownload').download=response.generation.id+'.png';['toolDownload','toolUseI2I','toolUseInpaint','toolUseNext'].forEach(id=>$(id).hidden=false);
    $('toolVariants').replaceChildren();for(const [index,variant]of (response.variants??[]).entries()){
      const button=document.createElement('button');button.type='button';button.textContent=t(variant.label);button.classList.toggle('is-active',index===meta.selected_variant);button.addEventListener('click',()=>select(index));$('toolVariants').append(button);
    }
    await onSaved(response);
    const image=new Image();image.src='/'+response.generation.image_path;await image.decode();
    // A separate completed-result preview is neither streaming nor pinned comparison.
    let preview=$('toolCompletedResult');if(!preview){preview=document.createElement('img');preview.id='toolCompletedResult';preview.alt=t('Completed result');$('toolVariants').before(preview);}preview.src=image.src;
  }
  async function run(){if(!prepared||busy)return;const id=prepared.prepared_id;setBusy(true);try{const response=await postJson('/api/image-tools/run',{prepared_id:id});prepared=null;await display(response);}catch(e){prepared=null;status(e.message,true);}finally{setBusy(false);}}
  async function select(index){if(!result||busy)return;setBusy(true);try{await display(await postJson('/api/image-tools/variant',{id:result.generation.id,index}));}catch(e){status(e.message,true);}finally{setBusy(false);}}
  function close(){if(!busy&&canDiscard())dialog.close();}
  $('toolClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});window.addEventListener('beforeunload',e=>{if(editor.isDirty()||busy){e.preventDefault();e.returnValue='';}});
  dialog.addEventListener('change',e=>{if(e.target.closest('aside')){invalidate();render();if(e.target.id==='toolKind')dialog.querySelector('.tool-image-stage').scrollTop=0;}});$('toolDirectorPrompt').addEventListener('input',invalidate);
  $('toolReview').onclick=review;$('toolRun').onclick=run;$('toolUpload').onclick=()=>$('toolFile').click();$('toolFile').onchange=()=>{const file=$('toolFile').files[0];if(file)void load({file}).catch(e=>status(e.message,true));$('toolFile').value='';};
  $('toolMagnitude').addEventListener('change',()=>{const value=MAGNITUDES[num('toolMagnitude')];$('toolStrength').value=value.strength;$('toolNoise').value=value.noise;});
  dialog.querySelector('[data-open-manual]').onclick=()=>document.dispatchEvent(new CustomEvent('chaessi:open-manual',{detail:{chapter:'tool-'+($('toolKind').value==='declutter-keep-bubbles'?'declutter':$('toolKind').value)}}));
  $('toolUndo').onclick=()=>editor.undo();$('toolRedo').onclick=()=>editor.redo();$('toolCrop').onclick=()=>{try{editor.crop(rect());}catch(e){status(e.message,true);}};$('toolResize').onclick=()=>{try{editor.resize(num('toolCanvasWidth'),num('toolCanvasHeight'));}catch(e){status(e.message,true);}};
  for(const [id,mode] of [['toolUseI2I','image-to-image'],['toolUseInpaint','inpaint']])$(id).onclick=async()=>{if(result)try{const size=result.operation.actual_output_size;if(size.width*size.height>GENERATION_PIXEL_LIMIT)throw new Error(t('The result exceeds the generation size limit. Use Canvas resize or Focused Inpaint.'));await onUseSource('/'+result.generation.image_path,mode);close();}catch(e){status(e.message,true);}};
  $('toolUseNext').onclick=()=>result&&load({id:result.generation.id,url:'/'+result.generation.image_path});
  function button(parent,id,getSource){const b=document.createElement('button');b.type='button';b.id=id;b.textContent='Image tools';b.onclick=()=>open(getSource?.());parent?.append(b);}
  button(document.querySelector('.header-tools'),'openImageTools',getLatest);button($('latestResultActions'),'latestImageTools',getLatest);button($('imageViewerDeleteButton').parentElement,'viewerImageTools',getViewed);
  async function open(item){if(busy)return;if(!dialog.open)dialog.showModal();try{if(item)await load(item);else render();}catch(e){status(e.message,true);showToast(e.message,true);}}
  render();return {open,isBusy:()=>busy};
}
async function fileBase64(file){const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
