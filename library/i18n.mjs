/* global document, window, navigator, localStorage, URL, NodeFilter, MutationObserver, queueMicrotask */
import {ui, formats} from './ui.en.mjs';

export const localeStorageKey = 'frame-loom-library-locale-v1';
let locale = 'zh';
export const getLocale = () => locale;
export function resolveLocale({query, saved, languages = []} = {}) {
  if (['zh', 'en'].includes(query)) return query;
  if (['zh', 'en'].includes(saved)) return saved;
  return languages[0]?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
export function translateUI(source, language = locale) {
  if (language !== 'en' || typeof source !== 'string') return source;
  const value = source.trim();
  let translated = ui[value];
  if (translated === undefined) {
    for (const [pattern, format] of formats) if (pattern.test(value)) {translated = value.replace(pattern, format); break;}
  }
  return translated === undefined ? source : source.replace(value, () => translated);
}

const originalContent = 'script, style, textarea, pre, .font-sample, #brand-summary, [data-original]';
function localizeDOM(root) {
  if (locale !== 'en') return;
  const texts = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (texts.nextNode()) {
    const node = texts.currentNode;
    if (!node.parentElement?.closest(originalContent)) {
      const translated = translateUI(node.data);
      if (translated !== node.data) node.data = translated;
    }
  }
  const elements = [root, ...root.querySelectorAll('[aria-label], [aria-valuetext], [title], [placeholder], img[alt]')];
  for (const element of elements) {
    if (element.closest('script, style, pre, [data-original], .font-sample, #brand-summary')) continue;
    for (const name of ['aria-label', 'aria-valuetext', 'title', 'placeholder', 'alt']) {
      const source = element.getAttribute(name);
      if (source !== null) {const value = translateUI(source); if (value !== source) element.setAttribute(name, value);}
    }
  }
}
function localeLinks() {
  for (const link of document.querySelectorAll('a[href]')) {
    if (link.getAttribute('href').startsWith('#')) continue;
    const target = new URL(link.getAttribute('href'), window.location.href);
    const file = target.pathname.split('/').at(-1);
    if (target.origin !== window.location.origin || !['index.html', 'shots.html', 'selection.html'].includes(file)) continue;
    target.searchParams.set('lang', locale);
    const value = `${file}${target.search}${target.hash}`;
    if (link.getAttribute('href') !== value) link.setAttribute('href', value);
  }
}
export function startLibraryI18n(onChange) {
  let saved;
  try {saved = localStorage.getItem(localeStorageKey);} catch { /* URL and browser language work without storage. */ }
  locale = resolveLocale({query: new URL(window.location.href).searchParams.get('lang'), saved, languages: navigator.languages ?? [navigator.language]});
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  document.documentElement.dataset.locale = locale;
  try {localStorage.setItem(localeStorageKey, locale);} catch { /* Keep the current locale in page links. */ }
  const switcher = document.createElement('div'); switcher.className = 'language-switch';
  switcher.setAttribute('role', 'group'); switcher.setAttribute('aria-label', locale === 'en' ? 'Interface language' : '界面语言');
  for (const [id, name] of [['zh', '中文'], ['en', 'EN']]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = name;
    button.dataset.locale = id; button.lang = id === 'zh' ? 'zh-CN' : 'en'; button.setAttribute('aria-pressed', String(locale === id));
    button.addEventListener('click', () => {
      if (id === locale) return;
      try {localStorage.setItem(localeStorageKey, id);} catch { /* Explicit URL locale takes priority. */ }
      onChange(id);
    });
    switcher.append(button);
  }
  document.querySelector('.masthead').append(switcher);
  const note = document.createElement('p'); note.className = 'locale-notice';
  note.textContent = 'Samples contain Chinese text. Interface language does not change the language or font of your video.';
  document.querySelector('.page-heading').after(note);
  const originalNote = document.createElement('p'); originalNote.className = 'locale-notice original-notice';
  originalNote.textContent = 'Original recipe notes and reusable motion recipes remain in Chinese. Production instructions are available in English.';
  document.querySelector('.detail-tabs').before(originalNote);
  for (const id of ['detail-portable-text', 'detail-source']) {
    const element = document.getElementById(id); element.dataset.original = ''; element.lang = 'zh-CN';
  }
  for (const sample of document.querySelectorAll('.font-sample')) sample.lang = 'zh-CN';
  localizeDOM(document.documentElement); localeLinks();
  // Localize only changed UI regions. Source prose, sample text, IDs and user inputs are excluded.
  const options = {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'aria-valuetext', 'title', 'placeholder', 'alt', 'href']};
  const roots = new Set(); let scheduled = false;
  const observer = new MutationObserver(records => {
    for (const record of records) {const root = record.target.nodeType === 1 ? record.target : record.target.parentElement; if (root) roots.add(root);}
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      observer.disconnect(); scheduled = false;
      for (const root of roots) if (root.isConnected) localizeDOM(root);
      roots.clear(); localeLinks(); observer.observe(document.documentElement, options);
    });
  });
  observer.observe(document.documentElement, options);
}
