export const SORT_MODES = ['name-asc', 'name-desc', 'updated-desc', 'updated-asc', 'created-desc', 'created-asc'];

export function sortPresets(items, mode = 'name-asc', locale = 'ko') {
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
