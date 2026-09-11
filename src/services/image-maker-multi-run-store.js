import path from "node:path";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { assertNoSecretMaterial, ensureDir, sanitizeStoreId } from "./file-store-utils.js";

export const IMAGE_MAKER_MULTI_RUN_SCHEMA = "chaessi-image-maker-multi-run/v1";
export const MULTI_RUN_STATUSES = Object.freeze(["prepared", "needs-review", "ready", "generating", "completed", "partial-failure", "failed"]);

export function createImageMakerMultiRunStore({ rootDir, now = () => new Date() } = {}) {
  if (typeof rootDir !== "string" || !path.isAbsolute(rootDir)) throw multiStoreError("invalid-data-root", "An explicit absolute data root is required.");
  const root = path.resolve(rootDir);
  const runsRoot = inside(root, path.join(root, "data", "image-maker-runs"));
  return {
    rootDir: root,
    runsRoot,
    async create(runId = createRunId(now())) {
      const id = exactId(runId);
      await ensureDir(runsRoot);
      const runDir = inside(runsRoot, path.join(runsRoot, id));
      try { await mkdir(runDir); }
      catch (error) {
        if (error?.code === "EEXIST") throw multiStoreError("duplicate-run", `Multi-run ${id} already exists.`);
        throw error;
      }
      const shotsRoot = path.join(runDir, "shots");
      await mkdir(shotsRoot);
      return { id, runDir, shotsRoot };
    },
    async writeArtifact(run, name, value) {
      if (!/^[a-z0-9-]+\.json$/.test(String(name || ""))) throw multiStoreError("invalid-artifact-name", "Invalid multi-run artifact name.");
      assertNoSecretMaterial(value, name);
      const file = inside(run.runDir, path.join(run.runDir, name));
      await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      return file;
    },
    async writeManifest(run, manifest) {
      if (!MULTI_RUN_STATUSES.includes(manifest?.status)) throw multiStoreError("invalid-run-status", "Invalid multi-run status.");
      const value = { schema: IMAGE_MAKER_MULTI_RUN_SCHEMA, runId: run.id, ...manifest };
      assertNoSecretMaterial(value, "multi-run-manifest.json");
      const file = inside(run.runDir, path.join(run.runDir, "multi-run-manifest.json"));
      const temporary = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      await rename(temporary, file);
      return value;
    },
    async readManifest(runId) {
      const id = exactId(runId);
      return JSON.parse(await readFile(inside(runsRoot, path.join(runsRoot, id, "multi-run-manifest.json")), "utf8"));
    },
    async readArtifact(runId, name) {
      const id = exactId(runId);
      if (!new Set(["request.json", "director-plan.json", "preflight-report.json"]).has(name)) {
        throw multiStoreError("invalid-artifact-name", "Invalid multi-run artifact name.");
      }
      return JSON.parse(await readFile(inside(runsRoot, path.join(runsRoot, id, name)), "utf8"));
    },
    async listManifests() {
      await ensureDir(runsRoot);
      const entries = await readdir(runsRoot, { withFileTypes: true });
      const manifests = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try { manifests.push(await this.readManifest(entry.name)); }
        catch { /* Ignore incomplete and single-image run folders. */ }
      }
      return manifests.sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
    },
    async readShotArtifact(runId, shotId, phase, name) {
      const id = exactId(runId);
      const shot = exactId(shotId);
      if (!new Set(["preflight", "execution"]).has(phase)) throw multiStoreError("invalid-artifact-phase", "Invalid shot artifact phase.");
      if (!new Set(["payload.json", "resolved-preset.json", "generation-result.json", "guard-report.json", "run-manifest.json"]).has(name)) {
        throw multiStoreError("invalid-artifact-name", "Invalid shot artifact name.");
      }
      const file = inside(runsRoot, path.join(runsRoot, id, "shots", shot, phase, name));
      return JSON.parse(await readFile(file, "utf8"));
    },
    async recordRenderReview(runId, review) {
      const id = exactId(runId);
      const runDir = inside(runsRoot, path.join(runsRoot, id));
      const run = { id, runDir, shotsRoot: path.join(runDir, "shots") };
      const manifest = await this.readManifest(id);
      if (!['completed', 'partial-failure'].includes(manifest.status)) throw multiStoreError("run-not-reviewable", "Render review requires a completed or partial multi-run.");
      await this.writeArtifact(run, "visual-review.json", review);
      return this.writeManifest(run, { ...manifest, renderReview: review, artifacts: { ...manifest.artifacts, visualReview: "visual-review.json" } });
    },
  };
}

function createRunId(date) {
  const stamp = date.toISOString().replace(/\.\d{3}Z$/, "").replace("T", "_").replace(/:/g, "");
  return `multi_${stamp}_${randomBytes(4).toString("hex")}`;
}
function exactId(value) {
  try {
    if (typeof value !== "string" || sanitizeStoreId(value) !== value) throw new Error();
    return value;
  } catch {
    throw multiStoreError("invalid-run-id", "Multi-run id must contain only letters, numbers, underscores, and hyphens.");
  }
}
function inside(root, candidate) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw multiStoreError("invalid-run-path", "Multi-run path escapes its root.");
  return resolved;
}
function multiStoreError(code, message) { return Object.assign(new Error(message), { code }); }
