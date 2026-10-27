// Bounded read-only samples from the user's v3.8.1 profile. Credentials are never copied.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {launchPortable,freePort} from './portable-test-utils.mjs';
import {validatePreset} from '../src/adapters/novelai-v45-full.js';
const root=process.cwd(),source=process.env.CHAESSI_V381_DATA||path.join(process.env.APPDATA,'Chaessi Preset','data');
const folder=path.join(root,'.cache/v382/actual-upgrade',String(Date.now())),profile=path.join(folder,'profile'),copied=path.join(profile,'data');await fs.mkdir(copied,{recursive:true});
const originals={},selection={};const hash=b=>createHash('sha256').update(b).digest('hex');
async function files(dir){const all=[];for(const e of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){if(e.isSymbolicLink())continue;const f=path.join(dir,e.name);if(e.isDirectory())all.push(...await files(f));else all.push(f);}return all;}
async function copy(file){const rel=path.relative(source,file);assert(!rel.startsWith('..')&&!path.isAbsolute(rel));const b=await fs.readFile(file);originals[rel]=hash(b);await fs.mkdir(path.dirname(path.join(copied,rel)),{recursive:true});await fs.writeFile(path.join(copied,rel),b);}
for(const section of ['presets','character-presets','wildcards','base-prompts','undesired-prompts','params-presets']){
 const candidates=(await files(path.join(source,section))).filter(f=>f.endsWith('.json')&&!f.includes(path.sep+'revisions'+path.sep));
 for(const file of candidates){let record;try{record=JSON.parse(await fs.readFile(file,'utf8'));}catch{continue;}
  if(section==='presets'&&(!validatePreset(record).ok||validatePreset(record).warnings.length))continue;
  if(section==='presets'&&!record.metadata?.id)continue;if(section!=='presets'&&!record.id)continue;
  await copy(file);const thumb=path.join(path.dirname(file),'thumbnail.webp');if(await fs.access(thumb).then(()=>true).catch(()=>false))await copy(thumb);selection[section]={id:record.metadata?.id||record.id,file:path.relative(source,file)};break;
 }
}
assert(selection.presets&&selection['character-presets']&&selection.wildcards,'Actual profile must contain readable presets, characters and wildcards.');
const history=(await files(path.join(source,'generations'))).filter(f=>f.endsWith('.json')&&!f.endsWith('.payload.json')).sort().reverse();
for(const file of history){let r;try{r=JSON.parse(await fs.readFile(file,'utf8'));}catch{continue;}if(!r.camera_context||!r.internal_preset)continue;
 const base=path.basename(file,'.json');for(const related of (await fs.readdir(path.dirname(file))).filter(n=>n===base+'.json'||n.startsWith(base+'.')))await copy(path.join(path.dirname(file),related));selection.history={id:base,file:path.relative(source,file)};break;
}
assert(selection.history,'Actual legacy camera History is required.');
const oldWork=(await files(path.join(source,'camera','sessions'))).find(f=>f.endsWith('.json'));assert(oldWork);await copy(oldWork);selection.legacy_work=path.relative(source,oldWork);
await fs.writeFile(path.join(folder,'selection.private.json'),JSON.stringify({source,selection,originals},null,2));
async function preserved(){for(const[rel,digest]of Object.entries(originals)){assert.equal(hash(await fs.readFile(path.join(source,rel))),digest,'Original changed: '+rel);assert.equal(hash(await fs.readFile(path.join(copied,rel))),digest,'Copied original changed: '+rel);}}
const api=(page,url,body)=>page.evaluate(async({url,body})=>{const r=await fetch(url,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined);if(!r.ok)throw Error(url+' '+r.status);return r.json();},{url,body});
const open=async(p,id)=>{await p.locator('#openPresetLoadButton').click();await p.locator(`[data-load-preset="${id}"]`).click();await p.locator('#presetLoadDialog').waitFor({state:'hidden'});};
const checks=[],errors=[];let app;const port=await freePort();
try{
 app=await launchPortable(process.env.CHAESSI_OLD_PORTABLE,profile,port);let p=app.page;
 assert.equal((await api(p,'/api/health')).version,'3.8.1');await open(p,selection.presets.id);const originalPreset=(await api(p,'/api/presets/'+selection.presets.id)).preset;
 assert.equal(await p.locator('#basePrompt').inputValue(),originalPreset.prompt_parts.base);assert.equal((await api(p,'/api/generations')).items.length,1);await app.close();app=null;await preserved();checks.push('Actual v3.8.1 portable reads isolated real-data copies without changing any sampled file');
 app=await launchPortable(process.env.CHAESSI_NEW_PORTABLE,profile,port);p=app.page;p.on('pageerror',e=>errors.push(e.message));assert.equal((await api(p,'/api/health')).version,'3.8.2');await p.locator('#uiLanguage').selectOption('en');
 for(const section of Object.keys(selection).filter(k=>selection[k]?.id&&k!=='history')){assert((await api(p,'/api/'+section)).items.some(x=>x.id===selection[section].id),section);}
 await open(p,selection.presets.id);assert.deepEqual((await api(p,'/api/presets/'+selection.presets.id)).preset,originalPreset);
 const record=(await api(p,'/api/generations/'+selection.history.id)).generation;assert(record.camera_context);await p.locator('[data-workspace-view="history"]').click();await p.locator('#loadHistoryButton').click();await p.locator(`[data-view-generation="${selection.history.id}"]`).click();await p.locator('[data-viewer-reuse="camera-new"]').click();
 await p.locator('#cameraInputDialog').waitFor();assert.equal(await p.locator('#cameraInputYaw').inputValue(),'0');assert.equal(await p.locator('#cameraInputEnabled').isChecked(),true);await p.locator('#cameraInputLegacy summary').click();assert.deepEqual(JSON.parse(await p.locator('#cameraInputLegacyRecord').textContent()),record.camera_context);await p.locator('#cameraInputClose').click();
 await preserved();checks.push('v3.8.2 reads the same presets/assets/settings/History; legacy camera opens read-only, new camera starts at 0°');
 // Metadata reuse runs through the real UI; the camera import path always selects T2I.
 await p.locator('#cameraInputOpen').click();await p.locator('[data-camera-yaw="90"]').click();await p.locator('#cameraInputFile').setInputFiles(path.join(copied,selection.history.file.replace(/\.json$/,'.png')));await p.waitForFunction(()=>document.querySelector('#cameraInputYaw').value==='0');await p.locator('#cameraInputClose').click();
 await p.locator('[data-workspace-view="workbench"]').click();await open(p,selection.presets.id);await p.locator('#saveAsPresetButton').click();await p.locator('#confirmSavePresetButton').click();await p.locator('#presetSaveDialog').waitFor({state:'hidden'});
 const newPreset=(await api(p,'/api/presets')).items.find(x=>x.id!==selection.presets.id);assert(newPreset);await p.locator('#basePrompt').fill('private upgrade save and restore check');await p.locator('#savePresetButton').click();await p.locator('#confirmSavePresetButton').click();await p.locator('#presetSaveDialog').waitFor({state:'hidden'});assert.equal((await api(p,`/api/presets/${newPreset.id}/revisions`)).items.length,1);
 await p.locator('#presetRevisionsButton').click();await p.locator('[data-revision-id]').first().click();await p.locator('#presetRevisionsDialog').waitFor({state:'hidden'});assert.equal(await p.locator('#basePrompt').inputValue(),originalPreset.prompt_parts.base);await p.locator('#restoreSavedPresetButton').click();assert.equal(await p.locator('#basePrompt').inputValue(),'private upgrade save and restore check');
 await p.locator('#cameraInputOpen').click();await p.locator('#cameraInputNew').click();await p.locator('[data-camera-yaw="135"]').click();await p.locator('[data-camera-weight="direction"]').fill('1.7');await p.locator('#cameraInputName').fill('Isolated upgrade camera');await p.locator('#cameraInputSave').click();await p.waitForFunction(()=>document.querySelector('#cameraInputSaved').options.length===1);await p.locator('#cameraInputClose').click();
 await app.close();app=null;await preserved();checks.push('Save As, edit, revision restore and separate v3.8.2 camera save leave all copied originals unchanged');
 app=await launchPortable(process.env.CHAESSI_NEW_PORTABLE,profile,port);p=app.page;await open(p,newPreset.id);assert.equal(await p.locator('#basePrompt').inputValue(),'private upgrade save and restore check');await p.locator('#cameraInputOpen').click();assert.equal(await p.locator('#cameraInputEnabled').isChecked(),false);assert.equal(await p.locator('#cameraInputYaw').inputValue(),'0');await p.locator('#cameraInputLoad').click();await p.waitForFunction(()=>document.querySelector('#cameraInputYaw').value==='135');assert.equal(await p.locator('#cameraInputYaw').inputValue(),'135');assert.equal(await p.locator('[data-camera-weight="direction"]').inputValue(),'1.7');await p.locator('#cameraInputEnabled').uncheck();await p.locator('#cameraInputClose').click();
 assert.equal((await api(p,'/api/generations')).items.length,1);await app.close();app=null;await preserved();assert.deepEqual(errors,[]);checks.push('Actual EXE restart defaults OFF; explicit saved work resumes 135°/1.7; original History/image/camera files keep their hashes');
 const result={version:'3.8.2',checks,original_files:Object.keys(originals).length,sections:Object.keys(selection),originals_unchanged:true,copied_originals_unchanged:true,errors,paid_calls:0,folder};await fs.writeFile(path.join(folder,'results.json'),JSON.stringify(result,null,2));await fs.writeFile('.cache/v382/upgrade.latest.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await app?.page.screenshot({path:path.join(folder,'failure.private.png')}).catch(()=>{});await fs.writeFile(path.join(folder,'failure.json'),JSON.stringify({checks,error:error.message},null,2));throw error;}finally{await app?.close();await preserved();}
