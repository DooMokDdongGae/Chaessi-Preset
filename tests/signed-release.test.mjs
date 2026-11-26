import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign, verify} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  RELEASE_SCHEMA, KEYSET_SCHEMA, canonicalBytes, parseCanonical,
  sha256, rawPublicKey, publicKeyFromRaw, keyRecord, signDocument,
  verifyDocument, validateRelease, validateKeyset, verifyReleaseBundle,
  validateRelativePath, inventoryTree, hashFile, createRelease, verifyPackage,
} from '../scripts/signed-release.mjs';

// These are deliberately tiny synthetic byte files, not valid PE/runtime fixtures.
// Runtime/process identity and real Portable extraction are separate integration tests.
const now = Date.parse('2026-11-25T12:00:00Z');
const before = '2026-11-24T00:00:00Z';
const after = '2026-12-01T00:00:00Z';
const pair = () => generateKeyPairSync('ed25519');
const root = pair();
const signer = pair();
const file = (name, bytes) => ({path:name,size:Buffer.byteLength(bytes),sha256:sha256(Buffer.from(bytes))});
const clone = value => structuredClone(value);

function releaseFor(key = signer) {
  return {schema:RELEASE_SCHEMA,issuer:'chaessi-studio',product:'chaessi-preset',channel:'private',
    releaseId:'synthetic-test-1',version:'3.8.5-private.1',sequence:1,issuedAt:before,expiresAt:after,
    keyId:keyRecord(key.publicKey,before,after).keyId,minKeysetSequence:1,
    protocols:['chaessi.prompt-transfer/1'],layout:'portable',launcher:file('Synthetic.exe','outside'),
    receiver:'Synthetic.exe',files:[file('Synthetic.exe','inside'),file('resources/app.asar','synthetic-app')]};
}
function keysetFor(keys = [signer], sequence = 1) {
  return {schema:KEYSET_SCHEMA,issuer:'chaessi-studio',product:'chaessi-preset',channel:'private',
    sequence,issuedAt:before,expiresAt:after,
    keys:keys.map(key=>keyRecord(key.publicKey,before,after)).sort((a,b)=>a.keyId.localeCompare(b.keyId)),
    revokedKeyIds:[]};
}
function signedBundle(release = releaseFor(), keyset = keysetFor(), signingKey = signer, rootKey = root) {
  const signedRelease=signDocument(release,signingKey.privateKey);
  const signedKeys=signDocument(keyset,rootKey.privateKey);
  return [signedRelease.bytes,signedRelease.signature,signedKeys.bytes,signedKeys.signature,rawPublicKey(root.publicKey),now];
}
async function tempTree(t) {
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'chaessi-signed-unit-'));
  t.after(()=>fs.rm(base,{recursive:true,force:true}));
  const runtime=path.join(base,'runtime');
  await fs.mkdir(path.join(runtime,'resources'),{recursive:true});
  await fs.writeFile(path.join(runtime,'Synthetic.exe'),'inside');
  await fs.writeFile(path.join(runtime,'resources','app.asar'),'synthetic-app');
  const launcher=path.join(base,'Synthetic.exe');
  await fs.writeFile(launcher,'outside');
  return {base,runtime,launcher};
}

test('canonical JSON is ASCII sorted, compact UTF-8 with no BOM or trailing newline',()=>{
  const bytes=canonicalBytes({z:['value',0,Number.MAX_SAFE_INTEGER],a:{b:'line\\n',a:'"quoted"'}});
  assert.equal(bytes.toString(),String.raw`{"a":{"a":"\"quoted\"","b":"line\\n"},"z":["value",0,9007199254740991]}`);
  assert.deepEqual(parseCanonical(bytes),{a:{a:'"quoted"',b:'line\\n'},z:['value',0,Number.MAX_SAFE_INTEGER]});
});

