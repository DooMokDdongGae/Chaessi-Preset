import {t} from './i18n.js';

let pending = false;

// Only the approval button grants consent. Escape, Close and programmatic
// closure all decline. Reentrant callers must never share another action's consent.
export function confirmAction(message) {
  if (pending) return Promise.resolve(false);
  pending = true;
  const previous = document.activeElement;
  const selection = typeof previous?.selectionStart === 'number'
    ? [previous.selectionStart, previous.selectionEnd, previous.selectionDirection] : null;
  const dialog = document.createElement('dialog');
  dialog.id = 'actionConfirmDialog';
  dialog.className = 'delete-confirm-dialog';
  dialog.setAttribute('aria-labelledby', 'actionConfirmTitle');
  dialog.setAttribute('aria-describedby', 'actionConfirmMessage');
  dialog.innerHTML = `<header class="dialog-header"><h2 id="actionConfirmTitle" data-no-i18n></h2><button type="button" id="actionConfirmClose" data-no-i18n></button></header><p id="actionConfirmMessage" data-no-i18n></p><div class="actions"><button type="button" id="actionConfirmCancel" data-no-i18n></button><button type="button" class="primary" id="actionConfirmAccept" data-no-i18n></button></div>`;
  dialog.querySelector('#actionConfirmTitle').textContent = t('Confirm action');
  dialog.querySelector('#actionConfirmMessage').textContent = message;
  for (const [id, label] of [['Close','Close'], ['Cancel','Cancel'], ['Accept','Continue']]) {
    dialog.querySelector('#actionConfirm'+id).textContent = t(label);
  }
  document.body.append(dialog);
  return new Promise(resolve => {
    let approved = false;
    dialog.querySelector('#actionConfirmAccept').onclick = () => { approved = true; dialog.close('approve'); };
    dialog.querySelector('#actionConfirmCancel').onclick = () => dialog.close('cancel');
    dialog.querySelector('#actionConfirmClose').onclick = () => dialog.close('close');
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close('escape'); });
    const finish = () => {
      dialog.remove(); pending = false; resolve(approved);
      // Allow callers to unlock their controls first. Do not replace a focus
      // choice already made by the caller/user, or focus behind another modal.
      requestAnimationFrame(() => {
        const active = document.activeElement;
        const modal = [...document.querySelectorAll('dialog:modal')].at(-1);
        if (active !== previous && active !== document.body && active?.isConnected && !dialog.contains(active)) return;
        if (!previous?.isConnected || previous.disabled || previous.closest('[inert]') || !previous.getClientRects().length || (modal && !modal.contains(previous))) return;
        previous.focus({preventScroll:true});
        if (selection) previous.setSelectionRange(...selection);
      });
    };
    dialog.addEventListener('close', finish, {once:true});
    try { dialog.showModal(); dialog.querySelector('#actionConfirmCancel').focus(); }
    catch { finish(); }
  });
}
