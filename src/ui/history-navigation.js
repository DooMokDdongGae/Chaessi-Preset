export function getHistoryNavigation(items, currentId) {
  const ordered = Array.isArray(items) ? items : [];
  const index = ordered.findIndex((item) => item?.id === currentId);
  if (index < 0) {
    return { index: -1, total: ordered.length, previousId: null, nextId: null };
  }
  return {
    index,
    total: ordered.length,
    previousId: ordered[index - 1]?.id || null,
    nextId: ordered[index + 1]?.id || null,
  };
}

export function getAdjacentHistoryIdAfterRemoval(items, currentId, removedIds) {
  const ordered = Array.isArray(items) ? items : [];
  const removed = removedIds instanceof Set ? removedIds : new Set(removedIds || []);
  const index = ordered.findIndex((item) => item?.id === currentId);
  if (index < 0 || !removed.has(currentId)) return null;

  // Prefer the next/older record so forward browsing continues naturally.
  for (let candidate = index + 1; candidate < ordered.length; candidate += 1) {
    const id = ordered[candidate]?.id;
    if (id && !removed.has(id)) return id;
  }
  for (let candidate = index - 1; candidate >= 0; candidate -= 1) {
    const id = ordered[candidate]?.id;
    if (id && !removed.has(id)) return id;
  }
  return null;
}

export function isHistoryNavigationEditingTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}
