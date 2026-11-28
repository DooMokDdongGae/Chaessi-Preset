const fs = require("node:fs");
const path = require("node:path");
const reviewedFiles = require("./dependency-file-exclusions.cjs");

// Reviewed upstream-only test trees for the locked production dependency set.
// A different package/version keeps all files until it is reviewed separately.
const reviewed = Object.freeze({
  "call-bind-apply-helpers@1.0.2": ["test"], "call-bound@1.0.4": ["test"],
  "isexe@2.0.0": ["test"], "dunder-proto@1.0.1": ["test"],
  "es-define-property@1.0.1": ["test"], "es-errors@1.3.0": ["test"],
  "es-object-atoms@1.1.2": ["test"], "fast-uri@3.1.9": ["test"],
  "function-bind@1.1.2": ["test"], "get-intrinsic@1.3.0": ["test"],
  "get-proto@1.0.1": ["test"], "gopd@1.2.0": ["test"],
  "has-symbols@1.1.0": ["test"], "json-schema-traverse@1.0.0": ["spec"],
  "math-intrinsics@1.1.0": ["test"], "object-inspect@1.13.4": ["test"],
  "qs@6.16.1": ["test"], "setprototypeof@1.2.0": ["test"],
  "side-channel@1.1.1": ["test"], "side-channel-list@1.0.1": ["test"],
  "side-channel-map@1.0.1": ["test"], "side-channel-weakmap@1.0.2": ["test"],
  "zod@4.6.7": ["src/v3/tests", "src/v4/classic/tests", "src/v4/core/tests", "src/v4/mini/tests"],
});
const normalize = value => value.split(path.sep).join("/").replace(/^\.\//, "");
function excludedDependencyPath(pkg, relative) {
  const name = normalize(relative);
  const key = `${pkg.name}@${pkg.version}`;
  return (reviewed[key] || []).some(dir => name === dir || name.startsWith(dir + "/")) || (reviewedFiles[key] || []).includes(name);
}
function strings(value) {
  if (typeof value === "string") return [value];
  return value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
}
function assertDependencyPolicy(directory, pkg) {
  const key = `${pkg.name}@${pkg.version}`;
  const dirs = [...(reviewed[key] || []), ...(reviewedFiles[key] || [])];
  for (const entry of strings({ main: pkg.main, module: pkg.module, exports: pkg.exports, imports: pkg.imports, bin: pkg.bin, types: pkg.types, typings: pkg.typings })) {
    const name = normalize(entry);
    if (excludedDependencyPath(pkg, name) || (name.includes("*") && dirs.some(dir => dir.startsWith(name.split("*")[0])))) {
      throw new Error(`Dependency exclusion conflicts with entrypoint: ${pkg.name}/${name}`);
    }
  }
  function noticeGuard(dir) {
    if (!fs.existsSync(dir)) return;
    if (fs.lstatSync(dir).isSymbolicLink()) throw new Error(`Unexpected package symlink: ${dir}`);
    if (fs.statSync(dir).isFile()) {
      if (/(license|licence|copyright|notice|copying)/i.test(path.basename(dir))) throw new Error(`Dependency exclusion would remove a notice: ${dir}`);
      return;
    }
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name);
      if (e.isSymbolicLink()) throw new Error(`Unexpected package symlink: ${file}`);
      if (e.isDirectory()) noticeGuard(file);
      else if (/(license|licence|copyright|notice|copying)/i.test(e.name)) throw new Error(`Dependency exclusion would remove a notice: ${file}`);
    }
  }
  for (const dir of dirs) noticeGuard(path.join(directory, dir));
}
module.exports = { reviewed, reviewedFiles, excludedDependencyPath, assertDependencyPolicy };
