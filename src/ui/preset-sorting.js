import { getLanguage } from './i18n.js';
export const SORT_MODES = ['name-asc', 'name-desc', 'updated-desc', 'updated-asc', 'created-desc', 'created-asc'];
const labels = ['Name A–Z', 'Name Z–A', 'Recently modified', 'Oldest modified', 'Recently created', 'Oldest created'];
export function sortPresets(items, mode = 'name-asc', locale = getLanguage()) {
  if (!SORT_MODES.includes(mode)) mode = 'name-asc';
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const descending = mode.endsWith('-desc');
  const field = mode.startsWith('updated') ? 'updated_at' : 'created_at';
  return [...items].sort((a, b) => {
    const comparison = mode.startsWith('name') ? collator.compare(a.name || '', b.name || '')
      : (Date.parse(a[field]) || 0) - (Date.parse(b[field]) || 0);
    return (descending ? -comparison : comparison) || collator.compare(a.name || '', b.name || '') || String(a.id).localeCompare(String(b.id));
  });
}
export function createSortControl(id, host, onChange) {
  const key = `chaessi.preset-sort.${id}.v1`;
  const label = document.createElement('label'); label.className = 'preset-sort'; label.append('Sort');
  const select = document.createElement('select'); select.id = id;
  SORT_MODES.forEach((mode, index) => select.append(new Option(labels[index], mode)));
  try { select.value = localStorage.getItem(key) || 'name-asc'; } catch {}
  if (!SORT_MODES.includes(select.value)) select.value = 'name-asc';
  select.addEventListener('change', () => { try { localStorage.setItem(key, select.value); } catch {} onChange(); });
  label.append(select); host.append(label);
  document.addEventListener('chaessi:language-change', onChange);
  return select;
}
