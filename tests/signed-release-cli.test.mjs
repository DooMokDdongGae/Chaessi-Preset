import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {KEYSET_SCHEMA, keyRecord, rawPublicKey, verifyDocument, verifyReleaseBundle,
  verifyPackage, canonicalBytes, sha256} from '../scripts/signed-release.mjs';

// Synthetic encrypted keys live only in an OS temporary directory, never in the repo.
// No actual PE/runtime validation, production key generation, network or paid request.
const cli=fileURLToPath(new URL('../scripts/sign-preset-release.mjs',import.meta.url));
const stamp=n=>new Date(n).toISOString().replace(/\.\d{3}Z$/,'Z');
function run(args,password,nodeArgs=[]) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[...nodeArgs,cli,...args],{stdio:['ignore','pipe','pipe','pipe'],windowsHide:true});
    let stdout='',stderr='';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>stdout+=chunk); child.stderr.on('data',chunk=>stderr+=chunk);
    child.on('error',reject);
    child.stdio[3].on('error',()=>{}); // rejected commands can close before consuming the pipe
    child.stdio[3].end(password);
    child.on('close',code=>{
      assert.equal((stdout+stderr).includes(password.toString('utf8')),false,'passphrase must never be logged');
      resolve({code,stdout,stderr});
    });
  });
}

// Observe ordering in the actual CLI process without reading or recording key bytes.
// Artifact-boundary rejection must precede encrypted-key reads and inventory hashing.
async function rejectionProbe(directory,keyFile) {
  const marker=path.join(directory,'unexpected-signing-stage.txt');
  const preload=path.join(directory,'signing-stage-probe.mjs');
  await fs.writeFile(preload,`import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
const target=${JSON.stringify(path.resolve(keyFile))},marker=${JSON.stringify(marker)};
const read=fs.readFileSync,open=fsp.open;
fs.readFileSync=function(filename,...args) {
  if(typeof filename==='string' && path.resolve(filename)===target) fs.writeFileSync(marker,'key-read');
  return read.call(this,filename,...args);
};
fsp.open=async function(...args) {
  fs.writeFileSync(marker,'inventory-hash');
  return open.apply(this,args);
};
`);
  return {marker,nodeArgs:['--import',pathToFileURL(preload).href]};
}

