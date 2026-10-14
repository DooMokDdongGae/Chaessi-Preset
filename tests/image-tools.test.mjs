import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,access,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {createDefaultPreset} from '../src/state/preset-schema.js';
import {buildToolPlan} from '../src/image-tools/plan.js';
import {maxEnhanceSize,estimateGeneration,directorSize} from '../src/image-tools/contracts.js';
import {prepareFocus,composeFocus,prepareOutpaint,inspectToolPng} from '../src/image-tools/image-assets.js';
import {saveImageOperation} from '../src/image-tools/store.js';
import {createGenerationStore} from '../src/services/generation-store.js';
import {parseNovelAiPngMetadata} from '../src/importers/nai-metadata.js';
import {createImageToolService} from '../src/image-tools/service.js';
import {crc32} from '../src/image-tools/png-integrity.js';
import {decodeToolZip} from '../src/image-tools/zip-images.js';
import {validateMediumContract} from '../src/adapters/novelai-v5-full.js';
import {countDirectorTokens} from '../src/image-tools/director-tokens.js';
import {mapToolCenter} from '../src/image-tools/geometry.js';
import {normalizePngToRgba,normalizePngToRgb} from '../src/services/generation-image-utils.js';
import {createInpaintGenerationMask} from '../src/services/inpaint-composite-utils.js';
const png=(width=1024,height=1024,color={r:60,g:100,b:150,alpha:.5})=>sharp({create:{width,height,channels:4,background:color}}).png().toBuffer();
const origin=effort=>createDefaultPreset({params:{model:'nai-diffusion-5-full',effort,qualityPreset:'none',steps:23,scale:5,seed:42},prompt_parts:{base:'adult woman, blue hair, garden',undesired:'hat',characters:[{prompt:'blue eyes',undesired:'glasses',centers:[{x:.2,y:.3}],position_mode:'custom'}]}});
export function zip(images){let offset=0;const local=[],directory=[];for(const [index,bytes]of images.entries()){const name=Buffer.from(`image_${index}.png`),head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt32LE(crc32(bytes),14);head.writeUInt32LE(bytes.length,18);head.writeUInt32LE(bytes.length,22);head.writeUInt16LE(name.length,26);local.push(head,name,bytes);const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50);cd.writeUInt32LE(crc32(bytes),16);cd.writeUInt32LE(bytes.length,20);cd.writeUInt32LE(bytes.length,24);cd.writeUInt16LE(name.length,28);cd.writeUInt32LE(offset,42);directory.push(cd,name);offset+=30+name.length+bytes.length;}const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(images.length,8);end.writeUInt16LE(images.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,central,end]);}
test('Official Upscale and Enhance contracts preserve source and Medium restrictions',async()=>{
 const source=await png(832,1216),o=origin('high'),copy=structuredClone(o);
 const up=await buildToolPlan({tool:'upscale',source,origin:o});assert.deepEqual(up.payload,{image:'image',model:'nai-diffusion-5-curated',declared_blur_sigma:0});assert.deepEqual(up.output_size,{width:1664,height:2432});assert.equal(up.cost.anlas,1);
 for(const effort of ['high','medium'])for(const tool of ['enhance','max-enhance']){const p=await buildToolPlan({tool,source,origin:o,settings:{effort,factor:1.5},opusAvailable:true});assert.equal(p.payload.action,'img2img');assert.equal(p.payload.parameters.n_samples,1);assert.equal(p.payload.parameters.extra_noise_seed,p.payload.parameters.seed-1);assert.equal(p.payload.parameters.image,'image');assert.equal(p.payload.parameters.upscaled_enhance,tool==='max-enhance'?true:undefined);if(effort==='medium')assert.deepEqual(validateMediumContract(p.payload),[]);assert.equal(p.payload.input.includes('-2::upscaled, blurry::'),tool==='enhance');}
 assert.deepEqual(o,copy);assert.deepEqual(maxEnhanceSize(832,1216),{width:1440,height:2144});assert.throws(()=>maxEnhanceSize(1536,2048));
});
test('Director contracts resize independently and keep prompt and emotion delimiter separate',async()=>{
 const source=await png(256,256);assert.deepEqual(directorSize(256,256),{width:1024,height:1024});
 for(const tool of ['bg-removal','lineart','sketch','colorize','emotion','declutter','declutter-keep-bubbles']){const p=await buildToolPlan({tool,source,settings:{prompt:'blue dress',emotion:'happy',defry:2}});assert.equal(p.payload.req_type,tool);assert.equal(p.payload.width,1024);assert.equal(p.payload.model,undefined);if(tool==='emotion')assert.equal(p.payload.prompt,'happy;;blue dress');}
 await assert.rejects(buildToolPlan({tool:'pixel-snap',source}));
});
test('Outpaint mask and independent Focus geometry protect unselected RGBA pixels',async()=>{
 const source=await png(128,128),out=await prepareOutpaint(source,{left:16,right:8,top:8,bottom:0});assert.equal((await inspectToolPng(out.source)).width,152);
 const m=await sharp(out.mask).raw().toBuffer();assert.equal(m[0],255);assert.equal(m[(16+8*152)*3],0);
 const focus=await prepareFocus(source,{x:32,y:24,width:40,height:32},16),generated=await png(focus.geometry.target.width,focus.geometry.target.height,{r:255,g:20,b:10,alpha:.25});
 const composite=await composeFocus(source,generated,focus.geometry),before=await sharp(source).ensureAlpha().raw().toBuffer(),after=await sharp(composite).ensureAlpha().raw().toBuffer();let changed=0;
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;if(x<32||x>=72||y<24||y>=56)assert.deepEqual(after.subarray(i,i+4),before.subarray(i,i+4));else if(!after.subarray(i,i+4).equals(before.subarray(i,i+4)))changed++;}assert.equal(changed,40*32);
 await assert.rejects(prepareOutpaint(source,{right:4000}));
 assert.deepEqual(mapToolCenter({x:.5,y:.5},'outpaint',{width:128,height:128},out.geometry),{x:80/152,y:72/136});
 assert.deepEqual(mapToolCenter({x:0,y:1},'focused-inpaint',{width:128,height:128},focus.geometry),{x:0,y:1});
});
test('Large processed PNG stores actual dimensions, alpha, prompt origin and assets without deleting parent',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'chaessi-tools-'));
 try{const source=await png(),o=origin('medium'),plan=await buildToolPlan({tool:'upscale',source,origin:o,parentId:'parent'}),large=await png(3072,4096);
 const saved=await saveImageOperation(root,{plan,variants:[{bytes:large,label:'Masked'},{bytes:large,label:'Generated'}],costActual:4}),bytes=await readFile(path.join(root,saved.image_path));
 assert.equal(saved.sidecar.app.version,JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version);const imported=parseNovelAiPngMetadata(bytes);assert.equal(imported.parsed.params.effort,'medium');assert.equal(imported.parsed.params.width,o.params.width);assert.equal(imported.parsed.base_prompt,o.prompt_parts.base);assert.deepEqual(imported.parsed.characters,o.prompt_parts.characters);assert.equal(imported.image_operation.actual_output_size.width,3072);
 const pixels=await sharp(bytes).ensureAlpha().raw().toBuffer();assert.equal(pixels[3],128);
 const store=createGenerationStore({rootDir:root}),list=await store.listGenerations();assert.equal(list[0].width,3072);assert.equal(list[0].image_tool,'upscale');assert.equal(list[0].actual_anlas,4);await store.deleteGeneration(saved.id);await assert.rejects(access(path.join(root,saved.sidecar.image_operation.variants[0].image_filename)));assert.equal((await store.listGenerations()).length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('ZIP decoder rejects incomplete/checksum-invalid responses and preserves three PNG variants',async()=>{
 const image=await png(64,64),bytes=zip([image,image,image]);assert.equal(decodeToolZip(bytes).length,3);assert.throws(()=>decodeToolZip(bytes.subarray(0,20)));const broken=Buffer.from(bytes);broken[50]^=1;assert.throws(()=>decodeToolZip(broken));
});
test('Prepared tool execution is single-use; timeout never retries or writes false success',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'chaessi-tool-service-'));let posts=0;
 try{const source=await png(64,64),store=createGenerationStore({rootDir:root});const service=createImageToolService({rootDir:root,generationStore:store,wildcardStore:{all:async()=>[]},getToken:()=> 'test-only',fetchImpl:async(url,options)=>{if(options.method==='POST'){posts++;throw new Error('timeout');}return new Response('{}',{status:503});}});
 const p=await service.prepare({tool:'upscale',source_png:source.toString('base64')});await assert.rejects(service.run(p.prepared_id),/interrupted/);await assert.rejects(service.run(p.prepared_id),/Review/);assert.equal(posts,1);assert.equal((await store.listGenerations()).length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Inpaint calibrated cost does not reuse the mismatching official strength multiplier',()=>{
 const payload={model:'nai-diffusion-5-full-inpainting',parameters:{width:1472,height:1472,steps:23,strength:.4,inpaintImg2ImgStrength:.6}};
 assert.equal(estimateGeneration(payload,{legacyInpaint:true,opusAvailable:true}).anlas,54);payload.model='nai-diffusion-5-full-medium-inpainting';payload.parameters.steps=14;assert.equal(estimateGeneration(payload,{legacyInpaint:true,opusAvailable:true}).anlas,35);
});
test('Director byte-BPE and 75-token guard stop oversized prompts before charging',async()=>{
 assert.equal(await countDirectorTokens('blue hair, blue dress'),5);assert.equal(await countDirectorTokens(''),0);assert.equal(await countDirectorTokens('HELLO   WORLD'),2);
 assert.equal(await countDirectorTokens('cat '.repeat(76)),76);await assert.rejects(buildToolPlan({tool:'colorize',source:await png(64,64),settings:{prompt:'cat '.repeat(76)}}),/75-token/);
});
test('Explicit current Medium prompt freezes Wildcards once, ignores inactive UC, preserves editor',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'chaessi-tool-prompts-'));
 try{const p=origin('high');p.prompt_parts.base='adult, __scene__';p.prompt_parts.undesired='__inactive__';p.prompt_parts.characters[0].undesired='__inactive_char__';const original=structuredClone(p);
 const service=createImageToolService({rootDir:root,generationStore:createGenerationStore({rootDir:root}),wildcardStore:{all:async()=>[{key:'scene',entries:['garden']}]},getToken:()=> 'test-only',fetchImpl:async()=>new Response('{}',{status:503})});
 const prepared=await service.prepare({tool:'enhance',source_png:(await png()).toString('base64'),prompt_source:'current',preset:p,settings:{effort:'medium'}});assert.equal(prepared.plan.effort,'medium');assert.deepEqual(p,original);
 p.prompt_parts.base='changed after review';await assert.rejects(service.run(prepared.prepared_id),/failed/);assert.equal((await createGenerationStore({rootDir:root}).listGenerations()).length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Complete response receipts retain unusable paid responses without false History or secrets',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'chaessi-tool-receipt-'));let posts=0;
 try{const store=createGenerationStore({rootDir:root}),service=createImageToolService({rootDir:root,generationStore:store,wildcardStore:{all:async()=>[]},getToken:()=> 'test-only-credential',fetchImpl:async(_,options)=>{if(options.method==='POST'){posts++;return new Response('damaged zip',{status:200});}return new Response(JSON.stringify({subscription:{active:true,tier:3,trainingStepsLeft:{fixedTrainingStepsLeft:100,purchasedTrainingSteps:0},usage:{isNegative:false}}}));}});
 const p=await service.prepare({tool:'upscale',source_png:(await png(64,64)).toString('base64')});await assert.rejects(service.run(p.prepared_id),/kept for recovery/);assert.equal(posts,1);assert.equal((await store.listGenerations()).length,0);
 const dir=path.join(root,'data','generations',new Date().toISOString().slice(0,10)),files=await readdir(dir),meta=await readFile(path.join(dir,files.find(f=>f.endsWith('.receipt-metadata'))),'utf8');assert.doesNotMatch(meta,/test-only-credential|Authorization|Bearer/);assert.equal(await readFile(path.join(dir,files.find(f=>f.endsWith('.receipt-response.bin'))),'utf8'),'damaged zip');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('New Outpaint and Focus use the exact existing source normalization and mask padding codecs',async()=>{
 const source=await png(128,128),extension={right:16},selection={x:32,y:24,width:40,height:32};
 for(const effort of ['high','medium'])for(const tool of ['outpaint','focused-inpaint']){
  const p=await buildToolPlan({tool,source,origin:origin(effort),settings:{effort,extension,selection,context:16,padding:16}});
  const prepared=tool==='outpaint'?await prepareOutpaint(source,extension):await prepareFocus(source,selection,16);
  assert.deepEqual(p.assets.image,normalizePngToRgba(prepared.source));assert.deepEqual(p.assets.mask,createInpaintGenerationMask(normalizePngToRgb(prepared.mask),16));
  assert.equal(p.payload.parameters.request_type,'NativeInfillingRequest');assert.equal(p.payload.parameters.add_original_image,false);assert.equal(p.payload.parameters.strength,.7);assert.equal(p.payload.parameters.noise,0);assert.equal(p.payload.parameters.inpaintImg2ImgStrength,1);
 }
});
