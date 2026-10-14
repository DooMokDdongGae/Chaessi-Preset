import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const hits=[];let inspected=0;
const credential=/pst-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{25,}|eyJ[A-Za-z0-9_-]{25,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{40,}/;
async function inspect(file,scope){const rel=scope==='source'?file:path.relative(path.join(root,'dist/win-unpacked/resources/app'),file).replaceAll('\\','/');
 if(/^(?:\.cache|data|secrets|logs|dist)(?:\/|$)|(?:^|\/)(?:tokens\.json|Local State|Cookies|PRIVATE_[^/]+)$/.test(rel)){hits.push({scope,file:rel,reason:'private or generated data'});return;}
 const b=await fs.readFile(file);inspected++;if(!/\.(?:js|mjs|cjs|json|html|css|md|txt|yml|yaml|example)$/.test(file))return;
 const s=b.toString('utf8');if(credential.test(s))hits.push({scope,file:rel,reason:'credential-shaped value'});
 if(!rel.startsWith('node_modules/')&&/(?:[A-Z]:[\\/](?:Users[\\/][^\\/]+|AI[\\/]))|PRIVATE_V360(?:_|\.)|3\.6\.0-private\.[123]/i.test(s))hits.push({scope,file:rel,reason:'private development identifier'});
}
const source=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);for(const f of [...new Set(source)])await inspect(f,'source');
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else await inspect(file,'package');}}
await walk(path.join(root,'dist/win-unpacked/resources/app'));
await fs.mkdir('.cache',{recursive:true});const result={inspected,source_files:source.length,hits};await fs.writeFile('.cache/release-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,hits:hits.slice(0,15)}));if(hits.length)process.exitCode=1;
