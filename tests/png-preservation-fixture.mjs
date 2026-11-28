import {deflateSync,gzipSync} from 'node:zlib';
import {encodeRgbaPng} from '../src/services/generation-image-utils.js';
import {appendPngText} from '../src/services/generation-png.js';

export const fixtureMetadata = {
  prompt:'synthetic blue triangle', uc:'synthetic negative', seed:123456, steps:23,
  scale:5.5, cfg_rescale:0.2, sampler:'k_euler_ancestral', noise_schedule:'karras',
  width:512, height:512, model:'nai-diffusion-5-full', effort:'high',
  v4_prompt:{caption:{base_caption:'synthetic blue triangle',char_captions:[{char_caption:'synthetic red square',centers:[{x:0.25,y:0.5}]}]}},
  v4_negative_prompt:{caption:{base_caption:'synthetic negative',char_captions:[{char_caption:'synthetic character negative',centers:[{x:0.25,y:0.5}]}]}},
  director_reference_descriptions:[{caption:{base_caption:'costume',char_captions:[]}}],
  director_reference_strength_values:[1.25],
  signed_hash:'synthetic-fixture-only-not-an-official-signature',
};
function chunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);let crc=0xffffffff;for(const byte of Buffer.concat([Buffer.from(type),data])){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}b.writeUInt32BE((crc^0xffffffff)>>>0,data.length+8);return b;}
export function syntheticProviderPng({stealthMetadata={Software:'NovelAI synthetic fixture',Comment:JSON.stringify(fixtureMetadata)}}={}){
  const width=512,height=512,pixels=Buffer.alloc(width*height*4,255);
  for(let i=0;i<width*height;i++){pixels[i*4]=30;pixels[i*4+1]=100;pixels[i*4+2]=180;}
  const text=JSON.stringify(stealthMetadata),packed=gzipSync(Buffer.from(text)),length=Buffer.alloc(4);length.writeUInt32BE(packed.length*8);
  const packet=Buffer.concat([Buffer.from('stealth_pngcomp'),length,packed]);
  for(let bit=0;bit<packet.length*8;bit++){const i=((bit%height)*width+Math.floor(bit/height))*4+3;pixels[i]=254|((packet[bit>>>3]>>>(7-bit%8))&1);}
  let png=encodeRgbaPng(pixels,width,height);const texts=[chunk('tEXt',Buffer.from('Software\0NovelAI synthetic fixture')),chunk('tEXt',Buffer.from('Comment\0'+JSON.stringify(fixtureMetadata))),chunk('tEXt',Buffer.from('Description\0synthetic blue triangle')),chunk('zTXt',Buffer.concat([Buffer.from('Synthetic compressed field\0\0'),deflateSync(Buffer.from('synthetic preserved text'))]))];
  png=Buffer.concat([png.subarray(0,-12),...texts,png.subarray(-12)]);
  return appendPngText(png,'Synthetic future metadata','synthetic preserved unicode text');
}
