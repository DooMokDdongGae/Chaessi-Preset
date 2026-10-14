export function createPromptWorkflow() {
  let saved = null, previous = null;
  const copy = preset => preset ? structuredClone(preset) : null;
  const fingerprint = preset => JSON.stringify({ name: preset?.metadata?.name, prompt: preset?.prompt_parts, params: preset?.params });
  return {
    markSaved(preset) { saved = copy(preset); },
    checkpoint(preset) { previous = copy(preset); },
    isDirty(preset) { return saved && fingerprint(saved) !== fingerprint(preset); },
    saved() { return copy(saved); },
    hasPrevious() { return Boolean(previous); },
    swapPrevious(preset) { const next = copy(previous); previous = copy(preset); return next; },
  };
}
