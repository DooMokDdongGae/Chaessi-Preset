import { deleteJson, getJson, postForm, postImage, postJson } from "./api/client.js";

const $ = (id) => document.getElementById(id);
let rawJsonImportTimer = null;
const state = {
  currentPreset: null,
  importResult: null,
  lastImportedSource: "",
  lastGeneratedImage: "",
  lastGenerationResponse: null,
  imageViewerContext: null,
  presets: [],
  generations: [],
  characterPresets: [],
  characterUiState: [],
  characterPresetContextIndex: null,
  presetSaveForceNew: false,
  presetThumbnailBlob: null,
  presetThumbnailPreviewUrl: "",
  characterThumbnailBlob: null,
  characterThumbnailPreviewUrl: "",
  characterThumbnailCleared: false,
  imageImportPreviewUrl: "",
  selectedDialogCharacterPresetId: "",
};

const fields = {
  presetName: $("presetName"),
  basePrompt: $("basePrompt"),
  undesiredPrompt: $("undesiredPrompt"),
  charactersJson: $("charactersJson"),
  width: $("paramWidth"),
  height: $("paramHeight"),
  steps: $("paramSteps"),
  scale: $("paramScale"),
  cfgRescale: $("paramCfgRescale"),
  sampler: $("paramSampler"),
  seed: $("paramSeed"),
  noiseSchedule: $("paramNoiseSchedule"),
  qualityToggle: $("paramQualityToggle"),
  ucPreset: $("paramUcPreset"),
  sm: $("paramSm"),
  smDyn: $("paramSmDyn"),
  dynamicThresholding: $("paramDynamicThresholding"),
};

const importFields = {
  base: $("importBasePrompt"),
  undesired: $("importUndesired"),
  characters: $("importCharactersJson"),
  width: $("importWidth"),
  height: $("importHeight"),
  steps: $("importSteps"),
  scale: $("importScale"),
  cfgRescale: $("importCfgRescale"),
  sampler: $("importSampler"),
  seed: $("importSeed"),
  noiseSchedule: $("importNoiseSchedule"),
};

init().catch((error) => showToast(error.message, true));

async function init() {
  bindActions();
  bindDropAndPaste();
  await refreshHealth();
  await refreshTokenStatus();
  const defaultResponse = await getJson("/api/preset/default");
  state.currentPreset = defaultResponse.preset;
  renderPresetForm();
  updateCurrentSummary();
}

