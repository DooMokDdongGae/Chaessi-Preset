import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createTimestampId,ensureDir,toPosixPath,writeJsonFile,assertNoSecretMaterial} from '../services/file-store-utils.js';
export async function keepToolReceipt(rootDir,plan,bytes,responseInfo,actualAnlas){
  const now=new Date(),id=createTimestampId(now),folder=path.join('data','generations',now.toISOString().slice(0,10)),relative=suffix=>toPosixPath(path.join(folder,`${id}.receipt-${suffix}`)),dir=path.join(rootDir,folder);
  const payload=structuredClone(plan.payload);for(const key of ['image','mask']){if(payload?.[key])payload[key]=relative(key+'.png');if(payload?.parameters?.[key])payload.parameters[key]=relative(key+'.png');}
  const files=[relative('response.bin'),relative('metadata'),relative('original.png'),...Object.keys(plan.assets).map(key=>relative(key+'.png'))];
  const metadata={tool:plan.tool,origin:plan.origin,source_origin:plan.sourceOrigin,settings:plan.settings,geometry:plan.geometry,source_sha256:plan.sourceHash,payload,endpoint:plan.endpoint,captured_at:now.toISOString(),response_info:responseInfo,actual_anlas:actualAnlas,files};
  assertNoSecretMaterial(metadata,'image response receipt');await ensureDir(dir);
  await writeFile(path.join(rootDir,files[0]),bytes);await writeFile(path.join(rootDir,relative('original.png')),plan.source);
  for(const [key,value]of Object.entries(plan.assets))await writeFile(path.join(rootDir,relative(key+'.png')),value);
  await writeJsonFile(path.join(rootDir,relative('metadata')),metadata);return files;
}
export async function readToolResponse(response){
  const parts=[];let size=0;for await(const part of response.body){size+=part.length;if(size>128*1024*1024)throw new Error('Image response exceeds the bounded tool limit.');parts.push(Buffer.from(part));}return Buffer.concat(parts);
}
