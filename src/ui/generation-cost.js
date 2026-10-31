import {confirmAction} from './confirmation.js';
import {estimateGeneration} from '../image-tools/contracts.js';
import {getEffectiveParams} from '../state/model-profiles.js';
import {getJson} from '../api/client.js';
import {t} from './i18n.js';
export function installGenerationCost({getPreset,getMode}){
  const node=document.createElement('div');node.id='generationCostEstimate';node.className='summary';node.setAttribute('role','status');document.getElementById('generateStatus').before(node);
  let available=null,timer;const $=id=>document.getElementById(id);
  function render(){try{const preset=getPreset();if(!preset||$('paramModel').value!=='nai-diffusion-5-full'){node.textContent='Estimated cost unavailable.';return;}
    const effort=$('paramEffort').value;
    const p={...getEffectiveParams(preset),effort,width:Number($('paramWidth').value),height:Number($('paramHeight').value),steps:effort==='medium'?14:Number($('paramSteps').value)},mode=getMode();let width=p.width,height=p.height;
    if(mode!=='text-to-image'){if(!$('sourceEmptyState').hidden){node.textContent='Choose an image and review the operation.';return;}width=$('generationSourceCanvas').width;height=$('generationSourceCanvas').height;}
    const payload={model:'nai-diffusion-5-full'+(p.effort==='medium'?'-medium':'')+(mode==='inpaint'?'-inpainting':''),parameters:{width,height,steps:p.steps,strength:mode==='image-to-image'?Number($('generationStrength').value):1}};
    const c=estimateGeneration(payload,{opusAvailable:available,legacyInpaint:mode==='inpaint'});node.textContent=t(c.kind==='conditional'?'Estimated {anlas} Anlas; may use Opus allowance.':'Estimated {anlas} Anlas',{anlas:c.anlas})+(c.stamina===true?' · '+t('Uses Opus allowance'):'');
  }catch{node.textContent='Estimated cost unavailable.';}}
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,200);};document.addEventListener('input',schedule);document.addEventListener('change',schedule);document.addEventListener('click',schedule);document.addEventListener('chaessi:language-change',render);
  new MutationObserver(schedule).observe($('generationSourceInfo'),{childList:true,subtree:true,characterData:true});
  async function refresh(){try{available=(await getJson('/api/novelai/cost-account')).opus_available;}catch{available=null;}render();}
  async function confirmSizeCost(){
    if(getMode()!=='text-to-image')return true;
    const width=Number($('paramWidth').value),height=Number($('paramHeight').value);
    if(width*height<=1_048_576)return true;
    const effort=$('paramEffort').value,steps=effort==='medium'?14:Number($('paramSteps').value);
    let cost;try{cost=estimateGeneration({model:'nai-diffusion-5-full'+(effort==='medium'?'-medium':''),parameters:{width,height,steps}},{opusAvailable:available}).anlas;}catch{cost=null;}
    return confirmAction(t('Generate {width} × {height} at {effort}? Estimated {cost} Anlas.',{width,height,effort:effort==='medium'?'Medium':'High',cost:cost??t('Unknown')}));
  }
  $('refreshTokenStatusButton')?.addEventListener('click',refresh);render();void refresh();return {refresh,render,confirmSizeCost};
}