function bindActions() {
  $("importImageButton").addEventListener("click", chooseImageForImport);
  $("imageInput").addEventListener("change", importImage);
  $("importRawButton").addEventListener("click", importRawJson);
  $("rawJsonInput").addEventListener("input", scheduleRawJsonAutoImport);
  $("pushTextBaseButton").addEventListener("click", () => pushPlainText("base"));
  $("pushTextUndesiredButton").addEventListener("click", () => pushPlainText("undesired"));
  $("applyImportButton").addEventListener("click", applyImport);
  $("savePresetButton").addEventListener("click", () => openPresetSaveDialog(false));
  $("saveAsPresetButton").addEventListener("click", () => openPresetSaveDialog(true));
  $("openPresetLoadButton").addEventListener("click", openPresetLoadDialog);
  $("confirmSavePresetButton").addEventListener("click", confirmPresetSave);
  $("presetUseCurrentImageButton").addEventListener("click", useCurrentImageAsPresetThumbnail);
  $("presetChooseThumbnailButton").addEventListener("click", () => $("presetThumbnailInput").click());
  $("presetClearThumbnailButton").addEventListener("click", clearPresetThumbnail);
  $("presetThumbnailInput").addEventListener("change", setPresetThumbnailFromFile);
  $("saveBasePromptButton").addEventListener("click", () => saveSectionPreset("base"));
  $("loadBasePromptListButton").addEventListener("click", () => loadSectionList("base"));
  $("applyBasePromptPresetButton").addEventListener("click", () => applySectionPreset("base"));
  $("deleteBasePromptPresetButton").addEventListener("click", () => deleteSectionPreset("base"));
  $("saveUndesiredButton").addEventListener("click", () => saveSectionPreset("undesired"));
  $("loadUndesiredListButton").addEventListener("click", () => loadSectionList("undesired"));
  $("applyUndesiredPresetButton").addEventListener("click", () => applySectionPreset("undesired"));
  $("deleteUndesiredPresetButton").addEventListener("click", () => deleteSectionPreset("undesired"));
  $("saveParamsButton").addEventListener("click", () => saveSectionPreset("params"));
  $("loadParamsListButton").addEventListener("click", () => loadSectionList("params"));
  $("applyParamsPresetButton").addEventListener("click", () => applySectionPreset("params"));
  $("deleteParamsPresetButton").addEventListener("click", () => deleteSectionPreset("params"));
  $("saveCharacterButton").addEventListener("click", saveCharacterSlot);
  $("loadCharacterListButton").addEventListener("click", loadCharacterList);
  $("applyCharacterPresetButton").addEventListener("click", applyCharacterPreset);
  $("deleteCharacterPresetButton").addEventListener("click", deleteCharacterPreset);
  $("dialogSaveCharacterPresetButton").addEventListener("click", saveCharacterSlotFromDialog);
  $("dialogSaveAsCharacterPresetButton").addEventListener("click", saveCharacterSlotAsFromDialog);
  $("dialogRefreshCharacterPresetButton").addEventListener("click", () => loadCharacterList({ dialog: true }));
  $("dialogApplyCharacterPresetButton").addEventListener("click", () => applyCharacterPreset({ dialog: true }));
  $("dialogDeleteCharacterPresetButton").addEventListener("click", () => deleteCharacterPreset({ dialog: true }));
  $("characterUseCurrentImageButton").addEventListener("click", useCurrentImageAsCharacterThumbnail);
  $("characterChooseThumbnailButton").addEventListener("click", () => $("characterThumbnailInput").click());
  $("characterClearThumbnailButton").addEventListener("click", clearCharacterThumbnail);
  $("characterThumbnailInput").addEventListener("change", setCharacterThumbnailFromFile);
  $("addCharacterButton").addEventListener("click", addCharacterCard);
  $("generateButton").addEventListener("click", generateImage);
  $("generatedImage").addEventListener("click", () => {
    if (state.lastGenerationResponse) openGenerationViewer(state.lastGenerationResponse);
  });
  $("historyImage").addEventListener("click", () => {
    const imagePath = $("historyImage").getAttribute("src");
    if (imagePath) {
      openImageViewer({
        title: "History Preview",
        imagePath,
        rows: [],
      });
    }
  });
  $("viewLatestButton").addEventListener("click", () => {
    if (state.lastGenerationResponse) openGenerationViewer(state.lastGenerationResponse);
  });
  $("downloadLatestButton").addEventListener("click", () => {
    const generation = state.lastGenerationResponse?.generation;
    if (generation?.image_path) downloadPath(toBrowserPath(generation.image_path), `${generation.id}.png`);
  });
  $("deleteLatestButton").addEventListener("click", deleteLatestGeneration);
  $("imageViewerSaveButton").addEventListener("click", () => {
    const context = state.imageViewerContext;
    if (context?.imagePath) downloadPath(context.imagePath, `${context.id || "generation"}.png`);
  });
  $("imageViewerDeleteButton").addEventListener("click", deleteViewedGeneration);
  $("loadHistoryButton").addEventListener("click", loadHistory);
  $("refreshTokenStatusButton").addEventListener("click", refreshTokenStatus);
  $("saveTokenButton").addEventListener("click", saveNovelAiToken);
  $("clearTokenButton").addEventListener("click", clearSavedNovelAiToken);
  $("apiSettingsButton").addEventListener("click", () => {
    document.querySelector(".api-settings-surface")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  Object.values(fields).filter((field) => field !== fields.charactersJson).forEach((field) => {
    field.addEventListener("input", () => {
      try {
        syncPresetFromForm();
        updateCurrentSummary();
      } catch {
        // JSON edits are validated when saving or generating.
      }
    });
  });
  fields.charactersJson.addEventListener("change", () => {
    try {
      const characters = parseCharactersJson(fields.charactersJson.value);
      state.currentPreset.prompt_parts.characters = sanitizeCharacters(characters);
      syncCharacterUiStateLength(state.currentPreset.prompt_parts.characters);
      renderCharacterCards(state.currentPreset.prompt_parts.characters);
      updateCurrentSummary();
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

function bindDropAndPaste() {
  const dropZone = $("dropZone");
  dropZone.addEventListener("click", () => $("imageInput").click());
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-over");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-over");
    });
  });
  dropZone.addEventListener("drop", async (event) => {
    const file = [...(event.dataTransfer?.files || [])].find((item) => item.type.startsWith("image/"));
    if (file) await importImageFile(file, `dropped:${file.name || "image"}`);
  });

  document.addEventListener("paste", async (event) => {
    const file = [...(event.clipboardData?.files || [])].find((item) => item.type.startsWith("image/"));
    if (file) {
      await importImageFile(file, "clipboard image");
      return;
    }
    const text = event.clipboardData?.getData("text/plain")?.trim();
    if (text && document.activeElement === document.body) {
      $("plainTextInput").value = text;
      showToast("Text pasted into import text area.");
    }
  });
}

async function refreshHealth() {
  const health = await getJson("/api/health");
  $("healthStatus").textContent = `v${health.version || "0.0.0"}`;
}

async function refreshTokenStatus() {
  const response = await getJson("/api/settings/token-status");
  const token = response.token || {};
  setSummary(
    $("tokenStatus"),
    formatTokenStatus(token),
    Boolean(token.configured),
  );
}

async function saveNovelAiToken() {
  const input = $("tokenInput");
  const token = input.value.trim();
  if (!token) return showToast("Paste a NovelAI token first.", true);
  return withButton($("saveTokenButton"), "Saving", async () => {
    await postJson("/api/settings/token", { provider: "novelai", token });
    input.value = "";
    await refreshTokenStatus();
    showToast("NovelAI token saved.");
  });
}

async function clearSavedNovelAiToken() {
  return withButton($("clearTokenButton"), "Clearing", async () => {
    await deleteJson("/api/settings/token/novelai");
    $("tokenInput").value = "";
    await refreshTokenStatus();
    showToast("Saved NovelAI token cleared.");
  });
}

function formatTokenStatus(token) {
  if (token.source === "safe_storage") return "NovelAI token saved in secure local storage.";
  if (token.source === "env") return "NovelAI token configured from environment or local .env.";
  return "NovelAI token is not configured.";
}

async function importImage() {
  const input = $("imageInput");
  const file = input.files?.[0];
  if (!file) return showToast("Choose an image first.", true);
  await importImageFile(file, file.name || "file picker image");
  input.value = "";
}

function chooseImageForImport() {
  const input = $("imageInput");
  if (input.files?.[0]) return importImage();
  input.click();
}

async function importImageFile(file, sourceLabel) {
  return withButton($("importImageButton"), "Importing", async () => {
    const response = await postImage("/api/import/image", file);
    state.importResult = response.import_result;
    state.lastImportedSource = sourceLabel;
    setImageImportPreview(file, sourceLabel);
    renderImportResult();
    await applyImportedResultAutomatically("Image metadata imported and applied.");
  });
}

function setImageImportPreview(file, sourceLabel) {
  if (state.imageImportPreviewUrl) URL.revokeObjectURL(state.imageImportPreviewUrl);
  state.imageImportPreviewUrl = URL.createObjectURL(file);
  const preview = $("imageImportPreview");
  preview.src = state.imageImportPreviewUrl;
  preview.hidden = false;
  $("imageImportTitle").textContent = sourceLabel || file.name || "Imported image";
  $("imageImportHint").textContent = "Metadata imported. Drop, paste, or choose another image to replace it.";
}

async function importRawJson() {
  const text = $("rawJsonInput").value.trim();
  if (!text) return showToast("Paste raw JSON first.", true);
  return importRawJsonText(text, { notify: true });
}

function scheduleRawJsonAutoImport() {
  const text = $("rawJsonInput").value.trim();
  clearTimeout(rawJsonImportTimer);
  if (!text) {
    setSummary($("rawJsonImportStatus"), "Paste valid raw JSON to import automatically.");
    return;
  }
  try {
    JSON.parse(text);
  } catch {
    setSummary($("rawJsonImportStatus"), "Waiting for valid JSON.", false);
    return;
  }
  setSummary($("rawJsonImportStatus"), "Valid JSON detected. Importing automatically...");
  rawJsonImportTimer = setTimeout(() => {
    importRawJsonText(text, { notify: false }).catch((error) => {
      setSummary($("rawJsonImportStatus"), error.message, false, true);
    });
  }, 450);
}

async function importRawJsonText(text, { notify = true } = {}) {
  return withButton($("importRawButton"), "Importing", async () => {
    const response = await postJson("/api/import/raw-json", { text });
    state.importResult = response.import_result;
    state.lastImportedSource = "raw JSON";
    renderImportResult();
    await applyImportedResultAutomatically(
      notify ? "Raw JSON imported and applied." : "Raw JSON imported automatically.",
    );
    setSummary($("rawJsonImportStatus"), "Imported automatically.", true);
  });
}

function pushPlainText(target) {
  const text = $("plainTextInput").value.trim();
  if (!text) return showToast("Paste text first.", true);
  if (target === "base") fields.basePrompt.value = text;
  if (target === "undesired") fields.undesiredPrompt.value = text;
  syncPresetFromForm();
  updateCurrentSummary();
  showToast(target === "base" ? "Text applied to base prompt." : "Text applied to undesired prompt.");
}

async function applyImport() {
  if (!state.importResult) return showToast("Import something first.", true);
  return withButton($("applyImportButton"), "Applying", async () => {
    syncPresetFromForm();
    const response = await postJson("/api/import/apply", {
      current_preset: state.currentPreset,
      import_result: getEditedImportResult(),
      options: {
        applyBasePrompt: $("applyBasePrompt").checked,
        applyUndesired: $("applyUndesired").checked,
        applyCharacters: $("applyCharacters").checked,
        applyParams: $("applyParams").checked,
      },
    });
    state.currentPreset = response.preset;
    renderPresetForm();
    updateCurrentSummary();
    showToast("Import applied to current preset.");
  });
}

async function applyImportedResultAutomatically(message) {
  if (!state.importResult) return;
  syncPresetFromForm();
  const response = await postJson("/api/import/apply", {
    current_preset: state.currentPreset,
    import_result: state.importResult,
    options: {
      applyBasePrompt: true,
      applyUndesired: true,
      applyCharacters: true,
      applyParams: true,
    },
  });
  state.currentPreset = response.preset;
  renderPresetForm();
  updateCurrentSummary();
  renderImportResult();
  showToast(message);
}

async function openPresetSaveDialog(forceNew) {
  syncPresetFromForm();
  state.presetSaveForceNew = Boolean(forceNew || !state.currentPreset?.metadata?.id);
  state.presetThumbnailBlob = null;
  $("presetSaveDialogTitle").textContent = state.presetSaveForceNew ? "Save As" : "Save";
  $("presetSaveNameInput").value = state.currentPreset.metadata?.name || "Untitled Preset";
  setSummary($("presetSaveStatus"), state.presetSaveForceNew ? "Saving as a new preset." : "Saving current preset.");
  if (state.lastGeneratedImage) {
    await setPresetThumbnailPreviewFromSource(state.lastGeneratedImage, { makeBlob: true });
  } else if (!state.presetSaveForceNew && state.currentPreset.metadata?.thumbnail_path) {
    setPresetThumbnailPreview(toBrowserPath(state.currentPreset.metadata.thumbnail_path));
  } else {
    clearPresetThumbnail();
  }
  $("presetSaveDialog").showModal();
}

async function confirmPresetSave() {
  return withButton($("confirmSavePresetButton"), "Saving", async () => {
    syncPresetFromForm();
    const preset = structuredClone(state.currentPreset);
    preset.metadata = preset.metadata || {};
    preset.metadata.name = $("presetSaveNameInput").value.trim() || "Untitled Preset";
    if (state.presetSaveForceNew) {
      preset.metadata.id = null;
      if (!state.presetThumbnailBlob) preset.metadata.thumbnail_path = null;
    }

    const form = new FormData();
    form.append("preset", JSON.stringify(preset));
    if (state.presetThumbnailBlob) {
      form.append("thumbnail", state.presetThumbnailBlob, "thumbnail.webp");
    }
    const response = await postForm("/api/presets", form);
    state.currentPreset = response.preset;
    renderPresetForm();
    updateCurrentSummary();
    $("presetSaveDialog").close();
    showToast(state.presetSaveForceNew ? "Preset saved as new." : "Preset saved.");
  });
}

async function openPresetLoadDialog() {
  await loadPresetList();
  $("presetLoadDialog").showModal();
}

async function loadPresetList() {
  const response = await getJson("/api/presets");
  state.presets = response.items || [];
  $("presetLoadList").innerHTML = state.presets.map(renderPresetLoadCard).join("")
    || "<div class=\"summary\">No saved presets yet.</div>";
  document.querySelectorAll("[data-load-preset]").forEach((button) => {
    button.addEventListener("click", () => loadPresetById(button.dataset.loadPreset));
  });
  document.querySelectorAll("[data-delete-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteJson(`/api/presets/${encodeURIComponent(button.dataset.deletePreset)}`);
      await loadPresetList();
      showToast("Preset deleted.");
    });
  });
  setSummary($("presetLoadStatus"), `${state.presets.length} presets loaded.`, true);
}

