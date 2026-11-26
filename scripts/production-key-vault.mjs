import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createPrivateKey,generateKeyPairSync,randomUUID,sign,verify} from 'node:crypto';
import {KEYSET_SCHEMA,keyRecord,rawPublicKey,publicKeyFromRaw,sha256,signDocument,verifyDocument} from './signed-release.mjs';
import {signFrozenPackage,assertKeyOutsideArtifacts} from './sign-preset-release.mjs';
const scripts=path.dirname(fileURLToPath(import.meta.url));
const iso=time=>new Date(time).toISOString().replace('.000Z','Z').replace(/\.\d{3}Z$/,'Z');
const days=n=>n*86400000;
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeNew=(file,bytes)=>fs.writeFileSync(file,bytes,{flag:'wx'});
export function atomicState(file,state){
  const temp=file+'.'+randomUUID()+'.tmp';
  writeNew(temp,JSON.stringify(state,null,2));
  fs.renameSync(temp,file);
}
function shell(script,args,input){
  const environment=Object.fromEntries(['SystemRoot','WINDIR','SystemDrive','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','USERNAME','USERDOMAIN','OS'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
  const windows=process.env.SystemRoot??'C:\\Windows';
  // Do not inherit PowerShell 7 module paths or any unrelated token variables.
  environment.PSModulePath=path.join(windows,'System32/WindowsPowerShell/v1.0/Modules');
  const result=spawnSync(path.join(windows,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(scripts,script),...args],
    {input,env:environment,windowsHide:true,maxBuffer:256*1024,timeout:60000});
  if(result.error||result.status!==0){result.stdout?.fill(0);throw new Error('Protected key provider/ACL operation failed; no secret is logged');}
  return result.stdout;
}
function paths(primary,backup){
  primary=path.resolve(primary);backup=path.resolve(backup);
  const relative=path.relative(primary,backup);
  if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('Backup must be separate');
  const reverse=path.relative(backup,primary);
  if(!reverse||(!reverse.startsWith('..'+path.sep)&&reverse!=='..'&&!path.isAbsolute(reverse)))throw new Error('Vault must be separate');
  assertKeyOutsideArtifacts(path.join(primary,'root.dpapi'),[scripts,path.resolve(scripts,'..')]);
  assertKeyOutsideArtifacts(path.join(backup,'root.dpapi'),[scripts,path.resolve(scripts,'..')]);
  const result={primary,backup,state:path.join(primary,'custody.json')};
  assertCustodyOutsideArtifacts(result,[path.resolve(scripts,'..')]);
  return result;
}
function physical(filename){
  let part=path.resolve(filename);const tail=[];
  while(!fs.existsSync(part)){tail.unshift(path.basename(part));const parent=path.dirname(part);if(parent===part)throw new Error('No physical ancestor');part=parent;}
  return path.join(fs.realpathSync.native(part),...tail);
}
function within(parent,child){const relative=path.relative(parent,child);return !relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
export function assertCustodyOutsideArtifacts(location,directories){
  for(const protectedRoot of [location.primary,location.backup])for(const artifact of directories){
    const vault=physical(protectedRoot),deployment=physical(artifact);
    if(within(vault,deployment)||within(deployment,vault))throw new Error('Entire primary and backup vault roots must be disjoint from source/runtime/output/deployment');
  }
}
function readState(location){
  const bytes=fs.readFileSync(location.state),backup=fs.readFileSync(path.join(location.backup,'custody-current.json'));
  if(!bytes.equals(backup))throw new Error('Custody/backup ledger disagreement requires operator recovery');
  return JSON.parse(bytes);
}
function saveState(location,state){
  atomicState(location.state,state);
  atomicState(path.join(location.backup,'custody-current.json'),state);
}
export function checkCustodyDirectories(primary,backup,create=false){
  return JSON.parse(shell('initialize-release-vault.ps1',['-Primary',primary,'-Backup',backup,...(create?[]:['-CheckOnly'])]).toString('utf8'));
}
function dpapi(bytes,operation,role){return shell('dpapi-key-provider.ps1',['-Operation',operation,'-Role',role],bytes);}
function storePair(key,role,name,locations){
  const der=key.export({type:'pkcs8',format:'der'});
  try{
    for(const directory of [locations.primary,locations.backup]){
      const ciphertext=dpapi(der,'Protect',role);
      try{writeNew(path.join(directory,name),ciphertext);}finally{ciphertext.fill(0);}
    }
  }finally{der.fill(0);}
}
function loadKey(state,role,keyId,fromBackup=false){
  const entry=role==='root'?state.root:state.releaseKeys.find(k=>k.keyId===keyId);
  if(!entry)throw new Error('Unknown protected signing key');
  const file=path.join(fromBackup?state.backup:state.primary,entry.file);
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16384)throw new Error('Unexpected protected key file');
  const der=dpapi(fs.readFileSync(file),'Unprotect',role);
  try{
    const key=createPrivateKey({key:der,type:'pkcs8',format:'der'});
    if(key.asymmetricKeyType!=='ed25519'||sha256(rawPublicKey(key))!==entry.keyId)throw new Error('Protected signing identity mismatch');
    return key;
  }finally{der.fill(0);}
}
function publicEntry(key,file,now){return {...keyRecord(key,iso(now),iso(now+days(365))),file};}
export function withVault(primary,backup,action){
  const location=paths(primary,backup);
  checkCustodyDirectories(location.primary,location.backup);
  const lock=path.join(location.primary,'signing.lock');
  const handle=fs.openSync(lock,'wx');
  let state;
  try{
    state=readState(location);
    if(state.schema!=='chaessi.release-custody/1'||state.primary!==location.primary||state.backup!==location.backup||state.channel!=='public')throw new Error('Custody identity mismatch');
    if(state.pending)throw new Error('An incomplete issuance requires operator recovery; never reuse its sequence');
    return action(state,location);
  }finally{fs.closeSync(handle);fs.unlinkSync(lock);}
}
export function initializeVault(primary,backup){
  const location=paths(primary,backup);
  checkCustodyDirectories(location.primary,location.backup,true);
  if(fs.readdirSync(location.primary).length||fs.readdirSync(location.backup).length)throw new Error('Existing vault/backup is never reinitialized');
  writeNew(path.join(location.primary,'initialization.json'),JSON.stringify({startedAt:iso(Date.now()),status:'initializing'}));
  const now=Math.floor(Date.now()/1000)*1000;
  const root=generateKeyPairSync('ed25519').privateKey,release=generateKeyPairSync('ed25519').privateKey;
  storePair(root,'root','root.dpapi',location);storePair(release,'release','release-000001.dpapi',location);
  const state={schema:'chaessi.release-custody/1',issuer:'chaessi-studio',product:'chaessi-preset',channel:'public',
    primary:location.primary,backup:location.backup,createdAt:iso(now),root:{keyId:sha256(rawPublicKey(root)),publicKey:rawPublicKey(root).toString('base64'),file:'root.dpapi'},
    releaseKeys:[publicEntry(release,'release-000001.dpapi',now)],currentReleaseKey:sha256(rawPublicKey(release)),
    revokedKeyIds:[],keysetSequence:0,releaseSequence:0,keyset:null,pending:null};
  writeNew(location.state,JSON.stringify(state,null,2));
  writeNew(path.join(location.backup,'custody-current.json'),JSON.stringify(state,null,2));
  writeNew(path.join(location.backup,'custody-initial.json'),JSON.stringify(state,null,2));
  return {state,recovery:checkRecovery(primary,backup)};
}
export function checkRecovery(primary,backup){
  return withVault(primary,backup,state=>{
    const rows=[];
    for(const role of ['root','release']){
      const id=role==='root'?state.root.keyId:state.currentReleaseKey;
      const key=loadKey(state,role,id,true),challenge=Buffer.from('chaessi-public-key-custody-recovery/1\0'+id);
      const signature=sign(null,challenge,key);
      if(!verify(null,challenge,publicKeyFromRaw(rawPublicKey(key)),signature))throw new Error('Backup challenge failed');
      rows.push({role,keyId:id,backupDecryption:true,publicIdentityMatched:true,signingChallengeVerified:true});
    }
    return {independentBackupCiphertexts:true,rows,dpapiScope:'CurrentUser',requiresSameWindowsDpapiProfile:true,
      crossMachineIndependentRecovery:false,physicalOffline:false,plaintextFilesWritten:false};
  });
}
export function issueKeyset(primary,backup,output,revoke=[]){
  const requested=paths(primary,backup);assertCustodyOutsideArtifacts(requested,[output]);
  return withVault(primary,backup,(state,location)=>{
    for(const id of revoke)if(!state.releaseKeys.some(k=>k.keyId===id))throw new Error('Unknown revocation ID');
    const revoked=[...new Set([...state.revokedKeyIds,...revoke])].sort();
    const sequence=state.keysetSequence+1,now=Math.floor(Date.now()/1000)*1000;
    const metadata={schema:KEYSET_SCHEMA,issuer:state.issuer,product:state.product,channel:'public',sequence,
      issuedAt:iso(now),expiresAt:iso(now+days(365)),keys:state.releaseKeys.map(({file,...key})=>key).sort((a,b)=>a.keyId.localeCompare(b.keyId)),revokedKeyIds:revoked};
    assertKeyOutsideArtifacts(path.join(state.primary,'root.dpapi'),[output]);
    const signed=signDocument(metadata,loadKey(state,'root',state.root.keyId),{channel:'public'});
    verifyDocument(signed.bytes,signed.signature,Buffer.from(state.root.publicKey,'base64'),KEYSET_SCHEMA,{channel:'public'});
    state.pending={operation:'keyset',sequence,output:path.resolve(output),sha256:sha256(signed.bytes)};saveState(location,state);
    fs.mkdirSync(output,{recursive:true});
    for(const [name,bytes]of Object.entries({'chaessi-publisher-keys.json':signed.bytes,'chaessi-publisher-keys.sig':signed.signature}))writeNew(path.join(output,name),bytes);
    state.keysetSequence=sequence;state.revokedKeyIds=revoked;state.keyset={path:path.resolve(output,'chaessi-publisher-keys.json'),signature:path.resolve(output,'chaessi-publisher-keys.sig'),sha256:sha256(signed.bytes),signatureSha256:sha256(signed.signature)};
    state.pending=null;saveState(location,state);
    return {metadata,keyset:state.keyset,root:state.root};
  });
}
export async function signCandidate(primary,backup,{runtimeRoot,launcherFile,receiver,releaseId,version}){
  // The lock is deliberately retained across asynchronous inventory/signature work.
  const location=paths(primary,backup);
  assertCustodyOutsideArtifacts(location,[runtimeRoot,path.dirname(path.resolve(launcherFile))]);
  checkCustodyDirectories(location.primary,location.backup);
  const lock=path.join(location.primary,'signing.lock'),handle=fs.openSync(lock,'wx');
  try{
    const state=readState(location);
    if(state.schema!=='chaessi.release-custody/1'||state.primary!==location.primary||state.backup!==location.backup||state.channel!=='public'||state.pending||!state.keyset)throw new Error('Custody state is not ready');
    if(state.revokedKeyIds.includes(state.currentReleaseKey))throw new Error('Current release key is revoked');
    const keysetBytes=fs.readFileSync(state.keyset.path),keysetSignature=fs.readFileSync(state.keyset.signature);
    if(sha256(keysetBytes)!==state.keyset.sha256||sha256(keysetSignature)!==state.keyset.signatureSha256)throw new Error('Pinned public keyset changed');
    const sequence=state.releaseSequence+1,now=Math.floor(Date.now()/1000)*1000;
    const key=state.releaseKeys.find(k=>k.keyId===state.currentReleaseKey);
    const expires=Math.min(now+days(180),Date.parse(key.notAfter),Date.parse(JSON.parse(keysetBytes).expiresAt));
    assertKeyOutsideArtifacts(path.join(state.primary,key.file),[runtimeRoot,path.dirname(launcherFile)]);
    state.pending={operation:'release',sequence,releaseId,launcher:path.resolve(launcherFile)};saveState(location,state);
    const result=await signFrozenPackage({metadata:{releaseId,version,sequence,issuedAt:iso(now),expiresAt:iso(expires),
      keyId:state.currentReleaseKey,minKeysetSequence:state.keysetSequence,receiver,layout:'portable'},runtimeRoot,launcherFile,
      releaseKey:loadKey(state,'release',state.currentReleaseKey),keysetBytes,keysetSignature,rootPublic:Buffer.from(state.root.publicKey,'base64'),channel:'public'});
    state.releaseSequence=sequence;state.lastRelease={releaseId,sequence,sha256:result.releaseSha256,launcherSha256:result.release.launcher.sha256};
    state.pending=null;saveState(location,state);
    return result;
  }finally{fs.closeSync(handle);fs.unlinkSync(lock);}
}
export function addReleaseKey(primary,backup){
  return withVault(primary,backup,(state,location)=>{
    const now=Math.floor(Date.now()/1000)*1000,key=generateKeyPairSync('ed25519').privateKey;
    const name='release-'+String(state.releaseKeys.length+1).padStart(6,'0')+'.dpapi';
    state.pending={operation:'release-key-rotation',file:name};saveState(location,state);
    storePair(key,'release',name,location);
    const entry=publicEntry(key,name,now);state.releaseKeys.push(entry);state.currentReleaseKey=entry.keyId;
    state.pending=null;saveState(location,state);return entry;
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,...args]=process.argv.slice(2),opts={};
  try{
    for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||opts[args[i]]!==undefined||!args[i+1])throw new Error('Invalid options');opts[args[i]]=args[i+1];}
    const primary=opts['--primary'],backup=opts['--backup'];if(!primary||!backup)throw new Error('Explicit custody paths required');
    let result;
    if(command==='init')result=initializeVault(primary,backup);
    else if(command==='recover-check')result=checkRecovery(primary,backup);
    else if(command==='keyset')result=issueKeyset(primary,backup,opts['--output'],opts['--revoke']?.split(',')??[]);
    else if(command==='add-release-key')result=addReleaseKey(primary,backup);
    else if(command==='sign-release')result=await signCandidate(primary,backup,{runtimeRoot:opts['--runtime'],launcherFile:opts['--launcher'],receiver:opts['--receiver'],releaseId:opts['--release-id'],version:opts['--version']});
    else throw new Error('Unsupported custody command');
    console.log(JSON.stringify(result));
  }catch{console.error('Production signing operation failed; keys and passphrases are never logged. Inspect protected state and documented preconditions.');process.exitCode=1;}
}
