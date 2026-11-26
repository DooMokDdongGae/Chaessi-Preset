import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {KEYSET_SCHEMA,RELEASE_SCHEMA,keyRecord,rawPublicKey,sha256,signDocument,verifyReleaseBundle} from '../scripts/signed-release.mjs';
import {assertCustodyOutsideArtifacts,initializeVault,checkRecovery,issueKeyset,signCandidate} from '../scripts/production-key-vault.mjs';
test('explicit PUBLIC chain succeeds while default PRIVATE and cross-channel metadata fail closed',()=>{
 const now=Date.parse('2026-11-26T00:00:00Z'),start='2026-11-25T00:00:00Z',end='2026-12-01T00:00:00Z';
 const root=generateKeyPairSync('ed25519').privateKey,key=generateKeyPairSync('ed25519').privateKey,record=keyRecord(key,start,end);
 const keys={schema:KEYSET_SCHEMA,issuer:'chaessi-studio',product:'chaessi-preset',channel:'public',sequence:1,issuedAt:start,expiresAt:end,keys:[record],revokedKeyIds:[]};
 const entry={path:'receiver.exe',size:1,sha256:sha256(Buffer.from('x'))};
 const release={schema:RELEASE_SCHEMA,issuer:'chaessi-studio',product:'chaessi-preset',channel:'public',releaseId:'public-1',version:'3.8.5',sequence:1,issuedAt:start,expiresAt:end,keyId:record.keyId,minKeysetSequence:1,protocols:['chaessi.prompt-transfer/1'],layout:'unpacked',launcher:entry,receiver:'receiver.exe',files:[entry]};
 assert.throws(()=>signDocument(release,key));
 const k=signDocument(keys,root,{channel:'public'}),r=signDocument(release,key,{channel:'public'});
 assert.equal(r.signature.length,89);
 assert.equal(verifyReleaseBundle(r.bytes,r.signature,k.bytes,k.signature,rawPublicKey(root),now,{channel:'public'}).release.channel,'public');
 assert.throws(()=>verifyReleaseBundle(r.bytes,r.signature,k.bytes,k.signature,rawPublicKey(root),now));
 const privateKeys=signDocument({...keys,channel:'private'},root);
 assert.throws(()=>verifyReleaseBundle(r.bytes,r.signature,privateKeys.bytes,privateKeys.signature,rawPublicKey(root),now,{channel:'public'}));
 const wrong=generateKeyPairSync('ed25519').privateKey;
 assert.throws(()=>verifyReleaseBundle(r.bytes,r.signature,k.bytes,k.signature,rawPublicKey(wrong),now,{channel:'public'}));
});
test('both entire vault roots are disjoint from any artifact, including backup and ancestor output',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'chaessi-vault-boundary-'));
 try{
  const primary=path.join(base,'primary'),backup=path.join(base,'backup');
  for(const dir of [primary,backup])fs.mkdirSync(dir);
  const location={primary,backup};
  for(const target of [base,primary,backup,path.join(primary,'output'),path.join(backup,'runtime')])assert.throws(()=>assertCustodyOutsideArtifacts(location,[target]));
  assert.doesNotThrow(()=>assertCustodyOutsideArtifacts(location,[path.join(base,'artifacts')]));
 }finally{assert.equal(path.dirname(path.resolve(base)),path.resolve(os.tmpdir()));fs.rmSync(base,{recursive:true,force:true});}
});
test('Windows DPAPI custody: encrypted independent backup, recovery, no reinitialization and public signed synthetic package',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'chaessi-production-vault-unit-'));
 try{
  const primary=path.join(base,'primary'),backup=path.join(base,'backup');
  const first=initializeVault(primary,backup);
  assert.equal(first.recovery.rows.length,2);assert.ok(first.recovery.rows.every(r=>r.signingChallengeVerified));
  assert.equal(fs.readFileSync(path.join(primary,'root.dpapi')).equals(fs.readFileSync(path.join(backup,'root.dpapi'))),false);
  const id=first.state.root.keyId;
  assert.throws(()=>initializeVault(primary,backup));
  assert.equal(JSON.parse(fs.readFileSync(path.join(primary,'custody.json'))).root.keyId,id);
  const keyset=issueKeyset(primary,backup,path.join(base,'keyset'));
  assert.equal(keyset.metadata.channel,'public');assert.equal(keyset.metadata.sequence,1);
  const deployment=path.join(base,'package'),runtime=path.join(deployment,'runtime');fs.mkdirSync(runtime,{recursive:true});
  fs.writeFileSync(path.join(deployment,'outer.exe'),'synthetic outer bytes');fs.writeFileSync(path.join(runtime,'receiver.exe'),'synthetic receiver bytes');
  const signed=await signCandidate(primary,backup,{runtimeRoot:runtime,launcherFile:path.join(deployment,'outer.exe'),receiver:'receiver.exe',releaseId:'public-unit-1',version:'3.8.5'});
  assert.equal(signed.release.channel,'public');assert.equal(signed.release.sequence,1);
  assert.equal(checkRecovery(primary,backup).requiresSameWindowsDpapiProfile,true);
  await assert.rejects(()=>signCandidate(primary,backup,{runtimeRoot:runtime,launcherFile:path.join(deployment,'outer.exe'),receiver:'receiver.exe',releaseId:'duplicate-output',version:'3.8.5'}));
  const pending=JSON.parse(fs.readFileSync(path.join(primary,'custody.json')));
  assert.equal(pending.pending.sequence,2);
  assert.throws(()=>checkRecovery(primary,backup),/incomplete/);
 }finally{assert.equal(path.dirname(path.resolve(base)),path.resolve(os.tmpdir()));fs.rmSync(base,{recursive:true,force:true});}
});