async function loadPresetById(id) {
  const response = await getJson(`/api/presets/${encodeURIComponent(id)}`);
  state.currentPreset = response.preset;
  state.characterUiState = [];
  renderPresetForm();
  updateCurrentSummary();
  $("presetLoadDialog").close();
  showToast("Preset loaded.");
}

function renderPresetLoadCard(item) {
  const thumb = item.thumbnail_path
    ? `<img src="${escapeHtml(toBrowserPath(item.thumbnail_path))}?v=${encodeURIComponent(item.updated_at || "")}" alt="" />`
    : "<div class=\"preset-card-thumb\"></div>";
  return `
    <article class="preset-card">
      ${thumb}
      <div>
        <strong>${escapeHtml(item.name || "Untitled Preset")}</strong>
        <small>${escapeHtml(item.updated_at || "")}</small>
        <small>${escapeHtml(item.model || "nai-diffusion-4-5-full")}</small>
        <div class="actions">
          <button type="button" data-load-preset="${escapeHtml(item.id)}">Load</button>
          <button type="button" data-delete-preset="${escapeHtml(item.id)}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

async function useCurrentImageAsPresetThumbnail() {
  if (!state.lastGeneratedImage) return showToast("Generate or select an image first.", true);
  await setPresetThumbnailPreviewFromSource(state.lastGeneratedImage, { makeBlob: true });
  setSummary($("presetSaveStatus"), "Using current image as thumbnail.", true);
}

async function setPresetThumbnailFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await setPresetThumbnailPreviewFromSource(URL.createObjectURL(file), { makeBlob: true });
  setSummary($("presetSaveStatus"), "Using selected file as thumbnail.", true);
  event.target.value = "";
}

function clearPresetThumbnail() {
  state.presetThumbnailBlob = null;
  if (state.presetThumbnailPreviewUrl) URL.revokeObjectURL(state.presetThumbnailPreviewUrl);
  state.presetThumbnailPreviewUrl = "";
  $("presetThumbnailPreview").classList.remove("has-image");
  $("presetThumbnailPreview").innerHTML = "No thumbnail";
}

async function setPresetThumbnailPreviewFromSource(src, { makeBlob }) {
  setPresetThumbnailPreview(src);
  if (makeBlob) state.presetThumbnailBlob = await makeThumbnailBlob(src);
}

function setPresetThumbnailPreview(src) {
  $("presetThumbnailPreview").classList.add("has-image");
  $("presetThumbnailPreview").innerHTML = `<img src="${escapeHtml(src)}" alt="" />`;
}

async function makeThumbnailBlob(src) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  const size = 320;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#080b10";
  context.fillRect(0, 0, size, size);
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create thumbnail."));
    }, "image/webp", 0.82);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load thumbnail image."));
    image.src = src;
  });
}

const sectionConfig = {
  base: {
    endpoint: "/api/base-prompts",
    listId: "basePromptList",
    makePreset: () => ({ name: fields.presetName.value || "Base Prompt", prompt: fields.basePrompt.value }),
    apply: (preset) => { fields.basePrompt.value = preset.prompt || ""; },
  },
  undesired: {
    endpoint: "/api/undesired-prompts",
    listId: "undesiredList",
    makePreset: () => ({ name: fields.presetName.value || "Undesired Prompt", undesired: fields.undesiredPrompt.value }),
    apply: (preset) => { fields.undesiredPrompt.value = preset.undesired || ""; },
  },
  params: {
    endpoint: "/api/params-presets",
    listId: "paramsPresetList",
    makePreset: () => {
      syncPresetFromForm();
      return { name: fields.presetName.value || "Params", params: state.currentPreset.params };
    },
    apply: (preset) => {
      state.currentPreset.params = { ...state.currentPreset.params, ...(preset.params || {}) };
      renderPresetForm();
    },
  },
};

async function saveSectionPreset(kind) {
  const config = sectionConfig[kind];
  syncPresetFromForm();
  const response = await postJson(config.endpoint, { preset: config.makePreset() });
  await loadSectionList(kind);
  showToast(`${response.preset.name} saved.`);
}

async function loadSectionList(kind) {
  const config = sectionConfig[kind];
  const response = await getJson(config.endpoint);
  renderSelect($(config.listId), response.items || []);
}

async function applySectionPreset(kind) {
  const config = sectionConfig[kind];
  const id = $(config.listId).value;
  if (!id) return showToast("Select a section preset first.", true);
  const response = await getJson(`${config.endpoint}/${encodeURIComponent(id)}`);
  config.apply(response.preset);
  syncPresetFromForm();
  renderPresetForm();
  showToast("Section preset applied.");
}

async function deleteSectionPreset(kind) {
  const config = sectionConfig[kind];
  const id = $(config.listId).value;
  if (!id) return showToast("Select a section preset first.", true);
  await deleteJson(`${config.endpoint}/${encodeURIComponent(id)}`);
  await loadSectionList(kind);
  showToast("Section preset deleted.");
}

async function saveCharacterSlot() {
  syncPresetFromForm();
  const index = Math.max(0, numberValue($("characterSlotInput").value, 1) - 1);
  const character = state.currentPreset.prompt_parts.characters[index];
  if (!character) return showToast("No character in that slot.", true);
  const response = await saveCharacterPresetRequest({
    name: character.name || `Character ${index + 1}`,
    enabled: character.enabled !== false,
    prompt: character.prompt || "",
    undesired: character.undesired || "",
    centers: character.centers,
  }, { includeThumbnail: false });
  await loadCharacterList();
  showToast(`${response.preset.name} saved.`);
}

async function saveCharacterSlotFromDialog() {
  if (state.characterPresetContextIndex === null) return showToast("No character slot selected.", true);
  if (!state.selectedDialogCharacterPresetId) {
    setSummary($("characterPresetDialogStatus"), "Select a saved preset to overwrite, or use Save As to create a new one.", true);
    return showToast("Select a character preset or use Save As.", true);
  }
  const response = await saveCharacterSlotFromDialogBase({ forceNew: false });
  if (!response) return;
  setSummary($("characterPresetDialogStatus"), `${response.preset.name} saved.`, true);
  showToast(`${response.preset.name} saved.`);
}

async function saveCharacterSlotAsFromDialog() {
  if (state.characterPresetContextIndex === null) return showToast("No character slot selected.", true);
  const response = await saveCharacterSlotFromDialogBase({ forceNew: true });
  if (!response) return;
  setSummary($("characterPresetDialogStatus"), `${response.preset.name} saved as a new character preset.`, true);
  showToast(`${response.preset.name} saved as new.`);
}

async function saveCharacterSlotFromDialogBase({ forceNew }) {
  const name = $("characterPresetNameInput").value.trim();
  $("characterSlotInput").value = String(state.characterPresetContextIndex + 1);
  syncPresetFromForm();
  const character = state.currentPreset.prompt_parts.characters[state.characterPresetContextIndex];
  if (!character) {
    showToast("No character in that slot.", true);
    return null;
  }
  const response = await saveCharacterPresetRequest({
    id: forceNew ? undefined : state.selectedDialogCharacterPresetId,
    name: name || character.name || `Character ${state.characterPresetContextIndex + 1}`,
    enabled: character.enabled !== false,
    prompt: character.prompt || "",
    undesired: character.undesired || "",
    centers: character.centers,
  }, { includeThumbnail: true });
  await loadCharacterList({ dialog: true });
  selectDialogCharacterPreset(response.preset.id);
  return response;
}

async function saveCharacterPresetRequest(preset, { includeThumbnail = true } = {}) {
  if (includeThumbnail && state.characterThumbnailCleared && !state.characterThumbnailBlob) {
    preset.thumbnail_path = null;
  }
  const form = new FormData();
  form.append("preset", JSON.stringify(preset));
  if (includeThumbnail && state.characterThumbnailBlob) {
    form.append("thumbnail", state.characterThumbnailBlob, "thumbnail.webp");
  }
  return await postForm("/api/character-presets", form);
}

async function openCharacterPresetDialog(index) {
  syncPresetFromForm();
  state.characterPresetContextIndex = index;
  state.selectedDialogCharacterPresetId = "";
  clearCharacterThumbnailPreview({ markCleared: false });
  updateCharacterPresetDialog();
  $("characterPresetDialog").showModal();
  await loadCharacterList({ dialog: true });
}

function updateCharacterPresetDialog() {
  const index = state.characterPresetContextIndex;
  const character = state.currentPreset.prompt_parts.characters[index];
  if (!character) return;
  $("characterPresetContext").textContent = `Character ${index + 1} / ${character.name || "Untitled"}`;
  $("characterPresetNameInput").value = character.name || `Character ${index + 1}`;
  $("characterPresetPromptPreview").textContent = character.prompt || "(empty)";
  $("characterPresetUndesiredPreview").textContent = character.undesired || "(empty)";
  setSummary($("characterPresetDialogStatus"), "Choose a saved character preset to load, or use Save As to create a new one.", false);
}

async function useCurrentImageAsCharacterThumbnail() {
  if (!state.lastGeneratedImage) return showToast("Generate or select an image first.", true);
  await setCharacterThumbnailPreviewFromSource(state.lastGeneratedImage, { makeBlob: true });
  setSummary($("characterPresetDialogStatus"), "Using current image as thumbnail.", true);
}

async function setCharacterThumbnailFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    await setCharacterThumbnailPreviewFromSource(url, { makeBlob: true });
    setSummary($("characterPresetDialogStatus"), "Using selected file as thumbnail.", true);
  } finally {
    URL.revokeObjectURL(url);
    event.target.value = "";
  }
}

function clearCharacterThumbnail() {
  clearCharacterThumbnailPreview({ markCleared: true });
  setSummary($("characterPresetDialogStatus"), "Thumbnail cleared. Save to update the preset.", false);
}

function clearCharacterThumbnailPreview({ markCleared = false } = {}) {
  state.characterThumbnailBlob = null;
  state.characterThumbnailCleared = markCleared;
  if (state.characterThumbnailPreviewUrl) URL.revokeObjectURL(state.characterThumbnailPreviewUrl);
  state.characterThumbnailPreviewUrl = "";
  $("characterPresetThumbnailPreview").classList.remove("has-image");
  $("characterPresetThumbnailPreview").innerHTML = "No thumbnail";
}

async function setCharacterThumbnailPreviewFromSource(src, { makeBlob }) {
  setCharacterThumbnailPreview(src);
  if (makeBlob) state.characterThumbnailBlob = await makeThumbnailBlob(src);
}

function setCharacterThumbnailPreview(src) {
  state.characterThumbnailCleared = false;
  $("characterPresetThumbnailPreview").classList.add("has-image");
  $("characterPresetThumbnailPreview").innerHTML = `<img src="${escapeHtml(src)}" alt="" />`;
}

async function loadCharacterList({ dialog = false } = {}) {
  const response = await getJson("/api/character-presets");
  state.characterPresets = response.items || [];
  if (dialog && state.selectedDialogCharacterPresetId && !state.characterPresets.some((item) => item.id === state.selectedDialogCharacterPresetId)) {
    state.selectedDialogCharacterPresetId = "";
  }
  renderSelect($("characterPresetList"), response.items || []);
  renderSelect($("dialogCharacterPresetList"), response.items || []);
  if (dialog) {
    renderDialogCharacterPresetCards(response.items || []);
    const selectedCopy = state.selectedDialogCharacterPresetId
      ? " Select a card to load it, or Save to overwrite the selected preset."
      : " Select a card to load it, or use Save As to create a new preset.";
    setSummary($("characterPresetDialogStatus"), `${response.items?.length || 0} character presets loaded.${selectedCopy}`, true);
  }
}

async function applyCharacterPreset({ dialog = false } = {}) {
  const list = dialog ? $("dialogCharacterPresetList") : $("characterPresetList");
  const id = dialog ? state.selectedDialogCharacterPresetId || list.value : list.value;
  if (!id) return showToast("Select a character preset first.", true);
  const index = dialog
    ? state.characterPresetContextIndex
    : Math.max(0, numberValue($("characterSlotInput").value, 1) - 1);
  if (index === null || index === undefined) return showToast("No character slot selected.", true);
  const response = await getJson(`/api/character-presets/${encodeURIComponent(id)}`);
  syncPresetFromForm();
  const characters = [...(state.currentPreset.prompt_parts.characters || [])];
  while (characters.length <= index) {
    characters.push({ id: `character_${characters.length + 1}`, name: `Character ${characters.length + 1}`, enabled: true, prompt: "", undesired: "", centers: [{ x: 0.5, y: 0.5 }] });
  }
  characters[index] = {
    id: characters[index].id || `character_${index + 1}`,
    name: response.preset.name || `Character ${index + 1}`,
    enabled: response.preset.enabled !== false,
    prompt: response.preset.prompt || "",
    undesired: response.preset.undesired || "",
    centers: response.preset.centers || [{ x: 0.5, y: 0.5 }],
  };
  state.currentPreset.prompt_parts.characters = characters;
  renderPresetForm();
  if (dialog) updateCharacterPresetDialog();
  showToast("Character preset applied.");
}

async function deleteCharacterPreset({ dialog = false } = {}) {
  const list = dialog ? $("dialogCharacterPresetList") : $("characterPresetList");
  const id = dialog ? state.selectedDialogCharacterPresetId || list.value : list.value;
  if (!id) return showToast("Select a character preset first.", true);
  await deleteJson(`/api/character-presets/${encodeURIComponent(id)}`);
  if (dialog && state.selectedDialogCharacterPresetId === id) state.selectedDialogCharacterPresetId = "";
  await loadCharacterList({ dialog });
  showToast("Character preset deleted.");
}

async function generateImage() {
  return withButton($("generateButton"), "Generating", async () => {
    syncPresetFromForm();
    setSummary($("generateStatus"), "Generating one image...", false);
    const response = await postJson("/api/novelai/generate", { preset: state.currentPreset });
    setSummary($("generateStatus"), "Generation saved.", true);
    $("generationSummary").innerHTML = renderGenerationSummary(response);
    $("generatedImage").src = toBrowserPath(response.generation.image_path);
    $("latestResultActions").hidden = false;
    state.lastGeneratedImage = toBrowserPath(response.generation.image_path);
    state.lastGenerationResponse = response;
    updateCurrentSummary();
    await loadHistory(false);
  }, (error) => {
    setSummary($("generateStatus"), error.message, false, true);
  });
}

async function deleteLatestGeneration() {
  const generation = state.lastGenerationResponse?.generation;
  if (!generation?.id) return showToast("No latest generation to delete.", true);
  await deleteJson(`/api/generations/${encodeURIComponent(generation.id)}`);
  $("generatedImage").removeAttribute("src");
  $("latestResultActions").hidden = true;
  $("generationSummary").innerHTML = "";
  state.lastGeneratedImage = "";
  state.lastGenerationResponse = null;
  updateCurrentSummary();
  await loadHistory(false);
  setSummary($("generateStatus"), "Generation deleted with image, sidecar, and payload.", true);
}

async function loadHistory(showMessage = true) {
  const response = await getJson("/api/generations");
  state.generations = response.items || [];
  $("historyList").innerHTML = state.generations.map(renderHistoryItem).join("") || "<div class=\"summary\">No generations yet.</div>";
  document.querySelectorAll("button[data-generation-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.generations.find((generation) => generation.id === button.dataset.generationId);
      if (item) viewHistoryGeneration(item.id);
    });
  });
  document.querySelectorAll("img[data-view-generation]").forEach((image) => {
    image.addEventListener("click", () => viewHistoryGeneration(image.dataset.viewGeneration));
  });
  document.querySelectorAll("[data-download-generation]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = state.generations.find((generation) => generation.id === button.dataset.downloadGeneration);
      if (item) downloadPath(toBrowserPath(item.image_path), `${item.id}.png`);
    });
  });
  document.querySelectorAll("[data-delete-generation]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const id = button.dataset.deleteGeneration;
      await deleteJson(`/api/generations/${encodeURIComponent(id)}`);
      if (state.lastGenerationResponse?.generation?.id === id) {
        $("generatedImage").removeAttribute("src");
        $("latestResultActions").hidden = true;
        $("generationSummary").innerHTML = "";
        state.lastGeneratedImage = "";
        state.lastGenerationResponse = null;
        updateCurrentSummary();
      }
      await loadHistory(false);
      showToast("Generation deleted with image, sidecar, and payload.");
    });
  });
  document.querySelectorAll("[data-apply-generation-seed]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await applyGenerationSeed(button.dataset.applyGenerationSeed);
    });
  });
  document.querySelectorAll("[data-apply-generation-params]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await applyGenerationParams(button.dataset.applyGenerationParams);
    });
  });
  document.querySelectorAll("[data-apply-generation-preset]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await applyGenerationPreset(button.dataset.applyGenerationPreset);
    });
  });
  if (showMessage) showToast("History loaded.");
}

async function viewHistoryGeneration(id) {
  const response = await getJson(`/api/generations/${encodeURIComponent(id)}`);
  const generation = response.generation || {};
  $("historyImage").src = toBrowserPath(generation.image_path);
  openStoredGenerationViewer(generation);
}

async function applyGenerationSeed(id) {
  const response = await getJson(`/api/generations/${encodeURIComponent(id)}`);
  const seed = response.generation?.generation?.seed;
  if (seed === undefined || seed === null) return showToast("This generation has no seed.", true);
  syncPresetFromForm();
  state.currentPreset.params.seed = seed;
  renderPresetForm();
  showToast(`Seed ${seed} applied to current preset.`);
}

async function applyGenerationParams(id) {
  const response = await getJson(`/api/generations/${encodeURIComponent(id)}`);
  const source = response.generation?.generation || {};
  const allowed = [
    "model",
    "width",
    "height",
    "steps",
    "scale",
    "cfg_rescale",
    "sampler",
    "seed",
    "extra_noise_seed",
    "n_samples",
    "noise_schedule",
    "qualityToggle",
    "ucPreset",
    "sm",
    "sm_dyn",
    "dynamic_thresholding",
  ];
  const params = {};
  for (const key of allowed) {
    if (source[key] !== undefined) params[key] = source[key];
  }
  if (!Object.keys(params).length) return showToast("This generation has no reusable params.", true);
  syncPresetFromForm();
  state.currentPreset.params = {
    ...state.currentPreset.params,
    ...params,
  };
  renderPresetForm();
  showToast("Generation params applied to current preset.");
}

async function applyGenerationPreset(id) {
  const response = await getJson(`/api/generations/${encodeURIComponent(id)}`);
  const generation = response.generation || {};
  const preset = generation.internal_preset;
  if (!preset?.prompt_parts || !preset?.params) return showToast("This generation has no internal preset snapshot.", true);
  state.currentPreset = sanitizePresetSnapshot(preset);
  if (generation.generation?.seed !== undefined && generation.generation?.seed !== null) {
    state.currentPreset.params.seed = generation.generation.seed;
  }
  state.characterUiState = [];
  renderPresetForm();
  showToast("Generation preset applied to current preset.");
}

function renderImportResult() {
  const result = state.importResult;
  const parsed = result?.parsed || {};
  const detected = result?.detected || {};
  importFields.base.value = parsed.base_prompt || "";
  importFields.undesired.value = parsed.undesired || "";
  importFields.characters.value = safeJson(parsed.characters || []);
  renderImportCharacterCards(parsed.characters || []);
  const params = parsed.params || {};
  importFields.width.value = params.width ?? "";
  importFields.height.value = params.height ?? "";
  importFields.steps.value = params.steps ?? "";
  importFields.scale.value = params.scale ?? "";
  importFields.cfgRescale.value = params.cfg_rescale ?? "";
  importFields.sampler.value = params.sampler ?? "";
  importFields.seed.value = params.seed ?? "";
  importFields.noiseSchedule.value = params.noise_schedule ?? "";
  const summary = [
    ["Source", result?.source_type || "unknown"],
    ["Image", detected.image_type || "n/a"],
    ["Base", parsed.base_prompt ? `${parsed.base_prompt.length} chars` : "none"],
    ["Undesired", parsed.undesired ? `${parsed.undesired.length} chars` : "none"],
    ["Characters", parsed.characters?.length || 0],
    ["Params", summarizeImportedParams(parsed.params || {})],
    ["Warnings", result?.warnings?.length || 0],
  ];
  $("importSummary").innerHTML = summary
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("");
  $("importSummary").classList.add("ok");
  $("importSummary").classList.remove("error");
}

function summarizeImportedParams(params) {
  const parts = [];
  if (params.width && params.height) parts.push(`${params.width}x${params.height}`);
  if (params.steps !== undefined) parts.push(`${params.steps} steps`);
  if (params.scale !== undefined) parts.push(`scale ${params.scale}`);
  if (params.cfg_rescale !== undefined) parts.push(`rescale ${params.cfg_rescale}`);
  if (params.seed !== undefined) parts.push(`seed ${params.seed}`);
  return parts.join(" / ") || "none";
}

function getEditedImportResult() {
  const result = structuredClone(state.importResult);
  result.parsed = result.parsed || {};
  result.parsed.base_prompt = importFields.base.value;
  result.parsed.undesired = importFields.undesired.value;
  result.parsed.characters = parseCharactersJson(importFields.characters.value);
  result.parsed.params = {
    ...(result.parsed.params || {}),
    width: optionalNumber(importFields.width.value),
    height: optionalNumber(importFields.height.value),
    steps: optionalNumber(importFields.steps.value),
    scale: optionalNumber(importFields.scale.value),
    cfg_rescale: optionalNumber(importFields.cfgRescale.value),
    sampler: importFields.sampler.value.trim() || undefined,
    seed: optionalNumber(importFields.seed.value),
    noise_schedule: importFields.noiseSchedule.value.trim() || undefined,
  };
  Object.keys(result.parsed.params).forEach((key) => {
    if (result.parsed.params[key] === undefined) delete result.parsed.params[key];
  });
  return result;
}

function renderPresetForm() {
  state.currentPreset = sanitizePresetSnapshot(state.currentPreset);
  const preset = state.currentPreset;
  fields.presetName.value = preset.metadata?.name || "";
  fields.basePrompt.value = preset.prompt_parts?.base || "";
  fields.undesiredPrompt.value = preset.prompt_parts?.undesired || "";
  fields.charactersJson.value = safeJson(preset.prompt_parts?.characters || []);
  syncCharacterUiStateLength(preset.prompt_parts?.characters || []);

  const params = preset.params || {};
  fields.width.value = params.width ?? "";
  fields.height.value = params.height ?? "";
  fields.steps.value = params.steps ?? "";
  fields.scale.value = params.scale ?? "";
  fields.cfgRescale.value = params.cfg_rescale ?? "";
  fields.sampler.value = params.sampler ?? "";
  fields.seed.value = params.seed ?? "";
  fields.noiseSchedule.value = params.noise_schedule ?? "";
  fields.qualityToggle.checked = params.qualityToggle !== false;
  fields.ucPreset.value = params.ucPreset ?? 0;
  fields.sm.checked = Boolean(params.sm);
  fields.smDyn.checked = Boolean(params.sm_dyn);
  fields.dynamicThresholding.checked = Boolean(params.dynamic_thresholding);
  renderCharacterCards(preset.prompt_parts?.characters || []);
  updateCurrentSummary();
}

function syncPresetFromForm() {
  const preset = structuredClone(state.currentPreset);
  preset.metadata = preset.metadata || {};
  preset.prompt_parts = preset.prompt_parts || {};
  preset.params = preset.params || {};

  preset.metadata.name = fields.presetName.value.trim() || "Untitled Preset";
  preset.prompt_parts.base = fields.basePrompt.value;
  preset.prompt_parts.undesired = fields.undesiredPrompt.value;
  preset.prompt_parts.characters = sanitizeCharacters(getCharactersFromCards());
  preset.params.width = numberValue(fields.width.value, 832);
  preset.params.height = numberValue(fields.height.value, 1216);
  preset.params.steps = numberValue(fields.steps.value, 23);
  preset.params.scale = numberValue(fields.scale.value, 4);
  preset.params.cfg_rescale = numberValue(fields.cfgRescale.value, 0);
  preset.params.sampler = fields.sampler.value.trim() || "k_euler_ancestral";
  preset.params.seed = fields.seed.value === "" ? null : numberValue(fields.seed.value, null);
  preset.params.noise_schedule = fields.noiseSchedule.value.trim() || "karras";
  preset.params.qualityToggle = fields.qualityToggle.checked;
  preset.params.ucPreset = numberValue(fields.ucPreset.value, 0);
  preset.params.sm = fields.sm.checked;
  preset.params.sm_dyn = fields.smDyn.checked;
  preset.params.dynamic_thresholding = fields.dynamicThresholding.checked;

  state.currentPreset = preset;
}

function parseCharactersJson(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) throw new Error("Characters JSON must be an array.");
    return parsed;
  } catch (error) {
    throw new Error(`Characters JSON error: ${error.message}`);
  }
}

function renderCharacterCards(characters) {
  syncCharacterUiStateLength(characters);
  $("characterCards").innerHTML = characters.map((character, index) => renderCharacterCard(character, index, "preset")).join("")
    || "<div class=\"summary\">No character prompts. Add one or import metadata with characters.</div>";
  bindCharacterCardActions();
}

function renderImportCharacterCards(characters) {
  $("importCharacterCards").innerHTML = characters.map((character, index) => renderImportCharacterCard(character, index)).join("")
    || "<div class=\"summary\">No imported character prompts.</div>";
}

function renderCharacterCard(character, index, scope) {
  const centers = Array.isArray(character.centers) && character.centers.length ? character.centers : [{ x: 0.5, y: 0.5 }];
  const center = centers[0] || { x: 0.5, y: 0.5 };
  const activeTab = getCharacterActiveTab(index);
  return `
    <article class="character-card" data-character-scope="${scope}" data-character-index="${index}">
      <header>
        <div class="character-title">
          <strong>Character ${index + 1}</strong>
          <input data-character-field="name" type="text" value="${escapeHtml(character.name || `Character ${index + 1}`)}" />
        </div>
        <div class="actions">
          <button type="button" data-move-character="up" ${index === 0 ? "disabled" : ""}>Up</button>
          <button type="button" data-move-character="down" ${index === (state.currentPreset.prompt_parts?.characters?.length || 0) - 1 ? "disabled" : ""}>Down</button>
          <button type="button" data-toggle-character>${character.enabled === false ? "Off" : "On"}</button>
          <button type="button" data-character-preset-save="${index}">Preset</button>
          <button type="button" data-remove-character="${index}">Delete</button>
        </div>
      </header>
      <div class="character-tabs">
        <button type="button" class="${activeTab === "prompt" ? "is-active" : ""}" data-character-tab="prompt">Prompt</button>
        <button type="button" class="${activeTab === "undesired" ? "is-active" : ""}" data-character-tab="undesired">Undesired Content</button>
      </div>
      <textarea class="character-pane ${activeTab === "prompt" ? "is-active" : ""}" data-character-field="prompt" spellcheck="false">${escapeHtml(character.prompt || "")}</textarea>
      <textarea class="character-pane ${activeTab === "undesired" ? "is-active" : ""}" data-character-field="undesired" spellcheck="false">${escapeHtml(character.undesired || "")}</textarea>
      <details class="character-position">
        <summary>Position</summary>
        <div class="center-grid">
          <label>X <input data-character-field="x" type="number" min="0" max="1" step="0.01" value="${escapeHtml(center.x ?? 0.5)}" /></label>
          <label>Y <input data-character-field="y" type="number" min="0" max="1" step="0.01" value="${escapeHtml(center.y ?? 0.5)}" /></label>
        </div>
      </details>
    </article>
  `;
}

function renderImportCharacterCard(character, index) {
  const centers = Array.isArray(character.centers) && character.centers.length ? character.centers : [{ x: 0.5, y: 0.5 }];
  const center = centers[0] || { x: 0.5, y: 0.5 };
  return `
    <article class="character-card character-import-card">
      <header><h4>Imported Character ${index + 1}</h4></header>
      <p><strong>Prompt</strong>: ${escapeHtml(character.prompt || "(empty)")}</p>
      <p><strong>Undesired</strong>: ${escapeHtml(character.undesired || "(empty)")}</p>
      <p><strong>Position</strong>: ${escapeHtml(center.x ?? 0.5)}, ${escapeHtml(center.y ?? 0.5)}</p>
    </article>
  `;
}

function bindCharacterCardActions() {
  document.querySelectorAll('#characterCards [data-character-field]').forEach((field) => {
    field.addEventListener("input", () => {
      fields.charactersJson.value = safeJson(getCharactersFromCards());
      syncPresetFromForm();
      updateCurrentSummary();
    });
  });
  document.querySelectorAll("#characterCards [data-character-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.closest(".character-card").dataset.characterIndex);
      const characters = getCharactersFromCards();
      setCharacterActiveTab(index, button.dataset.characterTab);
      state.currentPreset.prompt_parts.characters = sanitizeCharacters(characters);
      renderPresetForm();
    });
  });
  document.querySelectorAll("#characterCards [data-move-character]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.closest(".character-card").dataset.characterIndex);
      const target = button.dataset.moveCharacter === "up" ? index - 1 : index + 1;
      const characters = getCharactersFromCards();
      if (target < 0 || target >= characters.length) return;
      [characters[index], characters[target]] = [characters[target], characters[index]];
      state.currentPreset.prompt_parts.characters = sanitizeCharacters(renumberCharacters(characters));
      moveCharacterUiState(index, target);
      renderPresetForm();
    });
  });
  document.querySelectorAll("#characterCards [data-toggle-character]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.closest(".character-card").dataset.characterIndex);
      const characters = getCharactersFromCards();
      characters[index].enabled = characters[index].enabled === false;
      state.currentPreset.prompt_parts.characters = sanitizeCharacters(characters);
      renderPresetForm();
    });
  });
  document.querySelectorAll("#characterCards [data-character-preset-save]").forEach((button) => {
    button.addEventListener("click", () => {
      openCharacterPresetDialog(Number(button.dataset.characterPresetSave));
    });
  });
  document.querySelectorAll("[data-remove-character]").forEach((button) => {
    button.addEventListener("click", () => {
      const characters = getCharactersFromCards();
      characters.splice(Number(button.dataset.removeCharacter), 1);
      state.currentPreset.prompt_parts.characters = sanitizeCharacters(renumberCharacters(characters));
      state.characterUiState.splice(Number(button.dataset.removeCharacter), 1);
      renderPresetForm();
    });
  });
}

function getCharactersFromCards() {
  const cards = [...document.querySelectorAll('#characterCards [data-character-scope="preset"]')];
  if (!cards.length) return parseCharactersJson(fields.charactersJson.value);
  return cards.map((card, index) => {
    const value = (field) => card.querySelector(`[data-character-field="${field}"]`);
    return {
      id: state.currentPreset.prompt_parts?.characters?.[index]?.id || `character_${index + 1}`,
      name: value("name").value.trim() || `Character ${index + 1}`,
      enabled: state.currentPreset.prompt_parts?.characters?.[index]?.enabled !== false,
      prompt: value("prompt").value,
      undesired: value("undesired").value,
      centers: [{
        x: clampUnit(value("x").value, 0.5),
        y: clampUnit(value("y").value, 0.5),
      }],
    };
  });
}

function addCharacterCard() {
  syncPresetFromForm();
  state.currentPreset.prompt_parts.characters.push({
    id: `character_${Date.now()}`,
    name: `Character ${state.currentPreset.prompt_parts.characters.length + 1}`,
    enabled: true,
    prompt: "",
    undesired: "",
    centers: [{ x: 0.5, y: 0.5 }],
  });
  state.characterUiState.push({ activeTab: "prompt" });
  renderPresetForm();
}

function renumberCharacters(characters) {
  return characters.map((character, index) => ({
    ...character,
    name: /^Character \d+$/.test(character.name || "") ? `Character ${index + 1}` : character.name,
  }));
}

function sanitizeCharacters(characters) {
  return (Array.isArray(characters) ? characters : []).map((character, index) => ({
    id: character.id || `character_${index + 1}`,
    name: character.name || `Character ${index + 1}`,
    enabled: character.enabled !== false,
    prompt: String(character.prompt || ""),
    undesired: String(character.undesired || ""),
    centers: Array.isArray(character.centers) && character.centers.length
      ? character.centers.map((center) => ({
        x: clampUnit(center?.x, 0.5),
        y: clampUnit(center?.y, 0.5),
      }))
      : [{ x: 0.5, y: 0.5 }],
  }));
}

function sanitizePresetSnapshot(preset) {
  const now = new Date().toISOString();
  return {
    ...preset,
    metadata: {
      ...(preset?.metadata || {}),
      name: preset?.metadata?.name || "Untitled Preset",
      updated_at: preset?.metadata?.updated_at || now,
    },
    prompt_parts: {
      base: String(preset?.prompt_parts?.base || ""),
      undesired: String(preset?.prompt_parts?.undesired || ""),
      characters: sanitizeCharacters(preset?.prompt_parts?.characters || []),
    },
    params: {
      ...(preset?.params || {}),
    },
    sources: {
      imported_raw_payload: preset?.sources?.imported_raw_payload ?? null,
      imported_image_metadata: preset?.sources?.imported_image_metadata ?? null,
    },
  };
}

function syncCharacterUiStateLength(characters) {
  const count = Array.isArray(characters) ? characters.length : 0;
  while (state.characterUiState.length < count) state.characterUiState.push({ activeTab: "prompt" });
  if (state.characterUiState.length > count) state.characterUiState.length = count;
}

function getCharacterActiveTab(index) {
  return state.characterUiState[index]?.activeTab === "undesired" ? "undesired" : "prompt";
}

function setCharacterActiveTab(index, activeTab) {
  syncCharacterUiStateLength(state.currentPreset.prompt_parts?.characters || []);
  state.characterUiState[index] = {
    ...(state.characterUiState[index] || {}),
    activeTab: activeTab === "undesired" ? "undesired" : "prompt",
  };
}

function moveCharacterUiState(from, to) {
  syncCharacterUiStateLength(state.currentPreset.prompt_parts?.characters || []);
  [state.characterUiState[from], state.characterUiState[to]] = [state.characterUiState[to], state.characterUiState[from]];
}

function renderHistoryItem(item) {
  const size = item.width && item.height ? `${item.width}x${item.height}` : "unknown size";
  return `
    <article class="history-card" data-generation-id="${escapeHtml(item.id)}">
      <img src="${escapeHtml(toBrowserPath(item.image_path))}" alt="" data-view-generation="${escapeHtml(item.id)}" />
      <div>
        <strong>Seed ${escapeHtml(item.seed ?? "unknown")}</strong>
        <small>${escapeHtml(size)} · ${escapeHtml(item.model || "")}</small>
        <small>${escapeHtml(formatDateTime(item.created_at))}</small>
        <div class="actions compact-actions">
          <button data-generation-id="${escapeHtml(item.id)}">View</button>
          <button data-download-generation="${escapeHtml(item.id)}">Save</button>
          <button data-delete-generation="${escapeHtml(item.id)}">Delete</button>
        </div>
        <details class="history-reuse-details">
          <summary>Reuse</summary>
          <div class="actions compact-actions">
            <button data-apply-generation-preset="${escapeHtml(item.id)}">Apply Preset</button>
            <button data-apply-generation-seed="${escapeHtml(item.id)}">Apply Seed</button>
            <button data-apply-generation-params="${escapeHtml(item.id)}">Apply Params</button>
          </div>
        </details>
      </div>
    </article>
  `;
}

function renderGenerationSummary(response) {
  const summary = response.summary || {};
  return `
      <div class="result-meta-line">${escapeHtml(formatGenerationMeta(summary))}</div>
    `;
}

function openGenerationViewer(response) {
  const generation = response.generation || {};
  const summary = response.summary || {};
  openImageViewer({
    title: `Seed ${summary.seed ?? "unknown"}`,
    imagePath: toBrowserPath(generation.image_path),
    meta: formatGenerationMeta(summary),
    id: generation.id,
  });
}

function openStoredGenerationViewer(generation) {
  const info = generation.generation || {};
  const imagePath = generation.output?.image_filename || generation.image_path;
  openImageViewer({
    title: `Seed ${info.seed ?? "unknown"}`,
    imagePath: toBrowserPath(imagePath),
    meta: formatGenerationMeta(info),
    id: generation.generation_id || generation.id,
  });
}

function openImageViewer({ title, imagePath, meta = "", id = "" }) {
  $("imageViewerTitle").textContent = title || "Generation Preview";
  $("imageViewerMeta").textContent = meta || "Preview image";
  $("imageViewerImage").src = imagePath || "";
  $("imageViewerSummary").textContent = meta || "";
  state.imageViewerContext = { id, imagePath };
  $("imageViewerDeleteButton").hidden = !id;
  $("imageViewerDialog").showModal();
}

async function deleteViewedGeneration() {
  const context = state.imageViewerContext;
  if (!context?.id) return showToast("No viewed generation to delete.", true);
  await deleteJson(`/api/generations/${encodeURIComponent(context.id)}`);
  $("imageViewerDialog").close();
  if (state.lastGenerationResponse?.generation?.id === context.id) {
    $("generatedImage").removeAttribute("src");
    $("latestResultActions").hidden = true;
    $("generationSummary").innerHTML = "";
    state.lastGeneratedImage = "";
    state.lastGenerationResponse = null;
    updateCurrentSummary();
    setSummary($("generateStatus"), "Generation deleted with image, sidecar, and payload.", true);
  }
  await loadHistory(false);
  showToast("Generation deleted with image, sidecar, and payload.");
}

function formatGenerationMeta(source) {
  return [
    source.model,
    source.width && source.height ? `${source.width}x${source.height}` : "",
    source.steps !== undefined ? `${source.steps} steps` : "",
    source.scale !== undefined ? `scale ${source.scale}` : "",
    source.cfg_rescale !== undefined ? `cfg ${source.cfg_rescale}` : "",
    source.sampler,
    source.noise_schedule,
    source.seed !== undefined ? `seed ${source.seed}` : "",
  ].filter(Boolean).join(" · ");
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function updateCurrentSummary() {
  if (!state.currentPreset) return;
  const preset = state.currentPreset;
  const params = preset.params || {};
  const characters = preset.prompt_parts?.characters || [];
  $("summaryName").textContent = preset.metadata?.name || "Untitled";
  $("summaryModel").textContent = params.model || "nai-diffusion-4-5-full";
  $("summaryBase").textContent = `${(preset.prompt_parts?.base || "").length} chars`;
  $("summaryUndesired").textContent = `${(preset.prompt_parts?.undesired || "").length} chars`;
  $("summaryCharacters").textContent = `${characters.filter((item) => item.enabled !== false).length} enabled`;
  $("summarySize").textContent = `${params.width} x ${params.height} / ${params.steps} steps / scale ${params.scale}`;
  $("summarySampler").textContent = params.sampler || "k_euler_ancestral";
  $("summarySeed").textContent = params.seed ?? "random";
  $("summaryImport").textContent = state.lastImportedSource || "none";
  if (state.lastGeneratedImage) $("summaryThumb").src = state.lastGeneratedImage;
  else $("summaryThumb").removeAttribute("src");
}

function setSummary(element, text, ok = false, error = false) {
  element.textContent = text;
  element.classList.toggle("ok", ok);
  element.classList.toggle("error", error);
}

async function withButton(button, label, fn, onError) {
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    return await fn();
  } catch (error) {
    if (onError) onError(error);
    showToast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = previous;
  }
}

function showToast(message, isError = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.style.borderColor = isError ? "rgba(251, 113, 133, 0.55)" : "rgba(103, 232, 249, 0.35)";
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function clampUnit(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function renderSelect(select, items) {
  select.innerHTML = items
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || item.id)} - ${escapeHtml(item.updated_at || "")}</option>`)
    .join("");
}

