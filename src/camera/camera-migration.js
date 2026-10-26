import {CAMERA_RULES,LEGACY_CAMERA_RULES,CAMERA_VOCABULARY,CAMERA_STRENGTH,
  baseExpressions,cameraContext,cameraCalibrationKey,checkpoint} from './camera-model.js';
import {promptFields} from './prompt-spans.js';
import {setCalibration,parseWeight} from './calibration.js';

const clone=value=>structuredClone(value);
const origin=session=>session.source.originId||session.source.id;
const fieldIdentity=(preset,field)=>field==='base'?'base':preset.prompt_parts.characters[Number(field.split(':')[1])]?.id;

// Fork only on explicit user action. Never mutate or replace a v1 record.
export function createSingleDirectionWork(previous,{id}){
  if(previous.rules!==LEGACY_CAMERA_RULES||!id||id===previous.source.id)throw new Error('Invalid camera migration.');
  if(Object.keys(previous.pending||{}).length)throw new Error('Finish the invalid prompt edit before moving the camera.');
  const next=clone(previous);
  next.rules=CAMERA_RULES;
  next.mapping={vocabulary:CAMERA_VOCABULARY,strength:CAMERA_STRENGTH};
  next.source={...next.source,id,originId:origin(previous)};
  next.legacyCalibrationArchive={rules:previous.rules,sourceId:previous.source.id,originId:origin(previous),
    fields:Object.fromEntries(promptFields(previous.draft).map(f=>[f.key,fieldIdentity(previous.draft,f.key)])),
    calibrations:clone(previous.calibrations)};
  next.calibrations={};next.calibrationEnabled=true;next.pending={};next.notes=[];
  next.checkpoint=null;next.revision=0;next.enabled=true;
  delete next.detachedPreset;
  return next;
}

export function legacyCalibrationCandidates(session){
  const archive=session.legacyCalibrationArchive;
  if(session.rules!==CAMERA_RULES||!archive)return [];
  const fields=promptFields(session.draft),context=cameraContext(session.draft),items=[];
  for(const [key,points] of Object.entries(archive.calibrations))points.forEach((point,index)=>{
    let reason='';
    if(archive.rules!==LEGACY_CAMERA_RULES||archive.originId!==origin(session))reason='source';
    else if(point.context!==context)reason='context';
    else if(!fields.some(f=>f.key===point.field)||!archive.fields[point.field]||archive.fields[point.field]!==fieldIdentity(session.draft,point.field))reason='field';
    else if(session.manual[point.field]!==undefined)reason='manual';
    else if(!Number.isFinite(point.cameraValue))reason='position';
    let expression;
    try{
      if(!reason){
        parseWeight(point.value);
        expression=baseExpressions(point.axis,point.cameraValue,CAMERA_RULES).find(e=>e.term===point.term&&e.text===point.label);
        if(!expression)reason='expression';
      }
    }catch{reason='value';}
    items.push({id:`${key}#${index}`,point:clone(point),eligible:!reason,reason,expression});
  });
  return items;
}

export function importLegacyCalibrations(session,ids){
  if(session.rules!==CAMERA_RULES||!Array.isArray(ids)||!ids.length)throw new Error('Select camera calibrations to import.');
  const candidates=legacyCalibrationCandidates(session),chosen=ids.map(id=>candidates.find(c=>c.id===id));
  if(chosen.some(c=>!c?.eligible)||new Set(ids).size!==ids.length)throw new Error('Camera calibration is not compatible.');
  let records=session.calibrations;
  for(const {point,expression} of chosen){
    records=setCalibration(records,{key:cameraCalibrationKey(session,point.field,point.axis,point.term),axis:point.axis,
      term:point.term,coordinate:expression.coordinate,base:expression.base,value:point.value,
      context:point.context,field:point.field,cameraValue:point.cameraValue,label:point.label});
  }
  session.checkpoint=checkpoint(session);session.calibrations=records;session.calibrationEnabled=true;session.revision++;
}
