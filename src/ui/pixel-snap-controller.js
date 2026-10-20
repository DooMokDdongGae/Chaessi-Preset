import {postJson} from '../api/client.js';
import {inspectPixelPng,pixelGeometry,normalizePixelSettings} from '../image-tools/pixel-snap-core.js';
import {t} from './i18n.js';

export function createPixelSnapController({onSaved,onUseSource,onUseNext}){
  const dialog=document.createElement('dialog');dialog.id='pixelSnapDialog';dialog.className='pixel-snap-dialog';
  dialog.innerHTML=`<header class="dialog-header"><div><h2>Pixel Snap</h2><p>Clean up an existing pixel-art grid. Local processing · 0 Anlas.</p></div><button id="pixelClose" type="button">Close</button></header>
    <div class="pixel-snap-layout"><aside>
      <button id="pixelChoose" type="button">Choose PNG</button><input id="pixelFile" type="file" accept="image/png" hidden>
      <p id="pixelInputInfo" data-no-i18n></p><button id="pixelDetect" type="button">Suggest grid</button><p id="pixelDetection" role="status" data-no-i18n></p><button id="pixelApplyDetection" type="button" hidden>Use suggested grid</button>
      <div class="tool-grid">${[['Grid width','gridX',4,1,128,.25],['Grid height','gridY',4,1,128,.25],['X offset','offsetX',0,0,127.75,.25],['Y offset','offsetY',0,0,127.75,.25]].map(([label,key,value,min,max,step])=>`<label>${label}<input id="pixel-${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" data-pixel-setting></label>`).join('')}</div>
      <p>Click a pixel boundary in the original to set the grid offset.</p>
      <details id="pixelFineTuning"><summary>Fine tuning</summary><label>Edge cells<select id="pixel-edges" data-pixel-setting><option value="keep">Keep partial edge cells</option><option value="crop">Crop partial edge cells</option></select></label>
      <label>Palette<select id="pixel-palette" data-pixel-setting><option value="preserve">Keep source colors</option><option value="auto">Automatic palette reduction</option><option value="limit">Limit colors</option></select></label>
      <label id="pixelColorsField">Maximum colors<input id="pixel-colors" data-pixel-setting type="number" min="2" max="256" value="32"></label>
      <label>Alpha<select id="pixel-alpha" data-pixel-setting><option value="preserve">Keep transparency</option><option value="binary">Binary transparency</option></select></label>
      <label id="pixelThresholdField">Alpha threshold<input id="pixel-threshold" data-pixel-setting type="number" min="1" max="255" value="128"></label></details>
      <label>PNG export scale<select id="pixel-scale" data-pixel-setting>${[1,2,3,4,6,8,16].map(n=>`<option value="${n}">×${n}</option>`).join('')}</select></label>
      <p id="pixelSize" data-no-i18n></p><div class="actions"><button id="pixelUndo" type="button">Undo</button><button id="pixelReset" type="button">Reset settings</button></div>
      <button id="pixelPreview" type="button">Preview Pixel Snap</button><button id="pixelCancel" type="button" hidden>Cancel processing</button><p id="pixelStatus" role="status" aria-live="polite" data-no-i18n></p>
      <button id="pixelSave" type="button" disabled>Save result to History</button><a id="pixelDownload" download="pixel-snap.png" hidden>Save PNG</a>
      <div id="pixelChain" class="actions" hidden><button id="pixelNext" type="button">Use result in another tool</button><button id="pixelInpaint" type="button">Use for Inpaint</button><button id="pixelI2I" type="button">Use for Image to Image</button></div><button type="button" id="pixelHelp">Help</button>
    </aside><section><div class="pixel-view-tools"><label>View zoom<select id="pixelZoom"><option value="fit">Fit view</option><option value="1">100%</option><option value="2">200%</option><option value="4">400%</option><option value="8">800%</option></select></label><label><input id="pixelGrid" type="checkbox" checked>Show pixel grid</label></div>
      <div class="pixel-comparison"><section><h3>Original</h3><div class="pixel-viewport"><div id="pixelOriginalFrame" class="pixel-image-frame"><img id="pixelOriginal" alt="Original"><svg id="pixelGridOverlay" aria-hidden="true"></svg></div></div></section><section><h3>Pixel Snap result</h3><div class="pixel-viewport"><img id="pixelResult" alt="Pixel Snap result"></div></section></div>
      <p>Both previews use crisp nearest-neighbor display. Export scale changes the saved PNG; view zoom does not.</p><p>Still PNG only. Processing uses decoded 8-bit sRGB; the original file is kept unchanged.</p>
    </section></div>`;
  document.body.append(dialog);const $=id=>document.getElementById(id);
  const fields=['gridX','gridY','offsetX','offsetY','edges','palette','colors','alpha','threshold','scale'];
  const defaults={gridX:4,gridY:4,offsetX:0,offsetY:0,edges:'keep',palette:'preserve',colors:32,alpha:'preserve',threshold:128,scale:1};
  let source=null,input=null,worker=null,revision=0,preview=null,saved=null,saving=false,detectResult=null,originalUrl=null,resultUrl=null,history=[],previous={...defaults};
  function settings(){return normalizePixelSettings(Object.fromEntries(fields.map(key=>[key,$('pixel-'+key).value])));}
  function status(text,error=false){$('pixelStatus').textContent=t(text);$('pixelStatus').classList.toggle('error',error);}
  function cancel(){revision++;worker?.terminate();worker=null;$('pixelCancel').hidden=true;$('pixelPreview').disabled=!input;$('pixelDetect').disabled=!input;}
  function clearPreview(){preview=null;saved=null;$('pixelSave').disabled=true;$('pixelDownload').hidden=true;$('pixelChain').hidden=true;$('pixelResult').removeAttribute('src');if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=null;}
  function invalidate(){cancel();clearPreview();status('Preview after changing settings.');render();}
  function writeSettings(s){for(const key of fields)$('pixel-'+key).value=s[key];previous={...s};}
  function remember(){history.push({...previous});if(history.length>25)history.shift();previous=Object.fromEntries(fields.map(key=>[key,$('pixel-'+key).value]));}
  function render(){
    $('pixelColorsField').hidden=$('pixel-palette').value!=='limit';$('pixelThresholdField').hidden=$('pixel-alpha').value!=='binary';$('pixelUndo').disabled=!history.length||saving;
    $('pixelPreview').disabled=!input||Boolean(worker)||saving;$('pixelDetect').disabled=!input||Boolean(worker)||saving;
    $('pixelSave').disabled=!preview||Boolean(worker)||saving||Boolean(saved);
    if(!input){$('pixelSize').textContent='';return;}
    try{const g=pixelGeometry(input.width,input.height,settings());$('pixelSize').textContent=t('Grid {logical}; PNG {output}',{logical:`${g.logical.width} × ${g.logical.height}`,output:`${g.output.width} × ${g.output.height}`});}
    catch(error){$('pixelSize').textContent=t(error.message);$('pixelPreview').disabled=true;}
    drawGrid();
  }
  function drawGrid(){
    if(!input)return;
    const image=$('pixelOriginal'),zoom=$('pixelZoom').value;
    for(const [img,w,h]of [[image,input.width,input.height],[$('pixelResult'),preview?.geometry.output.width,preview?.geometry.output.height]]){
      if(!w)continue;const box=img.closest('.pixel-viewport'),factor=zoom==='fit'?Math.min((box.clientWidth-16)/w,Math.max(150,box.clientHeight-16)/h):Number(zoom);img.style.width=Math.max(1,w*factor)+'px';img.style.height=Math.max(1,h*factor)+'px';
    }
    const svg=$('pixelGridOverlay');svg.setAttribute('viewBox',`0 0 ${input.width} ${input.height}`);svg.replaceChildren();
    if(!$('pixelGrid').checked)return;
    try{const s=settings();if(s.gridX*image.getBoundingClientRect().width/input.width<3)return;const lines=[];for(let x=s.offsetX;x<input.width;x+=s.gridX)lines.push(`M${x} 0V${input.height}`);for(let y=s.offsetY;y<input.height;y+=s.gridY)lines.push(`M0 ${y}H${input.width}`);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',lines.join(''));path.setAttribute('vector-effect','non-scaling-stroke');svg.append(path);}catch{}
  }
  async function load(item){
    cancel();clearPreview();source=null;input=null;detectResult=null;$('pixelApplyDetection').hidden=true;$('pixelDetection').textContent='';$('pixelInputInfo').textContent='';history=[];
    const loadRevision=revision;
    if(originalUrl)URL.revokeObjectURL(originalUrl);originalUrl=null;$('pixelOriginal').removeAttribute('src');
    try{
      let bytes;
      if(item.source_png)bytes=Uint8Array.from(atob(item.source_png),c=>c.charCodeAt(0));
      else if(item.file){if(item.file.size>64*1024*1024)throw new Error('Choose a PNG no larger than 64 MB.');bytes=new Uint8Array(await item.file.arrayBuffer());}
      else {const response=await fetch(item.url);if(!response.ok)throw new Error('Could not open the selected image.');bytes=new Uint8Array(await response.arrayBuffer());}
      if(loadRevision!==revision)return;
      const info=inspectPixelPng(bytes);input=info;source={bytes,id:item.source_png?null:item.id??null};
      originalUrl=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));$('pixelOriginal').src=originalUrl;await $('pixelOriginal').decode();
      if(loadRevision!==revision)return;
      $('pixelInputInfo').textContent=`${info.width} × ${info.height} · ${info.bitDepth}-bit`;
      writeSettings(defaults);status('Choose a grid or request a suggestion.');render();
    }catch(error){if(loadRevision===revision){source=null;input=null;status(error.message,true);render();}}
  }
  function process(detect=false){
    if(!source||saving)return;cancel();if(!detect)clearPreview();
    let recipe;try{if(!detect){recipe=settings();pixelGeometry(input.width,input.height,recipe);}}catch(error){status(error.message,true);return;}
    const id=revision;worker=new Worker(new URL('./pixel-snap-worker.js',import.meta.url),{type:'module'});
    $('pixelCancel').hidden=false;status(detect?'Analyzing pixel grid…':'Processing locally…');render();
    worker.onmessage=({data})=>{
      if(data.id!==revision)return;
      if(data.percent!==undefined){$('pixelStatus').textContent=t('Processing locally…')+` ${data.percent}%`;return;}
      cancel();
      if(data.error){status(data.error,true);render();return;}
      if(data.detection){detectResult=data.detection;$('pixelDetection').textContent=t('Suggested {x} × {y}; confidence {confidence}',{x:detectResult.gridX,y:detectResult.gridY,confidence:t(detectResult.level==='high'?'High':detectResult.level==='medium'?'Medium':'Low')});$('pixelApplyDetection').hidden=detectResult.level==='low';status(detectResult.level==='low'?'Grid is uncertain. Set grid size and offset manually.':'Review the suggestion before applying it.');render();return;}
      preview=data;resultUrl=URL.createObjectURL(new Blob([data.png],{type:'image/png'}));$('pixelResult').src=resultUrl;$('pixelResult').onload=drawGrid;$('pixelDownload').href=resultUrl;$('pixelDownload').hidden=false;$('pixelSave').disabled=false;status('Preview ready. The original is unchanged.');render();
    };
    worker.onerror=()=>{if(id!==revision)return;cancel();status('Pixel Snap failed. Try a smaller PNG.',true);render();};
    // Keep the immutable source in the UI; transfer only the job's copy.
    const bytes=source.bytes.slice();worker.postMessage({id,bytes:bytes.buffer,settings:recipe,detect},[bytes.buffer]);
  }
  async function save(){
    if(!preview||saving||worker)return;saving=true;const current=preview;dialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);
    try{
      const prepared=await postJson('/api/image-tools/prepare',{tool:'pixel-snap',...(source.id?{source_id:source.id}:{source_png:base64(source.bytes)}),settings:{...current.settings,edited_png:base64(new Uint8Array(current.png))}});
      saved=await postJson('/api/image-tools/run',{prepared_id:prepared.prepared_id});await onSaved(saved);
      $('pixelDownload').href='/'+saved.generation.image_path;$('pixelDownload').download=saved.generation.id+'.png';$('pixelChain').hidden=false;status('Pixel Snap saved to History. 0 Anlas.');
    }catch(error){status(error.message,true);}finally{saving=false;dialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);$('pixelSave').disabled=Boolean(saved)||!preview;render();}
  }
  function close(){if(saving)return;cancel();dialog.close();}
  $('pixelChoose').onclick=()=>$('pixelFile').click();$('pixelFile').onchange=()=>{const file=$('pixelFile').files[0];if(file)void load({file});$('pixelFile').value='';};
  $('pixelClose').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  $('pixelPreview').onclick=()=>process();$('pixelDetect').onclick=()=>process(true);$('pixelCancel').onclick=()=>{cancel();status('Processing canceled. The original is unchanged.');render();};
  $('pixelApplyDetection').onclick=()=>{if(!detectResult)return;const current=Object.fromEntries(fields.map(key=>[key,$('pixel-'+key).value]));remember();writeSettings({...current,...detectResult});invalidate();};
  dialog.querySelectorAll('[data-pixel-setting]').forEach(n=>n.addEventListener('input',()=>{remember();invalidate();}));
  $('pixelReset').onclick=()=>{remember();writeSettings(defaults);invalidate();};$('pixelUndo').onclick=()=>{if(history.length){writeSettings(history.pop());invalidate();}};
  $('pixelZoom').onchange=drawGrid;$('pixelGrid').onchange=drawGrid;new ResizeObserver(drawGrid).observe(dialog.querySelector('.pixel-comparison'));
  $('pixelOriginal').onclick=e=>{if(!input||saving)return;const b=e.target.getBoundingClientRect();try{const s=settings(),offset=(v,grid)=>Math.min(grid-.001,Math.round(v%grid*100)/100);remember();writeSettings({...s,offsetX:offset((e.clientX-b.left)*input.width/b.width,s.gridX),offsetY:offset((e.clientY-b.top)*input.height/b.height,s.gridY)});invalidate();}catch(error){status(error.message,true);}};
  $('pixelSave').onclick=save;$('pixelNext').onclick=async()=>{if(saved){close();await onUseNext(saved);}};
  $('pixelHelp').onclick=()=>document.dispatchEvent(new CustomEvent('chaessi:open-manual',{detail:{chapter:'tool-pixel-snap'}}));
  for(const [id,mode]of [['pixelInpaint','inpaint'],['pixelI2I','image-to-image']])$(id).onclick=async()=>{try{if(!saved)return;const s=saved.operation.actual_output_size;if(s.width*s.height>3_145_728)throw new Error('The result exceeds the generation size limit. Use Canvas resize or Focused Inpaint.');await onUseSource('/'+saved.generation.image_path,mode);close();}catch(error){status(error.message,true);}};
  document.addEventListener('chaessi:language-change',render);
  window.addEventListener('beforeunload',e=>{if(saving){e.preventDefault();e.returnValue='';}});
  return {async open(item){if(saving)return;dialog.showModal();if(item)await load(item);else render();},isBusy:()=>saving||Boolean(worker)};
}
function base64(bytes){let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);}
