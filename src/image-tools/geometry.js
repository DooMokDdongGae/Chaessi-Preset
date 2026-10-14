import {dimensions,GENERATION_PIXEL_LIMIT} from './contracts.js';
export function rectangle(value,width,height) {
  const out={};for(const key of ['x','y','width','height']){out[key]=Number(value?.[key]);if(!Number.isInteger(out[key]))throw new Error('Selection coordinates must be whole pixels.');}
  if(out.x<0||out.y<0||out.width<8||out.height<8||out.x+out.width>width||out.y+out.height>height)throw new Error('Selection must stay inside the image and be at least 8 pixels wide and high.');
  return out;
}
export function focusedGeometry(selection,width,height,context=64) {
  const selected=rectangle(selection,width,height),pad=Number(context);
  if(!Number.isInteger(pad)||pad<0||pad>1024)throw new Error('Context must be between 0 and 1024 pixels.');
  const x=Math.max(0,selected.x-pad),y=Math.max(0,selected.y-pad),w=Math.min(width,selected.x+selected.width+pad)-x,h=Math.min(height,selected.y+selected.height+pad)-y;
  const scale=Math.sqrt(1_048_576/(w*h));
  // Explicit focus path processes at most the Opus-size area, in 8px cells.
  const target={width:Math.max(8,Math.floor(w*scale/8)*8),height:Math.max(8,Math.floor(h*scale/8)*8)};
  dimensions(target.width,target.height,1_048_576);
  return {selection:selected,crop:{x,y,width:w,height:h},target,context:pad};
}
export function outpaintGeometry(width,height,options) {
  const out={};for(const key of ['left','top','right','bottom']){out[key]=Number(options?.[key]??0);if(!Number.isInteger(out[key])||out[key]<0||out[key]>2048)throw new Error('Canvas extension must be between 0 and 2048 pixels on each side.');}
  if(!Object.values(out).some(Boolean))throw new Error('Extend at least one side of the canvas.');
  const size=dimensions(width+out.left+out.right,height+out.top+out.bottom,GENERATION_PIXEL_LIMIT);
  if(size.width%8||size.height%8)throw new Error('Outpaint dimensions must be multiples of 8 pixels.');
  return {...out,...size};
}
export function mapToolCenter(center,tool,inputSize,geometry){
  const x=center.x*inputSize.width,y=center.y*inputSize.height;
  const target=tool==='outpaint'?{x:(x+geometry.left)/geometry.width,y:(y+geometry.top)/geometry.height}:{x:(x-geometry.crop.x)/geometry.crop.width,y:(y-geometry.crop.y)/geometry.crop.height};
  return {x:Math.min(1,Math.max(0,target.x)),y:Math.min(1,Math.max(0,target.y))};
}
