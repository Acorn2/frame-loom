import {getSceneTimeline} from '../../src/timeline/scene-timeline.ts';

// Editorial prompts, not delivery gates: repeated layouts and reading holds can be intentional.
export function checkContentQuality(storyboard) {
  if (storyboard.schemaVersion !== '2.4' || storyboard.scenes.length < 4 || storyboard.project.durationSec < 30) return [];
  const issues = [];
  const warn = (path, message) => issues.push({path: `contentQuality.${path}`, message, severity: 'warning'});
  const groups = new Map();
  for (const scene of storyboard.scenes) {
    const key = `${scene.shot.id}/${scene.visual.kind}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const [dominant, count] = [...groups].sort((a, b) => b[1] - a[1])[0];
  if (count / storyboard.scenes.length >= .8) {
    warn('repetition', `${count}/${storyboard.scenes.length} 场使用同一配方与画面类型（${dominant}）；核对正文是否需要流程、对比、数据或素材表达。不要按分类凑齐；用户限定或内容确有需要时，在 shot-map.md 说明重复理由。`);
  }
  const fps = storyboard.project.fps;
  const titleHolds = getSceneTimeline(storyboard).filter(({scene, overlapOutFrames}) => {
    if (scene.visual.kind !== 'statement' || !scene.layers.length || !scene.layers.every(layer => layer.type === 'label')) return false;
    const lastAction = Math.max(0, ...scene.beats.map(beat => beat.start + beat.duration));
    const contentEnd = scene.durationFrames - Math.max(overlapOutFrames, scene.outro?.fadeFrames ?? 0);
    const hold = contentEnd - lastAction;
    return hold >= 5 * fps && hold / scene.durationFrames >= .6;
  });
  if (titleHolds.length) {
    warn('titleHolds', `${titleHolds.length} 场只有标题文字，动作结束后停留至少 5 秒且占该场至少 60%（${titleHolds.map(({scene}) => scene.id).join('、')}）；字幕变化不等于正文画面解释。按讲解安排关键内容提示，或说明必要阅读停留，勿用装饰动画消除警告。`);
  }
  return issues;
}
