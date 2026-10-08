import {afterEach, describe, expect, it, vi} from 'vitest';
import {createPlaybackCoordinator, releaseVideo} from '../library/playback.mjs';

afterEach(() => vi.unstubAllGlobals());

function players() {
  class Video {
    paused = false;
    src = 'public-preview.mp4';
    loads = 0;
    pause() {this.paused = true;}
    removeAttribute(name) {if (name === 'src') this.src = null;}
    load() {this.loads++;}
    closest() {return null;}
  }
  const videos = [new Video(), new Video()];
  const events = {}; const windowEvents = {}; const observed = new Set();
  let intersect;
  const document = {hidden: false, fullscreenElement: null, querySelectorAll: () => videos, addEventListener: (name, callback) => {events[name] = callback;}};
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', {
    HTMLVideoElement: Video,
    IntersectionObserver: class {
      constructor(callback) {intersect = callback;}
      observe(video) {observed.add(video);}
      unobserve(video) {observed.delete(video);}
    },
    addEventListener: (name, callback) => {windowEvents[name] = callback;}
  });
  createPlaybackCoordinator();
  return {videos, document, events, windowEvents, observed, intersect: entries => intersect(entries)};
}

describe('public preview playback lifecycle', () => {
  it('pauses the previous preview when another starts, and pauses the new one offscreen', () => {
    const p = players();
    p.events.play({target: p.videos[1]});
    expect(p.videos.map(video => video.paused)).toEqual([true, false]);
    p.intersect([{target: p.videos[1], isIntersecting: false}]);
    expect(p.videos[1].paused).toBe(true);
  });
  it('pauses all videos on hiding or leaving the page and rejects background playback', () => {
    const p = players();
    p.document.hidden = true; p.events.visibilitychange();
    expect(p.videos.every(video => video.paused)).toBe(true);
    p.videos[1].paused = false; p.events.play({target: p.videos[1]});
    expect(p.videos[1].paused).toBe(true);
    p.document.hidden = false; p.videos[0].paused = false; p.windowEvents.pagehide();
    expect(p.videos.every(video => video.paused)).toBe(true);
  });
  it('keeps fullscreen playback when the inline video leaves view', () => {
    const p = players(); p.document.fullscreenElement = {contains: video => video === p.videos[1]};
    p.intersect([{target: p.videos[1], isIntersecting: false}]);
    expect(p.videos[1].paused).toBe(false);
  });
  it('releases a replaced video and stops retaining it in the visibility observer', () => {
    const p = players(); p.events.play({target: p.videos[0]});
    releaseVideo(p.videos[0]);
    expect(p.videos[0]).toMatchObject({paused: true, src: null, loads: 1});
    expect(p.observed.has(p.videos[0])).toBe(false);
  });
});
