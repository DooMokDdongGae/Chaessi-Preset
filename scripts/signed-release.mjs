import {createHash, createPublicKey, sign, verify} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export const RELEASE_SCHEMA = 'chaessi.preset.release/1';
export const KEYSET_SCHEMA = 'chaessi.preset.keys/1';
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const MAX_INTEGER = Number.MAX_SAFE_INTEGER;
const FIELDS = {
  release: ['schema','issuer','product','channel','releaseId','version','sequence','issuedAt','expiresAt','keyId','minKeysetSequence','protocols','layout','launcher','receiver','files'],
  keyset: ['schema','issuer','product','channel','sequence','issuedAt','expiresAt','keys','revokedKeyIds'],
};

function fail(message) { throw new Error(message); }
export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function ascii(value) {
  if (typeof value !== 'string' || !/^[\x20-\x7e]*$/.test(value)) fail('Only printable ASCII strings are allowed');
}

// The contract has no optional keys. Canonicalize objects recursively without locale sorting.
export function canonicalBytes(value) {
  function normalize(item) {
    if (typeof item === 'string') { ascii(item); return item; }
    if (typeof item === 'number') {
      if (!Number.isSafeInteger(item) || item < 0 || Object.is(item, -0)) fail('Invalid contract integer');
      return item;
    }
    if (Array.isArray(item)) return Array.from(item,normalize);
    if (item && Object.getPrototypeOf(item) === Object.prototype) {
      return Object.fromEntries(Object.keys(item).sort().map(key => {
        ascii(key);
        return [key, normalize(item[key])];
      }));
    }
    fail('Unsupported JSON value');
  }
  return Buffer.from(JSON.stringify(normalize(value)), 'utf8');
}

export function parseCanonical(bytes) {
  const decoded = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  const value = JSON.parse(decoded);
  if (!canonicalBytes(value).equals(bytes)) fail('Noncanonical JSON');
  return value;
}

function exact(value, fields) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join('\0') !== [...fields].sort().join('\0')) fail('Unexpected schema fields');
}
function positive(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_INTEGER) fail('Expected positive integer');
}
function hash(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) fail('Invalid SHA-256');
}
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().replace('.000Z','Z') !== value) fail('Invalid UTC date');
  return Date.parse(value);
}
function interval(item) {
  if (utc(item.issuedAt) >= utc(item.expiresAt)) fail('Invalid validity interval');
  positive(item.sequence);
}
function identity(item, schema, channel) {
  if (!['private','public'].includes(channel)) fail('Explicit supported release channel required');
  if (item.schema !== schema || item.issuer !== 'chaessi-studio' ||
      item.product !== 'chaessi-preset' || item.channel !== channel) fail('Release channel or identity mismatch');
  interval(item);
}

export function validateRelativePath(value) {
  ascii(value);
  if (!value || value.includes('\\') || value.includes(':') || value.length > 1024) fail('Unsafe relative path');
  for (const part of value.split('/')) {
    if (!part || part === '.' || part === '..' || /[<>"|?*]/.test(part) || /[ .]$/.test(part) ||
        /^(con|prn|aux|nul|clock\$|conin\$|conout\$|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)) fail('Unsafe Windows path component');
  }
  return value;
}
function fileEntry(entry) {
  exact(entry,['path','size','sha256']);
  validateRelativePath(entry.path);
  if (!Number.isSafeInteger(entry.size) || entry.size < 0) fail('Invalid file size');
  hash(entry.sha256);
}
function sortedUnique(values) {
  return values.every((value,i) => i === 0 || values[i-1] < value);
}

export function validateRelease(release, {channel='private'}={}) {
  exact(release,FIELDS.release);
  identity(release,RELEASE_SCHEMA,channel);
  canonicalBytes(release);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(release.releaseId)) fail('Invalid release ID');
  const semver=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (!semver.test(release.version)) fail('Invalid SemVer');
  hash(release.keyId);
  positive(release.minKeysetSequence);
  if (JSON.stringify(release.protocols) !== '["chaessi.prompt-transfer/1"]') fail('Unsupported protocol');
  if (!['portable','unpacked'].includes(release.layout)) fail('Invalid layout');
  fileEntry(release.launcher);
  validateRelativePath(release.receiver);
  if (!Array.isArray(release.files) || !release.files.length) fail('Empty runtime inventory');
  release.files.forEach(fileEntry);
  if (!sortedUnique(release.files.map(file => file.path))) fail('Unsorted inventory');
  checkCaseAndPrefixes(release.files.map(file => file.path));
  const receiver = release.files.find(file => file.path === release.receiver);
  if (!receiver || !release.receiver.toLowerCase().endsWith('.exe')) fail('Missing receiver');
  if (release.layout === 'unpacked' && canonicalBytes(receiver).compare(canonicalBytes(release.launcher)) !== 0) fail('Unpacked launcher differs from receiver');
  return release;
}

