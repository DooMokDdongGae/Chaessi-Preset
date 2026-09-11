export const IMAGE_MAKER_UI_STATES = Object.freeze([
  "idle", "directing", "plan-ready", "plan-stale", "director-failed", "preflighting", "preflight-stale",
  "needs-review", "ready", "generating", "completed", "partial-failure", "failed",
]);

export function projectDirectorState(result) {
  if (!result?.plan) return { status: "director-failed", message: "Codex did not return a Director Plan.", cache: "none" };
  return {
    status: "plan-ready", cache: result.cached ? "cached" : "fresh",
    cacheLabel: result.cached ? "Cached" : "Generated now",
    message: result.cached
      ? `기존 Director Plan을 불러왔습니다. (${result.plan.shots.length} shots)`
      : `Codex가 Director Plan을 만들었습니다. (${result.plan.shots.length} shots)`,
  };
}

export function projectDirectorStatus(status = null, error = null) {
  if (status) return {
    state: "connected", title: "Connected", detail: `${displayModel(status.model)} / ${displayEffort(status.reasoningEffort)}`,
    model: status.model || "current-codex-config", reasoningEffort: status.reasoningEffort || "current-codex-config",
    authentication: status.authentication || "authenticated",
  };
  const code = error?.code || error?.type;
  if (code === "CODEX_NOT_AUTHENTICATED") return {
    state: "unauthenticated", title: "Director login required",
    detail: "Codex에 로그인한 뒤 다시 확인하거나 Manual Plan을 사용하세요.",
  };
  return {
    state: "unavailable", title: "Director unavailable",
    detail: code === "CODEX_LIMIT_REACHED"
      ? "Codex 사용 한도 때문에 현재 사용할 수 없습니다. Cached Plan 또는 Manual Plan을 사용할 수 있습니다."
      : "Codex를 사용할 수 없습니다. Paste Plan 또는 Import Plan을 사용할 수 있습니다.",
  };
}

export function createImageMakerRequestValue({ request, basePresetId, characterPresetId, outfitPresetId, stylePresetId = null, qualityPresetId = null, mode, count, model = "nai-diffusion-5-full", baseSeed = null }) {
  return {
    schema: "chaessi-image-request/v2", request: String(request || "").trim(), count: Number(count), mode,
    presets: { basePresetId, characterPresetId, outfitPresetId, stylePresetId: stylePresetId || null, qualityPresetId: qualityPresetId || null, cameraPresetId: null, lightingPresetId: null },
    generation: { model, baseSeed: baseSeed === "" || baseSeed === null ? null : Number(baseSeed) },
  };
}

