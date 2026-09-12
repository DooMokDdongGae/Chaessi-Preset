import path from "node:path";
import { access, readFile, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  validateDirectorPlanForImageRequest,
  validateImageMakerRequest,
} from "../state/image-maker-request.js";
import { IMAGE_MAKER_WORKFLOW_REQUEST_SCHEMA, validateImageMakerMultiRequest } from "../state/image-maker-multi-request.js";
import { validateScenePlanV2 } from "../state/image-director-contract.js";
import { guardScenePlanV2Shot } from "./actor-count-semantic-guard.js";
import { createComposerPresetCatalog } from "./preset-catalog-v2.js";
import { compileScenePlanV2Shot } from "./preset-composer-v2.js";
import { createImageMakerRunStore } from "./image-maker-run-store.js";

const ARTIFACTS = Object.freeze({
  request: "request.json",
  directorPlan: "director-plan.json",
  guardedPlan: "guarded-plan.json",
  guardReport: "guard-report.json",
  resolvedPreset: "resolved-preset.json",
  payload: "payload.json",
  generationResult: "generation-result.json",
});

export async function runImageMakerRequest({
  request,
  directorPlan,
  dataRoot,
  baseUrl = "http://127.0.0.1:4174",
  dryRun = false,
  runId,
  runsRoot,
  tagResolver = null,
  fetchFn = globalThis.fetch,
  requestTimeoutMs = 180_000,
  assetsOverride = null,
} = {}) {
  const root = await resolveDataRoot(dataRoot);
  const store = createImageMakerRunStore({ rootDir: root, runsRoot });
  const run = await store.create(runId);
  const startedAt = new Date().toISOString();
  const stages = stageState();
  let localApiCalls = 0;
  let manifest = baseManifest(run, root, startedAt, dryRun, stages);
  await store.writeManifest(run, { ...manifest, status: "prepared" });

  try {
    if (request.schema === IMAGE_MAKER_WORKFLOW_REQUEST_SCHEMA) validateImageMakerMultiRequest(request);
    else validateImageMakerRequest(request);
    stages.request = "passed";
    await store.writeArtifact(run, ARTIFACTS.request, request);

    if (request.schema === IMAGE_MAKER_WORKFLOW_REQUEST_SCHEMA) validateScenePlanV2(directorPlan);
    else validateDirectorPlanForImageRequest(request, directorPlan);
    stages.director = "passed";
    await store.writeArtifact(run, ARTIFACTS.directorPlan, directorPlan);

    const guarded = guardScenePlanV2Shot(directorPlan, { rewriteSafe: true });
    stages.semanticGuard = guarded.report.requiresSemanticReview ? "blocked" : "passed";
    await store.writeArtifact(run, ARTIFACTS.guardReport, guarded.report);
    if (JSON.stringify(guarded.plan) !== JSON.stringify(directorPlan)) {
      await store.writeArtifact(run, ARTIFACTS.guardedPlan, guarded.plan);
      manifest.artifacts.guardedPlan = ARTIFACTS.guardedPlan;
    }
    if (guarded.report.requiresSemanticReview) {
      const generationResult = { status: "not-sent", reason: "semantic-review-required", localApiCalls: 0 };
      await store.writeArtifact(run, ARTIFACTS.generationResult, generationResult);
      manifest = await store.writeManifest(run, {
        ...manifest,
        status: "needs-review",
        stage: "semantic-guard",
        requiresSemanticReview: true,
        stages,
        completedAt: new Date().toISOString(),
      });
      return result(run, manifest, { guardReport: guarded.report, generationResult });
    }

    const catalog = createComposerPresetCatalog({ rootDir: root });
    const assets = assetsOverride || await catalog.resolveSelections(guarded.plan.presetSelections);
    stages.preset = "passed";
    const sourcePresetHash = assetsOverride ? hashJson(assets.basePreset) : await hashBasePreset(root, request.presets.basePresetId);

    const prepared = compileScenePlanV2Shot(guarded.plan, assets, {
      tagResolver,
      positionPolicy: "same",
      rewriteSafeImplicitActors: true,
      modeRequest: assets.modeRequest || { mode: request.generation?.mode || "text-to-image" },
    });
    stages.composer = "passed";
    if (prepared.validation.semanticGuard.requiresSemanticReview) {
      throw runnerError("SEMANTIC_GUARD", "semantic-review-required", "Composer found an unresolved actor-count cue.");
    }
    const payloadValidation = prepared.validation.payload;
    if (!payloadValidation.ok) throw runnerError("PAYLOAD", "invalid-generation-payload", "Generation payload validation failed.", payloadValidation);
    stages.payload = "passed";
    await store.writeArtifact(run, ARTIFACTS.resolvedPreset, prepared.resolvedPreset);
    await store.writeArtifact(run, ARTIFACTS.payload, prepared.payload);
    manifest = await store.writeManifest(run, {
      ...manifest,
      status: "ready",
      stage: "payload",
      stages,
      sourcePresetHash,
      seed: prepared.payload.parameters.seed,
      model: prepared.payload.model,
    });

    if (dryRun) {
      const generationResult = { status: "not-sent", reason: "dry-run", localApiCalls: 0 };
      await store.writeArtifact(run, ARTIFACTS.generationResult, generationResult);
      manifest = await store.writeManifest(run, {
        ...manifest,
        status: "ready",
        stage: "dry-run",
        stages,
        completedAt: new Date().toISOString(),
      });
      return result(run, manifest, { guardReport: guarded.report, prepared, generationResult });
    }

    const { api } = await preflightImageMakerLocalApi({
      baseUrl,
      basePresetId: assetsOverride ? null : request.presets.basePresetId,
      expectedBasePreset: assetsOverride ? null : assets.basePreset,
      fetchFn,
      requestTimeoutMs,
    });
    stages.localApi = "passed";
    manifest = await store.writeManifest(run, { ...manifest, status: "generating", stage: "local-api", stages });

    stages.generation = "running";
    localApiCalls += 1;
    const response = await fetchJson(fetchFn, new URL("/api/novelai/generate", api), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(prepared.requestBody),
    }, requestTimeoutMs, "NAI_RESPONSE");
    if (response.ok !== true || !response.generation?.id) throw runnerError("NAI_RESPONSE", "invalid-generation-response", "Local API returned an invalid generation response.");
    stages.generation = "passed";

    const generation = await verifyStoredGeneration(root, response.generation, prepared.payload);
    stages.storage = "passed";
    const finalPresetHash = assetsOverride ? hashJson(assets.basePreset) : await hashBasePreset(root, request.presets.basePresetId);
    if (finalPresetHash !== sourcePresetHash) throw runnerError("STORAGE", "source-preset-changed", "The source preset changed during generation.");
    const generationResult = {
      status: "completed",
      localApiCalls,
      generation,
      summary: response.summary,
    };
    await store.writeArtifact(run, ARTIFACTS.generationResult, generationResult);
    manifest = await store.writeManifest(run, {
      ...manifest,
      status: "completed",
      stage: "storage",
      requiresSemanticReview: false,
      stages,
      generation,
      completedAt: new Date().toISOString(),
    });
    return result(run, manifest, { guardReport: guarded.report, prepared, generationResult });
  } catch (error) {
    const failure = classifyFailure(error);
    const failedStage = activeStage(stages);
    if (Object.hasOwn(stages, failedStage)) stages[failedStage] = "failed";
    try {
      await store.writeArtifact(run, ARTIFACTS.generationResult, { status: "failed", localApiCalls, failure });
    } catch (artifactError) {
      if (artifactError?.code !== "EEXIST") throw artifactError;
    }
    manifest = await store.writeManifest(run, {
      ...manifest,
      status: "failed",
      stage: failedStage,
      stages,
      failure,
      completedAt: new Date().toISOString(),
    });
    throw Object.assign(new Error(failure.message), {
      code: error?.code || "image-maker-run-failed",
      failure,
      runId: run.id,
      runDir: run.runDir,
      manifest,
    });
  }
}

