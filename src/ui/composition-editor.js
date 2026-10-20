import {initialComposition, validateComposition, sourceToFrame, frameToSource, resizeCompositionFrame, characterCenter, clamp} from '../image-tools/composition-geometry.js';
import {interpolateStrokePoints} from './inpaint-mask-utils.js';
import {t} from './i18n.js';

const HISTORY_BYTES = 64 * 1024 * 1024;
const hints = {
  move:'Drag the picture. Corner circles resize it; the top handle rotates it.',
  frame:'Drag an edge handle to open space. The blue empty area will be generated.',
  brush:'Paint additional areas with the round brush. Empty space is already selected.',
  eraser:'Erase hand-painted areas. Empty space stays selected automatically.',
  character:'Drag a numbered marker. New characters stay attached to the output frame.',
  pan:'Drag to move the view. The wheel zooms the view without resizing the picture.',
};
const canvas = () => document.createElement('canvas');
const clone = value => structuredClone(value);
export function createCompositionEditor(host, {onChange = ()=>{}, onStatus = ()=>{}} = {}) {
  host.innerHTML = `<div class="composition-toolbar" role="toolbar" aria-label="Composition tools">
    ${[['move','Arrange picture'],['frame','Extend frame'],['brush','Round brush'],['eraser','Erase mask'],['character','Character positions'],['pan','Pan view']].map(([id,label])=>`<button type="button" data-comp-tool="${id}">${label}</button>`).join('')}
    <button type="button" data-comp-action="undo">Undo</button><button type="button" data-comp-action="redo">Redo</button>
    <button type="button" data-comp-action="fit">Fit view</button><button type="button" data-comp-action="mask">Hide Mask</button>
  </div><div class="composition-controls"><label>Brush size <input id="compositionBrushSize" type="range" min="4" max="240" value="48"><output id="compositionBrushValue">48 px</output></label>
    <button type="button" data-comp-action="clear">Clear hand-painted mask</button><span id="compositionDimensions" data-no-i18n></span></div>
  <div class="composition-legend"><span><i class="gap"></i>Empty space</span><span><i class="manual"></i>Hand-painted mask</span></div><p class="composition-hint" id="compositionHint" role="status"></p>
  <div class="composition-viewport" tabindex="0" aria-label="Composition canvas"><canvas id="compositionStage"></canvas><div class="composition-handles"></div><div class="composition-cursor" hidden></div></div>`;
  const viewport = host.querySelector('.composition-viewport'), stage = host.querySelector('canvas'), ctx = stage.getContext('2d');
  const handles = host.querySelector('.composition-handles'), cursor = host.querySelector('.composition-cursor');
  const brush = host.querySelector('#compositionBrushSize'), brushValue = host.querySelector('#compositionBrushValue'), info = host.querySelector('#compositionDimensions');
  const original = canvas(), manual = canvas(), tinted = canvas();
  let recipe = null, preset = null, tool = 'move', view = {zoom:1,x:0,y:0}, visible = true, gesture = null, locked = false, dirty = false;
  let undo = [], redo = [], alpha = null, raf = 0, listenersEnabled = false;
  function snapshot() { return {recipe:clone(recipe), preset:clone(preset), alpha}; }
  function trimHistory() {
    const unique = () => new Set([...undo,...redo].map(s=>s.alpha));
    while (undo.length + redo.length > 60 || [...unique()].reduce((n,a)=>n+a.byteLength,0) > HISTORY_BYTES) {
      if (undo.length) undo.shift(); else if (redo.length) redo.shift(); else break;
    }
  }
  function checkpoint(before) { undo.push(before); redo=[]; trimHistory(); dirty=true; onChange(); }
  function syncAlpha() { const data=manual.getContext('2d').getImageData(0,0,manual.width,manual.height).data; alpha=new Uint8Array(manual.width*manual.height); for(let i=0;i<alpha.length;i++)alpha[i]=data[i*4+3]; }
  function putAlpha() { const data=new Uint8ClampedArray(alpha.length*4);for(let i=0;i<alpha.length;i++){data[i*4]=data[i*4+1]=data[i*4+2]=255;data[i*4+3]=alpha[i];}manual.getContext('2d').putImageData(new ImageData(data,manual.width,manual.height),0,0); tint(); }
  function tint() { const c=tinted.getContext('2d');c.clearRect(0,0,tinted.width,tinted.height);c.drawImage(manual,0,0);c.globalCompositeOperation='source-in';c.fillStyle='rgba(72,211,236,.56)';c.fillRect(0,0,tinted.width,tinted.height);c.globalCompositeOperation='source-over'; }
  function restore(s) {recipe=clone(s.recipe);preset=clone(s.preset);alpha=s.alpha;putAlpha();dirty=true;schedule();onChange();}
  function commitEdit(fn) {if(!recipe||locked)return;cancel();const before=snapshot();try{fn();validateComposition(recipe,recipe.source);checkpoint(before);schedule();}catch(e){restore(before);onStatus(e.message,true);}}
  function undoEdit(){if(locked||!undo.length)return;cancel();redo.push(snapshot());restore(undo.pop());trimHistory();}
  function redoEdit(){if(locked||!redo.length)return;cancel();undo.push(snapshot());restore(redo.pop());trimHistory();}
  function fit(){if(!recipe)return;const w=viewport.clientWidth,h=viewport.clientHeight;view.zoom=Math.min((w-110)/recipe.frame.width,(h-110)/recipe.frame.height,1.5);view.zoom=Math.max(.03,view.zoom);view.x=(w-recipe.frame.width*view.zoom)/2;view.y=(h-recipe.frame.height*view.zoom)/2;schedule();}
  function screen(p){return {x:view.x+p.x*view.zoom,y:view.y+p.y*view.zoom};}
  function point(event){const r=viewport.getBoundingClientRect();return {x:(event.clientX-r.left-view.x)/view.zoom,y:(event.clientY-r.top-view.y)/view.zoom};}
  function setTool(next){if(!hints[next]||locked)return;cancel();tool=next;cursor.hidden=true;schedule();}
  function schedule(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;render();});}
  function transform(c){const t=recipe.transform;c.translate(t.x,t.y);c.rotate(t.angle);c.scale(t.scale,t.scale);c.translate(-original.width/2,-original.height/2);}
  function render(){
    const w=viewport.clientWidth,h=viewport.clientHeight,dpr=window.devicePixelRatio||1;
    if(!w||!h)return;
    if(stage.width!==Math.round(w*dpr)||stage.height!==Math.round(h*dpr)){stage.width=Math.round(w*dpr);stage.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);handles.replaceChildren();
    host.querySelectorAll('[data-comp-tool]').forEach(b=>{const active=b.dataset.compTool===tool;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});
    host.querySelector('[data-comp-action="undo"]').disabled=locked||!undo.length;host.querySelector('[data-comp-action="redo"]').disabled=locked||!redo.length;
    host.querySelector('#compositionHint').textContent=t(hints[tool]);viewport.dataset.tool=tool;
    if(!recipe)return;
    const f=recipe.frame;ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.zoom,view.zoom);
    ctx.fillStyle=visible?'#24535f':'#30323d';ctx.fillRect(0,0,f.width,f.height);
    ctx.save();ctx.beginPath();ctx.rect(0,0,f.width,f.height);ctx.clip();transform(ctx);ctx.drawImage(original,0,0);if(visible)ctx.drawImage(tinted,0,0);ctx.restore();
    ctx.strokeStyle='#74cce8';ctx.lineWidth=2/view.zoom;ctx.strokeRect(0,0,f.width,f.height);ctx.restore();
    info.textContent=`${f.width} × ${f.height} · ${Math.round(recipe.transform.scale*100)}% · ${Math.round(recipe.transform.angle*180/Math.PI)}° · ${t('View')} ${Math.round(view.zoom*100)}%`;
    if(locked)return;
    if(tool==='move') {
      const corners=[{x:0,y:0},{x:original.width,y:0},{x:original.width,y:original.height},{x:0,y:original.height}].map(p=>screen(sourceToFrame(p,recipe)));
      ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.setLineDash([5,4]);ctx.strokeStyle='#c7b4ff';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      corners.forEach((p,i)=>handle('scale',p,t('Resize picture'),String(i),'scale'));
      const middle=screen(sourceToFrame({x:original.width/2,y:0},recipe)),a=recipe.transform.angle;
      const rotate={x:middle.x+Math.sin(a)*36,y:middle.y-Math.cos(a)*36};ctx.beginPath();ctx.moveTo(middle.x,middle.y);ctx.lineTo(rotate.x,rotate.y);ctx.stroke();handle('rotate',rotate,t('Rotate picture'),'','rotate');
    }
    if(tool==='frame')for(const [edge,p]of Object.entries({left:{x:0,y:f.height/2},right:{x:f.width,y:f.height/2},top:{x:f.width/2,y:0},bottom:{x:f.width/2,y:f.height}}))handle('frame',screen(p),t('Extend frame')+' '+edge,edge,'frame '+edge);
    if(tool==='character') (preset.prompt_parts.characters||[]).forEach((c,i)=>{
      if(c.enabled===false)return;
      (c.centers||[{x:.5,y:.5}]).forEach((p,j)=>{const v=characterCenter(p,recipe.bindings[i]||'source',recipe);handle('character',screen({x:clamp(v.x,0,1)*f.width,y:clamp(v.y,0,1)*f.height}),`${t('Character')} ${i+1}`,`${i}:${j}`,'character',String(i+1)+(c.position_mode==='custom'?'':' A'));});
    });
  }
  function handle(action,p,label,key,kind,text=''){
    // Off-screen handles are kept in the viewport so a misplaced image is recoverable.
    const b=document.createElement('button');b.type='button';b.className='composition-handle '+kind;b.dataset.gesture=action;b.dataset.key=key;b.setAttribute('aria-label',label);b.title=label;b.textContent=text||(action==='rotate'?'↻':action==='frame'?(['left','right'].includes(key)?'↔':'↕'):'');b.style.left=clamp(p.x,14,viewport.clientWidth-14)+'px';b.style.top=clamp(p.y,14,viewport.clientHeight-14)+'px';handles.append(b);
  }
  function updateCursor(event){const p=point(event),s=screen(p);cursor.hidden=locked||!recipe||!['brush','eraser'].includes(tool)||p.x<0||p.y<0||p.x>recipe.frame.width||p.y>recipe.frame.height;const size=Number(brush.value)*view.zoom;cursor.style.width=size+'px';cursor.style.height=size+'px';cursor.style.left=s.x+'px';cursor.style.top=s.y+'px';cursor.classList.toggle('is-eraser',tool==='eraser');}
  function stamp(a,b){const radius=Number(brush.value)/(2*recipe.transform.scale),c=manual.getContext('2d');c.save();c.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';c.fillStyle='#fff';for(const p of interpolateStrokePoints(a,b,Math.max(1,radius/4))){c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.fill();}c.restore();tint();}
  function down(e){
    if(!recipe||locked||gesture||![0,1].includes(e.button))return;
    const p=point(e),target=e.target.closest('[data-gesture]'),action=e.button===1?'pan':target?.dataset.gesture||tool;
    if(action==='character'&&!target)return;
    if(action==='frame'&&!target)return;
    const sourcePoint=frameToSource(p,recipe);
    if(action==='move'&&(sourcePoint.x<0||sourcePoint.y<0||sourcePoint.x>original.width||sourcePoint.y>original.height))return;
    e.preventDefault();viewport.focus({preventScroll:true});viewport.setPointerCapture(e.pointerId);
    gesture={id:e.pointerId,action,key:target?.dataset.key,start:p,client:{x:e.clientX,y:e.clientY},view:{...view},before:snapshot(),previous:sourcePoint,changed:false};
    if(['brush','eraser'].includes(action)){stamp(sourcePoint,sourcePoint);gesture.changed=true;onChange();}
    schedule();
  }
  function move(e){
    if(!recipe)return;updateCursor(e);if(!gesture||gesture.id!==e.pointerId)return;e.preventDefault();
    const g=gesture,p=point(e),start=g.before.recipe,t0=start.transform;
    if(g.action==='pan'){view.x=g.view.x+e.clientX-g.client.x;view.y=g.view.y+e.clientY-g.client.y;schedule();return;}
    try {
      if(['brush','eraser'].includes(g.action)){const sp=frameToSource(p,recipe);stamp(g.previous,sp);g.previous=sp;}
      else if(g.action==='move'){recipe.transform.x=t0.x+p.x-g.start.x;recipe.transform.y=t0.y+p.y-g.start.y;}
      else if(g.action==='scale'){const d0=Math.hypot(g.start.x-t0.x,g.start.y-t0.y),d=Math.hypot(p.x-t0.x,p.y-t0.y);recipe.transform.scale=clamp(t0.scale*d/Math.max(1,d0),.05,8);}
      else if(g.action==='rotate'){let angle=t0.angle+Math.atan2(p.y-t0.y,p.x-t0.x)-Math.atan2(g.start.y-t0.y,g.start.x-t0.x);recipe.transform.angle=Math.atan2(Math.sin(angle),Math.cos(angle));}
      else if(g.action==='frame'){
        const horizontal=['left','right'].includes(g.key),delta=(horizontal?e.clientX-g.client.x:e.clientY-g.client.y)/g.view.zoom;
        const resized=resizeCompositionFrame(start,g.key,delta,g.before.preset.prompt_parts.characters);
        recipe=resized.recipe;preset.prompt_parts.characters=resized.characters;
        // Anchor the opposite edge on screen during top/left expansion.
        view.x=g.view.x-(recipe.transform.x-t0.x)*view.zoom;view.y=g.view.y-(recipe.transform.y-t0.y)*view.zoom;
      } else if(g.action==='character'){
        const [i,j]=g.key.split(':').map(Number),c=preset.prompt_parts.characters[i],pos={x:clamp(p.x/recipe.frame.width,0,1),y:clamp(p.y/recipe.frame.height,0,1)};
        if((recipe.bindings[i]||'source')==='source'){const sp=frameToSource({x:pos.x*recipe.frame.width,y:pos.y*recipe.frame.height},recipe);pos.x=sp.x/original.width;pos.y=sp.y/original.height;}
        c.centers??=[{x:.5,y:.5}];c.centers[j]=pos;
        preset.prompt_parts.characters.forEach(character=>{character.position_mode='custom';});
      }
      g.changed=true;onChange();schedule();
    }catch(error){onStatus(error.message,true);}
  }
  function finish(e){if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(viewport.hasPointerCapture(g.id))viewport.releasePointerCapture(g.id);if(g.changed&&g.action!=='pan'){if(['brush','eraser'].includes(g.action))syncAlpha();checkpoint(g.before);}schedule();}
  function cancel(){if(!gesture)return;const g=gesture;gesture=null;view=g.view;recipe=clone(g.before.recipe);preset=clone(g.before.preset);alpha=g.before.alpha;putAlpha();if(viewport.hasPointerCapture(g.id))viewport.releasePointerCapture(g.id);schedule();onChange();}
  viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',finish);
  viewport.addEventListener('pointercancel',cancel);viewport.addEventListener('lostpointercapture',()=>{if(gesture)cancel();});viewport.addEventListener('pointerleave',()=>{cursor.hidden=true;});
  viewport.addEventListener('wheel',e=>{if(!recipe||locked)return;e.preventDefault();if(gesture)return;const p=point(e),s=screen(p);view.zoom=clamp(view.zoom*Math.exp(-e.deltaY*.0015),.03,8);view.x=s.x-p.x*view.zoom;view.y=s.y-p.y*view.zoom;schedule();updateCursor(e);},{passive:false});
  viewport.addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture){e.preventDefault();e.stopPropagation();cancel();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoEdit():undoEdit();}});
  window.addEventListener('blur',cancel);new ResizeObserver(()=>{if(listenersEnabled&&!gesture)fit();}).observe(viewport);
  host.querySelectorAll('[data-comp-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.compTool));
  host.querySelector('[data-comp-action="undo"]').onclick=undoEdit;host.querySelector('[data-comp-action="redo"]').onclick=redoEdit;host.querySelector('[data-comp-action="fit"]').onclick=fit;
  host.querySelector('[data-comp-action="mask"]').onclick=e=>{visible=!visible;e.target.textContent=t(visible?'Hide Mask':'Show Mask');schedule();};
  host.querySelector('[data-comp-action="clear"]').onclick=()=>commitEdit(()=>{alpha=new Uint8Array(original.width*original.height);putAlpha();});
  brush.oninput=()=>{brushValue.textContent=brush.value+' px';};
  return {
    async load({sourceUrl,manualUrl,composition,prompt,brushSize=48,maskVisible=true,mode='move'}) {
      cancel();const image=new Image();image.src=sourceUrl;await image.decode();
      const next=composition||initialComposition(image.naturalWidth,image.naturalHeight);validateComposition(next,{width:image.naturalWidth,height:image.naturalHeight});
      let maskImage=null;if(manualUrl){maskImage=new Image();maskImage.src=manualUrl;await maskImage.decode();if(maskImage.naturalWidth!==image.naturalWidth||maskImage.naturalHeight!==image.naturalHeight)throw new Error('Manual mask dimensions do not match.');}
      for(const c of [original,manual,tinted]){c.width=image.naturalWidth;c.height=image.naturalHeight;}
      original.getContext('2d').drawImage(image,0,0);if(maskImage)manual.getContext('2d').drawImage(maskImage,0,0);syncAlpha();tint();
      recipe=clone(next);preset=clone(prompt);recipe.bindings=(preset.prompt_parts.characters||[]).map((_,i)=>recipe.bindings[i]||'source');
      undo=[];redo=[];dirty=false;tool=mode;visible=maskVisible;brush.value=brushSize;brushValue.textContent=brush.value+' px';host.querySelector('[data-comp-action="mask"]').textContent=t(visible?'Hide Mask':'Show Mask');listenersEnabled=true;fit();schedule();
    },
    export(){if(!recipe)throw new Error('Choose an image first.');if(gesture)throw new Error('Finish the current drag before reviewing.');return {recipe:clone(recipe),preset:clone(preset),source_png:original.toDataURL('image/png').split(',')[1],manual_mask_png:manual.toDataURL('image/png').split(',')[1],brush_size:Number(brush.value),mask_visible:visible};},
    getRecipe:()=>clone(recipe),getPreset:()=>clone(preset),isDirty:()=>dirty,markSaved:()=>{dirty=false;},setTool,fit,
    setLocked(value){cancel();locked=value;host.querySelectorAll('button,input').forEach(el=>el.disabled=value);cursor.hidden=true;schedule();},
    setPrompt(base,undesired){commitEdit(()=>{preset.prompt_parts.base=base;preset.prompt_parts.undesired=undesired;});},
    replacePreset(next){commitEdit(()=>{preset=clone(next);recipe.bindings=(preset.prompt_parts.characters||[]).map(()=> 'source');});},
    editCharacter(index,changes){commitEdit(()=>{Object.assign(preset.prompt_parts.characters[index],changes);});},
    setCharacterPositions(enabled){commitEdit(()=>{preset.prompt_parts.characters.forEach(c=>{c.position_mode=enabled?'custom':'auto';});});},
    addCharacter(prompt){commitEdit(()=>{if(preset.prompt_parts.characters.length>=32)throw new Error('Maximum 32 characters.');preset.prompt_parts.characters.push({id:crypto.randomUUID(),name:'',enabled:true,prompt,undesired:'',centers:[{x:.75,y:.5}],position_mode:'custom'});recipe.bindings.push('frame');});setTool('character');},
    setPlacement(changes){commitEdit(()=>Object.assign(recipe.transform,changes));},
    setFrame(width,height){commitEdit(()=>{const a=resizeCompositionFrame(recipe,'right',width-recipe.frame.width,preset.prompt_parts.characters);const b=resizeCompositionFrame(a.recipe,'bottom',height-recipe.frame.height,a.characters);recipe=b.recipe;preset.prompt_parts.characters=b.characters;});},
    resetPlacement(){commitEdit(()=>{recipe.transform={x:recipe.frame.width/2,y:recipe.frame.height/2,angle:0,scale:1};});fit();},
  };
}
