import { messages } from './translations.js';

export const LANGUAGE_KEY = 'chaessi.ui-language.v1';
export const languages = ['ko', 'en', 'ja'];
let language = 'en';
try { language = localStorage.getItem(LANGUAGE_KEY) || navigator.language.split('-')[0]; } catch {}
if (!languages.includes(language)) language = 'en';
export const getLanguage = () => language;
const reverse = new Map();
for (const [key, value] of Object.entries(messages)) for (const locale of languages) if (!key.includes('{')) reverse.set(value[locale], key);
const patterns = Object.entries(messages).filter(([key]) => key.includes('{')).map(([key, values]) => {
  const names = [];
  const parts = key.split(/(\{\w+\})/).map(part => /^\{\w+\}$/.test(part)
    ? (names.push(part.slice(1, -1)), '([\\s\\S]*?)') : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return { regex: new RegExp(`^${parts.join('')}$`), names, values };
});
export function t(source, params = {}, locale = language) {
  const value = messages[source]?.[locale] || source;
  return value.replace(/\{(\w+)\}/g, (match, name) => params[name] === undefined ? match : String(params[name]));
}
export function translateText(source, locale = language) {
  const trimmed = source.trim();
  const key = messages[trimmed] ? trimmed : reverse.get(trimmed) || trimmed;
  let result = messages[key]?.[locale];
  if (!result) {
    for (const entry of patterns) {
      const match = entry.regex.exec(trimmed);
      if (match) { result = entry.values[locale].replace(/\{(\w+)\}/g, (_, key) => {
        const value = match[entry.names.indexOf(key) + 1];
        return ['target', 'kind', 'dirty', 'field'].includes(key) ? translateText(value, locale) : value;
      }); break; }
    }
  }
  return result ? source.replace(trimmed, () => result) : source;
}
export function setLanguage(next) {
  if (!languages.includes(next)) return;
  language = next;
  try { localStorage.setItem(LANGUAGE_KEY, next); } catch {}
  document.documentElement.lang = next;
  document.dispatchEvent(new CustomEvent('chaessi:language-change', { detail: { language: next } }));
}
export function formatUIError(message) {
  const source = String(message || 'Unknown');
  // Provider/protocol diagnostics stay verbatim, under a localized heading.
  return translateText(source, 'ko') !== source || translateText(source, 'ja') !== source ? source : `Error details: ${source}`;
}

// Translate presentation text in place. Never rebuild controls or change values.
// User-owned names, prompts, JSON, file names and category keys are excluded.
export function installLanguageUI() {
  const original = new WeakMap(), attributes = new WeakMap();
  const deleteActions = new Set(['deleteBasePromptPresetButton', 'deleteUndesiredPresetButton', 'deleteParamsPresetButton', 'deleteCharacterPresetButton', 'dialogDeleteCharacterPresetButton', 'deleteLatestButton', 'imageViewerDeleteButton', 'historyDeleteSelectedButton', 'historyBulkDeleteConfirmButton', 'wildcardDelete', 'deleteConfirmAccept', 'clearTokenButton']);
  const protectedSelector = '[data-no-i18n], script, style, textarea, pre, #summaryName, #summaryImport, #imageImportTitle, #imageViewerHistoryMetadata, #imageViewerHistoryId, #imageViewerCreatedAt, #characterPresetPromptPreview, #characterPresetUndesiredPreview, .character-folded-preview, #wildcardList button, #imageIntakePreviews';
  const translateNode = node => {
    const parent = node.parentElement;
    if (!parent || parent.closest(protectedSelector) || !node.nodeValue.trim()) return;
    const previous = original.get(node);
    const source = previous && previous.last === node.nodeValue ? previous.source : node.nodeValue;
    const structured = parent.closest('.result-meta-line, .viewer-meta-line, #imageViewerMeta, #summarySize, #importSummary span, #preciseReferenceWarning');
    const last = structured ? source.split(/( · | \/ )/).map(part => translateText(part)).join('') : translateText(source);
    original.set(node, { source, last });
    if (node.nodeValue !== last) node.nodeValue = last;
  };
  const visit = root => {
    if (root.nodeType === 3) { translateNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateNode(walker.currentNode);
    for (const element of [root, ...root.querySelectorAll('[title], [placeholder], [aria-label]')]) {
      if (!element.getAttribute || element.closest(protectedSelector)) continue;
      const stored = attributes.get(element) || {};
      for (const name of ['title', 'placeholder', 'aria-label']) {
        const current = element.getAttribute(name); if (!current) continue;
        const source = stored[name]?.last === current ? stored[name].source : current;
        const last = translateText(source); stored[name] = { source, last };
        if (current !== last) element.setAttribute(name, last);
      }
      attributes.set(element, stored);
    }
    for (const button of [...(root.matches?.('button') ? [root] : []), ...root.querySelectorAll('button')]) {
      if (deleteActions.has(button.id) || button.matches('[data-remove-character], [data-delete-preset], [data-dialog-character-delete], [data-delete-generation]')) {
        button.classList.add('danger-button', 'separated-delete');
        button.style.order = '99';
      }
    }
    for (const node of [...(root.matches?.('[data-category-label]') ? [root] : []), ...root.querySelectorAll('[data-category-label]')]) {
      const value = t(node.dataset.categoryLabel); if (node.textContent !== value) node.textContent = value;
    }
  };
  const select = document.createElement('select'); select.id = 'uiLanguage'; select.setAttribute('aria-label', 'Language');
  for (const [value, name] of [['ko', '한국어'], ['en', 'English'], ['ja', '日本語']]) {
    const option = new Option(name, value); option.dataset.noI18n = ''; select.append(option);
  }
  select.value = language; select.addEventListener('change', () => setLanguage(select.value));
  document.querySelector('.header-tools').prepend(select);
  document.addEventListener('chaessi:language-change', () => { select.value = language; visit(document.body); });
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(visit);
      else visit(record.target);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
  document.documentElement.lang = language; visit(document.body);
  return { refresh: () => visit(document.body) };
}