export function revisionFor(value, prefix = "rev") {
  const input = stableJson(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

export function evaluateImageMakerFreshness({ currentRequest, plan, planRequestRevision = null, preflightPlanRevision = null, preflightStatus = null } = {}) {
  const requestRevision = revisionFor(currentRequest, "request");
  const currentPlanRevision = plan ? revisionFor({ requestRevision: planRequestRevision, plan }, "plan") : null;
  const planStale = Boolean(plan && planRequestRevision !== requestRevision);
  const preflightStale = Boolean(plan && preflightPlanRevision && preflightPlanRevision !== currentPlanRevision);
  return {
    requestRevision, planRevision: currentPlanRevision, planStale, preflightStale,
    canPreflight: Boolean(plan) && !planStale,
    canGenerate: Boolean(plan) && !planStale && !preflightStale && preflightPlanRevision === currentPlanRevision && preflightStatus === "ready",
  };
}

export function projectShotCards(plan) {
  return (plan?.shots || []).map((shot, index) => {
    const direction = shot.direction || {};
    const position = shot.generation?.characters?.[0]?.position || null;
    return {
      shotId: shot.id, number: index + 1,
      intent: shot.intent || "Director가 장면의 구도와 행동을 조율했습니다.",
      camera: compact([direction.shotSize, direction.cameraHeight, direction.cameraAngle, direction.viewpoint]),
      cameraShort: compact([direction.shotSize, direction.cameraAngle]),
      placement: direction.subjectPlacement || "AI's Choice",
      poseAction: compact([direction.pose, direction.action]),
      gazeExpression: compact([direction.gaze, direction.expression]),
      position, positionLabel: position ? friendlyPosition(position, direction.subjectPlacement) : "",
      continuity: shot.continuity?.carriesFrom ? `Continues from ${friendlyShotId(shot.continuity.carriesFrom)}` : "",
      overview: compact([direction.shotSize, friendlyPlacement(direction.subjectPlacement, position), direction.gaze]), raw: shot,
    };
  });
}

export function projectShotOverview(plan) {
  return projectShotCards(plan).map((shot) => ({
    shotId: shot.shotId, number: shot.number,
    label: `${String(shot.number).padStart(2, "0")}  ${shot.overview || "Director's choice"}`,
  }));
}

export function projectPreflightState(run) {
  if (run.status === "ready") return { status: "ready", canGenerate: true, title: "READY", message: `${run.preparedCount} / ${run.requestedCount} shots can generate` };
  if (run.status === "needs-review") {
    const count = new Set(collectReviewMessages(run).filter((item) => item.severity === "review").map((item) => item.shotId)).size;
    return { status: "needs-review", canGenerate: false, title: "NEEDS REVIEW", message: `${count || 1} shot${count === 1 ? "" : "s"} needs attention` };
  }
  return { status: "failed", canGenerate: false, title: "FAILED", message: readableFailure(run.failure) };
}

export function projectGenerationState(run) {
  const final = new Set(["completed", "partial-failure", "failed"]);
  return { status: run.status, busy: !final.has(run.status), completedCount: Number(run.completedCount) || 0, requestedCount: Number(run.requestedCount) || 0, shots: (run.shots || []).map((shot) => ({ ...shot })) };
}

export function projectResultGallery(run) {
  return (run.shots || []).filter((shot) => shot.generationId && shot.imageUrl).map((shot) => ({
    shotId: shot.shotId, generationId: shot.generationId, seed: shot.seed, model: shot.model,
    width: shot.width || null, height: shot.height || null, imageUrl: shot.imageUrl,
  }));
}

export function collectReviewMessages(run) {
  return (run.shots || []).flatMap((shot) => {
    const issues = (shot.issues || []).map((issue) => ({
      shotId: shot.shotId, type: issue.type || issue.code || "review",
      severity: issue.resolution === "safe-rewrite" ? "adjusted" : "review",
      message: readableIssue(issue), rewrite: issue.rewrite || null,
    }));
    if (shot.failure) issues.push({ shotId: shot.shotId, type: shot.failure.code || "failed", severity: "failed", message: readableFailure(shot.failure), rewrite: null });
    return issues;
  });
}

export function projectRunHistoryItem(item) {
  const request = String(item.request || "").trim();
  return {
    ...item, title: request ? truncate(request, 72) : "Saved Image Maker run", dateLabel: formatDate(item.startedAt),
    modeLabel: item.mode === "sequence" ? "Sequence" : "Editorial",
    countLabel: `${item.requestedCount || 0} image${item.requestedCount === 1 ? "" : "s"}`,
    statusLabel: titleCase(item.status || "unknown"),
  };
}

export function readableIssue(issue = {}) {
  const term = issue.term ? ` “${issue.term}”` : "";
  if (issue.type === "implicit-extra-actor" || issue.type === "director-slot-actor-cue") return `This shot may imply an undeclared extra person${term}.`;
  if (issue.type === "position-conflict" || String(issue.code || "").includes("position")) return "The placement text conflicts with this shot's position.";
  if (issue.message) return cleanPublicMessage(issue.message);
  return "This shot needs attention before generation.";
}

export function cleanPublicMessage(value) {
  const message = String(value || "").replace(/[A-Za-z]:\\[^\s]+/g, "a local file").replace(/\[[Oo]bject [Oo]bject\]/g, "details unavailable");
  return message.length > 240 ? `${message.slice(0, 237)}…` : message;
}

function readableFailure(failure = {}) {
  const code = String(failure.code || failure.type || "");
  if (code.includes("preset-category") || code.includes("preset-not-found")) return "A selected preset could not be validated.";
  if (code.includes("payload")) return "The generation payload could not be validated.";
  if (code.includes("position")) return "A shot placement conflicts with its position.";
  return cleanPublicMessage(failure.message || "Preset or payload validation failed.");
}
function friendlyPosition(position, placement) {
  const text = String(placement || "").toLowerCase();
  const mentioned = [
    ["Left", text.indexOf("left")], ["Right", text.indexOf("right")],
    ["Center", Math.min(...[text.indexOf("center"), text.indexOf("centre")].filter((index) => index >= 0))],
  ].filter(([, index]) => Number.isFinite(index) && index >= 0).sort((a, b) => a[1] - b[1]);
  if (mentioned.length) return mentioned[0][0];
  if (!position || !Number.isFinite(Number(position.x))) return "";
  if (Number(position.x) < 0.4) return "Left";
  if (Number(position.x) > 0.6) return "Right";
  return "Center";
}
function friendlyPlacement(value, position) { return friendlyPosition(position, value) || String(value || ""); }
function friendlyShotId(value) { const number = String(value || "").match(/(\d+)$/)?.[1]; return number ? `Shot ${String(Number(number)).padStart(2, "0")}` : value; }
function displayModel(value) { return String(value || "current Codex config").replace(/^gpt-/i, "GPT ").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function displayEffort(value) { return String(value || "current effort").replace(/\b\w/g, (c) => c.toUpperCase()); }
function compact(values) { return values.filter(Boolean).join(" · "); }
function truncate(value, max) { return value.length > max ? `${value.slice(0, max - 1)}…` : value; }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Date unavailable" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function titleCase(value) { return String(value || "").replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function stableJson(value) { return JSON.stringify(sortObject(value)); }
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}
