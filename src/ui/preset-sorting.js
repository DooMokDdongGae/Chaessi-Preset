import { getLanguage } from './i18n.js';
import { SORT_MODES, sortPresets as sortByLocale } from '../state/preset-sorting.js';
export { SORT_MODES };
const labels = ['Name A–Z', 'Name Z–A', 'Recently modified', 'Oldest modified', 'Recently created', 'Oldest created'];
export function sortPresets(items, mode = 'name-asc', locale = getLanguage()) {
  return sortByLocale(items, mode, locale);
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
