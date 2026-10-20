import test from 'node:test';
import assert from 'node:assert/strict';
import {RESOLUTION_PRESETS,classifyResolution,resolutionError} from '../src/state/resolutions.js';
import {createDefaultPreset} from '../src/state/preset-schema.js';
import {buildV5GeneratePayload,validateV5Payload} from '../src/adapters/novelai-v5-full.js';
import {switchPresetEffort} from '../src/state/effort-state.js';
import {estimateGeneration} from '../src/image-tools/contracts.js';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createPresetStore} from '../src/services/preset-store.js';
import {switchPresetModel} from '../src/state/model-state.js';
import {parseRawJsonImport} from '../src/importers/raw-json-import.js';

test('Every official size round-trips to its category and exact High/Medium payload',()=>{
  let count=0;
  for(const [category,shapes]of Object.entries(RESOLUTION_PRESETS))for(const [orientation,[width,height]]of Object.entries(shapes)){
    count++;assert.deepEqual(classifyResolution(width,height),{category,orientation});assert.equal(resolutionError(width,height),null);
    const preset=createDefaultPreset({params:{model:'nai-diffusion-5-full',width,height,effort:'high'}});
    for(const effort of ['high','medium','high']){const changed=switchPresetEffort(preset,effort),payload=buildV5GeneratePayload(changed);assert.equal(payload.parameters.width,width);assert.equal(payload.parameters.height,height);assert.equal(validateV5Payload(payload).ok,true);assert.equal(changed.params.width,width);const cost=estimateGeneration(payload,{opusAvailable:true});assert.equal(cost.anlas>0,width*height>1_048_576);}
  }
  assert.equal(count,11);assert.equal(RESOLUTION_PRESETS.Wallpaper.Square,undefined);
});

test('Saved sizes, revisions, legacy model snapshots and raw imports keep exact dimensions',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'chaessi-resolution-'));
  try{
    const store=createPresetStore({rootDir:root});
    let preset=createDefaultPreset({params:{model:'nai-diffusion-5-full',width:1152,height:768,effort:'high'}});
    preset=await store.savePreset(preset);const id=preset.metadata.id;
    await store.savePreset({...preset,params:{...preset.params,width:1920,height:1088}});
    const current=await store.getPreset(id),revisions=await store.listPresetRevisions(id),old=await store.getPresetRevision(id,revisions[0].revision_id);
    assert.deepEqual([current.params.width,current.params.height],[1920,1088]);assert.deepEqual([old.params.width,old.params.height],[1152,768]);
    const legacy=switchPresetModel(current,'nai-diffusion-4-5-full');assert.equal(legacy.params.width,1920);legacy.params.width=1024;legacy.params.height=1536;
    const returned=switchPresetModel(legacy,'nai-diffusion-5-full');assert.deepEqual([returned.params.width,returned.params.height],[1920,1088]);
    const again=switchPresetModel(returned,'nai-diffusion-4-5-full');assert.deepEqual([again.params.width,again.params.height],[1024,1536]);
    const imported=parseRawJsonImport({model:'nai-diffusion-5-full-medium',parameters:{width:1152,height:768,steps:14}});assert.deepEqual([imported.parsed.params.width,imported.parsed.params.height],[1152,768]);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('Custom is derived without schema changes; invalid sizes fail instead of rounding',()=>{
  assert.deepEqual(classifyResolution(1152,768),{category:'Custom',orientation:'Landscape'});assert.equal(resolutionError(1152,768),null);
  for(const pair of [[0,832],['',832],[832.3,1216],[1000,1000],[Infinity,1024],[2048,2048]])assert.ok(resolutionError(...pair));
  assert.equal(resolutionError(2048,1536),null);
  const payload=buildV5GeneratePayload(createDefaultPreset({params:{model:'nai-diffusion-5-full',width:1000,height:1000}}));assert.equal(validateV5Payload(payload).ok,false);
});
