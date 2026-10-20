// Electron integration tests with an isolated data folder and a mocked provider.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import net from 'node:net';
import {once} from 'node:events';
import sharp from 'sharp';
const root=fileURLToPath(new URL('../',import.meta.url)),folder=path.join(root,'.cache','composition-ui',`run-${Date.now()}`);await mkdir(folder,{recursive:true});
const sourcePath=path.join(folder,'source.png');
if(process.env.CHAESSI_COMPOSITION_SOURCE)await writeFile(sourcePath,await readFile(process.env.CHAESSI_COMPOSITION_SOURCE));
else await writeFile(sourcePath,await sharp(Buffer.from('<svg width="768" height="512"><rect width="768" height="512" fill="#7b91aa"/><rect x="150" y="90" width="350" height="280" rx="60" fill="#c09bde"/><circle cx="330" cy="230" r="75" fill="#ffe8c7"/><path d="M0 450 L768 400" stroke="#ffffff" stroke-width="20"/></svg>')).png().toBuffer());
const require=createRequire(import.meta.url),{_electron}=require(process.env.CHAESSI_PLAYWRIGHT||'playwright');
const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const checks=[],errors=[];let app,page;const pass=msg=>{checks.push(msg);console.log('PASS '+msg);};
async function click(id){await page.locator(id).click();}
async function drag(from,to){await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();}
async function center(selector){
  // Placement and handle DOM update on animation frames. Read coordinates only
  // after the preceding gesture and layout have rendered, including scrolls.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const locator=page.locator(selector);await locator.waitFor({state:'visible'});
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  return locator.evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};});
}
async function review(){const pending=page.waitForResponse(r=>r.url().endsWith('/api/image-tools/prepare'));await click('#compositionReview');const response=await pending;assert.equal(response.status(),200,await response.text());await page.waitForFunction(()=>!document.querySelector('#compositionRun').disabled);return response.json();}
async function top(){await page.locator('#compositionDialog').evaluate(el=>el.scrollTo({top:0,behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
try{
  app=await _electron.launch({executablePath:process.env.CHAESSI_ELECTRON||require('electron'),args:['tests/electron-fixture.cjs'],cwd:root,env:{...process.env,PORT:String(port),NAI_ACCESS_TOKEN:'test-local-only',NOVELAI_TOKEN:'',CHAESSI_ELECTRON_TEST_DATA:folder,CHAESSI_TEST_PROVIDER_MODULE:new URL('../tests/mock-image-tools-provider.mjs',import.meta.url).href}});
  page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
  await page.waitForFunction(()=>document.querySelector('#presetName')?.value);await page.locator('#uiLanguage').selectOption('ko');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1000));
  await page.locator('#basePrompt').fill('adult gardener, greenhouse, watering seedlings');
  await click('#openImageTools');await page.locator('#toolFile').setInputFiles(sourcePath);await page.waitForFunction(()=>document.querySelector('#toolCanvas').width>100);
  await click('#toolComposition');await page.waitForFunction(()=>document.querySelector('#compositionDimensions').textContent.includes('×'));
  assert.equal(await page.locator('#compositionDialog h2').textContent(),'구도 넓히기');assert.equal(await page.locator('#compositionAddCharacter').textContent(),'캐릭터 추가');await page.screenshot({path:path.join(folder,'01-open.png')});
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/image-tools/prepare'));await click('#compositionReview');const rejected=await pending;assert.equal(rejected.status(),400);assert.match(await rejected.text(),/Paint a region/);await page.waitForFunction(()=>!document.querySelector('#compositionClose').disabled);
}catch(error){
  // Empty masks must be rejected; continue from the live editor for gesture tests.
  errors.push(error.message);
}
try{
  assert.deepEqual(errors,[]);pass('Korean composition entry; empty mask rejected without generation');await top();
  const viewport='.composition-viewport';let c=await center(viewport);
  await click('[data-comp-tool="brush"]');await page.mouse.click(c.x,c.y);await drag({x:c.x-30,y:c.y-20},{x:c.x+30,y:c.y+20});
  const brushPrepared=await review();assert.ok(brushPrepared.plan.preview.mask.png);pass('Round stamp and interpolated drag produce a reviewable mask');await top();
  await click('[data-comp-tool="move"]');c=await center(viewport);await drag(c,{x:c.x+60,y:c.y-20});
  let handle=await center('.composition-handle.scale[data-key="2"]');await drag(handle,{x:handle.x-60,y:handle.y-35});
  handle=await center('.composition-handle.rotate');await drag(handle,{x:handle.x+60,y:handle.y+25});
  const transformed=await review();assert.notEqual(transformed.plan.geometry.transform.angle,0);assert.notEqual(transformed.plan.geometry.transform.scale,1);pass('Picture drag, corner scale and rotation handles change a single placement');await top();
  await click('[data-comp-action="undo"]');await click('[data-comp-action="redo"]');const redone=await review();assert.deepEqual(redone.plan.geometry,transformed.plan.geometry);assert.equal(redone.plan.preview.mask.sha256,transformed.plan.preview.mask.sha256);pass('Mixed brush/placement undo-redo preserves exact source and mask');await top();
  await click('[data-comp-tool="frame"]');handle=await center('.composition-handle.frame.right');await drag(handle,{x:handle.x+65,y:handle.y});
  let frame=await review();assert.ok(frame.plan.geometry.frame.width>transformed.plan.geometry.frame.width);await top();
  handle=await center('.composition-handle.frame.left');await drag(handle,{x:handle.x-25,y:handle.y});const leftFrame=await review();const added=leftFrame.plan.geometry.frame.width-frame.plan.geometry.frame.width;assert.ok(added>0);assert.equal(leftFrame.plan.geometry.transform.x-frame.plan.geometry.transform.x,added);frame=leftFrame;pass('Right and left frame edge drags expand output and preserve picture placement');await top();
  c=await center(viewport);await page.mouse.move(c.x,c.y);await page.mouse.wheel(0,-160);const zoomed=await review();assert.deepEqual(zoomed.plan.geometry,frame.plan.geometry);assert.equal(zoomed.plan.preview.source.sha256,frame.plan.preview.source.sha256);pass('Wheel changes the view only; prepared content is byte-identical');await top();
  await click('[data-comp-tool="eraser"]');await page.mouse.click(c.x+20,c.y);assert.equal(await page.locator('#compositionRun').isDisabled(),true);await click('[data-comp-action="undo"]');await review();await top();
  // Cancel a captured drag; leave neither a half-transform nor a stale plan.
  await click('[data-comp-tool="move"]');c=await center(viewport);await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+20,c.y+10);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await page.locator('#compositionDialog').isVisible(),true);const cancelled=await review();assert.deepEqual(cancelled.plan.geometry,frame.plan.geometry);pass('Escape cancels a gesture without closing or committing a partial placement');await top();
  await page.locator('.composition-sidebar details').filter({has:page.locator('#compositionAddCharacter')}).locator('summary').click();await click('#compositionAddCharacter');await page.locator('#compositionCharacters textarea').first().fill('adult woman, red hair, standing');await page.locator('#compositionUseCoords').check();
  await click('[data-comp-tool="character"]');handle=await center('.composition-handle.character');await drag(handle,{x:handle.x+12,y:handle.y-20});
  const chars=await review();assert.equal(chars.plan.character_positions.length,1);pass('Add character and drag marker; prompt snapshot is separate from workbench');
  await page.screenshot({path:path.join(folder,'02-review.png')});
  const run=page.waitForResponse(r=>r.url().endsWith('/api/image-tools/run'));await click('#compositionRun');const response=await run;assert.equal(response.status(),200,await response.text());const saved=await response.json();await page.waitForFunction(()=>document.querySelector('#compositionResultImage').naturalWidth>0);await page.waitForFunction(()=>!document.querySelector('#compositionClose').disabled);
  assert.equal(saved.variants.length,2);assert.equal(saved.operation.tool,'composition');pass('Generate once with mocked provider; protected/raw variants and History saved');await page.screenshot({path:path.join(folder,'03-result.png')});
  await click('#compositionAdopt');await page.waitForFunction(()=>document.querySelector('#compositionResult').hidden);const adoptedW=Number(await page.locator('#compositionWidth').inputValue());assert.equal(adoptedW,saved.operation.actual_output_size.width);assert.equal(await page.locator('[data-comp-tool="brush"]').getAttribute('aria-pressed'),'true');pass('Result adoption starts identity brush editing, keeping the saved arrangement intact');
  await click('#compositionClose');await click('#toolClose');
  // Reopen successful History via the image tools entry and restore the source recipe.
  await click('#latestImageTools');await page.locator('#toolRestoreComposition').waitFor({state:'visible'});await click('#toolRestoreComposition');await page.waitForFunction(()=>document.querySelector('#compositionDialog').open);const restored=await review();assert.deepEqual(restored.plan.geometry,chars.plan.geometry);assert.equal(restored.plan.preview.source.sha256,chars.plan.preview.source.sha256);assert.equal(restored.plan.preview.mask.sha256,chars.plan.preview.mask.sha256);pass('History restores immutable source, manual mask, placement and characters without double transform');
  await top();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,760));await page.screenshot({path:path.join(folder,'04-compact.png')});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1000));
  await click('#compositionClose');await click('#toolClose');await click('[data-workspace-view="workbench"]');await click('[data-generation-mode="inpaint"]');
  await page.locator('#generationSourceInput').setInputFiles(sourcePath);await page.waitForFunction(()=>document.querySelector('#generationSourceCanvas').width===1280||document.querySelector('#generationSourceCanvas').width===768);
  const oldMask=page.locator('#inpaintMaskCanvas');await oldMask.scrollIntoViewIfNeeded();let oldCenter=await center('#inpaintMaskCanvas');await page.mouse.click(oldCenter.x,oldCenter.y);
  const legacy=await page.evaluate(()=>({source:document.querySelector('#generationSourceCanvas').toDataURL(),mask:document.querySelector('#inpaintMaskCanvas').toDataURL()}));
  await click('#openInpaintComposition');await page.waitForFunction(()=>document.querySelector('#compositionDialog').open);const request=page.waitForRequest(r=>r.url().endsWith('/api/image-tools/prepare'));const handed=await review();const body=(await request).postDataJSON();
  assert.equal(body.source_png,legacy.source.split(',')[1]);assert.equal(body.settings.manual_mask_png,legacy.mask.split(',')[1]);pass('Legacy round-brush source and alpha mask hand off byte-for-byte without reset');
  // Electron owns native downloads; observe the real DownloadItem rather than
  // Playwright's browser-only download event. Redirect only this isolated test.
  await top();await page.locator('#compositionBrushSize').fill('72');await click('[data-comp-action="mask"]');const draftPath=path.join(folder,'session.json');
  await app.evaluate(({BrowserWindow},destination)=>{
    globalThis.compositionDownloadState='waiting';
    BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>{
      item.setSavePath(destination);item.once('done',(_event,state)=>{globalThis.compositionDownloadState=state;});
    });
  },draftPath);
  await click('#compositionExport');
  for(let n=0;n<100&&await app.evaluate(()=>globalThis.compositionDownloadState)!=='completed';n++)await new Promise(r=>setTimeout(r,100));
  assert.equal(await app.evaluate(()=>globalThis.compositionDownloadState),'completed');
  assert.equal(JSON.parse(await readFile(draftPath,'utf8')).schema,'chaessi.composition-draft.v1');
  await click('[data-comp-action="clear"]');await page.locator('#compositionDraftFile').setInputFiles(draftPath);await page.waitForFunction(()=>!document.querySelector('[data-comp-action="clear"]').disabled);const imported=await review();assert.equal(imported.plan.preview.source.sha256,handed.plan.preview.source.sha256);assert.equal(imported.plan.preview.mask.sha256,handed.plan.preview.mask.sha256);assert.equal(await page.locator('#compositionBrushSize').inputValue(),'72');assert.equal(await page.locator('[data-comp-action="mask"]').textContent(),'마스크 표시');pass('Portable editing-session export/import restores source, mask, placement and brush preferences');
  await click('#compositionClose');assert.equal(await oldMask.evaluate(el=>el.toDataURL()),legacy.mask);await click('#undoMaskButton');assert.equal(await oldMask.evaluate(el=>el.getContext('2d').getImageData(el.width/2,el.height/2,1,1).data[3]),0);
  await click('#redoMaskButton');assert.equal(await oldMask.evaluate(el=>el.toDataURL()),legacy.mask);await click('[data-mask-tool="eraser"]');await oldMask.scrollIntoViewIfNeeded();oldCenter=await center('#inpaintMaskCanvas');await page.mouse.click(oldCenter.x,oldCenter.y);assert.equal(await oldMask.evaluate(el=>el.getContext('2d').getImageData(el.width/2,el.height/2,1,1).data[3]),0);pass('Returning preserves legacy undo/redo and round eraser behavior');
  await click('#openImageTools');await page.locator('#toolFile').setInputFiles(sourcePath);await page.waitForFunction(()=>document.querySelector('#toolCanvas').width===1280||document.querySelector('#toolCanvas').width===768);await click('#toolDraw');
  const drawCenter=await center('#toolCanvas');await drag(drawCenter,{x:drawCenter.x+30,y:drawCenter.y});const drawn=await page.locator('#toolCanvas').evaluate(el=>el.toDataURL().split(',')[1]);await click('#toolPaint');await page.waitForFunction(()=>document.querySelector('#compositionDialog').open);const editCenter=await center('.composition-viewport');await page.mouse.click(editCenter.x,editCenter.y);
  const drawnRequest=page.waitForRequest(r=>r.url().endsWith('/api/image-tools/prepare'));await review();assert.equal((await drawnRequest).postDataJSON().source_png,drawn);await click('#compositionClose');assert.equal(await page.locator('#toolCanvas').evaluate(el=>el.toDataURL().split(',')[1]),drawn);await click('#toolUndo');assert.notEqual(await page.locator('#toolCanvas').evaluate(el=>el.toDataURL().split(',')[1]),drawn);await click('#toolClose');pass('Canvas pixel edits transfer to composition and Canvas undo remains intact');
  assert.deepEqual(errors,[]);await writeFile(path.join(folder,'results.json'),JSON.stringify({checks,errors,paid_calls:0,generation:saved.generation},null,2));console.log(JSON.stringify({folder,checks:checks.length,errors}));
  if(process.env.CHAESSI_KEEP_GUI==='1'||process.argv.includes('--manual')){await click('#openInpaintComposition');await top();}
  if(process.env.CHAESSI_KEEP_GUI==='1'||process.argv.includes('--manual')){await top();console.log('GUI retained for manual verification');await new Promise(r=>setTimeout(r,15*60_000));}
}catch(error){errors.push(error.message);if(page)await page.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});await writeFile(path.join(folder,'results.json'),JSON.stringify({checks,errors,paid_calls:0},null,2));console.error(error);process.exitCode=1;}finally{
  // This fixture owns its isolated windows. Dirty-draft beforeunload must not
  // strand a failed test process or leave a window covering the next run.
  await app?.evaluate(({BrowserWindow})=>{for(const window of BrowserWindow.getAllWindows())window.destroy();}).catch(()=>{});
  await app?.close();
}
