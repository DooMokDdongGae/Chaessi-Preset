import { postJson } from "../api/client.js";
import { NOVELAI_V45_FULL_MODEL, NOVELAI_V5_FULL_MODEL } from "../state/model-profiles.js";
import { v5ReferenceCrop } from "../state/v5-reference-buckets.js";
import { tryImportVibeFile } from "../services/vibe-import.js";
import { getImageFilesFromTransfer, hasFileTransfer, inspectImageFiles } from "./image-intake.js";
import { createReferenceLibraryUI } from "./reference-library-ui.js";
import { referencePixels } from "./reference-images.js";
import { NEW_VIBE_TRANSFER_ENABLED, currentEncoding, planReferences, supportsOutfitPreference, vibeRequest } from "./reference-session.js";
import { t } from "./i18n.js";

const MAX_REFERENCES = 16;
const TARGET_SIZES = [[1024, 1536], [1536, 1024], [1472, 1472]];
const TYPES = { character: "Character", style: "Style", "character&style": "Character & Style", outfit: "Outfit" };

export function selectPreciseReferenceTarget(width, height) {
  const aspect = width / height;
  return TARGET_SIZES.reduce((best, [width, height]) => {
    const delta = Math.abs(width / height - aspect);
    return delta < best.delta ? { width, height, delta } : best;
  }, { delta: Infinity });
}

