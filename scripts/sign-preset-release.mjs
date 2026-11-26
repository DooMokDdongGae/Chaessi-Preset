import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createPrivateKey} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {
  createRelease, keyRecord, rawPublicKey, sha256, signDocument,
  verifyDocument, verifyPackage, verifyReleaseBundle, KEYSET_SCHEMA,
} from './signed-release.mjs';

// Passphrases arrive only through an already-open pipe, never argv, environment or logs.
export function encryptedSigningKey(filename, passphraseFd) {
  if (!Number.isInteger(passphraseFd) || passphraseFd < 3) throw new Error('Use a dedicated passphrase pipe descriptor >= 3');
  const stat=fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new Error('Expected a regular encrypted PKCS8 file');
  const pem=fs.readFileSync(filename);
  if (!pem.toString('ascii').startsWith('-----BEGIN ENCRYPTED PRIVATE KEY-----')) throw new Error('Expected encrypted PKCS8');
  const password=fs.readFileSync(passphraseFd);
  try {
    if (!password.length || password.length > 4096) throw new Error('Invalid passphrase pipe');
    const key=createPrivateKey({key:pem,format:'pem',passphrase:password});
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('Expected Ed25519');
    return key;
  } finally { password.fill(0); pem.fill(0); }
}

export async function writeSignedFiles(directory, entries) {
  // Each signing operation requires a fresh artifact location. Partial sets fail closed at Reader.
  await fsp.mkdir(directory,{recursive:true});
  for (const name of Object.keys(entries)) {
    if (path.basename(name)!==name) throw new Error('Unsafe output name');
    try {await fsp.lstat(path.join(directory,name)); throw new Error('Signing destination already exists');}
    catch(error) {if (error.code!=='ENOENT') throw error;}
  }
  for (const [name,bytes] of Object.entries(entries)) await fsp.writeFile(path.join(directory,name),bytes,{flag:'wx'});
}

export async function signFrozenPackage({metadata,runtimeRoot,launcherFile,releaseKey,keysetBytes,keysetSignature,rootPublic,channel='private'}) {
  const release=await createRelease({...metadata,runtimeRoot,launcherFile,channel});
  if (release.keyId !== keyRecord(releaseKey,release.issuedAt,release.expiresAt).keyId) throw new Error('Release signing key ID mismatch');
  const signed=signDocument(release,releaseKey,{channel});
  verifyReleaseBundle(signed.bytes,signed.signature,keysetBytes,keysetSignature,rootPublic,Date.now(),{channel});
  await verifyPackage(release,runtimeRoot,launcherFile,{channel});
  const directory=path.dirname(path.resolve(launcherFile));
  const entries={
    [path.basename(launcherFile)+'.chaessi-release.json']:signed.bytes,
    [path.basename(launcherFile)+'.chaessi-release.sig']:signed.signature,
    'chaessi-publisher-keys.json':keysetBytes,'chaessi-publisher-keys.sig':keysetSignature,
  };
  // Sidecar files live outside the Portable's runtime tree. Unpacked must exclude these exact external metadata names.
  await writeSignedFiles(directory,entries);
  return {release,releaseSha256:sha256(signed.bytes),files:Object.keys(entries).map(name=>path.join(directory,name))};
}

function options(arguments_) {
  const result={};
  for(let i=0;i<arguments_.length;i+=2) {
    const name=arguments_[i];
    if (!name?.startsWith('--') || !arguments_[i+1] || result[name]!==undefined) throw new Error('Expected unique --option value pairs');
    result[name]=arguments_[i+1];
  }
  return result;
}

function physicalPath(filename) {
  let existing=path.resolve(filename);
  const remaining=[];
  while (!fs.existsSync(existing)) {
    const parent=path.dirname(existing);
    if (parent===existing) throw new Error('No existing ancestor for signing path');
    remaining.unshift(path.basename(existing));
    existing=parent;
  }
  return path.join(fs.realpathSync.native(existing),...remaining);
}
export function assertKeyOutsideArtifacts(keyFile,artifactDirectories) {
  const key=physicalPath(keyFile);
  const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  for (const directory of [source,...artifactDirectories]) {
    const relative=path.relative(physicalPath(directory),key);
    if (!relative || (!relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative))) {
      throw new Error('Signing keys must be outside source, runtime and deployment directories');
    }
  }
}
async function main() {
  const [command,...args]=process.argv.slice(2);
  const opts=options(args);
  const channel=opts['--channel']??'private';
  if(!['private','public'].includes(channel)) throw new Error('Unsupported channel');
  delete opts['--channel'];
  const allowed=command==='sign-keyset'
    ? ['--metadata','--key-file','--passphrase-fd','--output']
    : ['--metadata','--key-file','--passphrase-fd','--runtime','--launcher','--keyset','--keyset-signature','--root-public'];
  if (!['sign-release','sign-keyset'].includes(command) || Object.keys(opts).length!==allowed.length || allowed.some(name=>opts[name]===undefined)) throw new Error('Use sign-release or sign-keyset with all documented options');
  const keyPath=path.resolve(opts['--key-file']);
  assertKeyOutsideArtifacts(keyPath,command==='sign-keyset'
    ? [opts['--output']] : [opts['--runtime'],path.dirname(path.resolve(opts['--launcher']))]);
  const key=encryptedSigningKey(keyPath,Number(opts['--passphrase-fd']));
  const metadata=JSON.parse(await fsp.readFile(opts['--metadata'],'utf8'));
  if(command==='sign-keyset') {
    if(metadata.schema!==KEYSET_SCHEMA) throw new Error('Expected key-set metadata');
    const signed=signDocument(metadata,key,{channel});
    verifyDocument(signed.bytes,signed.signature,rawPublicKey(key),KEYSET_SCHEMA,{channel});
    const output=path.resolve(opts['--output']);
    await writeSignedFiles(output,{'chaessi-publisher-keys.json':signed.bytes,'chaessi-publisher-keys.sig':signed.signature});
    console.log(JSON.stringify({output,keysetSha256:sha256(signed.bytes),publicKeySha256:sha256(rawPublicKey(key))}));
  } else {
    // Restrict metadata to producer inputs, with no caller-supplied inventory or file hashes.
    const expected=['releaseId','version','sequence','issuedAt','expiresAt','keyId','minKeysetSequence','receiver','layout'];
    if(Object.keys(metadata).sort().join()!==expected.sort().join()) throw new Error('Unexpected release inputs');
    const result=await signFrozenPackage({metadata,runtimeRoot:opts['--runtime'],launcherFile:opts['--launcher'],releaseKey:key,channel,
      keysetBytes:await fsp.readFile(opts['--keyset']),keysetSignature:await fsp.readFile(opts['--keyset-signature']),rootPublic:await fsp.readFile(opts['--root-public'])});
    console.log(JSON.stringify({releaseId:result.release.releaseId,releaseSha256:result.releaseSha256,files:result.files}));
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(()=>{console.error('Signing failed; inspect input schema, encrypted key provider, metadata validity and destination. No secret material is logged.');process.exitCode=1;});
}
