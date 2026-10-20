import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {encode} from '@msgpack/msgpack';
import {initialComposition,sourceToFrame,frameToSource,resizeCompositionFrame,renderCompositionPixels,validateComposition} from '../src/image-tools/composition-geometry.js';
import {buildToolPlan,publicToolPlan} from '../src/image-tools/plan.js';
import {composeComposition} from '../src/image-tools/composition-assets.js';
import {createDefaultPreset} from '../src/state/preset-schema.js';
import {createImageToolService} from '../src/image-tools/service.js';
import {createGenerationStore} from '../src/services/generation-store.js';
import {createInpaintGenerationMask} from '../src/services/inpaint-composite-utils.js';

const png=(w=128,h=128,color={r:40,g:80,b:120,alpha:1})=>sharp({create:{width:w,height:h,channels:4,background:color}}).png().toBuffer();
const empty=async(w=128,h=128)=>(await png(w,h,{r:255,g:255,b:255,alpha:0})).toString('base64');
const preset=()=>createDefaultPreset({params:{model:'nai-diffusion-5-full',effort:'high',qualityPreset:'none',steps:23,seed:42},prompt_parts:{base:'greenhouse, adult gardener watering plants',characters:[{prompt:'orange cap',position_mode:'custom',centers:[{x:.5,y:.5}]}]}});
test('Inverse placement and frame origin preserve source/manual/character coordinates',()=>{
  const r=initialComposition(128,128);Object.assign(r.transform,{x:95,y:77,scale:.43,angle:.7});
  for(const p of [{x:0,y:0},{x:44,y:98},{x:128,y:128}]){const inverse=frameToSource(sourceToFrame(p,r),r);assert.ok(Math.abs(inverse.x-p.x)<1e-10);assert.ok(Math.abs(inverse.y-p.y)<1e-10);}
  r.bindings=['source','frame'];const chars=[{centers:[{x:.2,y:.4}]},{centers:[{x:.7,y:.5}]}];const resized=resizeCompositionFrame(r,'left',-32,chars);
  assert.equal(resized.recipe.frame.width,160);assert.equal(resized.recipe.transform.x,127);assert.deepEqual(resized.characters[0],chars[0]);assert.equal(resized.characters[1].centers[0].x,(.7*128+32)/160);
  assert.throws(()=>validateComposition({...r,frame:{width:4096,height:4096}},r.source));assert.throws(()=>validateComposition({...r,transform:{...r.transform,scale:NaN}},r.source));
});
test('Identity renderer preserves exact opaque RGBA and the original brush selection',()=>{
  const source=new Uint8ClampedArray(128*128*4),manual=new Uint8Array(128*128);for(let i=0;i<128*128;i++){source.set([i%256,(i*7)%256,123,255],i*4);if(i%128>45&&i%128<60&&Math.floor(i/128)>33&&Math.floor(i/128)<50)manual[i]=255;}
  const out=renderCompositionPixels(source,manual,initialComposition(128,128));assert.deepEqual(out.image,source);assert.deepEqual(out.mask,manual);assert.ok(out.gap.every(v=>v===0));
});
test('Rotated coverage, transparency and thin source-attached mask survive reduction without stale gaps',()=>{
  const source=new Uint8ClampedArray(128*128*4);for(let i=0;i<128*128;i++)source.set([100,50,20,255],i*4);source[(64*128+64)*4+3]=0;
  const manual=new Uint8Array(128*128);for(let y=20;y<100;y++)manual[y*128+32]=255;
  const r=initialComposition(128,128);r.transform.scale=.3;r.transform.angle=.4;
  const a=renderCompositionPixels(source,manual,r);assert.equal(a.gap[0],255);const p=sourceToFrame({x:32.5,y:50.5},r);assert.equal(a.mask[Math.floor(p.y)*128+Math.floor(p.x)],255);
  const roundtrip=renderCompositionPixels(source,manual,initialComposition(128,128));assert.equal(roundtrip.gap[0],0);assert.equal(roundtrip.gap[64*128+64],255);assert.equal(source[3],255);
});
test('Prepared preview equals actual full-size codec; all positive/negative character positions agree',async()=>{
  const source=await png(),r=initialComposition(128,128);r.frame.width=256;r.bindings=['source','frame'];
  const p=preset();p.prompt_parts.characters.push({...p.prompt_parts.characters[0],id:'new',prompt:'red hair',centers:[{x:.8,y:.5}]});const before=structuredClone(p);
  for(const effort of ['high','medium']){
    const plan=await buildToolPlan({tool:'composition',source,origin:p,settings:{composition:r,manual_mask_png:await empty(),effort,padding:16,seam:8}});
    assert.deepEqual(plan.assets.mask,createInpaintGenerationMask(plan.logicalMask,16));const publicPlan=publicToolPlan(plan);
    assert.deepEqual(Buffer.from(publicPlan.preview.source.png,'base64'),plan.assets.image);assert.deepEqual(Buffer.from(publicPlan.preview.mask.png,'base64'),plan.assets.mask);
    for(const chars of [plan.payload.parameters.characterPrompts.map(c=>[c.center]),plan.payload.parameters.v4_prompt.caption.char_captions.map(c=>c.centers),plan.payload.parameters.v4_negative_prompt.caption.char_captions.map(c=>c.centers)])assert.deepEqual(chars,[[{x:.25,y:.5}],[{x:.8,y:.5}]]);
    assert.equal(plan.payload.parameters.request_type,'NativeInfillingRequest');assert.equal(plan.payload.parameters.add_original_image,false);assert.equal(plan.origin.prompt_parts.characters[0].centers[0].x,.25);assert.equal(plan.compositionPreset.prompt_parts.characters[0].centers[0].x,.5);assert.equal(plan.settings.manual_mask_png,undefined);
  }assert.deepEqual(p,before);
});
test('Apply mask preserves every protected RGBA pixel and is contained in generation mask',async()=>{
  const r=initialComposition(128,128);r.frame.width=192;
  const plan=await buildToolPlan({tool:'composition',source:await png(),origin:preset(),settings:{composition:r,manual_mask_png:await empty(),padding:16,seam:8}});
  const result=await composeComposition(plan,await png(192,128,{r:250,g:10,b:20,alpha:1}));
  const output=await sharp(result).ensureAlpha().raw().toBuffer(),input=await sharp(plan.assets.image).ensureAlpha().raw().toBuffer(),apply=await sharp(plan.applyMask).greyscale().raw().toBuffer(),generation=await sharp(plan.assets.mask).greyscale().raw().toBuffer();
  let protectedPixels=0,changed=0,feathered=0;for(let i=0;i<apply.length;i++){if(!apply[i]){assert.deepEqual(output.subarray(i*4,i*4+4),input.subarray(i*4,i*4+4));protectedPixels++;}else{assert.equal(generation[i],255);if(apply[i]===255)assert.equal(output[i*4],250);else{assert.ok(output[i*4]>input[i*4]&&output[i*4]<250);feathered++;}changed++;}}assert.ok(protectedPixels>1000&&changed>1000&&feathered>0);
  await assert.rejects(composeComposition(plan,await png()),/dimensions/);
});
test('Invalid/full-blank/empty edits stop before generation',async()=>{
  const r=initialComposition(128,128),base={tool:'composition',source:await png(),origin:preset()};
  await assert.rejects(buildToolPlan({...base,settings:{composition:r,manual_mask_png:await empty()}}),/Paint a region/);
  r.transform.x=2000;await assert.rejects(buildToolPlan({...base,settings:{composition:r,manual_mask_png:await empty()}}),/Keep some/);
  r.transform.x=64;r.frame.width=192;
  await assert.rejects(buildToolPlan({...base,settings:{composition:r,manual_mask_png:await empty(64,64)}}),/match/);
  await assert.rejects(buildToolPlan({...base,settings:{composition:r,manual_mask_png:await empty(),padding:0,seam:8}}),/Seam/);
});
test('Single-use generation, dual variants, exact stored request and editable History restore preserve the original',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'chaessi-composition-'));let posts=0,requestImage,requestMask;
  try{
    const store=createGenerationStore({rootDir:root}),service=createImageToolService({rootDir:root,generationStore:store,wildcardStore:{all:async()=>[]},getToken:()=> 'fixture-only',fetchImpl:async(url,options={})=>{
      if(options.method!=='POST')return new Response(JSON.stringify({subscription:{active:true,tier:3,trainingStepsLeft:100,usage:{isNegative:false}}}));
      posts++;requestImage=Buffer.from(await options.body.get('image').arrayBuffer());requestMask=Buffer.from(await options.body.get('mask').arrayBuffer());const p=JSON.parse(await options.body.get('request').text());
      const image=await png(p.parameters.width,p.parameters.height,{r:240,g:30,b:10,alpha:1}),frame=Buffer.from(encode({event_type:'final',image})),head=Buffer.alloc(4);head.writeUInt32BE(frame.length);return new Response(Buffer.concat([head,frame]));
    }});
    const source=await png(),r=initialComposition(128,128);r.frame.width=192;
    const prepared=await service.prepare({tool:'composition',source_png:source.toString('base64'),prompt_source:'current',preset:preset(),settings:{composition:r,manual_mask_png:await empty(),padding:16,seam:8}});
    const result=await service.run(prepared.prepared_id);assert.equal(result.variants.length,2);await assert.rejects(service.run(prepared.prepared_id),/Review/);assert.equal(posts,1);
    assert.deepEqual(requestImage,Buffer.from(prepared.plan.preview.source.png,'base64'));assert.deepEqual(requestMask,Buffer.from(prepared.plan.preview.mask.png,'base64'));
    const record=await store.getGeneration(result.generation.id);assert.deepEqual(await readFile(path.join(root,record.source_assets.source_image_filename)),source);
    assert.deepEqual(await readFile(path.join(root,record.source_assets.request_source_image_filename)),requestImage);
    const restored=(await service.restoreComposition(result.generation.id)).session;assert.equal(restored.recipe.frame.width,192);assert.equal(restored.preset.prompt_parts.characters[0].centers[0].x,.5);
    const chosen=await service.selectVariant(result.generation.id,1);assert.equal(posts,1);assert.notEqual(chosen.generation.id,result.generation.id);assert.equal((await service.restoreComposition(chosen.generation.id)).session.recipe.frame.width,192);
    const second=await service.prepare({tool:'composition',source_png:restored.source_png,composition_parent_id:result.generation.id,prompt_source:'current',preset:restored.preset,settings:{...restored.settings,manual_mask_png:restored.manual_mask_png}});assert.deepEqual(second.plan.character_positions,prepared.plan.character_positions);
    assert.equal((await store.listGenerations()).length,2);
  }finally{await rm(root,{recursive:true,force:true});}
});
