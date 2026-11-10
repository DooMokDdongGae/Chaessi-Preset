export function createPagedListController(pageSize = 50, { rememberLimit = false } = {}) {
  const normalizedPageSize = Math.max(1, Number(pageSize) || 50);
  let items = [];
  let visibleLimit = normalizedPageSize;

  return {
    reset(nextItems) {
      items = Array.isArray(nextItems) ? nextItems : [];
      if (!rememberLimit) visibleLimit = normalizedPageSize;
      return this.snapshot();
    },
    loadMore() {
      if (visibleLimit < items.length) visibleLimit += normalizedPageSize;
      return this.snapshot();
    },
    showAll() {
      visibleLimit = Infinity;
      return this.snapshot();
    },
    snapshot() {
      const visibleCount = Math.min(visibleLimit, items.length);
      return {
        items: items.slice(0, visibleCount),
        visibleCount,
        totalCount: items.length,
        hasMore: visibleCount < items.length,
      };
    },
  };
}
