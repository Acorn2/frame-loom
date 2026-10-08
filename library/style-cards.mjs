/* global document, window */
import {compatible} from './selection.mjs';

const copy = {
  'retro-zine': {features: '中文宋体 · 杂志分栏 · 朱红印章', use: '观点、知识讲解、故事'},
  signal: {features: '石墨暗场 · 中央焦点 · 淡紫强调', use: '核心观点、转折、重点说明'},
  scatterbrain: {features: '黄色便签 · 中文楷体 · 手绘批注', use: '学习笔记、方法拆解'},
  'archive-grid': {features: '克莱因蓝 · 直角色块 · 强字号对比', use: '报告、分析、方法论'},
  'signal-noir': {features: '模块网格 · 等宽标注 · 琥珀路由', use: '技术机制、系统流程'},
  'studio-frame': {features: '冷灰工作台 · 界面层次 · 绿色状态', use: '产品说明、操作步骤、更新'}
};
export function styleCardInfo(style, recipes, canvas) {
  const scenes = recipes.filter(recipe => compatible(recipe, style.id, canvas));
  const count = scenes.length;
  return {...copy[style.id], count, capability: count === 1 && scenes[0].id === 'semantic-default' ? '1 个基础镜头' : `${count} 个可用镜头`, basicOnly: count === 1 && scenes[0].id === 'semantic-default'};
}

// Only one card plays at a time. Video bytes are loaded on interaction, not page load.
export function createStyleCardPlayback(container, reducedMotion) {
  let active;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  function stop() {
    if (!active) return;
    const video = active.querySelector('video');
    video?.pause(); active.classList.remove('playing'); active = undefined;
  }
  function start(button) {
    if (!button || reducedMotion.matches || document.hidden || document.getElementById('detail').open) return;
    if (active === button) return;
    stop(); const video = button.querySelector('video'); if (!video) return;
    active = button;
    if (!video.getAttribute('src')) {video.src = video.dataset.src; video.load();}
    // Do not expose an empty or loading frame over the poster.
    video.play().then(() => {if (active === button) button.classList.add('playing'); else video.pause();}).catch(() => {if (active === button) stop();});
  }
  container.addEventListener('pointerover', event => {
    if (finePointer.matches && event.pointerType !== 'touch') start(event.target.closest('.style-poster'));
  });
  container.addEventListener('pointerout', event => {
    const button = event.target.closest('.style-poster');
    if (button === active && !button.contains(event.relatedTarget) && document.activeElement !== button) stop();
  });
  container.addEventListener('focusin', event => start(event.target.closest('.style-poster')));
  container.addEventListener('focusout', event => {if (event.target.closest('.style-poster') === active) stop();});
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
  reducedMotion.addEventListener('change', stop);
  return {stop};
}
