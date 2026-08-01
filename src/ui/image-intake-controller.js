import {
  getImageDestinationAvailability,
  hasImportableNovelAiMetadata,
  inspectImageFiles,
  releaseImageIntakeItems,
} from "./image-intake.js";

export function createImageIntakeController({
  showToast,
  inspectMetadata,
  routeToSource,
  routeToReferences,
  applyMetadata,
  getReferenceCapacity,
}) {
  const state = { items: [], processing: false, metadataApplied: false };
  const elements = {};

  function bind() {
    Object.assign(elements, {
      dialog: byId("imageIntakeDialog"),
      previews: byId("imageIntakePreviews"),
      summary: byId("imageIntakeSummary"),
      status: byId("imageIntakeStatus"),
      i2i: byId("imageIntakeI2IButton"),
      inpaint: byId("imageIntakeInpaintButton"),
      precise: byId("imageIntakePreciseButton"),
      metadata: byId("imageIntakeMetadata"),
      applyMetadata: byId("imageIntakeApplyMetadataButton"),
    });
    elements.i2i.addEventListener("click", () => routeSingleSource("image-to-image"));
    elements.inpaint.addEventListener("click", () => routeSingleSource("inpaint"));
    elements.precise.addEventListener("click", routeReferences);
    elements.applyMetadata.addEventListener("click", applySelectedMetadata);
    elements.dialog.addEventListener("close", clear);
  }

  async function openFiles(files, source = "file-picker") {
    if (elements.dialog.open || state.processing) {
      showToast("Finish or close the current image intake first.", true);
      return false;
    }
    state.processing = true;
    try {
      const input = [...(files || [])];
      const items = await inspectImageFiles(input, {
        source,
        inspectMetadata: input.length === 1 ? inspectMetadata : undefined,
      });
      state.items = items;
      state.metadataApplied = false;
      render();
      elements.dialog.showModal();
      return true;
    } catch (error) {
      showToast(error.message, true);
      return false;
    } finally {
      state.processing = false;
    }
  }

  function render() {
    const capacity = Math.max(0, Number(getReferenceCapacity?.() ?? 0));
    const availability = getImageDestinationAvailability(state.items.length, capacity);
    elements.previews.innerHTML = state.items.map((item) => `<article class="image-intake-preview-item">
      <img src="${escapeAttribute(item.previewUrl)}" alt="Image preview" />
      <strong>${escapeHtml(item.fileName)}</strong>
      <span>${item.width}x${item.height} · ${formatBytes(item.byteLength)}</span>
    </article>`).join("");
    elements.summary.textContent = state.items.length === 1
      ? `${state.items[0].mimeType} · ${sourceLabel(state.items[0].source)}`
      : `${state.items.length} images · ${sourceLabel(state.items[0]?.source)}`;
    setRouteButton(elements.i2i, availability.imageToImage, "Image to Image accepts one source image.");
    setRouteButton(elements.inpaint, availability.inpaint, "Inpaint accepts one source image.");
    setRouteButton(elements.precise, availability.preciseReference,
      state.items.length > capacity
        ? `Only ${capacity} Precise Reference slot${capacity === 1 ? " is" : "s are"} available.`
        : "");
    const metadataAvailable = state.items.length === 1 && hasImportableNovelAiMetadata(state.items[0].metadata);
    elements.metadata.hidden = !metadataAvailable;
    elements.applyMetadata.disabled = state.metadataApplied;
    setStatus(state.items.length > capacity
      ? state.items.length + " images exceed the " + capacity + " remaining Precise Reference slots."
      : state.items.length > 1
        ? "Multiple images can be added to Precise Reference. Image to Image and Inpaint require one image."
        : metadataAvailable
          ? "NovelAI metadata detected. Import is optional and separate from image routing."
          : "No importable NovelAI metadata detected.");
  }

  function setRouteButton(button, enabled, reason) {
    button.disabled = !enabled;
    button.title = enabled ? "" : reason;
  }

  async function routeSingleSource(mode) {
    if (state.processing || state.items.length !== 1) return;
    await runAction(async () => {
      await routeToSource(state.items[0], mode);
      elements.dialog.close("routed");
    });
  }

  async function routeReferences() {
    if (state.processing || !state.items.length) return;
    await runAction(async () => {
      await routeToReferences(state.items);
      elements.dialog.close("routed");
    });
  }

  async function applySelectedMetadata() {
    if (state.processing || state.items.length !== 1 || state.metadataApplied) return;
    const options = {
      applyBasePrompt: byId("imageIntakeApplyBase").checked,
      applyUndesired: byId("imageIntakeApplyUndesired").checked,
      applyCharacters: byId("imageIntakeApplyCharacters").checked,
      applyParams: byId("imageIntakeApplyParams").checked,
    };
    const applied = await runAction(async () => {
      await applyMetadata(state.items[0], options);
      state.metadataApplied = true;
      elements.applyMetadata.disabled = true;
    });
    if (applied && elements.dialog.open) {
      setStatus("Metadata imported. You can still choose an image destination.", true);
    }
  }

  async function runAction(action) {
    state.processing = true;
    setButtonsDisabled(true);
    try {
      await action();
      return true;
    } catch (error) {
      setStatus(error.message, false, true);
      showToast(error.message, true);
      return false;
    } finally {
      state.processing = false;
      if (elements.dialog.open) setButtonsDisabled(false);
    }
  }

  function setButtonsDisabled(disabled) {
    [elements.i2i, elements.inpaint, elements.precise, elements.applyMetadata].forEach((button) => {
      if (button) button.disabled = disabled;
    });
    if (!disabled) render();
  }

  function setStatus(message, ok = false, error = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle("ok", ok);
    elements.status.classList.toggle("error", error);
  }

  function clear() {
    releaseImageIntakeItems(state.items);
    state.items = [];
    state.processing = false;
    state.metadataApplied = false;
    elements.previews.innerHTML = "";
  }

  return {
    bind,
    openFiles,
    isOpen: () => Boolean(elements.dialog?.open),
  };
}

function sourceLabel(source) {
  if (source === "clipboard") return "Clipboard";
  if (source === "drag-and-drop") return "Drag and drop";
  return "File picker";
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing image intake UI element: ${id}`);
  return element;
}
