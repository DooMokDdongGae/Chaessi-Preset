import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { attachV5Precise } from '../src/adapters/novelai-v5-precise.js';
import { createNovelAiMultipartBody } from '../src/services/novelai-multipart-request.js';
import sharp from 'sharp';
import { encodeRgbaPng } from '../src/services/generation-image-utils.js';
import { appendPngText } from '../src/services/generation-png.js';
import { v5ReferenceCrop } from '../src/state/v5-reference-buckets.js';

const base = () => ({ model: 'nai-diffusion-5-full', action: 'generate', parameters: {} });
const rgba = Buffer.alloc(1024*1024*4, 255);
rgba.set([23, 124, 217, 177], 0);
const blank = encodeRgbaPng(rgba, 1024, 1024);
const marked = appendPngText(blank, 'Private input text', 'synthetic metadata for removal');
const card = (type, strength, prefer) => ({ type, strength, prefer_same_outfit: prefer, image_base64: marked.toString('base64') });

test('V5 Full High actual multipart: each ordered caption shares matching PNG, independent outfit flag and strength', async () => {
  const request = base();
  const { images, summary } = await attachV5Precise(request, [
    card('outfit', 4), card('character', 1, true), card('character&style', 0.25, false),
    { enabled: false, type: 'style' }, card('style', 2.75), card('character', 1, false), card('character&style', 1, true),
  ]);
  const parts = createNovelAiMultipartBody(request, { directorReferences: images });
  assert.deepEqual([...parts.keys()], ['director_ref_0','request']);
  const submitted = Buffer.from(await parts.get('director_ref_0').arrayBuffer());
  const { data, info } = await sharp(submitted).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [1024, 1024, 4]);
  assert.deepEqual(data, rgba);
  assert.ok(!submitted.includes(Buffer.from('synthetic metadata for removal')));
  assert.equal(parts.get('director_ref_0').type, 'image/png');
  const actual = JSON.parse(await parts.get('request').text()).parameters;
  assert.deepEqual(actual.director_reference_strength_values,[4,1,0.25,2.75,1,1]);
  assert.deepEqual(actual.director_reference_descriptions.map(x=>x.caption.base_caption),
    ['costume','character_mainoutfit','character&style_anyoutfit','style','character','character&style']);
  assert.deepEqual(actual.director_reference_secondary_strength_values,Array(6).fill(0));
  assert.deepEqual(actual.director_reference_information_extracted,Array(6).fill(1));
  assert.equal(actual.director_reference_images_cached.length,6);
  assert.ok(actual.director_reference_images_cached.every(x=>x.data==='director_ref_0' && /^[a-f0-9]{64}$/.test(x.cache_secret_key)));
  assert.ok(!JSON.stringify({request,summary}).includes('cache_secret_key'));
  assert.equal(summary.length,6);
});

test('held modes, invalid dimensions, types and toggle rejected; no effective reference leaves normal wire identical', async () => {
  const item=card('outfit',1);
  for (const request of [{...base(),action:'infill'}, {...base(),model:'nai-diffusion-5-full-medium'}, {...base(),action:'img2img'}]) {
    await assert.rejects(()=>attachV5Precise(request,[item]),/High Text to Image/);
  }
  for (const bad of [card('bogus',1),card('outfit',1,true),card('style',NaN),{...item,image_base64:encodeRgbaPng(Buffer.alloc(16),2,2).toString('base64')}]) {
    await assert.rejects(()=>attachV5Precise(base(),[bad]));
  }
  await assert.rejects(()=>attachV5Precise(base(), Array(17).fill(item)));
  const request=base(), before=JSON.stringify(request);
  const {images}=await attachV5Precise(request,[{enabled:false}]);
  assert.deepEqual(images,[]);
  assert.equal(await createNovelAiMultipartBody(request).get('request').text(),before);
  assert.deepEqual(v5ReferenceCrop(1024,1024),{width:1024,height:1024,resizeWidth:1024,resizeHeight:1024,left:0,top:0,unchanged:true});
  const wide=v5ReferenceCrop(4000,100);
  assert.deepEqual([wide.width,wide.height,wide.left,wide.top],[4096,256,3072,0]);
});

test('renderer entry point and its transitive JS imports are served by the real loopback allowlist', async t => {
  const profile=await mkdtemp(path.join(tmpdir(),'chaessi-renderer-'));
  const child=fork(new URL('../server.mjs',import.meta.url),[],{
    stdio:['ignore','ignore','ignore','ipc'], windowsHide:true,
    env:{SystemRoot:process.env.SystemRoot||'',CHAESSI_PRIVATE_TEST_PROFILE:profile,CHAESSI_ELECTRON_SERVER:'1',CHAESSI_USER_DATA_DIR:profile,PORT:'0'},
    execArgv:['--import','data:text/javascript,globalThis.fetch=()=>{throw new Error("No external requests permitted")}'],
  });
  const stopped=once(child,'exit');
  t.after(async()=>{if(child.connected)child.disconnect();await stopped;await rm(profile,{recursive:true,force:true});});
  const [ready]=await once(child,'message',{signal:AbortSignal.timeout(12000)});
  const root='http://127.0.0.1:'+ready.port;
  const queue=[new URL('/src/app.js',root).href],seen=new Set();
  for (const url of queue) {
    if(seen.has(url))continue;
    seen.add(url);
    const response=await fetch(url);
    assert.equal(response.status,200,new URL(url).pathname);
    const js=await response.text();
    for(const match of js.matchAll(/(?:import|export)\s+(?:[^;'"]+?\sfrom\s*)?["'](\.[^"']+\.js)["']/g)) {
      queue.push(new URL(match[1],url).href);
    }
  }
  for(const name of ['/src/services/vibe-cost.js','/src/services/vibe-import.js','/src/state/v5-reference-buckets.js'])assert.ok(seen.has(root+name));
  assert.equal((await fetch(root+'/src/services/reference-library.js')).status,404);
});
