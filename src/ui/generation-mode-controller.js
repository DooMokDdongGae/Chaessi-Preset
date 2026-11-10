import {
  getBrushCursorMetrics,
  interpolateStrokePoints,
  maskAlphaToRgbPixels,
} from "./inpaint-mask-utils.js";
import { zoomViewAt } from "./image-view-transform.js";
import {
  getImageFilesFromTransfer,
  hasFileTransfer,
  inspectImageFile,
  releaseImageIntakeItems,
} from "./image-intake.js";

const MODES = Object.freeze({
  TEXT_TO_IMAGE: "text-to-image",
  IMAGE_TO_IMAGE: "image-to-image",
  INPAINT: "inpaint",
});

const MAX_SOURCE_PIXELS = 4_194_304;

export function createGenerationModeController({ showToast, getLatestImagePath, getModel, onModeChange }) {
  const state = {
    mode: MODES.TEXT_TO_IMAGE,
    source: null,
    maskTool: "brush",
    maskVisible: true,
    maskPainted: false,
    undoStack: [],
    redoStack: [],
    i2iStrength: 0.7,
    i2iNoise: 0.05,
    inpaintStrength: 1,
    generationPadding: 16,
    cursorPoint: null,
    cursorInside: false,
    supportedModes: new Set(Object.values(MODES)),
    activeModel: null,
    settingsByModel: new Map(),
  };

  const elements = {};
  let view = { zoom: 1, x: 0, y: 0 };
  let gesture = null;
  let panMode = false;

  function bind() {
    Object.assign(elements, {
      sourcePanel: byId("modeSourcePanel"),
      sourceInput: byId("generationSourceInput"),
      sourceDropZone: byId("generationSourceDropZone"),
      sourceFrame: byId("sourceCanvasFrame"),
      sourceLayer: byId("sourceCanvasLayer"),
      sourceCanvas: byId("generationSourceCanvas"),
      viewControls: byId("maskViewControls"),
      viewZoom: byId("maskViewZoom"),
      viewPan: byId("maskViewPan"),
      compositionButton: byId("openInpaintComposition"),
      maskCanvas: byId("inpaintMaskCanvas"),
      maskOverlayCanvas: byId("inpaintMaskOverlayCanvas"),
      brushCursor: byId("maskBrushCursor"),
      emptyState: byId("sourceEmptyState"),
      sourceInfo: byId("generationSourceInfo"),
      strength: byId("generationStrength"),
      strengthValue: byId("generationStrengthValue"),
      noise: byId("generationNoise"),
      noiseValue: byId("generationNoiseValue"),
      noiseLabel: byId("generationNoiseLabel"),
      inpaintTools: byId("inpaintTools"),
      brushSize: byId("maskBrushSize"),
      brushSizeValue: byId("maskBrushSizeValue"),
      generationPadding: byId("inpaintGenerationPadding"),
      generationPaddingValue: byId("inpaintGenerationPaddingValue"),
      toggleMaskButton: byId("toggleMaskButton"),
    });

    activateModelSettings();

    document.querySelectorAll("[data-generation-mode]").forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.generationMode));
    });
    byId("chooseGenerationSourceButton").addEventListener("click", () => elements.sourceInput.click());
    byId("removeGenerationSourceButton").addEventListener("click", clearSource);
    byId("useLatestAsSourceButton").addEventListener("click", async () => {
      const imagePath = getLatestImagePath?.();
      if (!imagePath) return showToast("Generate or view an image first.", true);
      await loadSourceFromUrl(imagePath, "latest-generation.png");
    });
    elements.sourceInput.addEventListener("change", async () => {
      const files = [...(elements.sourceInput.files || [])];
      if (files.length === 1) await loadSourceFile(files[0]);
      else if (files.length > 1) showToast("Choose one source image for Image to Image or Inpaint.", true);
      elements.sourceInput.value = "";
    });

    ["dragenter", "dragover"].forEach((name) => elements.sourceDropZone.addEventListener(name, (event) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      elements.sourceDropZone.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach((name) => elements.sourceDropZone.addEventListener(name, (event) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      elements.sourceDropZone.classList.remove("is-over");
    }));
    elements.sourceDropZone.addEventListener("drop", async (event) => {
      event.stopImmediatePropagation();
      const files = getImageFilesFromTransfer(event.dataTransfer);
      if (files.length !== 1) {
        if (files.length > 1) showToast("Drop one source image here. Use Open Image for multiple references.", true);
        return;
      }
      await loadSourceFile(files[0]);
    });

    elements.strength.addEventListener("input", updateStrength);
    elements.noise.addEventListener("input", updateNoise);
    elements.brushSize.addEventListener("input", () => {
      elements.brushSizeValue.textContent = `${elements.brushSize.value} px`;
      updateBrushCursor();
    });
    elements.generationPadding.addEventListener("input", updateGenerationPadding);
    document.querySelectorAll("[data-mask-tool]").forEach((button) => {
      button.addEventListener("click", () => setMaskTool(button.dataset.maskTool));
    });
    byId("undoMaskButton").addEventListener("click", undoMask);
    byId("redoMaskButton").addEventListener("click", redoMask);
    byId("clearMaskButton").addEventListener("click", () => clearMask({ record: true }));
    elements.toggleMaskButton.addEventListener("click", toggleMaskVisibility);
    document.addEventListener("scroll", hideBrushCursor, true);
    bindMaskView();
    bindMaskPointerEvents();
    updateGenerationPadding();
    renderMode();
  }

  function setMode(mode) {
    if (!Object.values(MODES).includes(mode) || !state.supportedModes.has(mode)) return;
    if (state.mode === MODES.IMAGE_TO_IMAGE) {
      state.i2iStrength = Number(elements.strength.value);
      state.i2iNoise = Number(elements.noise.value);
    } else if (state.mode === MODES.INPAINT) {
      state.inpaintStrength = Number(elements.strength.value);
    }
    state.mode = mode;
    renderMode();
    onModeChange?.(state.mode);
  }

  function renderMode() {
    document.querySelectorAll("[data-generation-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.generationMode === state.mode);
      button.disabled = !state.supportedModes.has(button.dataset.generationMode);
    });
    const requiresSource = state.mode !== MODES.TEXT_TO_IMAGE;
    elements.sourcePanel.hidden = !requiresSource;
    elements.inpaintTools.hidden = state.mode !== MODES.INPAINT;
    elements.noiseLabel.hidden = state.mode !== MODES.IMAGE_TO_IMAGE;
    const maskActive = state.mode === MODES.INPAINT && Boolean(state.source);
    elements.maskCanvas.hidden = !maskActive;
    elements.maskOverlayCanvas.hidden = !maskActive;
    elements.viewControls.hidden = !maskActive;
    elements.compositionButton.hidden = state.mode !== MODES.INPAINT;
    elements.compositionButton.disabled = !maskActive;
    elements.sourceFrame.classList.toggle("is-mask-view", maskActive);
    if (maskActive) renderMaskView();
    else resetMaskView();
    if (state.mode === MODES.IMAGE_TO_IMAGE) {
      elements.strength.value = String(state.i2iStrength);
      elements.noise.value = String(state.i2iNoise);
    } else if (state.mode === MODES.INPAINT) {
      elements.strength.value = String(state.inpaintStrength);
    }
    updateStrength();
    updateNoise();
  }

  async function loadSourceFile(file, fallbackName = "") {
    let item = null;
    try {
      item = await inspectImageFile(file, { createPreview: false });
      await loadSourceItem(item, null, fallbackName);
    } catch (error) {
      showToast(error.message, true);
    } finally {
      releaseImageIntakeItems(item ? [item] : []);
    }
  }

  async function loadSourceItem(item, mode = null, fallbackName = "") {
    if (item.width * item.height > MAX_SOURCE_PIXELS) {
      throw new Error("Source image is too large. Use an image with 4,194,304 pixels or fewer.");
    }
    const bitmap = await createImageBitmap(item.file);
    try {
      resetMaskView();
      const canvas = elements.sourceCanvas;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      state.source = {
        fileName: item.fileName || fallbackName || "source-image",
        originalWidth: canvas.width,
        originalHeight: canvas.height,
      };
      resetMaskCanvas(canvas.width, canvas.height);
      elements.emptyState.hidden = true;
      elements.sourceInfo.textContent = state.source.fileName + " · original " + canvas.width + "x" + canvas.height + " · transmitted " + canvas.width + "x" + canvas.height;
      if (mode) setMode(mode);
      else renderMode();
      showToast("Source image ready.");
    } finally {
      bitmap.close();
    }
  }
  async function loadSourceFromUrl(url, fileName = "generation.png") {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not load the selected generation image.");
      const blob = await response.blob();
      await loadSourceFile(new File([blob], fileName, { type: blob.type || "image/png" }), fileName);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function clearSource() {
    resetMaskView();
    state.source = null;
    state.maskPainted = false;
    state.undoStack = [];
    state.redoStack = [];
    elements.sourceCanvas.width = 0;
    elements.sourceCanvas.height = 0;
    elements.maskCanvas.width = 0;
    elements.maskCanvas.height = 0;
    elements.maskOverlayCanvas.width = 0;
    elements.maskOverlayCanvas.height = 0;
    hideBrushCursor();
    elements.emptyState.hidden = false;
    elements.sourceInfo.textContent = "No source image selected.";
    renderMode();
  }

  function resetMaskCanvas(width, height) {
    const canvas = elements.maskCanvas;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").clearRect(0, 0, width, height);
    elements.maskOverlayCanvas.width = width;
    elements.maskOverlayCanvas.height = height;
    renderMaskOverlay();
    state.maskPainted = false;
    state.undoStack = [];
    state.redoStack = [];
  }

  function renderMaskView() {
    const { sourceFrame, sourceLayer, sourceCanvas } = elements;
    // Bound panning so every image can still be reached by dragging.
    const limitX = Math.max(0, (sourceFrame.clientWidth + sourceCanvas.clientWidth * view.zoom) / 2 - 24);
    const limitY = Math.max(0, (sourceFrame.clientHeight + sourceCanvas.clientHeight * view.zoom) / 2 - 24);
    view.x = Math.max(-limitX, Math.min(limitX, view.x));
    view.y = Math.max(-limitY, Math.min(limitY, view.y));
    sourceLayer.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    const displayedWidth = sourceCanvas.getBoundingClientRect().width;
    elements.viewZoom.value = displayedWidth && sourceCanvas.width ? `${Math.round(displayedWidth / sourceCanvas.width * 100)}%` : "";
  }

  function resetMaskView() {
    endMaskGesture();
    setPanMode(false);
    fitMaskView();
  }

  function fitMaskView() {
    if (gesture) return;
    view = { zoom: 1, x: 0, y: 0 };
    renderMaskView();
    hideBrushCursor();
  }

  function setPanMode(enabled) {
    panMode = enabled;
    elements.viewPan.setAttribute("aria-pressed", String(enabled));
    elements.viewPan.classList.toggle("is-active", enabled);
    elements.sourceFrame.classList.toggle("is-pan-mode", enabled);
    hideBrushCursor();
  }

  function fittedMaskScale() {
    const canvas = elements.sourceCanvas;
    return canvas.getBoundingClientRect().width / (canvas.width * view.zoom);
  }

  function zoomMaskView(zoom, anchor = { x: 0, y: 0 }) {
    if (gesture || elements.viewControls.hidden) return;
    const fitScale = fittedMaskScale();
    if (!fitScale) return;
    view = zoomViewAt(view, Math.min(8 / fitScale, Math.max(0.25, zoom)), anchor);
    renderMaskView();
    hideBrushCursor();
  }

  function bindMaskView() {
    byId("maskViewFit").addEventListener("click", fitMaskView);
    byId("maskViewActual").addEventListener("click", () => zoomMaskView(1 / fittedMaskScale()));
    byId("maskViewZoomOut").addEventListener("click", () => zoomMaskView(view.zoom / 1.25));
    byId("maskViewZoomIn").addEventListener("click", () => zoomMaskView(view.zoom * 1.25));
    elements.viewPan.addEventListener("click", () => { if (!gesture) setPanMode(!panMode); });
    elements.sourceFrame.addEventListener("wheel", (event) => {
      if (elements.viewControls.hidden || event.ctrlKey || event.metaKey || !event.deltaY) return;
      event.preventDefault();
      const rect = elements.sourceFrame.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      zoomMaskView(view.zoom * Math.exp(-delta * 0.0015), {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      });
      if (!gesture) updatePointerCursor(event);
    }, { passive: false });
    new ResizeObserver(() => {
      if (!elements.viewControls.hidden && !gesture) renderMaskView();
      hideBrushCursor();
    }).observe(elements.sourceFrame);
  }

  function endMaskGesture(event) {
    if (!gesture || (event && event.pointerId !== gesture.id)) return;
    const { id, pan } = gesture;
    gesture = null;
    elements.sourceFrame.classList.remove("is-panning");
    if (elements.sourceFrame.hasPointerCapture(id)) elements.sourceFrame.releasePointerCapture(id);
    if (!pan) updateMaskPaintedState();
    if (event?.type === "pointerup") updatePointerCursor(event);
    else hideBrushCursor();
  }

  function updatePointerCursor(event) {
    const rect = elements.sourceFrame.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX < rect.right &&
      event.clientY >= rect.top && event.clientY < rect.bottom;
    if (!inside || panMode || gesture?.pan || elements.viewControls.hidden) {
      hideBrushCursor();
      return null;
    }
    const canvas = elements.maskCanvas;
    const point = pointerToCanvas(event, canvas);
    state.cursorPoint = point;
    state.cursorInside = pointIsInsideCanvas(point, canvas);
    updateBrushCursor();
    return point;
  }

  function bindMaskPointerEvents() {
    const { sourceFrame: frame, maskCanvas: canvas } = elements;
    frame.addEventListener("pointerdown", (event) => {
      if (elements.viewControls.hidden || gesture || ![0, 1].includes(event.button)) return;
      const pan = event.button === 1 || panMode;
      if (!pan && event.target !== canvas) return;
      event.preventDefault();
      frame.setPointerCapture(event.pointerId);
      gesture = { id: event.pointerId, pan };
      if (pan) {
        gesture.lastX = event.clientX;
        gesture.lastY = event.clientY;
        frame.classList.add("is-panning");
        hideBrushCursor();
      } else {
        const point = updatePointerCursor(event);
        pushUndoSnapshot();
        gesture.previousPoint = point;
        drawMaskStroke(point, point);
      }
    });
    frame.addEventListener("pointermove", (event) => {
      if (gesture && event.pointerId !== gesture.id) return;
      if (gesture?.pan) {
        view.x += event.clientX - gesture.lastX;
        view.y += event.clientY - gesture.lastY;
        gesture.lastX = event.clientX;
        gesture.lastY = event.clientY;
        renderMaskView();
        return;
      }
      const point = updatePointerCursor(event);
      if (!gesture) return;
      if (point) drawMaskStroke(gesture.previousPoint || point, point);
      gesture.previousPoint = point;
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) frame.addEventListener(type, endMaskGesture);
    frame.addEventListener("pointerleave", hideBrushCursor);
    window.addEventListener("blur", () => { endMaskGesture(); hideBrushCursor(); });
  }

  function drawMaskStroke(from, to) {
    const context = elements.maskCanvas.getContext("2d");
    const isEraser = state.maskTool === "eraser";
    const brushSize = Number(elements.brushSize.value);
    const radius = brushSize / 2;
    const points = interpolateStrokePoints(from, to, Math.max(1, radius / 4));
    context.save();
    context.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    for (const point of points) drawMaskStamp(context, point, radius);
    context.restore();
    renderMaskOverlay();
  }

  function drawMaskStamp(context, point, radius) {
    context.fillStyle = "rgba(255, 255, 255, 1)";
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function pointerToCanvas(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function setMaskTool(tool) {
    setPanMode(false);
    state.maskTool = tool === "eraser" ? "eraser" : "brush";
    document.querySelectorAll("[data-mask-tool]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.maskTool === state.maskTool);
    });
    elements.brushCursor.classList.toggle("is-eraser", state.maskTool === "eraser");
    updateBrushCursor();
  }

  function pushUndoSnapshot() {
    if (!elements.maskCanvas.width) return;
    state.undoStack.push(elements.maskCanvas.getContext("2d").getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height));
    if (state.undoStack.length > 20) state.undoStack.shift();
    state.redoStack = [];
  }

  function undoMask() {
    if (!state.undoStack.length || !elements.maskCanvas.width) return;
    const context = elements.maskCanvas.getContext("2d");
    state.redoStack.push(context.getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height));
    context.putImageData(state.undoStack.pop(), 0, 0);
    renderMaskOverlay();
    updateMaskPaintedState();
  }

  function redoMask() {
    if (!state.redoStack.length || !elements.maskCanvas.width) return;
    const context = elements.maskCanvas.getContext("2d");
    state.undoStack.push(context.getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height));
    context.putImageData(state.redoStack.pop(), 0, 0);
    renderMaskOverlay();
    updateMaskPaintedState();
  }

  function clearMask({ record = false } = {}) {
    if (!elements.maskCanvas.width) return;
    if (record) pushUndoSnapshot();
    elements.maskCanvas.getContext("2d").clearRect(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
    state.maskPainted = false;
    renderMaskOverlay();
  }

  function updateMaskPaintedState() {
    if (!elements.maskCanvas.width) {
      state.maskPainted = false;
      return;
    }
    const pixels = elements.maskCanvas.getContext("2d").getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height).data;
    state.maskPainted = pixels.some((value, index) => index % 4 === 3 && value > 0);
  }

  function toggleMaskVisibility() {
    state.maskVisible = !state.maskVisible;
    elements.maskOverlayCanvas.classList.toggle("is-hidden", !state.maskVisible);
    elements.toggleMaskButton.textContent = state.maskVisible ? "Hide Mask" : "Show Mask";
  }

  function updateGenerationPadding() {
    state.generationPadding = Number(elements.generationPadding.value);
    elements.generationPaddingValue.textContent = `${state.generationPadding} px`;
  }

  function renderMaskOverlay() {
    renderMaskImageData(getSelectionMaskImageData());
  }

  function renderMaskImageData(maskImageData) {
    const overlay = elements.maskOverlayCanvas;
    if (!overlay.width || !overlay.height) return;
    const context = overlay.getContext("2d");
    context.clearRect(0, 0, overlay.width, overlay.height);
    context.putImageData(maskImageData, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = "rgba(103, 232, 249, 0.62)";
    context.fillRect(0, 0, overlay.width, overlay.height);
    context.globalCompositeOperation = "source-over";
  }

  function updateBrushCursor() {
    const canvas = elements.maskCanvas;
    const point = state.cursorPoint;
    if (!point || !state.cursorInside || !state.source || state.mode !== MODES.INPAINT || !pointIsInsideCanvas(point, canvas)) {
      hideBrushCursor();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return hideBrushCursor();
    const metrics = getBrushCursorMetrics({
      brushSize: elements.brushSize.value,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      displayedWidth: rect.width,
      displayedHeight: rect.height,
    });
    const frame = elements.sourceFrame.getBoundingClientRect();
    const left = rect.left - frame.left + point.x * metrics.widthScale;
    const top = rect.top - frame.top + point.y * metrics.heightScale;
    Object.assign(elements.brushCursor.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${metrics.outerWidth}px`,
      height: `${metrics.outerHeight}px`,
    });
    elements.brushCursor.classList.toggle("is-distorted", metrics.distorted);
    elements.brushCursor.hidden = false;
  }

  function hideBrushCursor() {
    state.cursorInside = false;
    elements.brushCursor.hidden = true;
  }

  function pointIsInsideCanvas(point, canvas) {
    return point.x >= 0 && point.y >= 0 && point.x <= canvas.width && point.y <= canvas.height;
  }

  function updateStrength() {
    const value = Number(elements.strength.value);
    elements.strengthValue.textContent = value.toFixed(2);
    if (state.mode === MODES.IMAGE_TO_IMAGE) state.i2iStrength = value;
    if (state.mode === MODES.INPAINT) state.inpaintStrength = value;
  }

  function updateNoise() {
    const value = Number(elements.noise.value);
    elements.noiseValue.textContent = value.toFixed(2);
    if (state.mode === MODES.IMAGE_TO_IMAGE) state.i2iNoise = value;
  }

  function activateModelSettings() {
    const model = getModel?.() || "nai-diffusion-4-5-full";
    if (state.activeModel === model) return;
    if (state.activeModel) {
      state.settingsByModel.set(state.activeModel, {
        i2iStrength: state.i2iStrength,
        i2iNoise: state.i2iNoise,
        inpaintStrength: state.inpaintStrength,
        generationPadding: state.generationPadding,
      });
    }
    const restored = state.settingsByModel.get(model) || defaultModeSettings(model);
    state.i2iStrength = restored.i2iStrength;
    state.i2iNoise = restored.i2iNoise;
    state.inpaintStrength = restored.inpaintStrength;
    state.generationPadding = restored.generationPadding;
    state.activeModel = model;
    if (elements.generationPadding) {
      elements.generationPadding.value = String(state.generationPadding);
      updateGenerationPadding();
      renderMode();
    }
  }

  function getGenerateRequest() {
    if (!state.supportedModes.has(state.mode)) throw new Error("The selected model does not support this generation mode.");
    if (state.mode === MODES.TEXT_TO_IMAGE) return { mode: state.mode };
    if (!state.source) throw new Error("Choose a source image before generating.");
    const request = {
      mode: state.mode,
      mode_state: {
        width: elements.sourceCanvas.width,
        height: elements.sourceCanvas.height,
        source_image_base64: exportSourcePngBase64(),
        strength: state.mode === MODES.INPAINT ? state.inpaintStrength : state.i2iStrength,
        noise: state.mode === MODES.IMAGE_TO_IMAGE ? state.i2iNoise : 0,
        source_info: {
          file_name: state.source.fileName,
          original_width: state.source.originalWidth,
          original_height: state.source.originalHeight,
        },
      },
    };
    if (state.mode === MODES.INPAINT) {
      updateMaskPaintedState();
      if (!state.maskPainted) throw new Error("Paint at least one mask area before generating.");
      request.mode_state.mask_image_base64 = exportSelectionMaskPngBase64();
      request.mode_state.add_original_image = false;
      request.mode_state.generation_padding = state.generationPadding;
      request.mode_state.i2i_strength = state.i2iStrength;
      request.mode_state.i2i_noise = state.i2iNoise;
    }
    return request;
  }

  function getSelectionMaskImageData() {
    return elements.maskCanvas.getContext("2d").getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
  }

  function exportSelectionMaskPngBase64() {
    return exportMaskPngBase64(getSelectionMaskImageData());
  }

  function exportSourcePngBase64() {
    if (getModel?.() === "nai-diffusion-5-full") {
      return elements.sourceCanvas.toDataURL("image/png").split(",")[1];
    }
    const output = document.createElement("canvas");
    output.width = elements.sourceCanvas.width;
    output.height = elements.sourceCanvas.height;
    const context = output.getContext("2d", { alpha: false });
    context.fillStyle = "#000";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(elements.sourceCanvas, 0, 0);
    return output.toDataURL("image/png").split(",")[1];
  }

  function exportMaskPngBase64(maskImageData) {
    const output = document.createElement("canvas");
    output.width = elements.maskCanvas.width;
    output.height = elements.maskCanvas.height;
    const context = output.getContext("2d", { alpha: false });
    const imageData = new ImageData(maskAlphaToRgbPixels(maskImageData.data), output.width, output.height);
    context.putImageData(imageData, 0, 0);
    return output.toDataURL("image/png").split(",")[1];
  }

  return {
    bind,
    getGenerateRequest,
    loadSourceItem,
    loadSourceFromUrl,
    setMode,
    getMode: () => state.mode,
    getCompositionSource() {
      if(!state.source)throw new Error('Choose a source image first.');
      return {source_png:elements.sourceCanvas.toDataURL('image/png').split(',')[1],manual_mask_png:elements.maskCanvas.toDataURL('image/png').split(',')[1],brush_size:Number(elements.brushSize.value),mask_visible:state.maskVisible,settings:{inpaint_strength:state.inpaintStrength,image_strength:state.i2iStrength,image_noise:state.i2iNoise,padding:state.generationPadding,seam:Math.min(8,state.generationPadding)}};
    },
    setSupportedModes(modes, preferredMode) {
      activateModelSettings();
      state.supportedModes = new Set(Array.isArray(modes) ? modes : [MODES.TEXT_TO_IMAGE]);
      const nextMode = state.supportedModes.has(preferredMode) ? preferredMode : state.supportedModes.has(state.mode) ? state.mode : MODES.TEXT_TO_IMAGE;
      setMode(nextMode);
      renderMode();
    },
  };
}

function defaultModeSettings(model) {
  return {
    i2iStrength: 0.7,
    i2iNoise: model === "nai-diffusion-5-full" ? 0 : 0.05,
    inpaintStrength: 1,
    generationPadding: 16,
  };
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing generation mode UI element: ${id}`);
  return element;
}
