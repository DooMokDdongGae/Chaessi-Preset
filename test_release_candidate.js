import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const readText = (file) => readFile(path.join(root, file), "utf8");
const readJson = async (file) => JSON.parse(await readText(file));

test("v3.3.1 development version is consistent while public v3.3.0 remains documented", async () => {
  const [pkg, lock, readme, changelog, server, defaults] = await Promise.all([
    readJson("package.json"), readJson("package-lock.json"), readText("README.md"), readText("CHANGELOG.md"),
    readText("server.mjs"), readText("src/state/defaults.js"),
  ]);
  assert.equal(pkg.version, "3.3.1");
  assert.equal(lock.version, "3.3.1");
  assert.equal(lock.packages[""].version, "3.3.1");
  assert.match(readme, /v3\.3\.1 development/);
  assert.match(readme, /dist\/Chaessi-Preset-v3\.3\.0-x64\.exe/);
  assert.match(changelog, /\[3\.3\.1\] — Unreleased/);
  assert.match(server, /const APP_VERSION = "3\.3\.1"/);
  assert.match(defaults, /APP_VERSION = "3\.3\.1"/);
});

test("portable package allowlist keeps required Director instruction and excludes private data", async () => {
  const pkg = await readJson("package.json");
  const patterns = pkg.build.files;
  for (const required of [
    "index.html", "styles.css", "server.mjs", "electron/**/*", "src/**/*", "assets/**/*",
    "docs/image-maker/codex-image-director.md",
  ]) assert.ok(patterns.includes(required), required);
  for (const excluded of ["!**/.env", "!data/**", "!docs/**", "!test_*.js", "!logs/**", "!tmp/**"])
    assert.ok(patterns.includes(excluded), excluded);
});

test("release surfaces contain no personal absolute path or credential-shaped value", async () => {
  const files = ["README.md", "CHANGELOG.md", "package.json", "server.mjs", "electron/server-process.mjs"];
  const docs = await readdir(path.join(root, "docs", "image-maker"));
  files.push(...docs.filter((name) => name.endsWith(".md")).map((name) => `docs/image-maker/${name}`));
  for (const file of files) {
    const value = await readText(file);
    assert.doesNotMatch(value, /[A-Z]:\\(?:Users|AI|MApp|다운로드)\\/i, file);
    assert.doesNotMatch(value, /(?:sk|pst)-[A-Za-z0-9_-]{16,}/, file);
  }
});

test("unlicensed Prompt Set source and external Danbooru datasets are not bundled", async () => {
  await assert.rejects(access(path.join(root, "docs", "image-maker", "prompt-set-core.original.py.txt")));
  const assetNames = await listRelative(path.join(root, "assets"));
  assert.equal(assetNames.some((name) => /danbooru|e621|requiring\.txt|\.csv$/i.test(name)), false);
  const audit = await readText("docs/image-maker/phase-0-audit.md");
  assert.match(audit, /원본 코드 사본은 공개 소스와 앱 패키지에 포함하지 않는다/);
});

test("Codex and Local API public safety invariants remain present", async () => {
  const [bridge, server, electron, fileStore, multiStore] = await Promise.all([
    readText("src/services/codex-director-bridge.js"), readText("server.mjs"),
    readText("electron/server-process.mjs"), readText("src/services/file-store-utils.js"),
    readText("src/services/image-maker-multi-run-store.js"),
  ]);
  assert.match(bridge, /spawn\(executable, args, \{ shell: false/);
  assert.match(bridge, /"exec", "--ephemeral", "--sandbox", "read-only"/);
  assert.match(bridge, /DEFAULT_TIMEOUT_MS/);
  assert.match(server, /server\.listen\(PORT, "127\.0\.0\.1"/);
  assert.match(server, /REQUEST_LIMIT_BYTES/);
  assert.match(fileStore, /sanitizeStoreId/);
  assert.match(multiStore, /path escapes its root/);
  assert.match(electron, /safeStorage|loadProviderToken\("novelai"\)/);
});

test("Codex executable discovery is dynamic and keeps PATH fallback", async () => {
  const electron = await readText("electron/server-process.mjs");
  assert.match(electron, /process\.env\.CHAESSI_CODEX_EXECUTABLE/);
  assert.match(electron, /process\.env\.LOCALAPPDATA/);
  assert.match(electron, /readdirSync\(binRoot/);
  assert.doesNotMatch(electron, /OpenAI\\Codex\\bin\\[A-Fa-f0-9]{8,}/);
  const bridge = await readText("src/services/codex-director-bridge.js");
  assert.match(bridge, /executable = process\.env\.CHAESSI_CODEX_EXECUTABLE \|\| "codex"/);
});

test("public screenshot set is complete", async () => {
  for (const file of ["image-maker-main.png", "director-plan.png", "preflight.png", "gallery.png"])
    await access(path.join(root, "docs", "images", "image-maker", file));
});

async function listRelative(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await listRelative(path.join(directory, entry.name), relative));
    else result.push(relative);
  }
  return result;
}
