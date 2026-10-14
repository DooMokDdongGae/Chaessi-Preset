// Observed NovelAI web client, 2026-10-14. Keep independent of legacy Inpaint.
export const GENERATION_PIXEL_LIMIT = 3_145_728;
export const TOOL_PIXEL_LIMIT = 16_777_216;
export const MAGNITUDES = Object.freeze([{strength:.2,noise:0},{strength:.4,noise:0},{strength:.5,noise:0},{strength:.6,noise:0},{strength:.7,noise:.1}]);
export const DIRECTOR_TOOLS = Object.freeze(['bg-removal','lineart','sketch','colorize','emotion','declutter','declutter-keep-bubbles']);
export const EMOTIONS = Object.freeze(['neutral','happy','sad','angry','scared','surprised','tired','excited','nervous','thinking','confused','shy','disgusted','smug','bored','laughing','irritated','aroused','embarrassed','worried','love','determined','hurt','playful']);
export function dimensions(width,height,limit=TOOL_PIXEL_LIMIT) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>limit) throw new Error('Image dimensions exceed the tool limit.');
  return {width,height};
}
export function directorSize(width,height) {
  dimensions(width,height);
  let scale=Math.min(1,Math.sqrt((GENERATION_PIXEL_LIMIT-2000)/(width*height)));
  let w=Math.floor(width*scale),h=Math.floor(height*scale);
  if(w*h<1_011_712){scale=Math.sqrt(1_048_576/(w*h));w=Math.floor(w*scale);h=Math.floor(h*scale);}
  return {width:w,height:h};
}
export function maxEnhanceSize(width,height,factor=2) {
  dimensions(width,height,GENERATION_PIXEL_LIMIT);
  if(width*height>=GENERATION_PIXEL_LIMIT*.8) throw new Error('Max Enhance requires an image below 80% of the generation size limit.');
  const quantum=8*factor,w=Math.floor(width/quantum)*quantum*factor,h=Math.floor(height/quantum)*quantum*factor;
  const scale=Math.min(1,Math.sqrt(GENERATION_PIXEL_LIMIT/(w*h)));
  let rw=32*Math.round(w*scale/32),rh=32*Math.round(h*scale/32);
  if(rw*rh>GENERATION_PIXEL_LIMIT){rw=32*Math.floor(w*scale/32);rh=32*Math.floor(h*scale/32);}
  if(rw<32||rh<32)throw new Error('Aspect ratio too extreme to enhance.');
  return {width:rw,height:rh};
}
export function maxEnhanceResultSize(width,height,factor=2){const scale=Math.min(factor,Math.sqrt(GENERATION_PIXEL_LIMIT/(width*height)));return {width:Math.floor(width*scale),height:Math.floor(height*scale)};}
export function enhancePrompt(prompt) {
  if(prompt.includes('upscaled, blurry'))return prompt;
  const match=prompt.match(/(?:^|\s|[,.:[\]{}、。])text:(?!:)/i),index=match?.index??prompt.length;
  return prompt.slice(0,index)+', -2::upscaled, blurry::,'+prompt.slice(index);
}
export function unit(value,fallback) {
  const n=value===undefined?fallback:Number(value);
  if(!Number.isFinite(n)||n<0||n>1)throw new Error('Strength and Noise must be between 0 and 1.');
  return n;
}
export function upscalePrice(width,height) {
  dimensions(width,height,GENERATION_PIXEL_LIMIT);
  return [[1048576,1],[1747627,2],[2446678,3],[3145728,4]].find(([area])=>width*height<=area)[1];
}
export function estimateGeneration(payload,{opusAvailable=null,legacyInpaint=false,maxTarget}={}) {
  const p=payload.parameters,area=(maxTarget?.width??p.width)*(maxTarget?.height??p.height),medium=payload.model.includes('-medium');
  if(!Number.isFinite(area)||area<1||area>GENERATION_PIXEL_LIMIT||!Number.isInteger(p.steps)||p.steps<1||p.steps>50)throw new Error('No valid generation cost for these settings.');
  let base=Math.ceil(2.951823174884865e-6*area+5.753298233447344e-7*area*p.steps*(medium?1/1.06521739:1));
  base*=1.5;
  // High-resolution live ledger confirms legacy infill is charged the full amount.
  const amount=Math.max(Math.ceil(base*(legacyInpaint?1:p.strength??1)),2);
  const eligible=area<=1048576&&p.steps<=28;
  if(eligible&&opusAvailable===true)return {anlas:0,kind:'estimate',stamina:true,basis:'official-opus-rules'};
  if(eligible&&opusAvailable===null)return {anlas:amount,kind:'conditional',stamina:'unknown',basis:'account-not-verified'};
  return {anlas:amount,kind:'estimate',stamina:false,basis:legacyInpaint?'legacy-inpaint-live-calibration':'official-client-formula'};
}