export async function preflightImageMakerLocalApi({
  baseUrl = "http://127.0.0.1:4174",
  basePresetId,
  expectedBasePreset,
  fetchFn = globalThis.fetch,
  requestTimeoutMs = 180_000,
} = {}) {
  const api = validateLocalApiBaseUrl(baseUrl);
  if (typeof fetchFn !== "function") throw runnerError("NAI_RESPONSE", "fetch-unavailable", "A fetch implementation is required.");
  const health = await fetchJson(fetchFn, new URL("/api/health", api), { method: "GET" }, requestTimeoutMs, "NAI_RESPONSE");
  if (health.ok !== true || health.app !== "Chaessi Preset") throw runnerError("NAI_RESPONSE", "wrong-local-api", "The selected Local API is not Chaessi Preset.");
  const tokenStatus = await fetchJson(fetchFn, new URL("/api/settings/token-status", api), { method: "GET" }, requestTimeoutMs, "AUTH");
  if (tokenStatus.ok !== true || tokenStatus.configured !== true) throw runnerError("AUTH", "novelai-auth-missing", "NovelAI authentication is not configured in the Local API.");
  if (basePresetId && expectedBasePreset) {
    const remotePreset = await fetchJson(fetchFn, new URL(`/api/presets/${encodeURIComponent(basePresetId)}`, api), { method: "GET" }, requestTimeoutMs, "PRESET");
    if (remotePreset.ok !== true || !sameJson(remotePreset.preset, expectedBasePreset)) {
      throw runnerError("PRESET", "data-root-mismatch", "The Local API base preset does not match the explicitly selected data root.");
    }
  }
  return { ok: true, api, health: { app: health.app, version: health.version }, auth: { configured: true, source: tokenStatus.source } };
}

