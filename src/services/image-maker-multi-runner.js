import path from "node:path";
import { realpath } from "node:fs/promises";
import { auditScenePlanV2 } from "../state/image-director-contract.js";
import {
  resolveMultiShotSeeds,
  validateDirectorPlanForMultiRequest,
  validateImageMakerMultiRequest,
} from "../state/image-maker-multi-request.js";
import { createComposerPresetCatalog } from "./preset-catalog-v2.js";
import { createImageMakerMultiRunStore } from "./image-maker-multi-run-store.js";
import { preflightImageMakerLocalApi, runImageMakerRequest } from "./image-maker-runner.js";

export async function runMultiImageMakerRequest({
  request,
  directorPlan,
  dataRoot,
  baseUrl = "http://127.0.0.1:4174",
  dryRun = false,
  runId,
  tagResolver = null,
  fetchFn = globalThis.fetch,
  requestTimeoutMs = 180_000,
  randomUint32,
} = {}) {
  const root = await resolveRoot(dataRoot);
  const store = createImageMakerMultiRunStore({ rootDir: root });
  const run = await store.create(runId);
  const startedAt = new Date().toISOString();
  let manifest = makeManifest(run, request, dryRun, startedAt);
  await store.writeManifest(run, manifest);

  try {
    validateImageMakerMultiRequest(request);
    validateDirectorPlanForMultiRequest(request, directorPlan);
    const resolved = resolveMultiShotSeeds(request, directorPlan, randomUint32 ? { randomUint32 } : {});
    await store.writeArtifact(run, "request.json", resolved.request);
    await store.writeArtifact(run, "director-plan.json", resolved.plan);

    const audit = auditScenePlanV2(resolved.plan);
    if (!audit.ok) {
      const report = { ok: false, generationCalls: 0, planAudit: audit, shots: [] };
      await store.writeArtifact(run, "preflight-report.json", report);
      manifest = await store.writeManifest(run, {
        ...manifest,
        status: "needs-review",
        stage: "director-audit",
        requiresSemanticReview: true,
        preflight: report,
        completedAt: new Date().toISOString(),
      });
      return multiResult(run, manifest);
    }

    const preflightShots = [];
    for (const shot of resolved.plan.shots) {
      const shotRoot = path.join(run.shotsRoot, shot.id);
      try {
        const outcome = await runImageMakerRequest({
          request: toSingleRequest(resolved.request, shot.generation.seed),
          directorPlan: toSinglePlan(resolved.plan, shot),
          dataRoot: root,
          dryRun: true,
          runId: "preflight",
          runsRoot: shotRoot,
          tagResolver,
          fetchFn,
          requestTimeoutMs,
        });
        preflightShots.push({
          shotId: shot.id,
          status: outcome.status,
          requiresSemanticReview: outcome.manifest.requiresSemanticReview,
          seed: outcome.prepared?.payload?.parameters?.seed ?? shot.generation.seed,
          model: outcome.prepared?.payload?.model ?? null,
          width: outcome.prepared?.payload?.parameters?.width ?? null,
          height: outcome.prepared?.payload?.parameters?.height ?? null,
          useCoords: outcome.prepared?.payload?.parameters?.use_coords ?? null,
          actorPositions: outcome.prepared?.validation?.positions?.actorPositions ?? [],
          path: relative(run.runDir, outcome.runDir),
          issues: outcome.guardReport?.issues || [],
        });
      } catch (error) {
        preflightShots.push({
          shotId: shot.id,
          status: "failed",
          requiresSemanticReview: false,
          seed: shot.generation.seed,
          path: relative(run.runDir, error.runDir || shotRoot),
          failure: safeFailure(error),
        });
      }
    }

    const preparedCount = preflightShots.filter((shot) => shot.status === "ready").length;
    const hasReview = preflightShots.some((shot) => shot.status === "needs-review");
    const hasFailure = preflightShots.some((shot) => shot.status === "failed");
    const preflightReport = {
      ok: preparedCount === resolved.request.count,
      generationCalls: 0,
      requestedCount: resolved.request.count,
      preparedCount,
      planAudit: audit,
      seeds: resolved.seeds,
      shots: preflightShots,
    };
    await store.writeArtifact(run, "preflight-report.json", preflightReport);
    manifest = await store.writeManifest(run, {
      ...manifest,
      status: preflightReport.ok ? "ready" : hasReview ? "needs-review" : "failed",
      stage: "preflight",
      requestedCount: resolved.request.count,
      preparedCount,
      seeds: resolved.seeds,
      preflight: preflightReport,
      shots: preflightShots,
      requiresSemanticReview: hasReview,
      completedAt: preflightReport.ok && !dryRun ? null : new Date().toISOString(),
    });
    if (!preflightReport.ok || hasFailure) return multiResult(run, manifest);
    if (dryRun) return multiResult(run, manifest);

    const assets = await createComposerPresetCatalog({ rootDir: root }).resolveSelections(resolved.plan.presetSelections);
    await preflightImageMakerLocalApi({
      baseUrl,
      basePresetId: resolved.request.presets.basePresetId,
      expectedBasePreset: assets.basePreset,
      fetchFn,
      requestTimeoutMs,
    });
    manifest = await store.writeManifest(run, { ...manifest, status: "generating", stage: "generation", completedAt: null });

    const shotResults = [];
    for (const shot of resolved.plan.shots) {
      const shotRoot = path.join(run.shotsRoot, shot.id);
      try {
        const outcome = await runImageMakerRequest({
          request: toSingleRequest(resolved.request, shot.generation.seed),
          directorPlan: toSinglePlan(resolved.plan, shot),
          dataRoot: root,
          baseUrl,
          dryRun: false,
          runId: "execution",
          runsRoot: shotRoot,
          tagResolver,
          fetchFn,
          requestTimeoutMs,
        });
        shotResults.push({
          shotId: shot.id,
          status: "completed",
          seed: shot.generation.seed,
          generationId: outcome.generationResult.generation.id,
          generation: outcome.generationResult.generation,
          path: relative(run.runDir, outcome.runDir),
        });
        manifest = await store.writeManifest(run, {
          ...manifest,
          status: "generating",
          completedCount: shotResults.length,
          shots: mergeShotStatus(preflightShots, shotResults),
        });
      } catch (error) {
        shotResults.push({
          shotId: shot.id,
          status: "failed",
          seed: shot.generation.seed,
          path: relative(run.runDir, error.runDir || shotRoot),
          failure: safeFailure(error),
        });
        const completedCount = shotResults.filter((item) => item.status === "completed").length;
        manifest = await store.writeManifest(run, {
          ...manifest,
          status: completedCount ? "partial-failure" : "failed",
          stage: "generation",
          completedCount,
          failedShotId: shot.id,
          shots: mergeShotStatus(preflightShots, shotResults),
          completedAt: new Date().toISOString(),
        });
        return multiResult(run, manifest);
      }
    }

    manifest = await store.writeManifest(run, {
      ...manifest,
      status: "completed",
      stage: "completed",
      completedCount: shotResults.length,
      shots: mergeShotStatus(preflightShots, shotResults),
      completedAt: new Date().toISOString(),
    });
    return multiResult(run, manifest);
  } catch (error) {
    manifest = await store.writeManifest(run, {
      ...manifest,
      status: "failed",
      stage: manifest.stage || "validation",
      failure: safeFailure(error),
      completedAt: new Date().toISOString(),
    });
    throw Object.assign(new Error(manifest.failure.message), { code: error.code, runId: run.id, runDir: run.runDir, manifest });
  }
}

