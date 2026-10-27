// Rebuild preserved public help from pinned public commits, without private history.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=process.cwd(),archives=JSON.parse(await fs.readFile('tests/fixtures/public-help-archives.json','utf8'));
for(const archive of archives){
 assert(/^\d+\.\d+\.\d+$/.test(archive.version)&&/^[0-9a-f]{40}$/.test(archive.commit));
 const source=path.join(root,'.cache/help-archives',archive.version);await fs.mkdir(source,{recursive:true});
 const files=execFileSync('git',['ls-tree','-r','--name-only',archive.commit],{encoding:'utf8'}).trim().split('\n').filter(f=>/^(src\/|web\/help\/|assets\/manuals\/)/.test(f)||['package.json','scripts/build-help-site.mjs'].includes(f));
 for(const file of files){const target=path.resolve(source,file);assert(target.startsWith(source+path.sep));await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,execFileSync('git',['show',`${archive.commit}:${file}`],{maxBuffer:40*1024*1024}));}
 execFileSync(process.execPath,['scripts/build-help-site.mjs'],{cwd:source,stdio:'pipe'});
 const dir=path.join(source,'.pages-site','v'+archive.version),target=path.join(root,'.pages-site','v'+archive.version);
 for(const [file,digest]of Object.entries(archive.hashes)){const bytes=await fs.readFile(path.join(dir,file));assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,'Preserved help differs: '+file);await fs.mkdir(path.dirname(path.join(target,file)),{recursive:true});await fs.writeFile(path.join(target,file),bytes);}
 console.log(JSON.stringify({preserved_version:archive.version,commit:archive.commit,files:Object.keys(archive.hashes).length,all_hashes_equal:true}));
}
