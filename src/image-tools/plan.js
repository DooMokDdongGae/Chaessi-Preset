import {createHash} from 'node:crypto';
import {buildModeGeneratePayload,validateModeGeneratePayload} from '../adapters/novelai-v45-generation-modes.js';
import {switchPresetEffort} from '../state/effort-state.js';
import {effectiveGenerationPreset} from '../state/effort-state.js';
import {createDefaultPreset,validatePreset} from '../adapters/novelai-v45-full.js';
import {NOVELAI_V5_FULL_MODEL} from '../state/model-profiles.js';
import {NOVELAI_V5_GENERATE_ENDPOINT} from '../state/defaults.js';
import {MAGNITUDES,DIRECTOR_TOOLS,EMOTIONS,GENERATION_PIXEL_LIMIT,dimensions,directorSize,maxEnhanceSize,maxEnhanceResultSize,enhancePrompt,unit,upscalePrice,estimateGeneration} from './contracts.js';
import {inspectToolPng,resizeToolPng,prepareFocus,prepareOutpaint,base64Png} from './image-assets.js';
import {createInpaintGenerationMask,normalizeInpaintGenerationPadding} from '../services/inpaint-composite-utils.js';
import {countDirectorTokens} from './director-tokens.js';
import {mapToolCenter} from './geometry.js';
import {normalizePngToRgba,normalizePngToRgb} from '../services/generation-image-utils.js';