export function createPreciseReferenceController({ showToast, getContext, onChange, onEncoded }) {
  let cards = [];
  let kind = "precise";
  let normalizeStrength = true;
  const encoding = new Set();
  const $ = id => document.getElementById(id);
  const getPlan = () => planReferences(cards, getContext(), normalizeStrength);
  const getCapacity = () => MAX_REFERENCES - cards.length;

  function bind() {
    const panel = $("preciseReferencePanel");
    const input = $("preciseReferenceInput");
    $("addPreciseReferenceButton").onclick = () => input.click();
    input.onchange = () => {
      const files = Array.from(input.files);
      input.value = "";
      void addFiles(files, "file-picker", kind);
    };
    for (const button of panel.querySelectorAll("[data-reference-kind]")) {
      button.hidden = button.dataset.referenceKind === "vibe" && !NEW_VIBE_TRANSFER_ENABLED;
      button.onclick = () => {
        if (button.dataset.referenceKind === "vibe" && !NEW_VIBE_TRANSFER_ENABLED) return;
        kind = button.dataset.referenceKind; render();
      };
    }
    $("normalizeVibeStrength").onchange = event => {
      normalizeStrength = event.target.checked;
      updateSummary();
    };
    for (const name of ["dragenter", "dragover", "dragleave", "drop"]) {
      panel.addEventListener(name, event => {
        if (!hasFileTransfer(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        panel.classList.toggle("is-over", name === "dragenter" || name === "dragover");
        if (name === "drop") void addFiles(getImageFilesFromTransfer(event.dataTransfer), "drag-and-drop", kind);
      });
    }
    panel.addEventListener("paste", event => {
      const files = getImageFilesFromTransfer(event.clipboardData).filter(file => file.type.startsWith("image/"));
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      void addFiles(files, "clipboard", kind);
    });
    const list = $("preciseReferenceList");
    list.addEventListener("load", event => {
      if (event.target.tagName !== "IMG") return;
      const article = event.target.closest("article");
      const card = cards.find(item => item.id === article?.dataset.cardId);
      if (card?.original) showDimensions(article, card, event.target.naturalWidth, event.target.naturalHeight);
    }, true);
    list.addEventListener("input", handleField);
    list.addEventListener("change", handleField);
    list.addEventListener("click", handleClick);
    document.addEventListener("chaessi:language-change", render);
    createReferenceLibraryUI({
      container: $("referenceLibraryTools"),
      listCards: () => cards.map(card => ({ id: card.id, label: card.fileName })),
      capture, restore, showToast,
    });
    render();
  }

  async function addFiles(files, source, destination) {
    if (!files.length) return;
    try {
      if (destination === "vibe" && !NEW_VIBE_TRANSFER_ENABLED) throw new Error(t("Vibe Transfer is unavailable in this build."));
      const selections = [];
      for (const file of files) {
        const imported = destination === "vibe" && await tryImportVibeFile(file);
        if (imported) {
          selections.push(...imported);
        } else {
          const [item] = await inspectImageFiles([file], { source, createPreview: false });
          selections.push(newImageCard(item, destination));
        }
      }
      appendCards(selections, destination);
    } catch (error) { showToast(error.message, true); }
  }

  async function addIntakeItems(items, destination = "precise") {
    if (!items.length) return;
    if (destination === "vibe" && !NEW_VIBE_TRANSFER_ENABLED) throw new Error(t("Vibe Transfer is unavailable in this build."));
    const selection = [];
    for (const item of items) {
      const imported = destination === "vibe" && await tryImportVibeFile(item.file);
      if (imported) selection.push(...imported);
      else selection.push(newImageCard(item, destination));
    }
    appendCards(selection, destination);
  }

  function appendCards(settings, destination) {
    if (settings.length > getCapacity()) throw new Error(t("Up to {n} reference cards can be registered.", { n: MAX_REFERENCES }));
    cards.push(...settings.map(createCard));
    kind = destination;
    render();
    $("preciseReferencePanel").closest("details").open = true;
  }

  // These are explicit library operations. No prompt snapshot includes a reference card.
  function capture(id) {
    const selection = id ? cards.filter(card => card.id === id) : cards;
    return { normalizeStrength, cards: selection.map(({ id, previewUrl, ...settings }) => structuredClone(settings)) };
  }

  function restore(snapshot, scope) {
    const incoming = snapshot.cards;
    if (incoming.length + (scope === "single" ? cards.length : 0) > MAX_REFERENCES) {
      throw new Error(t("Up to {n} reference cards can be registered.", { n: MAX_REFERENCES }));
    }
    const replacements = incoming.map(createCard);
    if (scope === "single") cards.push(...replacements);
    else {
      for (const card of cards) releasePreview(card);
      cards = replacements;
      normalizeStrength = snapshot.normalizeStrength !== false;
    }
    if (replacements.length) kind = NEW_VIBE_TRANSFER_ENABLED ? replacements[0].kind : "precise";
    render();
    $("preciseReferencePanel").closest("details").open = true;
  }

  function handleField(event) {
    const target = event.target;
    const field = target.dataset.referenceField;
    if (!field) return;
    const card = cards.find(item => item.id === target.closest("article")?.dataset.cardId);
    if (!card) return;
    if (target.type === "checkbox" || target.tagName === "SELECT") {
      if (event.type !== "change") return;
      if (field === "type") {
        card.type = target.value;
        card.preferSameOutfit = card.type === "character&style";
      } else if (field === "informationExtracted") card.informationExtracted = Number(target.value);
      else card[field] = target.checked;
      render();
      return;
    }
    if (!Number.isFinite(target.valueAsNumber) || !target.validity.valid) {
      if (event.type === "change") target.value = String(card[field]);
      return;
    }
    card[field] = target.valueAsNumber;
    for (const peer of target.closest("label").querySelectorAll("input")) {
      if (peer !== target) peer.value = String(card[field]);
    }
    if (card.kind === "vibe" && field === "informationExtracted") refreshEncodeButton(target.closest("article"), card);
    updateSummary();
  }

  function handleClick(event) {
    const action = event.target.closest("[data-reference-action]")?.dataset.referenceAction;
    if (!action) return;
    const card = cards.find(item => item.id === event.target.closest("article")?.dataset.cardId);
    if (!card) return;
    if (action === "encode") { void encodeCard(card); return; }
    const index = cards.indexOf(card);
    if (action === "remove") {
      releasePreview(card);
      cards.splice(index, 1);
    } else {
      const visible = cards.filter(item => item.kind === kind);
      const other = visible[visible.indexOf(card) + (action === "up" ? -1 : 1)];
      if (!other) return;
      const otherIndex = cards.indexOf(other);
      [cards[index], cards[otherIndex]] = [other, card];
    }
    render();
  }

  async function encodeCard(card) {
    const { model } = getContext();
    const informationExtracted = card.informationExtracted;
    if (!getPlan().vibeAvailable || !card.original || currentEncoding(card, model) || encoding.has(card.id)) return;
    encoding.add(card.id);
    render();
    try {
      const { base64 } = await referencePixels(card.original, { maxBytes: 16 * 1024 * 1024 });
      if (!cards.includes(card) || !getPlan().vibeAvailable || card.informationExtracted !== informationExtracted) return;
      const result = await postJson("/api/novelai/vibe/encode", { model, image_base64: base64, information_extracted: informationExtracted });
      if (result.model !== model || result.information_extracted !== informationExtracted || !result.encoding_base64) throw new Error("Invalid Vibe encoding response.");
      card.encodings.push({ model, informationExtracted, encoding: result.encoding_base64 });
      showToast(t("Vibe encoding ready · {n} Anlas", { n: result.encoding_anlas }));
      if (result.encoding_anlas > 0) onEncoded?.();
    } catch (error) { showToast(error.message, true); }
    finally { encoding.delete(card.id); render(); }
  }

  async function getGenerateRequest() {
    const context = getContext();
    const plan = getPlan();
    if (!plan.canGenerate) throw new Error(t("V4.5 presets and History are preserved. Switch to V5 Full before generating."));
    // Snapshot card settings and order before preparing any image asynchronously.
    const body = vibeRequest(plan.vibes, context.model, normalizeStrength);
    const references = plan.precise.map(card => ({ ...card }));
    if (references.length) {
      body.precise_references = [];
      for (const card of references) {
        const image = await referencePixels(card.original, { maxBytes: 16 * 1024 * 1024, crop: v5ReferenceCrop });
        body.precise_references.push({
          id: card.id, enabled: true, type: card.type, strength: card.strength,
          ...(supportsOutfitPreference(card.type) ? { prefer_same_outfit: card.preferSameOutfit } : {}),
          image_base64: image.base64,
          source_info: { file_name: card.fileName, original_width: image.originalWidth, original_height: image.originalHeight,
            transmitted_width: image.width, transmitted_height: image.height },
        });
      }
    }
    return body;
  }

  function updateSummary() {
    const context = getContext();
    const plan = getPlan();
    const count = plan.precise.length + plan.vibes.length;
    $("preciseReferenceCount").textContent = t("{applied} ready / {total} registered", { applied: count, total: cards.length });
    $("preciseReferenceCost").textContent = plan.fee
      ? t("Reference fee {n} Anlas per image", { n: plan.fee }) : t("No additional reference cost.");
    const messages = [];
    if (!NEW_VIBE_TRANSFER_ENABLED && cards.some(card => card.kind === "vibe")) {
      messages.push("Saved Vibe references are kept but not applied. This build supports V5 Full High Precise Reference.");
    }
    if (kind === "precise" && !plan.preciseAvailable) {
      messages.push(context.model === NOVELAI_V5_FULL_MODEL && context.mode === "inpaint"
        ? "V5 Inpaint ignores Precise Reference. Your cards are kept."
        : context.model === NOVELAI_V5_FULL_MODEL && context.effort === "high" && context.mode === "text-to-image"
          ? "Precise Reference transmission is unavailable in this build. Your cards are kept."
          : "Precise Reference is held for this model or mode.");
    }
    if (kind === "vibe" && !plan.vibeAvailable) {
      messages.push(context.model === NOVELAI_V45_FULL_MODEL && context.mode === "text-to-image"
        ? "Vibe Transfer is unavailable in this build." : "Vibe Transfer requires V4.5 Full Text to Image.");
    }
    if (plan.missingEncodings) messages.push("Encode the enabled Vibes before generating.");
    if (plan.strengths === null) messages.push("The combined Vibe Strength is too large.");
    if (plan.held && ((kind === "vibe" && plan.vibeAvailable) || (kind === "precise" && plan.preciseAvailable))) {
      messages.push("References outside the current model and mode are held.");
    }
    $("preciseReferenceWarning").replaceChildren(...messages.map(message => {
      const row = document.createElement("div"); row.textContent = t(message); return row;
    }));
    $("preciseReferenceWarning").hidden = messages.length === 0;
    if (kind === "vibe") {
      const applied = new Map(plan.vibes.map((card, index) => [card.id, plan.strengths?.[index]]));
      for (const row of $("preciseReferenceList").querySelectorAll("article")) {
        const output = row.querySelector("[data-effective-strength]");
        const value = applied.get(row.dataset.cardId);
        output.hidden = value === undefined || !plan.canGenerate;
        if (!output.hidden) output.textContent = t("Generation strength {value}", { value: Number(value.toPrecision(5)) });
      }
    }
    onChange?.(plan);
  }

  function render() {
    if (!NEW_VIBE_TRANSFER_ENABLED) kind = "precise";
    const panel = $("preciseReferencePanel");
    for (const button of panel.querySelectorAll("[data-reference-kind]")) {
      button.setAttribute("aria-pressed", String(button.dataset.referenceKind === kind));
    }
    $("vibeOptions").hidden = kind !== "vibe";
    $("referenceInputHint").textContent = t(kind === "vibe"
      ? "Add or drop an image or NovelAI Vibe file. Paste an image while this panel is focused."
      : "Add files, drop images here, or focus this panel and paste.");
    $("preciseReferenceInput").accept = "image/png,image/webp,image/jpeg" + (kind === "vibe" ? ",.naiv4vibe,.naiv4vibebundle" : "");
    $("normalizeVibeStrength").checked = normalizeStrength;
    const visible = cards.filter(card => card.kind === kind);
    $("preciseReferenceEmpty").textContent = t(kind === "vibe" ? "No Vibes selected." : "No Precise References selected.");
    $("preciseReferenceEmpty").hidden = visible.length > 0;
    $("addPreciseReferenceButton").textContent = t(kind === "vibe" ? "Add Vibe" : "Add Reference");
    const list = $("preciseReferenceList");
    const context = getContext();
    const focused = list.contains(document.activeElement) ? document.activeElement : null;
    const focusedId = focused?.closest("article")?.dataset.cardId;
    list.innerHTML = visible.map((card, index) => cardHtml(card, context, index, visible.length)).join("");
    for (const [index, article] of [...list.querySelectorAll("article")].entries()) {
      const card = visible[index];
      if (card.kind === "vibe") refreshEncodeButton(article, card);
      if (card.id === focusedId) {
        const controls = article.querySelectorAll("button, input, select");
        const next = [...controls].find(element => element.type === focused.type &&
          element.dataset.referenceAction === focused.dataset.referenceAction &&
          element.dataset.referenceField === focused.dataset.referenceField);
        next?.focus({ preventScroll: true });
      }
    }
    updateSummary();
  }

  function showDimensions(article, card, width, height) {
    if (!width || !height) return;
    const output = article.querySelector("[data-reference-dimensions]");
    const crop = card.kind === "precise" && getPlan().preciseAvailable ? v5ReferenceCrop(width, height) : null;
    output.textContent = crop && !crop.unchanged
      ? t("{width} × {height} · center crop {w} × {h}", { width, height, w: crop.width, h: crop.height })
      : `${width} × ${height}`;
  }

  function refreshEncodeButton(article, card) {
    const button = article.querySelector("[data-reference-action=encode]");
    const status = article.querySelector("[data-vibe-status]");
    const ready = currentEncoding(card, NOVELAI_V45_FULL_MODEL);
    const working = encoding.has(card.id);
    button.textContent = t("Encode · up to 2 Anlas");
    button.disabled = working || Boolean(ready) || !getPlan().vibeAvailable || !card.original;
    status.textContent = t(working ? "Encoding…" : ready ? "Encoding ready" : "Encoding required");
  }

  return { bind, addIntakeItems, getCapacity, getGenerateRequest, getPlan, refreshWarnings: render };
}

function createCard(settings) {
  const { original, thumbnail } = settings;
  const preview = original || thumbnail;
  return { ...settings, encodings: settings.encodings || [], id: crypto.randomUUID(),
    fileName: settings.fileName || original?.name || "Vibe", previewUrl: preview ? URL.createObjectURL(preview) : "" };
}

function newImageCard(item, kind) {
  return {
    kind, type: kind === "vibe" ? "vibe" : "character&style",
    strength: kind === "vibe" ? 0.6 : 1, fidelity: 1, preferSameOutfit: true,
    informationExtracted: kind === "vibe" ? 0.7 : 1, enabled: true,
    fileName: item.fileName, original: item.file, encodings: [],
  };
}

function releasePreview(card) {
  if (card.previewUrl) URL.revokeObjectURL(card.previewUrl);
}

function cardHtml(card, context, index, total) {
  const isVibe = card.kind === "vibe";
  const fields = isVibe ? vibeFields(card) : preciseFields(card, context);
  const preview = card.previewUrl
    ? `<img alt="" src="${card.previewUrl}">`
    : '<span class="reference-encoding-icon">Vibe</span>';
  return `<article class="precise-reference-card" data-card-id="${card.id}" data-enabled="${card.enabled}">
    ${preview}
    <div class="precise-reference-fields">
      <div class="section-row">
        <strong data-no-i18n>${escapeHtml(card.fileName)}</strong>
        ${check("enabled", "Enabled", card.enabled)}
      </div>
      <small data-reference-dimensions></small>
      ${fields}
      <div class="actions reference-card-actions">
        <button type="button" data-reference-action="up" ${index === 0 ? "disabled" : ""}>Up</button>
        <button type="button" data-reference-action="down" ${index + 1 === total ? "disabled" : ""}>Down</button>
        <button type="button" class="danger" data-reference-action="remove">Remove</button>
      </div>
    </div>
  </article>`;
}

function preciseFields(card, context) {
  const legacy = context.model === NOVELAI_V45_FULL_MODEL;
  const types = Object.entries(TYPES).filter(([type]) => !legacy || type !== "outfit" || card.type === "outfit");
  const options = types.map(([type, label]) =>
    `<option value="${type}" ${card.type === type ? "selected" : ""}>${escapeHtml(label)}</option>`);
  let extra = "";
  if (legacy) extra = numeric(card, "fidelity", "Fidelity", 1, true, 0.05);
  else if (supportsOutfitPreference(card.type)) extra = check("preferSameOutfit", "Prefer same outfit", card.preferSameOutfit);
  return `<label>Type<select data-reference-field="type">${options.join("")}</select></label>
    ${numeric(card, "strength", "Strength", legacy ? 1 : 5, true, 0.05)}
    ${extra}`;
}

function vibeFields(card) {
  return `${numeric(card, "strength", "Strength", 1, true)}
    <small data-effective-strength hidden></small>
    ${informationControl(card)}
    <div class="actions">
      <button type="button" data-reference-action="encode"></button>
      <small data-vibe-status role="status"></small>
    </div>`;
}

function informationControl(card) {
  if (card.original) return numeric(card, "informationExtracted", "Information Extracted", 1);
  const values = [...new Set(card.encodings.map(entry => entry.informationExtracted))].sort((a, b) => a - b);
  const options = values.map(value => `<option value="${Number(value)}" ${value === card.informationExtracted ? "selected" : ""}>${Number(value)}</option>`);
  return `<label>Information Extracted<select data-reference-field="informationExtracted">${options.join("")}</select></label>`;
}

function numeric(card, field, label, max, freeNumber = false, step = 0.01) {
  const value = Number(card[field] ?? 1);
  const attrs = `data-reference-field="${field}" value="${value}"`;
  const min = card.kind === "vibe" && field === "strength" ? 0.01 : 0;
  return `<label class="precise-reference-number"><span>${label}</span>
    <input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}" ${attrs}>
    <input type="number" aria-label="${label}" step="any" ${freeNumber ? "" : `min="0" max="${max}"`} ${attrs}>
  </label>`;
}

function check(field, label, checked) {
  return `<label class="inline"><input type="checkbox" data-reference-field="${field}" ${checked ? "checked" : ""}> ${label}</label>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
