export function createHistorySelectionController() {
  let active = false;
  let busy = false;
  const selectedIds = new Set();

  return {
    enter() {
      if (busy) return this.snapshot();
      active = true;
      return this.snapshot();
    },
    cancel() {
      if (busy) return this.snapshot();
      active = false;
      selectedIds.clear();
      return this.snapshot();
    },
    toggle(id) {
      if (!active || busy || !id) return this.snapshot();
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      return this.snapshot();
    },
    selectVisible(ids) {
      if (!active || busy) return this.snapshot();
      for (const id of ids || []) {
        if (id) selectedIds.add(id);
      }
      return this.snapshot();
    },
    clear() {
      if (busy) return this.snapshot();
      selectedIds.clear();
      return this.snapshot();
    },
    setBusy(nextBusy) {
      busy = Boolean(nextBusy);
      return this.snapshot();
    },
    reconcile(validIds) {
      const valid = new Set(validIds || []);
      for (const id of selectedIds) {
        if (!valid.has(id)) selectedIds.delete(id);
      }
      return this.snapshot();
    },
    snapshot() {
      return {
        active,
        busy,
        count: selectedIds.size,
        selectedIds: [...selectedIds],
      };
    },
    has(id) {
      return selectedIds.has(id);
    },
  };
}
