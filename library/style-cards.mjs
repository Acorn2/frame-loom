/* global document, window, navigator, setTimeout, clearTimeout */
import {compatible} from './selection.mjs';
import {releaseVideo} from './playback.mjs';

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

// Hover intent avoids downloading videos while the pointer travels across the grid.
export function createStyleCardPlayback(container, reducedMotion) {
  let active; let pending; let timer; let generation = 0;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  function stop() {
    clearTimeout(timer); pending = undefined; generation++;
    if (!active) return;
    const video = active.querySelector('video');
    // Removing src also cancels an in-flight download/play request.
    releaseVideo(video);
    active.classList.remove('playing'); active = undefined;
  }
  function start(button) {
    if (!button || !finePointer.matches || navigator.connection?.saveData || reducedMotion.matches || document.hidden || document.getElementById('detail').open) return;
    if ((active === button && !button.querySelector('video')?.paused) || pending === button) return;
    stop(); pending = button;
    const request = generation;
    timer = setTimeout(() => {
      if (pending !== button || request !== generation) return;
      pending = undefined;
      const video = button.querySelector('video'); if (!video) return;
      active = button; video.src = video.dataset.src; video.load();
      // Do not expose an empty or loading frame over the poster.
      video.play().then(() => {
        if (active === button && request === generation && !video.paused) button.classList.add('playing');
        else if (active !== button) video.pause();
      }).catch(() => {if (active === button && request === generation) stop();});
    }, 250);
  }
  container.addEventListener('pointerover', event => {
    if (event.pointerType !== 'touch') start(event.target.closest('.style-poster'));
  });
  container.addEventListener('pointerout', event => {
    const button = event.target.closest('.style-poster');
    if ((button === active || button === pending) && !button.contains(event.relatedTarget) && document.activeElement !== button) stop();
  });
  container.addEventListener('focusin', event => start(event.target.closest('.style-poster')));
  container.addEventListener('focusout', event => {
    const button = event.target.closest('.style-poster');
    if ((button === active || button === pending) && !button.contains(event.relatedTarget)) stop();
  });
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
  reducedMotion.addEventListener('change', stop);
  finePointer.addEventListener('change', stop);
  navigator.connection?.addEventListener('change', stop);
  return {stop};
}
