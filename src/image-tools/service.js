import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildToolPlan,publicToolPlan} from './plan.js';
import {base64Png,composeFocus,inspectToolPng,shaOptions} from './image-assets.js';
import {decodeToolZip} from './zip-images.js';
import {saveImageOperation} from './store.js';
import {parseNovelAiPngMetadata} from '../importers/nai-metadata.js';
import {applyImportToPreset} from '../importers/import-to-preset.js';
import {createNovelAiMultipartBody} from '../services/novelai-multipart-request.js';
import {extractFinalNovelAiImage} from '../services/novelai-msgpack-stream.js';
import {resolveGenerationPrompts} from '../services/generation-prompt-resolver.js';
import {assertNoSecretMaterial,storeError} from '../services/file-store-utils.js';
import sharp from 'sharp';
import {switchPresetEffort} from '../state/effort-state.js';
import {keepToolReceipt,readToolResponse} from './receipt.js';

export function createImageToolService({rootDir,generationStore,wildcardStore,getToken,fetchImpl=fetch}) {
  const prepared=new Map();let busy=false;
  function storedPath(value){const base=path.resolve(rootDir,'data','generations'),full=path.resolve(rootDir,String(value));if(!full.startsWith(base+path.sep))throw new Error('Invalid stored image path.');return full;}
  async function prepare(body) {
    if(busy)throw storeError(409,'image_tool_busy','An image operation is already running.');
    let source,origin=null;
    if(body.source_id){const record=await generationStore.getGeneration(body.source_id);source=await readFile(storedPath(record.output.image_filename));origin=record.internal_preset;}
    else {source=base64Png(body.source_png);const parsed=parseNovelAiPngMetadata(source);if(parsed.detected?.has_json_candidate&&parsed.detected?.has_params&&parsed.parsed?.params?.model){origin=applyImportToPreset(null,parsed,{applyBasePrompt:true,applyUndesired:true,applyCharacters:true,applyParams:true}).preset;}}
    const sourceOrigin=origin?structuredClone(origin):null;
    if(sourceOrigin)sourceOrigin.sources={};
    if(body.prompt_source==='current')origin=resolveGenerationPrompts(body.settings?.effort?switchPresetEffort(body.preset,body.settings.effort):body.preset,await wildcardStore.all(),undefined,{mode:['outpaint','focused-inpaint'].includes(body.tool)?'inpaint':'image-to-image'});
    // Presets only: discard imported binary references and transient UI state.
    if(origin){origin=structuredClone(origin);origin.sources={};origin.prompt_parts.characters=(origin.prompt_parts.characters??[]).map(({activeTab,...c})=>c);}
    assertNoSecretMaterial({origin,settings:body.settings??{}},'tool input');
    let usage=null;
    if(body.tool!=='canvas') { try { usage=await account(getToken()); } catch {} }
    const plan=await buildToolPlan({tool:body.tool,source,origin,settings:body.settings,parentId:body.source_id??null,opusAvailable:usage?.opus??null});
    plan.sourceOrigin=sourceOrigin;
    // Bounded memory and expiration; abandoned estimates can never execute later.
    for(const [id,item] of prepared)if(item.expires<Date.now())prepared.delete(id);
    if(prepared.size>=3)prepared.delete(prepared.keys().next().value);
    const id=randomUUID();prepared.set(id,{plan,expires:Date.now()+5*60_000});
    return {ok:true,prepared_id:id,plan:publicToolPlan(plan)};
  }
  async function account(token){try{const r=await fetchImpl('https://image.novelai.net/user/data',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12_000)});if(!r.ok)return null;const sub=(await r.json()).subscription,b=sub?.trainingStepsLeft;return {anlas:typeof b==='number'?b:Number(b?.fixedTrainingStepsLeft??0)+Number(b?.purchasedTrainingSteps??0),opus:sub?.active===true&&sub?.tier===3&&sub?.usage?.isNegative!==true};}catch{return null;}}
  async function run(id){
    if(busy)throw storeError(409,'image_tool_busy','An image operation is already running.');
    const item=prepared.get(id);prepared.delete(id);
    if(!item||item.expires<Date.now())throw storeError(410,'tool_plan_expired','Review the image operation again before executing.');
    busy=true;const plan=item.plan;
    try {
      let variants,responseInfo={},actual=null;
      if(plan.tool==='canvas'){actual=0;variants=[{bytes:plan.edited,label:'Canvas'}];}
      else {
        const token=getToken(),before=await account(token),started=Date.now();
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),180_000);
        let response,bytes;
        try{response=await fetchImpl(plan.endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,Origin:'https://novelai.net',Referer:'https://novelai.net/','x-correlation-id':randomUUID().slice(0,6),'x-initiated-at':new Date().toISOString()},body:createNovelAiMultipartBody(plan.payload,plan.assets),signal:controller.signal});bytes=await readToolResponse(response);}
        catch{throw storeError(502,'tool_result_unknown','The image operation response was interrupted. It may have been charged. No automatic retry was made.');}
        finally{clearTimeout(timeout);}
        const after=await account(token);actual=before&&after?before.anlas-after.anlas:null;
        responseInfo={elapsed_ms:Date.now()-started,http_status:response.status,response_container:plan.endpoint.endsWith('generate-image-stream')?'msgpack':'zip'};
        plan.receiptFiles=await keepToolReceipt(rootDir,plan,bytes,responseInfo,actual);
        if(!response.ok)throw storeError(response.status,'image_tool_failed','NovelAI image operation failed.',bytes.toString('utf8').slice(0,1500));
        try {
          if(responseInfo.response_container==='zip')variants=decodeToolZip(bytes);
          else {const result=extractFinalNovelAiImage(bytes);const png=await sharp(result.imageBytes,shaOptions).ensureAlpha().png().toBuffer();variants=[{bytes:plan.tool==='focused-inpaint'?await composeFocus(plan.source,png,plan.geometry):png,label:plan.tool}];}
        } catch(error) { throw storeError(502,'unusable_tool_response','No usable PNG was returned. The response was kept for recovery; no automatic retry was made.',`${error.message}. Observed Anlas change: ${actual??'unknown'}.`); }
        for(const v of variants)await inspectToolPng(v.bytes);
        if(plan.tool==='upscale'&&(variants.length!==1||(await inspectToolPng(variants[0].bytes)).width!==plan.output_size.width||(await inspectToolPng(variants[0].bytes)).height!==plan.output_size.height))throw storeError(502,'unexpected_upscale_result','Upscale output size did not match the official factor.');
        if(plan.tool==='bg-removal')variants.forEach((v,i)=>v.label=['Masked','Generated','Blend'][i]??`Result ${i+1}`);
      }
      const saved=await saveImageOperation(rootDir,{plan,variants,costActual:actual,responseInfo});
      return {ok:true,generation:{id:saved.id,image_path:saved.image_path},operation:saved.sidecar.image_operation,variants:saved.sidecar.image_operation.variants};
    } finally {busy=false;}
  }
  async function selectVariant(id,index){
    if(busy)throw storeError(409,'image_tool_busy','An image operation is already running.');
    const record=await generationStore.getGeneration(id),op=record.image_operation;
    if(!op||!Number.isInteger(index)||!op.variants[index])throw storeError(400,'invalid_tool_variant','Choose an available result.');
    const source=await readFile(storedPath(record.source_assets.source_image_filename));
    const variants=await Promise.all(op.variants.map(async v=>({bytes:await readFile(storedPath(v.image_filename)),label:v.label})));
    const plan={tool:op.tool,source,sourceHash:op.input_sha256,parentId:op.parent_id,origin:record.internal_preset,sourceOrigin:op.source_prompt_origin,settings:op.settings,input_size:op.input_size,assets:{},geometry:op.geometry,payload:null,endpoint:null,cost:{anlas:0,kind:'local',basis:'existing-variant-selection'}};
    const saved=await saveImageOperation(rootDir,{plan,variants,selected:index,costActual:0,responseInfo:{variant_selection_of:id,original_api_model:op.api_model,response_container:'existing'}});
    return {ok:true,generation:{id:saved.id,image_path:saved.image_path},operation:saved.sidecar.image_operation,variants:saved.sidecar.image_operation.variants};
  }
  return {prepare,run,selectVariant,isBusy:()=>busy,async pricingEligibility(){try{const state=await account(getToken());return state?.opus??null;}catch{return null;}}};
}
