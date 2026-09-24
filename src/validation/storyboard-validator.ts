import fs from 'node:fs';
import path from 'node:path';
import {CAPABILITY_MANIFEST} from '../renderer/capability-manifest';
import {StoryboardSchema, type Storyboard, type StoryboardLayer, type StoryboardScene} from '../schemas/storyboard';
import {MotionPackSchema, StyleIndexSchema, StylePackSchema, type StylePack} from '../schemas/style-pack';
import {validateContentMapping} from './mapping-validator';
import {getNodeState} from '../renderer/node-state';
import {getTimelineDuration} from '../timeline/scene-timeline';
import {isTemplateFamily} from '../templates/families/family-registry';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationOptions {
  storyboardPath?: string;
  styleRoot?: string;
  executionMode?: 'review' | 'fast';
}

const issue = (pathName: string, message: string, severity: ValidationIssue['severity'] = 'error'): ValidationIssue => ({
  path: pathName, message, severity
});

function zodIssues(prefix: string, issues: {path: PropertyKey[]; message: string}[]): ValidationIssue[] {
  return issues.map((item) => issue(
    [prefix, ...item.path.map(String)].filter(Boolean).join('.'),
    item.message
  ));
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateStyleReference(storyboard: Storyboard, styleRoot: string, issues: ValidationIssue[]): StylePack | undefined {
  const indexPath = path.join(styleRoot, 'style-index.json');
  try {
    const parsedIndex = StyleIndexSchema.safeParse(readJson(indexPath));
    if (!parsedIndex.success) {
      issues.push(...zodIssues('styleIndex', parsedIndex.error.issues));
      return undefined;
    }
    const entry = parsedIndex.data.styles.find((item) => item.id === storyboard.style.id);
    if (!entry) {
      issues.push(issue('style.id', `未知 Style Pack "${storyboard.style.id}"。`));
      return undefined;
    }
    if (entry.version !== storyboard.style.version) {
      issues.push(issue('style.version', `Style Pack "${storyboard.style.id}" 需要版本 ${entry.version}。`));
    }
    if (storyboard.schemaVersion === '2.2' && !isTemplateFamily(entry.id)) {
      issues.push(issue('style.id', `Style Pack "${entry.id}" 暂不支持 Storyboard 2.2 的镜头职责版式。`));
    }

    const stylePath = path.join(styleRoot, storyboard.style.id, 'style.json');
    const motionPath = path.join(styleRoot, storyboard.style.id, 'motion.json');
    const parsedStyle = StylePackSchema.safeParse(readJson(stylePath));
    const parsedMotion = MotionPackSchema.safeParse(readJson(motionPath));
    if (!parsedStyle.success) issues.push(...zodIssues(`styles.${storyboard.style.id}.style`, parsedStyle.error.issues));
    if (!parsedMotion.success) issues.push(...zodIssues(`styles.${storyboard.style.id}.motion`, parsedMotion.error.issues));
    if (!parsedStyle.success) return undefined;
    if (parsedStyle.data.id !== entry.id || parsedStyle.data.version !== entry.version) {
      issues.push(issue('style', `Style Pack "${entry.id}" 的 index、id 或 version 不一致。`));
    }
    return parsedStyle.data;
  } catch (error) {
    issues.push(issue('style', error instanceof Error ? error.message : String(error)));
    return undefined;
  }
}

function validateLayer(
  layer: StoryboardLayer,
  scene: StoryboardScene,
  storyboardPath: string | undefined,
  issues: ValidationIssue[],
  style?: StylePack
) {
  if (!CAPABILITY_MANIFEST.layers.includes(layer.type)) {
    issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, `未知 layer type "${layer.type}"。`));
  }
  if (style && !style.supports.layers.includes(layer.type)) {
    issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, `Style Pack "${style.id}" 不支持 layer type "${layer.type}"。`));
  }
  if (layer.visibleFrom !== undefined && layer.visibleUntil !== undefined && layer.visibleUntil <= layer.visibleFrom) {
    issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, 'visibleUntil 必须晚于 visibleFrom。'));
  }
  if (layer.visibleUntil !== undefined && layer.visibleUntil > scene.durationFrames) {
    issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, '可见时间必须位于当前 scene 内。'));
  }
  if (layer.type === 'callout' && (!layer.target || !scene.layers.some((item) => item.id === layer.target && item.type === 'object'))) {
    issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, 'callout.target 必须引用当前 scene 的 object layer。'));
  }
  if (layer.type === 'object' && !layer.asset) {
    issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, 'object 必须声明有来源的 asset 路径。'));
  }
  if (layer.type === 'screenshot' || layer.type === 'object') {
    if (!layer.asset) {
      issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, `${layer.type} 必须声明 asset 路径。`));
    } else if (storyboardPath) {
      const assetPath = path.resolve(path.dirname(storyboardPath), layer.asset);
      if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile() || fs.statSync(assetPath).size === 0) {
        issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, `asset 不存在或为空：${layer.asset}`));
      }
    }
  }
}

