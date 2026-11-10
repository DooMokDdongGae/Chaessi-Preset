export function zoomViewAt(view, zoom, anchor) {
  const ratio = zoom / view.zoom;
  return {
    zoom,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  };
}
