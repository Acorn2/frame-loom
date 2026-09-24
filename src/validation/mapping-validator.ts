import type {Storyboard, StoryboardScene} from '../schemas/storyboard';

export interface MappingIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

const mappingIssue = (scene: StoryboardScene, message: string, severity: MappingIssue['severity'] = 'warning'): MappingIssue => ({
  path: `scene ${scene.id}.mapping`, message, severity
});

const CONTENT_LAYER_TYPES = new Set(['node', 'card', 'metric', 'screenshot', 'annotation', 'object', 'callout']);

function overlaps(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return Math.max(start, otherStart) < Math.min(end, otherEnd);
}

export function validateContentMapping(storyboard: Storyboard): MappingIssue[] {
  const issues: MappingIssue[] = [];
  for (const scene of storyboard.scenes) {
    if (scene.purpose) {
      const expectedTemplate = scene.purpose === 'process' ? 'graph-explainer' : scene.purpose === 'evidence' ? 'metric-grid' : 'statement';
      if (scene.template !== expectedTemplate) {
        issues.push(mappingIssue(scene, `${scene.purpose} 镜头的基础 template 必须为 ${expectedTemplate}。`, 'error'));
      }
      const content = scene.layers.filter((layer) => ['node', 'card'].includes(layer.type));
      const media = scene.layers.filter((layer) => ['screenshot', 'object'].includes(layer.type));
      const metrics = scene.layers.filter((layer) => layer.type === 'metric');
      const allowed = scene.purpose === 'process' ? new Set(['node', 'card'])
        : scene.purpose === 'evidence' ? new Set(['metric'])
          : scene.purpose === 'media' ? new Set(['screenshot', 'object'])
            : new Set(['annotation']);
      for (const layer of scene.layers) {
        if (!allowed.has(layer.type)) issues.push(mappingIssue(scene, `${scene.purpose} 镜头尚不能显示 ${layer.type} 图层。`, 'error'));
        if (['x', 'y', 'width', 'height', 'rotate', 'rotationDegrees', 'replacementGroup', 'visibleFrom', 'visibleUntil', 'state', 'target', 'color'].some((key) => key in layer)) {
          issues.push(mappingIssue(scene, `layer ${layer.id} 含镜头职责版式不会读取的坐标、状态或外观字段。`, 'error'));
        }
      }
      if (scene.connections.length > 0) issues.push(mappingIssue(scene, '镜头职责版式暂不支持 connection；请使用 process 的顺序内容层。', 'error'));
      for (const beat of scene.beats) {
        if (!['enter', 'reveal', 'count'].includes(beat.action) || !scene.layers.some((layer) => layer.id === beat.target && ['node', 'card', 'metric', 'screenshot', 'object'].includes(layer.type))) {
          issues.push(mappingIssue(scene, `beat ${beat.id} 无法由镜头职责版式执行；目前仅支持作用于主体内容层的 enter/reveal/count。`, 'error'));
        }
        if (beat.action === 'count' && !scene.layers.some((layer) => layer.id === beat.target && layer.type === 'metric' && typeof layer.value === 'number')) {
          issues.push(mappingIssue(scene, `count beat ${beat.id} 需要数字类型的 metric.value。`, 'error'));
        }
      }
      if (scene.layers.filter((layer) => layer.type === 'annotation').length > 1) {
        issues.push(mappingIssue(scene, '每个镜头最多使用一个 annotation 作为副标题。', 'error'));
      }
      if (['opening', 'claim', 'closing'].includes(scene.purpose) && !scene.title.trim()) {
        issues.push(mappingIssue(scene, `${scene.purpose} 镜头需要标题或结论。`, 'error'));
      }
      if (scene.purpose === 'process' && (content.length < 2 || content.length > 5)) {
        issues.push(mappingIssue(scene, 'process 镜头需要 2–5 个 node/card 内容层。', 'error'));
      }
      if (scene.purpose === 'evidence' && (metrics.length < 1 || metrics.length > 3 || metrics.some((layer) => layer.value === undefined || !layer.label))) {
        issues.push(mappingIssue(scene, 'evidence 镜头需要 1–3 个带 value 和 label 的 metric。', 'error'));
      }
      if (scene.purpose === 'media' && media.length !== 1) {
        issues.push(mappingIssue(scene, 'media 镜头目前需要恰好一个 screenshot/object 素材层。', 'error'));
      }
      continue;
    }
    if (scene.layers.length === 0) issues.push(mappingIssue(scene, 'scene 至少需要一个可见 layer。', 'error'));
    const layerIds = new Set(scene.layers.map((layer) => layer.id));
    const connectionIds = new Set(scene.connections.map((connection) => connection.id));
    const targetIds = new Set([...layerIds, ...connectionIds]);
    const validBeats = scene.beats.filter((beat) => targetIds.has(beat.target));

    if (scene.narration.length > 80 && validBeats.length === 0) {
      issues.push(mappingIssue(scene, '较长 narration 没有触达当前 scene layer 或 connection 的有效 beat，画面可能长时间静止。'));
    }
    if (scene.captions.length > 0 && validBeats.length === 0) {
      issues.push(mappingIssue(scene, '存在 caption 但没有 active target 或 beat。'));
    }
    for (const caption of scene.captions) {
      if (!validBeats.some((beat) => overlaps(caption.start, caption.end, beat.start, beat.start + beat.duration))) {
        issues.push(mappingIssue(scene, `caption "${caption.id}" 的时间窗口没有与任何 beat 重叠，字幕内容可能缺少对应画面。`));
      }
    }

    const contentLayers = scene.layers.filter((layer) => CONTENT_LAYER_TYPES.has(layer.type));
    if (contentLayers.length > 1) {
      const touchedLayerIds = new Set(validBeats.filter((beat) => layerIds.has(beat.target)).map((beat) => beat.target));
      const untouchedLayerIds = contentLayers
        .filter((layer) => !touchedLayerIds.has(layer.id))
        .map((layer) => layer.id);
      if (untouchedLayerIds.length > 0) {
        issues.push(mappingIssue(
          scene,
          `内容 layer 未被任何 beat 触达：${untouchedLayerIds.join(', ')}。`
        ));
      }
    }

    if (scene.template === 'graph-explainer') {
      if (scene.layers.filter((layer) => layer.type === 'node').length < 2) {
        issues.push(mappingIssue(scene, 'graph-explainer 至少需要两个 node。', 'error'));
      }
      if (scene.connections.length === 0) issues.push(mappingIssue(scene, 'graph-explainer 至少需要一条 connection。', 'error'));
      for (const connection of scene.connections) {
        if (!scene.beats.some((beat) => beat.target === connection.id && beat.action === 'draw')) {
          issues.push(mappingIssue(scene, `connection "${connection.id}" 缺少 draw beat。`));
        }
      }
    }
    if (scene.template === 'metric-grid' && scene.layers.filter((layer) => layer.type === 'metric').length < 2) {
      issues.push(mappingIssue(scene, 'metric-grid 至少需要两个 metric，才能形成比较或结构。', 'error'));
    }
    if (scene.template === 'interaction-flow') {
      const screenshots = scene.layers.filter((layer) => layer.type === 'screenshot');
      if (screenshots.length < 2) issues.push(mappingIssue(scene, 'interaction-flow 至少需要两个 screenshot 状态。', 'error'));
      if (screenshots.length >= 2 && !screenshots.some((layer) => layer.visibleFrom !== undefined || layer.visibleUntil !== undefined)) {
        issues.push(mappingIssue(scene, 'interaction-flow 的 screenshot 缺少可见时间窗口，无法表达状态变化。', 'error'));
      }
    }

    const lastBeatEnd = Math.max(0, ...scene.beats.map((beat) => beat.start + beat.duration));
    if (scene.beats.length > 0 && scene.durationFrames - lastBeatEnd < 12) {
      issues.push(mappingIssue(scene, '最后一个 beat 后少于 12 帧停留，结论可能来不及阅读。'));
    }
  }
  return issues;
}
