import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createChaessiMcpServer, resolveDataRoot } from '../mcp/server.mjs';
import { createLibrary } from '../mcp/library.mjs';
import { createGenerationStore } from '../src/services/generation-store.js';
import { createDefaultPreset } from '../src/state/preset-schema.js';
import { buildGeneratePayload } from '../src/adapters/novelai-v45-full.js';
import { buildModeGeneratePayload } from '../src/adapters/novelai-v45-generation-modes.js';
import { resolveGenerationPrompts } from '../src/services/generation-prompt-resolver.js';
import { sortPresets as uiSort } from '../src/ui/preset-sorting.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
// Assemble a synthetic token format to exercise leak prevention; this is not a credential.
const secret = 'pst-' + 'do-not-return-fixture-secret';
async function put(root, relative, value) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value);
}
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'chaessi-mcp-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const presets = [];
  for (let i = 0; i < 104; i++) {
    const item = { id: `c_${i}`, name: i === 0 ? '가방' : i === 1 ? '나무' : `의상 ${i}`, category: i < 91 ? '분류 하나' : '분류 둘',
      subCategory: i % 2 ? '하위 하나' : '하위 둘', prompt: `shirt ${i}`, undesired: 'blurry',
      created_at: new Date(1700000000000 + i * 1000).toISOString(), updated_at: new Date(1800000000000 - i * 1000).toISOString(),
      access_token: secret, imported_metadata: { secret },
    };
    presets.push(item);
    await put(root, `data/character-presets/${item.id}/character-preset.json`, item);
  }
  await put(root, 'data/character-preset-categories/categories.json', { schema: 'chaessi-character-preset-categories/v1', categories: [{name:'빈 사용자 분류',subcategories:['빈 하위']}] });
  await put(root, 'data/character-presets/broken/character-preset.json', '{unfinished');
  await put(root, 'data/base-prompts/b/base-prompt.json', { id:'b', name:'Base', prompt:'__tops__', access_token:secret });
  await put(root, 'data/undesired-prompts/n/undesired-prompt.json', {id:'n', name:'Negative', undesired:'blurry'});
  await put(root, 'data/params-presets/s/params-preset.json', {id:'s', name:'Settings', params:{model:'nai-diffusion-4-5-full',width:832,height:1216,access_token:secret}});
  const preset = createDefaultPreset({ metadata:{id:'p',name:'Overall'}, prompt_parts:{base:'blue shirt',characters:[{name:'Actor',prompt:'red ribbon',undesired:'blurry'}]} });
  await put(root, 'data/presets/p/preset.json', {...preset, sources:{imported_raw_payload:{access_token:secret}}});
  const store = createGenerationStore({rootDir:root});
  const payload = buildGeneratePayload(preset);
  for (const [id, created_at] of [['older','2026-10-09T01:00:00Z'],['newer','2026-10-10T01:00:00Z']]) {
    await store.saveGeneration({preset,payload,imageBytes:png,responseInfo:{generation_id:id,created_at}});
  }
  const sidecarPath = 'data/generations/2026-10-09/older.json';
  const sidecar = JSON.parse(await readFile(path.join(root,sidecarPath),'utf8'));
  sidecar.raw_payload.access_token = secret;
  sidecar.internal_preset.sources = {secret};
  await put(root, sidecarPath, sidecar);
  await put(root, '.env', `NAI_ACCESS_TOKEN=${secret}`);
  await put(root, 'data/secrets/credentials.json', {access_token:secret});
  return {root, presets, sidecarPath, preset};
}
async function connect(t, root, stdio = false) {
  const client = new Client({name:'chaessi-mcp-test',version:'1.0.0'});
  let transport, server;
  if (stdio) {
    transport = new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../mcp/server.mjs',import.meta.url)),'--data-root',root],stderr:'pipe'});
  } else {
    const pair = InMemoryTransport.createLinkedPair();
    server = createChaessiMcpServer({rootDir:root});
    await server.connect(pair[0]); transport = pair[1];
  }
  await client.connect(transport);
  t.after(async () => {await client.close(); if (server) await server.close();});
  return client;
}
async function call(client,name,args={}) {
  const result = await client.callTool({name,arguments:args});
  assert.ok(!result.isError, JSON.stringify(result.content));
  return result.structuredContent || JSON.parse(result.content.find(c=>c.type==='text').text);
}
async function diskHash(root) {
  const all = [];
  async function walk(dir) {
    for (const e of await readdir(dir,{withFileTypes:true})) {
      const target=path.join(dir,e.name);
      if (e.isDirectory()) await walk(target);
      else if (e.isFile()) all.push([path.relative(root,target),createHash('sha256').update(await readFile(target)).digest('hex')]);
    }
  }
  await walk(root); return all.sort((a,b)=>a[0].localeCompare(b[0]));
}

