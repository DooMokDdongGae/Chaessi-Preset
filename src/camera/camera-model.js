import {scanPrompt,promptFields,readField,writeField} from './prompt-spans.js';
import {calibratedWeight,calibratedSingleWeight,setCalibration,calibrationCoordinate,wrapAngle,parseWeight,roundWeight} from './calibration.js';
import {CAMERA_RULES,LEGACY_CAMERA_RULES,CAMERA_VOCABULARY,CAMERA_STRENGTH,supportsCameraRules,singleExpression} from './camera-rules.js';

export {CAMERA_RULES,LEGACY_CAMERA_RULES,CAMERA_VOCABULARY,CAMERA_STRENGTH,supportsCameraRules};
export const AXES=['yaw','elevation','pan','tilt','height','framing','roll'];
const clone=value=>structuredClone(value);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const format=value=>String(Math.round(value*1000)/1000);
const escapeRx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const yawNames=['front view','three-quarter front view from the right','right side view','three-quarter rear view from the right','from behind','three-quarter rear view from the left','left side view','three-quarter front view from the left'];
export const CAMERA_LABELS={yaw:'방향',elevation:'상하 시점',pan:'제자리 팬',tilt:'제자리 틸트',height:'카메라 높이',framing:'거리·프레이밍',roll:'롤'};
export function cameraContext(preset){return `${preset?.params?.model}|${preset?.params?.effort||'high'}`;}
export function inferBaseline(preset,field){
  const fields=promptFields(preset).map(f=>({...f,scan:scanPrompt(f.text)}));
  const selected=fields.find(f=>f.key===field)||fields.reduce((a,b)=>b.scan.hints.length>a.scan.hints.length?b:a,fields[0]);
  const hints=selected.scan.hints, terms=axis=>hints.filter(h=>h.axis===axis).map(h=>h.term), yaw=terms('yaw');
  const baseline={yaw:null,elevation:null,pan:0,tilt:0,height:null,framing:null,roll:null};
  const evidence={};
  function known(axis,value){baseline[axis]=value;evidence[axis]='actual-prompt category';}
  if(yaw.length&&yaw.every(t=>t==='front'))known('yaw',0);
  if(yaw.length&&yaw.every(t=>t==='back'))known('yaw',180);
  for(const [term,value] of Object.entries({frontRight:45,sideRight:90,rearRight:135,frontLeft:-45,sideLeft:-90,rearLeft:-135}))if(yaw.length&&yaw.every(t=>t===term))known('yaw',value);
  // Diagonals without a side remain unknown; rear plus rear-diagonal is a refinement.
  const elevations={eye:0,above:35,below:-35,bird:80,worm:-80};
  const heights={floor:0,waist:.33,eye:.67,high:1},frames={close:0,upper:.25,cowboy:.5,full:.75,wide:1};
  for(const [axis,values] of [['elevation',elevations],['height',heights],['framing',frames]]){const unique=[...new Set(terms(axis))];if(unique.length===1)known(axis,values[unique[0]]);}
  const missing=AXES.filter(a=>baseline[a]===null);
  return {field:selected.key,baseline,evidence,missing,hints,blocked:selected.scan.blocked.map(n=>({axes:n.axes,reason:n.reason})),fields:fields.map(f=>({key:f.key,label:f.label,hints:f.scan.hints.length}))};
}
export function createCameraSession({preset,source,confirmed={},rules=CAMERA_RULES}){
  if(!supportsCameraRules(rules))throw new Error('Unsupported camera rule version.');
  const inference=inferBaseline(preset);Object.assign(inference.baseline,confirmed.values||{});Object.assign(inference.evidence,confirmed.evidence||{});
  return {rules,...(rules===CAMERA_RULES?{mapping:{vocabulary:CAMERA_VOCABULARY,strength:CAMERA_STRENGTH}}:{}),source:clone(source),sourcePreset:clone(preset),draft:clone(preset),field:inference.field,
    baseline:inference.baseline,evidence:inference.evidence,camera:clone(inference.baseline),activeAxes:[],calibrations:{},calibrationEnabled:true,
    calibrationContext:cameraContext(preset),manual:{},revision:0,enabled:true,pending:{},notes:[],checkpoint:null};
}
export function confirmBaseline(session,values){for(const [axis,value] of Object.entries(values)){if(!AXES.includes(axis)||!Number.isFinite(value))throw new Error('Invalid camera baseline.');session.baseline[axis]=value;session.camera[axis]=value;session.evidence[axis]='user-confirmed category';}session.revision++;return session;}
export function moveCamera(session,axis,value){
  if(!AXES.includes(axis)||!Number.isFinite(value))throw new Error('Invalid camera control.');
  session.pending||={};
  if(Object.keys(session.pending).length)throw new Error('Finish the invalid prompt edit before moving the camera.');
  if(['yaw','elevation','framing'].includes(axis)&&session.baseline[axis]===null)throw new Error(`먼저 원본의 ${CAMERA_LABELS[axis]} 기준을 확인하세요.`);
  session.camera[axis]=roundWeight(axis==='yaw'?wrapAngle(value):clamp(value,...(axis==='elevation'?[-85,85]:axis==='roll'?[-60,60]:['pan','tilt'].includes(axis)?[-1,1]:[0,1])));
  if(!session.activeAxes.includes(axis))session.activeAxes.push(axis);session.revision++;return session;
}
function anchors(axis){
  if(axis==='elevation')return [[-85,'worm',"worm's-eye view"],[-35,'below','from below'],[0,'eye','eye level'],[35,'above','from above'],[85,'bird',"bird's-eye view"]];
  if(axis==='height')return [[0,'floor','camera at floor level'],[.33,'waist','camera at waist height'],[.67,'eye','camera at eye height'],[1,'high','camera above head height']];
  if(axis==='framing')return [[0,'close','close-up'],[.25,'upper','upper body'],[.5,'cowboy','cowboy shot'],[.75,'full','full body'],[1,'wide','wide shot']];
  return null;
}
export function baseExpressions(axis,value,rules=CAMERA_RULES){
  if(!supportsCameraRules(rules))throw new Error('Unsupported camera rule version.');
  if(value===null)return [];
  if(!AXES.includes(axis)||!Number.isFinite(value))throw new Error('Invalid camera control.');
  if(rules===CAMERA_RULES){
    value=roundWeight(value);
    const single=singleExpression(axis,value,yawNames,anchors(axis));
    if(single)return single;
  }
  if(axis==='yaw'){
    const unit=((value+360)%360)/45,low=Math.floor(unit),fraction=unit-low;
    return [[low,1-fraction],[(low+1)%8,fraction]].filter(([,amount])=>amount>.00001).map(([i,amount])=>({axis,term:`bearing-${i}`,text:yawNames[i],base:Math.round(amount*12)/10,coordinate:calibrationCoordinate(axis,value,i*45),support:[-45,45]})).filter(x=>x.base>0);
  }
  const list=anchors(axis);
  if(list){
    const expressions=[];
    for(let i=0;i<list.length;i++){
      const [point,term,text]=list[i],left=list[i-1]?.[0]??point-.5,right=list[i+1]?.[0]??point+.5;
      const strength=value===point?1:value<point?(value-left)/(point-left):(right-value)/(right-point);
      const base=Math.round(clamp(strength,0,1)*12)/10;
      if(base>0)expressions.push({axis,term,text,base,coordinate:value,support:[left,right]});
    }return expressions;
  }
  if(Math.abs(value)<.001)return [];
  const positive=value>0,mag=Math.abs(value)/(axis==='roll'?60:1);
  const text=axis==='pan'?(positive?'camera pans right; framing shifts right; subject left in frame':'camera pans left; framing shifts left; subject right in frame'):axis==='tilt'?(positive?'camera tilts upward at a fixed position':'camera tilts downward at a fixed position'):(positive?'dutch angle; frame rotated clockwise':'dutch angle; frame rotated counterclockwise');
  return [{axis,term:positive?'positive':'negative',text,base:Math.round((.6+.6*mag)*10)/10,coordinate:value,support:positive?[0,axis==='roll'?61:1.01]:[axis==='roll'?-61:-1.01,0]}];
}
export function cameraCalibrationKey(session,field,axis,term){
  const legacy=`${cameraContext(session.draft)}|${field}|${axis}|${term}`;
  const identity=field==='base'?'base':session.draft.prompt_parts.characters[Number(field.split(':')[1])]?.id;
  return session.rules===LEGACY_CAMERA_RULES?legacy:`${session.rules}|${CAMERA_VOCABULARY}|${identity}|${legacy}`;
}
function expressionsFor(session,axis){
  return baseExpressions(axis,session.camera[axis],session.rules).map(item=>{
    const key=cameraCalibrationKey(session,session.field,axis,item.term);
    const applicable=session.calibrationEnabled;
    const calibrate=session.rules===LEGACY_CAMERA_RULES?calibratedWeight:calibratedSingleWeight;
    return {...item,key,weight:applicable?calibrate(item.base,session.calibrations[key],item.coordinate,item.support):item.base};
  });
}
function cameraConflicts(preset,session,expressions=[]){
  const active=new Set(session.activeAxes),items=[];
  for(const field of promptFields(preset)){
    const parsed=scanPrompt(field.text);
    for(const binding of [...parsed.bindings,...parsed.blocked])for(const term of binding.terms||[]){
      if(!active.has(term.axis)||term.axis==='gaze')continue;
      const owned=field.key===session.field&&expressions.some(e=>binding.start<=e.start&&binding.end>=e.end);
      if(!owned)items.push({field:field.key,axis:term.axis,text:term.text,start:binding.start});
    }
  }
  return items;
}
export function compileCamera(session,preset=session.draft){
  if(!supportsCameraRules(session.rules))throw new Error('Unsupported camera rule version.');
  if(session.rules===CAMERA_RULES&&session.mapping&&(session.mapping.vocabulary!==CAMERA_VOCABULARY||session.mapping.strength!==CAMERA_STRENGTH))throw new Error('Unsupported camera rule version.');
  const result=clone(preset),fields={},notes=[];let errors=[];
  if(!session.enabled)return {preset:result,fields,notes,errors};
  for(const [field,text] of Object.entries(session.manual||{})){
    if(promptFields(result).some(f=>f.key===field))writeField(result,field,text);
    else notes.push(`${field}: 삭제되거나 비활성화된 문구의 수동 편집과 보정을 보관 중입니다.`);
  }
  if(Object.keys(session.pending||{}).length)errors.push('Incomplete or invalid camera prompt edit.');
  const source=readField(result,session.field);if(source===undefined||!promptFields(result).some(f=>f.key===session.field))return {preset:result,fields,notes,errors:['관리하던 슬롯이 삭제되거나 비활성화됐습니다. 활성 문구를 선택하세요. 기존 보정은 보관 중입니다.']};
  const scan=scanPrompt(source);errors.push(...scan.errors);
  if(session.manual[session.field]!==undefined){notes.push('수동 문구 유지 · 카메라 관리 재개를 누르면 연결합니다.');fields[session.field]={text:source,expressions:[],pieces:[{outputStart:0,outputEnd:source.length,sourceStart:0}]};return {preset:result,fields,notes,errors,conflicts:cameraConflicts(result,session)};}
  const active=new Set(session.activeAxes),blocked=new Set(scan.blocked.flatMap(n=>n.axes));
  for(const axis of active)if(blocked.has(axis)){notes.push(`${CAMERA_LABELS[axis]}: 혼합 가중치 묶음을 보존했습니다. 해당 축은 적용 보류.`);active.delete(axis);}
  if(session.calibrationContext!==cameraContext(preset))notes.push('모델/Effort가 바뀌어 이전 보정을 보류했습니다. 원래 조건에서는 재사용됩니다.');
  const applicable=[];for(const axis of AXES.filter(a=>active.has(a)))try{applicable.push(...expressionsFor({...session,draft:preset},axis));}catch(e){errors.push(e.message);}
  const replacements=[],generated=[];
  const removed=scan.bindings.filter(b=>b.terms.some(t=>active.has(t.axis)));
  // Remove only owned source spans, leaving punctuation, spacing and every other byte intact.
  for(const binding of removed){
    const retained=binding.terms.filter(t=>!active.has(t.axis));
    replacements.push({start:binding.start,end:binding.end,text:retained.map(t=>`${format(t.weight)}::${t.text}::`).join(', ')});
  }
  // Viewer tracking is optional and explicitly experimental; head-pose atoms are never owned.
  if(session.releaseViewer&&session.baseline.yaw!==null&&Math.abs(wrapAngle(session.camera.yaw-session.baseline.yaw))>15){
    for(const b of scan.bindings)if(b.terms.every(t=>t.axis==='gaze'))replacements.push({start:b.start,end:b.end,text:''});
    notes.push('시선 실험: looking at viewer 제약 해제. 고개 자세 문구는 유지.');
  }
  for(const item of applicable)generated.push({...item,textValue:`${format(item.weight)}::${item.text}::`});
  const addition=generated.map(x=>x.textValue).join(', ');
  const insertAt=removed.length?removed[0].start:source.length;
  if(addition){const target=replacements.find(r=>r.start===insertAt);if(target){target.generated=generated;target.text=addition+(target.text?', '+target.text:'');}else replacements.push({start:insertAt,end:insertAt,text:(source.trim()?', ':'')+addition,generated,prefix:source.trim()?', ':''});}
  replacements.sort((a,b)=>a.start-b.start);
  let cursor=0,text='',pieces=[],expressions=[];
  for(const replacement of replacements){
    if(replacement.start<cursor)continue;
    pieces.push({outputStart:text.length,outputEnd:text.length+replacement.start-cursor,sourceStart:cursor});text+=source.slice(cursor,replacement.start);
    let offset=text.length+(replacement.prefix?.length||0);
    for(const item of replacement.generated||[]){const number=format(item.weight);expressions.push({...item,start:offset,end:offset+item.textValue.length,weightStart:offset,weightEnd:offset+number.length});offset+=item.textValue.length+2;}
    text+=replacement.text;cursor=replacement.end;
  }
  pieces.push({outputStart:text.length,outputEnd:text.length+source.length-cursor,sourceStart:cursor});text+=source.slice(cursor);
  fields[session.field]={text,expressions,pieces};writeField(result,session.field,text);
  return {preset:result,fields,notes,errors,conflicts:cameraConflicts(result,session,expressions)};
}
function difference(before,after){let start=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;let a=before.length,b=after.length;while(a>start&&b>start&&before[a-1]===after[b-1]){a--;b--;}return {start,end:a,replacement:after.slice(start,b)};}
export function editCameraOutput(session,field,text){
  const output=compileCamera({...session,pending:{}}).fields[field];if(!output)throw new Error('Camera field is not available.');
  if(text===output.text){delete session.pending[field];return {kind:'unchanged'};}
  let template='^',cursor=0;
  for(const item of output.expressions){template+=escapeRx(output.text.slice(cursor,item.weightStart))+'(.*?)';cursor=item.weightEnd;}
  template+=escapeRx(output.text.slice(cursor))+'$';
  const match=text.match(new RegExp(template,'s'));
  if(match&&output.expressions.length){
    try{
      const values=match.slice(1).map(parseWeight);let records=session.calibrations;
      output.expressions.forEach((item,index)=>{if(values[index]!==item.weight)records=setCalibration(records,{key:item.key,axis:item.axis,term:item.term,coordinate:item.coordinate,base:item.base,value:values[index],context:cameraContext(session.draft),field,cameraValue:session.camera[item.axis],label:item.text});});
      session.calibrations=records;session.calibrationEnabled=true;session.calibrationContext=cameraContext(session.draft);delete session.pending[field];session.revision++;return {kind:'calibration'};
    }catch(error){session.pending[field]={text,error:error.message};session.revision++;return {kind:'invalid',error:error.message};}
  }
  const parsed=scanPrompt(text);
  if(parsed.errors.length){session.pending[field]={text,error:parsed.errors.join('; ')};session.revision++;return {kind:'invalid',error:parsed.errors.join('; ')};}
  const diff=difference(output.text,text),piece=output.pieces.find(p=>diff.start>=p.outputStart&&diff.end<=p.outputEnd);
  if(piece&&session.manual[field]===undefined){const original=readField(session.draft,field),start=piece.sourceStart+diff.start-piece.outputStart,end=piece.sourceStart+diff.end-piece.outputStart;writeField(session.draft,field,original.slice(0,start)+diff.replacement+original.slice(end));}
  else session.manual[field]=text;
  delete session.pending[field];session.revision++;return {kind:session.manual[field]!==undefined?'manual':'draft'};
}
export function resetCamera(session){session.checkpoint=checkpoint(session);session.camera=clone(session.baseline);session.activeAxes=[];session.revision++;}
// Ordinary editor changes retain corrections unless the owned source atoms changed.
// A changed target is explicit manual work; the archived corrections remain recoverable.
export function syncCameraDraft(session,preset){
  if(JSON.stringify(session.draft)===JSON.stringify(preset))return;
  const before=readField(session.draft,session.field),after=readField(preset,session.field);
  if(before!==after&&after!==undefined){
    const signature=text=>{const scan=scanPrompt(text);return JSON.stringify([...scan.bindings,...scan.blocked].map(b=>b.text));};
    if(session.manual[session.field]!==undefined||signature(before)!==signature(after)){
      session.checkpoint=checkpoint(session);session.manual[session.field]=after;
    }
  }
  session.draft=clone(preset);session.revision++;
}
export function resetCalibration(session){session.checkpoint=checkpoint(session);session.calibrationEnabled=false;session.revision++;}
export function cancelCameraEdit(session,field=session.field){session.checkpoint=checkpoint(session);delete session.pending[field];session.revision++;}
export function detachCamera(session){
  const compiled=compileCamera(session);
  if(compiled.errors.length)throw new Error('Fix or cancel the incomplete edit before disabling camera. Your input is retained.');
  session.detachedPreset=clone(compiled.preset);session.enabled=false;session.revision++;
  return clone(compiled.preset);
}
export function reconnectCamera(session,preset){
  if(session.detachedPreset&&JSON.stringify(preset)!==JSON.stringify(session.detachedPreset))syncCameraDraft(session,preset);
  delete session.detachedPreset;session.enabled=true;session.revision++;
}
export function restoreSource(session){session.checkpoint=checkpoint(session);session.draft=clone(session.sourcePreset);session.camera=clone(session.baseline);session.activeAxes=[];session.manual={};session.pending={};session.calibrationEnabled=false;session.revision++;}
export function checkpoint(session){const saved=clone(session);delete saved.checkpoint;return saved;}
export function undoCamera(session){if(!session.checkpoint)return session;const previous=session.checkpoint;previous.revision=session.revision+1;previous.checkpoint=null;return previous;}
export function resumeManagedField(session){session.checkpoint=checkpoint(session);if(session.manual[session.field]!==undefined){writeField(session.draft,session.field,session.manual[session.field]);delete session.manual[session.field];}session.pending={};session.revision++;}
export function serializeCamera(session){const record=checkpoint(session);delete record.pending;delete record.notes;delete record.detachedPreset;return record;}
export function cameraRequest(preset,record){
  if(!record)return {preset:clone(preset),camera:null};
  if(!supportsCameraRules(record.rules)||!record.source?.id||!Array.isArray(record.activeAxes)||record.activeAxes.some(a=>!AXES.includes(a)))throw new Error('Invalid camera session.');
  const session={...clone(record),draft:clone(preset),pending:record.pending||{}};
  const compiled=compileCamera(session,preset);if(compiled.errors.length)throw new Error(compiled.errors.join('; '));
  const camera=serializeCamera(session);
  if(session.rules===CAMERA_RULES)camera.resolvedExpressions=Object.fromEntries(Object.entries(compiled.fields).map(([field,value])=>[field,value.expressions.map(({axis,term,text,weight,coordinate})=>({axis,term,text,weight,coordinate}))]));
  return {preset:compiled.preset,camera,notes:compiled.notes};
}
