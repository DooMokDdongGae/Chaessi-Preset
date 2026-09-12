import { deleteJson, getJson, postForm, postImage, postJson } from "./api/client.js";
import { createGenerationModeController } from "./ui/generation-mode-controller.js";
import { createPreciseReferenceController } from "./ui/precise-reference-controller.js";
import { createImageIntakeController } from "./ui/image-intake-controller.js";
import { createLatestRequestGuard } from "./ui/latest-request.js";
import { createPagedListController } from "./ui/paged-list.js";
import { createHistorySelectionController } from "./ui/history-selection.js";
import { createCharacterPositionPad } from "./ui/character-position-pad.js";
import { createImageMakerController } from "./ui/image-maker-controller.js";
import {
  getAdjacentHistoryIdAfterRemoval,
  getHistoryNavigation,
  isHistoryNavigationEditingTarget,
} from "./ui/history-navigation.js";
import {
  getImageFilesFromTransfer,
  hasFileTransfer,
} from "./ui/image-intake.js";
import { loadNovelAiT5Tokenizer } from "./ui/novelai-t5-tokenizer.js";
import { loadNovelAiQwenTokenizer } from "./ui/novelai-qwen-tokenizer.js";
import {
  analyzePresetPromptTokens,
  formatPromptTokenCounter,
  getPromptTokenCounterState,
  NOVELAI_V45_FULL_TOKEN_PROFILE,
  NOVELAI_V5_FULL_TOKEN_PROFILE,
} from "./ui/prompt-token-counter.js";
import { getModelProfile, NOVELAI_V45_FULL_MODEL } from "./state/model-profiles.js";
import { switchPresetModel, syncActiveModelState } from "./state/model-state.js";
import { resolvePresetRandomPrompts } from "./services/prompt-random-resolver.js";
import {
  DEFAULT_CHARACTER_PRESET_CATEGORY,
  cloneBuiltInCharacterPresetCategories,
  normalizeCharacterPresetCategoryName,
} from "./state/character-preset-categories.js";

const $ = (id) => document.getElementById(id);
let rawJsonImportTimer = null;
let generationModeController = null;
let preciseReferenceController = null;
let imageIntakeController = null;
let characterPositionPadController = null;
let imageMakerController = null;
const promptTokenizers = { t5: null, qwen: null };
let promptTokenCounterTimer = null;
let promptTokenizerError = null;
let promptTokenizerInitialized = false;
let lastAccountUsageRefreshAt = 0;
let pendingImageViewerCloseEvents = 0;
const ACCOUNT_USAGE_FOCUS_REFRESH_MS = 60_000;
const historyPages = createPagedListController(50);
const characterPresetPages = createPagedListController(50);
const historyViewGuard = createLatestRequestGuard();
const historySelection = createHistorySelectionController();
const state = {
  currentPreset: null,
  importResult: null,
  lastImportedSource: "",
  lastGeneratedImage: "",
  lastGenerationResponse: null,
  imageViewerContext: null,
  presets: [],
  generations: [],
  selectedHistoryGenerationId: "",
  historyLoadingGenerationId: "",
  characterPresets: [],
  characterPresetCategories: cloneBuiltInCharacterPresetCategories(),
  characterUiState: [],
  characterPresetContextType: "slot",
  characterPresetContextIndex: null,
  presetSaveForceNew: false,
  presetThumbnailBlob: null,
  presetThumbnailPreviewUrl: "",
  characterThumbnailBlob: null,
  characterThumbnailPreviewUrl: "",
  characterThumbnailCleared: false,
  imageImportPreviewUrl: "",
  selectedDialogCharacterPresetId: "",
  dialogCharacterCategoryFilter: "",
  dialogCharacterSubCategoryFilter: "",
  modeByModel: {},
  selectedCharacterPositionIndex: 0,
};

const fields = {
  model: $("paramModel"),
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
  qualityPreset: $("paramQualityPreset"),
  transparentBackground: $("paramTransparentBackground"),
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
  characterPositionPadController = createCharacterPositionPad({
    root: $("characterPositionPadPanel"),
    pad: $("characterPositionPad"),
    markers: $("characterPositionMarkers"),
    warning: $("characterPositionOverlapWarning"),
    selectionLabel: $("characterPositionSelection"),
    resetButton: $("characterPositionResetSelected"),
    onPositionChange: applyCharacterPositionChange,
    onSelect: selectCharacterPosition,
  });
  imageMakerController = createImageMakerController({
    getJson, postJson, showToast,
    getWorkshopContext: ({ includeModePayload = false } = {}) => {
      syncPresetFromForm();
      const mode = generationModeController?.getMode?.() || "text-to-image";
      return {
        preset: structuredClone(state.currentPreset), mode,
        modeRequest: includeModePayload ? generationModeController.getGenerateRequest() : { mode },
      };
    },
  });
  imageMakerController.bind();
  generationModeController = createGenerationModeController({
    showToast,
    getLatestImagePath: () => state.lastGenerationResponse?.generation?.image_path
      ? toBrowserPath(state.lastGenerationResponse.generation.image_path)
      : "",
    getModel: () => state.currentPreset?.params?.model || NOVELAI_V45_FULL_MODEL,
    onModeChange: () => preciseReferenceController?.refreshWarnings(),
  });
  generationModeController.bind();
  preciseReferenceController = createPreciseReferenceController({
    showToast,
    getMode: () => generationModeController.getMode(),
  });
  preciseReferenceController.bind();
  imageIntakeController = createImageIntakeController({
    showToast,
    inspectMetadata: async (file) => (await postImage("/api/import/image", file)).import_result,
    routeToSource: async (item, mode) => {
      await generationModeController.loadSourceItem(item, mode);
    },
    routeToReferences: async (items) => {
      await preciseReferenceController.addIntakeItems(items);
      if (state.currentPreset?.params?.model === "nai-diffusion-5-full") showToast("V5 Full Precise Reference is not supported. References are preserved for V4.5.", true);
    },
    applyMetadata: applyIntakeMetadata,
    getReferenceCapacity: () => preciseReferenceController.getCapacity(),
  });
  imageIntakeController.bind();
  bindActions();
  bindImageIntake();
  await refreshHealth();
  await refreshTokenStatus();
  await refreshAccountUsage();
  await loadCharacterPresetCategories();
  await imageMakerController.initialize();
  const defaultResponse = await getJson("/api/preset/default");
  state.currentPreset = defaultResponse.preset;
  renderPresetForm();
  void initializePromptTokenCounters();
  updateCurrentSummary();
}

