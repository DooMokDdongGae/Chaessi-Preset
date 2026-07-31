const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);
const TARGET_SIZES = Object.freeze([
  [1024, 1536],
  [1536, 1024],
  [1472, 1472],
]);
const MAX_REFERENCES = 16;
const MAX_FILE_BYTES = 30 * 1024 * 1024;

export function createPreciseReferenceController({ showToast, getMode }) {
  const state = { references: [] };
  const elements = {};

  function bind() {
    Object.assign(elements, {
      input: byId("preciseReferenceInput"),
      list: byId("preciseReferenceList"),
      empty: byId("preciseReferenceEmpty"),
      count: byId("preciseReferenceCount"),
      cost: byId("preciseReferenceCost"),
      warning: byId("preciseReferenceWarning"),
    });
    byId("addPreciseReferenceButton").addEventListener("click", () => elements.input.click());
    elements.input.addEventListener("change", async () => {
      const files = [...(elements.input.files || [])];
      elements.input.value = "";
      for (const file of files) await addFile(file);
    });
    elements.list.addEventListener("input", handleInput);
    elements.list.addEventListener("change", handleInput);
    elements.list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-reference-remove]");
      if (!button) return;
      removeReference(button.dataset.referenceRemove);
    });
    render();
  }

  async function addFile(file) {
    try {
      if (state.references.length >= MAX_REFERENCES) throw new Error(`Use no more than ${MAX_REFERENCES} Precise References.`);
      if (!SUPPORTED_IMAGE_TYPES.has(file.type)) throw new Error("Precise Reference must be PNG, WebP, or JPEG.");
      if (file.size > MAX_FILE_BYTES) throw new Error("Precise Reference must be smaller than 30 MB.");
      const processed = await preprocessReferenceImage(file);
      state.references.push({
        id: crypto.randomUUID(),
        enabled: true,
        type: "character",
        strength: 1,
        fidelity: 1,
        fileName: file.name || "reference-image",
        originalWidth: processed.originalWidth,
        originalHeight: processed.originalHeight,
        transmittedWidth: processed.width,
        transmittedHeight: processed.height,
        imageBase64: processed.base64,
        previewUrl: processed.previewUrl,
      });
      render();
      showToast("Precise Reference added.");
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function handleInput(event) {
    const field = event.target.dataset.referenceField;
    const id = event.target.dataset.referenceId;
    if (!field || !id) return;
    const reference = state.references.find((item) => item.id === id);
    if (!reference) return;
    if (field === "enabled") reference.enabled = event.target.checked;
    else if (field === "type") reference.type = event.target.value;
    else if (field === "strength" || field === "fidelity") {
      const value = Number(event.target.value);
      if (Number.isFinite(value)) reference[field] = value;
      syncNumericPair(id, field, reference[field]);
    }
    updateSummary();
  }

  function syncNumericPair(id, field, value) {
    elements.list.querySelectorAll(`[data-reference-id="${CSS.escape(id)}"][data-reference-field="${field}"]`).forEach((element) => {
      if (element.type === "range") element.value = String(Math.min(1, Math.max(0, value)));
      else element.value = String(value);
    });
  }

  function removeReference(id) {
    const index = state.references.findIndex((reference) => reference.id === id);
    if (index < 0) return;
    URL.revokeObjectURL(state.references[index].previewUrl);
    state.references.splice(index, 1);
    render();
  }

  function getGenerateRequest() {
    return state.references.filter((reference) => reference.enabled).map((reference) => ({
      id: reference.id,
      enabled: true,
      type: reference.type,
      strength: reference.strength,
      fidelity: reference.fidelity,
      image_base64: reference.imageBase64,
      source_info: {
        file_name: reference.fileName,
        original_width: reference.originalWidth,
        original_height: reference.originalHeight,
        transmitted_width: reference.transmittedWidth,
        transmitted_height: reference.transmittedHeight,
      },
    }));
  }

  function render() {
    elements.list.innerHTML = state.references.map(renderReferenceCard).join("");
    elements.empty.hidden = state.references.length > 0;
    updateSummary();
  }

  function updateSummary() {
    const active = state.references.filter((reference) => reference.enabled);
    elements.count.textContent = `${active.length} active / ${state.references.length} total`;
    elements.cost.textContent = active.length
      ? `Adds ${active.length * 5} Image Anlas per generated image.`
      : "No additional reference cost.";
    const warnings = [];
    if (active.some((reference) => reference.strength > 1)) warnings.push("Strength above 1 can overconstrain pose, composition, or style.");
    const characterCount = active.filter((reference) => reference.type !== "style").length;
    if (characterCount > 1) warnings.push("Multiple Character references blend together; they do not map to separate Character Slots.");
    const styleStrength = active
      .filter((reference) => reference.type !== "character")
      .reduce((total, reference) => total + Number(reference.strength || 0), 0);
    if (getMode?.() === "inpaint" && styleStrength > 0.8) {
      warnings.push("High Style reference strength may overpower the surrounding Inpaint area.");
    }
    elements.warning.textContent = warnings.join(" ");
    elements.warning.hidden = warnings.length === 0;
  }

  return { bind, getGenerateRequest, refreshWarnings: updateSummary };
}

export function selectPreciseReferenceTarget(width, height) {
  const aspect = width / height;
  return TARGET_SIZES.reduce((best, candidate) => {
    const delta = Math.abs(candidate[0] / candidate[1] - aspect);
    return delta < best.delta ? { width: candidate[0], height: candidate[1], delta } : best;
  }, { width: TARGET_SIZES[0][0], height: TARGET_SIZES[0][1], delta: Infinity });
}

async function preprocessReferenceImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("Precise Reference dimensions could not be read.");
    const target = selectPreciseReferenceTarget(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d", { alpha: true });
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const drawWidth = Math.round(bitmap.width * scale);
    const drawHeight = Math.round(bitmap.height * scale);
    context.drawImage(bitmap, Math.floor((canvas.width - drawWidth) / 2), Math.floor((canvas.height - drawHeight) / 2), drawWidth, drawHeight);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode Precise Reference.")), "image/png"));
    return {
      originalWidth: bitmap.width,
      originalHeight: bitmap.height,
      width: canvas.width,
      height: canvas.height,
      base64: canvas.toDataURL("image/png").split(",")[1],
      previewUrl: URL.createObjectURL(blob),
    };
  } finally {
    bitmap.close();
  }
}

