import ink from '../../../shots/print-texture-transitions/manifest.json';
import carry from '../../../shots/line-carry-transition/manifest.json';
import door from '../../../shots/page-turn-transitions/manifest.json';
import React from 'react';
import {z} from 'zod';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {Storyboard, StoryboardScene} from '../../schemas/storyboard';
import type {CaptionCue} from '../../audio/captions';
import blinds from '../../../shots/blinds-wipe/manifest.json';
import push from '../../../shots/bottom-push/manifest.json';
import {getSceneTimeline} from '../../timeline/scene-timeline';
const chapterCommon = {version: z.literal('1.0.0'), status: z.literal('experimental'), kind: z.literal('cross-scene-transition'), styles: z.array(z.enum(['retro-zine', 'signal', 'scatterbrain', 'archive-grid', 'signal-noir', 'studio-frame'])).min(1), orientations: z.array(z.literal('landscape')).min(1), minSec: z.literal(.2), maxSec: z.literal(.8), sound: z.literal(false), requires: z.array(z.string()).min(1)};
export const ChapterManifestSchema = z.discriminatedUnion('id', [
  z.object({...chapterCommon, minSec: z.literal(.6), maxSec: z.literal(2.4), id: z.literal('line-carry-transition'), shortlist: z.literal('C09'), type: z.literal('overlap-line-carry')}).strict(),
  z.object({...chapterCommon, minSec: z.literal(.6), maxSec: z.literal(2.4), id: z.literal('print-texture-transitions'), shortlist: z.literal('C11'), type: z.literal('overlap-ink')}).strict(),
  z.object({...chapterCommon, minSec: z.literal(.6), maxSec: z.literal(2.4), id: z.literal('page-turn-transitions'), shortlist: z.literal('C12'), type: z.literal('overlap-barn-door')}).strict(),
  z.object({...chapterCommon, id: z.literal('blinds-wipe'), shortlist: z.literal('C10'), type: z.literal('overlap-blinds')}).strict(),
  z.object({...chapterCommon, id: z.literal('bottom-push'), shortlist: z.literal('C13'), type: z.literal('overlap-push-stack')}).strict()
]);
export const CHAPTER_TRANSITIONS = [blinds, push, ink, carry, door].map((item) => ChapterManifestSchema.parse(item));
export function isChapterTransition(type?: string) {return CHAPTER_TRANSITIONS.some((recipe) => recipe.type === type);}
export function chapterWindows(board: Storyboard) {return getSceneTimeline(board).filter(({scene}) => isChapterTransition(scene.transitionIn?.type)).map(({scene, startFrame}) => ({start: startFrame, end: startFrame + scene.transitionIn!.durationFrames}));}
export function assertChapterCaptions(board: Storyboard, cues: CaptionCue[]) {
  for (const {start, end} of chapterWindows(board)) if (cues.some((cue) => cue.startSec * board.project.fps < end && cue.endSec * board.project.fps > start)) throw new Error('换章转场不得覆盖旁白字幕或关键词，请移动转场或拆出换章镜头。');
}
export function validateChapterTransitions(board: Storyboard) {
  const timeline = getSceneTimeline(board);
  for (const [index, timing] of timeline.entries()) {
    const transition = timing.scene.transitionIn;
    if (!isChapterTransition(transition?.type)) continue;
    const recipe = CHAPTER_TRANSITIONS.find((item) => item.type === transition!.type)!;
    const previous = timeline[index - 1];
    if (!previous) throw new Error(`${timing.scene.id}: 换章不能用于第一场。`);
    const fail = (message: string): never => {throw new Error(`${timing.scene.id}: ${message}`);};
    if (board.schemaVersion !== '2.4' || !previous || !recipe.styles.includes(board.style.id as typeof recipe.styles[number]) || board.style.version !== '1.0.0' || Math.abs(board.project.width / board.project.height - 16 / 9) > .001) fail('换章转场需要 2.4、清单中支持的风格、16:9，且不能用于第一场。');
    if (transition!.durationFrames < Math.ceil(recipe.minSec * board.project.fps) || transition!.durationFrames > Math.ceil(recipe.maxSec * board.project.fps)) fail(`换章转场时长必须在 ${recipe.minSec}–${recipe.maxSec} 秒。`);
    if (previous.scene.outro || previous.scene.transitionOut || timing.scene.title === previous.scene.title) fail('换章须有不同章节标题，不能叠加旧场退出动作。');
    if (transition?.type === 'overlap-line-carry') {
      if (timeline.filter(t => t.scene.transitionIn?.type === 'overlap-line-carry').length > 1) fail('线条承接每片最多一次');
      const shared = [previous.scene, timing.scene].map(s => {
        if (s.shot?.id !== 'code-reveal') fail('线条承接仅支持代码载体的真实标题线');
        const layer = s.layers.find(l => l.id === (s.shot?.id === 'code-reveal' ? s.shot.slots.code : ''));
        if (layer?.semanticRole !== `carry:${transition.carryKey}`) fail('两场必须绑定相同 carryKey');
        return layer?.label;
      });
      if (shared[0] !== shared[1]) fail('承接线必须对应同一语义标题');
    }
    if (timing.scene.beats.some((beat) => beat.start < transition!.durationFrames)) fail('新章节交接完成后才开始内容动作。');
    for (const scene of [previous.scene, timing.scene]) {
      const start = scene === previous.scene ? scene.durationFrames - transition!.durationFrames : 0;
      const end = scene === previous.scene ? scene.durationFrames : transition!.durationFrames;
      if (scene.captions.some((cue) => cue.start < end && cue.end > start)) fail('换章需独立无字幕窗口，不能遮盖旁白关键词。');
    }
  }
}
export function stripBounds(progress: number, width: number, strips = 12) {
  const ease = (p: number) => 1 - (1 - Math.max(0, Math.min(1, p))) ** 3;
  return Array.from({length: strips}, (_, i) => {const p = ease((progress - i / strips * .5) / .5);return {x: i * width / strips, width: width / strips, progress: p};});
}
export function ChapterPage({scene, outgoing, outgoingFrames, seamInk, children}: {scene: StoryboardScene; outgoing?: string; outgoingFrames: number; seamInk: string; children: React.ReactNode}) {
  const frame = useCurrentFrame(); const {width, height} = useVideoConfig();
  const incoming = isChapterTransition(scene.transitionIn?.type) ? scene.transitionIn : undefined;
  const leaving = isChapterTransition(outgoing);
  const isLeaving = leaving && frame >= scene.durationFrames - outgoingFrames;
  const type = isLeaving ? outgoing : incoming?.type;
  const progress = isLeaving ? (frame - (scene.durationFrames - outgoingFrames)) / outgoingFrames : incoming ? frame / incoming.durationFrames : 1;
  if (!isChapterTransition(type) || progress >= 1 && !isLeaving) return <>{children}</>;
  const p = Math.max(0, Math.min(1, progress));
  const maskId = `chapter-${scene.id}`;
  if (type === 'overlap-line-carry') {
    const eased = p * p * (3 - 2 * p);
    return <div style={{position: 'absolute', inset: 0, transform: `translateX(${(isLeaving ? -eased : 1 - eased) * width}px)`}}>{children}</div>;
  }
  if (type === 'overlap-barn-door') {
    if (!isLeaving) return <div style={{position:'absolute',inset:0,clipPath:`inset(0 ${barnDoorInset(p)}% 0 ${barnDoorInset(p)}%)`}}><div style={{position:'absolute',inset:0,transform:`scale(${1.06-.06*p})`}}>{children}</div></div>;
    return <>{[-1, 1].map(side => <div key={side} style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${side < 0 ? 50 : 0}% 0 ${side > 0 ? 50 : 0}%)`, transform: `translateX(${side * p ** 3 * width / 2}px)`}}>{children}<div aria-hidden style={{position:'absolute',left:'50%',top:0,bottom:0,width:3,background:seamInk,opacity:Math.sin(p*Math.PI)}}/></div>)}</>;
  }
  if (type === 'overlap-ink') {
    const shape = inkBoundary(p, width, height);
    return <><svg aria-hidden width="0" height="0"><defs><clipPath id={maskId} clipPathUnits="userSpaceOnUse"><path d={`${isLeaving ? `M0 0H${width}V${height}H0Z ` : ''}${shape}`} clipRule="evenodd" fillRule="evenodd"/></clipPath></defs></svg><div style={{position:'absolute',inset:0,clipPath:`url(#${maskId})`}}>{children}</div></>;
  }
  if (type === 'overlap-push-stack') {
    const eased = 1 - (1 - p) ** 3;
    return <div style={{position: 'absolute', inset: 0, transform: `translateY(${(isLeaving ? -eased : 1 - eased) * height}px)`}}>{children}{!isLeaving && p > 0 && p < 1 ? <div aria-hidden style={{position: 'absolute', left: 0, right: 0, top: -12 * width / 1920, height: 12 * width / 1920, background: `linear-gradient(transparent, ${seamInk}55)`}} /> : null}</div>;
  }
  return <><svg aria-hidden width="0" height="0" style={{position: 'absolute'}}><defs><clipPath id={maskId} clipPathUnits="userSpaceOnUse">{stripBounds(p, width).map((strip, i) => <rect key={i} x={strip.x + (isLeaving ? 0 : strip.width * (1 - strip.progress))} y="0" width={strip.width * (isLeaving ? 1 - strip.progress : strip.progress)} height={height} />)}</clipPath></defs></svg><div style={{position: 'absolute', inset: 0, clipPath: `url(#${maskId})`}}>{children}{!isLeaving && p > 0 && p < 1 ? <svg aria-hidden width={width} height={height} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>{stripBounds(p, width).filter((strip) => strip.progress > 0 && strip.progress < 1).map((strip, i) => <line key={i} x1={strip.x + strip.width * (1 - strip.progress)} x2={strip.x + strip.width * (1 - strip.progress)} y1="0" y2={height} stroke={seamInk} strokeWidth={3 * width / 1920} />)}</svg> : null}</div></>;
}

// Fixed phase offsets create an organic mask edge without displacing any source content.
export function inkBoundary(progress: number, width: number, height: number) {
  const p = Math.max(0, Math.min(1, progress));
  const radius = Math.hypot(width, height) * .6 * p;
  const points = Array.from({length: 72}, (_, i) => {
    const angle = i / 72 * Math.PI * 2;
    const noise = (Math.sin(i * 1.7 + 7) + .4 * Math.cos(i * .9 + 7)) * Math.sin(p * Math.PI) * .09;
    const r = radius * (1 + noise);
    return `${width / 2 + Math.cos(angle) * r} ${height / 2 + Math.sin(angle) * r}`;
  });
  return `M${points.join('L')}Z`;
}

export function barnDoorInset(progress: number) {return (1 - Math.max(0,Math.min(1,progress)) ** 3) * 50;}
