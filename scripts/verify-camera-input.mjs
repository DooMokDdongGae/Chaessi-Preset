import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {freePort} from './portable-test-utils.mjs';
import {defaultCamera} from '../src/camera-input/model.js';
import {createDefaultPreset} from '../src/state/preset-schema.js';
import {encodeRgbPng} from '../src/services/generation-image-utils.js';
import {createGenerationStore} from '../src/services/generation-store.js';
import {buildV5GeneratePayload} from '../src/adapters/novelai-v5-full.js';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const {_electron}=require(process.env.CHAESSI_PLAYWRIGHT||'playwright');
const folder=path.join(root,'.cache/v382/camera',String(Date.now()));await mkdir(folder,{recursive:true});
const port=await freePort(),checks=[],errors=[],requests=[];let app,page;
const base=createDefaultPreset({params:{model:'nai-diffusion-5-full',width:512,height:512,seed:773},prompt_parts:{base:'1girl, adult, artist:example, street',undesired:'lowres',characters:[{prompt:'white shirt, standing',position_mode:'custom',centers:[{x:.2,y:.7}]}]}});
const png=encodeRgbPng(Buffer.alloc(512*512*3,170),512,512),mask=encodeRgbPng(Buffer.alloc(512*512*3,255),512,512);
const store=createGenerationStore({rootDir:folder});
const legacy=await store.saveGeneration({preset:base,payload:buildV5GeneratePayload(base),imageBytes:png,responseInfo:{generation_id:'legacy_camera_fixture',created_at:new Date().toISOString()}});
const legacyPath=path.join(folder,legacy.sidecar_path);const legacySidecar=JSON.parse(await readFile(legacyPath,'utf8'));
legacySidecar.camera_context={rule_version:'camera-local-calibration/1',source_id:'legacy_source',yaw:135,calibration:{knots:[{value:1.5}]}};
await writeFile(legacyPath,JSON.stringify(legacySidecar));const legacyBytes=await readFile(legacyPath);
const pass=name=>{checks.push(name);console.log('PASS '+name);};
async function launch(){
  const env={...process.env,PORT:String(port),NAI_ACCESS_TOKEN:'test-local-only',NOVELAI_TOKEN:'',CHAESSI_ELECTRON_TEST_DATA:folder,CHAESSI_TEST_PROVIDER_MODULE:new URL('../tests/mock-workbench-provider.mjs',import.meta.url).href};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({executablePath:require('electron'),args:['tests/electron-fixture.cjs'],cwd:root,env,timeout:45000});
  page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/api/novelai/generate'))requests.push(r.postDataJSON());});
  await page.waitForFunction(()=>document.querySelector('#cameraInputOpen'));await page.locator('#uiLanguage').selectOption('en');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1000));
}
async function api(url,body){return page.evaluate(async({url,body})=>{const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};},{url,body});}
async function capture(name){await page.screenshot({path:path.join(folder,name+'.png')});}
try{
  await launch();await page.locator('#basePrompt').fill(base.prompt_parts.base);
  await page.locator('#cameraInputOpen').click();await page.locator('#cameraInputEnabled').check();
  assert.equal(await page.locator('#cameraInputYaw').inputValue(),'0');assert.match(await page.locator('#cameraInputBlock').inputValue(),/upper body, from front/);
  assert.equal(requests.length,0);pass('Fresh preset uses camera immediately at absolute 0°, no image or baseline question');
  const sphere=await page.locator('#cameraInputSphere').boundingBox();await page.mouse.move(sphere.x+sphere.width/2,sphere.y+sphere.height*.65);await page.mouse.down();await page.mouse.move(sphere.x+sphere.width/2+70,sphere.y+sphere.height*.65-30,{steps:8});await page.mouse.up();
  assert.ok(Number(await page.locator('#cameraInputYaw').inputValue())>60);assert.ok(Number(await page.locator('#cameraInputElevation').inputValue())>0);assert.equal(requests.length,0);pass('Actual pointer drag changes direction/elevation without generation');
  await page.locator('[data-camera-yaw="45"]').click();await page.locator('[data-camera-weight="direction"]').fill('1.5');
  assert.equal(await page.locator('#cameraInputYaw').inputValue(),'45');assert.match(await page.locator('#cameraInputBlock').inputValue(),/1.5::three-quarter view::/);pass('Direct weight edit leaves sphere coordinate unchanged');
  await page.locator('[data-camera-text="direction"]').fill('three-quarter view');await page.locator('[data-camera-yaw="90"]').click();assert.match(await page.locator('#cameraInputBlock').inputValue(),/three-quarter view/);await page.locator('[data-camera-auto="direction"]').click();assert.match(await page.locator('#cameraInputBlock').inputValue(),/from side/);pass('Manual wording survives movement until explicit Auto reset');
  await page.locator('[data-camera-weight="direction"]').fill('1.');assert.equal(await page.locator('#cameraInputSave').isDisabled(),true);assert.equal(await page.locator('#cameraInputPreview').inputValue(),'');await page.locator('[data-camera-weight="direction"]').fill('1.5');pass('Incomplete emphasis remains visible and cannot be saved or sent as an old value');
  await page.locator('#cameraInputName').fill('Absolute camera restart');await page.locator('#cameraInputSave').click();await page.waitForFunction(()=>document.querySelector('#cameraInputSaved').options.length===1);await capture('01-camera-controls');
  await page.locator('#cameraInputClose').click();assert.equal(await page.locator('#basePrompt').inputValue(),base.prompt_parts.base);
  await page.locator('#generateButton').click();await page.locator('#cameraInputReview').waitFor();assert.equal(requests.length,0);const finalText=await page.locator('#cameraInputFinal').textContent();assert.match(finalText,/from side/);await capture('02-final-review');await page.locator('#cameraInputConfirm').click();
  await page.waitForFunction(()=>document.querySelector('#latestResultActions')?.hidden===false);assert.equal(requests.length,1);
  const list=(await api('/api/generations')).data.items;const current=list.find(x=>x.id!=='legacy_camera_fixture');const record=(await api('/api/generations/'+current.id)).data.generation;
  assert.equal(record.camera_input.state.yaw,90);assert.match(record.camera_input.final_caption.base_caption,/1.5::from side::/);assert.equal(record.camera_input.original_preset.prompt_parts.base,base.prompt_parts.base);pass('Actual Electron prepare → review → mock provider → History preserves original and exact wire captions');
  await page.locator('#cameraInputOpen').click();await page.locator('#cameraInputEnabled').uncheck();await page.locator('#cameraInputClose').click();
  await page.locator('#generateButton').click();await page.waitForFunction(()=>!document.querySelector('#generateButton').disabled);assert.equal(requests.length,2);assert.equal(await page.locator('#cameraInputReview').isVisible(),false);pass('Camera OFF retains ordinary v3.7.0 generation without a camera review');
  // Same HTTP route for High/Medium and T2I/I2I/Inpaint. The provider is always mocked.
  for(const effort of ['high','medium'])for(const mode of ['text-to-image','image-to-image','inpaint']){
    const p=structuredClone(base);p.params.effort=effort;const camera=defaultCamera(true);camera.yaw=-90;camera.elevation=30;
    const prepared=await api('/api/novelai/prepare',{preset:p,mode,camera_input:camera});assert.equal(prepared.status,200);
    const body={preset:prepared.data.preset,prepared_id:prepared.data.prepared_id,mode,camera_ack:prepared.data.camera_input.review_key};
    if(mode!=='text-to-image')body.mode_state={width:512,height:512,source_image_base64:png.toString('base64'),mask_image_base64:mask.toString('base64'),strength:.5,noise:0};
    const generated=await api('/api/novelai/generate',body);assert.equal(generated.status,200,JSON.stringify(generated.data));
    const r=(await api('/api/generations/'+generated.data.generation.id)).data.generation;
    assert.deepEqual(r.camera_input.final_caption,prepared.data.caption);assert.deepEqual(r.raw_payload.parameters.v4_prompt.caption,prepared.data.caption);assert.equal(r.raw_payload.parameters.use_coords,true);assert.equal(r.camera_input.state.yaw,-90);
    pass(`${effort} ${mode}: prepared, wire and History captions match; Character Position retained`);
  }
  const conflicted=structuredClone(base);conflicted.prompt_parts.base='from behind, street';conflicted.prompt_parts.characters[0].prompt='white shirt, from above';
  const pending=(await api('/api/novelai/prepare',{preset:conflicted,camera_input:defaultCamera(true)})).data;
  assert.equal((await api('/api/novelai/generate',{prepared_id:pending.prepared_id})).status,409);
  assert.equal((await api('/api/novelai/generate',{preset:conflicted,camera_input:defaultCamera(true)})).status,409);pass('Prepared and direct HTTP paths refuse unreviewed manual camera conflicts');
  const pure=(await api('/api/novelai/prepare',{preset:base})).data;
  assert.equal(pure.camera_input,null);assert.equal(pure.preset.prompt_parts.base,base.prompt_parts.base);pass('OFF HTTP preparation has no camera mutation');
  await page.locator('[data-workspace-view="history"]').click();await page.locator('#loadHistoryButton').click();
  await page.locator('[data-view-generation="legacy_camera_fixture"]').click();await page.locator('[data-viewer-reuse="camera-new"]').click();
  await page.locator('#cameraInputDialog').waitFor();assert.equal(await page.locator('#cameraInputYaw').inputValue(),'0');assert.equal(await page.locator('#cameraInputLegacy').isVisible(),true);assert.deepEqual(await readFile(legacyPath),legacyBytes);pass('Legacy History starts a new absolute 0° camera; old record remains byte-identical and viewable');
  await page.locator('#cameraInputClose').click();
  await app.close();await launch();await page.locator('#cameraInputOpen').click();await page.locator('#cameraInputLoad').click();await page.waitForFunction(()=>document.querySelector('#cameraInputYaw').value==='90');
  assert.match(await page.locator('#cameraInputBlock').inputValue(),/1.5::from side::/);assert.deepEqual(await readFile(legacyPath),legacyBytes);pass('Saved prompt/settings/camera resume after a real Electron restart without rewriting legacy files');
  for(const locale of ['ko','en','ja']){await page.locator('#cameraInputClose').click();await page.locator('#uiLanguage').selectOption(locale);await page.locator('#cameraInputOpen').click();await capture('camera-'+locale);}
  pass('Korean, English and Japanese camera screens render without changing prompt values');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(960,640));await capture('camera-small');
  assert.equal(await page.evaluate(()=>document.querySelector('#cameraInputDialog').scrollWidth>document.querySelector('#cameraInputDialog').clientWidth),false);pass('Small Electron window retains accessible scrolling without horizontal clipping');
  assert.deepEqual(errors,[]);pass('No renderer exceptions');
}catch(error){await capture('failure').catch(()=>{});errors.push(error.stack);console.error(error);process.exitCode=1;}
finally{await app?.close().catch(()=>{});await writeFile(path.join(folder,'results.json'),JSON.stringify({checks,errors,requestCount:requests.length,paidRequests:0},null,2));console.log('EVIDENCE '+folder);}
