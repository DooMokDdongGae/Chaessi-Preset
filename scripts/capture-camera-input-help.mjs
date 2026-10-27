import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
import {freePort} from './portable-test-utils.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url),{_electron}=require('playwright');
const folder=path.join(root,'.cache/v382/help-capture',String(Date.now()));await fs.mkdir(folder,{recursive:true});
const port=await freePort(),env={...process.env,PORT:String(port),NAI_ACCESS_TOKEN:'test-local-only',NOVELAI_TOKEN:'',CHAESSI_ELECTRON_TEST_DATA:folder,CHAESSI_TEST_PROVIDER_MODULE:new URL('../tests/mock-workbench-provider.mjs',import.meta.url).href};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:require('electron'),args:['tests/electron-fixture.cjs'],cwd:root,env});const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));let sends=0;page.on('request',r=>{if(r.url().endsWith('/api/novelai/generate'))sends++;});
const captures=[];
async function shot(locale,name){await page.evaluate(()=>document.activeElement?.blur());await page.screenshot({path:path.join(root,'assets/manuals',locale,name+'.png')});captures.push({file:`assets/manuals/${locale}/${name}.png`,kind:'actual-v382-electron',paid_generation:false,synthetic_prompt:true});}
try{
 await page.waitForFunction(()=>document.querySelector('#cameraInputOpen'));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1040));
 await page.locator('#basePrompt').fill('1girl, adult, street fashion, staircase, soft daylight');
 for(const locale of ['ko','en','ja']){
  await page.locator('#uiLanguage').selectOption(locale);
  await page.locator('#healthStatus').click();await shot(locale,'app-info');await page.locator('#aboutCloseButton').click();
  await page.locator('#cameraInputOpen').click();await page.locator('#cameraInputNew').click();
  await page.locator('[data-camera-yaw="45"]').click();await page.locator('[data-camera-weight="direction"]').fill('1.5');
  await page.locator('.camera-input-output').evaluate(el=>el.scrollTop=0);await shot(locale,'camera-absolute');
  await page.locator('#cameraInputPreview').scrollIntoViewIfNeeded();await shot(locale,'camera-wording');
  await page.locator('#cameraInputName').fill('Street composition');await page.locator('#cameraInputSave').click();await page.waitForFunction(()=>document.querySelector('#cameraInputSaved').options.length>0);await page.locator('#cameraInputLoad').scrollIntoViewIfNeeded();await shot(locale,'camera-reuse');
  await page.locator('#cameraInputClose').click();await page.locator('#generateButton').click();await page.locator('#cameraInputReview').waitFor();await shot(locale,'camera-review');await page.locator('#cameraInputCancelReview').click();await page.waitForFunction(()=>!document.querySelector('#generateButton').disabled);
 }
 if(sends||errors.length)throw Error(JSON.stringify({sends,errors}));
 await fs.writeFile(path.join(root,'.cache/v382/new-help-captures.json'),JSON.stringify({captures,errors,paidRequests:0},null,2));console.log(JSON.stringify({captures:captures.length,paidRequests:0,folder}));
}finally{await app.close();}
