export const WEIGHT_LIMIT=10;
export const WEIGHT_PRECISION=3;
export const roundWeight=value=>Math.round((value+Number.EPSILON)*1000)/1000;
export function parseWeight(text){
  if(!/^-?(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/.test(String(text)))throw new Error('Weight needs a complete number with at most 3 decimal places.');
  const value=Number(text);if(!Number.isFinite(value)||Math.abs(value)>WEIGHT_LIMIT)throw new Error('Supported camera weights: -10 to 10.');return value;
}
export const wrapAngle=value=>((value+180)%360+360)%360-180;
export function calibrationCoordinate(axis,value,center=0){return axis==='yaw'?wrapAngle(value-center):value;}
// Each term owns a bounded one-dimensional support. Knots interpolate gain,
// never normalized totals. Endpoints revert to the base mapping continuously.
export function calibratedWeight(base,knots,coordinate,support){
  if(!knots?.length||base===0)return base;
  const exact=knots.find(k=>Math.abs(k.x-coordinate)<1e-7);if(exact)return exact.value;
  const points=[{x:support[0],gain:1},...knots.map(k=>({x:k.x,gain:k.value/k.base})),{x:support[1],gain:1}]
    .sort((a,b)=>a.x-b.x);
  let a=points[0],b=points.at(-1);
  for(let i=1;i<points.length;i++)if(coordinate<=points[i].x){a=points[i-1];b=points[i];break;}
  const t=b.x===a.x?0:Math.max(0,Math.min(1,(coordinate-a.x)/(b.x-a.x)));
  const value=roundWeight(base*(a.gain+(b.gain-a.gain)*t));
  if(Math.abs(value)>WEIGHT_LIMIT)throw new Error('Interpolated weight exceeds the supported range. Adjust this calibration.');
  return value;
}
export function setCalibration(records,{key,axis,term,coordinate,base,value,context,field,cameraValue,label}){
  value=parseWeight(value);if(!(base>0))throw new Error('Only an active camera expression can be calibrated.');
  const next=structuredClone(records||{}),list=next[key]||[];
  const point={x:roundWeight(coordinate),base,value,axis,term,context,field,cameraValue,label};
  const index=list.findIndex(k=>Math.abs(k.x-point.x)<1e-7);
  if(index<0)list.push(point);else list[index]=point;
  next[key]=list.sort((a,b)=>a.x-b.x);return next;
}