test('canonical parser rejects byte variants including duplicate keys, BOM, and trailing newline',()=>{
  for (const text of ['{"a":1,"a":2}','{"b":2,"a":1}','{ "a":1}', '{"a":1}\n', '\ufeff{"a":1}', '{"a":1.0}', '{"a":1e0}', '{"a":-0}']) {
    assert.throws(()=>parseCanonical(Buffer.from(text)));
  }
  assert.throws(()=>parseCanonical(Buffer.from([0xff])));
  assert.deepEqual(parseCanonical(Buffer.from('{"a":1}')),{a:1});
});

test('canonical values reject non-ASCII, decimals, negatives, unsafe numbers, booleans and null',()=>{
  for (const value of ['한글','\n',1.1,-1,-0,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,true,null,undefined]) {
    assert.throws(()=>canonicalBytes({a:value}));
  }
  assert.throws(()=>canonicalBytes({'한글':'value'}));
});

test('schemas reject unknown/missing nested and top-level fields',()=>{
  for (const mutate of [r=>r.extra=1,r=>delete r.receiver,r=>r.launcher.extra=1,r=>r.files[0].extra=1]) {
    const r=releaseFor(); mutate(r); assert.throws(()=>validateRelease(r));
  }
  for (const mutate of [k=>k.extra=1,k=>delete k.keys,k=>k.keys[0].extra=1]) {
    const k=keysetFor(); mutate(k); assert.throws(()=>validateKeyset(k));
  }
});

test('PRIVATE identity, protocol, validity, SemVer and sequence are enforced',()=>{
  for (const patch of [{channel:'public'},{issuer:'other'},{product:'other'},{protocols:['other/1']},
    {protocols:['chaessi.prompt-transfer/1','other/1']},{sequence:0},{minKeysetSequence:0},
    {version:'03.8.5'},{version:'3.8.5-01'},{issuedAt:'2026-02-30T00:00:00Z'},
    {issuedAt:after},{layout:'other'}]) assert.throws(()=>validateRelease({...releaseFor(),...patch}));
});

test('Node Ed25519 verifies exact domain NUL + canonical JSON, raw key and padded signature',()=>{
  const doc=releaseFor();
  const signed=signDocument(doc,signer.privateKey);
  const raw=rawPublicKey(signer.publicKey);
  assert.equal(raw.length,32);
  assert.equal(sha256(raw),doc.keyId);
  assert.match(signed.signature.toString(),/^[A-Za-z0-9+/]{86}==\n$/);
  const decoded=Buffer.from(signed.signature.toString().trimEnd(),'base64');
  assert.equal(decoded.length,64);
  assert.equal(verify(null,Buffer.concat([Buffer.from('chaessi.preset.release/1\0','ascii'),signed.bytes]),publicKeyFromRaw(raw),decoded),true);
  assert.equal(verify(null,signed.bytes,signer.publicKey,decoded),false);
  assert.deepEqual(verifyDocument(signed.bytes,signed.signature,raw,RELEASE_SCHEMA),doc);
});

test('wrong roots, wrong signing domains, tampering, and malformed signature encodings fail',()=>{
  const s=signDocument(releaseFor(),signer.privateKey);
  const raw=rawPublicKey(signer.publicKey);
  assert.throws(()=>verifyDocument(s.bytes,s.signature,rawPublicKey(root.publicKey),RELEASE_SCHEMA));
  assert.throws(()=>verifyDocument(s.bytes,s.signature,raw,KEYSET_SCHEMA));
  const edited=canonicalBytes({...releaseFor(),sequence:2});
  assert.throws(()=>verifyDocument(edited,s.signature,raw,RELEASE_SCHEMA));
  const withoutDomain=Buffer.from(sign(null,s.bytes,signer.privateKey).toString('base64')+'\n');
  assert.throws(()=>verifyDocument(s.bytes,withoutDomain,raw,RELEASE_SCHEMA));
  for (const sig of [s.signature.subarray(0,-1),Buffer.concat([s.signature,Buffer.from('\n')]),
    Buffer.from(s.signature.toString().replace('==\n','=\n')),Buffer.from(s.signature.toString().replace('\n','\r\n'))]) {
    assert.throws(()=>verifyDocument(s.bytes,sig,raw,RELEASE_SCHEMA));
  }
  const bundle=signedBundle(); bundle[4]=rawPublicKey(pair().publicKey);
  assert.throws(()=>verifyReleaseBundle(...bundle));
});

