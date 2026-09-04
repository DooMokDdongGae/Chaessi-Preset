const DEFAULT_CENTER = Object.freeze({ x: 0.5, y: 0.5 });

export function clampPosition(value, fallback = 0.5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

export function roundPosition(value) {
  return Math.round(clampPosition(value) * 1000) / 1000;
}

export function normalizePointerPosition(pointer, rect) {
  const width = Number(rect?.width);
  const height = Number(rect?.height);
  if (!(width > 0) || !(height > 0)) return { ...DEFAULT_CENTER };
  return {
    x: roundPosition((Number(pointer?.clientX) - Number(rect.left || 0)) / width),
    y: roundPosition((Number(pointer?.clientY) - Number(rect.top || 0)) / height),
  };
}

export function getPositionPadAspect(width, height) {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  if (!(safeWidth > 0) || !(safeHeight > 0)) return 1;
  return safeWidth / safeHeight;
}

export function findPositionOverlaps(characters, threshold = 0.1) {
  const active = (Array.isArray(characters) ? characters : [])
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => character?.enabled !== false);
  const overlaps = [];
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      const first = getCharacterCenter(active[left].character);
      const second = getCharacterCenter(active[right].character);
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (distance < threshold - 1e-12) {
        overlaps.push({
          firstIndex: active[left].index,
          secondIndex: active[right].index,
          distance,
        });
      }
    }
  }
  return overlaps;
}

export function createCharacterPositionPad({
  root,
  pad,
  markers,
  warning,
  selectionLabel,
  resetButton,
  onPositionChange,
  onSelect,
}) {
  let characters = [];
  let selectedIndex = 0;
  let activePointerId = null;
  let draggedIndex = null;

  const updateMarker = (index, position) => {
    const marker = markers.querySelector(`[data-position-marker="${index}"]`);
    if (!marker) return;
    marker.style.left = `${clampPosition(position.x) * 100}%`;
    marker.style.top = `${clampPosition(position.y) * 100}%`;
  };

  const updateSelection = () => {
    markers.querySelectorAll("[data-position-marker]").forEach((marker) => {
      const active = Number(marker.dataset.positionMarker) === selectedIndex;
      marker.classList.toggle("is-active", active);
      marker.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const selected = characters[selectedIndex]?.enabled !== false ? characters[selectedIndex] : null;
    selectionLabel.textContent = selected
      ? `Selected: Character ${selectedIndex + 1}`
      : "Select a character marker";
    resetButton.disabled = !selected;
  };

  const updateWarning = () => {
    const overlaps = findPositionOverlaps(characters);
    warning.hidden = overlaps.length === 0;
    warning.textContent = overlaps.length
      ? `Overlap warning: ${overlaps.slice(0, 6).map(({ firstIndex, secondIndex }) => `${firstIndex + 1} & ${secondIndex + 1}`).join(", ")}${overlaps.length > 6 ? ` and ${overlaps.length - 6} more pairs` : ""} are closer than 0.1. Generation is still allowed.`
      : "";
  };

  const setSelectedIndex = (index, notify = true) => {
    const numericIndex = Number(index);
    if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= characters.length) return;
    if (activePointerId !== null && draggedIndex !== numericIndex) finishDrag({ pointerId: activePointerId });
    selectedIndex = numericIndex;
    updateSelection();
    if (notify) onSelect?.(selectedIndex);
  };

  const setPosition = (index, position, { notify = true } = {}) => {
    if (!characters[index]) return;
    const normalized = {
      x: clampPosition(position?.x),
      y: clampPosition(position?.y),
    };
    const existingCenters = Array.isArray(characters[index].centers) ? characters[index].centers : [];
    characters[index] = {
      ...characters[index],
      centers: [normalized, ...existingCenters.slice(1)],
    };
    updateMarker(index, normalized);
    updateWarning();
    if (notify) onPositionChange?.(index, normalized);
  };

  const updateFromPointer = (event) => {
    if (draggedIndex === null) return;
    setPosition(draggedIndex, normalizePointerPosition(event, pad.getBoundingClientRect()));
  };

  pad.addEventListener("pointerdown", (event) => {
    if (root.hidden || activePointerId !== null || event.button !== 0) return;
    const marker = event.target.closest?.("[data-position-marker]");
    if (!marker || !pad.contains(marker)) return;
    draggedIndex = Number(marker.dataset.positionMarker);
    activePointerId = event.pointerId;
    setSelectedIndex(draggedIndex);
    pad.setPointerCapture?.(activePointerId);
    updateFromPointer(event);
    event.preventDefault();
  });
  pad.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    updateFromPointer(event);
  });
  const finishDrag = (event) => {
    if (event.pointerId !== activePointerId) return;
    const pointerId = activePointerId;
    activePointerId = null;
    draggedIndex = null;
    if (pointerId !== null && pad.hasPointerCapture?.(pointerId)) pad.releasePointerCapture(pointerId);
  };
  pad.addEventListener("pointerup", finishDrag);
  pad.addEventListener("pointercancel", finishDrag);
  pad.addEventListener("lostpointercapture", finishDrag);
  const cancelDrag = () => {
    if (activePointerId !== null) finishDrag({ pointerId: activePointerId });
  };
  pad.ownerDocument.defaultView.addEventListener("resize", cancelDrag);
  pad.ownerDocument.defaultView.addEventListener("blur", cancelDrag);
  pad.addEventListener("click", (event) => {
    const marker = event.target.closest?.("[data-position-marker]");
    if (marker && pad.contains(marker)) setSelectedIndex(Number(marker.dataset.positionMarker));
  });
  resetButton.addEventListener("click", () => setPosition(selectedIndex, DEFAULT_CENTER));

  return {
    render({ characters: nextCharacters, selectedIndex: nextSelectedIndex, visible, width, height }) {
      if (activePointerId !== null) finishDrag({ pointerId: activePointerId });
      characters = structuredClone(Array.isArray(nextCharacters) ? nextCharacters : []);
      selectedIndex = Number.isInteger(nextSelectedIndex) ? nextSelectedIndex : 0;
      root.hidden = !visible;
      if (!visible) return;

      const aspect = getPositionPadAspect(width, height);
      pad.style.aspectRatio = `${Number(width) || 1} / ${Number(height) || 1}`;
      pad.style.setProperty("--position-pad-max-width", `${Math.round(512 * Math.min(1, aspect))}px`);
      markers.innerHTML = characters.map((character, index) => {
        if (character?.enabled === false) return "";
        const center = getCharacterCenter(character);
        return `<button type="button" class="character-position-marker" data-position-marker="${index}" aria-label="Character ${index + 1} position" aria-pressed="false" style="left:${center.x * 100}%;top:${center.y * 100}%">${index + 1}</button>`;
      }).join("");
      updateSelection();
      updateWarning();
    },
    setSelectedIndex,
    setPosition,
  };
}

function getCharacterCenter(character) {
  const center = Array.isArray(character?.centers) ? character.centers[0] : null;
  return {
    x: clampPosition(center?.x ?? DEFAULT_CENTER.x),
    y: clampPosition(center?.y ?? DEFAULT_CENTER.y),
  };
}