function validateScene(scene: StoryboardScene, issues: ValidationIssue[], storyboardPath: string | undefined, style?: StylePack) {
  if (scene.purpose && style && !style.supports.purposes?.includes(scene.purpose)) {
    issues.push(issue(`scene ${scene.id}.purpose`, `Style Pack "${style.id}" 不支持镜头职责 "${scene.purpose}"。`));
  }
  if (!CAPABILITY_MANIFEST.templates.includes(scene.template)) {
    issues.push(issue(`scene ${scene.id}`, `未知或尚未实现的 template "${scene.template}"。`));
  }
  if (style && !style.supports.templates.includes(scene.template)) {
    issues.push(issue(`scene ${scene.id}`, `Style Pack "${style.id}" 不支持 template "${scene.template}"。`));
  }
  if (scene.transitionOut && !CAPABILITY_MANIFEST.transitions.includes(scene.transitionOut)) {
    issues.push(issue(`scene ${scene.id}.transitionOut`, `未知 transition "${scene.transitionOut}"。`));
  }
  if (scene.transitionOut && style && !style.supports.transitions.includes(scene.transitionOut)) {
    issues.push(issue(`scene ${scene.id}.transitionOut`, `Style Pack "${style.id}" 不支持 transition "${scene.transitionOut}"。`));
  }
  if (scene.transitionIn) {
    if (!CAPABILITY_MANIFEST.overlapTransitions.includes(scene.transitionIn.type)) {
      issues.push(issue(`scene ${scene.id}.transitionIn`, '未知 overlap transition。'));
    }
    if (style?.supports.overlapTransitions && !style.supports.overlapTransitions.includes(scene.transitionIn.type)) {
      issues.push(issue(`scene ${scene.id}.transitionIn`, `Style Pack "${style.id}" 不支持 ${scene.transitionIn.type}。`));
    }
    if (scene.transitionIn.durationFrames >= scene.durationFrames) {
      issues.push(issue(`scene ${scene.id}.transitionIn`, '重叠时长必须短于当前 scene。'));
    }
  }
  if (scene.outro && scene.outro.holdFrames + scene.outro.fadeFrames >= scene.durationFrames) {
    issues.push(issue(`scene ${scene.id}.outro`, '结尾停留与淡出总时长必须短于 scene。'));
  }

  const layerIds = new Set<string>();
  for (const layer of scene.layers) {
    if (layerIds.has(layer.id)) issues.push(issue(`scene ${scene.id}.layers`, `layer id "${layer.id}" 必须唯一。`));
    layerIds.add(layer.id);
    validateLayer(layer, scene, storyboardPath, issues, style);
  }

  const connectionIds = new Set<string>();
  for (const connection of scene.connections) {
    if (connectionIds.has(connection.id)) issues.push(issue(`scene ${scene.id}.connections`, `connection id "${connection.id}" 必须唯一。`));
    connectionIds.add(connection.id);
    if (!layerIds.has(connection.from) || !layerIds.has(connection.to)) {
      issues.push(issue(`scene ${scene.id}, connection ${connection.id}`, 'from 和 to 必须引用当前 scene 中存在的 layer。'));
    }
  }
  if (scene.attentionTarget && !layerIds.has(scene.attentionTarget)) {
    issues.push(issue(`scene ${scene.id}.attentionTarget`, `焦点目标 "${scene.attentionTarget}" 不存在。`));
  }

  const beatIds = new Set<string>();
  for (const beat of scene.beats) {
    if (beatIds.has(beat.id)) issues.push(issue(`scene ${scene.id}.beats`, `beat id "${beat.id}" 必须唯一。`));
    beatIds.add(beat.id);
    const targetExists = layerIds.has(beat.target) || connectionIds.has(beat.target);
    if (!targetExists) issues.push(issue(`scene ${scene.id}, beat ${beat.id}`, `target "${beat.target}" 不存在。`));
    if (!CAPABILITY_MANIFEST.actions.includes(beat.action)) {
      issues.push(issue(`scene ${scene.id}, beat ${beat.id}`, `未知或尚未实现的 action "${beat.action}"。`));
    } else {
      if (style && !style.supports.actions.includes(beat.action)) {
        issues.push(issue(`scene ${scene.id}, beat ${beat.id}`, `Style Pack "${style.id}" 不支持 action "${beat.action}"。`));
      }
      const targetType = connectionIds.has(beat.target) ? 'connection' : scene.layers.find((layer) => layer.id === beat.target)?.type;
      if (targetType && !(CAPABILITY_MANIFEST.actionTargets[beat.action] as readonly string[]).includes(targetType)) {
        issues.push(issue(`scene ${scene.id}, beat ${beat.id}`, `action "${beat.action}" 不能作用于 ${targetType}。`));
      }
    }
    if (beat.start + beat.duration > scene.durationFrames) {
      issues.push(issue(`scene ${scene.id}, beat ${beat.id}`, 'beat 时间必须位于当前 scene 内。'));
    }
    if (beat.action === 'set-state' && !beat.state) {
      issues.push(issue(`scene ${scene.id}, beat ${beat.id}`, 'set-state 必须声明 state。'));
    }
    if (beat.action !== 'set-state' && beat.state) {
      issues.push(issue(`scene ${scene.id}, beat ${beat.id}`, '只有 set-state 可以声明 state。'));
    }
  }
  const stateFrames = [...new Set([0, ...scene.beats.filter((beat) => beat.action === 'set-state').map((beat) => beat.start)])];
  for (const frame of stateFrames) {
    const current = scene.layers.filter((layer) => getNodeState(layer, scene, frame) === 'current');
    if (current.length > 1) {
      issues.push(issue(`scene ${scene.id}.beats`, `第 ${frame} 帧同时有多个 current 节点：${current.map((layer) => layer.id).join(', ')}。`));
    }
  }
  if (scene.outro) {
    const lastBeatEnd = Math.max(0, ...scene.beats.map((beat) => beat.start + beat.duration));
    const stableEnd = scene.durationFrames - scene.outro.fadeFrames;
    if (lastBeatEnd > stableEnd - scene.outro.holdFrames) {
      issues.push(issue(`scene ${scene.id}.outro`, `最后动作结束于 ${lastBeatEnd} 帧，留给稳定画面的时间不足 ${scene.outro.holdFrames} 帧。`));
    }
    if (scene.captions.some((caption) => caption.end > stableEnd)) {
      issues.push(issue(`scene ${scene.id}.captions`, `caption 不得延伸到结尾淡出阶段（${stableEnd} 帧之后）。`));
    }
  }
  for (const caption of scene.captions) {
    if (caption.end <= caption.start || caption.end > scene.durationFrames) {
      issues.push(issue(`scene ${scene.id}, caption ${caption.id}`, 'caption 时间必须位于当前 scene 内。'));
    }
  }
}