function renderReferenceCard(reference, index) {
  return `<article class="precise-reference-card">
    <img src="${escapeAttribute(reference.previewUrl)}" alt="Precise Reference ${index + 1}" />
    <div class="precise-reference-fields">
      <div class="section-row">
        <strong>${escapeHtml(reference.fileName)}</strong>
        <label class="inline"><input type="checkbox" data-reference-id="${reference.id}" data-reference-field="enabled" ${reference.enabled ? "checked" : ""} /> Enabled</label>
      </div>
      <small>${reference.originalWidth}x${reference.originalHeight} to ${reference.transmittedWidth}x${reference.transmittedHeight}</small>
      <label>Type
        <select data-reference-id="${reference.id}" data-reference-field="type">
          <option value="character" ${reference.type === "character" ? "selected" : ""}>Character</option>
          <option value="style" ${reference.type === "style" ? "selected" : ""}>Style</option>
          <option value="character&style" ${reference.type === "character&style" ? "selected" : ""}>Character &amp; Style</option>
        </select>
      </label>
      ${renderNumericControl(reference, "strength", "Strength")}
      ${renderNumericControl(reference, "fidelity", "Fidelity")}
    </div>
    <button type="button" class="danger compact-reference-remove" data-reference-remove="${reference.id}" title="Remove Precise Reference">Remove</button>
  </article>`;
}

function renderNumericControl(reference, field, label) {
  const value = reference[field];
  return `<label class="precise-reference-number"><span>${label}</span>
    <input type="range" min="0" max="1" step="0.05" value="${Math.min(1, Math.max(0, value))}" data-reference-id="${reference.id}" data-reference-field="${field}" />
    <input type="number" step="0.05" value="${value}" data-reference-id="${reference.id}" data-reference-field="${field}" aria-label="${label} numeric value" />
  </label>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing Precise Reference UI element: ${id}`);
  return element;
}