function baseManifest(run, root, startedAt, dryRun, stages) {
  return {
    status: "prepared",
    stage: "request",
    dryRun: Boolean(dryRun),
    dataRoot: root,
    startedAt,
    completedAt: null,
    requiresSemanticReview: false,
    artifacts: {
      request: ARTIFACTS.request,
      directorPlan: ARTIFACTS.directorPlan,
      guardReport: ARTIFACTS.guardReport,
      resolvedPreset: ARTIFACTS.resolvedPreset,
      payload: ARTIFACTS.payload,
      generationResult: ARTIFACTS.generationResult,
    },
    stages,
    generation: null,
    semanticReview: null,
  };
}
function stageState() {
  return { request: "pending", director: "pending", semanticGuard: "pending", preset: "pending", composer: "pending", payload: "pending", localApi: "pending", generation: "pending", storage: "pending" };
}
function activeStage(stages) {
  return Object.entries(stages).find(([, status]) => status === "running")?.[0]
    || Object.entries(stages).find(([, status]) => status === "pending")?.[0]
    || "storage";
}
function result(run, manifest, extra) {
  return { ok: manifest.status !== "failed", runId: run.id, runDir: run.runDir, status: manifest.status, manifest, ...extra };
}
async function resolveDataRoot(value) {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw runnerError("STORAGE", "invalid-data-root", "An explicit absolute data root is required.");
  try { return await realpath(value); } catch { throw runnerError("STORAGE", "data-root-not-found", "The selected data root does not exist."); }
}
function validateLocalApiBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw runnerError("NAI_RESPONSE", "invalid-local-api-url", "Local API URL is invalid."); }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(url.hostname) || (url.pathname !== "/" && url.pathname !== "")) {
    throw runnerError("NAI_RESPONSE", "non-local-api-url", "Image Maker only sends generation requests to a loopback HTTP API.");
  }
  return url;
}
async function fetchJson(fetchFn, url, init, timeoutMs, failureType) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { ...init, signal: controller.signal });
    if (!response?.ok) throw runnerError(failureType, "local-api-http-error", `Local API request failed with HTTP ${response?.status || "unknown"}.`);
    try { return await response.json(); } catch { throw runnerError(failureType, "invalid-local-api-json", "Local API returned invalid JSON."); }
  } catch (error) {
    if (error?.failureType) throw error;
    throw runnerError(failureType, error?.name === "AbortError" ? "local-api-timeout" : "local-api-unreachable", error?.name === "AbortError" ? "Local API request timed out." : "Local API is unreachable.");
  } finally {
    clearTimeout(timeout);
  }
}
async function verifyStoredGeneration(root, generation, expectedPayload) {
  const required = { id: generation.id, imagePath: generation.image_path, metadataPath: generation.sidecar_path, payloadPath: generation.payload_path };
  for (const [key, relative] of Object.entries(required)) {
    if (key === "id") continue;
    if (typeof relative !== "string") throw runnerError("STORAGE", "invalid-generation-path", `Generation ${key} is missing.`);
    const absolute = inside(root, path.resolve(root, relative));
    try { await access(absolute); } catch { throw runnerError("STORAGE", "generation-file-missing", `Stored generation ${key} is missing.`); }
    required[key] = relative.split(path.sep).join("/");
  }
  const savedPayload = JSON.parse(await readFile(inside(root, path.resolve(root, required.payloadPath)), "utf8"));
  if (!sameJson(comparablePayload(savedPayload), comparablePayload(expectedPayload))) throw runnerError("STORAGE", "stored-payload-mismatch", "Stored generation payload does not match the prepared payload.");
  return required;
}
function comparablePayload(value) {
  const copy = structuredClone(value);
  if (copy?.parameters?.image) copy.parameters.image = "[GENERATION_ASSET]";
  if (copy?.parameters?.mask) copy.parameters.mask = "[GENERATION_ASSET]";
  if (Array.isArray(copy?.parameters?.director_reference_images)) copy.parameters.director_reference_images = copy.parameters.director_reference_images.map(() => "[GENERATION_ASSET]");
  return copy;
}
async function hashBasePreset(root, id) {
  const file = inside(root, path.join(root, "data", "presets", id, "preset.json"));
  return createHash("sha256").update(await readFile(file)).digest("hex");
}
function hashJson(value) { return createHash("sha256").update(canonicalJson(value)).digest("hex"); }
function inside(root, candidate) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw runnerError("STORAGE", "path-escape", "A generation path escapes the selected data root.");
  return resolved;
}
function sameJson(left, right) { return canonicalJson(left) === canonicalJson(right); }
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function classifyFailure(error) {
  const type = error?.failureType || failureTypeForCode(error?.code);
  return { type, code: String(error?.code || "image-maker-run-failed"), message: safeMessage(error?.message) };
}
function failureTypeForCode(code) {
  if (/preset|component|outfit|category|binding|model/.test(String(code))) return "PRESET";
  if (/subject|actor-count|semantic/.test(String(code))) return "SEMANTIC_GUARD";
  if (/position/.test(String(code))) return "POSITION";
  if (/payload|pipe|nai-slot/.test(String(code))) return "PAYLOAD";
  if (/director|scene|shot/.test(String(code))) return "DIRECTOR";
  return "COMPOSER";
}
function safeMessage(value) {
  return String(value || "Image Maker run failed.").replace(/pst-[A-Za-z0-9_-]+|Bearer\s+\S+/gi, "[redacted]");
}
function runnerError(failureType, code, message, details = {}) {
  return Object.assign(new Error(message), { failureType, code, details });
}
