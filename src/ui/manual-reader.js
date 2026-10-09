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
      const caption = document.createElement('figcaption'); caption.textContent = t('Click an image to enlarge.'); figure.append(button, caption);
      const help = document.createElement('aside'); help.textContent = note;
      article.append(heading, lead, list, figure, help);
      if (chapter.id === 'wildcards') {
        const example = document.createElement('pre'); example.textContent = 'white shirt\nblack shirt\nblue shirt\n\n__tops__ → blue shirt'; article.insertBefore(example, figure);
      }
    }
    const index = filtered.findIndex(c => c.id === active);
    $('manualPrevious').disabled = index <= 0; $('manualNext').disabled = index < 0 || index >= filtered.length - 1;
    $('manualProgress').textContent = `${index + 1} / ${filtered.length}`;
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
  $('openIntegratedManual').addEventListener('click', () => open());
  $('manualClose').addEventListener('click', () => dialog.close());
  $('manualLanguage').addEventListener('change', () => setLanguage($('manualLanguage').value));
  $('manualSearch').addEventListener('input', render); $('manualTextSize').addEventListener('input', render);
  for (const [id, delta] of [['manualPrevious', -1], ['manualNext', 1]]) $(id).addEventListener('click', () => { const index = filtered.findIndex(c => c.id === active); if (filtered[index + delta]) { active = filtered[index + delta].id; $('manualArticle').scrollTop = 0; render(); } });
  render(); return { open };
}