function toSingleRequest(request, seed) {
  return {
    schema: "chaessi-image-request/v1",
    request: request.request,
    count: 1,
    presets: structuredClone(request.presets),
    generation: { model: request.generation.model, seed },
  };
}
function toSinglePlan(plan, shot) {
  const singleShot = structuredClone(shot);
  singleShot.index = 1;
  singleShot.continuity.carriesFrom = null;
  return {
    schema: plan.schema,
    request: plan.request,
    mode: "single",
    count: 1,
    presetSelections: structuredClone(plan.presetSelections),
    continuity: structuredClone(plan.continuity),
    shots: [singleShot],
  };
}
function makeManifest(run, request, dryRun, startedAt) {
  return {
    status: "prepared",
    stage: "validation",
    mode: request?.mode ?? null,
    requestedCount: request?.count ?? null,
    preparedCount: 0,
    completedCount: 0,
    dryRun: Boolean(dryRun),
    startedAt,
    completedAt: null,
    requiresSemanticReview: false,
    artifacts: { request: "request.json", directorPlan: "director-plan.json", preflightReport: "preflight-report.json", shots: "shots/" },
    seeds: [],
    shots: [],
  };
}
function mergeShotStatus(preflight, execution) {
  const executed = new Map(execution.map((shot) => [shot.shotId, shot]));
  return preflight.map((shot) => executed.has(shot.shotId) ? { ...shot, ...executed.get(shot.shotId), preflightStatus: shot.status } : { ...shot, preflightStatus: shot.status });
}
function relative(root, target) { return path.relative(root, target).split(path.sep).join("/"); }
function safeFailure(error) {
  return {
    type: error?.failure?.type || "MULTI_RUN",
    code: String(error?.code || "multi-run-failed"),
    message: String(error?.message || "Multi-shot execution failed.").replace(/pst-[A-Za-z0-9_-]+|Bearer\s+\S+/gi, "[redacted]"),
  };
}
function multiResult(run, manifest) { return { ok: !["failed", "partial-failure"].includes(manifest.status), status: manifest.status, runId: run.id, runDir: run.runDir, manifest }; }
async function resolveRoot(value) {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw Object.assign(new Error("An explicit absolute data root is required."), { code: "invalid-data-root" });
  try { return await realpath(value); } catch { throw Object.assign(new Error("The selected data root does not exist."), { code: "data-root-not-found" }); }
}
