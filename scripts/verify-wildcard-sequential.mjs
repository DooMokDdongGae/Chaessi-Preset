// Actual Electron UI, limited to the Wildcard dialog and its selection state.
import assert from 'node:assert/strict';import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';import net from 'node:net';import {once} from 'node:events';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {createWildcardStore} from '../src/services/wildcard-store.js';import {createDefaultPreset} from '../src/state/preset-schema.js';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url),{_electron}=require('playwright');
const folder=path.join(root,'.cache/wildcard-sequential-ui',String(Date.now()));await mkdir(folder,{recursive:true});
const store=createWildcardStore({rootDir:folder});
const legacy=await store.save({key:'ui_random',name:'Legacy random',entries:['red','green','blue']});
const legacyFile=path.join(folder,'data/wildcards',legacy.id,'wildcard.json');const legacyJson=JSON.parse(await readFile(legacyFile,'utf8'));delete legacyJson.selection_mode;await writeFile(legacyFile,JSON.stringify(legacyJson));const legacyBefore=await readFile(legacyFile);
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const base=`http://127.0.0.1:${port}`,errors=[],checks=[];let app,page,item;
const pass=text=>{checks.push(text);console.log('PASS '+text);};
async function request(route,body){const r=await fetch(base+route,body===undefined?undefined:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert(r.ok,JSON.stringify(j));return j;}
async function launch(){app=await _electron.launch({executablePath:require('electron'),args:['tests/electron-fixture.cjs'],cwd:root,env:{...process.env,PORT:String(port),NAI_ACCESS_TOKEN:'wildcard-test-only',NOVELAI_TOKEN:'',CHAESSI_TEST_PROVIDER_MODULE:new URL('../tests/mock-wildcard-sequential-provider.mjs',import.meta.url).href,CHAESSI_ELECTRON_TEST_DATA:folder},timeout:45000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>document.querySelector('#presetName')?.value.length>0,null,{timeout:25000});await page.locator('#uiLanguage').selectOption('en');}
async function openItem(id){await page.locator('#openWildcardsButton').click();await page.locator('#wildcardDialog').waitFor({state:'visible'});if(id)await page.locator(`#wildcardList [data-wildcard-id="${id}"]`).click();await page.waitForFunction(()=>!document.querySelector('#wildcardSave').disabled);}
async function close(){await page.locator('#wildcardClose').click();await page.locator('#wildcardDialog').waitFor({state:'hidden'});}
try{
 await launch();await openItem(legacy.id);assert.equal(await page.locator('#wildcardMode').inputValue(),'random');assert(await page.locator('#wildcardSequence').isHidden());pass('Legacy mode-less definition opens as Random');
 await page.locator('#wildcardNew').click();await page.locator('#wildcardName').fill('Sequence example');await page.locator('#wildcardKey').fill('ui_seq');await page.locator('#wildcardEntries').fill('alpha\nbeta\ngamma');assert.equal(await page.locator('#wildcardMode').inputValue(),'random');await page.locator('#wildcardMode').selectOption('sequential');await page.locator('#wildcardSave').click();await page.waitForFunction(()=>document.querySelector('#wildcardNext').textContent.includes('1 / 3: alpha'));item=(await request('/api/wildcards')).items.find(i=>i.key==='ui_seq');assert(item);pass('New definition defaults to Random; Sequential saves and displays next item');
 await page.locator('#wildcardSample').click();await page.waitForFunction(()=>document.querySelector('#wildcardStatus').textContent.includes('sequence unchanged'));assert.equal((await request('/api/wildcards/'+item.id)).wildcard.sequence.next_entry,'alpha');pass('Sample previews without consuming a position');
 await close();
 const preset=createDefaultPreset({params:{model:'nai-diffusion-5-full',width:64,height:64,seed:7},prompt_parts:{base:'__ui_seq__, __ui_seq__',characters:[{prompt:'__ui_seq__'}]}});
 const prepared=await request('/api/novelai/prepare',{preset});assert.equal(prepared.preset.prompt_parts.base,'alpha, alpha');await request('/api/novelai/generate',{prepared_id:prepared.prepared_id});await openItem(item.id);await page.waitForFunction(()=>document.querySelector('#wildcardNext').textContent.includes('2 / 3: beta'));pass('After mocked generation/History, reopening shows the next item');
 await page.locator('#wildcardMode').selectOption('random');await page.locator('#wildcardSave').click();await page.waitForFunction(()=>document.querySelector('#wildcardSequence').hidden);await page.locator('#wildcardMode').selectOption('sequential');await page.locator('#wildcardSave').click();await page.waitForFunction(()=>document.querySelector('#wildcardNext').textContent.includes('2 / 3: beta'));pass('Switching Random/Sequential retains the paused position');
 await close();await app.close();app=null;await launch();await openItem(item.id);await page.waitForFunction(()=>document.querySelector('#wildcardNext').textContent.includes('2 / 3: beta'));pass('Actual Electron restart restores the next position');
 for(const locale of ['ko','en','ja']){
  await close();await page.locator('#uiLanguage').selectOption(locale);await openItem(item.id);
  const labels={ko:['무작위','순차','처음부터','다음'],en:['Random','Sequential','Start from first','Next'],ja:['ランダム','順番','最初から','次は']}[locale];
  await page.waitForFunction(expected=>document.querySelector('#wildcardReset').textContent===expected,labels[2]);assert.deepEqual(await page.locator('#wildcardMode option').allTextContents(),labels.slice(0,2));assert((await page.locator('#wildcardNext').innerText()).startsWith(labels[3]));assert((await page.locator('#wildcardNext').innerText()).includes('beta'));
  await page.screenshot({path:path.join(folder,'wildcard-'+locale+'.png')});pass(locale+': mode, next item and reset UI');
 }
 await page.locator('#wildcardReset').click();await page.waitForFunction(()=>document.querySelector('#wildcardNext').textContent.includes('1 / 3: alpha'));assert.equal((await request('/api/wildcards/'+item.id)).wildcard.sequence.next_entry,'alpha');pass('Start from first resets without generation');
 assert.deepEqual(await readFile(legacyFile),legacyBefore);assert.deepEqual(errors,[]);
 const result={checks,errors,real_nai_generations:0,folder,scope:'Wildcard dialog and selection/History only',legacy_file_unchanged:true};await writeFile(path.join(folder,'results.json'),JSON.stringify(result,null,2));await writeFile(path.join(root,'.cache/wildcard-sequential-ui.latest.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:checks.length,folder}));
}finally{await app?.close();}