test('MCP protocol exposes exactly seven read-only tools over real stdio, without generation/deletion', async t => {
  const {root}=await fixture(t), before=await diskHash(root);
  const client=await connect(t,root,true);
  const tools=(await client.listTools()).tools;
  assert.deepEqual(tools.map(x=>x.name).sort(),['get_status','list_categories','list_presets','get_preset','list_history','get_history','get_history_image'].sort());
  assert.ok(tools.every(x=>x.annotations.readOnlyHint && !x.annotations.destructiveHint));
  assert.equal((await call(client,'get_status')).data_available,true);
  assert.equal((await call(client,'list_presets',{limit:100})).total,104);
  assert.equal((await call(client,'list_history')).items[0].id,'older');
  const result=await client.callTool({name:'get_history_image',arguments:{id:'older'}});
  assert.deepEqual(Buffer.from(result.content.find(x=>x.type==='image').data,'base64'),png);
  assert.deepEqual(await diskHash(root),before);
});

test('arbitrary and multiple categories, subcategories, search and app-identical sorts',async t=>{
  const {root,presets}=await fixture(t), client=await connect(t,root);
  const categories=await call(client,'list_categories');
  assert.equal(categories.items.find(x=>x.name==='분류 하나').preset_count,91);
  assert.ok(categories.items.some(x=>x.name==='분류 둘'));
  assert.ok(categories.items.some(x=>x.name==='빈 사용자 분류' && x.subcategories[0].name==='빈 하위'));
  const single=await call(client,'list_presets',{filters:[{category:'분류 둘'}]});
  assert.equal(single.total,13);
  const union=await call(client,'list_presets',{filters:[{category:'분류 둘'},{category:'분류 하나',subcategory:'하위 하나'}],limit:100});
  assert.equal(union.total,13+45);
  assert.equal((await call(client,'list_presets',{query:'가방'})).items[0].prompt,'shirt 0');
  for (const locale of ['ko','en','ja']) for (const sort of ['name-asc','name-desc','created-asc','created-desc','updated-asc','updated-desc']) {
    const result=await call(client,'list_presets',{filters:[{category:'분류 둘'}],locale,sort});
    assert.deepEqual(result.items.map(x=>x.id),uiSort(presets.filter(x=>x.category==='분류 둘'),sort,locale).map(x=>x.id));
  }
});

test('pagination contains all 104 records once and detects mutations',async t=>{
  const {root}=await fixture(t), client=await connect(t,root);
  const first=await call(client,'list_presets',{limit:100});
  assert.equal(first.skipped_count,1);
  const second=await call(client,'list_presets',{offset:first.next_offset,expected_snapshot:first.snapshot});
  assert.equal(second.items[0].ordinal,101);
  assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,104);
  await put(root,'data/character-presets/c_0/character-preset.json',{id:'c_0',name:'바뀐 이름',prompt:'new'});
  const changed=await client.callTool({name:'list_presets',arguments:{offset:100,expected_snapshot:first.snapshot}});
  assert.equal(changed.isError,true); assert.match(changed.content[0].text,/snapshot_changed/);
});

test('History order is explicit and final transmitted prompts are separate from current definitions',async t=>{
  const {root,sidecarPath}=await fixture(t), client=await connect(t,root);
  const first=await call(client,'list_history');
  assert.deepEqual(first.items.map(x=>x.id),['older','newer']);
  assert.deepEqual((await call(client,'list_history',{order:'newest-first'})).items.map(x=>x.id),['newer','older']);
  const actual=await call(client,'get_history',{id:'older'});
  assert.match(actual.final_prompt,/blue shirt/);
  assert.equal(actual.final_characters[0].prompt,'red ribbon');
  assert.ok(!JSON.stringify(actual).includes(secret));
  assert.match(actual.association,/not reliably recorded/);
  const sidecar=JSON.parse(await readFile(path.join(root,sidecarPath),'utf8'));
  sidecar.generation.prompt='updated final prompt'; await put(root,sidecarPath,sidecar);
  const changed=await client.callTool({name:'list_history',arguments:{expected_snapshot:first.snapshot}});
  assert.equal(changed.isError,true);
  assert.equal((await call(client,'get_history',{id:'older'})).final_prompt,'updated final prompt');
});

test('all prompt preset kinds are projected without secret/imported fields',async t=>{
  const {root}=await fixture(t), client=await connect(t,root);
  for (const [kind,id] of [['character','c_1'],['base','b'],['negative','n'],['full','p'],['settings','s']]) {
    const result=await call(client,'get_preset',{kind,id});
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.ok(!JSON.stringify(result).includes('sources'));
  }
  assert.equal((await call(client,'get_preset',{kind:'base',id:'b'})).prompt,'__tops__');
  await put(root,'data/character-presets/leak/character-preset.json',{id:'leak',name:'Leak',prompt:secret});
  const denied=await client.callTool({name:'get_preset',arguments:{id:'leak'}});
  assert.equal(denied.isError,true); assert.match(denied.content[0].text,/secret_leak_prevented/); assert.ok(!denied.content[0].text.includes(secret));
});

