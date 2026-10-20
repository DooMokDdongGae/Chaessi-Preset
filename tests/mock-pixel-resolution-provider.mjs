import './mock-image-tools-provider.mjs';
import {appendFileSync} from 'node:fs';
const prior=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  const target=String(url);
  if(target.startsWith('https://')&&process.env.CHAESSI_PROVIDER_TRACE){
    let dimensions=null;
    if(target.endsWith('/ai/generate-image-stream')){const p=JSON.parse(await options.body.get('request').text());dimensions={model:p.model,width:p.parameters.width,height:p.parameters.height};}
    appendFileSync(process.env.CHAESSI_PROVIDER_TRACE,JSON.stringify({url:target,method:options?.method??'GET',dimensions})+'\n');
  }
  if(target.startsWith('https://')&&process.env.CHAESSI_TEST_OFFLINE==='1')throw new Error('Internet is unavailable in this test');
  return prior(url,options);
};
