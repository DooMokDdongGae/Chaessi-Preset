import { getLanguage, setLanguage, t } from './i18n.js';
import { manualChapters } from './manual-content.js';
export function createManualReader() {
  const dialog = document.createElement('dialog'); dialog.id = 'manualReader'; dialog.className = 'manual-reader'; dialog.dataset.noI18n = ''; dialog.setAttribute('aria-labelledby', 'manualTitle');
  dialog.innerHTML = `<header><h2 id="manualTitle"></h2><select id="manualLanguage" aria-label="Language"><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option></select><button id="manualClose" type="button"></button></header><div class="manual-toolbar"><label id="manualSearchLabel"><span></span><input id="manualSearch" type="search"></label><label id="manualTextLabel"><span></span><input id="manualTextSize" type="range" min="14" max="24" step="1" value="17"></label></div><div class="manual-layout"><nav id="manualContents"></nav><article id="manualArticle"></article></div><footer><button type="button" id="manualPrevious"></button><span id="manualProgress"></span><button type="button" id="manualNext"></button></footer>`;
  document.body.append(dialog);
  const $ = id => document.getElementById(id);
  let active = manualChapters[0].id, filtered = manualChapters;
  try { const saved = JSON.parse(localStorage.getItem('chaessi.manual-reader.v1') || '{}'); if (manualChapters.some(c => c.id === saved.chapter)) active = saved.chapter; $('manualTextSize').value = String(saved.size || 17); } catch {}
  const persist = () => { try { localStorage.setItem('chaessi.manual-reader.v1', JSON.stringify({ chapter: active, size: $('manualTextSize').value })); } catch {} };
  const zoom = document.createElement('dialog'); zoom.id = 'manualImageZoom'; zoom.className = 'manual-image-zoom'; zoom.dataset.noI18n = '';
  const zoomClose = document.createElement('button'); zoomClose.type = 'button';
  const image = document.createElement('img'); zoom.append(zoomClose, image); document.body.append(zoom);
  zoomClose.addEventListener('click', () => zoom.close());
  function render() {
    const locale = getLanguage(); $('manualLanguage').value = locale;
    $('manualTitle').textContent = t('Help Center'); $('manualClose').textContent = t('Close');
    $('manualSearchLabel').querySelector('span').textContent = t('Search guide');
    $('manualTextLabel').querySelector('span').textContent = t('Text size');
    $('manualContents').setAttribute('aria-label', t('Contents')); zoomClose.textContent = t('Close');
    $('manualPrevious').textContent = t('Previous'); $('manualNext').textContent = t('Next');
    const query = $('manualSearch').value.trim().toLocaleLowerCase(locale);
    filtered = manualChapters.filter(chapter => !query || JSON.stringify(chapter[locale]).toLocaleLowerCase(locale).includes(query));
    if (filtered.length && !filtered.some(c => c.id === active)) active = filtered[0].id;
    $('manualContents').replaceChildren();
    filtered.forEach((chapter, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = `${manualChapters.indexOf(chapter) + 1}. ${chapter[locale][0]}`;
      button.dataset.manualChapter = chapter.id; button.setAttribute('aria-current', chapter.id === active ? 'page' : 'false');
      button.addEventListener('click', () => { active = chapter.id; $('manualArticle').scrollTop = 0; render(); }); $('manualContents').append(button);
    });
    const article = $('manualArticle'); const scroll = article.scrollTop; article.replaceChildren();
    const chapter = filtered.find(c => c.id === active);
    if (!chapter) article.textContent = t('No matching chapters.');
    else {
      const [title, intro, steps, note] = chapter[locale];
      const heading = document.createElement('h3'); heading.textContent = title;
      const lead = document.createElement('p'); lead.textContent = intro;
      const list = document.createElement('ol'); steps.forEach(text => { const li = document.createElement('li'); li.textContent = text; list.append(li); });
      const figure = document.createElement('figure'); const button = document.createElement('button'); button.type = 'button'; button.className = 'manual-picture';
      const screenshot = document.createElement('img'); screenshot.src = `/assets/manuals/${locale}/${chapter.image}.png`; screenshot.alt = title;
      button.append(screenshot); button.addEventListener('click', () => { image.src = screenshot.src; image.alt = title; zoom.showModal(); zoomClose.focus(); });
      const caption = document.createElement('figcaption'); caption.textContent = (chapter.tool === 'cost' ? ({ko:'① 예상 비용 ② 실행. 화면 잔액은 테스트 예시예요. ',en:'① Estimated cost ② Run. Balances are demonstration values. ',ja:'① 推定費用 ② 実行。残高はテスト用の例です。'}[locale]) : chapter.tool ? ({ko:'① PNG 선택 ② 도구 선택 ③ 주요 설정. 아래로 스크롤하면 실행 버튼이 있어요. 화면 잔액은 테스트 계정 예시예요. ',en:'① Choose PNG ② Choose tool ③ Main control. Scroll down for Run. Account balances are demonstration values. ',ja:'① PNG 選択 ② ツール選択 ③ 主な設定。下へスクロールすると実行があります。残高はテスト用の例です。'}[locale]) : '') + t('Click an image to enlarge.'); figure.append(button, caption);
      if (chapter.imageNote?.[locale]) caption.prepend(chapter.imageNote[locale] + ' ');
      const help = document.createElement('aside'); help.textContent = note;
      const subtitle = text => { const el=document.createElement('h4'); el.textContent=t(text); return el; };
      article.append(heading, subtitle('What does it do?'), lead, subtitle('Try it step by step'), list, subtitle('Picture guide'), figure);
      for (const illustration of chapter.illustrations ?? []) {
        const extra=document.createElement('figure'), enlarge=document.createElement('button'), pic=document.createElement('img'), label=document.createElement('figcaption');
        enlarge.type='button'; enlarge.className='manual-picture'; pic.src=illustration.screenshot ? '/assets/manuals/'+locale+'/'+illustration.screenshot+'.png' : '/assets/manuals/examples/'+illustration.file; pic.alt=illustration.caption[locale];
        label.textContent=illustration.caption[locale]; enlarge.append(pic); extra.append(enlarge,label);
        enlarge.onclick=()=>{image.src=pic.src;image.alt=pic.alt;zoom.showModal();zoomClose.focus();};article.append(extra);
      }
      article.append(subtitle('Remember'),help);
      if (chapter.id === 'wildcards') {
        const example = document.createElement('pre'); example.textContent = 'white shirt\nblack shirt\nblue shirt\n\n__tops__ → blue shirt'; article.insertBefore(example, figure);
      }
    }
    const index = filtered.findIndex(c => c.id === active);
    $('manualPrevious').disabled = index <= 0; $('manualNext').disabled = index < 0 || index >= filtered.length - 1;
    $('manualProgress').textContent = `${index + 1} / ${filtered.length}`;
    $('manualContents').querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
    article.style.fontSize = `${$('manualTextSize').value}px`; article.scrollTop = scroll; persist();
  }
  // A contextual entry changes help navigation only; the workbench and its open
  // tool dialogs stay mounted underneath and native dialog focus returns on close.
  const open = chapterId => {
    if (manualChapters.some(chapter => chapter.id === chapterId)) {
      active = chapterId; $('manualSearch').value = ''; $('manualArticle').scrollTop = 0;
    }
    render(); if (!dialog.open) dialog.showModal(); $('manualClose').focus();
  };
  document.addEventListener('chaessi:open-manual', event => open(event.detail?.chapter));
  const contextualButtons = [];
  const entries = [
    ['.preset-prompt-surface > .section-row', 'editing'],
    ['.preset-character-surface > .section-row', 'characters'],
    ['#characterPositionPadPanel > .section-row', 'position'],
    ['#generationSettingsDialog > header', 'models'],
    ['#apiSettingsDialog > header', 'account'],
    ['#promptEditorDialog > header', 'editing'],
    ['#importWorkspaceDialog > header', 'images'],
    ['#presetLoadDialog .dialog-header', 'presets'],
    ['#presetSaveDialog .dialog-header', 'presets'],
    ['#characterPresetDialog .dialog-header', 'characters'],
    ['#wildcardDialog .dialog-header', 'wildcards'],
    ['#panel-history .panel-heading', 'history'],
    ['#panel-generate .panel-heading', 'models'],
    ['#modeSourcePanel .source-actions', 'images'],
  ];
  for (const [selector, chapterId] of entries) {
    const host = document.querySelector(selector); if (!host) continue;
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'context-help-button'; button.dataset.helpTopic = chapterId; button.dataset.noI18n = '';
    button.addEventListener('click', () => open(chapterId)); host.append(button); contextualButtons.push(button);
  }
  const updateHelpLabels = () => {
    for (const button of contextualButtons) {
      button.textContent = `? ${t('Help')}`;
      button.title = `${t('Help')}: ${manualChapters.find(chapter => chapter.id === button.dataset.helpTopic)[getLanguage()][0]}`;
      button.setAttribute('aria-label', button.title);
    }
  };
  document.addEventListener('chaessi:language-change', updateHelpLabels); updateHelpLabels();
  document.addEventListener('chaessi:language-change', render);
  document.querySelectorAll('[data-manual-jump]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.manualJump)));
  $('openIntegratedManual').addEventListener('click', () => open());
  $('manualClose').addEventListener('click', () => dialog.close());
  $('manualLanguage').addEventListener('change', () => setLanguage($('manualLanguage').value));
  $('manualSearch').addEventListener('input', render); $('manualTextSize').addEventListener('input', render);
  for (const [id, delta] of [['manualPrevious', -1], ['manualNext', 1]]) $(id).addEventListener('click', () => { const index = filtered.findIndex(c => c.id === active); if (filtered[index + delta]) { active = filtered[index + delta].id; $('manualArticle').scrollTop = 0; render(); } });
  render(); return { open };
}