function renderDialogCharacterPresetCards(items) {
  const selectedId = state.selectedDialogCharacterPresetId || "";
  $("dialogCharacterPresetCards").innerHTML = items.map((item) => renderDialogCharacterPresetCard(item, selectedId)).join("")
    || "<div class=\"summary\">No character presets saved yet.</div>";
  if (selectedId) {
    selectDialogCharacterPreset(selectedId, { silent: true });
  } else {
    $("dialogCharacterPresetList").value = "";
  }
  document.querySelectorAll("[data-dialog-character-preset-id]").forEach((card) => {
    card.addEventListener("click", () => selectDialogCharacterPreset(card.dataset.dialogCharacterPresetId));
  });
  document.querySelectorAll("[data-dialog-character-load]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      selectDialogCharacterPreset(button.dataset.dialogCharacterLoad);
      await applyCharacterPreset({ dialog: true });
    });
  });
  document.querySelectorAll("[data-dialog-character-delete]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      selectDialogCharacterPreset(button.dataset.dialogCharacterDelete);
      await deleteCharacterPreset({ dialog: true });
    });
  });
}

function renderDialogCharacterPresetCard(item, selectedId) {
  const thumb = item.thumbnail_path
    ? `<img src="${escapeHtml(toBrowserPath(item.thumbnail_path))}?v=${encodeURIComponent(item.updated_at || "")}" alt="" />`
    : "Slot";
  const name = item.name || item.id;
  return `
    <article class="character-preset-card ${item.id === selectedId ? "is-selected" : ""}" data-dialog-character-preset-id="${escapeHtml(item.id)}">
      <div class="character-preset-thumb">${thumb}</div>
      <div>
        <strong>${escapeHtml(name)}</strong>
        <small>Updated ${escapeHtml(item.updated_at || "unknown")}</small>
        <small>${escapeHtml(item.id || "")}</small>
        <div class="actions">
          <button type="button" data-dialog-character-load="${escapeHtml(item.id)}">Load</button>
          <button type="button" data-dialog-character-delete="${escapeHtml(item.id)}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function selectDialogCharacterPreset(id, { silent = false } = {}) {
  state.selectedDialogCharacterPresetId = id || "";
  $("dialogCharacterPresetList").value = state.selectedDialogCharacterPresetId;
  document.querySelectorAll("[data-dialog-character-preset-id]").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.dialogCharacterPresetId === state.selectedDialogCharacterPresetId);
  });
  const item = state.characterPresets.find((preset) => preset.id === state.selectedDialogCharacterPresetId);
  if (item?.thumbnail_path) {
    setCharacterThumbnailPreview(`${toBrowserPath(item.thumbnail_path)}?v=${encodeURIComponent(item.updated_at || "")}`);
    state.characterThumbnailBlob = null;
  } else if (id) {
    clearCharacterThumbnailPreview({ markCleared: false });
  }
  if (!silent && id) setSummary($("characterPresetDialogStatus"), "Character preset selected. Save will overwrite it; Save As creates a new preset.", true);
}

function downloadPath(path, filename) {
  const anchor = document.createElement("a");
  anchor.href = path;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function toBrowserPath(filePath) {
  if (!filePath) return "";
  return `/${String(filePath).replaceAll("\\", "/")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
