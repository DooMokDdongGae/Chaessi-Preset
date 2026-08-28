export function createPagedListController(pageSize = 50) {
  const normalizedPageSize = Math.max(1, Number(pageSize) || 50);
  let items = [];
  let visibleCount = normalizedPageSize;

  return {
    reset(nextItems) {
      items = Array.isArray(nextItems) ? nextItems : [];
      visibleCount = Math.min(normalizedPageSize, items.length);
      return this.snapshot();
    },
    loadMore() {
      visibleCount = Math.min(items.length, visibleCount + normalizedPageSize);
      return this.snapshot();
    },
    snapshot() {
      return {
        items: items.slice(0, visibleCount),
        visibleCount,
        totalCount: items.length,
        hasMore: visibleCount < items.length,
      };
    },
  };
}
