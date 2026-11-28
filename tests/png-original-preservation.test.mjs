import test from 'node:test';import assert from 'node:assert/strict';
import {fork} from 'node:child_process';import {once} from 'node:events';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import sharp from 'sharp';
import {syntheticProviderPng,fixtureMetadata} from './png-preservation-fixture.mjs';
import {receivedImageToPng,referenceInputPng} from '../src/services/generation-png.js';
import {parseNovelAiPngMetadata,extractStealthPngMetadata} from '../src/importers/nai-metadata.js';
import {createDefaultPreset} from '../src/state/preset-schema.js';

function pngChunks(bytes){const rows=[];for(let p=8;p+12<=bytes.length;){const n=bytes.readUInt32BE(p),type=bytes.toString('ascii',p+4,p+8);rows.push({type,data:bytes.subarray(p+8,p+8+n)});p+=n+12;}return rows;}
function pngText(bytes){return Object.fromEntries(pngChunks(bytes).filter(c=>c.type==='iTXt').map(c=>{const end=c.data.indexOf(0);return [c.data.toString('utf8',0,end),c.data.toString('utf8',end+5)];}));}

test('WebP conversion exposes exact returned metadata for Inspect without changing IDAT or Comment bytes',async()=>{
  const comment='  '+JSON.stringify(fixtureMetadata,null,2)+'\n';
  const actual={Software:'NovelAI synthetic fixture',Description:'한글 metadata test',Source:'synthetic source', 'Generation time':'1.23',Comment:comment};
  const webp=await sharp(syntheticProviderPng({stealthMetadata:actual})).webp({lossless:true}).toBuffer();
  const bare=await sharp(webp).keepMetadata().png().toBuffer();
  const result=await receivedImageToPng(webp,{model:'nai-diffusion-5-full',input:'different request',parameters:{seed:999,signed_hash:'caller-value-must-not-become-provider-metadata'}});
  const texts=pngText(result.imageBytes);
  for(const [key,value]of Object.entries(actual))assert.equal(texts[key],value,key);
  assert.equal(texts.Title,undefined);assert.ok(!texts.Comment.includes('caller-value'));
  assert.deepEqual(pngChunks(result.imageBytes).filter(c=>c.type==='IDAT'),pngChunks(bare).filter(c=>c.type==='IDAT'));
  assert.equal(extractStealthPngMetadata(result.imageBytes).text,extractStealthPngMetadata(bare).text);
  assert.equal(parseNovelAiPngMetadata(result.imageBytes).parsed.params.seed,fixtureMetadata.seed);
});

test('missing or unsupported returned Comment is never reconstructed as official PNG text',async()=>{
  for(const Comment of [undefined,'not JSON','null','[]',{prompt:'object without original string'}]){
    const webp=await sharp(syntheticProviderPng({stealthMetadata:{Software:'NovelAI synthetic fixture',Comment}})).webp({lossless:true}).toBuffer();
    const result=await receivedImageToPng(webp,{model:'nai-diffusion-5-full',input:'synthetic request',parameters:{}});
    const texts=pngText(result.imageBytes);assert.equal(texts.Comment,undefined);assert.equal(texts.Software,undefined);assert.equal(texts.Title,undefined);
  }
});

test('plain WebP request data stays supplemental and never supplies a provider signature',async()=>{
  const webp=await sharp({create:{width:32,height:32,channels:4,background:'#2468ac'}}).webp({lossless:true}).toBuffer();
  const result=await receivedImageToPng(webp,{model:'nai-diffusion-5-full',input:'synthetic request',parameters:{signed_hash:'request-signature',image_cache_secret_key:'synthetic-cache'}});
  const texts=pngText(result.imageBytes);assert.equal(texts.Comment,undefined);assert.equal(texts.Software,undefined);
  assert.equal(JSON.parse(texts['Generation Data']).provenance,'chaessi-request');assert.ok(!texts['Generation Data'].includes('request-signature'));assert.ok(!texts['Generation Data'].includes('synthetic-cache'));
});