const STORYBOARD_STATUS_FOR_REVIEW = new Set(['reviewed', 'approved']);
const STORYBOARD_STATUS_FOR_FAST = new Set(['generated', 'validated', 'reviewed', 'approved']);

export function validateStoryboard(value: unknown, options: ValidationOptions = {}): ValidationIssue[] {
  const parsed = StoryboardSchema.safeParse(value);
  if (!parsed.success) return zodIssues('$', parsed.error.issues);

  const storyboard = parsed.data;
  const issues: ValidationIssue[] = [];
  if (storyboard.schemaVersion === '2.2') {
    for (const scene of storyboard.scenes) {
      if (!scene.purpose) issues.push(issue(`scene ${scene.id}.purpose`, 'Storyboard 2.2 的每个 scene 必须声明镜头职责。'));
    }
  } else if (storyboard.scenes.some((scene) => scene.purpose)) {
    issues.push(issue('schemaVersion', '使用 scene.purpose 时必须升级为 Storyboard 2.2。'));
  }
  const allowedStatuses = options.executionMode === 'fast'
    ? STORYBOARD_STATUS_FOR_FAST
    : STORYBOARD_STATUS_FOR_REVIEW;
  if (!allowedStatuses.has(storyboard.project.status)) {
    const modeHint = options.executionMode === 'fast'
      ? 'fast 模式需要 generated、validated、reviewed 或 approved。'
      : 'review 模式需要 reviewed 或 approved。';
    issues.push(issue('project.status', `不支持的 project.status "${storyboard.project.status}"。${modeHint}`));
  }
  const style = options.styleRoot ? validateStyleReference(storyboard, options.styleRoot, issues) : undefined;

  if (Math.round(storyboard.project.durationSec * storyboard.project.fps) !== storyboard.project.durationFrames) {
    issues.push(issue('project.durationFrames', '必须等于 durationSec × fps。'));
  }
  const sceneIds = new Set<string>();
  for (const [index, scene] of storyboard.scenes.entries()) {
    if (sceneIds.has(scene.id)) issues.push(issue(`scenes.${scene.id}`, 'scene id 必须唯一。'));
    sceneIds.add(scene.id);
    if (index === 0 && scene.transitionIn) issues.push(issue(`scene ${scene.id}.transitionIn`, '首个 scene 不能声明重叠入场。'));
    if (index > 0 && scene.transitionIn && scene.transitionIn.durationFrames >= storyboard.scenes[index - 1]!.durationFrames) {
      issues.push(issue(`scene ${scene.id}.transitionIn`, '重叠时长必须短于前一个 scene。'));
    }
    validateScene(scene, issues, options.storyboardPath, style);
    if (scene.primaryClaim && !scene.outro) {
      const overlapOut = storyboard.scenes[index + 1]?.transitionIn?.durationFrames ?? 24;
      const lastBeatEnd = Math.max(0, ...scene.beats.map((beat) => beat.start + beat.duration));
      if (scene.durationFrames - overlapOut - lastBeatEnd < 24) {
        issues.push(issue(`scene ${scene.id}.beats`, '关键动作后不足 24 帧稳定停留，可能在观众读完前进入转场。', 'warning'));
      }
    }
  }
  const sceneTotal = getTimelineDuration(storyboard);
  if (sceneTotal !== storyboard.project.durationFrames) {
    issues.push(issue('scenes', `scene 总时长 ${sceneTotal} 不等于 project.durationFrames ${storyboard.project.durationFrames}。`));
  }
  issues.push(...validateContentMapping(storyboard));
  return issues;
}
