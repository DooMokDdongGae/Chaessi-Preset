const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createRequire } = require("node:module");
const { spawnSync } = require("node:child_process");

const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
function inside(root, file) {
  const relative = path.relative(root, file);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

// Resolve package directories, including packages that do not export package.json.
// Every edge is checked against its owner's real module search path.
function collectDependencies(appRoot, { lock, platform = process.platform, arch = process.arch } = {}) {
  appRoot = path.resolve(appRoot);
  const modules = fs.realpathSync(path.join(appRoot, "node_modules"));
  const packages = new Map();
  const targetMatches = pkg => [ [pkg.os, platform], [pkg.cpu, arch] ].every(([list, target]) =>
    !list || (!list.includes("!" + target) && (!list.some(x => !x.startsWith("!")) || list.includes(target))));

  function visit(owner, name, optional) {
    const search = createRequire(path.join(owner, "package.json")).resolve.paths(name) || [];
    const directory = search.map(base => path.join(base, name)).find(dir => fs.existsSync(path.join(dir, "package.json")));
    const relative = directory && path.relative(appRoot, directory).split(path.sep).join("/");
    const locked = lock?.packages?.[relative];
    if (!directory) {
      if (optional) return;
      throw new Error(`Missing dependency ${name} required by ${owner}`);
    }
    if (!inside(modules, fs.realpathSync(directory))) throw new Error(`Dependency escapes packaged node_modules: ${name} from ${owner}`);
    const pkg = readJson(path.join(directory, "package.json"));
    if (!targetMatches(pkg) && optional) return;
    if (lock && (!locked || locked.version !== pkg.version)) throw new Error(`Lockfile version mismatch: ${relative}`);
    if (packages.has(relative)) return;
    packages.set(relative, { directory, name: pkg.name, version: pkg.version });
    walk(directory, pkg);
  }
  function walk(owner, pkg) {
    const optional = pkg.optionalDependencies || {};
    for (const name of Object.keys({ ...pkg.dependencies, ...optional })) visit(owner, name, Object.hasOwn(optional, name));
    // Required peers may be loaded at runtime even when npm has hoisted them.
    for (const name of Object.keys(pkg.peerDependencies || {})) visit(owner, name, pkg.peerDependenciesMeta?.[name]?.optional === true);
  }
  walk(appRoot, readJson(path.join(appRoot, "package.json")));
  // Sharp loads a target-specific native package dynamically. Its absence cannot
  // be accepted merely because npm declares all platform binaries optional.
  visit(path.join(appRoot, "node_modules/sharp"), `@img/sharp-${platform}-${arch}`, false);
  return packages;
}

function copyDependencies(sourceRoot, appRoot) {
  const lock = readJson(path.join(sourceRoot, "package-lock.json"));
  const packages = collectDependencies(sourceRoot, { lock });
  for (const [relative, pkg] of packages) {
    const target = path.join(appRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(pkg.directory, target, {
      recursive: true,
      filter(file) {
        if (file !== pkg.directory && path.basename(file) === "node_modules") return false;
        if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`Unexpected package symlink: ${file}`);
        return true;
      },
    });
  }
  return packages;
}

function checkPackage(appRoot) {
  const packages = collectDependencies(appRoot);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "chaessi-packaged-dependencies-"));
  try {
    // The probe lives outside the repository. Node cannot fall back to its
    // ancestor node_modules, NODE_PATH, or a developer's global search paths.
    fs.writeFileSync(path.join(temporary, "package.json"), JSON.stringify({ type: "module" }));
    for (const [relative, pkg] of packages) {
      fs.cpSync(pkg.directory, path.join(temporary, relative), {
        recursive: true,
        filter: file => file === pkg.directory || path.basename(file) !== "node_modules",
      });
    }
    const probe = `
import assert from 'node:assert/strict';
import Module, {createRequire, isBuiltin} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const root = fs.realpathSync(process.cwd());
const original = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
  const resolved = original.call(this, name, ...args);
  if (!isBuiltin(resolved) && !fs.realpathSync(resolved).startsWith(root + path.sep)) throw Error('External module: ' + resolved);
  return resolved;
};
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const esm = (await import('sharp')).default;
assert.equal(esm.versions.sharp, sharp.versions.sharp);
const raw = Buffer.from([255,0,0,255,0,255,0,128,0,0,255,255,20,30,40,255]);
const input = sharp(raw, {raw:{width:2,height:2,channels:4}});
const png = await input.png().toBuffer();
assert.deepEqual(await esm(png).ensureAlpha().raw().toBuffer(), raw);
const webp = await sharp(png).webp({lossless:true}).toBuffer();
assert.deepEqual(await sharp(webp).ensureAlpha().raw().toBuffer(), raw);
assert.equal((await sharp(webp).resize(1,1).png().toBuffer({resolveWithObject:true})).info.width, 1);
console.log(JSON.stringify({sharp:sharp.versions.sharp, native:true, cjs:true, esm:true, png:true, webp:true, resize:true}));
`;
    const file = path.join(temporary, "probe.mjs");
    fs.writeFileSync(file, probe);
    const env = { ...process.env, NODE_PATH: "", NODE_OPTIONS: "" };
    const result = spawnSync(process.execPath, ["--no-global-search-paths", file], {
      cwd: temporary, env, encoding: "utf8", timeout: 30000, windowsHide: true,
    });
    if (result.error || result.status !== 0) throw new Error(`Isolated dependency probe failed: ${result.error?.message || result.stderr}`);
    return { packageCount: packages.size, packages: [...packages].map(([location, pkg]) => ({ location, name: pkg.name, version: pkg.version })), probe: JSON.parse(result.stdout) };
  } finally {
    // Only this invocation's exclusive temporary directory is removed.
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

async function afterPack(context) {
  if (context.electronPlatformName !== "win32" || context.arch !== 1) throw new Error("Dependency packaging currently requires Windows x64");
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Use a Windows x64 host with installed Windows x64 dependencies");
  const appRoot = path.join(context.appOutDir, "resources/app");
  if (!fs.existsSync(path.join(appRoot, "package.json"))) throw new Error("Expected unpacked app");
  copyDependencies(context.packager.projectDir, appRoot);
  const result = checkPackage(appRoot);
  console.log(`Packaged dependencies verified: ${result.packageCount} packages, sharp ${result.probe.sharp}`);
}

module.exports = { collectDependencies, copyDependencies, checkPackage, afterPack };
if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/package-dependencies.cjs <resources/app>");
    console.log(JSON.stringify(checkPackage(path.resolve(process.argv[2])), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
