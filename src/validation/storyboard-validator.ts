import fs from 'node:fs';
import path from 'node:path';
import {CAPABILITY_MANIFEST} from '../renderer/capability-manifest';
import {StoryboardSchema, type Storyboard, type StoryboardLayer, type StoryboardScene} from '../schemas/storyboard';
import {MotionPackSchema, StyleIndexSchema, StylePackSchema, type StylePack} from '../schemas/style-pack';
import {validateContentMapping} from './mapping-validator';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationOptions {
  storyboardPath?: string;
  styleRoot?: string;
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
  if (layer.type === 'screenshot') {
    if (!layer.asset) {
      issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, 'screenshot 必须声明 asset 路径。'));
    } else if (storyboardPath) {
      const assetPath = path.resolve(path.dirname(storyboardPath), layer.asset);
      if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile() || fs.statSync(assetPath).size === 0) {
        issues.push(issue(`scene ${scene.id}, layer ${layer.id}`, `asset 不存在或为空：${layer.asset}`));
      }
    }
  }
}

function validateScene(scene: StoryboardScene, issues: ValidationIssue[], storyboardPath: string | undefined, style?: StylePack) {
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
  }
  for (const caption of scene.captions) {
    if (caption.end <= caption.start || caption.end > scene.durationFrames) {
      issues.push(issue(`scene ${scene.id}, caption ${caption.id}`, 'caption 时间必须位于当前 scene 内。'));
    }
  }
}

const STORYBOARD_STATUS_FOR_RENDER = new Set(['reviewed', 'approved']);

export function validateStoryboard(value: unknown, options: ValidationOptions = {}): ValidationIssue[] {
  const parsed = StoryboardSchema.safeParse(value);
  if (!parsed.success) return zodIssues('$', parsed.error.issues);

  const storyboard = parsed.data;
  const issues: ValidationIssue[] = [];
  if (!STORYBOARD_STATUS_FOR_RENDER.has(storyboard.project.status)) {
    issues.push(issue('project.status', `不支持的 project.status "${storyboard.project.status}"。`));
  }
  const style = options.styleRoot ? validateStyleReference(storyboard, options.styleRoot, issues) : undefined;

  if (Math.round(storyboard.project.durationSec * storyboard.project.fps) !== storyboard.project.durationFrames) {
    issues.push(issue('project.durationFrames', '必须等于 durationSec × fps。'));
  }
  const sceneIds = new Set<string>();
  let sceneTotal = 0;
  for (const scene of storyboard.scenes) {
    if (sceneIds.has(scene.id)) issues.push(issue(`scenes.${scene.id}`, 'scene id 必须唯一。'));
    sceneIds.add(scene.id);
    sceneTotal += scene.durationFrames;
    validateScene(scene, issues, options.storyboardPath, style);
  }
  if (sceneTotal !== storyboard.project.durationFrames) {
    issues.push(issue('scenes', `scene 总时长 ${sceneTotal} 不等于 project.durationFrames ${storyboard.project.durationFrames}。`));
  }
  issues.push(...validateContentMapping(storyboard));
  return issues;
}
