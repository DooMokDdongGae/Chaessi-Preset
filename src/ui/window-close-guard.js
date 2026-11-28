import {confirmAction} from './confirmation.js';
import {t} from './i18n.js';

// Electron cancels a prevented unload without Chromium's usual confirmation.
// Keep the veto and obtain explicit consent in the existing renderer UI.
export function createWindowCloseGuard({target, confirmDiscard, notifyBusy, close}) {
  const guards = new Set();
  let pending = false;
  const busy = () => [...guards].some(g => g.isBusy());
  const block = event => { event.preventDefault(); event.returnValue = ''; };
  target.addEventListener('beforeunload', event => {
    if (busy()) { block(event); notifyBusy(); return; }
    if (![...guards].some(g => g.isDirty())) return;
    block(event);
    if (pending) return;
    pending = true;
    void (async () => {
      try {
        if (!await confirmDiscard()) return;
        // A save may have started while consent was pending. Never discard it.
        if (busy()) { notifyBusy(); return; }
        for (const guard of guards) if (guard.isDirty()) guard.discard();
        close();
      } finally { pending = false; }
    })().catch(() => {}); // Fail closed; an error never grants consent.
  });
  return {register(guard) { guards.add(guard); return () => guards.delete(guard); }};
}

let windowGuard;
export function protectWindowClose(guard, notify) {
  windowGuard ??= createWindowCloseGuard({
    target: window,
    confirmDiscard: () => confirmAction(t('Discard unsaved image edits and close the application? Save the editing session first to keep it.')),
    notifyBusy: () => notify(t('An image operation is still running or saving. Wait before closing.')),
    close: () => window.close(),
  });
  return windowGuard.register(guard);
}
