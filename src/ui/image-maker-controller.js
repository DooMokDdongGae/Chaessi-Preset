import {
  cleanPublicMessage,
  collectReviewMessages,
  createImageMakerRequestValue,
  createWorkshopGenerationSummary,
  evaluateImageMakerFreshness,
  projectDirectorState,
  projectDirectorStatus,
  projectGenerationState,
  projectPreflightState,
  projectResultGallery,
  projectRunHistoryItem,
  projectShotCards,
  projectShotOverview,
  planningRequestRevision,
} from "./image-maker-state.js";

export function createImageMakerController({ getJson, postJson, showToast, getWorkshopContext, pollIntervalMs = 700 } = {}) {
  const byId = (id) => document.getElementById(id);
  const model = {
    plan: null, request: null, preflight: null, run: null, displayPlan: null,
    busy: false, activity: null, planRequestRevision: null, preflightPlanRevision: null,
    planSource: null, director: null, runCache: new Map(), catalog: null, presetBlocks: [], workshopContext: null,
  };

  return {
    bind() {
      byId("presetWorkspaceTab").addEventListener("click", () => selectWorkspace("preset"));
      byId("imageMakerWorkspaceTab").addEventListener("click", () => selectWorkspace("image-maker"));
      byId("imageMakerPreparePlanButton").addEventListener("click", preparePlan);
      byId("imageMakerCreatePlanButton").addEventListener("click", () => createDirectorPlan(false));
      byId("imageMakerRegeneratePlanButton").addEventListener("click", () => createDirectorPlan(true));
      byId("imageMakerDirectorRefreshButton").addEventListener("click", loadDirectorStatus);
      byId("imageMakerImportPlanButton").addEventListener("click", () => byId("imageMakerPlanFile").click());
      byId("imageMakerPlanFile").addEventListener("change", importPlanFile);
      byId("imageMakerPreflightButton").addEventListener("click", runPreflight);
      byId("imageMakerGenerateButton").addEventListener("click", generate);
      byId("imageMakerAddPresetButton").addEventListener("click", addPresetBlock);
      byId("imageMakerPresetBlocks").addEventListener("change", updatePresetBlock);
      byId("imageMakerPresetBlocks").addEventListener("click", removePresetBlock);
      byId("imageMakerNewRequestButton").addEventListener("click", reset);
      byId("imageMakerRefreshRunsButton").addEventListener("click", loadRuns);
      byId("imageMakerGallery").addEventListener("click", openShotDetail);
      byId("imageMakerRunHistory").addEventListener("click", handleRunHistoryAction);
      byId("imageMakerReviewList").addEventListener("click", navigateToShot);
      byId("imageMakerShotOverview").addEventListener("click", navigateToShot);
      byId("imageMakerProgressList").addEventListener("click", navigateToShot);
      for (const id of ["imageMakerRequest", "imageMakerCount"]) {
        byId(id).addEventListener("input", handleRequestChange);
      }
      document.querySelectorAll('input[name="imageMakerMode"]').forEach((input) => input.addEventListener("change", handleRequestChange));
    },
    async initialize() {
      const [catalog] = await Promise.allSettled([getJson("/api/image-maker/catalog"), loadDirectorStatus(), loadRuns()]);
      if (catalog.status === "fulfilled") renderCatalog(catalog.value.catalog);
      else showToast(cleanPublicMessage(catalog.reason?.message || "Preset catalog을 불러오지 못했습니다."), true);
      syncButtons();
    },
  };

  function selectWorkspace(value) {
    const imageMaker = value === "image-maker";
    byId("presetWorkspace").hidden = imageMaker;
    byId("imageMakerWorkspace").hidden = !imageMaker;
    byId("presetWorkspaceTab").classList.toggle("is-active", !imageMaker);
    byId("imageMakerWorkspaceTab").classList.toggle("is-active", imageMaker);
  }

  async function loadDirectorStatus() {
    renderDirectorStatus({ state: "checking", title: "Checking Director", detail: "Codex 연결 상태를 확인하고 있습니다." });
    try {
      const response = await getJson("/api/image-maker/director/status");
      model.director = projectDirectorStatus(response.director);
    } catch (error) {
      model.director = projectDirectorStatus(null, error);
    }
    renderDirectorStatus(model.director);
    return model.director;
  }

  function renderDirectorStatus(status) {
    const root = byId("imageMakerDirectorStatus");
    root.dataset.status = status.state;
    root.innerHTML = `<span class="director-status-dot" aria-hidden="true"></span><div><small>DIRECTOR</small><strong>${escapeHtml(status.title)}</strong><span>${escapeHtml(status.detail)}</span></div>`;
    byId("imageMakerDirectorRefreshButton").disabled = status.state === "checking";
  }

  function renderCatalog(catalog) {
    model.catalog = catalog;
    renderPresetBlocks();
  }

  function fillSelect(id, items, placeholder, optional, filter = () => true) {
    const values = (items || []).filter(filter);
    byId(id).innerHTML = [`<option value="">${escapeHtml(placeholder)}</option>`, ...values.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || item.id)}</option>`)].join("");
    if (!optional && values.length === 1) byId(id).value = values[0].id;
  }

  function addPresetBlock() {
    const first = model.catalog?.categories?.[0];
    if (!first) return showToast("추가할 수 있는 preset이 없습니다.", true);
    model.presetBlocks.push({ scope: "global", store: first.store, category: first.category || first.id, presetId: "" });
    renderPresetBlocks(); handleRequestChange();
  }

  function updatePresetBlock(event) {
    const row = event.target.closest?.("[data-preset-block]"); if (!row) return;
    const index = Number(row.dataset.presetBlock); const block = model.presetBlocks[index]; if (!block) return;
    if (event.target.matches("[data-block-scope]")) block.scope = event.target.value;
    if (event.target.matches("[data-block-category]")) {
      const [store, category] = event.target.value.split("::");
      Object.assign(block, { store, category, presetId: "" }); renderPresetBlocks();
    }
    if (event.target.matches("[data-block-preset]")) block.presetId = event.target.value;
    handleRequestChange();
  }

  function removePresetBlock(event) {
    const button = event.target.closest?.("[data-remove-preset-block]"); if (!button) return;
    model.presetBlocks.splice(Number(button.dataset.removePresetBlock), 1); renderPresetBlocks(); handleRequestChange();
  }

  function renderPresetBlocks() {
    const categories = model.catalog?.categories || [];
    const presets = model.catalog?.presets || [];
    byId("imageMakerPresetBlocks").innerHTML = model.presetBlocks.map((block, index) => {
      const options = presets.filter((item) => item.store === block.store && item.category === block.category);
      return `<div class="image-maker-preset-block" data-preset-block="${index}">
        <label>Scope<select data-block-scope><option value="global"${block.scope === "global" ? " selected" : ""}>Global</option>${Array.from({ length: 32 }, (_, actor) => `<option value="actor-${actor + 1}"${block.scope === `actor-${actor + 1}` ? " selected" : ""}>Actor ${actor + 1}</option>`).join("")}</select></label>
        <label>Category<select data-block-category>${categories.map((item) => { const category = item.category || item.id; return `<option value="${escapeHtml(`${item.store}::${category}`)}"${item.store === block.store && category === block.category ? " selected" : ""}>${escapeHtml(item.name || category)}</option>`; }).join("")}</select></label>
        <label>Preset<select data-block-preset><option value="">Select preset</option>${options.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === block.presetId ? " selected" : ""}>${escapeHtml(item.name || item.id)}</option>`).join("")}</select></label>
        <button type="button" data-remove-preset-block="${index}" aria-label="Remove preset">Remove</button>
      </div>`;
    }).join("") || `<p class="image-maker-empty-blocks">현재 Preset Workshop 설정으로 생성합니다. 필요한 경우에만 preset을 추가하세요.</p>`;
  }

  function captureWorkflow(includeModePayload = false) {
    const workshopContext = getWorkshopContext?.({ includeModePayload });
    if (!workshopContext?.preset) throw new Error("Preset Workshop 설정을 읽을 수 없습니다.");
    const mode = workshopContext.mode || workshopContext.modeRequest?.mode || "text-to-image";
    const generation = createWorkshopGenerationSummary(workshopContext.preset, mode, workshopContext.modeRequest?.mode_state);
    const request = currentRequest(generation);
    return { request, workshopContext: { preset: workshopContext.preset, modeRequest: workshopContext.modeRequest || { mode } } };
  }

  function currentRequest(generation = null) {
    return createImageMakerRequestValue({
      request: byId("imageMakerRequest").value, presetBlocks: model.presetBlocks,
      mode: document.querySelector('input[name="imageMakerMode"]:checked')?.value,
      count: byId("imageMakerCount").value, generation: generation || captureWorkflow(false).request?.generation,
    });
  }

  function freshness() {
    return evaluateImageMakerFreshness({
      currentRequest: captureWorkflow(false).request, plan: model.plan, planRequestRevision: model.planRequestRevision,
      preflightPlanRevision: model.preflightPlanRevision, preflightStatus: model.preflight?.status,
    });
  }

  function preparePlan() {
    try {
      const { request, workshopContext } = captureWorkflow(false); requireRequest(request);
      const plan = normalizePlanForWorkflow(request, JSON.parse(byId("imageMakerPlanJson").value)); requireMatchingPlan(request, plan);
      acceptPlan(request, plan, { source: "manual", workshopContext });
      setPlanStatus(`${plan.shots.length}개 shot을 Manual Plan에서 준비했습니다.`, "ok");
    } catch (error) { setPlanStatus(cleanPublicMessage(error.message), "error"); showToast(cleanPublicMessage(error.message), true); }
  }

  async function createDirectorPlan(regenerate) {
    if (model.busy) return;
    let request;
    let workshopContext;
    try { ({ request, workshopContext } = captureWorkflow(false)); requireRequest(request); }
    catch (error) { setPlanStatus(cleanPublicMessage(error.message), "error"); showToast(cleanPublicMessage(error.message), true); return; }
    const previous = structuredClone({
      plan: model.plan, request: model.request, preflight: model.preflight, run: model.run,
      planRequestRevision: model.planRequestRevision, preflightPlanRevision: model.preflightPlanRevision, planSource: model.planSource,
    });
    model.busy = true; model.activity = "directing"; syncButtons();
    setPlanStatus(regenerate ? "Codex가 같은 조건으로 새 연출안을 만들고 있습니다…" : "Codex가 Director Plan을 만들고 있습니다…", "");
    renderRunSummary("directing", "Creating Director Plan", "현재 plan은 새 plan 검증이 끝날 때까지 유지됩니다.");
    try {
      const response = await postJson("/api/image-maker/director-plan", { request, workshopContext, regenerate, operationId: operationId() });
      const result = response.director; requireMatchingPlan(request, result.plan);
      acceptPlan(request, result.plan, { source: result.cached ? "cached" : "fresh", director: result.client, workshopContext });
      const state = projectDirectorState(result);
      setPlanStatus(state.message, "ok");
      renderRunSummary(state.status, "Plan Ready", "구도를 확인한 뒤 Preflight를 실행하세요.");
    } catch (error) {
      Object.assign(model, previous);
      const message = directorErrorMessage(error);
      if (["CODEX_NOT_AVAILABLE", "CODEX_NOT_AUTHENTICATED", "CODEX_LIMIT_REACHED"].includes(error?.code || error?.type)) {
        model.director = projectDirectorStatus(null, error); renderDirectorStatus(model.director);
      }
      setPlanStatus(message, "error"); renderRunSummary("director-failed", "Director Failed", message); showToast(message, true);
    } finally { model.busy = false; model.activity = null; syncButtons(); }
  }

  function acceptPlan(request, plan, { source, director = null, workshopContext = null } = {}) {
    model.request = structuredClone(request); model.plan = structuredClone(plan); model.displayPlan = model.plan;
    model.planRequestRevision = planningRequestRevision(request); model.preflight = null; model.preflightPlanRevision = null;
    model.workshopContext = workshopContext || model.workshopContext;
    model.run = null; model.planSource = source; if (director) model.director = projectDirectorStatus(director);
    byId("imageMakerPlanJson").value = JSON.stringify(plan, null, 2);
    renderPlanMeta(plan); renderShots(plan); renderReview({ shots: [] });
    renderRunSummary("plan-ready", "Plan Ready", "Preflight를 실행하면 비용 없이 전체 shot을 검증합니다.");
    syncButtons();
  }

  async function importPlanFile(event) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    byId("imageMakerPlanJson").value = await file.text(); preparePlan();
  }

  function renderPlanMeta(plan) {
    const mode = plan.mode === "sequence" ? "Sequence" : "Editorial";
    const description = plan.mode === "sequence" ? "Continuous action" : "Independent compositions";
    byId("imageMakerPlanMode").innerHTML = `<strong>${mode}</strong><span>${description}</span>`;
    const source = ({ cached: "Cached", fresh: "Generated now", manual: "Manual Plan", reused: "Reused Plan" })[model.planSource] || "Plan Ready";
    byId("imageMakerPlanSourceBadge").textContent = source;
    byId("imageMakerPlanSourceBadge").dataset.source = model.planSource || "ready";
    byId("imageMakerShotOverview").innerHTML = projectShotOverview(plan).map((item) => `<button type="button" data-go-shot="${escapeHtml(item.shotId)}">${escapeHtml(item.label)}</button>`).join("");
  }

  function renderShots(plan) {
    byId("imageMakerShotList").innerHTML = projectShotCards(plan).map((shot) => `
      <article class="image-maker-shot-card" data-shot-id="${escapeHtml(shot.shotId)}" tabindex="-1">
        <header><span>SHOT ${String(shot.number).padStart(2, "0")}</span><strong>${escapeHtml(shot.cameraShort || "Director's choice")}</strong></header>
        <dl>
          <div><dt>Camera</dt><dd>${escapeHtml(shot.camera || "Director's choice")}</dd></div>
          <div><dt>Placement</dt><dd>${escapeHtml(shot.placement)}</dd></div>
          <div><dt>Action</dt><dd>${escapeHtml(shot.poseAction || "—")}</dd></div>
          <div><dt>Gaze</dt><dd>${escapeHtml(shot.gazeExpression || "—")}</dd></div>
          ${shot.positionLabel ? `<div><dt>Position</dt><dd>${escapeHtml(shot.positionLabel)}</dd></div>` : ""}
          ${shot.continuity ? `<div><dt>Sequence</dt><dd>${escapeHtml(shot.continuity)}</dd></div>` : ""}
        </dl>
        <section class="image-maker-intent"><small>DIRECTOR INTENT</small><p>${escapeHtml(shot.intent)}</p></section>
        <details><summary>Advanced details</summary><div class="image-maker-advanced"><p>${shot.position ? `Position: x ${formatNumber(shot.position.x)} / y ${formatNumber(shot.position.y)}` : "Position: AI's Choice"}</p><pre>${escapeHtml(JSON.stringify(shot.raw, null, 2))}</pre></div></details>
      </article>`).join("");
  }

  async function runPreflight() {
    let workflow;
    try { workflow = captureWorkflow(true); requireRequest(workflow.request); }
    catch (error) { showToast(cleanPublicMessage(error.message), true); return; }
    const state = evaluateImageMakerFreshness({ currentRequest: workflow.request, plan: model.plan, planRequestRevision: model.planRequestRevision, preflightPlanRevision: model.preflightPlanRevision, preflightStatus: model.preflight?.status });
    if (model.busy || !state.canPreflight) { handleRequestChange(); return; }
    model.request = workflow.request; model.workshopContext = workflow.workshopContext;
    model.busy = true; model.activity = "preflighting"; syncButtons();
    renderRunSummary("preflighting", "Preflighting", `0 / ${model.request.count} shots checked`);
    try {
      const response = await postJson("/api/image-maker/preflight", { operationId: operationId(), request: model.request, directorPlan: model.plan, workshopContext: model.workshopContext });
      model.preflight = response.run; model.preflightPlanRevision = evaluateImageMakerFreshness({ currentRequest: model.request, plan: model.plan, planRequestRevision: model.planRequestRevision }).preflightRevision;
      const result = projectPreflightState(response.run);
      renderRunSummary(result.status, result.title, result.message); renderShotStatuses(response.run); renderReview(response.run);
    } catch (error) { renderRunSummary("failed", "FAILED", cleanPublicMessage(error.message)); }
    finally { model.busy = false; model.activity = null; syncButtons(); }
  }

  async function generate() {
    if (model.busy) return;
    let workflow;
    try { workflow = captureWorkflow(true); requireRequest(workflow.request); }
    catch (error) { showToast(cleanPublicMessage(error.message), true); return; }
    model.busy = true; byId("imageMakerReviewList").innerHTML = "";
    try {
      let state = evaluateImageMakerFreshness({ currentRequest: workflow.request, plan: model.plan, planRequestRevision: model.planRequestRevision, preflightPlanRevision: model.preflightPlanRevision, preflightStatus: model.preflight?.status });
      if (!model.plan || state.planStale) {
        model.activity = "directing"; syncButtons(); renderRunSummary("directing", "Creating Director Plan", "Codex가 장면 구도를 만들고 있습니다.");
        const response = await postJson("/api/image-maker/director-plan", { request: workflow.request, workshopContext: workflow.workshopContext, regenerate: false, operationId: operationId() });
        requireMatchingPlan(workflow.request, response.director.plan);
        acceptPlan(workflow.request, response.director.plan, { source: response.director.cached ? "cached" : "fresh", director: response.director.client, workshopContext: workflow.workshopContext });
      }
      model.request = workflow.request; model.workshopContext = workflow.workshopContext;
      model.activity = "preflighting"; syncButtons(); renderRunSummary("preflighting", "Checking before generation", "모든 shot을 비용 없이 검사하고 있습니다.");
      const checked = await postJson("/api/image-maker/preflight", { operationId: operationId(), request: model.request, directorPlan: model.plan, workshopContext: model.workshopContext });
      model.preflight = checked.run;
      model.preflightPlanRevision = evaluateImageMakerFreshness({ currentRequest: model.request, plan: model.plan, planRequestRevision: model.planRequestRevision }).preflightRevision;
      const preflight = projectPreflightState(checked.run); renderRunSummary(preflight.status, preflight.title, preflight.message); renderShotStatuses(checked.run); renderReview(checked.run);
      if (!preflight.canGenerate) return;
      model.activity = "generating"; syncButtons();
      const response = await postJson("/api/image-maker/generate", { operationId: operationId(), request: model.request, directorPlan: model.plan, workshopContext: model.workshopContext });
      await pollRun(response.run.runId);
    } catch (error) { renderRunSummary("failed", "Generation Failed", cleanPublicMessage(error.message)); }
    finally { model.busy = false; model.activity = null; syncButtons(); loadRuns(); }
  }

  async function pollRun(runId) {
    for (;;) {
      const response = await getJson(`/api/image-maker/runs/${encodeURIComponent(runId)}`); model.run = response.run;
      const current = projectGenerationState(response.run);
      renderRunSummary(current.status, generationTitle(current.status), `${current.completedCount} / ${current.requestedCount} completed`);
      renderShotStatuses(response.run); renderReview(response.run); renderGallery(response.run);
      if (!current.busy) return;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  function renderShotStatuses(run) {
    const known = new Map((run.shots || []).map((shot) => [shot.shotId, shot]));
    const ids = model.displayPlan?.shots?.map((shot) => shot.id) || run?.shots?.map((shot) => shot.shotId) || [];
    byId("imageMakerProgressList").innerHTML = ids.map((id, index) => {
      const shot = known.get(id); const status = shot?.status || (run.status === "generating" ? "waiting" : "pending");
      const card = byId("imageMakerShotList").querySelector(`[data-shot-id="${CSS.escape(id)}"]`);
      if (card) { card.dataset.status = status; card.classList.toggle("needs-attention", status === "needs-review" || status === "failed"); }
      return `<button type="button" data-status="${escapeHtml(status)}" data-go-shot="${escapeHtml(id)}"><strong>Shot ${String(index + 1).padStart(2, "0")}</strong><span>${escapeHtml(statusLabel(status))}</span></button>`;
    }).join("");
  }

  function renderReview(run) {
    const messages = collectReviewMessages(run);
    const attention = messages.filter((item) => item.severity !== "adjusted");
    const summary = attention.length ? `<div class="image-maker-review-summary"><strong>${attention.length} issue${attention.length === 1 ? "" : "s"} need attention</strong><button type="button" data-go-shot="${escapeHtml(attention[0].shotId)}">Go to ${escapeHtml(friendlyShotId(attention[0].shotId))}</button></div>` : "";
    byId("imageMakerReviewList").innerHTML = summary + messages.map((item) => `
      <article data-severity="${escapeHtml(item.severity)}"><strong>${escapeHtml(friendlyShotId(item.shotId))}</strong><p>${escapeHtml(item.message)}</p>
      ${item.rewrite ? `<details><summary>Auto-adjusted</summary><div class="rewrite-comparison"><del>${escapeHtml(item.rewrite.from)}</del><span>→</span><ins>${escapeHtml(item.rewrite.to)}</ins></div></details>` : ""}
      ${item.severity !== "adjusted" ? `<button type="button" data-go-shot="${escapeHtml(item.shotId)}">View shot</button>` : ""}</article>`).join("");
  }

  function navigateToShot(event) {
    const button = event.target.closest?.("[data-go-shot]"); if (!button) return;
    const card = byId("imageMakerShotList").querySelector(`[data-shot-id="${CSS.escape(button.dataset.goShot)}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" }); card?.focus({ preventScroll: true });
  }

  function renderGallery(run) {
    const items = projectResultGallery(run); byId("imageMakerResultsPanel").hidden = items.length === 0;
    byId("imageMakerGallery").innerHTML = items.map((item, index) => {
      const resolution = item.width && item.height ? `${item.width} × ${item.height}` : "Stored PNG";
      return `<article class="image-maker-result-card">
        <button type="button" class="image-maker-result-image" data-image-maker-open-image="${escapeHtml(item.imageUrl)}"><img src="${escapeHtml(item.imageUrl)}" alt="Shot ${index + 1}" /></button>
        <div class="result-primary"><span>SHOT ${String(index + 1).padStart(2, "0")}</span><strong>Seed ${escapeHtml(item.seed)}</strong><small>${escapeHtml(resolution)}</small></div>
        <div class="image-maker-prompt-actions"><strong>Final NovelAI Prompt</strong><span>실제 생성에 사용된 Positive / Negative prompt</span>
          <div class="actions compact-actions"><button type="button" class="primary-generate-button" data-image-maker-detail="prompt" data-run-id="${escapeHtml(run.runId)}" data-shot-id="${escapeHtml(item.shotId)}">View Prompt</button><button type="button" data-copy-prompt data-run-id="${escapeHtml(run.runId)}" data-shot-id="${escapeHtml(item.shotId)}">Copy Prompt</button></div>
        </div>
        <details class="image-maker-result-technical"><summary>Technical details</summary><div class="actions compact-actions">
          <button type="button" data-view-shot-plan="${escapeHtml(item.shotId)}">View Shot Plan</button>
          <button type="button" data-image-maker-detail="metadata" data-run-id="${escapeHtml(run.runId)}" data-shot-id="${escapeHtml(item.shotId)}">Metadata</button>
          <button type="button" data-image-maker-detail="payload" data-run-id="${escapeHtml(run.runId)}" data-shot-id="${escapeHtml(item.shotId)}">Payload</button>
        </div></details></article>`;
    }).join("");
    byId("imageMakerRendererNote").hidden = items.length === 0;
  }

  async function openShotDetail(event) {
    const planButton = event.target.closest?.("[data-view-shot-plan]");
    if (planButton) { navigateToShot({ target: { closest: () => ({ dataset: { goShot: planButton.dataset.viewShotPlan } }) } }); return; }
    const image = event.target.closest?.("[data-image-maker-open-image]");
    if (image) { window.open(image.dataset.imageMakerOpenImage, "_blank", "noopener"); return; }
    const button = event.target.closest?.("[data-image-maker-detail],[data-copy-prompt]"); if (!button) return;
    try {
      const kind = button.dataset.copyPrompt !== undefined ? "prompt" : button.dataset.imageMakerDetail;
      const response = await getJson(`/api/image-maker/runs/${encodeURIComponent(button.dataset.runId)}/shots/${encodeURIComponent(button.dataset.shotId)}/${kind}`);
      if (button.dataset.copyPrompt !== undefined) {
        const value = formatPromptDetail(response.detail); await navigator.clipboard.writeText(value); showToast("Final prompt를 복사했습니다."); return;
      }
      byId("imageMakerDetailTitle").textContent = kind === "prompt" ? `${friendlyShotId(button.dataset.shotId)} · Final Prompt` : `${friendlyShotId(button.dataset.shotId)} · ${titleCase(kind)}`;
      byId("imageMakerDetailContent").textContent = kind === "prompt" ? formatPromptDetail(response.detail) : JSON.stringify(response.detail, null, 2); byId("imageMakerDetailDialog").showModal();
    } catch (error) { showToast(cleanPublicMessage(error.message), true); }
  }

  async function loadRuns() {
    try {
      const response = await getJson("/api/image-maker/runs");
      byId("imageMakerRunHistory").innerHTML = (response.items || []).slice(0, 20).map(projectRunHistoryItem).map((item) => `
        <article class="image-maker-run-history-card">
          <button type="button" class="run-history-open" data-image-maker-run="${escapeHtml(item.runId)}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.dateLabel)}</small><span>${escapeHtml(item.modeLabel)} · ${escapeHtml(item.countLabel)} · ${escapeHtml(item.statusLabel)}</span></button>
          <div class="actions compact-actions"><button type="button" data-reuse-request="${escapeHtml(item.runId)}">Use This Request Again</button><button type="button" data-reuse-plan="${escapeHtml(item.runId)}">Reuse Director Plan</button></div>
        </article>`).join("") || "<p>No Image Maker runs yet.</p>";
    } catch (error) { showToast(cleanPublicMessage(error.message), true); }
  }

  async function runDetail(runId) {
    if (!model.runCache.has(runId)) model.runCache.set(runId, getJson(`/api/image-maker/runs/${encodeURIComponent(runId)}`).then((response) => response.run));
    return model.runCache.get(runId);
  }

  async function handleRunHistoryAction(event) {
    const target = event.target.closest?.("[data-image-maker-run],[data-reuse-request],[data-reuse-plan]"); if (!target) return;
    const runId = target.dataset.imageMakerRun || target.dataset.reuseRequest || target.dataset.reusePlan;
    try {
      const run = await runDetail(runId);
      if (target.dataset.reuseRequest) { reuseRequest(run); return; }
      if (target.dataset.reusePlan) { reusePlan(run); return; }
      openHistoricalRun(run);
    } catch (error) { showToast(cleanPublicMessage(error.message), true); }
  }

  function openHistoricalRun(run) {
    model.run = run;
    if (run.directorPlan) { model.displayPlan = run.directorPlan; renderPlanMeta(run.directorPlan); renderShots(run.directorPlan); }
    renderRunSummary(run.status, generationTitle(run.status), `${run.completedCount || 0} / ${run.requestedCount || 0} completed`);
    renderShotStatuses(run); renderReview(run); renderGallery(run);
  }

  function reuseRequest(run) {
    if (!run.request) throw new Error("This run does not contain a reusable request.");
    clearActivePlan(); applyRequestToControls(run.request); handleRequestChange();
    setPlanStatus("과거 요청을 복사했습니다. Create Director Plan을 눌러 새 plan을 만드세요.", "ok");
  }

  function reusePlan(run) {
    if (!run.request || !run.directorPlan) throw new Error("This run does not contain a reusable Director Plan.");
    applyRequestToControls(run.request);
    const workflow = captureWorkflow(false); const plan = normalizePlanForWorkflow(workflow.request, run.directorPlan);
    requireMatchingPlan(workflow.request, plan);
    acceptPlan(workflow.request, plan, { source: "reused", workshopContext: workflow.workshopContext });
    setPlanStatus("과거 Director Plan을 가져왔습니다. 생성 전에 Preflight를 다시 실행하세요.", "ok");
  }

  function applyRequestToControls(request) {
    byId("imageMakerRequest").value = request.request || ""; byId("imageMakerCount").value = String(request.count || 1);
    model.presetBlocks = structuredClone(request.presetBlocks || []); renderPresetBlocks();
    const mode = document.querySelector(`input[name="imageMakerMode"][value="${request.mode}"]`); if (mode) mode.checked = true;
  }

  function reset() {
    clearActivePlan(); model.presetBlocks = []; renderPresetBlocks(); byId("imageMakerRequest").value = ""; byId("imageMakerPlanJson").value = ""; byId("imageMakerCount").value = "4";
    document.querySelector('input[name="imageMakerMode"][value="editorial"]').checked = true;
    byId("imageMakerGallery").innerHTML = ""; byId("imageMakerResultsPanel").hidden = true; byId("imageMakerRendererNote").hidden = true;
    setPlanStatus("Director Plan을 준비하면 shot 구도를 여기서 확인할 수 있습니다.", ""); renderRunSummary("idle", "Idle", "Director Plan을 먼저 준비하세요."); syncButtons();
  }

  function clearActivePlan() {
    Object.assign(model, { plan: null, request: null, preflight: null, run: null, displayPlan: null, busy: false, activity: null, planRequestRevision: null, preflightPlanRevision: null, planSource: null });
    byId("imageMakerShotList").innerHTML = ""; byId("imageMakerShotOverview").innerHTML = ""; byId("imageMakerProgressList").innerHTML = ""; byId("imageMakerReviewList").innerHTML = "";
    byId("imageMakerPlanSourceBadge").textContent = "No plan"; byId("imageMakerPlanMode").innerHTML = "";
  }

  function handleRequestChange() {
    renderPresetBlocks();
    if (!model.plan) { syncButtons(); return; }
    const state = freshness();
    if (state.planStale) {
      setPlanStatus("Director Plan needs refresh. 입력 조건이 plan을 만든 조건과 달라졌습니다.", "stale");
      renderRunSummary("plan-stale", "Plan Out of Date", "현재 입력으로 Director Plan을 다시 만들거나 Manual Plan을 준비하세요.");
    } else if (state.preflightStale || !model.preflightPlanRevision) {
      setPlanStatus("Director Plan은 현재 입력과 일치합니다.", "ok");
      renderRunSummary("preflight-stale", "Preflight Out of Date", "Generate 전에 Preflight를 다시 실행하세요.");
    }
    syncButtons();
  }

  function syncButtons() {
    let state = { planStale: true, canPreflight: false, canGenerate: false };
    try { state = freshness(); } catch {}
    byId("imageMakerCreatePlanButton").disabled = model.busy || Boolean(model.plan && !state.planStale);
    byId("imageMakerRegeneratePlanButton").disabled = model.busy || !model.plan || state.planStale;
    byId("imageMakerRegeneratePlanButton").hidden = !model.plan;
    byId("imageMakerCreatePlanButton").textContent = model.activity === "directing" ? "Creating…" : model.plan && !state.planStale ? "Plan Ready" : "Create Director Plan";
    byId("imageMakerRegeneratePlanButton").textContent = "Regenerate Plan";
    byId("imageMakerPreflightButton").disabled = model.busy || !state.canPreflight;
    const count = Number(byId("imageMakerCount").value) || 0;
    const requestReady = Boolean(byId("imageMakerRequest").value.trim()) && Number.isSafeInteger(count) && count > 0;
    byId("imageMakerGenerateButton").disabled = model.busy || !requestReady;
    byId("imageMakerGenerateButton").textContent = model.activity === "directing" ? "Creating Director Plan…" : model.activity === "preflighting" ? "Checking…" : model.activity === "generating" ? `Generating 0 / ${count}` : `Generate ${count} Image${count === 1 ? "" : "s"}`;
  }

  function requireRequest(request) {
    if (!request.request) throw new Error("무엇을 만들지 입력하세요.");
    if (!Number.isSafeInteger(request.count) || request.count < 1) throw new Error("Count는 1 이상의 정수여야 합니다.");
    if (request.schema === "chaessi-image-request/v3" && request.presetBlocks.some((block) => !block.presetId)) throw new Error("추가한 preset block에서 preset을 선택하세요.");
  }
  function requireMatchingPlan(request, plan) {
    if (plan?.schema !== "chaessi-scene-plan/v2") throw new Error("scene-plan/v2 JSON이 필요합니다.");
    if (plan.mode !== request.mode || plan.count !== request.count || plan.shots?.length !== request.count) throw new Error("Plan의 mode와 shot 수가 현재 Request와 일치해야 합니다.");
    if (request.schema !== "chaessi-image-request/v3") {
      const selected = request.presets; const presets = plan.presetSelections || {};
      if (presets.basePresetId !== selected.basePresetId || presets.characterPresetIds?.[0] !== selected.characterPresetId || presets.outfitPresetIds?.[0] !== selected.outfitPresetId) throw new Error("Plan의 Base, Character, Outfit preset이 현재 선택과 일치해야 합니다.");
    }
  }
  function normalizePlanForWorkflow(request, source) {
    const plan = structuredClone(source);
    if (request.schema !== "chaessi-image-request/v3") return plan;
    const actorCount = plan.shots?.[0]?.generation?.characters?.length || 1;
    plan.presetSelections = {
      basePresetId: "image_maker_active_workshop",
      characterPresetIds: Array.from({ length: actorCount }, (_, index) => `image_maker_actor_${index + 1}`),
      outfitPresetIds: Array.from({ length: actorCount }, (_, index) => `image_maker_modifier_${index + 1}`),
      stylePresetId: null, qualityPresetId: null, cameraPresetId: null, lightingPresetId: null,
    };
    for (const shot of plan.shots || []) for (let index = 0; index < (shot.generation?.characters || []).length; index += 1) {
      shot.generation.characters[index].characterPresetId = plan.presetSelections.characterPresetIds[index];
    }
    return plan;
  }
  function setPlanStatus(text, status) { byId("imageMakerPlanStatus").textContent = text; byId("imageMakerPlanStatus").className = `summary ${status}`.trim(); }
  function renderRunSummary(status, title, message) { const root = byId("imageMakerRunSummary"); root.dataset.status = status; root.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`; }
}

function directorErrorMessage(error) {
  const code = error?.code || error?.type;
  return ({
    CODEX_NOT_AVAILABLE: "Director를 사용할 수 없습니다. Paste Plan 또는 Import Plan을 사용할 수 있습니다.",
    CODEX_NOT_AUTHENTICATED: "Director 로그인이 필요합니다. Manual Plan을 계속 사용할 수 있습니다.",
    CODEX_LIMIT_REACHED: "Codex 사용 한도 때문에 Director를 사용할 수 없습니다. Cached Plan 또는 Manual Plan을 사용할 수 있습니다.",
    CODEX_TIMEOUT: "Director가 제한 시간 안에 응답하지 않았습니다. 기존 plan은 유지됩니다.",
    CODEX_PROCESS_FAILED: "Director Plan 생성을 완료하지 못했습니다. 기존 plan은 유지됩니다.",
    CODEX_INVALID_OUTPUT: "Director 응답을 plan으로 읽을 수 없습니다. 기존 plan은 유지됩니다.",
    CODEX_SCHEMA_INVALID: "Director 응답이 scene-plan/v2 검증을 통과하지 못했습니다. 기존 plan은 유지됩니다.",
    CODEX_COUNT_MISMATCH: "Director가 요청한 수와 다른 shot 수를 반환했습니다. 기존 plan은 유지됩니다.",
    CODEX_CANCELLED: "Director Plan 생성이 취소됐습니다. 기존 plan은 유지됩니다.",
  })[code] || cleanPublicMessage(error?.message || "Director Plan 생성에 실패했습니다.");
}

function operationId() { return crypto.randomUUID().replaceAll("-", "_"); }
function formatNumber(value) { return Number(value).toFixed(3); }
function friendlyShotId(value) { const number = String(value || "").match(/(\d+)$/)?.[1]; return number ? `Shot ${String(Number(number)).padStart(2, "0")}` : value; }
function statusLabel(value) { return ({ ready: "READY", completed: "✓ COMPLETED", failed: "FAILED", "needs-review": "REVIEW", waiting: "WAITING", pending: "PENDING" })[value] || String(value || "").toUpperCase(); }
function generationTitle(value) { return ({ prepared: "Preparing", ready: "Ready", generating: "Generating", completed: "Completed", "partial-failure": "Partial Failure", failed: "Failed" })[value] || titleCase(value); }
function titleCase(value) { return String(value || "").replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function formatPromptDetail(detail = {}) {
  const characters = (detail.characters || []).map((item) => `Character ${item.slot}:\n${item.prompt || ""}${item.undesired ? `\nUndesired: ${item.undesired}` : ""}`).join("\n\n");
  return [`Positive:\n${detail.base || ""}`, characters, `Negative:\n${detail.undesired || ""}`].filter(Boolean).join("\n\n");
}
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
