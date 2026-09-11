import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { assertNoSecretMaterial, ensureDir, sanitizeStoreId } from "./file-store-utils.js";

export const IMAGE_MAKER_RUN_SCHEMA = "chaessi-image-maker-run/v1";
export const IMAGE_MAKER_RUN_STATUSES = Object.freeze([
  "prepared", "needs-review", "ready", "generating", "completed", "failed",
]);

export function createImageMakerRunStore({ rootDir, runsRoot: customRunsRoot, now = () => new Date() } = {}) {
  if (typeof rootDir !== "string" || !path.isAbsolute(rootDir)) throw runStoreError("invalid-data-root", "An explicit absolute data root is required.");
  const resolvedRoot = path.resolve(rootDir);
  const defaultRunsRoot = inside(resolvedRoot, path.join(resolvedRoot, "data", "image-maker-runs"));
  const runsRoot = customRunsRoot === undefined
    ? defaultRunsRoot
    : inside(defaultRunsRoot, path.resolve(customRunsRoot));

  return {
    rootDir: resolvedRoot,
    runsRoot,
    async create(runId = createRunId(now())) {
      const id = exactRunId(runId);
      await ensureDir(runsRoot);
      const runDir = inside(runsRoot, path.join(runsRoot, id));
      try {
        await mkdir(runDir);
      } catch (error) {
        if (error?.code === "EEXIST") throw runStoreError("duplicate-run", `Run ${id} already exists.`);
        throw error;
      }
      return { id, runDir };
    },
    async writeArtifact(run, name, value) {
      const fileName = artifactName(name);
      assertNoSecretMaterial(value, fileName);
      const file = inside(run.runDir, path.join(run.runDir, fileName));
      await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      return file;
    },
    async writeManifest(run, manifest) {
      if (!IMAGE_MAKER_RUN_STATUSES.includes(manifest?.status)) throw runStoreError("invalid-run-status", "Run manifest has an invalid status.");
      const value = { schema: IMAGE_MAKER_RUN_SCHEMA, runId: run.id, ...manifest };
      assertNoSecretMaterial(value, "run-manifest.json");
      const file = inside(run.runDir, path.join(run.runDir, "run-manifest.json"));
      const temporary = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      await rename(temporary, file);
      return value;
    },
    async readManifest(runId) {
      const id = exactRunId(runId);
      return JSON.parse(await readFile(inside(runsRoot, path.join(runsRoot, id, "run-manifest.json")), "utf8"));
    },
    async recordSemanticReview(runId, review) {
      const manifest = await this.readManifest(runId);
      if (manifest.status !== "completed") throw runStoreError("run-not-completed", "Semantic render review requires a completed run.");
      assertNoSecretMaterial(review, "semantic review");
      return this.writeManifest({ id: exactRunId(runId), runDir: inside(runsRoot, path.join(runsRoot, runId)) }, {
        ...manifest,
        semanticReview: review,
      });
    },
  };
}

function createRunId(date) {
  const stamp = date.toISOString().replace(/\.\d{3}Z$/, "").replace("T", "_").replace(/:/g, "");
  return `${stamp}_${randomBytes(4).toString("hex")}`;
}
function exactRunId(value) {
  try {
    if (typeof value !== "string" || sanitizeStoreId(value) !== value) throw new Error();
    return value;
  } catch {
    throw runStoreError("invalid-run-id", "Run id must contain only letters, numbers, underscores, and hyphens.");
  }
}
function artifactName(value) {
  if (!/^[a-z0-9-]+\.json$/.test(String(value || ""))) throw runStoreError("invalid-artifact-name", "Invalid run artifact name.");
  return value;
}
function inside(root, candidate) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw runStoreError("invalid-run-path", "Run path escapes its root.");
  return resolved;
}
function runStoreError(code, message) {
  return Object.assign(new Error(message), { code });
}
