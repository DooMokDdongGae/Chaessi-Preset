import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import net from 'node:net';import {once} from 'node:events';
import sharp from 'sharp';
import {manualChapters} from '../src/ui/manual-content.js';
import {messages} from '../src/ui/translations.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=path.join(root,'.cache/illustrated-help',`run-${Date.now()}`);await mkdir(folder,{recursive:true});
const {_electron}=createRequire(import.meta.url)(process.env.CHAESSI_PLAYWRIGHT||'playwright');
const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const exampleSource=path.join(folder,'example.png');await sharp(path.join(root,'assets/manuals/examples/lineart.webp')).extract({left:10,top:45,width:500,height:660}).resize(832,1216).png().toFile(exampleSource);
const capture=process.env.CHAESSI_CAPTURE_GUIDES==='1';
const checks=[],errors=[],screens=[];let app,page;const pass=s=>{checks.push(s);console.log('PASS '+s);};
async function shot(locale,name,selectors=[]){
 const marks=[];for(let i=0;i<selectors.length;i++){const box=await page.locator(selectors[i]).first().boundingBox();if(box)marks.push({x:Math.max(4,box.x-8),y:Math.max(4,box.y-8),n:i+1});}
 // Teaching annotations are separate overlays; no application buttons or values are invented.
 await page.evaluate(marks=>{const host=document.createElement('div');host.id='helpCaptureAnnotations';host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647';for(const p of marks){const n=document.createElement('span');n.textContent=p.n;n.style.cssText=`position:absolute;left:${p.x}px;top:${p.y}px;background:#e90050;color:white;border:2px solid white;border-radius:50%;font:bold 16px Arial;min-width:26px;height:26px;text-align:center;line-height:26px;`;host.append(n);} (document.querySelector('dialog[open]')||document.body).append(host);},marks);
 const out=capture?path.join(root,'assets/manuals',locale,name+'.png'):path.join(folder,'screens',locale,name+'.png');await mkdir(path.dirname(out),{recursive:true});
 await sharp(await page.screenshot()).png({palette:true,quality:95}).toFile(out);await page.evaluate(()=>document.querySelector('#helpCaptureAnnotations')?.remove());screens.push({locale,name,annotations:selectors});
}
try{
 app=await _electron.launch({executablePath:process.env.CHAESSI_ELECTRON||createRequire(import.meta.url)('electron'),args:['tests/electron-fixture.cjs'],cwd:root,env:{...process.env,PORT:String(port),NAI_ACCESS_TOKEN:'test-local-only',NOVELAI_TOKEN:'',CHAESSI_ELECTRON_TEST_DATA:folder,CHAESSI_TEST_PROVIDER_MODULE:new URL('../tests/mock-image-tools-provider.mjs',import.meta.url).href}});
 page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>document.querySelector('#presetName')?.value);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1280));
 await page.locator('#basePrompt').fill('two adult women, white laboratory coats, science classroom');const prompt=await page.locator('#basePrompt').inputValue();
 const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
 for(const locale of ['ko','en','ja']){
  await page.locator('#uiLanguage').selectOption(locale);assert.equal(await page.locator('.header-tools > :first-child').getAttribute('id'),'healthStatus');assert.equal(await page.locator('#healthStatus').textContent(),messages['App info'][locale]);
  await page.locator('#healthStatus').click();assert.equal(await page.locator('#aboutVersion').textContent(),'Chaessi Preset '+version);assert.equal(await page.locator('#aboutChannel').textContent(),messages[version.includes('private')?'PRIVATE development build':'PUBLIC build'][locale]);assert.equal(await page.locator('#supportCoffeeLink').getAttribute('href'),'https://buymeacoffee.com/magiconcert');await shot(locale,'app-info',['#aboutVersion','#openIntegratedManual','#supportCoffeeLink']);
  await page.locator('[data-manual-jump="start"]').click();assert.equal(await page.locator('#manualArticle h3').textContent(),manualChapters.find(c=>c.id==='start')[locale][0]);await page.locator('#manualClose').click();await page.locator('#aboutCloseButton').click();
  await page.locator('#openImageTools').click();await page.locator('#toolFile').setInputFiles(exampleSource);await page.waitForFunction(()=>document.querySelector('#toolCanvas').width===832);
  for(const tool of ['upscale','enhance','max-enhance','bg-removal','lineart','sketch','colorize','emotion','declutter','canvas','outpaint','focused-inpaint']){
   await page.locator('#toolKind').selectOption(tool);if(['colorize','emotion'].includes(tool))await page.locator('#toolDirectorPrompt').fill('white laboratory coats, blue hair, red hair');if(tool==='emotion')await page.locator('#toolEmotion').selectOption('happy');
   if(tool==='focused-inpaint')for(const [key,value]of Object.entries({x:256,y:160,width:256,height:256}))await page.locator('#toolRect-'+key).fill(String(value));
   await page.locator('#imageToolsDialog aside').evaluate(el=>el.scrollTop=0);
   const settings={upscale:'#toolReview',enhance:'#toolMagnitude','max-enhance':'#toolMagnitude','bg-removal':'#toolReview',lineart:'#toolReview',sketch:'#toolReview',colorize:'#toolDirectorPrompt',emotion:'#toolEmotion',declutter:'#toolReview',canvas:'#toolBrush',outpaint:'#toolExtend-right','focused-inpaint':'#toolContext'};
   await shot(locale,'tool-'+tool,['#toolUpload','#toolKind',settings[tool]]);
   if(tool==='canvas'){await page.locator('#toolResize').scrollIntoViewIfNeeded();await shot(locale,'canvas-controls',['#toolBrush','#toolColor','#toolUndo','#toolRedo','#toolCrop','#toolResize']);}
   await page.locator('[data-open-manual]').click();assert.equal(await page.locator('#manualArticle h3').textContent(),manualChapters.find(c=>c.id==='tool-'+tool)[locale][0]);await page.locator('#manualClose').click();
  }
  await page.locator('#toolKind').selectOption('upscale');await page.locator('#toolReview').click();await page.waitForFunction(()=>!document.querySelector('#toolRun').disabled);await shot(locale,'tool-cost',['#toolCost','#toolRun']);
  await shot(locale,'image-tools',['#toolUpload','#toolKind','#toolReview','#toolRun']);
  await page.locator('#toolClose').click();assert.equal(await page.locator('#basePrompt').inputValue(),prompt);
 }
 await app.evaluate(({shell})=>{globalThis.helpExternal=[];shell.openExternal=async url=>{globalThis.helpExternal.push(url);};});
 await page.locator('#healthStatus').click();await page.locator('#supportCoffeeLink').click();assert.deepEqual(await app.evaluate(()=>globalThis.helpExternal),['https://buymeacoffee.com/magiconcert']);await page.locator('#aboutCloseButton').click();
 pass('App info first in KO/EN/JA, package version/channel, original donation URL, shortcuts and 36 contextual tool-help links');
 // Actual local Canvas action: edit via mouse, undo/redo, save new PNG, preserve source.
 await page.locator('#openImageTools').click();await page.locator('#toolKind').selectOption('canvas');await page.locator('#toolColor').fill('#00bbee');const box=await page.locator('#toolCanvas').boundingBox();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.8);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.85);await page.mouse.up();await page.locator('#toolUndo').click();await page.locator('#toolRedo').click();
 await page.locator('#toolReview').click();await page.waitForFunction(()=>!document.querySelector('#toolRun').disabled);const response=page.waitForResponse(r=>r.url().endsWith('/api/image-tools/run'));await page.locator('#toolRun').click();const result=await(await response).json();assert.equal(result.operation.actual_anlas,0);await page.waitForFunction(()=>!!document.querySelector('#toolCompletedResult')?.naturalWidth);
 await writeFile(path.join(folder,'canvas-result.png'),await readFile(path.join(folder,result.generation.image_path)));
 for(const locale of ['ko','en','ja']){await page.evaluate(async l=>(await import('/src/ui/i18n.js')).setLanguage(l),locale);await page.locator('#toolDownload').scrollIntoViewIfNeeded();await shot(locale,'tool-result',['#toolDownload','#toolUseNext','#toolUseI2I','#toolUseInpaint']);}
 await page.locator('#toolClose').click();
 for(const locale of ['ko','en','ja']){await page.locator('#uiLanguage').selectOption(locale);await page.locator('[data-workspace-view="workbench"]').click();await page.locator('#latestImageTools').scrollIntoViewIfNeeded();await shot(locale,'tool-latest-entry',['#latestImageTools']);await page.locator('#latestImageTools').click();assert.equal(await page.locator('#imageToolsDialog').isVisible(),true);await page.locator('#toolClose').click();await page.locator('[data-workspace-view="history"]').click();await page.locator(`[data-view-generation="${result.generation.id}"]`).click();await shot(locale,'tool-history-entry',['#viewerImageTools']);await page.locator('#viewerImageTools').click();assert.equal(await page.locator('#imageToolsDialog').isVisible(),true);await page.locator('#toolClose').click();await page.locator('#imageViewerCloseButton').click();}
 pass('Real local Canvas pen/undo/redo/save and History → tools; no paid calls or prompt changes');
 // Block remote requests while reading every chapter and every illustration.
 const remote=[];await page.route('**/*',route=>{const u=route.request().url();if(/^(blob:|data:)/.test(u)||new URL(u).hostname==='127.0.0.1')return route.continue();remote.push(u);return route.abort();});
 await page.locator('#healthStatus').click();await page.locator('#openIntegratedManual').click();
 for(const locale of ['ko','en','ja']){await page.locator('#manualLanguage').selectOption(locale);for(const chapter of manualChapters){await page.locator(`[data-manual-chapter="${chapter.id}"]`).click();await page.waitForFunction(()=>[...document.querySelectorAll('#manualArticle img')].every(i=>i.complete&&i.naturalWidth>0));assert.equal(await page.locator('#manualArticle h3').textContent(),chapter[locale][0]);}
  await page.locator('[data-manual-chapter="tool-bg-removal"]').click();await page.locator('#manualArticle .manual-picture').last().click();assert.equal(await page.locator('#manualImageZoom').isVisible(),true);await page.locator('#manualImageZoom button').click();
  await page.locator('#manualSearch').fill('Magnitude');assert.ok(await page.locator('#manualContents button').count()>=2);await page.locator('#manualSearch').fill('no-result-zzzzz');assert.equal(await page.locator('#manualContents button').count(),0);await page.locator('#manualSearch').fill('');
 }
 assert.deepEqual(remote,[]);pass('All 90 localized chapters and every illustration load offline; search, zero results, picture zoom');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(960,640));for(const locale of ['ko','en','ja']){await page.locator('#manualLanguage').selectOption(locale);await page.locator('[data-manual-chapter="tool-focused-inpaint"]').click();await page.locator('#manualTextSize').fill('24');await page.locator('#manualArticle').evaluate(el=>el.scrollTop=el.scrollHeight);assert.ok(await page.locator('#manualArticle').evaluate(el=>el.scrollTop>0&&el.scrollWidth<=el.clientWidth+2));await page.screenshot({path:path.join(folder,'small-'+locale+'.png')});}
 await page.locator('#manualClose').click();assert.equal(await page.locator('#aboutDialog').isVisible(),true);await page.locator('#aboutCloseButton').click();assert.equal(await page.locator('#basePrompt').inputValue(),prompt);pass('960×640, largest text, scrolling, dialog return and unsaved work preserved');
 assert.deepEqual(errors,[]);await writeFile(path.join(folder,'results.json'),JSON.stringify({checks,errors,screens,paid_calls:0},null,2));console.log(JSON.stringify({folder,screens:screens.length,checks:checks.length}));
}catch(e){errors.push(e.message);if(page)await page.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});await writeFile(path.join(folder,'results.json'),JSON.stringify({checks,errors,screens},null,2));console.error(e);process.exitCode=1;}finally{await app?.close();}