test('valid root-signed key set and release bundle succeeds at exact start boundary',()=>{
  assert.equal(verifyReleaseBundle(...signedBundle()).release.sequence,1);
  const b=signedBundle(); b[5]=Date.parse(before);
  assert.equal(verifyReleaseBundle(...b).keyset.sequence,1);
});

test('expired/future release or key set and signing validity boundaries fail closed',()=>{
  for (const [target,patch] of [['release',{expiresAt:'2026-11-25T12:00:00Z'}],
    ['release',{issuedAt:'2026-11-25T12:00:01Z'}],['keys',{expiresAt:'2026-11-25T12:00:00Z'}],
    ['keys',{issuedAt:'2026-11-25T12:00:01Z'}]]) {
    const r=releaseFor(),k=keysetFor(); Object.assign(target==='release'?r:k,patch);
    assert.throws(()=>verifyReleaseBundle(...signedBundle(r,k)));
  }
  for (const patch of [{notBefore:'2026-11-25T12:00:01Z'}, {notAfter:'2026-11-25T12:00:00Z'},
    {notBefore:'2026-11-25T00:00:00Z'}]) {
    const k=keysetFor(); Object.assign(k.keys[0],patch);
    assert.throws(()=>verifyReleaseBundle(...signedBundle(releaseFor(),k)));
  }
});

test('missing/revoked/rotated keys and minimum key-set sequence are enforced',()=>{
  const replacement=pair();
  const k=keysetFor([signer,replacement],2);
  const r={...releaseFor(replacement),minKeysetSequence:2,sequence:2};
  assert.equal(verifyReleaseBundle(...signedBundle(r,k,replacement)).release.keyId,r.keyId);
  assert.throws(()=>verifyReleaseBundle(...signedBundle(r,keysetFor(),replacement)));
  const stale=keysetFor([replacement],1);
  assert.throws(()=>verifyReleaseBundle(...signedBundle(r,stale,replacement)),/too old/);
  k.revokedKeyIds=[r.keyId];
  assert.throws(()=>verifyReleaseBundle(...signedBundle(r,k,replacement)),/revoked/);
});

test('key IDs, raw Base64, key order, revoked order, and key fields are validated',()=>{
  const id=keyRecord(signer.publicKey,before,after).keyId;
  for (const mutate of [k=>k.keys[0].keyId='0'.repeat(64),k=>k.keys[0].publicKey=k.keys[0].publicKey.slice(0,-1),
    k=>k.keys.push(clone(k.keys[0])),k=>k.revokedKeyIds=[id,id],k=>k.keys[0].notAfter=before]) {
    const k=keysetFor(); mutate(k); assert.throws(()=>validateKeyset(k));
  }
  assert.throws(()=>publicKeyFromRaw(Buffer.alloc(31)));
  assert.throws(()=>signDocument(releaseFor(),signer.publicKey));
});

test('Windows path traversal, ADS, absolute, empty, device, and trailing components fail',()=>{
  for (const name of ['/x','C:/x','a:b','a\\b','a//b','a/../b','a/./b','a/',
    'CON','aux.txt','com1.bin','LPT9','folder/NUL.txt','x.','x ','a/<x>','a/?','a/*','']) {
    assert.throws(()=>validateRelativePath(name),name);
  }
  assert.equal(validateRelativePath('resources/app.asar'),'resources/app.asar');
});

test('inventory schema rejects case collision, file-directory conflict, unsorted and missing receiver',()=>{
  for (const files of [[file('A.exe','a'),file('a.exe','b')],[file('a','a'),file('a/b.exe','b')],
    [file('b.exe','a'),file('a.exe','b')],[file('resources/app.asar','a')]]) {
    const r=releaseFor(); r.files=files; r.receiver=files[0].path;
    assert.throws(()=>validateRelease(r));
  }
});