test('all provider PNG bytes survive ordinary, Precise and legacy reference generation paths',async()=>{
  const original=syntheticProviderPng(),before=Buffer.from(original);
  for(const parameters of [{},{director_reference_descriptions:[{}]},{reference_image_multiple:['synthetic-reference']},{image:'synthetic-input',mask:'synthetic-mask'}]){
    const result=await receivedImageToPng(original,{model:'nai-diffusion-5-full',input:'different synthetic request',parameters});
    assert.strictEqual(result.imageBytes,original);assert.deepEqual(result.imageBytes,before);
    assert.equal(result.requestMetadataOnly,undefined);
    const recovered=parseNovelAiPngMetadata(result.imageBytes).parsed;
    assert.equal(recovered.base_prompt,fixtureMetadata.prompt);assert.equal(recovered.undesired,fixtureMetadata.uc);
    assert.equal(recovered.params.seed,fixtureMetadata.seed);assert.equal(recovered.characters[0].prompt,'synthetic red square');
    assert.equal(recovered.characters[0].undesired,'synthetic character negative');
    assert.deepEqual(extractStealthPngMetadata(result.imageBytes),extractStealthPngMetadata(before));
  }
  const cleaned=await referenceInputPng(original);
  assert.ok(!cleaned.includes(Buffer.from(fixtureMetadata.signed_hash)));
  assert.equal(extractStealthPngMetadata(cleaned),null);
  assert.deepEqual(original,before); // Input privacy conversion never mutates originals.
});

test('lossless WebP conversion with Precise preserves original RGBA/stealth; does not use input scrub',async()=>{
  const original=syntheticProviderPng(),webp=await sharp(original).webp({lossless:true}).toBuffer(),before=await sharp(webp).ensureAlpha().raw().toBuffer();
  const result=await receivedImageToPng(webp,{model:'nai-diffusion-5-full',input:'synthetic request',parameters:{director_reference_descriptions:[{}],width:512,height:512}});
  assert.deepEqual(await sharp(result.imageBytes).ensureAlpha().raw().toBuffer(),before);
  assert.ok(extractStealthPngMetadata(result.imageBytes));assert.equal(parseNovelAiPngMetadata(result.imageBytes).parsed.base_prompt,fixtureMetadata.prompt);
  assert.equal(result.requestMetadataOnly,undefined);
});

for(const responseFormat of ['png','webp'])test(`real isolated generation endpoint stores and downloads preserved ${responseFormat} metadata`,async t=>{
  const profile=await mkdtemp(path.join(os.tmpdir(),'chaessi-png-original-'));
  const child=fork(new URL('../server.mjs',import.meta.url),[],{silent:true,windowsHide:true,execArgv:['--import',new URL('./mock-png-preservation-provider.mjs',import.meta.url).href],env:{SystemRoot:process.env.SystemRoot||'',PATH:process.env.PATH,PORT:'0',CHAESSI_ELECTRON_SERVER:'1',CHAESSI_PRIVATE_TEST_PROFILE:profile,CHAESSI_USER_DATA_DIR:profile,NAI_ACCESS_TOKEN:'synthetic-local-offline',CHAESSI_TEST_RESPONSE_FORMAT:responseFormat}});
  const stopped=once(child,'exit');t.after(async()=>{if(child.connected)child.disconnect();await stopped;await rm(profile,{recursive:true,force:true});});
  const [ready]=await Promise.race([once(child,'message',{signal:AbortSignal.timeout(20000)}),stopped.then(()=>{throw Error('Synthetic server did not start');})]);
  const base='http://127.0.0.1:'+ready.port;
  async function post(route,body){const response=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);return response.json();}
  const preset=createDefaultPreset({params:{model:'nai-diffusion-5-full',effort:'high',seed:123456,width:512,height:512}});preset.prompt_parts.base='synthetic request';
  const input={preset,precise_references:[{enabled:true,type:'outfit',strength:1.25,image_base64:syntheticProviderPng().toString('base64')}],mode:'text-to-image'};
  const prepared=await post('/api/novelai/prepare',input);
  const generated=await post('/api/novelai/generate',{prepared_id:prepared.prepared_id,mode:'text-to-image'});
  const original=syntheticProviderPng(),disk=await readFile(path.join(profile,generated.generation.image_path));
  if(responseFormat==='png')assert.deepEqual(disk,original);
  else{assert.deepEqual(await sharp(disk).ensureAlpha().raw().toBuffer(),await sharp(original).ensureAlpha().raw().toBuffer());assert.equal(pngText(disk).Comment,JSON.stringify(fixtureMetadata));}
  const latest=Buffer.from(await(await fetch(base+'/'+generated.generation.image_path)).arrayBuffer());assert.deepEqual(latest,disk);
  const history=await(await fetch(base+'/api/generations/'+generated.generation.id)).json();
  const restored=Buffer.from(await(await fetch(base+'/'+history.generation.output.image_filename)).arrayBuffer());assert.deepEqual(restored,disk);
  assert.deepEqual(parseNovelAiPngMetadata(restored).parsed,parseNovelAiPngMetadata(original).parsed);
  assert.equal(history.generation.output.metadata_source,'png_text:Comment');
  assert.equal(history.generation.output.received_image_format,responseFormat);
});
