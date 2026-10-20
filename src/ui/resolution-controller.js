import {RESOLUTION_PRESETS,classifyResolution,resolutionError} from '../state/resolutions.js';
import {t} from './i18n.js';

export function createResolutionController({onChange,getMode}) {
  const $=id=>document.getElementById(id),width=$('paramWidth'),height=$('paramHeight');
  const button=document.createElement('button');button.type='button';button.id='resolutionPicker';button.className='resolution-picker';
  width.closest('label').before(button);
  const dialog=document.createElement('dialog');dialog.id='resolutionDialog';dialog.className='resolution-dialog';
  dialog.innerHTML=`<header class="dialog-header"><div><h2>Image size</h2><p>Choose a size, then an orientation.</p></div><button id="resolutionClose" type="button">Cancel</button></header>
    <div class="resolution-categories" role="group" aria-label="Size category">${[...Object.keys(RESOLUTION_PRESETS),'Custom'].map(key=>`<button type="button" data-resolution-category="${key}">${key}</button>`).join('')}</div>
    <div class="resolution-shapes" role="group" aria-label="Orientation">${['Landscape','Portrait','Square'].map(key=>`<button type="button" data-resolution-shape="${key}"><span class="resolution-shape ${key.toLowerCase()}" aria-hidden="true"></span><span>${key}</span><small data-size-label></small></button>`).join('')}</div>
    <div id="resolutionCustom" class="tool-grid"><label>Width<input id="resolutionWidth" type="number" min="64" step="64"></label><label>Height<input id="resolutionHeight" type="number" min="64" step="64"></label></div>
    <p id="resolutionSelected" data-no-i18n></p><p id="resolutionValidation" role="status" data-no-i18n></p>
    <p id="resolutionCostHint">Larger images may cost Anlas. Review the estimate before generating.</p>
    <div class="actions"><button id="resolutionSwap" type="button">Swap width and height</button><button id="resolutionApply" type="button">Apply size</button><button id="resolutionHelp" type="button">Help</button></div>`;
  document.body.append(dialog);
  let category='Normal',orientation='Portrait',draft=[832,1216],pending=false;
  function render(){
    dialog.querySelectorAll('[data-resolution-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.resolutionCategory===category)));
    dialog.querySelectorAll('[data-resolution-shape]').forEach(b=>{
      const key=b.dataset.resolutionShape,size=RESOLUTION_PRESETS[category]?.[key];
      b.disabled=category==='Custom'||!size;b.setAttribute('aria-pressed',String(key===orientation&&!pending&&category!=='Custom'));
      b.querySelector('[data-size-label]').textContent=size?size.join(' × '):t('Not available');
    });
    $('resolutionCustom').hidden=category!=='Custom';$('resolutionWidth').value=draft[0];$('resolutionHeight').value=draft[1];
    dialog.querySelector('.resolution-shapes').hidden=category==='Custom';
    $('resolutionSelected').textContent=draft.join(' × ')+' px'+(category==='Custom'?' · '+t(classifyResolution(...draft).orientation):'');
    const error=pending?'Choose Landscape or Portrait for Wallpaper.':resolutionError(...draft);
    $('resolutionValidation').textContent=error?t(error):t('This exact size will be used for generation.');
    $('resolutionValidation').classList.toggle('error',Boolean(error));$('resolutionApply').disabled=Boolean(error);$('resolutionSwap').disabled=pending;
  }
  function sync(){
    const c=classifyResolution(width.value,height.value),error=resolutionError(width.value,height.value);
    button.textContent=`${t('Image size')} · ${t(c.category)} · ${width.value} × ${height.value}`;
    button.title=error?t(error):t(c.orientation);button.classList.toggle('error',Boolean(error));
    // Source-driven modes retain their existing sizing contract. No preset resize.
    button.disabled=getMode()!=='text-to-image';
    for(const input of [width,height])input.setAttribute('aria-invalid',String(Boolean(error)));
  }
  button.onclick=()=>{({category,orientation}=classifyResolution(width.value,height.value));draft=[Number(width.value),Number(height.value)];pending=false;render();dialog.showModal();};
  dialog.addEventListener('click',e=>{
    const cat=e.target.closest('[data-resolution-category]')?.dataset.resolutionCategory;
    const shape=e.target.closest('[data-resolution-shape]')?.dataset.resolutionShape;
    if(cat){category=cat;const size=RESOLUTION_PRESETS[cat]?.[orientation];pending=cat!=='Custom'&&!size;if(size)draft=[...size];render();}
    if(shape&&RESOLUTION_PRESETS[category]?.[shape]){orientation=shape;draft=[...RESOLUTION_PRESETS[category][shape]];pending=false;render();}
  });
  for(const id of ['resolutionWidth','resolutionHeight'])$(id).oninput=()=>{draft=[Number($('resolutionWidth').value),Number($('resolutionHeight').value)];orientation=classifyResolution(...draft).orientation;pending=false;const error=resolutionError(...draft);$('resolutionSelected').textContent=draft.join(' × ')+' px · '+t(orientation);$('resolutionValidation').textContent=error?t(error):t('This exact size will be used for generation.');$('resolutionValidation').classList.toggle('error',Boolean(error));$('resolutionApply').disabled=Boolean(error);};
  $('resolutionSwap').onclick=()=>{draft.reverse();({orientation}=classifyResolution(...draft));pending=false;render();};
  $('resolutionApply').onclick=()=>{if(pending||resolutionError(...draft))return;width.value=draft[0];height.value=draft[1];onChange();sync();dialog.close();};
  $('resolutionClose').onclick=()=>dialog.close();
  $('resolutionHelp').onclick=()=>document.dispatchEvent(new CustomEvent('chaessi:open-manual',{detail:{chapter:'settings'}}));
  for(const input of [width,height])input.addEventListener('input',sync);
  document.addEventListener('chaessi:language-change',()=>{sync();if(dialog.open)render();});
  document.addEventListener('click',e=>{if(e.target.closest('[data-generation-mode]'))sync();});
  return {sync,validate(){if(getMode()!=='text-to-image')return;const error=resolutionError(width.value,height.value);if(error)throw new Error(t(error));}};
}