export function rawPublicKey(key) {
  const publicKey=key.type === 'public' ? key : createPublicKey(key);
  if (publicKey.asymmetricKeyType !== 'ed25519') fail('Expected Ed25519 key');
  const der=publicKey.export({type:'spki',format:'der'});
  if (der.length !== SPKI_PREFIX.length+32 || !der.subarray(0,SPKI_PREFIX.length).equals(SPKI_PREFIX)) fail('Invalid public key encoding');
  return der.subarray(SPKI_PREFIX.length);
}
export function publicKeyFromRaw(raw) {
  if (!Buffer.isBuffer(raw) || raw.length !== 32) fail('Expected raw 32-byte key');
  return createPublicKey({key:Buffer.concat([SPKI_PREFIX,raw]),format:'der',type:'spki'});
}
function fromBase64(text, length) {
  if (typeof text !== 'string') fail('Invalid Base64');
  const bytes=Buffer.from(text,'base64');
  if (bytes.length !== length || bytes.toString('base64') !== text) fail('Invalid Base64');
  return bytes;
}
export function keyRecord(key,notBefore,notAfter) {
  const raw=rawPublicKey(key);
  return {keyId:sha256(raw),publicKey:raw.toString('base64'),notBefore,notAfter};
}
export function validateKeyset(keyset, {channel='private'}={}) {
  exact(keyset,FIELDS.keyset);
  identity(keyset,KEYSET_SCHEMA,channel);
  canonicalBytes(keyset);
  if (!Array.isArray(keyset.keys) || !keyset.keys.length || !Array.isArray(keyset.revokedKeyIds)) fail('Invalid key lists');
  for (const record of keyset.keys) {
    exact(record,['keyId','publicKey','notBefore','notAfter']);
    hash(record.keyId);
    if (sha256(fromBase64(record.publicKey,32)) !== record.keyId) fail('Key ID mismatch');
    if (utc(record.notBefore) >= utc(record.notAfter)) fail('Invalid signing key validity');
  }
  keyset.revokedKeyIds.forEach(hash);
  if (!sortedUnique(keyset.keys.map(key => key.keyId)) || !sortedUnique(keyset.revokedKeyIds)) fail('Unsorted key lists');
  return keyset;
}
export function signDocument(document, privateKey, {channel='private'}={}) {
  if (document.schema === RELEASE_SCHEMA) validateRelease(document,{channel});
  else if (document.schema === KEYSET_SCHEMA) validateKeyset(document,{channel});
  else fail('Unsupported signing domain');
  if (privateKey.type !== 'private' || privateKey.asymmetricKeyType !== 'ed25519') fail('Expected private Ed25519 key');
  const bytes=canonicalBytes(document);
  const signature=sign(null,Buffer.concat([Buffer.from(document.schema+'\0','ascii'),bytes]),privateKey);
  return {bytes,signature:Buffer.from(signature.toString('base64')+'\n','ascii')};
}
export function verifyDocument(bytes, signature, rawKey, schema, {channel='private'}={}) {
  const text=signature.toString('ascii');
  if (!/^[A-Za-z0-9+/]{86}==\n$/.test(text) || !Buffer.from(text,'ascii').equals(signature)) fail('Invalid signature encoding');
  const signatureBytes=fromBase64(text.slice(0,-1),64);
  const document=parseCanonical(bytes);
  if (schema === RELEASE_SCHEMA) validateRelease(document,{channel});
  else if (schema === KEYSET_SCHEMA) validateKeyset(document,{channel});
  else fail('Unsupported signature domain');
  if (document.schema !== schema || !verify(null,Buffer.concat([Buffer.from(schema+'\0','ascii'),bytes]),publicKeyFromRaw(rawKey),signatureBytes)) fail('Invalid signature');
  return document;
}

// Validation intentionally precedes writing. Reader owns persistence of accepted highest sequences.
export function verifyReleaseBundle(releaseBytes,releaseSig,keysetBytes,keysetSig,rootRaw,now=Date.now(),{channel='private'}={}) {
  const keys=verifyDocument(keysetBytes,keysetSig,rootRaw,KEYSET_SCHEMA,{channel});
  const release=parseCanonical(releaseBytes);
  validateRelease(release,{channel});
  const validAt=(start,end) => utc(start) <= now && now < utc(end);
  if (!validAt(keys.issuedAt,keys.expiresAt) || !validAt(release.issuedAt,release.expiresAt)) fail('Expired or future metadata');
  if (keys.sequence < release.minKeysetSequence) fail('Key set too old');
  const record=keys.keys.find(key => key.keyId === release.keyId);
  if (!record || keys.revokedKeyIds.includes(record.keyId)) fail('Untrusted or revoked signing key');
  if (!validAt(record.notBefore,record.notAfter) || utc(release.issuedAt) < utc(record.notBefore) ||
      utc(release.issuedAt) >= utc(record.notAfter)) fail('Signing key outside validity');
  verifyDocument(releaseBytes,releaseSig,fromBase64(record.publicKey,32),RELEASE_SCHEMA,{channel});
  return {release,keyset:keys};
}

