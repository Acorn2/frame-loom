import {Easing, spring} from 'remotion';
import type {ShotPlan} from './compile-shot';

export const curves = {
  press: Easing.bezier(.2, .75, .3, 1),
  handoff: Easing.inOut(Easing.cubic),
  hinge: Easing.bezier(.16, 1, .3, 1),
  flight: Easing.bezier(.3, 0, .25, 1),
  fan: Easing.inOut(Easing.cubic),
  flip: Easing.bezier(.55, 0, .3, 1),
  back: Easing.out(Easing.back(1.4)),
  reel: (t: number) => .7 * Easing.out(Easing.poly(5))(t) + .3 * Easing.out(Easing.back(1.4))(t)
};
export function beatProgress(plan: ShotPlan, target: string, actions: string[], frame: number, ease = Easing.out(Easing.cubic), from = 0, to = 1) {
  const beat = plan.actions.find(item => item.target === target && actions.includes(item.action));
  if (!beat) return 0;
  const raw = Math.max(0, Math.min(1, (frame - beat.start - beat.duration * from) / (beat.duration * (to - from))));
  return ease(raw);
}
export function fanPose(index: number, count: number, spread: number) {
  const k = index - (count - 1) / 2;
  return {x: k * 24 * spread, rotation: k * 3 * spread, z: -24 * Math.abs(k) * spread, order: 20 - Math.abs(k * 2)};
}
export function cubicPoint(t: number, x0: number, y0: number, x1: number, y1: number) {
  const v = 1 - t;
  return {x: v ** 3 * x0 + 3 * v ** 2 * t * 480 + 3 * v * t ** 2 * 510 + t ** 3 * x1,
    y: v ** 3 * y0 + 3 * v ** 2 * t * y0 + 3 * v * t ** 2 * y1 + t ** 3 * y1};
}

export function beatSpring(plan: ShotPlan, target: string, frame: number, fps: number) {
  const beat = plan.actions.find(item => item.target === target && ['enter', 'reveal'].includes(item.action));
  if (!beat || frame <= beat.start) return 0;
  if (frame >= beat.start + beat.duration) return 1;
  return spring({frame: frame - beat.start, fps, durationInFrames: beat.duration, config: {damping: 12, stiffness: 160, mass: .8}});
}

export function rowLandingFeedback(plan: ShotPlan, target: string, frame: number, fps: number) {
  const beat = plan.actions.find(item => item.target === target && ['enter', 'reveal'].includes(item.action));
  if (!beat) return {spread: 0, opacity: 0};
  const elapsed = (frame - beat.start - beat.duration) * 30 / fps;
  if (elapsed < 0 || elapsed >= 8) return {spread: 0, opacity: 0};
  return {spread: Easing.out(Easing.cubic)(Math.min(1, elapsed / 5)), opacity: elapsed <= 2 ? 1 : (8 - elapsed) / 6};
}
