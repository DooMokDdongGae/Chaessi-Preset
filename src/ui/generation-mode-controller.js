import {
  getBrushCursorMetrics,
  interpolateStrokePoints,
  maskAlphaToRgbPixels,
} from "./inpaint-mask-utils.js";

const MODES = Object.freeze({
  TEXT_TO_IMAGE: "text-to-image",
  IMAGE_TO_IMAGE: "image-to-image",
  INPAINT: "inpaint",
});

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 4_194_304;

export function createGenerationModeController({ showToast, getLatestImagePath }) {
  const state = {
    mode: MODES.TEXT_TO_IMAGE,
    source: null,
    maskTool: "brush",
    maskVisible: true,
    maskPainted: false,
    undoStack: [],
    redoStack: [],
    drawing: false,
    previousPoint: null,
    i2iStrength: 0.7,
    i2iNoise: 0.05,
    inpaintStrength: 1,
    generationPadding: 16,
    cursorPoint: null,
    cursorInside: false,
  };

  const elements = {};

  function bind() {
    Object.assign(elements, {
      sourcePanel: byId("modeSourcePanel"),
      sourceInput: byId("generationSourceInput"),
      sourceDropZone: byId("generationSourceDropZone"),
      sourceCanvas: byId("generationSourceCanvas"),
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
      const file = elements.sourceInput.files?.[0];
      if (file) await loadSourceFile(file);
      elements.sourceInput.value = "";
    });

    ["dragenter", "dragover"].forEach((name) => elements.sourceDropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.sourceDropZone.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach((name) => elements.sourceDropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.sourceDropZone.classList.remove("is-over");
    }));
    elements.sourceDropZone.addEventListener("drop", async (event) => {
      const file = [...(event.dataTransfer?.files || [])].find((item) => item.type.startsWith("image/"));
      if (file) await loadSourceFile(file);
    });
    document.addEventListener("paste", async (event) => {
      if (state.mode === MODES.TEXT_TO_IMAGE) return;
      const file = [...(event.clipboardData?.files || [])].find((item) => item.type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      await loadSourceFile(file, "clipboard-image.png");
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
    window.addEventListener("resize", updateBrushCursor);
    document.addEventListener("scroll", updateBrushCursor, true);
    bindMaskPointerEvents();
    updateGenerationPadding();
    renderMode();
  }

  function setMode(mode) {
    if (!Object.values(MODES).includes(mode)) return;
    if (state.mode === MODES.IMAGE_TO_IMAGE) {
      state.i2iStrength = Number(elements.strength.value);
      state.i2iNoise = Number(elements.noise.value);
    } else if (state.mode === MODES.INPAINT) {
      state.inpaintStrength = Number(elements.strength.value);
    }
    state.mode = mode;
    renderMode();
  }

  function renderMode() {
    document.querySelectorAll("[data-generation-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.generationMode === state.mode);
    });
    const requiresSource = state.mode !== MODES.TEXT_TO_IMAGE;
    elements.sourcePanel.hidden = !requiresSource;
    elements.inpaintTools.hidden = state.mode !== MODES.INPAINT;
    elements.noiseLabel.hidden = state.mode !== MODES.IMAGE_TO_IMAGE;
    elements.maskCanvas.hidden = state.mode !== MODES.INPAINT || !state.source;
    elements.maskOverlayCanvas.hidden = state.mode !== MODES.INPAINT || !state.source;
    if (state.mode !== MODES.INPAINT || !state.source) hideBrushCursor();
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
    try {
      if (!SUPPORTED_IMAGE_TYPES.has(file.type)) throw new Error("Source image must be PNG, WebP, or JPEG.");
      if (file.size > MAX_SOURCE_BYTES) throw new Error("Source image is too large. Use an image smaller than 30 MB.");
      const bitmap = await createImageBitmap(file);
      if (!bitmap.width || !bitmap.height) throw new Error("Source image dimensions could not be read.");
      if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) {
        bitmap.close();
        throw new Error("Source image is too large. Use an image with 4,194,304 pixels or fewer.");
      }
      const canvas = elements.sourceCanvas;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      state.source = {
        fileName: file.name || fallbackName || "source-image",
        originalWidth: canvas.width,
        originalHeight: canvas.height,
      };
      resetMaskCanvas(canvas.width, canvas.height);
      elements.emptyState.hidden = true;
      elements.sourceInfo.textContent = `${state.source.fileName} · original ${canvas.width}x${canvas.height} · transmitted ${canvas.width}x${canvas.height}`;
      renderMode();
      showToast("Source image ready.");
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function loadSourceFromUrl(url, fileName = "generation.png") {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not load the selected generation image.");
      const blob = await response.blob();
      const type = SUPPORTED_IMAGE_TYPES.has(blob.type) ? blob.type : "image/png";
      await loadSourceFile(new File([blob], fileName, { type }), fileName);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function clearSource() {
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

  function bindMaskPointerEvents() {
    const canvas = elements.maskCanvas;
    canvas.addEventListener("pointerdown", (event) => {
      if (!state.source || state.mode !== MODES.INPAINT) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      pushUndoSnapshot();
      state.drawing = true;
      state.previousPoint = pointerToCanvas(event, canvas);
      state.cursorPoint = state.previousPoint;
      state.cursorInside = true;
      updateBrushCursor();
      drawMaskStroke(state.previousPoint, state.previousPoint);
    });
    canvas.addEventListener("pointermove", (event) => {
      const point = pointerToCanvas(event, canvas);
      state.cursorPoint = point;
      state.cursorInside = pointIsInsideCanvas(point, canvas);
      updateBrushCursor();
      if (!state.drawing) return;
      event.preventDefault();
      drawMaskStroke(state.previousPoint, point);
      state.previousPoint = point;
    });
    const stop = (event) => {
      state.drawing = false;
      state.previousPoint = null;
      updateMaskPaintedState();
      renderMaskOverlay();
      if (event && !pointIsInsideCanvas(pointerToCanvas(event, canvas), canvas)) hideBrushCursor();
    };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    canvas.addEventListener("pointerenter", (event) => {
      state.cursorPoint = pointerToCanvas(event, canvas);
      state.cursorInside = true;
      updateBrushCursor();
    });
    canvas.addEventListener("pointerleave", hideBrushCursor);
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
    const left = rect.left + point.x * metrics.widthScale;
    const top = rect.top + point.y * metrics.heightScale;
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

  function getGenerateRequest() {
    if (state.mode === MODES.TEXT_TO_IMAGE) return { mode: state.mode };
    if (!state.source) throw new Error("Choose a source image before generating.");
    const request = {
      mode: state.mode,
      mode_state: {
        width: elements.sourceCanvas.width,
        height: elements.sourceCanvas.height,
        source_image_base64: elements.sourceCanvas.toDataURL("image/png").split(",")[1],
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
    }
    return request;
  }

  function getSelectionMaskImageData() {
    return elements.maskCanvas.getContext("2d").getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
  }

  function exportSelectionMaskPngBase64() {
    return exportMaskPngBase64(getSelectionMaskImageData());
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
    loadSourceFromUrl,
    getMode: () => state.mode,
  };
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing generation mode UI element: ${id}`);
  return element;
}
