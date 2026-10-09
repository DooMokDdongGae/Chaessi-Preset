// Presentation only: reuse the existing fields, dialogs and application actions.
// This key stores layout preferences, never prompts, History or API credentials.
export function createWorkbenchController() {
  const $ = id => document.getElementById(id);
  const key = "chaessi.workbench-layout.v1";
  let preferences = {};
  try { preferences = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
  if (!preferences || typeof preferences !== "object") preferences = {};
  const persist = () => { try { localStorage.setItem(key, JSON.stringify(preferences)); } catch {} };
  const move = (selector, parent) => { const node = document.querySelector(selector); if (node) parent.append(node); return node; };
  const shell = document.createElement("div");
  shell.className = "workbench-shell";
  shell.innerHTML = `
    <nav class="workspace-nav" aria-label="Workspace">
      <button type="button" data-workspace-view="workbench" aria-current="page"><span aria-hidden="true">▦</span>Workbench</button>
      <button type="button" id="navPresets"><span aria-hidden="true">▤</span>Presets</button>
      <div id="navWildcards"></div>
      <button type="button" data-workspace-view="history"><span aria-hidden="true">▧</span>History</button>
      <button type="button" id="navImport"><span aria-hidden="true">＋</span>Image / JSON</button>
      <div class="nav-bottom"><button type="button" id="navManuals">ⓘ Help Center</button><div id="navSettings"></div></div>
    </nav>
    <div class="workspace-content">
      <section id="workbenchView" aria-label="Prompt and result workbench">
        <div class="compact-workspace-tabs" role="group" aria-label="Small window pane">
          <button type="button" data-workbench-pane="edit">Edit prompts</button><button type="button" data-workbench-pane="result">Image result</button>
        </div>
        <div class="split-workbench" id="splitWorkbench">
          <div class="editor-pane" id="editorPane"></div>
          <div class="workbench-divider" id="workbenchDivider" tabindex="0" role="separator" aria-label="Resize prompt and image panes" aria-orientation="vertical" aria-valuemin="36" aria-valuemax="64"></div>
          <div class="result-pane" id="resultPane"></div>
        </div>
      </section>
      <section id="historyView" class="history-view" aria-label="History gallery" hidden></section>
    </div>
    <footer class="generation-dock" id="generationDock"><div class="dock-settings" id="dockSettings"></div><div class="dock-command" id="dockCommand"></div></footer>`;
  const oldWorkspace = document.querySelector(".workspace");
  oldWorkspace.before(shell);
  move("#panel-preset", $("editorPane"));
  move("#panel-generate", $("resultPane"));
  move("#panel-history", $("historyView"));
  move("#openWildcardsButton", $("navWildcards"));
  move("#apiSettingsButton", $("navSettings"));

  function makeDialog(id, title, description) {
    const dialog = document.createElement("dialog");
    dialog.id = id; dialog.className = "workbench-tool-dialog";
    const header = document.createElement("header"); header.className = "dialog-header";
    header.innerHTML = `<div><h2>${title}</h2><p>${description}</p></div><button type="button">Close</button>`;
    header.querySelector("button").addEventListener("click", () => dialog.close());
    dialog.append(header); document.body.append(dialog); return dialog;
  }
  const settings = makeDialog("generationSettingsDialog", "Generation Settings", "All settings apply to the current workbench.");
  const params = document.querySelector(".preset-params-surface");
  for (const id of ["paramModel", "paramWidth", "paramHeight", "paramSteps", "paramScale", "paramSeed"]) {
    $("dockSettings").append($(id).closest("label"));
  }
  const advanced = document.createElement("button"); advanced.type = "button"; advanced.id = "advancedSettingsButton";
  advanced.textContent = "More settings"; advanced.addEventListener("click", () => settings.showModal());
  $("dockSettings").append(advanced); settings.append(params);
  move(".generate-command-row", $("dockCommand"));
  $("generateStatus").setAttribute("role", "status"); $("generateStatus").setAttribute("aria-live", "polite");
  $("paramSeed").placeholder = "Random";
  const api = makeDialog("apiSettingsDialog", "NovelAI API", "Manage the saved token and account status.");
  move(".api-settings-surface", api);
  const intake = makeDialog("importWorkspaceDialog", "Image & metadata", "Open an image or import raw NovelAI JSON.");
  move("#panel-import", intake);
  const summary = document.createElement("details"); summary.className = "workbench-summary";
  summary.innerHTML = "<summary>Current preset details</summary>";
  move("#currentPresetSummary", summary); $("panel-preset").append(summary);
  oldWorkspace.remove();
  $("apiSettingsButton").addEventListener("click", () => api.showModal());
  $("navImport").addEventListener("click", () => intake.showModal());
  $("navPresets").addEventListener("click", () => $("openPresetLoadButton").click());
  $("navManuals").addEventListener("click", () => document.dispatchEvent(new Event('chaessi:open-manual')));

  // Keep the preview prominent; source and reference tools remain available below it.
  const generateSurface = document.querySelector(".generate-surface");
  const preview = document.querySelector(".generation-layout");
  generateSurface.prepend(preview);
  const empty = document.createElement("div"); empty.className = "result-empty"; empty.id = "resultEmpty";
  empty.innerHTML = "<span aria-hidden='true'>✦</span><strong>Your next image starts here</strong><p>Edit a prompt, then Generate.</p>";
  document.querySelector(".result-preview-frame").append(empty);
  const syncEmpty = () => { empty.hidden = Boolean($("generatedImage").getAttribute("src")); };
  new MutationObserver(syncEmpty).observe($("generatedImage"), { attributes: true, attributeFilter: ["src"] }); syncEmpty();
  const reference = document.createElement("details"); reference.className = "reference-disclosure";
  reference.innerHTML = "<summary>Precise Reference <span id='referenceDisclosureCount'></span></summary>";
  const referencePanel = $("preciseReferencePanel"); referencePanel.before(reference); reference.append(referencePanel);
  const syncReference = () => {
    reference.hidden = referencePanel.hidden;
    $("referenceDisclosureCount").textContent = $("preciseReferenceCount").textContent;
    if ($("preciseReferenceList").children.length) reference.open = true;
  };
  new MutationObserver(syncReference).observe($("preciseReferenceList"), { childList: true }); syncReference();
  new MutationObserver(syncReference).observe(referencePanel, { attributes: true, attributeFilter: ["hidden"] });
  const view = name => {
    const history = name === "history";
    $("workbenchView").hidden = history; $("historyView").hidden = !history;
    shell.dataset.view = history ? "history" : "workbench";
    document.querySelectorAll("[data-workspace-view]").forEach(button => {
      if (button.dataset.workspaceView === name) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    if (history && !$("historyList").children.length) $("loadHistoryButton").click();
  };
  document.querySelectorAll("[data-workspace-view]").forEach(button => button.addEventListener("click", () => view(button.dataset.workspaceView)));
  const selectPane = pane => {
    preferences.pane = pane === "result" ? "result" : "edit"; shell.dataset.pane = preferences.pane;
    document.querySelectorAll("[data-workbench-pane]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.workbenchPane === preferences.pane)));
    persist();
  };
  document.querySelectorAll("[data-workbench-pane]").forEach(button => button.addEventListener("click", () => selectPane(button.dataset.workbenchPane)));
  selectPane(preferences.pane); view("workbench");
  const divider = $("workbenchDivider");
  const resize = value => {
    preferences.split = Math.max(36, Math.min(64, Number(value) || 48));
    $("splitWorkbench").style.setProperty("--editor-share", `${preferences.split}%`);
    divider.setAttribute("aria-valuenow", String(Math.round(preferences.split))); persist();
  };
  resize(preferences.split);
  divider.addEventListener("pointerdown", event => { divider.setPointerCapture(event.pointerId); divider.classList.add("is-dragging"); });
  divider.addEventListener("pointermove", event => {
    if (!divider.hasPointerCapture(event.pointerId)) return;
    const rect = $("splitWorkbench").getBoundingClientRect(); resize(100 * (event.clientX - rect.left) / rect.width);
  });
  divider.addEventListener("pointerup", event => { divider.releasePointerCapture(event.pointerId); divider.classList.remove("is-dragging"); });
  divider.addEventListener("pointercancel", () => divider.classList.remove("is-dragging"));
  divider.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    event.preventDefault(); resize(event.key === "Home" ? 48 : preferences.split + (event.key === "ArrowLeft" ? -2 : 2));
  });

  // Selected prompt remains expanded while using its toolbar or a modal dialog.
  const promptSelector = "#basePrompt, #undesiredPrompt, #characterCards textarea";
  let selected = null;
  const fit = input => {
    if (!input?.isConnected || !input.classList.contains("is-editing")) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(Math.max(220, input.scrollHeight + 2), Math.max(220, innerHeight * .48))}px`;
  };
  function activate(input) {
    if (selected !== input) { selected?.classList.remove("is-editing"); if (selected) selected.style.height = ""; }
    selected = input; input.classList.add("is-editing"); fit(input);
  }
  document.addEventListener("focusin", event => { if (event.target.matches?.(promptSelector)) activate(event.target); });
  document.addEventListener("input", event => { if (event.target.matches?.(promptSelector)) fit(event.target); });
  window.addEventListener("resize", () => fit(selected));
  const expanded = makeDialog("promptEditorDialog", "Large prompt editor", "Changes are applied as you type. Close or Esc to return.");
  expanded.classList.add("prompt-editor-dialog");
  const expandedActions = document.createElement("div"); expandedActions.className = "section-row";
  expandedActions.innerHTML = "<span id='promptEditorLabel'></span><button type='button' data-insert-wildcard='promptExpandedInput'>Wildcard</button>";
  const expandedInput = document.createElement("textarea"); expandedInput.id = "promptExpandedInput"; expandedInput.spellcheck = false;
  expanded.append(expandedActions, expandedInput);
  let expandedSource = null;
  expandedInput.addEventListener("input", () => {
    if (!expandedSource?.isConnected) return;
    expandedSource.value = expandedInput.value;
    expandedSource.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expanded.addEventListener("close", () => {
    if (!expandedSource?.isConnected) return;
    const active = document.activeElement;
    if (!active?.matches?.(promptSelector) || active === expandedSource) expandedSource.focus({ preventScroll: true });
    expandedSource.setSelectionRange(expandedInput.selectionStart, expandedInput.selectionEnd);
    fit(expandedSource); expandedSource = null;
  });
  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-expand-prompt]"); if (!button) return;
    expandedSource = button.dataset.expandPrompt ? $(button.dataset.expandPrompt) : button.closest(".character-card").querySelector("textarea.is-active");
    if (!expandedSource) return;
    expandedInput.value = expandedSource.value;
    $("promptEditorLabel").textContent = expandedSource.id === "basePrompt" ? "Base Prompt" : expandedSource.id === "undesiredPrompt" ? "Undesired Content" : `Character ${Number(expandedSource.closest(".character-card").dataset.characterIndex) + 1} · ${expandedSource.dataset.characterField}`;
    const start = expandedSource.selectionStart, end = expandedSource.selectionEnd;
    expanded.showModal(); expandedInput.focus(); expandedInput.setSelectionRange(start, end);
  });

  // Preset browsing is the first task. Save/thumbnail/category management are a separate tab.
  const presetForm = $("characterPresetDialog").querySelector("form");
  const presetTabs = document.createElement("div"); presetTabs.className = "library-tabs";
  presetTabs.innerHTML = "<button type='button' data-library-tab='browse'>Browse & load</button><button type='button' data-library-tab='save'>Save & manage</button>";
  presetForm.querySelector(".dialog-header").after(presetTabs);
  const browse = document.createElement("section"); browse.id = "characterPresetBrowsePane";
  const save = document.createElement("section"); save.id = "characterPresetSavePane";
  presetForm.append(browse, save);
  const search = document.createElement("label"); search.className = "library-search";
  search.innerHTML = "Search presets <input id='characterPresetSearch' type='search' placeholder='Name or category…' autocomplete='off'>";
  browse.append(search);
  move(".character-preset-filter-row", browse);
  move("#dialogCharacterPresetList", browse); move("#dialogCharacterPresetCards", browse); move("#dialogCharacterPresetLoadMoreButton", browse);
  const browseActions = document.createElement("div"); browseActions.className = "actions";
  for (const id of ["dialogRefreshCharacterPresetButton", "dialogApplyCharacterPresetButton"]) browseActions.append($(id));
  browse.append(browseActions);
  for (const node of [...presetForm.children]) {
    if (node.matches(".grid.two, .character-thumb-picker, .dialog-preview")) save.append(node);
  }
  const saveActions = document.createElement("div"); saveActions.className = "actions";
  for (const id of ["dialogSaveCharacterPresetButton", "dialogSaveAsCharacterPresetButton", "dialogDeleteCharacterPresetButton", "manageCharacterPresetCategoriesButton"]) saveActions.append($(id));
  save.append(saveActions);
  [...presetForm.querySelectorAll(":scope > .actions")].forEach(node => node.remove());
  presetForm.append($("characterPresetDialogStatus"));
  function libraryTab(tab) {
    browse.hidden = tab !== "browse"; save.hidden = tab !== "save";
    presetTabs.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.libraryTab === tab)));
  }
  presetTabs.addEventListener("click", event => { if (event.target.dataset.libraryTab) libraryTab(event.target.dataset.libraryTab); });
  new MutationObserver(() => { if ($("characterPresetDialog").open) libraryTab("browse"); }).observe($("characterPresetDialog"), { attributes: true, attributeFilter: ["open"] }); libraryTab("browse");

  const historyTools = document.createElement("div"); historyTools.className = "history-gallery-tools";
  historyTools.innerHTML = `<label>Search <input id="historySearch" type="search" placeholder="Seed, model, date…"></label>
    <label>Model <select id="historyModelFilter"><option value="">All models</option><option value="nai-diffusion-4-5-full">V4.5</option><option value="nai-diffusion-5-full">V5</option></select></label>
    <label>Mode <select id="historyModeFilter"><option value="">All modes</option><option value="text-to-image">Text to Image</option><option value="image-to-image">Image to Image</option><option value="inpaint">Inpaint</option></select></label>
    <label>Thumbnail size <input id="historyThumbSize" type="range" min="160" max="300" step="20" value="220"></label><span id="historyFilterCount" role="status"></span>`;
  $("panel-history").querySelector(".panel-heading").after(historyTools);
  $("historyThumbSize").value = String(Math.max(160, Math.min(300, Number(preferences.thumbnails) || 220)));
  const thumbnails = () => { preferences.thumbnails = Number($("historyThumbSize").value); $("historyList").style.setProperty("--history-thumb-size", `${preferences.thumbnails}px`); persist(); };
  $("historyThumbSize").addEventListener("input", thumbnails); thumbnails();
  // Reuse controls in the large History viewer, next to the existing Save/Delete buttons.
  const reuse = document.createElement("div"); reuse.id = "viewerReuseActions"; reuse.className = "actions compact-actions"; reuse.hidden = true;
  for (const [action, label] of [["preview", "Keep in workbench"], ["preset", "Apply Preset"], ["seed", "Apply Seed"], ["params", "Apply Settings"], ["source", "Use as Source"]]) {
    const button = document.createElement("button"); button.type = "button"; button.dataset.viewerReuse = action; button.textContent = label; reuse.append(button);
  }
  document.querySelector(".image-viewer-actions").append(reuse);
  return {
    showWorkbench: () => view("workbench"),
    selectPane,
    captureFocus() {
      const input = document.activeElement;
      if (!input?.matches?.(promptSelector)) return null;
      return { id: input.id, index: input.closest(".character-card")?.dataset.characterIndex, field: input.dataset.characterField, start: input.selectionStart, end: input.selectionEnd, scroll: input.scrollTop };
    },
    restoreFocus(snapshot) {
      if (!snapshot) return;
      const input = snapshot.id ? $(snapshot.id) : document.querySelector(`#characterCards [data-character-index="${snapshot.index}"] [data-character-field="${snapshot.field}"]`);
      if (!input || !input.getClientRects().length) return;
      input.focus({ preventScroll: true }); input.setSelectionRange(snapshot.start, snapshot.end); input.scrollTop = snapshot.scroll;
    },
  };
}