function bindActions() {
  $("openImageIntakeButton").addEventListener("click", chooseImageForImport);
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
  $("basePromptPresetButton").addEventListener("click", openBasePromptPresetDialog);
  $("dialogSaveCharacterPresetButton").addEventListener("click", saveCharacterSlotFromDialog);
  $("dialogSaveAsCharacterPresetButton").addEventListener("click", saveCharacterSlotAsFromDialog);
  $("dialogRefreshCharacterPresetButton").addEventListener("click", () => loadCharacterList({ dialog: true }));
  $("dialogApplyCharacterPresetButton").addEventListener("click", () => applyCharacterPreset({ dialog: true }));
  $("dialogDeleteCharacterPresetButton").addEventListener("click", () => deleteCharacterPreset({ dialog: true }));
  $("dialogCharacterPresetCards").addEventListener("click", handleDialogCharacterPresetClick);
  $("dialogCharacterPresetLoadMoreButton").addEventListener("click", loadMoreDialogCharacterPresets);
  $("manageCharacterPresetCategoriesButton").addEventListener("click", openCharacterPresetCategoryManager);
  $("categoryManagerParentCategorySelect").addEventListener("change", renderCategoryManagerSubcategories);
  $("categoryManagerAddCategoryButton").addEventListener("click", addManagedCharacterPresetCategory);
  $("categoryManagerAddSubCategoryButton").addEventListener("click", addManagedCharacterPresetSubcategory);
  $("dialogCharacterCategoryFilter").addEventListener("change", () => {
    state.dialogCharacterCategoryFilter = $("dialogCharacterCategoryFilter").value;
    if (!getCharacterPresetSubcategories(state.dialogCharacterCategoryFilter).length) state.dialogCharacterSubCategoryFilter = "";
    syncCharacterSubCategoryFilter();
    const filtered = getFilteredDialogCharacterPresets();
    if (state.selectedDialogCharacterPresetId && !filtered.some((item) => item.id === state.selectedDialogCharacterPresetId)) {
      state.selectedDialogCharacterPresetId = "";
    }
    renderDialogCharacterPresetCards(getFilteredDialogCharacterPresets());
  });
  $("dialogCharacterSubCategoryFilter").addEventListener("change", () => {
    state.dialogCharacterSubCategoryFilter = $("dialogCharacterSubCategoryFilter").value;
    const filtered = getFilteredDialogCharacterPresets();
    if (state.selectedDialogCharacterPresetId && !filtered.some((item) => item.id === state.selectedDialogCharacterPresetId)) {
      state.selectedDialogCharacterPresetId = "";
    }
    renderDialogCharacterPresetCards(filtered);
  });
  $("characterPresetCategoryInput").addEventListener("change", () => syncCharacterSubCategoryInput());
  $("characterUseCurrentImageButton").addEventListener("click", useCurrentImageAsCharacterThumbnail);
  $("characterChooseThumbnailButton").addEventListener("click", () => $("characterThumbnailInput").click());
  $("characterClearThumbnailButton").addEventListener("click", clearCharacterThumbnail);
  $("characterThumbnailInput").addEventListener("change", setCharacterThumbnailFromFile);
  $("addCharacterButton").addEventListener("click", addCharacterCard);
  $("characterCards").addEventListener("pointerdown", handleCharacterCardSelection, true);
  $("characterCards").addEventListener("focusin", handleCharacterCardSelection);
  $("characterCards").addEventListener("change", handleCharacterPositionCommit);
  $("characterPositionMode").addEventListener("change", () => {
    syncPresetFromForm();
    const mode = $("characterPositionMode").value === "custom" ? "custom" : "auto";
    state.currentPreset.prompt_parts.characters = state.currentPreset.prompt_parts.characters.map((character) => ({ ...character, position_mode: mode }));
    renderPresetForm();
  });
  fields.model.addEventListener("change", () => {
    const targetModel = fields.model.value;
    const currentModel = state.currentPreset.params?.model || NOVELAI_V45_FULL_MODEL;
    fields.model.value = currentModel;
    syncPresetFromForm();
    state.modeByModel[currentModel] = generationModeController.getMode();
    state.currentPreset = switchPresetModel(state.currentPreset, targetModel);
    renderPresetForm();
    showToast(`Switched to ${getModelProfile(targetModel).label}. Incompatible data remains preserved.`);
  });
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
  $("imageViewerPreviousButton").addEventListener("click", () => navigateHistoryViewer("previous"));
  $("imageViewerNextButton").addEventListener("click", () => navigateHistoryViewer("next"));
  $("imageViewerCloseButton").addEventListener("click", prepareImageViewerClose);
  $("imageViewerDialog").addEventListener("cancel", prepareImageViewerClose);
  $("imageViewerDialog").addEventListener("close", handleImageViewerClosed);
  document.addEventListener("keydown", handleHistoryViewerKeydown);
  $("loadHistoryButton").addEventListener("click", loadHistory);
  $("historyList").addEventListener("click", handleHistoryListClick);
  $("historyLoadMoreButton").addEventListener("click", loadMoreHistory);
  $("historyEnterSelectionButton").addEventListener("click", enterHistorySelectionMode);
  $("historySelectVisibleButton").addEventListener("click", selectDisplayedHistory);
  $("historyClearSelectionButton").addEventListener("click", clearHistorySelection);
  $("historyDeleteSelectedButton").addEventListener("click", openHistoryBulkDeleteDialog);
  $("historyCancelSelectionButton").addEventListener("click", cancelHistorySelectionMode);
  $("historyBulkDeleteConfirmButton").addEventListener("click", confirmHistoryBulkDelete);
  $("historyBulkDeleteDialog").addEventListener("cancel", (event) => {
    if (historySelection.snapshot().busy) event.preventDefault();
  });
  $("refreshTokenStatusButton").addEventListener("click", async () => {
    await refreshTokenStatus();
    await refreshAccountUsage();
  });
  $("saveTokenButton").addEventListener("click", saveNovelAiToken);
  $("clearTokenButton").addEventListener("click", clearSavedNovelAiToken);
  $("apiSettingsButton").addEventListener("click", () => {
    document.querySelector(".api-settings-surface")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  window.addEventListener("focus", () => {
    if (Date.now() - lastAccountUsageRefreshAt >= ACCOUNT_USAGE_FOCUS_REFRESH_MS) void refreshAccountUsage();
  });

  Object.values(fields).filter((field) => field !== fields.charactersJson && field !== fields.model).forEach((field) => {
    field.addEventListener("input", () => {
      try {
        syncPresetFromForm();
        if (field === fields.width || field === fields.height) renderCharacterPositionPad();
        updateCurrentSummary();
        schedulePromptTokenCounterUpdate();
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
      renderCharacterPositionPad();
      updateCurrentSummary();
      schedulePromptTokenCounterUpdate();
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

function bindImageIntake() {
  const dropZone = $("dropZone");
  const dragOverlay = $("imageDragOverlay");
  let dragDepth = 0;

  dropZone.addEventListener("click", chooseImageForImport);
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.add("is-over");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove("is-over");
    });
  });
  dropZone.addEventListener("drop", async (event) => {
    event.stopImmediatePropagation();
    await imageIntakeController.openFiles(getImageFilesFromTransfer(event.dataTransfer), "drag-and-drop");
  });

  document.addEventListener("paste", async (event) => {
    const files = getImageFilesFromTransfer(event.clipboardData).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    await imageIntakeController.openFiles(files, "clipboard");
  });

  document.addEventListener("dragenter", (event) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    dragDepth += 1;
    dragOverlay.hidden = false;
  });
  document.addEventListener("dragover", (event) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
  });
  document.addEventListener("dragleave", (event) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dragOverlay.hidden = true;
  });
  document.addEventListener("drop", async (event) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    dragDepth = 0;
    dragOverlay.hidden = true;
    await imageIntakeController.openFiles(getImageFilesFromTransfer(event.dataTransfer), "drag-and-drop");
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

async function refreshAccountUsage() {
  lastAccountUsageRefreshAt = Date.now();
  try {
    const response = await getJson("/api/novelai/account-usage");
    $("anlasBalanceStatus").textContent = formatAccountMetric("Anlas", response.anlas_balance);
    $("staminaStatus").textContent = formatAccountMetric("V5 Stamina", response.stamina_percent, "%");
    return response;
  } catch {
    $("anlasBalanceStatus").textContent = "Anlas unavailable";
    $("staminaStatus").textContent = "V5 Stamina unavailable";
    return null;
  }
}

function formatAccountMetric(label, value, suffix = "") {
  if (value === null || value === undefined || value === "") return `${label} —`;
  const number = Number(value);
  if (!Number.isFinite(number)) return `${label} —`;
  const formatted = suffix === "%"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(number)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number);
  return `${label} ${formatted}${suffix}`;
}

function formatSamplerLabel(value) {
  return ({
    k_euler_ancestral: "Euler Ancestral",
    k_euler: "Euler",
    k_dpmpp_2s_ancestral: "DPM++ 2S Ancestral",
    k_dpmpp_2m_sde: "DPM++ 2M SDE",
    k_dpmpp_2m: "DPM++ 2M",
    k_dpmpp_sde: "DPM++ SDE",
  })[value] || value;
}

async function saveNovelAiToken() {
  const input = $("tokenInput");
  const token = input.value.trim();
  if (!token) return showToast("Paste a NovelAI token first.", true);
  return withButton($("saveTokenButton"), "Saving", async () => {
    await postJson("/api/settings/token", { provider: "novelai", token });
    input.value = "";
    await refreshTokenStatus();
    await refreshAccountUsage();
    showToast("NovelAI token saved.");
  });
}

async function clearSavedNovelAiToken() {
  return withButton($("clearTokenButton"), "Clearing", async () => {
    await deleteJson("/api/settings/token/novelai");
    $("tokenInput").value = "";
    await refreshTokenStatus();
    await refreshAccountUsage();
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
  const files = [...(input.files || [])];
  input.value = "";
  if (!files.length) return showToast("Choose at least one image.", true);
  await imageIntakeController.openFiles(files, "file-picker");
}

function chooseImageForImport() {
  $("imageInput").click();
}

function setImageImportPreview(file, sourceLabel) {
  if (state.imageImportPreviewUrl) URL.revokeObjectURL(state.imageImportPreviewUrl);
  state.imageImportPreviewUrl = URL.createObjectURL(file);
  const preview = $("imageImportPreview");
  preview.src = state.imageImportPreviewUrl;
  preview.hidden = false;
  $("imageImportTitle").textContent = sourceLabel || file.name || "Imported image";
  $("imageImportHint").textContent = "Metadata imported explicitly. Open another image to replace it.";
}

async function applyIntakeMetadata(item, options) {
  state.importResult = item.metadata;
  state.lastImportedSource = item.fileName || item.source;
  setImageImportPreview(item.file, item.fileName);
  renderImportResult();
  syncPresetFromForm();
  const response = await postJson("/api/import/apply", {
    current_preset: state.currentPreset,
    import_result: item.metadata,
    options,
  });
  state.currentPreset = response.preset;
  renderPresetForm();
  updateCurrentSummary();
  renderImportResult();
  showToast("Selected NovelAI metadata imported.");
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
  schedulePromptTokenCounterUpdate();
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
    state.currentPreset = syncActiveModelState(state.currentPreset);
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
  context.clearRect(0, 0, size, size);
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
    category: DEFAULT_CHARACTER_PRESET_CATEGORY,
    enabled: character.enabled !== false,
    prompt: character.prompt || "",
    undesired: character.undesired || "",
    centers: character.centers,
  }, { includeThumbnail: false });
  await loadCharacterList();
  showToast(`${response.preset.name} saved.`);
}

async function saveCharacterSlotFromDialog() {
  if (!hasCharacterPresetDialogContext()) return showToast("No preset context selected.", true);
  if (!state.selectedDialogCharacterPresetId) {
    setSummary($("characterPresetDialogStatus"), "Select a saved preset to overwrite, or use Save As to create a new one.", true);
    return showToast("Select a character preset or use Save As.", true);
  }
  const response = await saveCharacterSlotFromDialogBase({ forceNew: false });
  if (!response) return;
  setSummary($("characterPresetDialogStatus"), `${response.preset.name} saved.`, true);
  $("characterPresetDialog").close();
  showToast(`${response.preset.name} saved.`);
}

async function saveCharacterSlotAsFromDialog() {
  if (!hasCharacterPresetDialogContext()) return showToast("No preset context selected.", true);
  const response = await saveCharacterSlotFromDialogBase({ forceNew: true });
  if (!response) return;
  setSummary($("characterPresetDialogStatus"), `${response.preset.name} saved as a new character preset.`, true);
  $("characterPresetDialog").close();
  showToast(`${response.preset.name} saved as new.`);
}

async function saveCharacterSlotFromDialogBase({ forceNew }) {
  const name = $("characterPresetNameInput").value.trim();
  const source = getCharacterPresetDialogSource();
  if (!source) return null;
  const response = await saveCharacterPresetRequest({
    id: forceNew ? undefined : state.selectedDialogCharacterPresetId,
    name: name || source.name,
    category: $("characterPresetCategoryInput").value || DEFAULT_CHARACTER_PRESET_CATEGORY,
    subCategory: getCharacterPresetSubCategoryInputValue(),
    enabled: source.enabled,
    prompt: source.prompt,
    undesired: source.undesired,
    centers: source.centers,
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

async function openBasePromptPresetDialog() {
  syncPresetFromForm();
  await loadCharacterPresetCategories();
  initializeCharacterPresetCategoryControls();
  state.characterPresetContextType = "base";
  state.characterPresetContextIndex = null;
  state.selectedDialogCharacterPresetId = "";
  clearCharacterThumbnailPreview({ markCleared: false });
  updateCharacterPresetDialog();
  $("characterPresetDialog").showModal();
  await loadCharacterList({ dialog: true });
}

async function openCharacterPresetDialog(index) {
  syncPresetFromForm();
  await loadCharacterPresetCategories();
  initializeCharacterPresetCategoryControls();
  state.characterPresetContextType = "slot";
  state.characterPresetContextIndex = index;
  state.selectedDialogCharacterPresetId = "";
  clearCharacterThumbnailPreview({ markCleared: false });
  updateCharacterPresetDialog();
  $("characterPresetDialog").showModal();
  await loadCharacterList({ dialog: true });
}

function updateCharacterPresetDialog() {
  const source = getCharacterPresetDialogSource({ quiet: true });
  if (!source) return;
  $("characterPresetContext").textContent = source.label;
  $("characterPresetNameInput").value = source.name;
  if (!$("characterPresetCategoryInput").value) $("characterPresetCategoryInput").value = DEFAULT_CHARACTER_PRESET_CATEGORY;
  syncCharacterSubCategoryInput();
  $("characterPresetPromptPreview").textContent = source.prompt || "(empty)";
  $("characterPresetUndesiredPreview").textContent = source.undesired || "(empty)";
  updateCharacterPresetDialogStatusCopy();
}

function hasCharacterPresetDialogContext() {
  return state.characterPresetContextType === "base"
    || (state.characterPresetContextType === "slot" && state.characterPresetContextIndex !== null);
}

function getCharacterPresetDialogSource({ quiet = false } = {}) {
  syncPresetFromForm();
  if (state.characterPresetContextType === "base") {
    return {
      label: "Base Prompt",
      name: fields.presetName.value.trim() || "Base Prompt",
      enabled: true,
      prompt: fields.basePrompt.value || "",
      undesired: fields.undesiredPrompt.value || "",
      centers: [{ x: 0.5, y: 0.5 }],
    };
  }
  const index = state.characterPresetContextIndex;
  const character = state.currentPreset.prompt_parts.characters[index];
  if (!character) {
    if (!quiet) showToast("No character in that slot.", true);
    return null;
  }
  return {
    label: `Character ${index + 1} / ${character.name || "Untitled"}`,
    name: character.name || `Character ${index + 1}`,
    enabled: character.enabled !== false,
    prompt: character.prompt || "",
    undesired: character.undesired || "",
    centers: character.centers,
  };
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
    syncCharacterPresetSaveCategoryOptions(response.items || []);
    syncCharacterCategoryFilterOptions(response.items || []);
    renderDialogCharacterPresetCards(getFilteredDialogCharacterPresets());
    const selectedCopy = state.selectedDialogCharacterPresetId
      ? ` Select a card to load it into ${getCharacterPresetDialogTargetLabel()}, or Save to overwrite the selected preset.`
      : ` Select a card to load it into ${getCharacterPresetDialogTargetLabel()}, or use Save As to create a new preset.`;
    const filteredCount = getFilteredDialogCharacterPresets().length;
    const filterCopy = state.dialogCharacterCategoryFilter ? ` ${filteredCount} shown in ${state.dialogCharacterCategoryFilter}.` : "";
    setSummary($("characterPresetDialogStatus"), `${response.items?.length || 0} character presets loaded.${filterCopy}${selectedCopy}`, true);
  }
}

async function applyCharacterPreset({ dialog = false } = {}) {
  const list = dialog ? $("dialogCharacterPresetList") : $("characterPresetList");
  const id = dialog ? state.selectedDialogCharacterPresetId || list.value : list.value;
  if (!id) return showToast("Select a character preset first.", true);
  const response = await getJson(`/api/character-presets/${encodeURIComponent(id)}`);
  if (dialog && state.characterPresetContextType === "base") {
    applyCharacterPresetToBasePrompt(response.preset);
    $("characterPresetDialog").close();
    showToast("Character preset loaded into Base Prompt.");
    return;
  }
  const index = dialog
    ? state.characterPresetContextIndex
    : Math.max(0, numberValue($("characterSlotInput").value, 1) - 1);
  if (index === null || index === undefined) return showToast("No character slot selected.", true);
  applyCharacterPresetToSlot(response.preset, index);
  if (dialog) {
    updateCharacterPresetDialog();
    $("characterPresetDialog").close();
  }
  showToast("Character preset applied.");
}

function applyCharacterPresetToBasePrompt(preset) {
  syncPresetFromForm();
  state.currentPreset.prompt_parts.base = preset.prompt || "";
  state.currentPreset.prompt_parts.undesired = preset.undesired || "";
  renderPresetForm();
  updateCurrentSummary();
}

function applyCharacterPresetToSlot(preset, index) {
  syncPresetFromForm();
  const characters = [...(state.currentPreset.prompt_parts.characters || [])];
  while (characters.length <= index) {
    characters.push({ id: `character_${characters.length + 1}`, name: `Character ${characters.length + 1}`, enabled: true, prompt: "", undesired: "", centers: [{ x: 0.5, y: 0.5 }] });
  }
  characters[index] = {
    id: characters[index].id || `character_${index + 1}`,
    name: preset.name || `Character ${index + 1}`,
    enabled: preset.enabled !== false,
    prompt: preset.prompt || "",
    undesired: preset.undesired || "",
    centers: preset.centers || [{ x: 0.5, y: 0.5 }],
    ...(getModelProfile(state.currentPreset.params?.model).family === "v5"
      ? { position_mode: $("characterPositionMode").value === "custom" ? "custom" : "auto" }
      : {}),
  };
  state.currentPreset.prompt_parts.characters = characters;
  renderPresetForm();
  updateCurrentSummary();
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

async function initializePromptTokenCounters() {
  setAllPromptTokenCounters("Loading tokenizer...", "is-loading");
  try {
    const [t5, qwen] = await Promise.allSettled([loadNovelAiT5Tokenizer(), loadNovelAiQwenTokenizer()]);
    promptTokenizers.t5 = t5.status === "fulfilled" ? t5.value : null;
    promptTokenizers.qwen = qwen.status === "fulfilled" ? qwen.value : null;
    promptTokenizerError = promptTokenizers.t5 || promptTokenizers.qwen ? null : "Tokenizer assets could not be loaded.";
    promptTokenizerInitialized = true;
    schedulePromptTokenCounterUpdate(0);
  } catch (error) {
    promptTokenizers.t5 = null;
    promptTokenizers.qwen = null;
    promptTokenizerError = error.message;
    promptTokenizerInitialized = true;
    setAllPromptTokenCounters("Token count unavailable", "is-unavailable");
  }
}

function schedulePromptTokenCounterUpdate(delay = 80) {
  clearTimeout(promptTokenCounterTimer);
  promptTokenCounterTimer = setTimeout(renderPromptTokenCounters, delay);
}

function renderPromptTokenCounters() {
  const profile = getActiveTokenProfile();
  const promptTokenizer = profile === NOVELAI_V5_FULL_TOKEN_PROFILE ? promptTokenizers.qwen : promptTokenizers.t5;
  if (!promptTokenizer || !state.currentPreset) {
    setAllPromptTokenCounters(
      promptTokenizerInitialized || promptTokenizerError ? "Token count unavailable" : "Loading tokenizer...",
      promptTokenizerInitialized || promptTokenizerError ? "is-unavailable" : "is-loading",
    );
    return;
  }

  try {
    const analysis = analyzePresetPromptTokens(state.currentPreset, promptTokenizer, profile);
    setPromptTokenCounter($("basePromptTokenCounter"), analysis.basePrompt, analysis.limit,
      "Includes enabled Quality Tags and all enabled Character Prompts in the shared context.");
    setPromptTokenCounter($("undesiredPromptTokenCounter"), analysis.baseUndesired, analysis.limit,
      "Includes the selected UC preset and all enabled Character Undesired fields in the shared context.");

    document.querySelectorAll('#characterCards [data-character-scope="preset"]').forEach((card) => {
      const index = Number(card.dataset.characterIndex);
      const character = state.currentPreset.prompt_parts?.characters?.[index];
      const counter = card.querySelector("[data-character-token-counter]");
      if (!counter) return;
      if (character?.enabled === false) {
        setPromptTokenCounterMessage(counter, "Disabled | excluded from context", "is-unavailable");
        return;
      }
      const entry = analysis.characters.find((item) => item.id === character?.id);
      const activeRange = getCharacterActiveTab(index) === "undesired"
        ? entry?.undesired
        : entry?.prompt;
      setPromptTokenCounter(counter, activeRange, analysis.limit,
        "This field count is shown with the shared Base and enabled Character context total.");
    });
  } catch (error) {
    promptTokenizerError = error.message;
    setAllPromptTokenCounters("Token count unavailable", "is-unavailable");
  }
}

function setPromptTokenCounter(element, range, limit, title) {
  if (!element || !range) {
    setPromptTokenCounterMessage(element, "Token count unavailable", "is-unavailable");
    return;
  }
  const stateName = getPromptTokenCounterState(range, limit);
  setPromptTokenCounterMessage(element, formatPromptTokenCounter(range, limit), `is-${stateName}`);
  const estimated = range.estimated || range.context?.estimated;
  element.title = estimated ? `${title} Maximum estimated token count.` : title;
}

function setAllPromptTokenCounters(message, className) {
  const counters = [
    $("basePromptTokenCounter"),
    $("undesiredPromptTokenCounter"),
    ...document.querySelectorAll("[data-character-token-counter]"),
  ];
  counters.forEach((counter) => setPromptTokenCounterMessage(counter, message, className));
}

function setPromptTokenCounterMessage(element, message, className) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove("is-loading", "is-unavailable", "is-normal", "is-near", "is-over");
  element.classList.add(className);
  element.removeAttribute("title");
}

function reportResolvedPromptLimits(preset) {
  const profile = getActiveTokenProfile(preset);
  const promptTokenizer = profile === NOVELAI_V5_FULL_TOKEN_PROFILE ? promptTokenizers.qwen : promptTokenizers.t5;
  if (!promptTokenizer) return;
  const analysis = analyzePresetPromptTokens(preset, promptTokenizer, profile);
  const exceeded = [];
  if (analysis.positiveContext.max > analysis.limit) exceeded.push("Prompt");
  if (analysis.negativeContext.max > analysis.limit) exceeded.push("Undesired Content");
  if (exceeded.length) {
    showToast(`${exceeded.join(" and ")} exceed the ${analysis.limit}-token context. NovelAI will truncate the excess.`, true);
  }
}

function getActiveTokenProfile(preset = state.currentPreset) {
  return preset?.params?.model === "nai-diffusion-5-full" ? NOVELAI_V5_FULL_TOKEN_PROFILE : NOVELAI_V45_FULL_TOKEN_PROFILE;
}

async function generateImage() {
  return withButton($("generateButton"), "Generating", async () => {
    syncPresetFromForm();
    const isV5 = state.currentPreset.params?.model === "nai-diffusion-5-full";
    if (isV5) await refreshAccountUsage();
    setSummary($("generateStatus"), "Generating one image...", false);
    const modeRequest = generationModeController.getGenerateRequest();
    const resolvedPreset = resolvePresetRandomPrompts(state.currentPreset);
    reportResolvedPromptLimits(resolvedPreset);
    const profile = getModelProfile(state.currentPreset.params?.model);
    const preciseReferences = profile.capabilities.preciseReference ? preciseReferenceController.getGenerateRequest() : [];
    const requestBody = {
      preset: resolvedPreset,
      ...(modeRequest.mode === "text-to-image" ? {} : modeRequest),
      ...(preciseReferences.length ? { precise_references: preciseReferences } : {}),
    };
    const response = await postJson("/api/novelai/generate", requestBody);
    setSummary($("generateStatus"), "Generation saved.", true);
    $("generationSummary").innerHTML = renderGenerationSummary(response);
    $("generatedImage").src = toBrowserPath(response.generation.image_path);
    $("latestResultActions").hidden = false;
    state.lastGeneratedImage = toBrowserPath(response.generation.image_path);
    state.lastGenerationResponse = response;
    updateCurrentSummary();
    await refreshAccountUsage();
    await loadHistory(false);
  }, async (error) => {
    setSummary($("generateStatus"), error.message, false, true);
    await refreshAccountUsage();
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
  historySelection.reconcile(state.generations.map((item) => item.id));
  historyPages.reset(state.generations);
  renderHistoryList();
  reconcileHistoryViewerWithList();
  if (showMessage) showToast("History loaded.");
}

async function viewHistoryGeneration(id) {
  if (!state.generations.some((item) => item.id === id)) return false;
  const requestToken = historyViewGuard.begin();
  state.selectedHistoryGenerationId = id;
  state.historyLoadingGenerationId = id;
  updateHistorySelection(id, true);
  syncHistoryViewerNavigation();
  $("historyStatus").textContent = "Loading generation details…";
  await waitForNextPaint();
  try {
    const response = await getJson(`/api/generations/${encodeURIComponent(id)}`);
    if (!historyViewGuard.isCurrent(requestToken)) return false;
    const generation = response.generation || {};
    if ((generation.generation_id || generation.id) !== id) {
      throw new Error("History detail response did not match the requested item.");
    }
    $("historyImage").src = toBrowserPath(generation.output?.image_filename || generation.image_path);
    state.historyLoadingGenerationId = "";
    updateHistorySelection(id, false);
    $("historyStatus").textContent = "Generation details loaded.";
    openStoredGenerationViewer(generation);
    return true;
  } catch (error) {
    if (!historyViewGuard.isCurrent(requestToken)) return false;
    state.historyLoadingGenerationId = "";
    state.selectedHistoryGenerationId = state.imageViewerContext?.kind === "history"
      ? state.imageViewerContext.id
      : "";
    updateHistorySelection(id, false);
    syncHistoryViewerNavigation();
    $("historyStatus").textContent = "Generation details could not be loaded.";
    showToast(error.message, true);
    return false;
  }
}

function renderHistoryList() {
  const page = historyPages.snapshot();
  const selection = historySelection.snapshot();
  $("historyList").classList.toggle("is-selection-mode", selection.active);
  $("historyList").innerHTML = page.items.map(renderHistoryItem).join("") || "<div class=\"summary\">No generations yet.</div>";
  updateHistorySelection(
    state.selectedHistoryGenerationId,
    state.historyLoadingGenerationId === state.selectedHistoryGenerationId,
  );
  $("historyLoadMoreButton").hidden = !page.hasMore;
  $("historyLoadMoreButton").textContent = page.hasMore
    ? `Load ${Math.min(50, page.totalCount - page.visibleCount)} more (${page.visibleCount}/${page.totalCount})`
    : `All ${page.totalCount} loaded`;
  syncHistorySelectionUi();
}

function loadMoreHistory() {
  if (historySelection.snapshot().busy) return;
  historyPages.loadMore();
  renderHistoryList();
}

async function handleHistoryListClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  try {
    const selection = historySelection.snapshot();
    if (selection.busy) return;
    if (selection.active) {
      const card = target.closest(".history-card[data-generation-id]");
      if (!card) return;
      historySelection.toggle(card.dataset.generationId);
      syncHistorySelectionUi();
      return;
    }
    const view = target.closest("[data-view-generation], button[data-generation-id]");
    if (view) return await viewHistoryGeneration(view.dataset.viewGeneration || view.dataset.generationId);
    const download = target.closest("[data-download-generation]");
    if (download) {
      const item = state.generations.find((generation) => generation.id === download.dataset.downloadGeneration);
      if (item) downloadPath(toBrowserPath(item.image_path), `${item.id}.png`);
      return;
    }
    const source = target.closest("[data-use-generation-source]");
    if (source) {
      const item = state.generations.find((generation) => generation.id === source.dataset.useGenerationSource);
      if (!item) return;
      await generationModeController.loadSourceFromUrl(toBrowserPath(item.image_path), `${item.id}.png`);
      document.querySelector('[data-generation-mode="image-to-image"]')?.click();
      document.getElementById("panel-generate")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const remove = target.closest("[data-delete-generation]");
    if (remove) return await deleteHistoryGeneration(remove.dataset.deleteGeneration);
    const preset = target.closest("[data-apply-generation-preset]");
    if (preset) return await applyGenerationPreset(preset.dataset.applyGenerationPreset);
    const seed = target.closest("[data-apply-generation-seed]");
    if (seed) return await applyGenerationSeed(seed.dataset.applyGenerationSeed);
    const params = target.closest("[data-apply-generation-params]");
    if (params) return await applyGenerationParams(params.dataset.applyGenerationParams);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteHistoryGeneration(id) {
  if (historySelection.snapshot().busy) return showToast("History deletion is already in progress.", true);
  const previousItems = [...state.generations];
  const activeViewerId = getActiveHistoryViewerId();
  await deleteJson(`/api/generations/${encodeURIComponent(id)}`);
  if (state.lastGenerationResponse?.generation?.id === id) {
    clearLatestGenerationState();
  }
  await applyHistoryRemoval(previousItems, new Set([id]), activeViewerId);
  showToast("Generation deleted with image, sidecar, and payload.");
}

function enterHistorySelectionMode() {
  historySelection.enter();
  renderHistoryList();
}

function cancelHistorySelectionMode() {
  if (historySelection.snapshot().busy) return;
  historySelection.cancel();
  renderHistoryList();
}

function selectDisplayedHistory() {
  const displayedIds = historyPages.snapshot().items.map((item) => item.id);
  historySelection.selectVisible(displayedIds);
  syncHistorySelectionUi();
}

function clearHistorySelection() {
  historySelection.clear();
  syncHistorySelectionUi();
}

function syncHistorySelectionUi() {
  const selection = historySelection.snapshot();
  $("historySelectionToolbar").hidden = !selection.active;
  $("historyEnterSelectionButton").hidden = selection.active;
  $("historySelectionCount").textContent = `${selection.count} selected`;
  $("historyDeleteSelectedButton").disabled = selection.busy || selection.count === 0;
  $("historySelectVisibleButton").disabled = selection.busy || historyPages.snapshot().visibleCount === 0;
  $("historyClearSelectionButton").disabled = selection.busy || selection.count === 0;
  $("historyCancelSelectionButton").disabled = selection.busy;
  $("historyLoadMoreButton").disabled = selection.busy;
  $("loadHistoryButton").disabled = selection.busy;
  $("imageViewerDeleteButton").disabled = selection.busy;
  document.querySelectorAll(".history-card[data-generation-id]").forEach((card) => {
    const selected = historySelection.has(card.dataset.generationId);
    card.classList.toggle("is-selection-mode", selection.active);
    card.classList.toggle("is-bulk-selected", selected);
    const toggle = card.querySelector("[data-select-generation]");
    if (toggle) toggle.setAttribute("aria-pressed", String(selected));
  });
  syncHistoryViewerNavigation();
}

function openHistoryBulkDeleteDialog() {
  const selection = historySelection.snapshot();
  if (!selection.active || selection.busy || selection.count === 0) {
    return showToast("Select at least one History item to delete.", true);
  }
  $("historyBulkDeleteCount").textContent = `${selection.count} History item${selection.count === 1 ? "" : "s"} will be deleted.`;
  $("historyBulkDeleteStatus").textContent = "Deletion has not started.";
  $("historyBulkDeleteConfirmButton").disabled = false;
  $("historyBulkDeleteCancelButton").disabled = false;
  $("historyBulkDeleteCancelButton").textContent = "Cancel";
  $("historyBulkDeleteDialog").showModal();
}

async function confirmHistoryBulkDelete() {
  const selection = historySelection.snapshot();
  if (!selection.active || selection.busy || selection.count === 0) return;
  const ids = [...selection.selectedIds];
  const previousItems = [...state.generations];
  const activeViewerId = getActiveHistoryViewerId();
  historySelection.setBusy(true);
  $("historyBulkDeleteConfirmButton").disabled = true;
  $("historyBulkDeleteCancelButton").disabled = true;
  $("historyBulkDeleteStatus").textContent = `Deleting… (0/${ids.length})`;
  syncHistorySelectionUi();

  try {
    const response = await postJson("/api/generations/delete-batch", { ids });
    const result = response.result || {};
    const deletedIds = Array.isArray(result.deleted_ids) ? result.deleted_ids : [];
    const missingIds = Array.isArray(result.missing_ids) ? result.missing_ids : [];
    const failed = Array.isArray(result.failed) ? result.failed : [];
    const removedIds = new Set([...deletedIds, ...missingIds]);
    historySelection.setBusy(false);
    if (removedIds.has(state.lastGenerationResponse?.generation?.id)) clearLatestGenerationState();
    await applyHistoryRemoval(previousItems, removedIds, activeViewerId);
    const summary = `Deleted ${deletedIds.length}, already missing ${missingIds.length}, failed ${failed.length}.`;
    $("historyBulkDeleteStatus").textContent = `${summary} (${deletedIds.length + missingIds.length + failed.length}/${ids.length})`;
    $("historyBulkDeleteCancelButton").disabled = false;
    $("historyBulkDeleteCancelButton").textContent = "Close";
    showToast(summary, failed.length > 0);

    if (!failed.length) {
      $("historyBulkDeleteDialog").close();
      historySelection.cancel();
      renderHistoryList();
    }
  } catch (error) {
    historySelection.setBusy(false);
    $("historyBulkDeleteStatus").textContent = error.message || "Selected History could not be deleted.";
    $("historyBulkDeleteConfirmButton").disabled = false;
    $("historyBulkDeleteCancelButton").disabled = false;
    syncHistorySelectionUi();
    showToast(error.message, true);
  }
}

function clearLatestGenerationState() {
  $("generatedImage").removeAttribute("src");
  $("latestResultActions").hidden = true;
  $("generationSummary").innerHTML = "";
  state.lastGeneratedImage = "";
  state.lastGenerationResponse = null;
  updateCurrentSummary();
}

async function applyHistoryRemoval(previousItems, removedIds, activeViewerId) {
  const removed = removedIds instanceof Set ? removedIds : new Set(removedIds || []);
  const removedSelectedHistory = removed.has(state.selectedHistoryGenerationId);
  state.generations = previousItems.filter((item) => !removed.has(item.id));
  historySelection.reconcile(state.generations.map((item) => item.id));
  historyPages.reset(state.generations);

  if (removedSelectedHistory) {
    state.selectedHistoryGenerationId = "";
    $("historyImage").removeAttribute("src");
  }
  renderHistoryList();

  if (!$("imageViewerDialog").open || state.imageViewerContext?.kind !== "history") {
    syncHistoryViewerNavigation();
    return;
  }
  if (!removed.has(activeViewerId)) {
    syncHistoryViewerNavigation();
    return;
  }

  const adjacentId = getAdjacentHistoryIdAfterRemoval(previousItems, activeViewerId, removed);
  historyViewGuard.cancel();
  state.historyLoadingGenerationId = "";
  if (adjacentId && state.generations.some((item) => item.id === adjacentId)) {
    await viewHistoryGeneration(adjacentId);
    return;
  }
  closeImageViewer();
}

function updateHistorySelection(id, loading) {
  document.querySelectorAll(".history-card[data-generation-id]").forEach((card) => {
    const selected = Boolean(id) && card.dataset.generationId === id;
    card.classList.toggle("is-selected", selected);
    card.classList.toggle("is-loading", selected && loading);
    if (selected && loading) card.setAttribute("aria-busy", "true");
    else card.removeAttribute("aria-busy");
  });
}

function cancelPendingHistoryView() {
  historyViewGuard.cancel();
  state.historyLoadingGenerationId = "";
  updateHistorySelection(state.selectedHistoryGenerationId, false);
  state.imageViewerContext = null;
  syncHistoryViewerNavigation();
}

function prepareImageViewerClose() {
  cancelPendingHistoryView();
  pendingImageViewerCloseEvents += 1;
}

function handleImageViewerClosed() {
  if (pendingImageViewerCloseEvents > 0) {
    pendingImageViewerCloseEvents -= 1;
    return;
  }
  cancelPendingHistoryView();
}

function closeImageViewer() {
  if (!$("imageViewerDialog").open) return;
  prepareImageViewerClose();
  $("imageViewerDialog").close();
}

function getActiveHistoryViewerId() {
  if (state.imageViewerContext?.kind !== "history") return "";
  return state.historyLoadingGenerationId || state.imageViewerContext.id || "";
}

function syncHistoryViewerNavigation() {
  const isHistoryViewer = state.imageViewerContext?.kind === "history";
  const currentId = getActiveHistoryViewerId();
  const navigation = getHistoryNavigation(state.generations, currentId);
  const busy = historySelection.snapshot().busy;
  const previousButton = $("imageViewerPreviousButton");
  const nextButton = $("imageViewerNextButton");
  document.querySelector(".image-viewer-stage")?.classList.toggle("has-history-navigation", isHistoryViewer);
  previousButton.hidden = !isHistoryViewer;
  nextButton.hidden = !isHistoryViewer;
  previousButton.disabled = !isHistoryViewer || busy || !navigation.previousId;
  nextButton.disabled = !isHistoryViewer || busy || !navigation.nextId;
  $("imageViewerPosition").hidden = !isHistoryViewer;
  $("imageViewerPosition").textContent = isHistoryViewer && navigation.index >= 0
    ? `${navigation.index + 1} of ${navigation.total}`
    : "";
}

function reconcileHistoryViewerWithList() {
  if (!$("imageViewerDialog").open || state.imageViewerContext?.kind !== "history") return;
  const currentId = getActiveHistoryViewerId();
  if (!state.generations.some((item) => item.id === currentId)) {
    closeImageViewer();
    return;
  }
  syncHistoryViewerNavigation();
}

function navigateHistoryViewer(direction) {
  if (!$("imageViewerDialog").open || state.imageViewerContext?.kind !== "history") return;
  if (historySelection.snapshot().busy) return;
  const navigation = getHistoryNavigation(state.generations, getActiveHistoryViewerId());
  const targetId = direction === "previous" ? navigation.previousId : navigation.nextId;
  if (targetId) void viewHistoryGeneration(targetId);
}

function handleHistoryViewerKeydown(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  if (!$("imageViewerDialog").open || state.imageViewerContext?.kind !== "history") return;
  if (isHistoryNavigationEditingTarget(event.target)) return;
  event.preventDefault();
  navigateHistoryViewer(event.key === "ArrowLeft" ? "previous" : "next");
}

function waitForNextPaint() {
  return Promise.race([
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    new Promise((resolve) => setTimeout(resolve, 120)),
  ]);
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
    "qualityPreset",
    "transparentBackground",
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
  const profile = getModelProfile(params.model);
  fields.model.value = profile.id;
  fields.width.value = params.width ?? "";
  fields.height.value = params.height ?? "";
  fields.steps.value = params.steps ?? "";
  fields.scale.value = params.scale ?? "";
  fields.cfgRescale.value = params.cfg_rescale ?? "";
  fields.sampler.innerHTML = profile.samplers.map((sampler) => `<option value="${escapeHtml(sampler)}">${escapeHtml(formatSamplerLabel(sampler))}</option>`).join("");
  fields.sampler.value = profile.samplers.includes(params.sampler) ? params.sampler : profile.defaults.sampler;
  fields.seed.value = params.seed ?? "";
  fields.noiseSchedule.value = params.noise_schedule ?? "";
  fields.qualityToggle.checked = params.qualityToggle !== false;
  fields.ucPreset.value = params.ucPreset ?? 0;
  fields.sm.checked = Boolean(params.sm);
  fields.smDyn.checked = Boolean(params.sm_dyn);
  fields.dynamicThresholding.checked = Boolean(params.dynamic_thresholding);
  fields.qualityPreset.value = params.qualityPreset || "standard";
  fields.transparentBackground.checked = params.transparentBackground === true;
  const visibleCharacters = (preset.prompt_parts?.characters || []).slice(0, profile.maxCharacters);
  $("characterPositionMode").value = visibleCharacters.length > 0 && visibleCharacters.every((character) => character.position_mode === "custom") ? "custom" : "auto";
  applyModelCapabilities(profile);
  renderCharacterCards(preset.prompt_parts?.characters || []);
  renderCharacterPositionPad();
  schedulePromptTokenCounterUpdate();
  updateCurrentSummary();
}

function syncPresetFromForm() {
  const preset = structuredClone(state.currentPreset);
  preset.metadata = preset.metadata || {};
  preset.prompt_parts = preset.prompt_parts || {};
  preset.params = preset.params || {};
  preset.params.model = fields.model.value || preset.params.model || NOVELAI_V45_FULL_MODEL;

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
  preset.params.qualityPreset = fields.qualityPreset.value || "standard";
  preset.params.transparentBackground = fields.transparentBackground.checked;

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
  const maxCharacters = getModelProfile(state.currentPreset?.params?.model).maxCharacters;
  const visibleCharacters = characters.slice(0, maxCharacters);
  $("characterCards").innerHTML = visibleCharacters.map((character, index) => renderCharacterCard(character, index, "preset")).join("")
    || "<div class=\"summary\">No character prompts. Add one or import metadata with characters.</div>";
  bindCharacterCardActions();
}

function renderCharacterPositionPad() {
  if (!characterPositionPadController || !state.currentPreset) return;
  const profile = getModelProfile(state.currentPreset.params?.model);
  const characters = (state.currentPreset.prompt_parts?.characters || []).slice(0, profile.maxCharacters);
  const activeIndexes = characters
    .map((character, index) => (character.enabled === false ? -1 : index))
    .filter((index) => index >= 0);
  if (!activeIndexes.includes(state.selectedCharacterPositionIndex)) {
    state.selectedCharacterPositionIndex = activeIndexes[0] ?? 0;
  }
  characterPositionPadController.render({
    characters,
    selectedIndex: state.selectedCharacterPositionIndex,
    visible: profile.family === "v5" && $("characterPositionMode").value === "custom",
    width: state.currentPreset.params?.width,
    height: state.currentPreset.params?.height,
  });
}

function handleCharacterCardSelection(event) {
  const card = event.target.closest?.('#characterCards [data-character-scope="preset"]');
  if (!card) return;
  selectCharacterPosition(Number(card.dataset.characterIndex));
}

function selectCharacterPosition(index) {
  if (!Number.isInteger(index) || index < 0) return;
  state.selectedCharacterPositionIndex = index;
  characterPositionPadController?.setSelectedIndex(index, false);
}

function handleCharacterPositionCommit(event) {
  const field = event.target;
  if (getModelProfile(state.currentPreset?.params?.model).family !== "v5"
    || !["x", "y"].includes(field.dataset?.characterField)) return;
  syncPresetFromForm();
  const index = Number(field.closest(".character-card").dataset.characterIndex);
  const position = state.currentPreset.prompt_parts.characters[index].centers[0];
  applyCharacterPositionChange(index, position);
  characterPositionPadController?.setPosition(index, position, { notify: false });
}

function applyCharacterPositionChange(index, position) {
  const characters = state.currentPreset.prompt_parts.characters;
  if (!characters[index]) return;
  characters[index].centers = [
    { x: position.x, y: position.y },
    ...characters[index].centers.slice(1),
  ];
  state.currentPreset.prompt_parts.characters = characters;
  fields.charactersJson.value = safeJson(characters);
  const card = document.querySelector(`#characterCards [data-character-index="${index}"]`);
  const xInput = card?.querySelector('[data-character-field="x"]');
  const yInput = card?.querySelector('[data-character-field="y"]');
  if (xInput) xInput.value = String(position.x);
  if (yInput) yInput.value = String(position.y);
}

function renderImportCharacterCards(characters) {
  $("importCharacterCards").innerHTML = characters.map((character, index) => renderImportCharacterCard(character, index)).join("")
    || "<div class=\"summary\">No imported character prompts.</div>";
}

function renderCharacterCard(character, index, scope) {
  const positionStep = getModelProfile(state.currentPreset?.params?.model).family === "v5" ? "0.001" : "0.01";
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
      <div class="prompt-token-counter character-token-counter is-loading" data-character-token-counter>Loading tokenizer...</div>
      <details class="character-position">
        <summary>${positionStep === "0.001" ? "Position (Advanced)" : "Position"}</summary>
        <div class="center-grid">
          <label>X <input data-character-field="x" type="number" min="0" max="1" step="${positionStep}" value="${escapeHtml(center.x ?? 0.5)}" ${$("characterPositionMode")?.value === "custom" ? "" : "disabled"} /></label>
          <label>Y <input data-character-field="y" type="number" min="0" max="1" step="${positionStep}" value="${escapeHtml(center.y ?? 0.5)}" ${$("characterPositionMode")?.value === "custom" ? "" : "disabled"} /></label>
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
      const card = field.closest(".character-card");
      const index = Number(card?.dataset.characterIndex);
      if ((field.dataset.characterField === "x" || field.dataset.characterField === "y") && Number.isInteger(index)) {
        selectCharacterPosition(index);
        characterPositionPadController?.setPosition(index, state.currentPreset.prompt_parts.characters[index]?.centers?.[0], { notify: false });
      }
      updateCurrentSummary();
      schedulePromptTokenCounterUpdate();
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
      if (state.selectedCharacterPositionIndex === index) state.selectedCharacterPositionIndex = target;
      else if (state.selectedCharacterPositionIndex === target) state.selectedCharacterPositionIndex = index;
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
      const removedIndex = Number(button.dataset.removeCharacter);
      characters.splice(removedIndex, 1);
      if (state.selectedCharacterPositionIndex > removedIndex) state.selectedCharacterPositionIndex -= 1;
      else if (state.selectedCharacterPositionIndex === removedIndex) state.selectedCharacterPositionIndex = Math.min(removedIndex, characters.length - 1);
      state.currentPreset.prompt_parts.characters = sanitizeCharacters(renumberCharacters(characters));
      state.characterUiState.splice(Number(button.dataset.removeCharacter), 1);
      renderPresetForm();
    });
  });
}

function getCharactersFromCards() {
  const cards = [...document.querySelectorAll('#characterCards [data-character-scope="preset"]')];
  if (!cards.length) return parseCharactersJson(fields.charactersJson.value);
  const edited = cards.map((card, index) => {
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
      }, ...structuredClone((state.currentPreset.prompt_parts?.characters?.[index]?.centers || []).slice(1))],
      position_mode: getModelProfile(state.currentPreset.params?.model).family === "v5"
        ? (state.currentPreset.prompt_parts?.characters?.[index]?.position_mode === "custom" ? "custom" : "auto")
        : ($("characterPositionMode").value === "custom" ? "custom" : "auto"),
    };
  });
  const existing = state.currentPreset.prompt_parts?.characters || [];
  return [...edited, ...structuredClone(existing.slice(cards.length))];
}

function addCharacterCard() {
  syncPresetFromForm();
  const maxCharacters = getModelProfile(state.currentPreset.params?.model).maxCharacters;
  if (state.currentPreset.prompt_parts.characters.length >= maxCharacters) return showToast(`This model supports ${maxCharacters} Character Prompt slots.`, true);
  state.currentPreset.prompt_parts.characters.push({
    id: `character_${Date.now()}`,
    name: `Character ${state.currentPreset.prompt_parts.characters.length + 1}`,
    enabled: true,
    prompt: "",
    undesired: "",
    centers: [{ x: 0.5, y: 0.5 }],
    position_mode: $("characterPositionMode").value === "custom" ? "custom" : "auto",
  });
  state.selectedCharacterPositionIndex = state.currentPreset.prompt_parts.characters.length - 1;
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
    position_mode: character.position_mode === "custom" ? "custom" : "auto",
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
      model: preset?.params?.model || NOVELAI_V45_FULL_MODEL,
    },
    sources: {
      imported_raw_payload: preset?.sources?.imported_raw_payload ?? null,
      imported_image_metadata: preset?.sources?.imported_image_metadata ?? null,
    },
    ...(preset?.model_states && typeof preset.model_states === "object" ? { model_states: structuredClone(preset.model_states) } : {}),
  };
}

