// Real Electron windows; isolated data, deterministic synthetic art, mocked NAI.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import net from 'node:net';
import {once} from 'node:events';
import sharp from 'sharp';
import {scaleNearest} from '../src/image-tools/pixel-snap-core.js';
import {RESOLUTION_PRESETS} from '../src/state/resolutions.js';
const root=fileURLToPath(new URL('../',import.meta.url)),folder=path.join(root,'.cache','pixel-resolution-ui',`run-${Date.now()}`);await mkdir(folder,{recursive:true});
const trace=path.join(folder,'provider.jsonl');await writeFile(trace,'');
const raw=new Uint8ClampedArray(48*48*4);
for(let y=0;y<48;y++)for(let x=0;x<48;x++){
  let c=[0,0,0,0];if(x>=6&&x<=41&&y>=6&&y<=41)c=[52,39,82,255];if(x>=9&&x<=38&&y>=9&&y<=38)c=[179,129,232,255];if((x>=15&&x<=19||x>=28&&x<=32)&&y>=18&&y<=25)c=[20,20,35,255];if(x===16&&y===19||x===29&&y===19)c=[255,255,255,255];if(x>=21&&x<=26&&y>=30&&y<=32)c=[238,170,193,255];if(x>=4&&x<=43&&y===42)c=[110,80,160,128];raw.set(c,(y*48+x)*4);
}
const scaled=scaleNearest({data:raw,width:48,height:48},6),sourcePath=path.join(folder,'pixel-art.png'),largePath=path.join(folder,'large.png');
await writeFile(sourcePath,await sharp(Buffer.from(scaled.data),{raw:{width:scaled.width,height:scaled.height,channels:4}}).png().toBuffer());
await sharp({create:{width:4096,height:4096,channels:4,background:'#9966aa'}}).png().toFile(largePath);
const require=createRequire(import.meta.url),{_electron}=require(process.env.CHAESSI_PLAYWRIGHT||'playwright');
const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
let app,page;const checks=[],errors=[],pass=text=>{checks.push(text);console.log('PASS '+text);};
const click=id=>page.locator(id).click(),traceLines=async()=>(await readFile(trace,'utf8')).trim().split('\n').filter(Boolean);
async function preview(){await click('#pixelPreview');await page.waitForFunction(()=>!document.querySelector('#pixelSave').disabled,{},{timeout:20000});}
async function dimensions(){return [Number(await page.locator('#paramWidth').inputValue()),Number(await page.locator('#paramHeight').inputValue())];}
try{
  app=await _electron.launch({executablePath:process.env.CHAESSI_ELECTRON||require('electron'),args:['tests/electron-fixture.cjs'],cwd:root,env:{...process.env,PORT:String(port),NAI_ACCESS_TOKEN:'test-local-only',NOVELAI_TOKEN:'',CHAESSI_PROVIDER_TRACE:trace,CHAESSI_ELECTRON_TEST_DATA:folder,CHAESSI_TEST_PROVIDER_MODULE:new URL('../tests/mock-pixel-resolution-provider.mjs',import.meta.url).href}});
  page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.waitForFunction(()=>document.querySelector('#presetName')?.value);await page.locator('#uiLanguage').selectOption('ko');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1000));
  await page.locator('#basePrompt').fill('pixel art, geometric purple square');
  const originalSize=await dimensions();await click('#resolutionPicker');await page.locator('[data-resolution-category="Large"]').click();await click('#resolutionClose');assert.deepEqual(await dimensions(),originalSize);pass('Resolution cancel preserves original Width/Height');
  for(const [category,shapes]of Object.entries(RESOLUTION_PRESETS))for(const [orientation,size]of Object.entries(shapes)){
    await click('#resolutionPicker');await page.locator(`[data-resolution-category="${category}"]`).click();await page.locator(`[data-resolution-shape="${orientation}"]`).click();assert.equal(await page.locator('#resolutionSelected').textContent(),size.join(' × ')+' px');await click('#resolutionApply');assert.deepEqual(await dimensions(),size);
  }
  pass('All 11 official presets apply exact visible sizes');
  await click('#resolutionPicker');assert.equal(await page.locator('[data-resolution-shape="Square"]').isDisabled(),true);await page.locator('[data-resolution-category="Custom"]').click();await page.locator('#resolutionWidth').fill('1000');assert.equal(await page.locator('#resolutionApply').isDisabled(),true);await page.locator('#resolutionWidth').fill('1152');await page.locator('#resolutionHeight').fill('768');await click('#resolutionApply');assert.match(await page.locator('#resolutionPicker').textContent(),/직접 입력/);pass('Wallpaper square is unavailable; invalid Custom cannot apply');
  await click('#resolutionPicker');await page.locator('[data-resolution-category="Normal"]').click();await page.locator('[data-resolution-shape="Square"]').click();await page.locator('[data-resolution-category="Wallpaper"]').click();assert.equal(await page.locator('#resolutionApply').isDisabled(),true);await page.locator('[data-resolution-shape="Landscape"]').click();await page.screenshot({path:path.join(folder,'01-resolution-ko.png')});await click('#resolutionApply');
  await page.locator('#paramEffort').selectOption('medium');assert.deepEqual(await dimensions(),[1920,1088]);await page.locator('#paramEffort').selectOption('high');assert.deepEqual(await dimensions(),[1920,1088]);pass('High/Medium switches preserve shared dimensions');
  // An explicit cost dialog can cancel before any generation request.
  page.removeAllListeners('dialog');page.once('dialog',d=>{assert.match(d.message(),/1920 × 1088/);return d.dismiss();});const beforeCancel=(await traceLines()).length;await click('#generateButton');await page.waitForFunction(()=>!document.querySelector('#generateButton').disabled);assert.equal((await traceLines()).length,beforeCancel);page.on('dialog',d=>d.accept());pass('Canceling large-image cost confirmation sends no provider request');
  for(const effort of ['high','medium']){
    await page.locator('#paramEffort').selectOption(effort);const pending=page.waitForResponse(r=>r.url().endsWith('/api/novelai/generate'));await click('#generateButton');const response=await pending;assert.equal(response.status(),200,await response.text());await page.waitForFunction(()=>!document.querySelector('#generateButton').disabled);
    const sent=(await traceLines()).map(JSON.parse).filter(r=>r.dimensions).at(-1).dimensions;assert.equal(sent.width,1920);assert.equal(sent.height,1088);assert.equal(sent.model,'nai-diffusion-5-full'+(effort==='medium'?'-medium':''));
    const value=await response.json(),info=await page.request.get('http://127.0.0.1:'+port+'/api/generations/'+value.generation.id);const item=(await info.json()).generation;assert.equal(item.generation.width,1920);assert.equal(item.generation.height,1088);
  }
  pass('High and Medium generate exact Wallpaper payloads and History sizes (mock provider)');
  await click('#openImageTools');await click('#toolPixelSnap');await page.locator('#pixelFile').setInputFiles(sourcePath);await page.waitForFunction(()=>document.querySelector('#pixelOriginal').naturalWidth===288);
  const externalBefore=(await traceLines()).length;
  await page.locator('#pixel-gridX').fill('0');await click('#pixelDetect');await page.locator('#pixelApplyDetection').waitFor({state:'visible'});await click('#pixelApplyDetection');assert.equal(await page.locator('#pixel-gridX').inputValue(),'6');assert.equal(await page.locator('#pixel-gridY').inputValue(),'6');
  await page.locator('#pixel-scale').selectOption('6');await preview();assert.equal(await page.locator('#pixelResult').evaluate(el=>el.naturalWidth),288);await page.screenshot({path:path.join(folder,'02-pixel-snap-ko.png')});pass('Real worker detects grid and renders crisp scaled PNG with transparency');
  const exportPath=path.join(folder,'exported-pixel.png');
  await app.evaluate(({BrowserWindow},destination)=>{globalThis.pixelDownloadState='waiting';BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>{item.setSavePath(destination);item.once('done',(_event,state)=>globalThis.pixelDownloadState=state);});},exportPath);
  await click('#pixelDownload');for(let n=0;n<100&&await app.evaluate(()=>globalThis.pixelDownloadState)!=='completed';n++)await new Promise(r=>setTimeout(r,100));assert.equal(await app.evaluate(()=>globalThis.pixelDownloadState),'completed');
  const exported=await sharp(await readFile(exportPath)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(exported.info.width,288);
  for(let y=0;y<288;y++)for(let x=0;x<288;x++){const i=(y*288+x)*4,j=(Math.floor(y/6)*6*288+Math.floor(x/6)*6)*4;assert.deepEqual(exported.data.subarray(i,i+4),exported.data.subarray(j,j+4));}
  pass('Electron PNG download contains exact constant 6 × 6 pixel cells');
  await page.locator('#pixelZoom').selectOption('4');assert.equal(await page.locator('#pixelResult').evaluate(el=>el.style.width),'1152px');await page.locator('#pixelZoom').selectOption('fit');
  await page.locator('#pixel-offsetX').fill('1');assert.equal(await page.locator('#pixelSave').isDisabled(),true);await click('#pixelUndo');assert.equal(await page.locator('#pixel-offsetX').inputValue(),'0');await preview();pass('View zoom is independent; changing a setting invalidates stale preview; undo restores settings');
  await click('#pixelFineTuning summary');await page.locator('#pixel-palette').selectOption('limit');await page.locator('#pixel-colors').fill('4');await preview();await page.locator('#pixel-alpha').selectOption('binary');await preview();await click('#pixelUndo');await page.locator('#pixel-palette').selectOption('preserve');await preview();pass('Palette and alpha options run in the real worker');
  const saveResponse=page.waitForResponse(r=>r.url().endsWith('/api/image-tools/run'));await click('#pixelSave');const savedResponse=await saveResponse;assert.equal(savedResponse.status(),200,await savedResponse.text());const saved=await savedResponse.json();await page.locator('#pixelNext').waitFor({state:'visible'});assert.equal(saved.operation.actual_anlas,0);assert.equal(saved.operation.api_model,null);assert.equal((await traceLines()).length,externalBefore);pass('Pixel Snap processing and History save make zero provider/account calls');
  // Use the served artifact: this checks the same PNG the download link exposes.
  const pngResponse=await page.request.get('http://127.0.0.1:'+port+'/'+saved.generation.image_path),meta=await sharp(await pngResponse.body()).metadata();assert.equal(meta.width,288);assert.equal(meta.hasAlpha,true);
  await click('#pixelNext');await page.waitForFunction(()=>!document.querySelector('#pixelSnapDialog').open);assert.equal(await page.locator('#toolCanvas').evaluate(el=>el.width),288);await click('#toolPixelSnap');await page.waitForFunction(()=>document.querySelector('#pixelOriginal').naturalWidth===288);pass('Saved PNG is reusable in another image tool without replacing the parent');
  await page.locator('#pixelFile').setInputFiles(largePath);await page.waitForFunction(()=>document.querySelector('#pixelOriginal').naturalWidth===4096);await page.locator('#pixel-gridX').fill('1');await page.locator('#pixel-gridY').fill('1');await page.locator('#pixel-palette').selectOption('auto');await click('#pixelPreview');await click('#pixelCancel');await page.waitForFunction(()=>document.querySelector('#pixelCancel').hidden);assert.equal(await page.locator('#pixelSave').isDisabled(),true);assert.equal(await page.locator('#pixelOriginal').evaluate(el=>el.naturalWidth),4096);pass('16-megapixel job cancels without freezing or overwriting the original');
  await page.locator('#pixelFile').setInputFiles(sourcePath);await page.waitForFunction(()=>document.querySelector('#pixelOriginal').naturalWidth===288);await page.locator('#pixel-gridX').fill('6');await page.locator('#pixel-gridY').fill('6');await page.locator('#pixel-scale').selectOption('6');await preview();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,760));await page.screenshot({path:path.join(folder,'03-pixel-compact.png')});assert.equal(await page.locator('#pixelSnapDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);pass('Compact window keeps Pixel Snap controls reachable without horizontal dialog overflow');
  await click('#pixelClose');await click('#toolClose');await page.locator('#uiLanguage').selectOption('ja');await click('#resolutionPicker');await page.screenshot({path:path.join(folder,'04-resolution-ja.png')});assert.equal(await page.locator('#resolutionDialog h2').textContent(),'画像サイズ');await click('#resolutionClose');await page.locator('#uiLanguage').selectOption('en');await click('#openImageTools');await click('#toolPixelSnap');assert.equal(await page.locator('#pixelPreview').textContent(),'Preview Pixel Snap');pass('Korean, Japanese and English labels switch in the new dialogs');
  await click('#pixelHelp');assert.match(await page.locator('#manualArticle h3').textContent(),/Pixel Snap/);await click('#manualClose');await click('#pixelClose');await click('#toolClose');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1000));
  for(const locale of ['ko','en','ja']){
    await page.locator('#uiLanguage').selectOption(locale);await click('#resolutionPicker');await page.screenshot({path:path.join(folder,`guide-resolution-${locale}.png`)});await click('#resolutionHelp');assert.match(await page.locator('#manualArticle').textContent(),/3,145,728/);await click('#manualClose');await click('#resolutionClose');
    await click('#openImageTools');await click('#toolPixelSnap');await page.locator('#pixelFile').setInputFiles(exportPath);await page.waitForFunction(()=>document.querySelector('#pixelOriginal').naturalWidth===288);await page.locator('#pixel-gridX').fill('6');await page.locator('#pixel-gridY').fill('6');await page.locator('#pixel-scale').selectOption('6');
    if(await page.locator('#pixelFineTuning').evaluate(el=>el.open))await click('#pixelFineTuning summary');await preview();await page.locator('#pixelSnapDialog').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(folder,`guide-pixel-${locale}.png`)});await click('#pixelClose');await click('#toolClose');
  }
  pass('Downloaded PNG reimports; contextual manuals and all three language screenshots verified');
  // A separate tokenless app proves local processing with internet unavailable.
  await app.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())win.destroy();});await app.close();app=null;
  const offlineFolder=path.join(folder,'offline');await mkdir(offlineFolder);const offlineTrace=path.join(folder,'offline-provider.jsonl');await writeFile(offlineTrace,'');
  app=await _electron.launch({executablePath:process.env.CHAESSI_ELECTRON||require('electron'),args:['tests/electron-fixture.cjs'],cwd:root,env:{...process.env,PORT:String(port),NAI_ACCESS_TOKEN:'',NOVELAI_TOKEN:'',CHAESSI_TEST_OFFLINE:'1',CHAESSI_PROVIDER_TRACE:offlineTrace,CHAESSI_ELECTRON_TEST_DATA:offlineFolder,CHAESSI_TEST_PROVIDER_MODULE:new URL('../tests/mock-pixel-resolution-provider.mjs',import.meta.url).href}});
  page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>document.querySelector('#presetName')?.value);await click('#openImageTools');await click('#toolPixelSnap');await page.locator('#pixelFile').setInputFiles(sourcePath);await page.waitForFunction(()=>document.querySelector('#pixelOriginal').naturalWidth===288);await page.locator('#pixel-gridX').fill('6');await page.locator('#pixel-gridY').fill('6');await preview();
  await click('#pixelSave');await page.locator('#pixelNext').waitFor({state:'visible'});assert.equal(await readFile(offlineTrace,'utf8'),'');pass('Tokenless Electron processes and saves PNG with internet unavailable and no external requests');
  assert.deepEqual(errors,[]);await writeFile(path.join(folder,'results.json'),JSON.stringify({checks,errors,paid_calls:0,generation:saved.generation},null,2));console.log(JSON.stringify({folder,checks:checks.length,errors}));
}catch(error){errors.push(error.stack);console.error(error);if(page)await page.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});await writeFile(path.join(folder,'results.json'),JSON.stringify({checks,errors,paid_calls:0},null,2));process.exitCode=1;}
finally{await app?.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())win.destroy();}).catch(()=>{});await app?.close();}
