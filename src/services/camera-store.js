import path from 'node:path';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertNoSecretMaterial} from './file-store-utils.js';
const safe=id=>{if(!/^[a-zA-Z0-9_-]{1,140}$/.test(id))throw new Error('Invalid camera source ID.');return id;};
export function createCameraStore({rootDir}){
  const root=path.join(rootDir,'data','camera');let queue=Promise.resolve();
  return {
    async list(){try{const {readdir}=await import('node:fs/promises'),files=await readdir(path.join(root,'sessions'));return (await Promise.all(files.filter(f=>f.endsWith('.json')).map(async f=>{try{const s=JSON.parse(await readFile(path.join(root,'sessions',f),'utf8'));return {id:s.source.id,label:s.source.label,enabled:s.enabled,revision:s.revision};}catch{return null;}}))).filter(Boolean);}catch{return []; }},
    async get(id){try{return JSON.parse(await readFile(path.join(root,'sessions',safe(id)+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}},
    save(session){const task=async()=>{safe(session?.source?.id||'');assertNoSecretMaterial(session);const text=JSON.stringify(session);if(text.length>1_500_000)throw new Error('Camera session is too large.');await mkdir(path.join(root,'sessions'),{recursive:true});const file=path.join(root,'sessions',session.source.id+'.json');await writeFile(file+'.tmp',text);await rename(file+'.tmp',file);};const next=queue.then(task,task);queue=next.catch(()=>{});return next;},
    async saveImage(hash,bytes){if(!/^[a-f0-9]{64}$/.test(hash)||createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('Source image hash mismatch.');if(bytes.length>30*1024*1024)throw new Error('Camera source exceeds 30 MiB.');const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!png&&!webp)throw new Error('Camera metadata sources support PNG and WebP.');await mkdir(path.join(root,'images'),{recursive:true});await writeFile(path.join(root,'images',hash),bytes);return `/api/camera/sources/${hash}`;},
    async image(hash){if(!/^[a-f0-9]{64}$/.test(hash))throw new Error('Invalid source image hash.');return readFile(path.join(root,'images',hash));},
    async baseline(hash){if(!/^[a-f0-9]{64}$/.test(hash))return null;try{const data=JSON.parse(await readFile(path.join(root,'baseline-confirmations.json'),'utf8'));return data.items?.find(item=>item.sha256===hash)||null;}catch{return null;}},
  };
}
