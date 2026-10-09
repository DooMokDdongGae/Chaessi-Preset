let pending = null;
export function confirmDeletion({ name, impact = 'The saved item will be removed. Your current prompt stays unchanged.', image = '' }) {
  if (pending) return Promise.resolve(false);
  let dialog = document.getElementById('deleteConfirmDialog');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id = 'deleteConfirmDialog'; dialog.className = 'delete-confirm-dialog'; dialog.setAttribute('aria-labelledby', 'deleteConfirmTitle');
    dialog.innerHTML = `<h2 id="deleteConfirmTitle"></h2><p id="deleteConfirmName" data-no-i18n></p><img id="deleteConfirmImage" alt="" hidden><p id="deleteConfirmImpact"></p><div class="actions"><button type="button" id="deleteConfirmCancel">Cancel</button><button type="button" class="danger-button separated-delete" id="deleteConfirmAccept">Delete</button></div>`;
    document.body.append(dialog);
    dialog.querySelector('#deleteConfirmCancel').addEventListener('click', () => dialog.close('cancel'));
    dialog.querySelector('#deleteConfirmAccept').addEventListener('click', () => dialog.close('delete'));
    dialog.addEventListener('close', () => { const resolve = pending; pending = null; resolve?.(dialog.returnValue === 'delete'); });
    // Escape uses the native cancel event; reset returnValue on every opening.
  }
  document.getElementById('deleteConfirmTitle').textContent = 'Delete this item?';
  document.getElementById('deleteConfirmName').textContent = name;
  document.getElementById('deleteConfirmImpact').textContent = impact;
  const preview = document.getElementById('deleteConfirmImage'); preview.hidden = !image; if (image) preview.src = image; else preview.removeAttribute('src');
  dialog.returnValue = ''; const result = new Promise(resolve => { pending = resolve; });
  dialog.showModal(); document.getElementById('deleteConfirmCancel').focus();
  return result;
}
