import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export function registryPath() {
  const root = process.env.CHAESSI_TRANSFER_REGISTRY ||
    path.join(process.env.LOCALAPPDATA || "", "CHAESSI", "PromptTransferPrivate", "v1");
  if (!/^[a-z]:[\\/]/i.test(root)) throw new Error("Missing local registry root");
  return path.resolve(root);
}

export async function prepareRegistry(root) {
  const program = path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const script = await readFile(new URL("./transfer-registry.ps1", import.meta.url), "utf8");
  // The script is shipped code. Paths never become PowerShell source.
  await run(program, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
    env: { ...process.env, CHAESSI_TRANSFER_ACL_PATH: root },
    timeout: 10000, windowsHide: true,
  });
}

export async function writeRegistryFile(file, value) {
  const temp = path.join(path.dirname(file), randomUUID() + ".tmp");
  await writeFile(temp, JSON.stringify(value), { flag: "wx", mode: 0o600 });
  try { await rename(temp, file); }
  catch (error) { await unlink(temp).catch(() => {}); throw error; }
}
