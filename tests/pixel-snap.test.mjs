import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {snapPixels,scaleNearest,detectPixelGrid,inspectPixelPng,pixelGeometry,normalizePixelSettings} from '../src/image-tools/pixel-snap-core.js';
import {createImageToolService} from '../src/image-tools/service.js';
import {createGenerationStore} from '../src/services/generation-store.js';

function fixture(width=24,height=20){const data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,n=(x*37+y*53)%7;data.set(n===0?[0,0,0,0]:[30+n*25,20+n*31,210-n*20,n===2?128:255],i);}return {width,height,data};}
const png=image=>sharp(Buffer.from(image.data),{raw:{width:image.width,height:image.height,channels:4}}).png().toBuffer();
test('Integer-expanded art recovers every logical RGBA pixel, including single-pixel details',()=>{
  const logical=fixture(),expanded=scaleNearest(logical,4),before=expanded.data.slice();
  const result=snapPixels(expanded,{gridX:4,gridY:4});assert.equal(result.width,logical.width);assert.deepEqual(result.data,logical.data);assert.deepEqual(expanded.data,before);
  for(const scale of [1,2,3,8]){const output=scaleNearest(result,scale);for(let y=0;y<output.height;y++)for(let x=0;x<output.width;x++){const i=(y*output.width+x)*4,j=(Math.floor(y/scale)*logical.width+Math.floor(x/scale))*4;assert.deepEqual(output.data.subarray(i,i+4),logical.data.subarray(j,j+4));}}
});
test('Grid detector distinguishes fundamental grid from submultiples and handles offset',()=>{
  const image=scaleNearest(fixture(),4),d=detectPixelGrid(image);assert.equal(d.gridX,4);assert.equal(d.gridY,4);assert.equal(d.level,'high');
  const cropped={width:image.width-1,height:image.height-2,data:new Uint8ClampedArray((image.width-1)*(image.height-2)*4)};
  for(let y=0;y<cropped.height;y++)cropped.data.set(image.data.subarray(((y+2)*image.width+1)*4,((y+2)*image.width+image.width)*4),y*cropped.width*4);
  const shifted=detectPixelGrid(cropped);assert.equal(shifted.gridX,4);assert.equal(shifted.gridY,4);assert.equal(shifted.offsetX,3);assert.equal(shifted.offsetY,2);
  const flat={width:100,height:100,data:new Uint8ClampedArray(40000).fill(255)};assert.equal(detectPixelGrid(flat).level,'low');
});
test('Mildly blurred pixel-art cells become crisp again without inventing representative colors',async()=>{
  const logical=fixture();for(let i=3;i<logical.data.length;i+=4)logical.data[i]=255;
  const enlarged=scaleNearest(logical,6),soft=await sharp(await png(enlarged)).blur(.5).ensureAlpha().raw().toBuffer();
  const input={data:soft,width:enlarged.width,height:enlarged.height},snapped=snapPixels(input,{gridX:6,gridY:6}),observed=new Set();
  for(let i=0;i<soft.length;i+=4)observed.add(soft.subarray(i,i+4).join(','));
  let error=0;for(let i=0;i<snapped.data.length;i+=4){assert.ok(observed.has(snapped.data.subarray(i,i+4).join(',')));for(let c=0;c<3;c++)error+=Math.abs(snapped.data[i+c]-logical.data[i+c]);}
  assert.ok(error/(logical.width*logical.height*3)<8,'mean RGB error stays below 8/255 for this controlled mild-blur fixture');
});
test('Manual fractional grids, offset and explicit partial-cell policy have stable output dimensions',()=>{
  const s={gridX:3.5,gridY:2.5,offsetX:1,offsetY:.5,scale:2};
  const keep=pixelGeometry(20,16,s),crop=pixelGeometry(20,16,{...s,edges:'crop'});assert.deepEqual(keep.logical,{width:7,height:8});assert.deepEqual(crop.logical,{width:5,height:6});
  assert.deepEqual(snapPixels(fixture(20,16),s).geometry,keep);assert.throws(()=>normalizePixelSettings({...s,offsetX:3.5}),/Offsets/);
  assert.throws(()=>pixelGeometry(2,2,{gridX:4,edges:'crop'}));assert.throws(()=>pixelGeometry(4096,4096,{gridX:1,scale:2}));
});
test('Palette reduction uses observed colors, ignores invisible RGB and preserves alpha',()=>{
  const input=fixture(30,20),colors=new Set();for(let i=0;i<input.data.length;i+=4)if(input.data[i+3])colors.add([...input.data.subarray(i,i+3)].join(','));
  const a=snapPixels(input,{gridX:1,palette:'limit',colors:3}),b=snapPixels(input,{gridX:1,palette:'limit',colors:3});assert.deepEqual(a.data,b.data);
  const actual=new Set();for(let i=0;i<a.data.length;i+=4){assert.equal(a.data[i+3],input.data[i+3]);if(a.data[i+3]){const rgb=[...a.data.subarray(i,i+3)].join(',');actual.add(rgb);assert.ok(colors.has(rgb));}}assert.ok(actual.size<=3);
  const binary=snapPixels(input,{gridX:1,alpha:'binary',threshold:200});for(let i=3;i<binary.data.length;i+=4)assert.ok([0,255].includes(binary.data[i]));
  const transparent={width:8,height:8,data:new Uint8ClampedArray(256)};for(let i=0;i<256;i+=4)transparent.data[i]=255;
  assert.equal(snapPixels(transparent,{gridX:1,palette:'auto'}).paletteSize,0);
});
test('Still PNG parser rejects APNG, malformed and oversized input before decoding',async()=>{
  const bytes=await png(fixture());assert.equal(inspectPixelPng(bytes).width,24);assert.throws(()=>inspectPixelPng(bytes.subarray(0,40)));
  const oversized=Buffer.from(bytes);oversized.writeUInt32BE(100000,16);assert.throws(()=>inspectPixelPng(oversized),/megapixels/);
  const animation=Buffer.concat([bytes.subarray(0,33),Buffer.from([0,0,0,8,97,99,84,76,0,0,0,1,0,0,0,0,0,0,0,0]),bytes.subarray(33)]);assert.throws(()=>inspectPixelPng(animation),/Animated/);
});
test('Pixel Snap save and History chaining never read tokens, accounts, prompts or provider; original bytes are immutable',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'chaessi-pixel-test-'));let calls=0;
  const forbidden=()=>{calls++;throw Error('Forbidden external access');};
  try{
    const generationStore=createGenerationStore({rootDir:root}),service=createImageToolService({rootDir:root,generationStore,getToken:forbidden,fetchImpl:forbidden,wildcardStore:{all:forbidden}});
    const image=scaleNearest(fixture(),4),source=await png(image),recipe={gridX:4,gridY:4,scale:2},result=scaleNearest(snapPixels(image,recipe),2),edited=await png(result);
    const prepared=await service.prepare({tool:'pixel-snap',source_png:source.toString('base64'),prompt_source:'current',settings:{...recipe,edited_png:edited.toString('base64')}});
    assert.equal(prepared.plan.cost.anlas,0);assert.equal(prepared.plan.model,null);assert.deepEqual(prepared.plan.expected_output_size,{width:48,height:40});
    const saved=await service.run(prepared.prepared_id);assert.equal(saved.operation.actual_anlas,0);assert.equal(saved.operation.api_model,null);assert.equal(saved.operation.settings.algorithm,'chaessi-grid-v1');
    const record=await generationStore.getGeneration(saved.generation.id);assert.equal(record.request.endpoint,null);assert.deepEqual(await readFile(path.join(root,record.source_assets.source_image_filename)),source);
    const rgba=await sharp(path.join(root,saved.generation.image_path)).ensureAlpha().raw().toBuffer();assert.deepEqual(rgba,Buffer.from(result.data));
    const chained=await service.prepare({tool:'pixel-snap',source_id:saved.generation.id,settings:{gridX:1,gridY:1,edited_png:edited.toString('base64')}});const second=await service.run(chained.prepared_id);assert.equal(second.operation.parent_id,saved.generation.id);
    await assert.rejects(service.run(prepared.prepared_id),/Review/);assert.equal(calls,0);assert.equal((await generationStore.listGenerations()).length,2);
    await assert.rejects(service.prepare({tool:'pixel-snap',source_png:source.toString('base64'),settings:{...recipe,edited_png:source.toString('base64')}}),/does not match/);
  }finally{await rm(root,{recursive:true,force:true});}
});
