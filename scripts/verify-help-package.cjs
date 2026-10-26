// Invoke using the packaged executable with ELECTRON_RUN_AS_NODE=1.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(process.argv[2]),sharp=require(path.join(root,'node_modules/sharp'));
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'))),version=await import(pathToFileURL(path.join(root,'src/state/build-version.js')));
 assert.equal(version.APP_VERSION,pkg.version);assert.equal(pkg.version,JSON.parse(fs.readFileSync(path.resolve('package.json'))).version);
 const {manualChapters}=await import(pathToFileURL(path.join(root,'src/ui/manual-content.js')));assert.equal(manualChapters.length,42);
 const files=new Set();for(const c of manualChapters)for(const locale of ['ko','en','ja']){
 files.add(`assets/manuals/${locale}/${c.image}.png`);for(const i of c.illustrations??[])files.add(i.screenshot?`assets/manuals/${locale}/${i.screenshot}.png`:`assets/manuals/examples/${i.file}`);
 }
 let bytes=0;for(const f of files){const b=fs.readFileSync(path.join(root,f));const m=await sharp(b).metadata();assert.ok(m.width&&m.height);bytes+=b.length;}
 assert.ok(fs.existsSync(path.join(root,'assets/manuals/ASSET_NOTICES.md')));
 for(const f of ['.cache','data','scripts/verify-help-live.mjs','scripts/launch-help-live-with-saved-token.mjs'])assert.equal(fs.existsSync(path.join(root,f)),false,f);
 console.log(JSON.stringify({version:pkg.version,chapters:manualChapters.length,images:files.size,image_bytes:bytes,private_credentials_and_test_data_excluded:true,paid_calls:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
