const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { collectDependencies, copyDependencies, preserveCollectedDependencies, verifyCopiedDependencies, checkPackage } = require("../scripts/package-dependencies.cjs");

const sourceRoot = path.resolve(__dirname, "..");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chaessi-dependency-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function json(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

test("installed production closure matches the lockfile and includes sharp native dependencies", () => {
  const lock = JSON.parse(fs.readFileSync(path.join(sourceRoot, "package-lock.json")));
  const packages = collectDependencies(sourceRoot, { lock });
  for (const name of ["sharp", "detect-libc", "semver", "@img/colour", "@img/sharp-win32-x64"]) {
    assert.ok(packages.has("node_modules/" + name), name);
  }
  assert.ok(!packages.has("node_modules/electron"));
  const changed = structuredClone(lock);
  changed.packages["node_modules/detect-libc"].version = "0.0.0";
  assert.throws(() => collectDependencies(sourceRoot, { lock: changed }), /Lockfile version mismatch/);
});

test("PUBLIC copied production dependencies work offline outside the development tree", t => {
  const output = fixture(t);
  const runtime = path.join(output, "win-unpacked");
  const root = path.join(runtime, "resources/app");
  fs.mkdirSync(root, { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, "package.json"), path.join(root, "package.json"));
  const stale = path.join(root, "node_modules/content-type/dist/index.js");
  fs.mkdirSync(path.dirname(stale), { recursive: true });
  fs.writeFileSync(stale, "stale builder version");
  json(path.join(root, "node_modules/orphan/package.json"), { name: "orphan", version: "9.0.0" });
  assert.throws(() => copyDependencies(sourceRoot, root), /must be absent/);
  const preserved = preserveCollectedDependencies(runtime);
  assert.equal(fs.readFileSync(path.join(preserved, "content-type/dist/index.js"), "utf8"), "stale builder version");
  assert.ok(!preserved.startsWith(runtime + path.sep));
  const copied = copyDependencies(sourceRoot, root);
  assert.ok(!fs.existsSync(stale));
  assert.ok(!fs.existsSync(path.join(root, "node_modules/orphan")));
  assert.equal(verifyCopiedDependencies(root, copied).exactSourceBytes, true);
  // Selected sources remain untouched; only this fresh output is populated.
  assert.ok(!fs.existsSync(path.join(sourceRoot, "node_modules/content-type/dist/index.js")));
  const probeFile = path.join(root, "node_modules/content-type/index.js");
  const original = fs.readFileSync(probeFile);
  fs.writeFileSync(probeFile, "mixed version");
  assert.throws(() => verifyCopiedDependencies(root, copied), /Changed packaged dependency file/);
  fs.unlinkSync(probeFile);
  assert.throws(() => verifyCopiedDependencies(root, copied), /Missing packaged dependency file/);
  fs.writeFileSync(probeFile, original);
  const extra = path.join(root, "node_modules/unselected.js");
  fs.writeFileSync(extra, "unexpected file");
  assert.throws(() => verifyCopiedDependencies(root, copied), /Unexpected packaged dependency file/);
  fs.unlinkSync(extra);
  assert.throws(() => preserveCollectedDependencies(runtime), /fresh and outside/);
  const result = checkPackage(root);
  assert.equal(result.packageCount, copied.size);
  assert.deepEqual(result.probe, {
    sharp: "0.35.5", native: true, cjs: true, esm: true, png: true, webp: true, resize: true,
  });
  const libc = path.join(root, "node_modules/detect-libc");
  fs.renameSync(libc, path.join(root, "removed-detect-libc"));
  assert.throws(() => checkPackage(root), /Missing dependency detect-libc/);
});

test("dependency copies cannot overwrite their own source", () => {
  assert.throws(() => copyDependencies(sourceRoot, sourceRoot), /separate trees/);
});

test("standard dist output inside a checkout remains supported", t => {
  const root = fixture(t);
  const native = `@img/sharp-${process.platform}-${process.arch}`;
  const packages = {
    "node_modules/sharp": { name: "sharp", version: "1.0.0", optionalDependencies: { [native]: "1.0.0" } },
    [`node_modules/${native}`]: { name: native, version: "1.0.0" },
  };
  json(path.join(root, "package.json"), { dependencies: { sharp: "1.0.0" } });
  json(path.join(root, "package-lock.json"), { packages });
  for (const [location, pkg] of Object.entries(packages)) json(path.join(root, location, "package.json"), pkg);
  const app = path.join(root, "dist/win-unpacked/resources/app");
  fs.mkdirSync(app, { recursive: true });
  const copied = copyDependencies(root, app);
  assert.equal(copied.size, 2);
  assert.equal(verifyCopiedDependencies(app, copied).fileCount, 2);
  assert.throws(() => copyDependencies(root, path.join(root, "node_modules/sharp")), /separate trees/);
});

test("a missing platform binary fails even though sharp declares it optional", t => {
  const root = fixture(t);
  json(path.join(root, "package.json"), { dependencies: { sharp: "1.0.0" } });
  json(path.join(root, "node_modules/sharp/package.json"), { name: "sharp", version: "1.0.0", optionalDependencies: { "@img/sharp-win32-x64": "1.0.0" } });
  assert.throws(() => collectDependencies(root), /Missing dependency @img\/sharp-win32-x64/);
});

test("ancestor node_modules cannot mask a missing packaged dependency", t => {
  const root = fixture(t);
  const app = path.join(root, "app");
  json(path.join(app, "package.json"), { dependencies: { sharp: "1.0.0" } });
  json(path.join(app, "node_modules/sharp/package.json"), { name: "sharp", version: "1.0.0", dependencies: { "detect-libc": "*" } });
  json(path.join(root, "node_modules/detect-libc/package.json"), { name: "detect-libc", version: "1.0.0" });
  assert.throws(() => collectDependencies(app), /Dependency escapes packaged node_modules/);
});
