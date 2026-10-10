/* global document, window, localStorage, navigator */
import {recipeDisplayText, previewStatusText} from './presentation.mjs';
import {releaseVideo} from './playback.mjs';

import {recipeSections, recipeOverview, portableRecipe} from './recipe-copy.mjs';
export {recipeSections, recipeOverview} from './recipe-copy.mjs';

const byId = id => document.getElementById(id);
function appendLines(parent, lines) {
  let list;
  for (const line of lines) {
    const isList = /^- /u.test(line);
    const element = document.createElement(isList ? 'li' : 'p'); element.textContent = line.replace(/^- /u, '');
    if (isList) {if (!list) {list = document.createElement('ul'); parent.append(list);} list.append(element);}
    else {list = null; parent.append(element);}
  }
}
function sectionBlock(parent, title, lines) {
  if (!lines.length) return;
  const section = document.createElement('section'); section.className = 'detail-info-section';
  const heading = document.createElement('h3'); heading.textContent = title; section.append(heading);
  appendLines(section, lines); parent.append(section);
}
const clock = seconds => `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, '0')}`;

export function createDetailView({selected, available, styleName, onSelect, onVariant, onToast, onClose}) {
  const dialog = byId('detail'); let current; let isStyle = false;
  const media = () => byId('detail-media').querySelector('video');
  function fitPortraitMedia() {
    const box = byId('detail-media');
    if (!dialog.open || box.dataset.canvas !== 'portrait') return;
    const stage = box.closest('.detail-stage'), css = window.getComputedStyle(stage);
    const innerWidth = stage.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    const controls = byId('detail-controls');
    const available = window.innerWidth >= 900
      ? stage.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) - (controls.hidden ? 0 : controls.offsetHeight) - 8
      : window.innerHeight * .6;
    const height = Math.min(Math.max(120, available), innerWidth * 16 / 9);
    box.style.setProperty('--portrait-preview-height', `${height}px`);
    box.style.setProperty('--portrait-preview-width', `${height * 9 / 16}px`);
  }
  window.addEventListener('resize', fitPortraitMedia);
  let saveProgress = () => {}; let disposeProgress = () => {};
  function clearMedia() {
    disposeProgress(); disposeProgress = () => {}; saveProgress = () => {};
    releaseVideo(media()); byId('detail-media').replaceChildren();
  }
  window.addEventListener('pagehide', () => saveProgress(true));
  function tab(name, focus = false) {
    for (const button of dialog.querySelectorAll('[data-detail-tab]')) {
      const active = button.dataset.detailTab === name;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
      byId(`detail-panel-${button.dataset.detailTab}`).hidden = !active;
      if (active && focus) button.focus();
    }
  }
  function syncPlayer() {
    const video = media(); if (!video) return;
    const ready = Number.isFinite(video.duration) && video.duration > 0;
    byId('detail-progress').disabled = !ready;
    byId('detail-progress').value = ready ? video.currentTime / video.duration * 100 : 0;
    byId('detail-progress').setAttribute('aria-valuetext', `${clock(video.currentTime)}，共 ${clock(video.duration)}`);
    byId('detail-time').textContent = `${clock(video.currentTime)} / ${clock(video.duration)}`;
    byId('detail-play').setAttribute('aria-label', video.paused ? '播放样片' : '暂停样片');
    byId('detail-play').firstElementChild.textContent = video.paused ? '▶' : 'Ⅱ';
  }
  function refreshSelection() {
    if (!current) return;
    const selectable = isStyle || current.kind === 'scene';
    const canSelect = available(current, isStyle); const isSelected = selected(current, isStyle);
    byId('detail-select').hidden = !selectable; byId('detail-select').disabled = !canSelect;
    byId('detail-select').setAttribute('aria-pressed', String(isSelected));
    byId('detail-select').textContent = !canSelect ? '当前组合不兼容' : isSelected ? (isStyle ? '✓ 已选风格' : '✓ 已选镜头') : isStyle ? '使用此风格' : '选择镜头';
    byId('detail-selection-note').textContent = isStyle ? '选择风格后，再挑选适合内容的镜头。' : !selectable ? (current.kind === 'hosted-action' ? '辅助动作依附于宿主镜头，由 Agent 按条件编排。' : '转场用于章节交接，不单独计入镜头集合。') : !canSelect ? '此镜头不支持当前风格或画幅，可调整组合后选择。' : isSelected ? '已加入制作组合，可重复使用。' : '按内容选择，Agent 会安排镜头顺序与时长。';
  }
  function show(item, style = false) {
    clearMedia(); current = item; isStyle = style;
    byId('detail-media').dataset.canvas = item.sampleCanvas ?? 'landscape';
    byId('detail-copy-status').textContent = '';
    dialog.querySelector('.detail-copy-fallback')?.remove();
    byId('detail-copy-id').textContent = style ? '复制风格 ID' : '复制镜头 ID';
    byId('detail-copy-guide').hidden = style; byId('detail-portable-preview').hidden = style;
    byId('detail-portable-preview').open = false;
    byId('detail-portable-text').textContent = style ? '' : portableRecipe(item);
    byId('detail-title').textContent = item.name; byId('detail-id').textContent = item.id;
    byId('detail-category').textContent = style ? '视频风格' : `${item.category} / ${item.kind === 'scene' ? '场景镜头' : item.kind === 'hosted-action' ? '辅助动作' : '换章转场'}`;
    byId('detail-description').textContent = item.description;
    byId('detail-facts').replaceChildren();
    for (const fact of [style ? item.name : styleName(item.sampleStyle), item.sampleCanvas === 'portrait' ? '9:16 竖屏' : '16:9 横屏', item.video ? '静音样片' : item.poster ? '静态参考' : previewStatusText(item)]) {
      const span = document.createElement('span'); span.textContent = fact; byId('detail-facts').append(span);
    }
    byId('detail-preview-note').textContent = !item.video && !item.poster ? `${previewStatusText(item)}，维护者需重新生成公开样片。配方说明与选择仍可使用。` : item.previewNote ?? (style ? '相同公开分镜，用于比较风格。' : item.video ? '实际渲染效果；公开示例仅供选型参考。' : '当前仅有静态参考，尚未生成动画样片。');
    const element = document.createElement(item.video ? 'video' : item.poster ? 'img' : 'div');
    if (item.video || item.poster) element.src = item.video ?? item.poster;
    else {element.className = 'preview-unavailable'; element.textContent = previewStatusText(item);}
    if (item.video) {
      element.poster = item.poster; element.muted = true; element.loop = true; element.playsInline = true; element.preload = 'metadata'; element.setAttribute('aria-label', `${item.name} 动态样片`);
      const key = `frame-loom-preview-position:${style ? 'style' : 'recipe'}:${item.variantId ?? item.id}`;
      let disposed = false; let lastSaved = Date.now();
      const save = (force = false) => {
        if (disposed || element.readyState < 1) return;
        const now = Date.now();
        if (!force && now - lastSaved < 2000) return;
        lastSaved = now;
        try {localStorage.setItem(key, String(element.currentTime));} catch { /* Storage is optional. */ }
      };
      saveProgress = save;
      disposeProgress = () => {save(true); disposed = true;};
      element.addEventListener('loadedmetadata', () => {
        if (disposed) return;
        try {const time = Number(localStorage.getItem(key)); if (Number.isFinite(time) && time >= 0 && time < element.duration) element.currentTime = time;} catch { /* Storage is optional. */ }
        syncPlayer();
      }, {once: true});
      for (const event of ['timeupdate', 'play', 'pause', 'ended', 'durationchange']) element.addEventListener(event, () => {if (!disposed) syncPlayer();});
      element.addEventListener('timeupdate', () => save());
      for (const event of ['pause', 'ended']) element.addEventListener(event, () => save(true));
      element.addEventListener('error', () => {if (!disposed) {byId('detail-controls').hidden = true; byId('detail-preview-note').textContent = '样片加载失败，请重新打开或查看静态参考。';}});
    } else if (item.poster) element.alt = `${item.name} 参考画面`;
    byId('detail-media').replaceChildren(element); byId('detail-controls').hidden = !item.video;
    byId('detail-progress').value = 0; byId('detail-progress').disabled = true; byId('detail-time').textContent = '0:00 / 0:00';
    const variants = byId('detail-variants'); variants.replaceChildren();
    const choices = !style ? item.previewVariants?.filter(v => v.video) ?? [] : [];
    variants.hidden = !choices.length;
    for (const choice of choices.length ? [{id: 'base', name: '默认效果'}, ...choices] : []) {
      const button = document.createElement('button'); button.className = 'variant-button'; button.textContent = choice.name;
      button.setAttribute('aria-pressed', String(choice.id === (item.variantId ?? 'base')));
      button.addEventListener('click', () => onVariant(item.id, choice.id)); variants.append(button);
    }
    byId('detail-overview').replaceChildren(); byId('detail-doc').replaceChildren(); byId('detail-attribution').replaceChildren();
    if (style) {
      sectionBlock(byId('detail-overview'), '适合的内容', item.bestFor ?? []);
      sectionBlock(byId('detail-overview'), '画面气质', item.mood ?? []);
      sectionBlock(byId('detail-doc'), '使用方式', ['在风格页选择此风格，再挑选兼容的镜头。公开样片只用于比较风格，制作时使用你提供的文档与素材。']);
      sectionBlock(byId('detail-attribution'), 'FrameLoom Style Pack', ['来自仓库的公开风格包与相同分镜样例。']);
      byId('detail-source').textContent = `风格：${item.id}\n来源：仓库公开 Style Pack。`;
    } else {
      const overview = recipeOverview(item.recipe);
      sectionBlock(byId('detail-overview'), '动效如何展开', overview.motion);
      sectionBlock(byId('detail-overview'), '使用要求', overview.input.map(line => line.replace(/^优先A式；/u, '').replace(/全部图层通过 slots.*$/u, '').trim()));
      if (item.hosts?.length) sectionBlock(byId('detail-overview'), '支持的宿主镜头', item.hosts);
      for (const section of recipeSections(item.recipe)) sectionBlock(byId('detail-doc'), section.title || '适用场景', section.lines);
      const source = item.provenance ?? {};
      sectionBlock(byId('detail-attribution'), source.repository ? '方法参考 · Video Shotcraft' : 'FrameLoom 原生配方', [source.recipe ?? '本项目公开语义渲染能力']);
      if (source.repository && /^https:\/\//u.test(source.repository)) {const link = document.createElement('a'); link.href = source.repository; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '查看参考项目 ↗'; byId('detail-attribution').append(link);}
      if (source.upstreamLicense) sectionBlock(byId('detail-attribution'), '许可记录', [`参考项目：${source.upstreamLicense}；本项目实现：${source.implementationLicense ?? '以仓库许可为准'}。`]);
      sectionBlock(byId('detail-attribution'), '使用边界', ['方法参考与独立实现不代表已取得上游媒体授权。示例只使用本项目公开素材。']);
      byId('detail-source').textContent = recipeDisplayText(JSON.stringify(source, (key, value) => /version/iu.test(key) ? undefined : value, 2));
    }
    byId('detail-panel-source').querySelector('details').open = false;
    tab('overview'); for (const panel of dialog.querySelectorAll('[role="tabpanel"]')) panel.scrollTop = 0;
    refreshSelection(); if (!dialog.open) dialog.showModal();
    window.requestAnimationFrame(fitPortraitMedia);
    if (item.video && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) element.play().catch(() => syncPlayer());
  }
  async function copyText(text, label) {
    const item = current;
    try {
      await navigator.clipboard.writeText(text);
      if (current === item && dialog.open) {dialog.querySelector('.detail-copy-fallback')?.remove(); byId('detail-copy-status').textContent = `${label}已复制`;}
    } catch {
      if (current !== item || !dialog.open) return;
      dialog.querySelector('.detail-copy-fallback')?.remove();
      const panel = dialog.querySelector('[role="tabpanel"]:not([hidden])');
      const wrapper = document.createElement('section'); wrapper.className = 'detail-copy-fallback';
      const hint = document.createElement('label'); hint.htmlFor = 'detail-manual-copy'; hint.textContent = '浏览器未允许复制，请复制下面已选中的文本。';
      const area = document.createElement('textarea'); area.id = 'detail-manual-copy'; area.readOnly = true; area.value = text; area.rows = 5;
      wrapper.append(hint, area); panel.prepend(wrapper); area.focus(); area.select();
      byId('detail-copy-status').textContent = '已选中文本，可手动复制';
    }
  }
  byId('detail-copy-id').addEventListener('click', () => {if (current) copyText(current.id, isStyle ? '风格 ID' : '镜头 ID');});
  byId('detail-copy-recipe').addEventListener('click', () => {if (current && !isStyle) copyText(portableRecipe(current), '动效配方');});
  byId('detail-select').addEventListener('click', () => {if (current && available(current, isStyle)) {onSelect(current, isStyle); refreshSelection();}});
  byId('detail-play').addEventListener('click', () => {const video = media(); if (video) {if (video.paused) video.play().catch(() => onToast('暂时无法播放样片，请重新打开。')); else video.pause();}});
  byId('detail-replay').addEventListener('click', () => {const video = media(); if (video) {video.currentTime = 0; video.play().catch(() => syncPlayer());}});
  byId('detail-progress').addEventListener('input', event => {const video = media(); if (video && Number.isFinite(video.duration)) {video.currentTime = Number(event.target.value) / 100 * video.duration; syncPlayer();}});
  byId('detail-fullscreen').addEventListener('click', () => {
    const player = dialog.querySelector('.detail-player');
    if (document.fullscreenElement === player) document.exitFullscreen().catch(() => onToast('暂时无法退出全屏，请使用浏览器全屏操作。'));
    else player.requestFullscreen?.().catch(() => onToast('浏览器未允许全屏播放。'));
  });
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement === dialog.querySelector('.detail-player');
    const label = active ? '退出全屏播放' : '全屏播放样片';
    byId('detail-fullscreen').setAttribute('aria-label', label); byId('detail-fullscreen').title = label;
  });
  dialog.addEventListener('cancel', event => {
    if (document.fullscreenElement && dialog.contains(document.fullscreenElement)) {event.preventDefault(); document.exitFullscreen().catch(() => {});}
  });
  for (const button of dialog.querySelectorAll('[data-detail-tab]')) {
    button.addEventListener('click', () => tab(button.dataset.detailTab));
    button.addEventListener('keydown', event => {
      const names = ['overview', 'guide', 'source']; const index = names.indexOf(button.dataset.detailTab);
      const next = {ArrowRight: names[(index + 1) % 3], ArrowLeft: names[(index + 2) % 3], Home: names[0], End: names[2]}[event.key];
      if (next) {event.preventDefault(); tab(next, true);}
    });
  }
  byId('detail-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (document.fullscreenElement && dialog.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {});
    clearMedia(); const item = current; current = undefined; onClose(item, isStyle);
  });
  return {show, refreshSelection};
}
