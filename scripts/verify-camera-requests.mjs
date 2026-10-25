import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cameraFixture,correctionAt40} from './camera-fixtures.mjs';
import {compileCamera,serializeCamera,moveCamera} from '../src/camera/camera-model.js';
const root=fileURLToPath(new URL('../',import.meta.url)),folder=path.join(root,'.cache/camera-panel/requests',String(Date.now()));
for(const d of ['presets','character-presets','character-preset-categories','generations','base-prompts','undesired-prompts','params-presets','wildcards'])await mkdir(path.join(folder,'data',d),{recursive:true});
const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['--import',new URL('../tests/mock-workbench-provider.mjs',import.meta.url).href,'server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),NAI_ACCESS_TOKEN:'test-local-only',CHAESSI_USER_DATA_DIR:folder},stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);
const request=async(route,body,expected=200)=>{const r=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),json=await r.json();assert.equal(r.status,expected,JSON.stringify(json));return json;};
const checks=[];
try{
  for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,60));}
  const session=correctionAt40(cameraFixture()),body={preset:session.draft,camera:serializeCamera(session),mode:'text-to-image'};
  const prepared=await request('/api/novelai/prepare',body),expected=compileCamera(session).preset;
  assert.deepEqual(prepared.preset.prompt_parts,expected.prompt_parts);assert(prepared.payload_preview.parameters.characterPrompts[0].prompt.includes('1.5::three-quarter front view from the right::'));checks.push('Prepared prompt and final adapter preview preserve exact calibrated weight');
  const generated=await request('/api/novelai/generate',{prepared_id:prepared.prepared_id,preset:prepared.preset,camera_revision:prepared.camera_revision,camera_source_id:prepared.camera_source_id});
  const history=(await (await fetch(base+'/api/generations/'+generated.generation.id)).json()).generation;
  assert.equal(history.camera_context.camera.yaw,40);assert.deepEqual(history.camera_context.calibrations,session.calibrations);assert.deepEqual(history.raw_payload,prepared.payload_preview);checks.push('Prepared transmission and History payload/camera/calibration agree');
  const direct=await request('/api/novelai/generate',body),directHistory=(await (await fetch(base+'/api/generations/'+direct.generation.id)).json()).generation;
  assert.deepEqual(directHistory.raw_payload,history.raw_payload);checks.push('Direct request applies camera once and matches prepared request');
  const stale=await request('/api/novelai/prepare',body);await request('/api/novelai/generate',{prepared_id:stale.prepared_id,camera_revision:stale.camera_revision+1,camera_source_id:stale.camera_source_id},409);checks.push('Stale camera revision rejected before provider');
  const other=await request('/api/novelai/prepare',body);await request('/api/novelai/generate',{prepared_id:other.prepared_id,camera_revision:other.camera_revision,camera_source_id:'different-source'},409);checks.push('Prepared source mismatch rejected');
  session.draft.params.effort='medium';moveCamera(session,'pan',.4);const medium=await request('/api/novelai/prepare',{preset:session.draft,camera:serializeCamera(session)});assert.equal(medium.payload_preview.parameters.steps,14);assert.equal(medium.preset.prompt_parts.undesired,'');checks.push('Medium contract retained and High calibration not leaked');
  const noCamera=await request('/api/novelai/prepare',{preset:cameraFixture().draft});assert.equal(noCamera.camera_revision,undefined);checks.push('Disabled/absent camera preserves ordinary preparation');
  const legacy=structuredClone(body);legacy.preset.params.model='nai-diffusion-4-5-full';delete legacy.preset.params.effort;delete legacy.preset.params.dataset;legacy.camera=null;await request('/api/novelai/prepare',legacy,400);checks.push('V4.5 is not silently converted');
  await writeFile(path.join(folder,'results.json'),JSON.stringify({checks,provider:'mock',liveNaiRequests:0,stderr},null,2));console.log(JSON.stringify({passed:checks.length,folder}));
}finally{child.kill();}
