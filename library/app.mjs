/* global document, window, localStorage, navigator, fetch, setTimeout, clearTimeout, HTMLElement, URLSearchParams */
import {compatible, normalizeSelection, createExports, shotSelectionWarning} from './selection.mjs';
import {isFixedStyle} from './style-policy.mjs';
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
const categoryOrder = ['全部镜头', '白板', '图解', '插画讲解', '标题', '文字', '证据', '结构', '关系', '交互', '时间与数据', '基础', '辅助动作', '换章转场'];
const featuredRecipes = ['blur-slide', 'paper-title', 'title-to-label', 'card-stack', 'source-converge', 'concept-matrix'];

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => {$('toast').hidden = true;}, 5000);
}
function persist() {
  try {localStorage.setItem(storageKey, JSON.stringify(state));}
  catch {
    // Carry only public selections between pages when browser storage is blocked.
    const query = new URLSearchParams({style: state.style, font: state.font, fontMode: state.fontMode, canvas: state.canvas, shots: state.selected.join(','), shotSelection: state.shotSelection, ...state.production, review: String(state.production.review)});
    for (const link of document.querySelectorAll('a[href]')) {
      const file = link.getAttribute('href').split('?')[0];
      if (['index.html', 'shots.html', 'selection.html'].includes(file)) link.setAttribute('href', `${file}?${query}`);
    }
  }
}
function renderStyles() {
  if (!$('styles')) return;
  stylePlayback?.stop();
  $('styles').innerHTML = catalog.styles.map((style, index) => {
    const info = styleCardInfo(style, catalog.recipes, state.canvas);
    const active = style.id === state.style;
    const colors = style.displayColors ?? [];
    return `${index === 0 || style.role !== catalog.styles[index - 1].role ? `<div class="style-group" style="grid-column:1/-1"><h2>${style.role === 'primary' ? 'AI 插画风格' : '图文动效风格'}</h2><p class="section-note">${style.role === 'primary' ? '文案与图解是主体，AI 插画辅助建立情境。白板逐笔展开，批注推演累积圈注，编辑式排印重组文字；提供真实截图时保留来源素材。' : '以文字排版、图形、图表与界面素材组织画面，通过镜头动效逐步呈现，也可使用真实图片和截图。'}</p></div>` : ''}<article class="style-card ${active ? 'active' : ''}" aria-labelledby="style-title-${escape(style.id)}">
      <div class="style-preview"><button class="style-poster" data-style-preview="${escape(style.id)}" aria-label="预览风格 ${escape(style.subtitle)} ${escape(style.name)}">
        <img src="${escape(style.poster)}" alt="${escape(style.subtitle)} 真实样片标题帧" width="960" height="540" loading="lazy">
        ${style.video ? `<video data-src="${escape(style.video)}" muted loop playsinline preload="none" aria-hidden="true"></video>` : ''}
        <span class="style-play-label"><span aria-hidden="true">▶</span> 查看样片 · ${style.role === 'primary' ? escape(catalog.fonts.find(font => font.id === style.recommendedFont)?.name ?? '推荐字体') : '原始字体'}</span></button>
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
    items.sort((a, b) => Number(compatible(b, state.style, state.canvas)) - Number(compatible(a, state.style, state.canvas)) || rank(a.id) - rank(b.id));
  }
  const key = JSON.stringify([state.style, state.canvas, state.selected, items.map(item => item.id)]);
  if (key === cardsKey) return;
  cardsKey = key;
  for (const video of $('cards').querySelectorAll('video')) releaseVideo(video);
  activePreview = undefined;
  $('cards').innerHTML = items.map((recipe, index) => {
    const item = recipePreview(recipe, state.style, state.canvas);
    const available = compatible(item, state.style, state.canvas);
    const selected = state.selected.includes(item.id);
    const status = item.kind !== 'scene' ? `${item.kind === 'hosted-action' ? `宿主：${item.hosts.join(' / ')}` : `独立换章窗口 · ${item.minSec}–${item.maxSec} 秒`}` : available ? '支持当前组合' : '当前风格或画幅不兼容';
    return `<article class="shot-card ${selected ? 'selected' : ''} ${available ? '' : 'incompatible'}" data-recipe="${escape(item.id)}">
      <div class="shot-preview"><button class="shot-poster" data-canvas="${escape(item.sampleCanvas)}" data-detail="${escape(item.id)}" aria-label="预览 ${escape(item.name)}">
        ${item.video ? `<video data-src="${escape(item.video)}" data-poster="${escape(item.poster)}" muted loop playsinline preload="none" width="960" height="540" aria-label="${escape(item.name)} 动态参考"></video>` : item.poster ? `<img src="${escape(item.poster)}" alt="${escape(item.name)} 配方示例画面" loading="lazy" width="960" height="540">` : `<span class="preview-unavailable"><strong>${previewStatusText(item)}</strong><span>可查看配方说明</span></span>`}<span class="shot-number">${String(index + 1).padStart(2, '0')}</span><span class="play-label">${item.video ? '查看动效与配方 ↗' : item.poster ? '查看画面与用法 ↗' : '查看配方说明 ↗'}</span></button>${item.video ? `<button class="preview-expand" data-fullscreen="${escape(item.id)}" aria-label="全屏播放 ${escape(item.name)}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg></button>` : ''}</div>
      <div class="shot-body"><p class="shot-category">${escape(item.category)}</p><h3>${escape(item.name)}</h3><p class="shot-id">${escape(item.id)}</p><p class="shot-desc">${escape(item.description)}</p><p class="shot-compat">${escape(status)}</p><div class="shot-actions">${item.kind === 'scene' && !isFixedStyle(state.style) ? `<label class="pick-label"><input type="checkbox" data-pick="${escape(item.id)}" aria-label="选择镜头 ${escape(item.name)}" ${selected ? 'checked' : ''} ${available ? '' : 'disabled'}>选择镜头</label>` : `<span class="section-note">${isFixedStyle(state.style) ? '风格内置流程 · 仅供参考' : '附属能力 · 不计入镜头集合'}</span>`}<button class="text-button" data-detail="${escape(item.id)}">配方说明</button></div></div></article>`;
  }).join('');
  $('empty').hidden = items.length > 0;
  observePreviews();
}
function renderExports() {
  if (!$('prompt')) return;
  const {goal, audio, ttsPreset, review, colorMode} = state.production;
  const fixed = isFixedStyle(state.style);
  $('shot-selection-section').hidden = fixed;
  $('brand-section').hidden = !fixed;
  $('brand-name').value = state.production.brandName;
  for (const input of document.querySelectorAll('input[name="shot-selection"]')) input.checked = input.value === state.shotSelection;
  $('manual-shots').hidden = state.shotSelection !== 'manual';
  $('auto-shots-note').hidden = state.shotSelection === 'manual';
  $('auto-shots-note').textContent = fixed ? '镜头随风格固定。提供文档后，Agent 按这一风格安排画面与时间，无需挑选镜头。' : '镜头由 Agent 读取文档后推荐。无需预先挑选，复制指令并附上文档即可。';
  const warning = shotSelectionWarning(catalog, state);
  $('shot-selection-warning').textContent = warning;
  $('shot-selection-warning').hidden = !warning;
  $('handoff-shot-summary').textContent = fixed ? '当前：使用风格内置流程。附上文档即可制作，镜头范围随风格固定。' : state.shotSelection === 'auto'
    ? '当前：根据文档推荐镜头组合。无需预选配方，Agent 读取文档后推荐并编排。'
    : `当前：仅使用已选的 ${state.selected.length} 个配方。可重复或只用其中一部分，不会自动添加其他配方。`;
  $('copy-prompt-label').textContent = fixed ? '复制制作指令' : state.shotSelection === 'auto' ? '复制自动编排指令' : '复制指定镜头指令';
  for (const input of document.querySelectorAll('input[name="goal"]')) input.checked = input.value === goal;
  for (const input of document.querySelectorAll('input[name="audio"]')) input.checked = input.value === audio;
  $('color-mode').value = colorMode;
  $('tts-preset').value = ttsPreset; $('review-first').checked = review;
  $('voice-section').hidden = goal === 'master'; $('master-note').hidden = goal !== 'master';
  $('tts-section').hidden = audio !== 'tts'; $('external-note').hidden = audio !== 'external';
  $('handoff-step').textContent = String((goal === 'master' ? 3 : 4) - (fixed ? 1 : 0));
  const visibleSteps = [...document.querySelectorAll('.wizard-card')].filter(card => !card.hidden);
  visibleSteps.forEach((card, index) => {const step = card.querySelector('.step-number'); if (step) step.textContent = String(index + 1);});
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
  $('production-summary').textContent = `${fixed ? '风格内置流程' : state.shotSelection === 'auto' ? '根据文档选镜头' : '使用手动镜头集合'} · ${goal === 'master' ? '仅画面 · 后期剪辑' : `带旁白的视频 · ${audio === 'external' ? '已有旁白' : preset?.name ?? '本地 TTS 配置'}`} · ${{auto: '自动配色', style: '风格配色', source: '产品素材配色'}[colorMode]} · ${review ? '先确认讲稿与分镜' : '直接制作，出片后复核'}`;
  try {
    const value = createExports(catalog, state);
    $('prompt').value = value.prompt; $('export-error').textContent = ''; $('copy-prompt').disabled = false;
  } catch (error) {
    $('prompt').value = '';
    $('prompt').placeholder = '选择自动推荐，或勾选兼容镜头后生成制作指令。';
    $('export-error').textContent = error.message;
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
  $('nav-count').textContent = isFixedStyle(state.style) ? '内置' : state.shotSelection === 'auto' ? '自动' : state.selected.length;
  if (document.body.dataset.page === 'selection') document.querySelector('.page-heading .eyebrow').textContent = `${isFixedStyle(state.style) ? '02' : '03'} / MAKE YOUR VIDEO`;
  for (const link of document.querySelectorAll('.page-nav a')) {
    if (link.getAttribute('href')?.startsWith('shots.html')) link.hidden = isFixedStyle(state.style);
    if (link.getAttribute('href')?.startsWith('selection.html')) link.querySelector('.nav-step').textContent = isFixedStyle(state.style) ? '02' : '03';
  }
  if ($('bar-count')) $('bar-count').textContent = document.body.dataset.page === 'styles' ? `已选风格：${style.name}` : isFixedStyle(state.style) ? '风格内置镜头 · 可直接制作' : state.shotSelection === 'auto' ? '根据文档自动选镜头' : state.selected.length ? `已选 ${state.selected.length} 个镜头` : '尚未选择手动镜头';
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
  if (isFixedStyle(state.style) && previous) toast('已切换至风格内置流程，无需手动镜头集合。');
  else if (state.selected.length < previous) toast(`已移除 ${previous - state.selected.length} 个不兼容镜头，请查看新的制作组合。`);
  renderStyles(); renderCards(); renderSelection();
  if (focusedStyle) document.querySelector(`[data-style="${focusedStyle}"]`)?.focus();
}
const detailView = createDetailView({
  canPickRecipe: () => !isFixedStyle(state.style),
  selected: (item, isStyle) => isStyle ? state.style === item.id : state.selected.includes(item.id),
  available: (item, isStyle) => isStyle || !isFixedStyle(state.style) && compatible(item, state.style, state.canvas),
  styleName: id => catalog.styles.find(style => style.id === id)?.name ?? id,
  onSelect: (item, isStyle) => {
    if (isStyle) switchCombination({style: item.id});
    else if (!isFixedStyle(state.style)) {state.shotSelection = 'manual'; state.selected = state.selected.includes(item.id) ? state.selected.filter(id => id !== item.id) : [...state.selected, item.id]; renderCards(); renderSelection();}
  },
  onVariant: (id, variantId) => {
    const item = catalog.recipes.find(item => item.id === id);
    const variant = recipePreview(item, state.style, state.canvas).previewVariants.find(variant => variant.id === variantId);
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
  let sample = {...(isStyle ? item : recipePreview(item, state.style, state.canvas)), previewNote: `${(isStyle && item.role === 'primary') || (!isStyle && (item.id.startsWith('illustrated-') || item.id === 'whiteboard-board')) ? `此组合样片使用 ${catalog.fonts.find(font => font.id === (isStyle ? item.recommendedFont : catalog.styles.find(style => style.id === state.style)?.recommendedFont))?.name ?? '推荐字体'}` : '此样片使用风格原始字体'}，展示构图与动效。所选全片字体用于实际制作，可在风格页查看字体组合样片。`};
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
  if (query.has('style')) state = normalizeSelection(catalog, {style: query.get('style'), font: query.get('font'), fontMode: query.get('fontMode'), canvas: query.get('canvas'), selected: (query.get('shots') ?? '').split(',').filter(Boolean), shotSelection: query.get('shotSelection'),
    production: query.has('goal') ? {goal: query.get('goal'), audio: query.get('audio'), ttsPreset: query.get('ttsPreset'), review: query.get('review') === 'true', colorMode: query.get('colorMode') ?? state.production.colorMode, brandName: query.get('brandName') ?? state.production.brandName} : {...state.production, ...(query.has('colorMode') ? {colorMode: query.get('colorMode')} : {}), ...(query.has('brandName') ? {brandName: query.get('brandName')} : {})}});
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
    if (isFixedStyle(state.style) || !id || !compatible(catalog.recipes.find(item => item.id === id), state.style, state.canvas)) return;
    state.shotSelection = 'manual';
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
    if (input.name === 'shot-selection') {if (isFixedStyle(state.style)) return; state.shotSelection = input.value; renderSelection(); return;}
    if (input.name === 'goal') state.production.goal = input.value;
    else if (input.name === 'audio') state.production.audio = input.value;
    else if (input.id === 'tts-preset') state.production.ttsPreset = input.value;
    else if (input.id === 'color-mode') state.production.colorMode = input.value;
    else if (input.id === 'brand-name') state.production.brandName = input.value.trim();
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
