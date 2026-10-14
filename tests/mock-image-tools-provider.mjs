import './mock-workbench-provider.mjs';
import sharp from 'sharp';
import {encode} from '@msgpack/msgpack';
import {crc32} from '../src/image-tools/png-integrity.js';
import {maxEnhanceResultSize} from '../src/image-tools/contracts.js';
const previous=globalThis.fetch;
function archive(images){let offset=0;const local=[],directory=[];for(const [index,bytes]of images.entries()){const name=Buffer.from(`image_${index}.png`),head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt32LE(crc32(bytes),14);head.writeUInt32LE(bytes.length,18);head.writeUInt32LE(bytes.length,22);head.writeUInt16LE(name.length,26);local.push(head,name,bytes);const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50);cd.writeUInt32LE(crc32(bytes),16);cd.writeUInt32LE(bytes.length,20);cd.writeUInt32LE(bytes.length,24);cd.writeUInt16LE(name.length,28);cd.writeUInt32LE(offset,42);directory.push(cd,name);offset+=30+name.length+bytes.length;}const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(images.length,8);end.writeUInt16LE(images.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,central,end]);}
globalThis.fetch=async(url,options)=>{
 const target=String(url);
 if(target==='https://image.novelai.net/user/data')return new Response(JSON.stringify({subscription:{active:true,tier:3,trainingStepsLeft:{fixedTrainingStepsLeft:100,purchasedTrainingSteps:0},usage:{percent:80,isNegative:false}}}),{status:200});
 if(target.endsWith('/ai/upscale')||target.endsWith('/ai/augment-image')){
  const p=JSON.parse(await options.body.get('request').text()),source=Buffer.from(await options.body.get('image').arrayBuffer());
  const meta=await sharp(source).metadata(),w=p.req_type?p.width:meta.width*2,h=p.req_type?p.height:meta.height*2;
  const normal=await sharp(source).resize(w,h,{fit:'fill'}).ensureAlpha().png().toBuffer();
  const variants=p.req_type==='bg-removal'?await Promise.all([0,.5,1].map(alpha=>sharp({create:{width:w,height:h,channels:4,background:{r:30,g:80,b:140,alpha}}}).png().toBuffer())):[normal];
  return new Response(archive(variants),{status:200,headers:{'content-type':'application/zip'}});
 }
 if(target.endsWith('/ai/generate-image-stream')){
   const p=JSON.parse(await options.body.get('request').text());
   if(p.parameters.upscaled_enhance){const size=maxEnhanceResultSize(p.parameters.width,p.parameters.height),image=await sharp({create:{...size,channels:4,background:{r:30,g:60,b:130,alpha:.5}}}).png().toBuffer(),frame=Buffer.from(encode({event_type:'final',image})),head=Buffer.alloc(4);head.writeUInt32BE(frame.length);return new Response(Buffer.concat([head,frame]),{status:200,headers:{'content-type':'application/msgpack'}});}
 }
 return previous(url,options);
};
