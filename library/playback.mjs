/* global document, window */

let observer;
export function releaseVideo(video) {
  if (!video) return;
  observer?.unobserve(video);
  video.pause(); video.removeAttribute('src'); video.load();
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