export async function buildToolPlan({tool,source,origin,settings={},opusAvailable=null,parentId=null}) {
  const size=await inspectToolPng(source),hash=createHash('sha256').update(source).digest('hex');
  const plan={tool,source,origin:origin?structuredClone(origin):null,settings:structuredClone(settings),parentId,sourceHash:hash,input_size:size,assets:{},payload:null,endpoint:null,output_size:size};
  if(tool==='canvas') {
    plan.edited=base64Png(settings.edited_png);await inspectToolPng(plan.edited);
    plan.settings={edit:'canvas',...settings.edit_summary};plan.cost={anlas:0,kind:'local',stamina:false,basis:'local-editor'};return plan;
  }
  if(tool==='upscale') {
    dimensions(size.width,size.height,GENERATION_PIXEL_LIMIT);
    plan.payload={image:'image',model:'nai-diffusion-5-curated',declared_blur_sigma:0};plan.assets.image=source;
    plan.endpoint='https://image.novelai.net/ai/upscale';plan.output_size={width:size.width*2,height:size.height*2};
    plan.cost={anlas:upscalePrice(size.width,size.height),kind:'estimate',stamina:false,basis:'official-upscale-table'};return plan;
  }
  if(DIRECTOR_TOOLS.includes(tool)) {
    const target=directorSize(size.width,size.height);plan.assets.image=await resizeToolPng(source,target.width,target.height);
    plan.payload={req_type:tool,use_new_shared_trial:true,image:'image',...target};plan.output_size=target;
    if(['colorize','emotion'].includes(tool)) {
      const prompt=String(settings.prompt??'');if(prompt.length>1000)throw new Error('Director prompt is too long (official limit: 75 CLIP tokens).');
      plan.director_prompt_tokens=await countDirectorTokens(prompt);
      if(plan.director_prompt_tokens>75)throw new Error(`Director prompt exceeds the 75-token context (${plan.director_prompt_tokens}).`);
      const defry=Number(settings.defry??0);if(!Number.isInteger(defry)||defry<0||defry>5)throw new Error('Defry must be an integer between 0 and 5.');
      if(tool==='emotion'&&!EMOTIONS.includes(settings.emotion??'neutral'))throw new Error('Choose a supported emotion.');
      plan.payload.prompt=tool==='emotion'?`${String(settings.emotion??'neutral')};;${prompt}`:prompt;plan.payload.defry=defry;
    }
    plan.endpoint='https://image.novelai.net/ai/augment-image';
    // Director's V3-based pricing is server queried by the official client;
    // never apply V5 generation or free-Inpaint rules to these operations.
    const base=Math.max(2,Math.ceil(2.951823174884865e-6*target.width*target.height+5.753298233447344e-7*target.width*target.height*28));
    const free=tool!=='bg-removal'&&target.width*target.height<=1_048_576&&opusAvailable===true;
    plan.cost={anlas:tool==='bg-removal'?base*3+5:free?0:base,kind:tool!=='bg-removal'&&opusAvailable===null?'conditional':'estimate',stamina:false,basis:'official-director-v3-formula'};return plan;
  }
  if(!['enhance','max-enhance','outpaint','focused-inpaint'].includes(tool))throw new Error('Unsupported image tool.');
  if(!origin)throw new Error('Choose a prompt source before this operation.');
  const validation=validatePreset(origin);if(!validation.ok||origin.params?.model!==NOVELAI_V5_FULL_MODEL)throw new Error('This operation requires a V5 prompt. Choose the current workbench prompt explicitly for legacy or plain PNG images.');
  if(!['high','medium'].includes(settings.effort??origin.params.effort??'high'))throw new Error('Choose High or Medium explicitly.');
  const preset=switchPresetEffort(structuredClone(origin),settings.effort??origin.params.effort??'high');
  preset.params.seed=Math.floor(Math.random()*4_294_967_295);
  const magnitude=Number(settings.magnitude??2);if(!Number.isInteger(magnitude)||!MAGNITUDES[magnitude])throw new Error('Magnitude must be between 1 and 5.');
  const strength=unit(settings.strength,MAGNITUDES[magnitude].strength),noise=unit(settings.noise,MAGNITUDES[magnitude].noise);
  if(tool==='enhance'||tool==='max-enhance') {
    const factor=Number(settings.factor??1);if(![1,1.5,2].includes(factor))throw new Error('Enhance scale must be 1, 1.5 or 2.');
    const maxTarget=tool==='max-enhance'?maxEnhanceSize(size.width,size.height):null;
    const target=tool==='max-enhance'?maxEnhanceResultSize(size.width,size.height):dimensions(Math.floor(size.width*factor),Math.floor(size.height*factor),GENERATION_PIXEL_LIMIT);
    plan.max_enhance_target_size=maxTarget;
    plan.payload=buildModeGeneratePayload(preset,{mode:'image-to-image',...size,source_image_base64:'aW1hZ2U=',strength,noise});
    const p=plan.payload.parameters;p.image='image';
    if(tool==='max-enhance')p.upscaled_enhance=true;
    else {p.width=target.width;p.height=target.height;plan.payload.input=enhancePrompt(plan.payload.input);p.v4_prompt.caption.base_caption=plan.payload.input;}
    // Fixed Medium UC is solved against the original quality prompt before the enhance suffix, as in the official client.
    plan.output_size=target;plan.assets.image=source;plan.cost=estimateGeneration(plan.payload,{opusAvailable,maxTarget:maxTarget??target});
  } else {
    const prepared=tool==='outpaint'?await prepareOutpaint(source,settings.extension):await prepareFocus(source,settings.selection,settings.context??64);
    const input=await inspectToolPng(prepared.source);plan.geometry=prepared.geometry;plan.output_size=tool==='outpaint'?input:size;
    const padding=normalizeInpaintGenerationPadding(settings.padding??16);
    const mode={mode:'inpaint',width:input.width,height:input.height,source_image_base64:'aW1hZ2U=',mask_image_base64:'bWFzaw==',strength:unit(settings.inpaint_strength,1),i2i_strength:unit(settings.image_strength,.7),i2i_noise:unit(settings.image_noise,0)};
    plan.payload=buildModeGeneratePayload(preset,mode);
    const checked=validateModeGeneratePayload(plan.payload,mode);if(!checked.ok)throw new Error(checked.errors.join('; '));
    const map=center=>mapToolCenter(center,tool,size,prepared.geometry);
    for(const c of plan.payload.parameters.characterPrompts)c.center=map(c.center);
    for(const key of ['v4_prompt','v4_negative_prompt'])for(const c of plan.payload.parameters[key].caption.char_captions)c.centers=c.centers.map(map);
    const sourcePng=normalizePngToRgba(prepared.source,'image tool Inpaint source'),logicalMask=normalizePngToRgb(prepared.mask,'image tool Inpaint mask');
    plan.payload.parameters.image='image';plan.payload.parameters.mask='mask';plan.assets={image:sourcePng,mask:createInpaintGenerationMask(logicalMask,padding)};
    plan.logicalMask=logicalMask;plan.cost=estimateGeneration(plan.payload,{opusAvailable,legacyInpaint:true});plan.settings.padding=padding;
  }
  plan.origin=effectiveGenerationPreset(createDefaultPreset(preset),plan.payload);plan.endpoint=NOVELAI_V5_GENERATE_ENDPOINT;return plan;
}
export function publicToolPlan(plan) {
  return {tool:plan.tool,model:plan.payload?.model??null,effort:plan.origin?.params?.effort??null,prompt_preview:plan.payload?.input??plan.origin?.prompt_parts?.base??null,input_size:plan.input_size,request_size:plan.payload?.parameters?{width:plan.payload.parameters.width,height:plan.payload.parameters.height}:plan.output_size,expected_output_size:plan.output_size,max_enhance_target_size:plan.max_enhance_target_size??null,director_prompt_tokens:plan.director_prompt_tokens??null,cost:plan.cost,geometry:plan.geometry??null,automatic_retry:false};
}
