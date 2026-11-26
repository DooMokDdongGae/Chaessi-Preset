import { getLanguage } from './i18n.js';
import { deleteReferences, listReferences, readReference, renameReference, saveReference } from './reference-library-client.js';

const messages = {
  title: ['레퍼런스 보관함', 'Reference library', '参照ライブラリ'],
  close: ['닫기', 'Close', '閉じる'],
  capture: ['저장할 참조', 'References to save', '保存する参照'],
  all: ['현재 구성 전체', 'Entire current set', '現在の構成全体'],
  name: ['보관함 이름', 'Library name', '保存名'],
  save: ['저장', 'Save', '保存'],
  saveAs: ['다른 이름으로 저장', 'Save as', '名前を付けて保存'],
  saved: ['저장된 참조', 'Saved references', '保存済みの参照'],
  empty: ['저장된 참조가 없습니다.', 'No saved references.', '保存済みの参照はありません。'],
  set: ['구성', 'Set', '構成'],
  single: ['개별', 'Single', '単体'],
  rename: ['이름 변경', 'Rename', '名前の変更'],
  load: ['불러오기', 'Load', '読み込み'],
  refresh: ['목록 새로고침', 'Refresh list', '一覧を更新'],
  remove: ['선택 삭제', 'Delete selected', '選択した項目を削除'],
  cancel: ['취소', 'Cancel', 'キャンセル'],
  accept: ['확인', 'Confirm', '確認'],
  erase: ['선택한 {n}개 항목을 보관함에서 삭제할까요?', 'Delete the {n} selected library entries?', '選択した{n}件をライブラリから削除しますか？'],
  replace: ['현재 참조 목록을 선택한 구성으로 교체할까요?', 'Replace the current references with this set?', '現在の参照をこの構成に置き換えますか？'],
  overwrite: ['선택한 보관함 항목을 현재 설정으로 덮어쓸까요?', 'Overwrite the selected library entry with the current settings?', '選択した項目を現在の設定で上書きしますか？'],
  loading: ['처리 중…', 'Working…', '処理中…'],
  stored: ['레퍼런스를 저장했습니다.', 'Reference saved.', '参照を保存しました。'],
  loaded: ['레퍼런스를 불러왔습니다.', 'Reference loaded.', '参照を読み込みました。'],
  renamed: ['이름을 변경했습니다.', 'Reference renamed.', '名前を変更しました。'],
  deleted: ['선택한 항목을 삭제했습니다.', 'Selected references deleted.', '選択した参照を削除しました。'],
};
const tr = (key, count) => messages[key][{ ko: 0, en: 1, ja: 2 }[getLanguage()] ?? 1].replace('{n}', String(count));