test('synthetic Portable inventory binds both separate launcher and complete runtime tree',async t=>{
  const x=await tempTree(t);
  const metadata=releaseFor();
  const {launcher,files,layout,receiver,...rest}=metadata;
  const made=await createRelease({runtimeRoot:x.runtime,launcherFile:x.launcher,receiver,layout,...rest});
  assert.deepEqual(made,metadata);
  assert.equal(await verifyPackage(made,x.runtime,x.launcher),true);
  assert.deepEqual(await inventoryTree(x.runtime),metadata.files);
});

test('complete tree detects extra, missing, same-size changed runtime and changed outer launcher',async t=>{
  const x=await tempTree(t); const r=releaseFor();
  await fs.writeFile(path.join(x.runtime,'extra.dll'),'x');
  await assert.rejects(verifyPackage(r,x.runtime,x.launcher),/inventory mismatch/);
  await fs.unlink(path.join(x.runtime,'extra.dll'));
  await fs.unlink(path.join(x.runtime,'resources','app.asar'));
  await assert.rejects(verifyPackage(r,x.runtime,x.launcher),/inventory mismatch/);
  await fs.writeFile(path.join(x.runtime,'resources','app.asar'),'synthetic-app');
  await fs.writeFile(path.join(x.runtime,'Synthetic.exe'),'INSIDE');
  await assert.rejects(verifyPackage(r,x.runtime,x.launcher),/inventory mismatch/);
  await fs.writeFile(path.join(x.runtime,'Synthetic.exe'),'inside');
  await fs.writeFile(x.launcher,'OUTSIDE');
  await assert.rejects(verifyPackage(r,x.runtime,x.launcher),/Launcher mismatch/);
});

test('unpacked launcher must be exact runtime receiver by path and bytes',async t=>{
  const x=await tempTree(t); const r=releaseFor();
  const {launcher,files,layout,receiver,...rest}=r;
  const internal=path.join(x.runtime,receiver);
  const made=await createRelease({runtimeRoot:x.runtime,launcherFile:internal,receiver,layout:'unpacked',...rest});
  assert.deepEqual(made.launcher,made.files.find(f=>f.path===receiver));
  assert.equal(await verifyPackage(made,x.runtime,internal),true);
  // Matching names and bytes outside the signed runtime are not the bound receiver.
  await fs.copyFile(internal,x.launcher);
  await assert.rejects(verifyPackage(made,x.runtime,x.launcher),/Unpacked launcher path mismatch/);
  await assert.rejects(createRelease({runtimeRoot:x.runtime,launcherFile:x.launcher,receiver,layout:'unpacked',...rest}));
  const invalid={...made,launcher:file('Synthetic.exe','other')};
  assert.throws(()=>validateRelease(invalid));
});

test('directory links/junctions and root links are never inventoried',async t=>{
  const x=await tempTree(t);
  const outside=path.join(x.base,'outside'); await fs.mkdir(outside);
  await fs.writeFile(path.join(outside,'other.dll'),'external');
  const link=path.join(x.runtime,'linked');
  await fs.symlink(outside,link,process.platform==='win32'?'junction':'dir');
  await assert.rejects(inventoryTree(x.runtime));
  await assert.rejects(inventoryTree(link));
});

test('a real file mutation during hashing is rejected rather than signed',async t=>{
  const x=await tempTree(t);
  const originalOpen=fs.open;
  fs.open=async (...args)=>{
    const handle=await originalOpen(...args);
    const originalStat=handle.stat.bind(handle); let calls=0;
    handle.stat=async (...statArgs)=>{
      if (++calls===2) await fs.appendFile(x.launcher,'changed');
      return originalStat(...statArgs);
    };
    return handle;
  };
  try { await assert.rejects(hashFile(x.launcher),/changed while hashing/); }
  finally { fs.open=originalOpen; }
});