function applyModelCapabilities(profile) {
  const modelBadge = $("headerModelLabel");
  modelBadge.textContent = `NovelAI Diffusion ${profile.label}`;
  modelBadge.dataset.model = profile.id;
  $("qualityToggleField").hidden = profile.capabilities.qualityPreset;
  $("qualityPresetField").hidden = !profile.capabilities.qualityPreset;
  $("transparentBackgroundField").hidden = !profile.capabilities.transparency;
  $("noiseScheduleField").hidden = profile.family === "v5";
  $("smField").hidden = !profile.capabilities.smea;
  $("smDynField").hidden = !profile.capabilities.smea;
  $("dynamicThresholdField").hidden = profile.family === "v5";
  $("characterPositionModeField").hidden = profile.family !== "v5";
  $("preciseReferencePanel").hidden = !profile.capabilities.preciseReference;
  $("addCharacterButton").disabled = (state.currentPreset.prompt_parts?.characters?.length || 0) >= profile.maxCharacters;
  const overflow = Math.max(0, (state.currentPreset.prompt_parts?.characters?.length || 0) - profile.maxCharacters);
  $("characterLimitNotice").textContent = overflow ? `${overflow} additional V5 character slots are preserved but excluded from ${profile.label} generation.` : `${profile.label}: up to ${profile.maxCharacters} Character Prompt slots.`;
  $("modelCapabilityNotice").textContent = profile.family === "v5" ? "V5 Full: Text to Image, Image to Image, and Inpaint are available. Precise Reference and SMEA are preserved but disabled." : "V4.5 Full: existing Text to Image, Image to Image, Inpaint, and Precise Reference remain available.";
  generationModeController.setSupportedModes(profile.modes, state.modeByModel[profile.id]);
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
  const selection = historySelection.snapshot();
  const selected = historySelection.has(item.id);
  return `
    <article class="history-card${selection.active ? " is-selection-mode" : ""}${selected ? " is-bulk-selected" : ""}" data-generation-id="${escapeHtml(item.id)}">
      ${selection.active ? `<button type="button" class="history-select-toggle" data-select-generation="${escapeHtml(item.id)}" aria-label="Select History item" aria-pressed="${selected}">✓</button>` : ""}
      <img src="${escapeHtml(toBrowserPath(item.image_path))}" alt="" data-view-generation="${escapeHtml(item.id)}" />
      <div>
        <span class="history-mode">${escapeHtml(formatGenerationMode(item.mode))}</span>
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
            <button data-use-generation-source="${escapeHtml(item.id)}">Use as Source</button>
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
    kind: "latest",
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
    kind: "history",
    generation,
  });
}

function openImageViewer({ title, imagePath, meta = "", id = "", kind = "generic", generation = null }) {
  if (kind !== "history") {
    historyViewGuard.cancel();
    state.historyLoadingGenerationId = "";
  }
  $("imageViewerTitle").textContent = title || "Generation Preview";
  $("imageViewerMeta").textContent = meta || "Preview image";
  $("imageViewerImage").src = imagePath || "";
  $("imageViewerImage").dataset.historyGenerationId = kind === "history" ? id : "";
  $("imageViewerSummary").textContent = meta || "";
  state.imageViewerContext = { id, imagePath, kind };
  $("imageViewerDeleteButton").hidden = !id;
  renderHistoryViewerDetails(kind === "history" ? generation : null);
  if (!$("imageViewerDialog").open) $("imageViewerDialog").showModal();
  syncHistoryViewerNavigation();
}

function renderHistoryViewerDetails(generation) {
  const details = $("imageViewerHistoryDetails");
  details.hidden = !generation;
  if (!generation) {
    details.open = false;
    for (const id of ["imageViewerHistoryId", "imageViewerCreatedAt", "imageViewerPrompt", "imageViewerUndesired", "imageViewerHistoryMetadata"]) {
      $(id).textContent = "";
    }
    return;
  }
  const info = generation.generation || {};
  $("imageViewerHistoryId").textContent = generation.generation_id || generation.id || "";
  $("imageViewerCreatedAt").textContent = generation.created_at || "Unknown";
  $("imageViewerPrompt").textContent = info.prompt || "(empty)";
  $("imageViewerUndesired").textContent = info.undesired_prompt || "(empty)";
  $("imageViewerHistoryMetadata").textContent = [
    generation.preset?.name ? `Preset ${generation.preset.name}` : "",
    generation.preset?.schema ? `Schema ${generation.preset.schema}` : "",
    generation.app?.version ? `Chaessi ${generation.app.version}` : "",
    generation.output?.response_content_type || "",
  ].filter(Boolean).join(" · ") || "No additional metadata.";
}

async function deleteViewedGeneration() {
  if (historySelection.snapshot().busy) return showToast("History deletion is already in progress.", true);
  const context = state.imageViewerContext;
  if (!context?.id) return showToast("No viewed generation to delete.", true);
  const previousItems = [...state.generations];
  const activeViewerId = getActiveHistoryViewerId();
  await deleteJson(`/api/generations/${encodeURIComponent(context.id)}`);
  if (state.lastGenerationResponse?.generation?.id === context.id) {
    clearLatestGenerationState();
    setSummary($("generateStatus"), "Generation deleted with image, sidecar, and payload.", true);
  }
  if (context.kind === "history") {
    await applyHistoryRemoval(previousItems, new Set([context.id]), activeViewerId || context.id);
  } else {
    closeImageViewer();
    await loadHistory(false);
  }
  showToast("Generation deleted with image, sidecar, and payload.");
}

function formatGenerationMeta(source) {
  return [
    source.mode ? formatGenerationMode(source.mode) : "",
    source.model,
    source.width && source.height ? `${source.width}x${source.height}` : "",
    source.steps !== undefined ? `${source.steps} steps` : "",
    source.scale !== undefined ? `scale ${source.scale}` : "",
    source.cfg_rescale !== undefined ? `cfg ${source.cfg_rescale}` : "",
    source.sampler,
    source.noise_schedule,
    source.seed !== undefined ? `seed ${source.seed}` : "",
    source.strength !== undefined ? `strength ${source.strength}` : "",
    source.mode === "image-to-image" && source.noise !== undefined ? `noise ${source.noise}` : "",
    source.mode === "inpaint" && source.feather !== undefined ? `feather ${source.feather}%` : "",
    source.mode === "inpaint" && source.generation_padding !== undefined ? `padding ${source.generation_padding}px` : "",
    source.mode === "inpaint" && source.add_original_image !== undefined
      ? `original ${source.add_original_image ? "on" : "off"}`
      : "",
  ].filter(Boolean).join(" · ");
}

function formatGenerationMode(mode) {
  if (mode === "image-to-image") return "Image to Image";
  if (mode === "inpaint") return "Inpaint";
  return "Text to Image";
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
    if (onError) await onError(error);
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

async function loadCharacterPresetCategories() {
  const response = await getJson("/api/character-preset-categories");
  applyCharacterPresetCategoryResponse(response);
  if (response.warning) showToast(response.warning, true);
  return response;
}

function applyCharacterPresetCategoryResponse(response) {
  state.characterPresetCategories = Array.isArray(response?.categories) && response.categories.length
    ? response.categories.map((category, order) => ({
      name: normalizeCharacterPresetCategory(category.name),
      order: Number.isFinite(Number(category.order)) ? Number(category.order) : order,
      builtIn: category.builtIn === true,
      subcategories: uniqueNames(category.subcategories || []),
    }))
    : cloneBuiltInCharacterPresetCategories();
  syncCharacterPresetSaveCategoryOptions(state.characterPresets);
  syncCharacterCategoryFilterOptions(state.characterPresets);
}

function initializeCharacterPresetCategoryControls() {
  syncCharacterPresetSaveCategoryOptions(state.characterPresets, DEFAULT_CHARACTER_PRESET_CATEGORY);
  $("characterPresetSubCategoryInput").innerHTML = `<option value="">None</option>`;
  $("characterPresetSubCategoryInput").value = "";
  syncCharacterSubCategoryInput();
  syncCharacterCategoryFilterOptions(state.characterPresets);
}

function updateCharacterPresetDialogStatusCopy() {
  setSummary(
    $("characterPresetDialogStatus"),
    `Choose a saved character preset to load into ${getCharacterPresetDialogTargetLabel()}, or use Save As to create a new one.`,
    false,
  );
}

function getCharacterPresetDialogTargetLabel() {
  if (state.characterPresetContextType === "base") return "Base Prompt";
  if (state.characterPresetContextIndex !== null) return `Slot ${state.characterPresetContextIndex + 1}`;
  return "the selected target";
}

function syncCharacterPresetSaveCategoryOptions(items, preferredValue) {
  const select = $("characterPresetCategoryInput");
  const selected = preferredValue ?? select.value ?? DEFAULT_CHARACTER_PRESET_CATEGORY;
  const categories = getAllCharacterPresetCategories(items).map((category) => category.name);
  select.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
  select.value = categories.includes(normalizeCharacterPresetCategory(selected))
    ? normalizeCharacterPresetCategory(selected)
    : DEFAULT_CHARACTER_PRESET_CATEGORY;
  syncCharacterSubCategoryInput();
}

function syncCharacterCategoryFilterOptions(items) {
  const categories = getAllCharacterPresetCategories(items).map((category) => category.name);
  $("dialogCharacterCategoryFilter").innerHTML = [
    `<option value="">All categories</option>`,
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");
  if (!categories.includes(state.dialogCharacterCategoryFilter)) state.dialogCharacterCategoryFilter = "";
  $("dialogCharacterCategoryFilter").value = state.dialogCharacterCategoryFilter;
  syncCharacterSubCategoryFilter();
}

function syncCharacterSubCategoryInput(preferredValue) {
  const input = $("characterPresetSubCategoryInput");
  const subcategories = getCharacterPresetSubcategories($("characterPresetCategoryInput").value);
  const selected = preferredValue ?? input.value ?? "";
  $("characterPresetSubCategoryLabel").hidden = !subcategories.length;
  input.disabled = !subcategories.length;
  input.innerHTML = [
    `<option value="">None</option>`,
    ...subcategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");
  input.value = subcategories.includes(selected) ? selected : "";
}

function syncCharacterSubCategoryFilter() {
  const subcategories = getCharacterPresetSubcategories(state.dialogCharacterCategoryFilter);
  $("dialogCharacterSubCategoryFilterLabel").hidden = !subcategories.length;
  $("dialogCharacterSubCategoryFilter").disabled = !subcategories.length;
  $("dialogCharacterSubCategoryFilter").innerHTML = [
    `<option value="">All subcategories</option>`,
    ...subcategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");
  if (!subcategories.includes(state.dialogCharacterSubCategoryFilter)) state.dialogCharacterSubCategoryFilter = "";
  $("dialogCharacterSubCategoryFilter").value = state.dialogCharacterSubCategoryFilter;
}

function getCharacterPresetSubCategoryInputValue() {
  return $("characterPresetSubCategoryInput").disabled ? "" : $("characterPresetSubCategoryInput").value || "";
}

function getFilteredDialogCharacterPresets() {
  const category = state.dialogCharacterCategoryFilter;
  let items = state.characterPresets;
  if (category) items = items.filter((item) => normalizeCharacterPresetCategory(item.category) === category);
  if (category && state.dialogCharacterSubCategoryFilter) {
    items = items.filter((item) => normalizeCharacterPresetSubCategory(item) === state.dialogCharacterSubCategoryFilter);
  }
  return items;
}

function normalizeCharacterPresetCategory(value) {
  return normalizeCharacterPresetCategoryName(value);
}

function normalizeCharacterPresetSubCategory(item) {
  return String(item?.subCategory ?? item?.subcategory ?? "").trim();
}

function getAllCharacterPresetCategories(items = state.characterPresets) {
  const categories = state.characterPresetCategories.map((category) => ({
    ...category,
    subcategories: [...(category.subcategories || [])],
  }));
  for (const item of items || []) {
    const categoryName = normalizeCharacterPresetCategory(item.category);
    let category = categories.find((candidate) => candidate.name === categoryName);
    if (!category) {
      category = { name: categoryName, order: categories.length, builtIn: false, orphan: true, subcategories: [] };
      categories.push(category);
    }
    const subCategory = normalizeCharacterPresetSubCategory(item);
    if (subCategory && !category.subcategories.includes(subCategory)) category.subcategories.push(subCategory);
  }
  return categories;
}

function getCharacterPresetSubcategories(category, items = state.characterPresets) {
  if (!category) return [];
  return getAllCharacterPresetCategories(items)
    .find((item) => item.name === normalizeCharacterPresetCategory(category))?.subcategories || [];
}

function uniqueNames(values) {
  const names = [];
  for (const value of values) {
    const name = String(value || "").trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function openCharacterPresetCategoryManager() {
  renderCharacterPresetCategoryManager();
  setSummary($("categoryManagerStatus"), "Add-only category management. Existing names are not changed or deleted.", false);
  $("characterPresetCategoryManagerDialog").showModal();
}

function renderCharacterPresetCategoryManager(preferredCategory) {
  const categories = state.characterPresetCategories;
  $("categoryManagerCategoryList").innerHTML = categories.map((category) => `
    <li>
      <strong>${escapeHtml(category.name)}</strong>
      <span>${category.builtIn ? "Built-in" : "Custom"} | ${category.subcategories.length} subcategories</span>
    </li>
  `).join("");
  const parentSelect = $("categoryManagerParentCategorySelect");
  const selected = preferredCategory || parentSelect.value || categories[0]?.name || "";
  parentSelect.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
    .join("");
  parentSelect.value = categories.some((category) => category.name === selected) ? selected : categories[0]?.name || "";
  renderCategoryManagerSubcategories();
}

function renderCategoryManagerSubcategories() {
  const category = state.characterPresetCategories.find((item) => item.name === $("categoryManagerParentCategorySelect").value);
  $("categoryManagerSubCategoryList").innerHTML = category?.subcategories.length
    ? category.subcategories.map((name) => `<li>${escapeHtml(name)}</li>`).join("")
    : "<li>No subcategories yet.</li>";
}

async function addManagedCharacterPresetCategory() {
  const button = $("categoryManagerAddCategoryButton");
  await withButton(button, "Adding", async () => {
    const response = await postJson("/api/character-preset-categories", {
      name: $("categoryManagerNewCategoryInput").value,
    });
    applyCharacterPresetCategoryResponse(response);
    $("categoryManagerNewCategoryInput").value = "";
    renderCharacterPresetCategoryManager(response.categories.at(-1)?.name);
    setSummary($("categoryManagerStatus"), "Category added.", true);
  }, (error) => setSummary($("categoryManagerStatus"), error.message, false, true));
}

async function addManagedCharacterPresetSubcategory() {
  const button = $("categoryManagerAddSubCategoryButton");
  await withButton(button, "Adding", async () => {
    const parent = $("categoryManagerParentCategorySelect").value;
    const response = await postJson("/api/character-preset-categories/subcategories", {
      category: parent,
      name: $("categoryManagerNewSubCategoryInput").value,
    });
    applyCharacterPresetCategoryResponse(response);
    $("categoryManagerNewSubCategoryInput").value = "";
    renderCharacterPresetCategoryManager(parent);
    setSummary($("categoryManagerStatus"), "Subcategory added.", true);
  }, (error) => setSummary($("categoryManagerStatus"), error.message, false, true));
}

function renderDialogCharacterPresetCards(items, { reset = true } = {}) {
  if (reset) characterPresetPages.reset(items);
  const page = characterPresetPages.snapshot();
  const selectedId = state.selectedDialogCharacterPresetId || "";
  $("dialogCharacterPresetCards").innerHTML = page.items.map((item) => renderDialogCharacterPresetCard(item, selectedId)).join("")
    || "<div class=\"summary\">No character presets in this category.</div>";
  if (selectedId) {
    selectDialogCharacterPreset(selectedId, { silent: true });
  } else {
    $("dialogCharacterPresetList").value = "";
  }
  $("dialogCharacterPresetLoadMoreButton").hidden = !page.hasMore;
  $("dialogCharacterPresetLoadMoreButton").textContent = page.hasMore
    ? `Load ${Math.min(50, page.totalCount - page.visibleCount)} more (${page.visibleCount}/${page.totalCount})`
    : `All ${page.totalCount} loaded`;
}

function loadMoreDialogCharacterPresets() {
  characterPresetPages.loadMore();
  renderDialogCharacterPresetCards([], { reset: false });
}

async function handleDialogCharacterPresetClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  try {
    const load = target.closest("[data-dialog-character-load]");
    if (load) {
      selectDialogCharacterPreset(load.dataset.dialogCharacterLoad);
      await applyCharacterPreset({ dialog: true });
      return;
    }
    const remove = target.closest("[data-dialog-character-delete]");
    if (remove) {
      selectDialogCharacterPreset(remove.dataset.dialogCharacterDelete);
      await deleteCharacterPreset({ dialog: true });
      return;
    }
    const card = target.closest("[data-dialog-character-preset-id]");
    if (card) selectDialogCharacterPreset(card.dataset.dialogCharacterPresetId);
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderDialogCharacterPresetCard(item, selectedId) {
  const thumb = item.thumbnail_path
    ? `<img src="${escapeHtml(toBrowserPath(item.thumbnail_path))}?v=${encodeURIComponent(item.updated_at || "")}" alt="" />`
    : "Slot";
  const name = item.name || item.id;
  const category = normalizeCharacterPresetCategory(item.category);
  const subCategory = normalizeCharacterPresetSubCategory(item);
  const categoryLabel = subCategory ? `${category} / ${subCategory}` : category;
  return `
    <article class="character-preset-card ${item.id === selectedId ? "is-selected" : ""}" data-dialog-character-preset-id="${escapeHtml(item.id)}">
      <div class="character-preset-thumb">${thumb}</div>
      <div>
        <strong>${escapeHtml(name)}</strong>
        <span class="character-preset-category">${escapeHtml(categoryLabel)}</span>
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
  if (item?.category) syncCharacterPresetSaveCategoryOptions(state.characterPresets, normalizeCharacterPresetCategory(item.category));
  syncCharacterSubCategoryInput(normalizeCharacterPresetSubCategory(item));
  if (item?.name) $("characterPresetNameInput").value = item.name;
  if (!silent && id) {
    setSummary(
      $("characterPresetDialogStatus"),
      `Character preset selected. Load will replace ${getCharacterPresetDialogTargetLabel()}; Save overwrites the preset.`,
      true,
    );
  }
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
