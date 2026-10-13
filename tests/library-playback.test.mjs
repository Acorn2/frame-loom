import {afterEach, describe, expect, it, vi} from 'vitest';
import {createPlaybackCoordinator, createCardPreviewPlayback, releaseVideo} from '../library/playback.mjs';

afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});

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

function previewCards() {
  vi.useFakeTimers();
  const handlers = {}; const documentEvents = {}; const preferenceEvents = {};
  const finePointer = {matches: true, addEventListener: (name, callback) => {preferenceEvents.pointer = callback;}};
  const reducedMotion = {matches: false, addEventListener: (name, callback) => {preferenceEvents.motion = callback;}};
  const connection = {saveData: false, addEventListener: (name, callback) => {preferenceEvents.connection = callback;}};
  const document = {hidden: false, activeElement: null, getElementById: () => ({open: false}), addEventListener: (name, callback) => {documentEvents[name] = callback;}};
  vi.stubGlobal('document', document);
  vi.stubGlobal('navigator', {connection});
  vi.stubGlobal('window', {matchMedia: () => finePointer, addEventListener: () => {}});
  const cards = [0, 1].map(index => {
    const classes = new Set();
    const video = {dataset: {src: `sample-${index}.mp4`}, paused: true, controls: false,
      load: vi.fn(), pause: vi.fn(function () {this.paused = true;}),
      removeAttribute: vi.fn(function () {this.src = undefined;}),
      play: vi.fn(function () {this.paused = false; return Promise.resolve();})};
    const card = {video, classes, querySelector: () => video, contains: target => target === card,
      closest: () => card, matches: () => false,
      classList: {add: name => classes.add(name), remove: name => classes.delete(name)}};
    return card;
  });
  const controller = createCardPreviewPlayback({addEventListener: (name, callback) => {handlers[name] = callback;}}, reducedMotion, '.shot-poster');
  return {cards, controller, document, documentEvents, finePointer, reducedMotion, connection, preferenceEvents,
    hover: card => handlers.pointerover({target: card, pointerType: 'mouse'}),
    leave: card => handlers.pointerout({target: card, relatedTarget: null}),
    focus: card => {document.activeElement = card; handlers.focusin({target: card});},
    blur: card => {document.activeElement = null; handlers.focusout({target: card, relatedTarget: null});}};
}

describe('card preview intent and resource lifecycle', () => {
  it('keeps idle cards still and cancels a quick pointer pass without loading video', async () => {
    const p = previewCards(); p.hover(p.cards[0]);
    await vi.advanceTimersByTimeAsync(200); p.leave(p.cards[0]);
    await vi.advanceTimersByTimeAsync(100);
    expect(p.cards[0].video.play).not.toHaveBeenCalled();
    expect(p.cards[0].video.load).not.toHaveBeenCalled();
  });
  it('plays the requested card and releases it when another card is hovered', async () => {
    const p = previewCards(); p.hover(p.cards[0]); await vi.advanceTimersByTimeAsync(250);
    expect(p.cards[0].classes.has('playing')).toBe(true);
    p.hover(p.cards[1]);
    expect(p.cards[0].video.paused).toBe(true); expect(p.cards[0].video.src).toBeUndefined();
    await vi.advanceTimersByTimeAsync(250);
    expect(p.cards[1].classes.has('playing')).toBe(true);
    expect(p.cards.filter(card => !card.video.paused)).toHaveLength(1);
    p.leave(p.cards[1]); expect(p.cards[1].classes.has('playing')).toBe(false); expect(p.cards[1].video.src).toBeUndefined();
  });
  it('keeps a keyboard-focused preview until focus leaves and stops it offscreen', async () => {
    const p = previewCards(); p.focus(p.cards[0]); await vi.advanceTimersByTimeAsync(250);
    p.leave(p.cards[0]); expect(p.cards[0].video.paused).toBe(false);
    p.controller.stopFor(p.cards[1]); expect(p.cards[0].video.paused).toBe(false);
    p.controller.stopFor(p.cards[0]); expect(p.cards[0].video.paused).toBe(true);
    p.focus(p.cards[1]); await vi.advanceTimersByTimeAsync(250); p.blur(p.cards[1]);
    expect(p.cards[1].video.src).toBeUndefined();
  });
  it.each(['motion', 'connection', 'pointer'])('keeps static covers for %s restrictions but permits explicit playback', async preference => {
    const p = previewCards();
    if (preference === 'motion') p.reducedMotion.matches = true;
    if (preference === 'connection') p.connection.saveData = true;
    if (preference === 'pointer') p.finePointer.matches = false;
    p.hover(p.cards[0]); await vi.advanceTimersByTimeAsync(300);
    expect(p.cards[0].video.play).not.toHaveBeenCalled();
    p.controller.play(p.cards[0]); expect(p.cards[0].video.play).toHaveBeenCalledOnce();
    p.document.hidden = true; p.documentEvents.visibilitychange();
    expect(p.cards[0].video.src).toBeUndefined();
  });
  it('ignores an old play rejection after the same card has been requested again', async () => {
    const p = previewCards(); let reject;
    p.cards[0].video.play.mockImplementationOnce(() => new Promise((resolve, fail) => {reject = fail;}));
    p.hover(p.cards[0]); await vi.advanceTimersByTimeAsync(250); p.leave(p.cards[0]);
    p.hover(p.cards[0]); await vi.advanceTimersByTimeAsync(250);
    reject(new Error('Previous media load was cancelled')); await Promise.resolve(); await Promise.resolve();
    expect(p.cards[0].classes.has('playing')).toBe(true); expect(p.cards[0].video.paused).toBe(false);
  });
});
