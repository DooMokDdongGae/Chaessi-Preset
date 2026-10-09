import { deleteJson, getJson, postJson } from "../api/client.js";
import { translateText, t, formatUIError } from './i18n.js';
import { confirmDeletion } from './delete-confirmation.js';

export function createWildcardController({ showToast }) {
  const $ = id => document.getElementById(id);
  const dialog = $("wildcardDialog");
  let items = [], current = null, target = null, dirty = false, busy = false;
  const status = text => { $("wildcardStatus").textContent = text; };
  function counts() {
    const lines = $("wildcardEntries").value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const unique = new Set(lines).size;
    $("wildcardCount").textContent = `${unique} candidates | ${lines.length - unique} duplicate lines${dirty ? " | Unsaved changes" : ""}`;
    $("wildcardReference").textContent = `Reference: __${$("wildcardKey").value || "tops"}__`;
  }
  function fill(item = null) {
    current = item; dirty = false;
    $("wildcardName").value = item?.name || "";
    $("wildcardKey").value = item?.key || "";
    $("wildcardKey").readOnly = Boolean(item);
    $("wildcardEntries").value = item?.entries.join("\n") || "";
    $("wildcardDelete").disabled = !item;
    $("wildcardInsert").hidden = !target;
    counts(); render();
  }
  function render() {
    const filter = $("wildcardSearch").value.toLocaleLowerCase();
    const list = $("wildcardList"); list.replaceChildren();
    for (const item of items.filter(item => `${item.name} ${item.key}`.toLocaleLowerCase().includes(filter))) {
      const button = document.createElement("button"); button.type = "button";
      button.textContent = `${item.name} · __${item.key}__ · ${item.count}`;
      button.dataset.wildcardId = item.id;
      button.classList.toggle("is-active", item.id === current?.id);
      button.addEventListener("click", () => run(async () => {
        if (!canDiscard()) return;
        fill((await getJson(`/api/wildcards/${encodeURIComponent(item.id)}`)).wildcard);
        status("Edit candidates, then Save. The key stays the same.");
      }));
      list.append(button);
    }
    if (!list.children.length) list.textContent = "No Wildcards. Click + New Wildcard.";
  }
  async function refresh() { items = (await getJson("/api/wildcards")).items; render(); }
  function canDiscard() { return !dirty || window.confirm(translateText("Discard unsaved Wildcard changes?")); }
  async function run(fn) {
    if (busy) return;
    busy = true;
    const controls = [...dialog.querySelectorAll("button, input, textarea")];
    const disabled = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    try { await fn(); }
    catch (error) { status(formatUIError(error.message)); showToast(error.message, true); }
    finally {
      controls.forEach((control, i) => { control.disabled = disabled[i]; });
      $("wildcardDelete").disabled = !current;
      busy = false;
    }
  }
  async function save() {
    const result = await postJson("/api/wildcards", { id: current?.id, key: $("wildcardKey").value, name: $("wildcardName").value, text: $("wildcardEntries").value });
    fill(result.wildcard); await refresh(); status(`Saved ${result.wildcard.entries.length} candidates. Every candidate has an equal chance.`);
    return result.wildcard;
  }
  async function open(input = null) {
    target = input ? { input, start: input.selectionStart, end: input.selectionEnd } : null;
    $("wildcardInsert").hidden = !target;
    if (!dialog.open) dialog.showModal();
    await refresh();
    if (!current) fill();
    status(target ? "Choose a Wildcard and click Insert into prompt." : "Create a Wildcard or select one from the list.");
  }
  $("openWildcardsButton").addEventListener("click", () => run(() => open()));
  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-insert-wildcard], [data-character-wildcard]");
    if (!button) return;
    const input = button.dataset.insertWildcard
      ? $(button.dataset.insertWildcard)
      : button.closest(".character-card").querySelector("textarea.is-active");
    if (input) run(() => open(input));
  });
  $("wildcardClose").addEventListener("click", () => { if (!busy && canDiscard()) { fill(current); dialog.close(); } });
  dialog.addEventListener("cancel", event => { if (busy || !canDiscard()) event.preventDefault(); else fill(current); });
  $("wildcardNew").addEventListener("click", () => { if (canDiscard()) { fill(); $("wildcardKey").focus(); status("Choose a key, add one candidate per line, then Save."); } });
  $("wildcardSearch").addEventListener("input", render);
  for (const id of ["wildcardName", "wildcardKey", "wildcardEntries"]) $(id).addEventListener("input", () => { dirty = true; counts(); });
  $("wildcardSave").addEventListener("click", () => run(save));
  $("wildcardInsert").addEventListener("click", () => run(async () => {
    if (!target?.input.isConnected) throw new Error("The prompt field changed. Close this window and open Wildcard again.");
    const item = dirty || !current ? await save() : current;
    const input = target.input;
    input.setRangeText(`__${item.key}__`, target.start, target.end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    dialog.close(); input.focus(); showToast(`Inserted __${item.key}__.`);
  }));
  $("wildcardDelete").addEventListener("click", () => run(async () => {
    if (!current || !await confirmDeletion({ name: `${current.name} · __${current.key}__`, impact: t('Presets containing __{key}__ will need another Wildcard. Existing generated images are kept.', { key: current.key }) })) return;
    await deleteJson(`/api/wildcards/${encodeURIComponent(current.id)}`); fill(); await refresh(); status("Wildcard deleted.");
  }));
  $("wildcardImport").addEventListener("click", () => $("wildcardFile").click());
  $("wildcardFile").addEventListener("change", event => run(async () => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("TXT file must be 5 MB or smaller.");
      if ($("wildcardEntries").value.trim() && !canDiscard()) return;
      $("wildcardEntries").value = (await file.text()).replace(/^\uFEFF/, ""); dirty = true; counts(); status("Imported candidates. Click Save to keep them.");
    } finally { event.target.value = ""; }
  }));
  $("wildcardExport").addEventListener("click", () => {
    const blob = new Blob([$("wildcardEntries").value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = `${$("wildcardKey").value.replace(/[^a-z0-9_-]/g, "") || "wildcard"}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("wildcardSample").addEventListener("click", () => {
    const entries = [...new Set($("wildcardEntries").value.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
    status(entries.length ? `Sample only: ${entries[Math.floor(Math.random() * entries.length)]}` : "Add a candidate first.");
  });
  fill();
}
