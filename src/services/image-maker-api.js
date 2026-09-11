import { randomUUID } from "node:crypto";
import { createImageMakerMultiRunStore } from "./image-maker-multi-run-store.js";
import { runMultiImageMakerRequest } from "./image-maker-multi-runner.js";

const COMPONENT_ROLES = Object.freeze({
  character: new Set(["여성 캐릭터", "남성 캐릭터"]),
  outfit: new Set(["여성 의상", "남성 의상"]),
  style: new Set(["그림체"]),
  quality: new Set(["품질"]),
});

export function createImageMakerApi({
  dataRoot,
  presetStore,
  characterPresetStore,
  generationStore,
  directorBridge = null,
  runner = runMultiImageMakerRequest,
  baseUrl = "http://127.0.0.1:4174",
} = {}) {
  const store = createImageMakerMultiRunStore({ rootDir: dataRoot });
  const jobs = new Map();

  return {
    async getDirectorStatus() {
      if (!directorBridge) throw apiError("CODEX_NOT_AVAILABLE", "Codex Director Bridge is not configured.");
      return directorBridge.getStatus();
    },

    async createDirectorPlan({ request, regenerate = false, operationId } = {}) {
      if (!directorBridge) throw apiError("CODEX_NOT_AVAILABLE", "Codex Director Bridge is not configured.");
      return directorBridge.createPlan({ request, regenerate: Boolean(regenerate), operationId });
    },

    async listCatalog() {
      const [baseItems, componentItems] = await Promise.all([
        presetStore.listPresets(),
        characterPresetStore.listCharacterPresets(),
      ]);
      const base = baseItems.map((item) => ({
        id: item.id || item.metadata?.id,
        name: item.name || item.metadata?.name || item.id,
        model: item.model || item.params?.model || null,
      })).filter((item) => item.id);
      const component = componentItems.map((item) => ({
        id: item.id,
        name: item.name || item.id,
        category: item.category || "",
        enabled: item.enabled !== false,
      })).filter((item) => item.id && item.enabled);
      return {
        base,
        character: filterRole(component, "character"),
        outfit: filterRole(component, "outfit"),
        style: filterRole(component, "style"),
        quality: filterRole(component, "quality"),
      };
    },

    async preflight({ request, directorPlan, operationId } = {}) {
      const runId = operationRunId("ui_preflight", operationId);
      const outcome = await runner({ request, directorPlan, dataRoot, baseUrl, dryRun: true, runId });
      return publicRun(outcome.manifest);
    },

    startGeneration({ request, directorPlan, operationId } = {}) {
      const runId = operationRunId("ui_generate", operationId);
      const existing = jobs.get(runId);
      if (existing) return { runId, status: existing.status, duplicate: true };
      const job = { runId, status: "prepared", error: null };
      jobs.set(runId, job);
      job.promise = runner({ request, directorPlan, dataRoot, baseUrl, dryRun: false, runId })
        .then((outcome) => { job.status = outcome.status; return outcome; })
        .catch((error) => { job.status = "failed"; job.error = safeError(error); return null; });
      return { runId, status: "prepared", duplicate: false };
    },

    async getRun(runId) {
      try {
        const manifest = await store.readManifest(runId);
        const [request, directorPlan] = await Promise.all([
          store.readArtifact(runId, "request.json").catch(() => null),
          store.readArtifact(runId, "director-plan.json").catch(() => null),
        ]);
        return publicRun(manifest, { request, directorPlan });
      }
      catch (error) {
        const job = jobs.get(runId);
        if (job) return { runId, status: job.status, stage: "queued", shots: [], completedCount: 0, error: job.error };
        throw error;
      }
    },

    async listRuns() {
      return Promise.all((await store.listManifests()).map(async (manifest) => {
        const request = await store.readArtifact(manifest.runId, "request.json").catch(() => null);
        return {
          runId: manifest.runId, startedAt: manifest.startedAt, request: request?.request || "",
          mode: manifest.mode, requestedCount: manifest.requestedCount,
          completedCount: manifest.completedCount, status: manifest.status,
        };
      }));
    },

    async getShotDetail(runId, shotId, kind) {
      if (kind === "metadata") {
        const manifest = await store.readManifest(runId);
        const generationId = manifest.shots?.find((shot) => shot.shotId === shotId)?.generationId;
        if (!generationId) throw apiError("generation-not-ready", "This shot does not have a completed generation.");
        return generationStore.getGeneration(generationId);
      }
      const payload = await store.readShotArtifact(runId, shotId, "execution", "payload.json");
      if (kind === "payload") return payload;
      if (kind === "prompt") return projectPrompt(payload);
      throw apiError("invalid-detail-kind", "Unknown Image Maker detail view.");
    },
  };
}

function filterRole(items, role) { return items.filter((item) => COMPONENT_ROLES[role].has(item.category)); }
function operationRunId(prefix, value) {
  const operation = String(value || randomUUID()).replaceAll("-", "_");
  if (!/^[A-Za-z0-9_]{8,80}$/.test(operation)) throw apiError("invalid-operation-id", "Invalid Image Maker operation ID.");
  return `${prefix}_${operation}`;
}
function projectPrompt(payload) {
  return {
    base: payload?.input || "",
    characters: (payload?.parameters?.characterPrompts || []).map((item, index) => ({
      slot: index + 1,
      prompt: item.prompt || "",
      undesired: item.uc || "",
      position: item.center || null,
    })),
    undesired: payload?.parameters?.negative_prompt || "",
  };
}
function publicRun(manifest, { request = null, directorPlan = null } = {}) {
  return {
    runId: manifest.runId,
    status: manifest.status,
    stage: manifest.stage,
    mode: manifest.mode,
    requestedCount: manifest.requestedCount,
    preparedCount: manifest.preparedCount,
    completedCount: manifest.completedCount,
    requiresSemanticReview: Boolean(manifest.requiresSemanticReview),
    failure: manifest.failure || null,
    failedShotId: manifest.failedShotId || null,
    request,
    directorPlan,
    shots: (manifest.shots || []).map((shot) => ({
      shotId: shot.shotId,
      status: shot.status,
      seed: shot.seed,
      model: shot.model || null,
      width: shot.width || null,
      height: shot.height || null,
      issues: shot.issues || [],
      failure: shot.failure || null,
      generationId: shot.generationId || null,
      imageUrl: shot.generation?.imagePath ? `/${shot.generation.imagePath}` : null,
      metadataUrl: shot.generation?.metadataPath || null,
      payloadUrl: shot.generation?.payloadPath || null,
    })),
  };
}
function safeError(error) {
  return { code: String(error?.code || "image-maker-failed"), message: String(error?.message || "Image Maker failed.").slice(0, 500) };
}
function apiError(code, message) { return Object.assign(new Error(message), { code }); }
