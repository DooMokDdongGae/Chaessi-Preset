const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { collectDependencies, copyDependencies, checkPackage } = require("../scripts/package-dependencies.cjs");

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
  const root = fixture(t);
  fs.copyFileSync(path.join(sourceRoot, "package.json"), path.join(root, "package.json"));
  const copied = copyDependencies(sourceRoot, root);
  const result = checkPackage(root);
  assert.equal(result.packageCount, copied.size);
  assert.deepEqual(result.probe, {
    sharp: "0.35.5", native: true, cjs: true, esm: true, png: true, webp: true, resize: true,
  });
  const libc = path.join(root, "node_modules/detect-libc");
  fs.renameSync(libc, path.join(root, "removed-detect-libc"));
  assert.throws(() => checkPackage(root), /Missing dependency detect-libc/);
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
