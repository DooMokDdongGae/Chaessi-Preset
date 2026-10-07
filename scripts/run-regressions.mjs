import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
const files = readdirSync(new URL("../", import.meta.url)).filter(name => /^test_.*\.js$/.test(name));
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, [file], { cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 120_000, windowsHide: true });
  console.log(`${result.status === 0 ? "PASS" : "FAIL"} ${file}`);
  if (result.status !== 0) { failed++; console.log(result.stdout.slice(-1800), result.stderr.slice(-1800)); }
}
console.log(`${files.length - failed}/${files.length} regression scripts passed.`);
process.exitCode = failed ? 1 : 0;