function checkCaseAndPrefixes(names) {
  const used=new Set();
  for (const name of names) {
    const lowered=name.toLowerCase();
    if (used.has(lowered)) fail('Windows case collision');
    used.add(lowered);
  }
  for (const name of used) {
    const parts=name.split('/');
    for (let i=1;i<parts.length;i++) if (used.has(parts.slice(0,i).join('/'))) fail('File-directory collision');
  }
}

async function regularStat(file, directory=false) {
  const stat=await fs.lstat(file);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) fail('Links or special files cannot be packaged');
  return stat;
}
function rejectWindowsReparseTree(root) {
  if (process.platform !== 'win32') return;
  // Pass the path through the process environment, never interpolated shell source.
  const command="$ErrorActionPreference='Stop'; $root=Get-Item -LiteralPath $env:CHAESSI_INVENTORY_ROOT -Force; if($root.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse root'}; Get-ChildItem -LiteralPath $root.FullName -Force -Recurse -ErrorAction Stop | ForEach-Object {if($_.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse entry'}}";
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{
    env:{...process.env,CHAESSI_INVENTORY_ROOT:root},stdio:['ignore','ignore','pipe'],windowsHide:true,
  });
}
export async function hashFile(file) {
  const handle=await fs.open(file,'r');
  try {
    const before=await handle.stat();
    if (!before.isFile()) fail('Expected regular file');
    const digest=createHash('sha256');
    for await (const bytes of handle.createReadStream({autoClose:false})) digest.update(bytes);
    const after=await handle.stat();
    const live=await fs.lstat(file);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs ||
        live.isSymbolicLink() || before.ino !== live.ino || before.dev !== live.dev) fail('File changed while hashing');
    return {size:before.size,sha256:digest.digest('hex')};
  } finally { await handle.close(); }
}
export async function inventoryTree(root, {excluded=[]}={}) {
  root=path.resolve(root);
  await regularStat(root,true);
  rejectWindowsReparseTree(root);
  const files=[];
  const paths=[];
  async function visit(folder,prefix) {
    for (const name of await fs.readdir(folder)) {
      const relative=validateRelativePath(prefix+name);
      const file=path.join(folder,name);
      const stat=await fs.lstat(file);
      if (excluded.includes(relative)) {
        await regularStat(file);
        continue;
      }
      paths.push(relative);
      if (stat.isSymbolicLink()) fail('Links cannot be packaged');
      if (stat.isDirectory()) await visit(file,relative+'/');
      else {
        await regularStat(file);
        files.push({path:relative,...await hashFile(file)});
      }
    }
  }
  await visit(root,'');
  if (new Set(paths.map(name => name.toLowerCase())).size !== paths.length) fail('Windows case collision');
  checkCaseAndPrefixes(files.map(file => file.path));
  files.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return files;
}
export async function createRelease({runtimeRoot,launcherFile,receiver,layout,channel='private',...metadata}) {
  validateRelativePath(receiver);
  await regularStat(launcherFile);
  const files=await inventoryTree(runtimeRoot,{excluded:layout === 'unpacked' ? sidecarPaths(receiver) : []});
  const launcherPath=layout === 'unpacked' ? receiver : path.basename(launcherFile);
  const launcher={path:validateRelativePath(launcherPath),...await hashFile(launcherFile)};
  if (layout === 'unpacked' && path.resolve(launcherFile) !== path.resolve(runtimeRoot,receiver)) fail('Unpacked launcher path mismatch');
  return validateRelease({schema:RELEASE_SCHEMA,issuer:'chaessi-studio',product:'chaessi-preset',channel,
    protocols:['chaessi.prompt-transfer/1'],...metadata,layout,launcher,receiver,files},{channel});
}
export async function verifyPackage(release,runtimeRoot,launcherFile,{channel='private'}={}) {
  validateRelease(release,{channel});
  if (release.layout === 'unpacked' && path.resolve(launcherFile) !== path.resolve(runtimeRoot,release.receiver)) fail('Unpacked launcher path mismatch');
  const launcher=await hashFile(launcherFile);
  if (path.basename(launcherFile) !== path.basename(release.launcher.path) || launcher.sha256 !== release.launcher.sha256 || launcher.size !== release.launcher.size) fail('Launcher mismatch');
  const current=await inventoryTree(runtimeRoot,{excluded:release.layout === 'unpacked' ? sidecarPaths(release.receiver) : []});
  if (!canonicalBytes(current).equals(canonicalBytes(release.files))) fail('Runtime inventory mismatch');
  return true;
}

function sidecarPaths(receiver) {
  const folder=path.posix.dirname(receiver);
  const prefix=folder === '.' ? '' : folder+'/';
  return [receiver+'.chaessi-release.json',receiver+'.chaessi-release.sig',
    prefix+'chaessi-publisher-keys.json',prefix+'chaessi-publisher-keys.sig'];
}
