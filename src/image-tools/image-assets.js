import sharp from 'sharp';
import {TOOL_PIXEL_LIMIT,dimensions} from './contracts.js';
import {rectangle,focusedGeometry,outpaintGeometry} from './geometry.js';
export const shaOptions={limitInputPixels:TOOL_PIXEL_LIMIT};
export async function inspectToolPng(bytes) {
  if(bytes.length>64*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Choose a PNG image below 64 MB.');
  const meta=await sharp(bytes,shaOptions).metadata();dimensions(meta.width,meta.height);
  return {width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha};
}
export function base64Png(value) {
  if(typeof value!=='string'||value.length>90*1024*1024)throw new Error('Invalid PNG input.');
  const clean=value.replace(/^data:image\/png;base64,/, '');
  if(!clean||!/^[A-Za-z0-9+/=\r\n]+$/.test(clean))throw new Error('Invalid PNG input.');
  return Buffer.from(clean,'base64');
}
export async function resizeToolPng(bytes,width,height) {
  dimensions(width,height);return sharp(bytes,shaOptions).resize(width,height,{fit:'fill'}).ensureAlpha().png().toBuffer();
}
export async function prepareOutpaint(bytes,options) {
  const {width,height}=await inspectToolPng(bytes),g=outpaintGeometry(width,height,options);
  const source=await sharp(bytes,shaOptions).ensureAlpha().extend({left:g.left,right:g.right,top:g.top,bottom:g.bottom,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const mask=await sharp({create:{width:g.width,height:g.height,channels:3,background:'white'}}).composite([{input:await sharp({create:{width,height,channels:3,background:'black'}}).png().toBuffer(),left:g.left,top:g.top}]).removeAlpha().png().toBuffer();
  return {source,mask,geometry:g};
}
export async function prepareFocus(bytes,selection,context) {
  const {width,height}=await inspectToolPng(bytes),g=focusedGeometry(selection,width,height,context),r=g.crop;
  const crop=await sharp(bytes,shaOptions).extract({left:r.x,top:r.y,width:r.width,height:r.height}).png().toBuffer();
  const source=await resizeToolPng(crop,g.target.width,g.target.height);
  const logical=await sharp({create:{width:r.width,height:r.height,channels:3,background:'black'}}).composite([{input:await sharp({create:{width:g.selection.width,height:g.selection.height,channels:3,background:'white'}}).png().toBuffer(),left:g.selection.x-r.x,top:g.selection.y-r.y}]).removeAlpha().png().toBuffer();
  const mask=await sharp(logical).resize(g.target.width,g.target.height,{fit:'fill',kernel:'nearest'}).removeAlpha().png().toBuffer();
  return {source,mask,geometry:g};
}
export async function composeFocus(original,result,g) {
  const s=g.selection,r=g.crop;
  const patch=await sharp(result,shaOptions).resize(r.width,r.height,{fit:'fill'}).extract({left:s.x-r.x,top:s.y-r.y,width:s.width,height:s.height}).ensureAlpha().raw().toBuffer();
  const {data,info}=await sharp(original,shaOptions).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Replace only selected pixels. All other RGBA bytes are preserved exactly.
  for(let y=0;y<s.height;y++)patch.copy(data,((s.y+y)*info.width+s.x)*4,y*s.width*4,(y+1)*s.width*4);
  return sharp(data,{raw:info}).png().toBuffer();
}
export async function editCanvas(bytes,settings) {
  const {width,height}=await inspectToolPng(bytes);
  let image=sharp(bytes,shaOptions);
  if(settings.crop){const r=rectangle(settings.crop,width,height);image=image.extract({left:r.x,top:r.y,width:r.width,height:r.height});}
  if(settings.resize){const r=dimensions(Number(settings.resize.width),Number(settings.resize.height));image=image.resize(r.width,r.height,{fit:'fill'});}
  return image.ensureAlpha().png().toBuffer();
}
