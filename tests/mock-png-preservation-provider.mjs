import {encode} from '@msgpack/msgpack';
import {syntheticProviderPng} from './png-preservation-fixture.mjs';
import sharp from 'sharp';
// Every child-process external request fails closed except this synthetic
// response. No credentials, original provider session, or Internet are used.
globalThis.fetch=async(url,options)=>{
  if(String(url)!=='https://image.novelai.net/ai/generate-image-stream')throw Error('Unexpected external request in PNG preservation test');
  const request=JSON.parse(await options.body.get('request').text());
  if(request.model!=='nai-diffusion-5-full')throw Error('Unexpected test model');
  const image=process.env.CHAESSI_TEST_RESPONSE_FORMAT==='webp'?await sharp(syntheticProviderPng()).webp({lossless:true}).toBuffer():syntheticProviderPng();
  const bytes=Buffer.from(encode({event_type:'final',samp_ix:0,image})),head=Buffer.alloc(4);head.writeUInt32BE(bytes.length);
  return new Response(Buffer.concat([head,bytes]),{headers:{'content-type':'application/msgpack'}});
};