test('real signing CLI uses encrypted Ed25519 PKCS8 and fd3 only',async t=>{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'chaessi-sign-cli-unit-'));
  const password=Buffer.from(randomBytes(32).toString('base64'));
  t.after(async()=>{password.fill(0); await fs.rm(base,{recursive:true,force:true});});
  const root=generateKeyPairSync('ed25519'),signer=generateKeyPairSync('ed25519');
  const rootPem=path.join(base,'root.encrypted.pem'),signerPem=path.join(base,'release.encrypted.pem');
  for(const [filename,key] of [[rootPem,root.privateKey],[signerPem,signer.privateKey]]) {
    await fs.writeFile(filename,key.export({type:'pkcs8',format:'pem',cipher:'aes-256-cbc',passphrase:password}),{mode:0o600});
  }
  const now=Date.now(),issuedAt=stamp(now-60000),expiresAt=stamp(now+86400000);
  const rootPublic=path.join(base,'root-public.bin'); await fs.writeFile(rootPublic,rawPublicKey(root.publicKey));
  const record=keyRecord(signer.publicKey,issuedAt,expiresAt);
  const keyset={schema:KEYSET_SCHEMA,issuer:'chaessi-studio',product:'chaessi-preset',channel:'private',
    sequence:1,issuedAt,expiresAt,keys:[record],revokedKeyIds:[]};
  const keysMetadata=path.join(base,'keyset-input.json'); await fs.writeFile(keysMetadata,JSON.stringify(keyset));
  const keysOutput=path.join(base,'signed-keyset');
  const keyArgs=['sign-keyset','--metadata',keysMetadata,'--key-file',rootPem,'--passphrase-fd','3','--output',keysOutput];
  const keysetFile=path.join(keysOutput,'chaessi-publisher-keys.json');
  const keysetSig=path.join(keysOutput,'chaessi-publisher-keys.sig');
  await t.test('sign-keyset emits canonical metadata verifiable under separate root',async()=>{
    const probe=await rejectionProbe(base,rootPem);
    const result=await run(keyArgs,password,probe.nodeArgs); assert.equal(result.code,0,result.stderr);
    assert.equal(await fs.readFile(probe.marker,'utf8'),'key-read','sibling key is allowed and probe is active');
    await fs.unlink(probe.marker);
    const bytes=await fs.readFile(keysetFile),signature=await fs.readFile(keysetSig);
    assert.deepEqual(bytes,canonicalBytes(keyset));
    assert.deepEqual(verifyDocument(bytes,signature,rawPublicKey(root.publicKey),KEYSET_SCHEMA),keyset);
    assert.equal(JSON.parse(result.stdout).publicKeySha256,sha256(rawPublicKey(root.publicKey)));
    const initial=sha256(bytes),again=await run(keyArgs,password);
    assert.notEqual(again.code,0); assert.equal(sha256(await fs.readFile(keysetFile)),initial);
  });

  const runtime=path.join(base,'runtime'); await fs.mkdir(path.join(runtime,'bin'),{recursive:true});
  const launcher=path.join(runtime,'bin','Synthetic.exe'); await fs.writeFile(launcher,'synthetic-exe');
  await fs.writeFile(path.join(runtime,'app.asar'),'synthetic-resource');
  const metadata={releaseId:'cli-synthetic',version:'3.8.5-private.1',sequence:1,issuedAt,expiresAt,
    keyId:record.keyId,minKeysetSequence:1,receiver:'bin/Synthetic.exe',layout:'unpacked'};
  const metadataFile=path.join(base,'release-input.json'); await fs.writeFile(metadataFile,JSON.stringify(metadata));
  const releaseArgs=['sign-release','--metadata',metadataFile,'--key-file',signerPem,'--passphrase-fd','3',
    '--runtime',runtime,'--launcher',launcher,'--keyset',keysetFile,'--keyset-signature',keysetSig,'--root-public',rootPublic];
  let release;
  await t.test('sign-release verifies root-signed keyset and writes exact unpacked sidecars',async()=>{
    const probe=await rejectionProbe(base,signerPem);
    const result=await run(releaseArgs,password,probe.nodeArgs); assert.equal(result.code,0,result.stderr);
    assert.equal(await fs.readFile(probe.marker,'utf8'),'inventory-hash','sibling key is allowed and hash probe is active');
    await fs.unlink(probe.marker);
    const bytes=await fs.readFile(launcher+'.chaessi-release.json'),signature=await fs.readFile(launcher+'.chaessi-release.sig');
    const keys=await fs.readFile(path.join(path.dirname(launcher),'chaessi-publisher-keys.json'));
    const keysSig=await fs.readFile(path.join(path.dirname(launcher),'chaessi-publisher-keys.sig'));
    ({release}=verifyReleaseBundle(bytes,signature,keys,keysSig,rawPublicKey(root.publicKey)));
    assert.deepEqual(release.files.map(f=>f.path),['app.asar','bin/Synthetic.exe']);
    assert.equal(await verifyPackage(release,runtime,launcher),true);
    assert.equal(JSON.parse(result.stdout).releaseSha256,sha256(bytes));
    const again=await run(releaseArgs,password); assert.notEqual(again.code,0);
    assert.deepEqual(await fs.readFile(launcher+'.chaessi-release.json'),bytes);
  });
  await t.test('exact metadata sidecar exclusion never excludes arbitrary extra files',async()=>{
    const extra=path.join(path.dirname(launcher),'Synthetic.exe.chaessi-release.json.bak');
    await fs.writeFile(extra,'not-an-excluded-sidecar');
    await assert.rejects(verifyPackage(release,runtime,launcher),/Runtime inventory mismatch/);
    await fs.unlink(extra);
    assert.equal(await verifyPackage(release,runtime,launcher),true);
  });
  await t.test('wrong trusted root rejects signing before output sidecars are written',async()=>{
    const wrong=path.join(base,'wrong-root.bin'); await fs.writeFile(wrong,rawPublicKey(generateKeyPairSync('ed25519').publicKey));
    const rejectedRuntime=path.join(base,'rejected'); await fs.mkdir(path.join(rejectedRuntime,'bin'),{recursive:true});
    const rejectedLauncher=path.join(rejectedRuntime,'bin','Synthetic.exe'); await fs.writeFile(rejectedLauncher,'synthetic');
    const args=releaseArgs.map(value=>value===runtime?rejectedRuntime:value===launcher?rejectedLauncher:value===rootPublic?wrong:value);
    const result=await run(args,password); assert.notEqual(result.code,0);
    await assert.rejects(fs.access(rejectedLauncher+'.chaessi-release.json'));
  });
  for (const placement of ['runtime','launcher-parent']) {
    await t.test(`sign-release rejects encrypted key under external ${placement} before reading key or hashing`,async()=>{
      const boundary=path.join(base,`boundary-${placement}`);
      const rejectedRuntime=path.join(boundary,'runtime'),deployment=path.join(boundary,'deployment');
      await fs.mkdir(path.join(rejectedRuntime,'bin'),{recursive:true});
      await fs.mkdir(deployment,{recursive:true});
      const rejectedLauncher=path.join(deployment,'Synthetic.exe');
      await fs.writeFile(rejectedLauncher,'synthetic-portable');
      await fs.writeFile(path.join(rejectedRuntime,'bin','Synthetic.exe'),'synthetic-receiver');
      const keyFile=path.join(placement==='runtime'?rejectedRuntime:deployment,'release.encrypted.pem');
      await fs.copyFile(signerPem,keyFile);
      const metadataPath=path.join(boundary,'release-input.json');
      await fs.writeFile(metadataPath,JSON.stringify({...metadata,layout:'portable'}));
      const probe=await rejectionProbe(boundary,keyFile);
      const args=releaseArgs.map(value=>value===runtime?rejectedRuntime:value===launcher?rejectedLauncher:
        value===signerPem?keyFile:value===metadataFile?metadataPath:value);
      const result=await run(args,password,probe.nodeArgs);
      assert.notEqual(result.code,0); assert.equal(result.stdout,'');
      await assert.rejects(fs.access(probe.marker),'must reject before key read or inventory hash');
      assert.deepEqual((await fs.readdir(deployment)).sort(),placement==='runtime'
        ? ['Synthetic.exe']:['Synthetic.exe','release.encrypted.pem']);
      assert.deepEqual(await fs.readFile(keyFile),await fs.readFile(signerPem));
    });
  }
  await t.test('sign-keyset rejects encrypted root key inside output before reading it or writing sidecars',async()=>{
    const boundary=path.join(base,'boundary-keyset'),output=path.join(boundary,'output');
    await fs.mkdir(output,{recursive:true});
    const keyFile=path.join(output,'root.encrypted.pem'); await fs.copyFile(rootPem,keyFile);
    const probe=await rejectionProbe(boundary,keyFile);
    const args=keyArgs.map(value=>value===rootPem?keyFile:value===keysOutput?output:value);
    const result=await run(args,password,probe.nodeArgs);
    assert.notEqual(result.code,0); assert.equal(result.stdout,'');
    await assert.rejects(fs.access(probe.marker),'must reject before reading root key');
    assert.deepEqual(await fs.readdir(output),['root.encrypted.pem']);
  });
  await t.test('physical output boundary rejects a key reached through a temporary junction alias',async()=>{
    const boundary=path.join(base,'boundary-junction'),output=path.join(boundary,'output');
    await fs.mkdir(output,{recursive:true});
    const alias=path.join(boundary,'alias');
    await fs.symlink(output,alias,process.platform==='win32'?'junction':'dir');
    const realKey=path.join(output,'root.encrypted.pem'); await fs.copyFile(rootPem,realKey);
    const keyFile=path.join(alias,'root.encrypted.pem');
    const probe=await rejectionProbe(boundary,keyFile);
    const result=await run(keyArgs.map(value=>value===rootPem?keyFile:value===keysOutput?output:value),password,probe.nodeArgs);
    assert.notEqual(result.code,0); assert.equal(result.stdout,'');
    await assert.rejects(fs.access(probe.marker),'must resolve key alias before reading it');
    assert.deepEqual(await fs.readdir(output),['root.encrypted.pem']);
    // Resolve the artifact ancestor as well as the key path.
    const nested=path.join(output,'nested'); await fs.mkdir(nested);
    await fs.rename(realKey,path.join(nested,'root.encrypted.pem'));
    const realNestedKey=path.join(nested,'root.encrypted.pem');
    const nestedProbe=await rejectionProbe(boundary,realNestedKey);
    const nestedResult=await run(keyArgs.map(value=>value===rootPem?realNestedKey:
      value===keysOutput?path.join(alias,'nested'):value),password,nestedProbe.nodeArgs);
    assert.notEqual(nestedResult.code,0); assert.equal(nestedResult.stdout,'');
    await assert.rejects(fs.access(nestedProbe.marker),'must resolve output alias before reading key');
    assert.deepEqual(await fs.readdir(nested),['root.encrypted.pem']);
  });
  await t.test('CLI exposes signing only and refuses production key-generation command',async()=>{
    const result=await run(['generate-key','--output',path.join(base,'never-created')],password);
    assert.notEqual(result.code,0); await assert.rejects(fs.access(path.join(base,'never-created')));
  });
});
