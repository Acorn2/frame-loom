/* global document, window, localStorage, navigator, fetch, setTimeout, clearTimeout, HTMLElement, URLSearchParams */
import {compatible, normalizeSelection, createExports} from './selection.mjs';
import {enhanceDropdowns, syncDropdowns} from './dropdown.mjs';
import {styleCardInfo, createStyleCardPlayback} from './style-cards.mjs';
import {createDetailView} from './detail.mjs';
import {recipePreview, previewStatusText} from './presentation.mjs';
import {createFontPicker} from './font-picker.mjs';
import {createPlaybackCoordinator, releaseVideo} from './playback.mjs';

createPlaybackCoordinator();

const $ = (id) => document.getElementById(id);
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const storageKey = 'frame-loom-library-selection-v1';
let catalog; let state; let category = '全部镜头'; let toastTimer; let fontPicker; let searchTimer; let cardsKey;
const categoryOrder = ['全部镜头', '标题', '文字', '证据', '结构', '关系', '时间与数据', '基础', '辅助动作', '换章转场'];
const featuredRecipes = ['blur-slide', 'paper-title', 'title-to-label', 'card-stack', 'source-converge', 'concept-matrix'];

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => {$('toast').hidden = true;}, 5000);
}
function persist() {
  try {localStorage.setItem(storageKey, JSON.stringify(state));}
  catch {
    // Carry only public selections between pages when browser storage is blocked.
    const query = new URLSearchParams({style: state.style, font: state.font, fontMode: state.fontMode, canvas: state.canvas, shots: state.selected.join(','), ...state.production, review: String(state.production.review)});
    for (const link of document.querySelectorAll('a[href]')) {
      const file = link.getAttribute('href').split('?')[0];
      if (['index.html', 'shots.html', 'selection.html'].includes(file)) link.setAttribute('href', `${file}?${query}`);
    }
  }
}
function renderStyles() {
  if (!$('styles')) return;
  stylePlayback?.stop();
  $('styles').innerHTML = catalog.styles.map(style => {
    const info = styleCardInfo(style, catalog.recipes, state.canvas);
    const active = style.id === state.style;
    const colors = style.displayColors ?? [];
    return `<article class="style-card ${active ? 'active' : ''}" aria-labelledby="style-title-${escape(style.id)}">
      <div class="style-preview"><button class="style-poster" data-style-preview="${escape(style.id)}" aria-label="预览风格 ${escape(style.subtitle)} ${escape(style.name)}">
        <img src="${escape(style.poster)}" alt="${escape(style.subtitle)} 真实样片标题帧" width="960" height="540" loading="lazy">
        ${style.video ? `<video data-src="${escape(style.video)}" muted loop playsinline preload="none" aria-hidden="true"></video>` : ''}
        <span class="style-play-label"><span aria-hidden="true">▶</span> 查看样片 · 原始字体</span></button>
        ${active ? '<span class="style-selected"><span aria-hidden="true">✓</span> 已选</span>' : ''}</div>
      <div class="style-body"><div class="style-title-row"><div><h2 id="style-title-${escape(style.id)}" class="style-name">${escape(style.subtitle)}</h2><p class="style-subtitle" lang="en">${escape(style.name)}</p></div>
        <div class="style-swatch" role="img" aria-label="${escape(colors.map(c => `${c.role} ${c.color}`).join('，'))}">${colors.map(c => `<span style="background:${escape(c.color)}" title="${escape(c.role)}：${escape(c.color)}"></span>`).join('')}</div></div>
      <p class="style-features">${escape(info.features ?? style.description)}</p><p class="style-use"><span>适合</span>${escape(info.use ?? '文档讲解')}</p>
      <div class="style-foot"><p class="style-capability ${info.basicOnly ? 'basic-only' : ''}" title="当前${state.canvas === 'landscape' ? '横屏' : '竖屏'}兼容场景，不含辅助动作与转场。${info.basicOnly ? '当前仅支持基础图解与收尾。' : ''}"><span aria-hidden="true">${info.basicOnly ? '○' : '◉'}</span> ${escape(info.capability)}</p>
        <button class="style-pick" data-style="${escape(style.id)}" aria-pressed="${active}" aria-label="${active ? '已选风格' : '选择风格'} ${escape(style.subtitle)} ${escape(style.name)}">${active ? '已选用 ✓' : '使用此风格'}</button></div></div></article>`;
  }).join('');
}
function renderCategories() {
  if (!$('categories')) return;
  $('categories').innerHTML = categoryOrder.map(name => {
    const items = catalog.recipes.filter(item => name === '全部镜头' ? item.kind === 'scene' : item.category === name);
    return `<button class="category ${category === name ? 'active' : ''}" data-category="${escape(name)}" aria-pressed="${category === name}">${escape(name)}<small>${items.length}</small></button>`;
  }).join('');
}
let previewObserver; let posterObserver; let activePreview;
const visibleVideos = new Map();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
function updatePreviewPlayback() {
  const allowed = !reducedMotion.matches && finePointer.matches && !navigator.connection?.saveData;
  const available = !document.hidden && !$('detail').open;
  const manual = [...document.querySelectorAll('.shot-poster video')].find(video => video.controls);
  const next = available ? manual ?? (allowed ? [...visibleVideos].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined) : undefined;
  if (activePreview === next) return;
  const previous = activePreview;
  activePreview = next;
  releaseVideo(previous);
  if (next) {
    if (!next.getAttribute('src')) {next.src = next.dataset.src; next.load();}
    next.play().then(() => {if (activePreview !== next) next.pause();}).catch(() => {});
  }
}
function observePreviews() {
  previewObserver?.disconnect(); posterObserver?.disconnect(); visibleVideos.clear();
  // Native video posters load eagerly, so assign them only near the viewport.
  posterObserver = new window.IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      if (!isIntersecting) continue;
      target.poster = target.dataset.poster; posterObserver.unobserve(target);
    }
  }, {rootMargin: '180px 0px'});
  previewObserver = new window.IntersectionObserver(entries => {
    for (const {target, isIntersecting, intersectionRatio} of entries) {
      if (isIntersecting && intersectionRatio >= .55) visibleVideos.set(target, intersectionRatio);
      else visibleVideos.delete(target);
    }
    updatePreviewPlayback();
  }, {rootMargin: '0px', threshold: [0, .55, .75, 1]});
  for (const video of document.querySelectorAll('.shot-poster video')) {
    posterObserver.observe(video); previewObserver.observe(video);
  }
  updatePreviewPlayback();
}
const stylePlayback = $('styles') ? createStyleCardPlayback($('styles'), reducedMotion) : null;
reducedMotion.addEventListener('change', updatePreviewPlayback);
finePointer.addEventListener('change', updatePreviewPlayback);
navigator.connection?.addEventListener('change', updatePreviewPlayback);
document.addEventListener('visibilitychange', updatePreviewPlayback);
function renderCards() {
  clearTimeout(searchTimer);
  if (!$('cards')) return;
  const query = $('search').value.trim().toLowerCase();
  const scenes = catalog.recipes.filter(item => item.kind === 'scene');
  const count = scenes.filter(item => compatible(item, state.style, state.canvas)).length;
  const style = catalog.styles.find(item => item.id === state.style);
  $('compatibility').textContent = `${style.name} · ${state.canvas === 'landscape' ? '16:9 横屏' : '9:16 竖屏'}：${count} 个可选场景配方。${count === 1 ? '当前只有基础语义配方支持此组合；其他镜头仍可查看参考效果。' : '可自由搭配当前风格；辅助动作与转场请在独立分类中查看。'}`;
  const items = catalog.recipes.filter(item => (category === '全部镜头' ? item.kind === 'scene' : item.category === category)
    && (!query || `${item.name} ${item.id} ${item.description} ${item.purpose ?? ''} ${item.styles.join(' ')}`.toLowerCase().includes(query))
    && (!$('compatible-only').checked || (item.kind === 'scene' ? compatible(item, state.style, state.canvas) : item.styles.includes(state.style) && item.orientations.includes(state.canvas))));
  if (category === '全部镜头') {
    const rank = id => featuredRecipes.includes(id) ? featuredRecipes.indexOf(id) : featuredRecipes.length;
    items.sort((a, b) => rank(a.id) - rank(b.id));
  }
  const key = JSON.stringify([state.style, state.canvas, state.selected, items.map(item => item.id)]);
  if (key === cardsKey) return;
  cardsKey = key;
  for (const video of $('cards').querySelectorAll('video')) releaseVideo(video);
  activePreview = undefined;
  $('cards').innerHTML = items.map((recipe, index) => {
    const item = recipePreview(recipe, state.style);
    const available = compatible(item, state.style, state.canvas);
    const selected = state.selected.includes(item.id);
    const status = item.kind !== 'scene' ? `${item.kind === 'hosted-action' ? `宿主：${item.hosts.join(' / ')}` : `独立换章窗口 · ${item.minSec}–${item.maxSec} 秒`}` : available ? '支持当前组合' : '当前风格或画幅不兼容';
    return `<article class="shot-card ${selected ? 'selected' : ''} ${available ? '' : 'incompatible'}" data-recipe="${escape(item.id)}">
      <div class="shot-preview"><button class="shot-poster" data-detail="${escape(item.id)}" aria-label="预览 ${escape(item.name)}">
        ${item.video ? `<video data-src="${escape(item.video)}" data-poster="${escape(item.poster)}" muted loop playsinline preload="none" width="960" height="540" aria-label="${escape(item.name)} 动态参考"></video>` : item.poster ? `<img src="${escape(item.poster)}" alt="${escape(item.name)} 配方示例画面" loading="lazy" width="960" height="540">` : `<span class="preview-unavailable"><strong>${previewStatusText(item)}</strong><span>可查看配方说明</span></span>`}<span class="shot-number">${String(index + 1).padStart(2, '0')}</span><span class="play-label">${item.video ? '查看动效与配方 ↗' : item.poster ? '查看画面与用法 ↗' : '查看配方说明 ↗'}</span></button>${item.video ? `<button class="preview-expand" data-fullscreen="${escape(item.id)}" aria-label="全屏播放 ${escape(item.name)}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg></button>` : ''}</div>
      <div class="shot-body"><p class="shot-category">${escape(item.category)}</p><h3>${escape(item.name)}</h3><p class="shot-id">${escape(item.id)}</p><p class="shot-desc">${escape(item.description)}</p><p class="shot-compat">${escape(status)}</p><div class="shot-actions">${item.kind === 'scene' ? `<label class="pick-label"><input type="checkbox" data-pick="${escape(item.id)}" aria-label="选择镜头 ${escape(item.name)}" ${selected ? 'checked' : ''} ${available ? '' : 'disabled'}>选择镜头</label>` : '<span class="section-note">附属能力 · 不计入镜头集合</span>'}<button class="text-button" data-detail="${escape(item.id)}">配方说明</button></div></div></article>`;
  }).join('');
  $('empty').hidden = items.length > 0;
  observePreviews();
}
function renderExports() {
  if (!$('prompt')) return;
  const {goal, audio, ttsPreset, review} = state.production;
  for (const input of document.querySelectorAll('input[name="goal"]')) input.checked = input.value === goal;
  for (const input of document.querySelectorAll('input[name="audio"]')) input.checked = input.value === audio;
  $('tts-preset').value = ttsPreset; $('review-first').checked = review;
  $('voice-section').hidden = goal === 'master'; $('master-note').hidden = goal !== 'master';
  $('tts-section').hidden = audio !== 'tts'; $('external-note').hidden = audio !== 'external';
  $('handoff-step').textContent = goal === 'master' ? '2' : '3';
  const preset = catalog.ttsPresets.find(item => item.id === ttsPreset);
  $('tts-summary').replaceChildren();
  if (preset) {
    for (const [label, value] of [['服务', preset.name], ['模型', preset.model ?? '沿用本地服务配置'], ['音色', preset.voice ?? '使用本地配置的音色']]) {
      const item = document.createElement('div'); const name = document.createElement('span'); const text = document.createElement('strong');
      name.textContent = label; text.textContent = value; item.append(name, text); $('tts-summary').append(item);
    }
  } else {
    const note = document.createElement('p'); note.textContent = 'Agent 读取本地已启用配置：只有一个时直接使用；多个时列出服务、模型与音色供你选择。'; $('tts-summary').append(note);
  }
  $('production-summary').textContent = `${goal === 'master' ? '仅画面 · 后期剪辑' : `带旁白的视频 · ${audio === 'external' ? '已有旁白' : preset?.name ?? '本地 TTS 配置'}`} · ${review ? '先确认讲稿与分镜' : '直接制作，出片后复核'}`;
  try {
    const value = createExports(catalog, state);
    $('prompt').value = value.prompt; $('export-error').textContent = ''; $('copy-prompt').disabled = false;
  } catch (error) {
    $('prompt').value = '';
    $('prompt').placeholder = '选好镜头后，这里会生成可直接给 Agent 的制作指令。';
    $('export-error').textContent = state.selected.length ? error.message : '请先勾选至少一个镜头。';
    $('copy-prompt').disabled = true;
  }
  syncDropdowns();
}
function renderSelection(save = true) {
  const style = catalog.styles.find(item => item.id === state.style);
  const font = catalog.fonts.find(item => item.id === state.font);
  fontPicker?.render(state);
  if ($('current-font')) $('current-font').textContent = `全片字体：${font.name}`;
  if ($('font-selection-note')) $('font-selection-note').textContent = `当前风格：${style.subtitle} · ${state.fontMode === 'recommended' ? '使用推荐字体' : '已手动选择字体'} · ${font.name}`;
  if ($('font-recommended')) $('font-recommended').disabled = state.fontMode === 'recommended';
  if ($('font-preview-label')) $('font-preview-label').textContent = `${style.subtitle} · ${font.name}`;
  const fontPreview = $('font-preview-media');
  const previewKey = `${state.style}--${state.font}`;
  if (fontPreview && fontPreview.dataset.key !== previewKey) {
    releaseVideo(fontPreview.querySelector('video')); fontPreview.replaceChildren(); fontPreview.dataset.key = previewKey;
    const sample = catalog.fontPreviews.find(item => item.style === state.style && item.font === state.font);
    if (sample?.video && sample.poster) {
      const play = document.createElement('button'); play.type = 'button'; play.className = 'font-preview-play';
      play.setAttribute('aria-label', `播放${style.subtitle}与${font.name}的实际字体组合样片`);
      const poster = document.createElement('img'); poster.src = sample.poster; poster.alt = ''; poster.loading = 'lazy';
      const icon = document.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = '▶';
      play.append(poster, icon); fontPreview.append(play);
      play.addEventListener('click', () => {
        const video = document.createElement('video'); video.src = sample.video; video.poster = sample.poster;
        video.controls = true; video.muted = true; video.playsInline = true; video.preload = 'none';
        video.setAttribute('aria-label', `${style.subtitle}与${font.name}的实际字体组合样片`);
        fontPreview.replaceChildren(video); video.play().catch(() => {});
      });
    } else {
      const note = document.createElement('p'); note.textContent = '当前组合样片待生成或更新；仍可选择字体用于制作'; fontPreview.append(note);
    }
  }
  if ($('selected-count')) $('selected-count').textContent = `${state.selected.length} 个`;
  $('nav-count').textContent = state.selected.length;
  if ($('bar-count')) $('bar-count').textContent = document.body.dataset.page === 'styles' ? `已选风格：${style.name}` : state.selected.length ? `已选 ${state.selected.length} 个镜头` : '尚未选择镜头';
  if ($('bar-style')) $('bar-style').textContent = `${style.subtitle} · ${font.name} · ${state.canvas === 'landscape' ? '16:9 横屏' : '9:16 竖屏'}`;
  if ($('current-style')) $('current-style').textContent = style.name;
  if ($('selected-style-poster')) $('selected-style-poster').src = style.poster;
  if ($('selected-list')) $('selected-list').innerHTML = state.selected.length ? state.selected.map(id => {
    const item = catalog.recipes.find(item => item.id === id);
    return `<button class="selected-chip" data-remove="${escape(id)}" aria-label="移除镜头 ${escape(item.name)}">${escape(item.name)}<span aria-hidden="true">×</span></button>`;
  }).join('') : '<p class="selected-empty">还没有选择镜头。前往镜头配方页，挑选适合原文的表达方式。</p>';
  if ($('clear')) $('clear').disabled = state.selected.length === 0;
  renderExports(); syncDropdowns(); detailView.refreshSelection(); if (save) persist();
}
function switchCombination(next) {
  const focusedStyle = document.activeElement?.dataset.style;
  const previous = state.selected.length;
  state = normalizeSelection(catalog, {...state, ...next});
  if (state.selected.length < previous) toast(`已移除 ${previous - state.selected.length} 个不兼容镜头，请查看新的制作组合。`);
  renderStyles(); renderCards(); renderSelection();
  if (focusedStyle) document.querySelector(`[data-style="${focusedStyle}"]`)?.focus();
}
const detailView = createDetailView({
  selected: (item, isStyle) => isStyle ? state.style === item.id : state.selected.includes(item.id),
  available: (item, isStyle) => isStyle || compatible(item, state.style, state.canvas),
  styleName: id => catalog.styles.find(style => style.id === id)?.name ?? id,
  onSelect: (item, isStyle) => {
    if (isStyle) switchCombination({style: item.id});
    else {state.selected = state.selected.includes(item.id) ? state.selected.filter(id => id !== item.id) : [...state.selected, item.id]; renderCards(); renderSelection();}
  },
  onVariant: (id, variantId) => {
    const item = catalog.recipes.find(item => item.id === id);
    const variant = recipePreview(item, state.style).previewVariants.find(variant => variant.id === variantId);
    showDetail({...item, variantId: variant?.id});
  },
  onToast: toast,
  onClose: (item, isStyle) => {
    updatePreviewPlayback();
    if (item) document.querySelector(`[data-${isStyle ? 'style-preview' : 'detail'}="${item.id}"]`)?.focus();
  }
});
function showDetail(item, isStyle = false) {
  stylePlayback?.stop();
  let sample = {...(isStyle ? item : recipePreview(item, state.style)), previewNote: '此样片使用风格原始字体，展示构图与动效。所选全片字体用于实际制作，可在风格页查看字体组合样片。'};
  const variant = sample.previewVariants?.find(v => v.id === item.variantId);
  if (variant) sample = {...sample, poster: variant.poster, video: variant.video, previewStatus: variant.previewStatus};
  detailView.show(sample, isStyle); updatePreviewPlayback();
}
async function copy(id) {
  const area = $(id);
  try {await navigator.clipboard.writeText(area.value); toast('制作指令已复制。粘贴到 Agent，并附上文档即可开始。');}
  catch {$('prompt-details').open = true; area.focus(); area.select(); toast('浏览器未允许复制，已展开并选中文本，请手动复制。');}
}
async function start() {
  const response = await fetch('catalog.json');
  if (!response.ok) throw new Error('无法加载配方清单，请重新运行 npm run library。');
  catalog = await response.json();
  let saved;
  try {saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}');} catch {saved = {};}
  state = normalizeSelection(catalog, saved ?? {});
  const query = new URLSearchParams(window.location.search);
  if (query.has('style')) state = normalizeSelection(catalog, {style: query.get('style'), font: query.get('font'), fontMode: query.get('fontMode'), canvas: query.get('canvas'), selected: (query.get('shots') ?? '').split(','),
    production: query.has('goal') ? {goal: query.get('goal'), audio: query.get('audio'), ttsPreset: query.get('ttsPreset'), review: query.get('review') === 'true'} : state.production});
  if ($('tts-preset')) {
    for (const preset of catalog.ttsPresets) {const option = document.createElement('option'); option.value = preset.id; option.textContent = `${preset.name} · 项目内置预设`; $('tts-preset').append(option);}
  }
  $('canvas').value = state.canvas;
  if ($('catalog-count')) $('catalog-count').textContent = `${catalog.recipes.filter(item => item.kind === 'scene').length} 场景`;
  fontPicker = createFontPicker($('fonts'), catalog, font => {
    state = normalizeSelection(catalog, {...state, font, fontMode: 'manual'}); renderSelection();
  });
  $('font-recommended')?.addEventListener('click', () => {state = normalizeSelection(catalog, {...state, fontMode: 'recommended'}); renderSelection();});
  renderStyles(); renderCategories(); renderCards(); renderSelection();
  enhanceDropdowns();
  if (window.location.hash === '#search') $('search')?.focus();
  document.addEventListener('click', event => {
    if (!(event.target instanceof window.Element)) return;
    const element = event.target.closest('button');
    if (!element) return;
    if (element.dataset.style) switchCombination({style: element.dataset.style});
    if (element.dataset.stylePreview) showDetail(catalog.styles.find(item => item.id === element.dataset.stylePreview), true);
    if (element.dataset.category) {category = element.dataset.category; renderCategories(); renderCards();}
    if (element.dataset.fullscreen) {
      const video = element.closest('.shot-preview').querySelector('video');
      video.controls = true; updatePreviewPlayback();
      // Retry under the user gesture if the browser declined automatic playback.
      if (video.paused) video.play().catch(() => {});
      if (video.requestFullscreen) video.requestFullscreen().catch(() => {video.controls = false; updatePreviewPlayback(); toast('浏览器未允许全屏，请点击卡片查看大图预览。');});
      else showDetail(catalog.recipes.find(item => item.id === element.dataset.fullscreen));
    }
    if (element.dataset.detail) showDetail(catalog.recipes.find(item => item.id === element.dataset.detail));
    if (element.dataset.remove) {state.selected = state.selected.filter(id => id !== element.dataset.remove); renderCards(); renderSelection();}
  });
  $('cards')?.addEventListener('change', event => {
    const id = event.target.dataset.pick;
    if (!id || !compatible(catalog.recipes.find(item => item.id === id), state.style, state.canvas)) return;
    state.selected = event.target.checked ? [...new Set([...state.selected, id])] : state.selected.filter(item => item !== id);
    event.target.closest('.shot-card').classList.toggle('selected', event.target.checked); renderSelection();
  });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    let saved;
    try {saved = JSON.parse(event.newValue ?? '{}');} catch {saved = {};}
    state = normalizeSelection(catalog, saved ?? {});
    $('canvas').value = state.canvas;
    renderStyles(); renderCards(); renderSelection(false);
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    let saved;
    try {saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}');} catch {saved = {};}
    state = normalizeSelection(catalog, saved ?? {});
    $('canvas').value = state.canvas;
    renderStyles(); renderCards(); renderSelection(false);
  });
  $('canvas').addEventListener('change', () => switchCombination({canvas: $('canvas').value}));
  let composing = false;
  const search = $('search');
  function scheduleSearch(event) {
    clearTimeout(searchTimer);
    if (composing || event?.isComposing) return;
    if (!search.value.trim()) renderCards();
    else searchTimer = setTimeout(renderCards, 150);
  }
  search?.addEventListener('input', scheduleSearch);
  search?.addEventListener('compositionstart', () => {composing = true; clearTimeout(searchTimer);});
  search?.addEventListener('compositionend', () => {composing = false; scheduleSearch();});
  search?.addEventListener('keydown', event => {if (event.key === 'Enter' && !composing && !event.isComposing) renderCards();});
  $('compatible-only')?.addEventListener('change', renderCards);
  document.querySelector('.export-main')?.addEventListener('change', event => {
    const input = event.target;
    if (input.name === 'goal') state.production.goal = input.value;
    else if (input.name === 'audio') state.production.audio = input.value;
    else if (input.id === 'tts-preset') state.production.ttsPreset = input.value;
    else if (input.id === 'review-first') state.production.review = input.checked;
    else return;
    renderExports(); persist();
  });
  $('clear')?.addEventListener('click', () => {state.selected = []; renderCards(); renderSelection();});
  $('copy-prompt')?.addEventListener('click', () => copy('prompt'));
  document.addEventListener('fullscreenchange', () => {if (!document.fullscreenElement) {for (const video of document.querySelectorAll('.shot-poster video')) video.controls = false; updatePreviewPlayback();}});
  document.addEventListener('keydown', event => {if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !$('detail').open) {event.preventDefault(); if (!$('search')) {window.location.href = `${document.querySelector('.page-nav a[href^="shots.html"]').getAttribute('href')}#search`; return;} $('search').focus();}});
}
start().catch(error => {const message = document.createElement('p'); message.className = 'fatal'; message.textContent = `配方库加载失败：${error.message}`; document.querySelector('main').replaceChildren(message);});
