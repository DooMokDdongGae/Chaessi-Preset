import {t} from "./i18n.js";
import {planTransfer, transferCatalogue} from "./transfer-plan.js";

const byId = id => document.getElementById(id);
const label = (number, field) => (number ? t("Character {n}", {n:number}) : t("Base")) +
  " · " + t(field === "positive" ? "Positive" : "Undesired");
const errors = new Set(["INVALID", "STALE", "BUSY", "NOT_READY", "TOO_LARGE"]);
const terminalMessages = {
  applied:"Transfer applied to the current draft.", cancelled:"Transfer cancelled.",
  stale:"The draft changed. Refresh the targets in Reader and preview again.",
  expired:"The transfer preview expired.", failed:"Unable to apply the transfer.",
};
function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function consent(parent, caption) {
  const row = element("label");
  const checkbox = element("input");
  checkbox.type = "checkbox";
  row.append(checkbox, document.createTextNode(caption));
  parent.append(row);
}

function renderPlan(plan) {
  const steps = byId("transferSteps"), results = byId("transferResults");
  for (const step of plan.steps) {
    const row = element("li");
    const details = element("details");
    const origin = t("Image {n}", {n:step.source.image}) + " · " + label(step.source.number, step.source.field);
    const mode = t(step.mode === "append" ? "Append" : "Replace");
    details.append(element("summary", origin + " → " + label(step.number, step.field) + " · " + mode));
    if (step.separator) details.append(element("p", t("Separator: comma and space")));
    details.append(element("pre", step.text));
    row.append(details);
    steps.append(row);
  }
  for (let i = 1; i <= plan.createCount; i++) {
    consent(byId("transferConfirmCreate"), t("Create Character {n}", {n:plan.originalCount + i}));
  }
  for (const group of plan.groups) {
    const card = element("section");
    card.dataset.transferField = group.number + "/" + group.field;
    card.append(element("h3", label(group.number, group.field)));
    const pair = element("div");
    pair.className = "transfer-comparison";
    for (const [side, caption] of [["before", "Current text"], ["after", "Final text"]]) {
      const block = element("div");
      const value = element("pre", group[side]);
      value.dataset[side] = "";
      block.append(element("strong", t(caption)), value);
      pair.append(block);
    }
    card.append(pair);
    results.append(card);
    if (group.clear) consent(byId("transferConfirmClear"), t("Allow empty replacement for {target}",
      {target:label(group.number, group.field)}));
  }
}

export function installTransferPreview({bridge, read, write}) {
  const dialog = byId("transferPreviewDialog"), apply = byId("transferApply"), undo = byId("transferUndo");
  const status = byId("transferStatus");
  const identities = new Map(), terminal = new Map();
  let revision = "", previous = null, pending = null, lastEdit = null;
  let timer;
  function snapshot() {
    const current = read();
    // The object reference catches a new draft with identical field contents.
    // The signature also catches direct edits to mutable state and controls.
    if (!previous || current.draft !== previous.draft || current.signature !== previous.signature) {
      revision = crypto.randomUUID();
      previous = {draft:current.draft, signature:current.signature};
    }
    const catalogue = transferCatalogue(current.draft, current.limit, identities);
    return {...catalogue, revision, parts:current.draft.prompt_parts};
  }
  function announce(message) {
    status.hidden = false;
    status.textContent = t(message);
  }
  function finish(state) {
    if (!pending) return;
    const {requestId} = pending;
    pending = null;
    clearTimeout(timer);
    terminal.set(requestId, state);
    if (dialog.open) dialog.close();
    for (const id of ["transferSteps", "transferResults", "transferConfirmCreate", "transferConfirmClear"]) byId(id).replaceChildren();
    announce(terminalMessages[state]);
    // The renderer's local decision is final. Expiry probes can still recover it.
    void bridge.finish(requestId, state).catch(() => {});
  }
  function eligible() {
    return !dialog.querySelector("input[type=checkbox]:not(:checked)");
  }
  dialog.addEventListener("change", () => { apply.disabled = !eligible(); });
  byId("transferCancel").addEventListener("click", () => finish("cancelled"));
  dialog.addEventListener("cancel", event => { event.preventDefault(); finish("cancelled"); });
  dialog.addEventListener("close", () => { if (!dialog.open) finish("cancelled"); });

  apply.addEventListener("click", event => {
    if (!event.isTrusted || !pending || !eligible()) return;
    if (Date.now() >= pending.expiresAt) return finish("expired");
    try {
      if (snapshot().revision !== pending.revision) return finish("stale");
      const {plan} = pending;
      if (Date.now() >= pending.expiresAt) return finish("expired");
      const undoChanges = write(plan);
      if (undoChanges) {
        previous = null;
        let after;
        try { after = snapshot().revision; }
        catch (error) { undoChanges(); throw error; }
        lastEdit = {revision:after, undoChanges};
        undo.hidden = false;
      }
      finish("applied");
    } catch (error) {
      finish(error.message === "STALE" ? "stale" : "failed");
    }
  });
  undo.addEventListener("click", event => {
    if (!event.isTrusted || !lastEdit || pending) return;
    try {
      if (snapshot().revision !== lastEdit.revision) throw new Error("STALE");
      lastEdit.undoChanges();
      lastEdit = null;
      previous = null;
      undo.hidden = true;
      announce("Transfer undone.");
    } catch {
      announce("The draft changed. Undo cannot replace the current edits.");
    }
  });
  bridge.onRequest(({operation, body, expiresAt}) => {
    try {
      if (operation === "expire") {
        if (pending?.requestId === body.requestId) finish("expired");
        const state = terminal.get(body.requestId);
        if (!state) throw new Error("INVALID");
        return {state};
      }
      if (operation === "targets") {
        const {parts, ...targets} = snapshot();
        return targets;
      }
      if (operation !== "preview") throw new Error("INVALID");
      if (pending || document.querySelector("dialog[open]")) throw new Error("BUSY");
      const current = snapshot();
      const plan = planTransfer(body, current, current.parts);
      if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) throw new Error("STALE");
      pending = {requestId:body.requestId, revision:current.revision, plan, expiresAt};
      try {
        renderPlan(plan);
        apply.disabled = !eligible();
        dialog.showModal();
        byId("transferCancel").focus();
        timer = setTimeout(() => finish("expired"), Math.max(0, expiresAt - Date.now()));
      } catch {
        finish("failed");
        throw new Error("NOT_READY");
      }
      return {state:"pending"};
    } catch (error) {
      throw new Error(errors.has(error.message) ? error.message : "NOT_READY");
    }
  });
  return {ready:() => bridge.ready(), invalidate:() => { previous = null; }};
}