export function createReferenceLibraryUI({ container, listCards, capture, restore, showToast }) {
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.dataset.noI18n = '';
  launch.id = 'openReferenceLibrary';
  container.append(launch);
  const dialog = document.createElement('dialog');
  dialog.className = 'preset-dialog';
  dialog.id = 'referenceLibraryDialog';
  dialog.dataset.noI18n = '';
  dialog.setAttribute('aria-labelledby', 'referenceLibraryTitle');
  dialog.innerHTML = `<form>
    <header class="dialog-header"><h2 id="referenceLibraryTitle" data-text="title"></h2><button type="button" data-action="close" data-text="close"></button></header>
    <label><span data-text="capture"></span><select name="source"></select></label>
    <label><span data-text="name"></span><input name="entryName" maxlength="160" autocomplete="off"></label>
    <div class="actions"><button type="button" data-action="save" data-text="save"></button><button type="button" data-action="saveAs" data-text="saveAs"></button></div>
    <section><h3 data-text="saved"></h3><div data-list></div></section>
    <div class="actions"><button type="button" data-action="load" data-text="load"></button><button type="button" data-action="rename" data-text="rename"></button>
    <button type="button" data-action="remove" class="danger" data-text="remove"></button><button type="button" data-action="refresh" data-text="refresh"></button></div>
    <div data-confirm hidden><p></p><div class="actions"><button type="button" data-action="accept" data-text="accept"></button><button type="button" data-action="cancel" data-text="cancel"></button></div></div>
    <p role="status" aria-live="polite" data-status></p>
  </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const name = form.elements.namedItem('entryName');
  const source = form.elements.namedItem('source');
  const list = dialog.querySelector('[data-list]');
  const status = dialog.querySelector('[data-status]');
  const confirmBox = dialog.querySelector('[data-confirm]');
  const action = key => dialog.querySelector(`[data-action="${key}"]`);
  let items = [];
  let selected = new Set();
  let busy = false;
  let pending = null;

  function selection() {
    return items.filter(item => selected.has(item.id));
  }
  function syncControls() {
    const picks = selection();
    const isSingle = picks.length === 1;
    const locked = busy || Boolean(pending);
    const sourceKind = source.value ? 'single' : 'set';
    const canSave = source.options.length > 1 && name.value.trim().length > 0;
    action('save').disabled = locked || !canSave || picks.length > 1 || (isSingle && picks[0].scope !== sourceKind);
    action('saveAs').disabled = locked || !canSave || !isSingle;
    action('load').disabled = locked || !isSingle;
    action('rename').disabled = locked || !isSingle || !name.value.trim() || name.value.trim() === picks[0]?.name;
    action('remove').disabled = locked || !picks.length;
    action('refresh').disabled = locked;
    action('close').disabled = busy;
    source.disabled = locked;
    name.disabled = locked;
    for (const checkbox of list.querySelectorAll('input')) checkbox.disabled = locked;
    confirmBox.hidden = !pending;
    confirmBox.querySelector('p').textContent = pending ? tr(pending.message, picks.length) : '';
  }
  function renderSources() {
    const previous = source.value;
    source.replaceChildren(new Option(tr('all'), ''));
    for (const [index, card] of listCards().entries()) source.add(new Option(`${index + 1}. ${card.label}`, card.id));
    source.value = [...source.options].some(option => option.value === previous) ? previous : '';
  }
  function renderList() {
    list.replaceChildren();
    for (const item of items) {
      const label = document.createElement('label');
      label.className = 'inline';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = item.id;
      checkbox.checked = selected.has(item.id);
      label.append(checkbox, document.createTextNode(` ${item.name} · ${tr(item.scope)} (${item.count})`));
      const row = document.createElement('div');
      row.append(label);
      list.append(row);
    }
    if (!items.length) list.textContent = tr('empty');
    syncControls();
  }
  function translate() {
    launch.textContent = tr('title');
    for (const node of dialog.querySelectorAll('[data-text]')) node.textContent = tr(node.dataset.text);
    if (dialog.open) {
      renderSources();
      renderList();
    }
  }
  async function refresh(selectedId) {
    items = await listReferences();
    selected = new Set(items.filter(item => selectedId ? item.id === selectedId : selected.has(item.id)).map(item => item.id));
    renderList();
  }
  async function run(operation) {
    if (busy) return;
    busy = true;
    status.textContent = tr('loading');
    syncControls();
    try {
      await operation();
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      syncControls();
    }
  }
  function confirm(message, perform) {
    pending = { message, perform };
    syncControls();
    action('cancel').focus();
  }
  function save(item) {
    const cardId = source.value || null;
    const title = name.value.trim();
    return run(async () => {
      const result = await saveReference({ item, name: title, scope: cardId ? 'single' : 'set', snapshot: await capture(cardId) });
      await refresh(result.id);
      showToast(tr('stored'));
    });
  }
  function load(item) {
    return run(async () => {
      await restore(await readReference(item), item.scope);
      dialog.close();
      showToast(tr('loaded'));
    });
  }
  form.addEventListener('submit', event => event.preventDefault());
  list.addEventListener('change', event => {
    const input = event.target;
    if (input.type !== 'checkbox') return;
    if (input.checked) selected.add(input.value);
    else selected.delete(input.value);
    const [item] = selection();
    if (selected.size === 1) name.value = item.name;
    syncControls();
  });
  source.addEventListener('change', syncControls);
  name.addEventListener('input', syncControls);
  dialog.addEventListener('cancel', event => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener('click', event => {
    const key = event.target.closest('[data-action]')?.dataset.action;
    const picks = selection();
    const item = picks[0];
    if (key === 'close') dialog.close();
    if (key === 'refresh') run(() => refresh());
    if (key === 'save') {
      if (item) confirm('overwrite', () => save(item));
      else save();
    }
    if (key === 'saveAs') save();
    if (key === 'load') {
      if (item.scope === 'set' && listCards().length) confirm('replace', () => load(item));
      else load(item);
    }
    if (key === 'rename') run(async () => {
      await renameReference(item, name.value.trim());
      await refresh(item.id);
      showToast(tr('renamed'));
    });
    if (key === 'remove') confirm('erase', () => run(async () => {
      await deleteReferences(picks);
      selected.clear();
      name.value = '';
      await refresh();
      showToast(tr('deleted'));
    }));
    if (key === 'accept' || key === 'cancel') {
      const next = pending;
      pending = null;
      syncControls();
      if (key === 'accept') next?.perform();
    }
  });
  launch.addEventListener('click', () => {
    pending = null;
    items = [];
    selected.clear();
    name.value = '';
    source.replaceChildren();
    renderSources();
    renderList();
    dialog.showModal();
    run(() => refresh());
  });
  document.addEventListener('chaessi:language-change', translate);
  translate();
}
