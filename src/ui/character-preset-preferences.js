const STORAGE_KEY = "chaessi.character-preset-categories.v1";
const MAX_SLOTS = 32;
const emptyFilter = () => ({ category: "", subCategory: "" });
const validSlot = index => Number.isInteger(index) && index >= 0 && index < MAX_SLOTS;

function normalizeFilter(value) {
  const category = typeof value?.category === "string" ? value.category : "";
  return { category, subCategory: category && typeof value?.subCategory === "string" ? value.subCategory : "" };
}

// Preferences belong to numbered editor fields, independently of loaded presets.
export function createCharacterPresetPreferences(storage) {
  let slots = [];
  try {
    storage ??= globalThis.localStorage;
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    if (saved?.schema === 1 && Array.isArray(saved.slots)) {
      slots = saved.slots.slice(0, MAX_SLOTS).map(normalizeFilter);
    }
  } catch {
    // Unavailable or damaged browser storage must not prevent opening the app.
  }
  return {
    get(index) { return validSlot(index) ? normalizeFilter(slots[index]) : emptyFilter(); },
    set(index, filter) {
      if (!validSlot(index)) return false;
      while (slots.length <= index) slots.push(emptyFilter());
      slots[index] = normalizeFilter(filter);
      try {
        if (!storage) return false;
        storage.setItem(STORAGE_KEY, JSON.stringify({ schema: 1, slots }));
        return true;
      } catch { return false; }
    },
  };
}