test('V4.5 and V5 T2I/I2I/Inpaint saved records expose resolved Wildcard/random prompts and original images', async t=>{
  const {root}=await fixture(t), client=await connect(t,root), store=createGenerationStore({rootDir:root});
  for (const [modelIndex,model] of ['nai-diffusion-4-5-full','nai-diffusion-5-full'].entries()) {
    for (const [modeIndex,mode] of ['text-to-image','image-to-image','inpaint'].entries()) {
      const preset=createDefaultPreset({params:{model},prompt_parts:{base:'__tops__, ||indoors|outdoors||',characters:[{prompt:'__ribbons__',undesired:'__bad__'}]}});
      const resolved=resolveGenerationPrompts(preset,[{key:'tops',entries:['blue shirt']},{key:'ribbons',entries:['red ribbon']},{key:'bad',entries:['blurry']}],()=>0);
      const modeState={mode,width:64,height:64,source_image_base64:png.toString('base64'),mask_image_base64:png.toString('base64'),strength:0.5,noise:0};
      const payload=buildModeGeneratePayload(resolved,modeState), id=`model_${modelIndex}_mode_${modeIndex}`;
      await store.saveGeneration({preset:resolved,payload,imageBytes:png,mode,modeSettings:modeState,sourceAssets:mode==='text-to-image'?{}:{sourceBytes:png,maskBytes:png},responseInfo:{generation_id:id}});
      const read=await call(client,'get_history',{id});
      assert.equal(read.final_prompt,payload.input);
      assert.match(read.final_characters[0].prompt,/red ribbon/);
      assert.match(read.final_characters[0].negative_prompt,/blurry/);
      assert.equal(read.mode,mode);
      assert.ok(!JSON.stringify(read).includes('__tops__'));
      assert.ok(!JSON.stringify(read).includes('||'));
      assert.ok(!JSON.stringify(read).includes('source_image'));
      const image=await client.callTool({name:'get_history_image',arguments:{id}});
      assert.deepEqual(Buffer.from(image.content.find(x=>x.type==='image').data,'base64'),png);
    }
  }
});

test('large images use the original local path instead of an oversized protocol message',async t=>{
  const {root}=await fixture(t), client=await connect(t,root);
  const large=Buffer.alloc(6*1024*1024+1); png.copy(large);
  await put(root,'data/generations/2026-10-09/older.png',large);
  assert.equal((await call(client,'get_history',{id:'older'})).image_available,true);
  const image=await client.callTool({name:'get_history_image',arguments:{id:'older'}});
  assert.equal(image.isError,true); assert.match(image.content[0].text,/image_too_large/);
});

test('invalid arguments and ids cannot select credentials or arbitrary paths',async t=>{
  const {root}=await fixture(t), client=await connect(t,root);
  for (const args of [{id:'../secrets'},{id:'C:\\credentials'},{id:'older',kind:'secrets'}]) {
    const result=await client.callTool({name:'get_preset',arguments:args}); assert.equal(result.isError,true);
  }
  for (const limit of [0,101,-1]) {
    assert.equal((await client.callTool({name:'list_history',arguments:{limit}})).isError,true);
  }
  assert.equal((await client.callTool({name:'get_history',arguments:{id:'missing'}})).isError,true);
});

test('junctions and sidecar path traversal cannot escape allowed sections',async t=>{
  const {root,sidecarPath}=await fixture(t), library=createLibrary({rootDir:root});
  const outside=path.join(root,'outside'); await put(outside,'character-preset.json',{id:'linked',name:'Outside',prompt:secret});
  await symlink(outside,path.join(root,'data/character-presets/linked'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(library.getPreset({id:'linked'}),e=>e.code==='invalid_path');
  const sidecar=JSON.parse(await readFile(path.join(root,sidecarPath),'utf8'));
  sidecar.output.image_filename='data/generations/../../.env'; await put(root,sidecarPath,sidecar);
  await assert.rejects(library.getHistoryImage({id:'older'}));
  const list=await library.listHistory(); assert.equal(list.skipped_count,1);
});

test('missing image and missing data root are reported without creating or changing files',async t=>{
  const {root}=await fixture(t), library=createLibrary({rootDir:root});
  await rm(path.join(root,'data/generations/2026-10-09/older.png'));
  assert.equal((await library.getHistory({id:'older'})).image_available,false);
  await assert.rejects(library.getHistoryImage({id:'older'}),e=>e.code==='not_found');
  const empty=path.join(root,'not-created'), missing=createLibrary({rootDir:empty});
  assert.equal((await missing.status()).data_available,false);
  await assert.rejects(missing.listHistory(),e=>e.code==='data_unavailable');
  await assert.rejects(readFile(path.join(empty,'data/generations')));
});

test('data-root selection is explicit, validated and never depends on working directory',()=>{
  const absolute=path.resolve('fixture');
  assert.equal(resolveDataRoot(['--data-root',absolute],{CHAESSI_USER_DATA_DIR:path.resolve('other')}),absolute);
  assert.equal(resolveDataRoot([],{CHAESSI_USER_DATA_DIR:absolute}),absolute);
  assert.equal(resolveDataRoot([],{APPDATA:absolute}),path.join(absolute,'Chaessi Preset'));
  assert.throws(()=>resolveDataRoot(['--data-root','relative'],{}));
  assert.throws(()=>resolveDataRoot([],{CHAESSI_USER_DATA_DIR:'relative'}));
  assert.throws(()=>resolveDataRoot([],{}));
});
