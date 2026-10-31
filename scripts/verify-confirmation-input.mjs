// Focused confirmation behavior tests; native Windows typing is recorded in
// --manual mode by an operator/computer-use, never simulated as proof here.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {freePort} from './portable-test-utils.mjs';
import {encodeRgbPng} from '../src/services/generation-image-utils.js';
import {initialComposition} from '../src/image-tools/composition-geometry.js';
import {createDefaultPreset} from '../src/state/preset-schema.js';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const {_electron}=require('playwright'),folder=path.join(root,'.cache/confirmation-input',String(Date.now()));
await fs.mkdir(folder,{recursive:true});
const source=path.join(folder,'source.png');await fs.writeFile(source,encodeRgbPng(Buffer.alloc(256*256*3,135),256,256));
const port=await freePort(),checks=[],errors=[],requests=[],nativeDialogs=[];
let app,page,savedGeneration;
const pass=name=>{checks.push(name);console.log('PASS '+name);};
const count=()=>requests.filter(x=>x.endsWith('/generate')).length;
async function idle(){await page.waitForFunction(()=>!document.querySelector('#generateButton').disabled);}
async function openCost(){await page.locator('#generateButton').click();await page.locator('#actionConfirmDialog').waitFor();}
async function dismiss(outcome){if(outcome==='escape')await page.keyboard.press('Escape');else await page.locator('#actionConfirm'+outcome).click();await page.locator('#actionConfirmDialog').waitFor({state:'detached'});}
async function size(n){await page.locator('#paramWidth').fill(String(n));await page.locator('#paramHeight').fill(String(n));await page.locator('#paramHeight').dispatchEvent('change');}
async function snapshot(){return page.evaluate(()=>({at:Date.now(),active:document.activeElement?.id,open:[...document.querySelectorAll('dialog[open]')].map(x=>x.id),base:document.querySelector('#basePrompt').value,characters:[...document.querySelectorAll('#characterCards textarea[data-character-field="prompt"]')].map(x=>x.value),effort:document.querySelector('#paramEffort').value,search:document.querySelector('#characterPresetSearch')?.value,status:document.querySelector('#generateStatus').textContent,events:globalThis.__nativeInputEvents||[]}));}
try {
  app=await _electron.launch({executablePath:require('electron'),args:['tests/electron-fixture.cjs'],cwd:root,env:{...process.env,PORT:String(port),NODE_OPTIONS:'',NAI_ACCESS_TOKEN:'confirmation-test-only',NOVELAI_TOKEN:'',CHAESSI_ELECTRON_TEST_DATA:folder,CHAESSI_TEST_PROVIDER_MODULE:new URL('../tests/mock-confirmation-provider.mjs',import.meta.url).href},timeout:60000});
  page=await app.firstWindow();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>{
    // Preserve the app's existing exit protection; allow our own test window
    // to close during cleanup. A native confirm/alert is always a test failure.
    if(d.type()==='beforeunload') { void d.accept().catch(()=>{}); return; }
    nativeDialogs.push({type:d.type(),message:d.message()});void d.dismiss().catch(()=>{});
  });
  page.on('request',r=>{if(/\/api\/novelai\/(prepare|generate)$/.test(r.url()))requests.push(new URL(r.url()).pathname);});
  await page.context().route('https://**/*',route=>route.abort());
  await page.waitForFunction(()=>document.querySelector('#presetName')?.value);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1400,1000));
  await page.locator('#uiLanguage').selectOption('en');
  await page.locator('#paramModel').selectOption('nai-diffusion-5-full');
  await page.locator('#basePrompt').fill('confirmation test, adult, garden');
  if(!await page.locator('#characterCards textarea[data-character-field="prompt"]').count())await page.locator('#addCharacterButton').click();
  await page.locator('#characterCards textarea[data-character-field="prompt"]').first().fill('adult, white shirt');
  await size(1024);await page.locator('#generateButton').click();await idle();
  assert.equal(count(),1);assert.equal(await page.locator('#actionConfirmDialog').count(),0);pass('1024x1024: no extra confirmation; one mocked generation saved');
  await size(1472);
  for(const outcome of ['Cancel','escape','Close']) {
    const before=requests.length;await openCost();
    assert.match(await page.locator('#actionConfirmMessage').innerText(),/1472 × 1472/);
    await dismiss(outcome);await idle();assert.equal(requests.length,before);
    pass('1472x1472 '+outcome+': no prepare or generation request');
  }
  const before=count();await openCost();
  // Duplicate activation while pending cannot start another request.
  await page.evaluate(()=>{document.querySelector('#generateButton').click();});
  assert.equal(await page.locator('#actionConfirmDialog').count(),1);
  const savedResponse=page.waitForResponse(r=>r.url().endsWith('/api/novelai/generate'));
  await dismiss('Accept');savedGeneration=(await (await savedResponse).json()).generation;await idle();assert.equal(count(),before+1);pass('1472x1472 approval: exactly one mocked request despite duplicate activation');
  assert((await fs.readFile(path.join(folder,'mock-generations.jsonl'),'utf8')).trim().split('\n').length===2);
  pass('Mock provider received exactly two requests; external network blocked');

  for(const locale of ['ko','en','ja']) {
    await page.locator('#uiLanguage').selectOption(locale);await openCost();
    const labels={ko:['작업 확인','취소','계속','닫기'],en:['Confirm action','Cancel','Continue','Close'],ja:['操作の確認','キャンセル','続行','閉じる']}[locale];
    assert.deepEqual(await Promise.all(['Title','Cancel','Accept','Close'].map(id=>page.locator('#actionConfirm'+id).innerText())),labels);
    await dismiss('Cancel');await idle();pass(locale+': confirmation labels and localized cost message');
  }
  await page.locator('#uiLanguage').selectOption('en');
  // Direct helper checks exercise rejection/focus handling without changing data.
  await page.locator('#basePrompt').focus();
  await page.evaluate(async()=>{const {confirmAction}=await import('/src/ui/confirmation.js');const input=document.querySelector('#basePrompt');input.setSelectionRange(2,7);globalThis.__confirmResult=null;globalThis.__first=confirmAction('Focus restoration test').then(x=>__confirmResult=x);globalThis.__second=await confirmAction('Duplicate must decline');});
  assert.equal(await page.evaluate(()=>__second),false);assert.equal(await page.locator('#actionConfirmDialog').count(),1);await dismiss('Cancel');
  await page.waitForFunction(()=>document.activeElement?.id==='basePrompt' && document.activeElement.selectionStart===2 && document.activeElement.selectionEnd===7);
  assert.deepEqual(await page.locator('#basePrompt').evaluate(x=>[x.selectionStart,x.selectionEnd]),[2,7]);assert.equal(await page.evaluate(()=>__confirmResult),false);pass('Duplicate dialog declines; cancel restores original input selection');
  await page.evaluate(async()=>{const {confirmAction}=await import('/src/ui/confirmation.js');globalThis.__confirmResult=null;void confirmAction('Programmatic close cannot approve').then(x=>__confirmResult=x);});
  await page.evaluate(()=>document.querySelector('#actionConfirmDialog').close('approve'));await page.waitForFunction(()=>__confirmResult!==null);assert.equal(await page.evaluate(()=>__confirmResult),false);pass('Programmatic close returnValue cannot grant approval');

  await page.locator('#openWildcardsButton').click();await page.locator('#wildcardEntries').fill('unsaved first\nunsaved second');
  for(const outcome of ['Cancel','escape','Close']) {
    await page.locator('#wildcardClose').click();await page.locator('#actionConfirmDialog').waitFor();await dismiss(outcome);
    await page.waitForFunction(()=>!document.querySelector('#wildcardClose').disabled);
    assert.equal(await page.locator('#wildcardEntries').inputValue(),'unsaved first\nunsaved second');assert(await page.locator('#wildcardDialog').isVisible());pass('Wildcard discard '+outcome+': draft preserved');
  }
  await page.keyboard.press('Escape');await page.locator('#actionConfirmDialog').waitFor();await dismiss('Cancel');assert(await page.locator('#wildcardDialog').isVisible());pass('Wildcard parent ESC waits for approval and retains unsaved changes');
  await page.locator('#wildcardClose').click();await dismiss('Accept');await page.locator('#wildcardDialog').waitFor({state:'hidden'});pass('Wildcard discard approval closes the editor');

  await page.locator('#openImageTools').click();await page.locator('#toolFile').setInputFiles(source);await page.waitForFunction(()=>document.querySelector('#toolCanvas').width===256);
  await page.locator('#toolKind').selectOption('canvas');await page.locator('#toolCanvasWidth').fill('264');await page.locator('#toolResize').click();
  for(const outcome of ['Cancel','escape','Close']) {
    await page.locator('#toolClose').click();await page.locator('#actionConfirmDialog').waitFor();await dismiss(outcome);
    assert.equal(await page.locator('#toolCanvas').evaluate(x=>x.width),264);assert(await page.locator('#imageToolsDialog').isVisible());pass('Canvas discard '+outcome+': edited pixels/dimensions preserved');
  }
  await page.locator('#toolComposition').click();await page.waitForFunction(()=>document.querySelector('#compositionPrompt').value);
  await page.locator('#compositionPrompt').fill('unsaved composition text');await page.locator('#compositionPrompt').dispatchEvent('change');
  await page.locator('#compositionClose').click();
  for(const outcome of ['Cancel','escape','Close']) {
    await page.locator('#toolComposition').click();await page.locator('#actionConfirmDialog').waitFor();await dismiss(outcome);
    assert.equal(await page.locator('#compositionPrompt').inputValue(),'unsaved composition text');pass('Composition replace '+outcome+': session preserved');
  }
  await page.locator('#toolComposition').click();await dismiss('Accept');await page.locator('#compositionDialog').waitFor();assert.notEqual(await page.locator('#compositionPrompt').inputValue(),'unsaved composition text');pass('Composition replace approval loads selected source');
  const sessionFile=path.join(folder,'session.json'),originalSessionPrompt='Imported confirmation session';
  await fs.writeFile(sessionFile,JSON.stringify({schema:'chaessi.composition-draft.v1',source_png:(await fs.readFile(source)).toString('base64'),recipe:initialComposition(256,256),preset:createDefaultPreset({params:{model:'nai-diffusion-5-full'},prompt_parts:{base:originalSessionPrompt}})}));
  await page.locator('#compositionPrompt').fill('retain dirty import draft');await page.locator('#compositionPrompt').dispatchEvent('change');
  for(const outcome of ['Cancel','escape','Close']) {
    await page.locator('#compositionDraftFile').setInputFiles(sessionFile);await page.locator('#actionConfirmDialog').waitFor();await dismiss(outcome);
    await page.waitForFunction(()=>!document.querySelector('#compositionClose').disabled);
    assert.equal(await page.locator('#compositionPrompt').inputValue(),'retain dirty import draft');pass('Composition session import '+outcome+': draft preserved and controls unlocked');
  }
  await page.locator('#compositionDraftFile').setInputFiles(sessionFile);await dismiss('Accept');
  await page.waitForFunction(expected=>document.querySelector('#compositionPrompt').value===expected,originalSessionPrompt);pass('Composition session import approval restores the selected session');
  // Only the result presentation is stubbed here, to exercise the third
  // replacement guard without running unrelated image tools or their tests.
  const preview=(await fs.readFile(source)).toString('base64');
  await page.route('**/api/image-tools/prepare',route=>route.fulfill({json:{prepared_id:'confirmation-only',plan:{preview:Object.fromEntries(['source','mask','apply'].map(key=>[key,{png:preview}])),prompt_preview:'confirmation fixture',cost:{anlas:0},request_size:{width:256,height:256}}}}));
  await page.route('**/api/image-tools/run',route=>route.fulfill({json:{generation:savedGeneration,operation:{tool:'composition',actual_output_size:{width:1472,height:1472},selected_variant:0,actual_anlas:0,estimated_cost:{kind:'local'}}}}));
  await page.locator('#compositionReview').click();await page.waitForFunction(()=>!document.querySelector('#compositionRun').disabled);await page.locator('#compositionRun').click();await page.waitForFunction(()=>!document.querySelector('#compositionClose').disabled);await page.locator('#compositionResult').waitFor();
  await page.locator('#compositionPrompt').fill('retain dirty adopt draft');await page.locator('#compositionPrompt').dispatchEvent('change');
  let adoptLoads=0;page.on('request',r=>{if(r.method()==='GET'&&new URL(r.url()).pathname==='/api/generations/'+savedGeneration.id)adoptLoads++;});
  for(const outcome of ['Cancel','escape','Close']) {
    await page.locator('#compositionAdopt').click();await page.locator('#actionConfirmDialog').waitFor();await dismiss(outcome);
    assert.equal(adoptLoads,0);assert.equal(await page.locator('#compositionPrompt').inputValue(),'retain dirty adopt draft');pass('Composition result adoption '+outcome+': no source load or draft loss');
  }
  await page.locator('#compositionAdopt').click();await dismiss('Accept');await page.waitForFunction(()=>document.querySelector('#compositionPrompt').value!=='retain dirty adopt draft');assert.equal(adoptLoads,1);pass('Composition result adoption approval loads exactly once');
  await page.unroute('**/api/image-tools/prepare');await page.unroute('**/api/image-tools/run');
  await page.locator('#compositionClose').click();
  await page.locator('#toolClose').click();await dismiss('Accept');await page.locator('#imageToolsDialog').waitFor({state:'hidden'});pass('Canvas discard approval closes editor');
  assert.deepEqual(nativeDialogs,[]);assert.deepEqual(errors,[]);pass('No native JavaScript dialogs or renderer errors in focused paths');
  await fs.writeFile(path.join(folder,'results.json'),JSON.stringify({checks,errors,nativeDialogs,requests,real_nai_generations:0},null,2));
  console.log(JSON.stringify({checks:checks.length,folder}));
  if(process.argv.includes('--manual')) {
    await page.evaluate(()=>{document.title='CHAESSI PRIVATE INPUT FIX TEST';globalThis.__nativeInputEvents=[];for(const type of ['keydown','keypress','beforeinput','input','change','focusin'])document.addEventListener(type,e=>{__nativeInputEvents.push({at:Date.now(),type,id:e.target.id,field:e.target.dataset?.characterField,key:e.key,data:e.data,trusted:e.isTrusted,value:e.target.value});if(__nativeInputEvents.length>4000)__nativeInputEvents.shift();},true);});
    await fs.writeFile(path.join(root,'.cache/confirmation-input/active.json'),JSON.stringify({folder,port,title:'CHAESSI PRIVATE INPUT FIX TEST'},null,2));
    console.log('READY native Windows verification');
    while(!await fs.access(path.join(folder,'stop')).then(()=>true).catch(()=>false)) {
      await fs.writeFile(path.join(folder,'native-events.json'),JSON.stringify({...await snapshot(),requests},null,2));
      await new Promise(r=>setTimeout(r,500));
    }
  }
} catch(error) {
  console.error(error);if(page)await page.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});
  await fs.writeFile(path.join(folder,'failure.json'),JSON.stringify({error:error.stack,checks,requests,errors,nativeDialogs},null,2));process.exitCode=1;
} finally {
  if(app) {
    // Dirty editors intentionally retain their existing beforeunload protection.
    // Permit unloading only this disposable fixture while cleaning it up.
    await app.evaluate(({BrowserWindow})=>{for(const window of BrowserWindow.getAllWindows())window.webContents.on('will-prevent-unload',event=>event.preventDefault());}).catch(()=>{});
    await app.close();
  }
}
