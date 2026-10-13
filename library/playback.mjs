/* global document, window, navigator, setTimeout, clearTimeout */

let observer;
export function releaseVideo(video) {
  if (!video) return;
  observer?.unobserve(video);
  video.pause(); video.removeAttribute('src'); video.load();
}

// Shared by style and shot cards: preview the user's target, not another visible card.
export function createCardPreviewPlayback(container, reducedMotion, selector = '.style-poster') {
  let active; let pending; let timer; let generation = 0;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  function stop() {
    clearTimeout(timer); pending = undefined; generation++;
    const previous = active; active = undefined;
    if (!previous) return;
    previous.classList.remove('playing');
    const video = previous.querySelector('video');
    if (video) video.controls = false;
    releaseVideo(video);
  }
  function load(button) {
    const video = button.querySelector('video');
    if (!video?.dataset.src) return;
    active = button;
    const request = generation;
    video.src = video.dataset.src; video.load();
    video.play().then(() => {
      if (active === button && request === generation && !video.paused) button.classList.add('playing');
      else if (active !== button) video.pause();
    }).catch(() => {if (active === button && request === generation) stop();});
  }
  function start(button) {
    if (!button?.querySelector('video') || !finePointer.matches || navigator.connection?.saveData || reducedMotion.matches || document.hidden || document.getElementById('detail').open) return;
    if ((active === button && !button.querySelector('video').paused) || pending === button) return;
    if (active?.querySelector('video')?.controls) return;
    stop(); pending = button;
    const request = generation;
    timer = setTimeout(() => {
      if (pending !== button || request !== generation) return;
      pending = undefined; load(button);
    }, 250);
  }
  function leave(button, nextTarget) {
    if ((button === active || button === pending) && !button.contains(nextTarget)
      && document.activeElement !== button && !button.querySelector('video')?.controls) stop();
  }
  container.addEventListener('pointerover', event => {
    if (event.pointerType !== 'touch') start(event.target.closest(selector));
  });
  container.addEventListener('pointerout', event => leave(event.target.closest(selector), event.relatedTarget));
  container.addEventListener('focusin', event => start(event.target.closest(selector)));
  container.addEventListener('focusout', event => {
    const button = event.target.closest(selector);
    if ((button === active || button === pending) && !button.contains(event.relatedTarget)
      && !button.matches(':hover') && !button.querySelector('video')?.controls) stop();
  });
  container.addEventListener('pause', event => {
    if (active?.querySelector('video') === event.target && event.target.paused) stop();
  }, true);
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
  window.addEventListener('pagehide', stop);
  reducedMotion.addEventListener('change', stop);
  finePointer.addEventListener('change', stop);
  navigator.connection?.addEventListener('change', stop);
  return {
    stop,
    stopFor: button => {if (button && (button === active || button === pending)) stop();},
    play: button => {stop(); if (button && !document.hidden) load(button);}
  };
}

// All public previews share one playback slot. Leaving view pauses; replacement releases bytes.
export function createPlaybackCoordinator() {
  observer = new window.IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      const fullscreen = document.fullscreenElement;
      if (!isIntersecting && !(fullscreen && fullscreen.contains(target))) target.pause();
    }
  });
  function pauseAll() {
    for (const video of document.querySelectorAll('video')) video.pause();
  }
  document.addEventListener('play', event => {
    const video = event.target;
    if (!(video instanceof window.HTMLVideoElement)) return;
    if (document.hidden) {video.pause(); return;}
    for (const other of document.querySelectorAll('video')) if (other !== video) other.pause();
    observer.observe(video);
  }, true);
  document.addEventListener('pause', event => {
    const video = event.target;
    if (!(video instanceof window.HTMLVideoElement) || !video.paused) return;
    observer.unobserve(video);
    video.closest('.style-poster')?.classList.remove('playing');
  }, true);
  document.addEventListener('visibilitychange', () => {if (document.hidden) pauseAll();});
  window.addEventListener('pagehide', pauseAll);
}
