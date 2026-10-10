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
const SEMANTIC_CONTENT_TYPES = new Set(['node', 'card', 'metric', 'screenshot', 'object']);
const UNUSED_LAYOUT_FIELDS = ['x', 'y', 'width', 'height', 'rotate', 'rotationDegrees', 'replacementGroup', 'visibleFrom', 'visibleUntil', 'state', 'target', 'color'];

function validateSemanticScene(scene: StoryboardScene): MappingIssue[] {
  const issues: MappingIssue[] = [];
  const visual = scene.visual;
  if (!visual) return [mappingIssue(scene, 'Storyboard 2.3 需要 visual：先定义画面解释的关系，再选择风格。', 'error')];
  if (visual.networkDirection && visual.kind !== 'network') issues.push(mappingIssue(scene, 'networkDirection 仅适用于 network。', 'error'));
  if (visual.shotPattern === 'document-conclusion-deal' && visual.kind !== 'network') issues.push(mappingIssue(scene, 'document-conclusion-deal 仅适用于 network。', 'error'));
  if (visual.changeMode && visual.kind !== 'change') issues.push(mappingIssue(scene, 'changeMode 仅适用于 change。', 'error'));
  if (visual.mediaFocus && (visual.kind !== 'media' || visual.mediaFocus.start + visual.mediaFocus.duration > scene.durationFrames)) issues.push(mappingIssue(scene, 'mediaFocus 仅适用于 media，且聚焦动作必须位于镜头内。', 'error'));
  const primary = scene.layers.filter((layer) => SEMANTIC_CONTENT_TYPES.has(layer.type));
  const nodes = primary.filter((layer) => layer.type === 'node' || layer.type === 'card');
  const metrics = primary.filter((layer) => layer.type === 'metric');
  const media = primary.filter((layer) => layer.type === 'screenshot' || layer.type === 'object');
  const expectedTemplate = visual.kind === 'statement' ? 'statement'
    : visual.kind === 'sequence' || visual.kind === 'network' ? 'graph-explainer'
      : visual.kind === 'change' || visual.kind === 'media' ? 'interaction-flow' : 'metric-grid';
  if (scene.template !== expectedTemplate) {
    issues.push(mappingIssue(scene, `${visual.kind} 画面需要 template: ${expectedTemplate}。`, 'error'));
  }
  if (!scene.primaryClaim?.trim()) issues.push(mappingIssue(scene, '每屏需要一句能独立理解的 primaryClaim。', 'error'));
  if (!scene.title.trim()) issues.push(mappingIssue(scene, '每屏标题应直接说出结论。', 'error'));
  if (visual.kind === 'media' ? visual.representation !== 'source-media' : visual.representation !== 'diagram') {
    issues.push(mappingIssue(scene, 'media 需要 source-media；其余语义图解需要 diagram，避免把示意图伪装成真实素材。', 'error'));
  }
  for (const layer of scene.layers) {
    if (UNUSED_LAYOUT_FIELDS.some((field) => field in layer && !(scene.shot?.id === 'media-before-after' && ['width','height','fit'].includes(field)) && !(scene.shot?.id === 'ai-stream-response' && field === 'state'))) issues.push(mappingIssue(scene, `layer ${layer.id} 含语义版式不会读取的坐标或状态字段。`, 'error'));
    const allowed = visual.kind === 'statement' ? ['label']
      : visual.kind === 'media' ? ['screenshot', 'object']
        : visual.kind === 'metric' ? ['metric'] : ['node', 'card'];
    if (!allowed.includes(layer.type)) issues.push(mappingIssue(scene, `${visual.kind} 画面不能显示 ${layer.type} 图层。`, 'error'));
    if (layer.glyph && !['node', 'card', 'metric'].includes(layer.type)) issues.push(mappingIssue(scene, `glyph 只能用于语义主体：${layer.id}。`, 'error'));
    if (['node', 'card'].includes(layer.type) && !(layer.label || layer.text)) issues.push(mappingIssue(scene, `layer ${layer.id} 缺少可见文字。`, 'error'));
  }
  if (visual.kind === 'statement' && (primary.length !== 0 || scene.connections.length > 0)) issues.push(mappingIssue(scene, 'statement 应作为简短章节或结论画面，不放关系卡片。', 'error'));
  if (visual.kind === 'compare' && (nodes.length < 2 || nodes.length > 3 || scene.connections.length > 0)) issues.push(mappingIssue(scene, 'compare 需要 2–3 个并列主体，不能画顺序连线。', 'error'));
  if (visual.kind === 'compare' && nodes.some((layer) => !layer.label?.trim() || !layer.text?.trim())) issues.push(mappingIssue(scene, 'compare 的每个主体都需要名称和具体差异说明，不能只放关键词图标。', 'error'));
  if (visual.kind === 'sequence') {
    if (nodes.length < 2 || nodes.length > 5) issues.push(mappingIssue(scene, 'sequence 需要 2–5 个按真实顺序排列的主体。', 'error'));
    const links = nodes.slice(0, -1).map((node, index) => scene.connections.find((link) => link.from === node.id && link.to === nodes[index + 1]?.id));
    if (scene.connections.length !== Math.max(0, nodes.length - 1) || links.some((link) => !link)) issues.push(mappingIssue(scene, 'sequence 的连接必须与主体顺序一一对应；不能凭数组顺序自动画箭头。', 'error'));
  }
  if (visual.kind === 'network') {
    if (nodes.length < 3 || nodes.length > 6 || !visual.anchorId || !nodes.some((node) => node.id === visual.anchorId)) issues.push(mappingIssue(scene, 'network 需要 3–6 个主体及存在的 anchorId。', 'error'));
    const branches = nodes.filter((node) => node.id !== visual.anchorId).map((node) => node.id);
    if (scene.connections.length !== branches.length || branches.some((id) => scene.connections.filter((link) => (visual.networkDirection === 'inward' ? link.from === id && link.to === visual.anchorId : link.from === visual.anchorId && link.to === id)).length !== 1)) issues.push(mappingIssue(scene, 'network 的连接必须符合 networkDirection：outward 中心向外，inward 各分支汇聚中心；每个分支恰好一条。', 'error'));
  }
  if (visual.shotPattern === 'document-conclusion-deal') {
    const source = nodes.find((node) => node.id === visual.anchorId);
    const conclusions = nodes.filter((node) => node.id !== visual.anchorId);
    if (nodes.length !== 4 || !source?.text?.trim() || conclusions.some((node) => !node.label?.trim() || !node.text?.trim()) || !visual.source?.trim()) {
      issues.push(mappingIssue(scene, '文档结论镜头需要一段有来源位置的原文摘录及三个有名称和说明的结论。', 'error'));
    }
    if (visual.networkDirection === 'inward') issues.push(mappingIssue(scene, '文档结论镜头的线索应从原文向外展开。', 'error'));
  }
  if (visual.kind === 'change') {
    if (nodes.length !== 2 || !visual.beforeId || !visual.afterId || visual.beforeId === visual.afterId
      || !nodes.some((node) => node.id === visual.beforeId) || !nodes.some((node) => node.id === visual.afterId)
      || scene.connections.length > 0) issues.push(mappingIssue(scene, 'change 需要两个明确的前后状态，不用顺序连线代替状态变化。', 'error'));
  }
  if (visual.changeMode === 'replace' && nodes[0]?.glyph !== nodes[1]?.glyph) issues.push(mappingIssue(scene, '同一对象状态变化需要保持相同 glyph。', 'error'));
  if (visual.kind === 'change' && nodes.some((layer) => !layer.label?.trim() || !layer.text?.trim())) issues.push(mappingIssue(scene, 'change 的前后状态都需要可见描述，说明实际发生了什么变化。', 'error'));
  if (visual.kind === 'metric' && (metrics.length < 1 || metrics.length > 4 || metrics.some((layer) => typeof layer.value !== 'number' || layer.value < 0 || !layer.label) || (metrics.length > 1 && !visual.unit))) issues.push(mappingIssue(scene, 'metric 需要 1–4 个有来源的非负数字及标签；多值比较需标明共同单位。', 'error'));
  if (visual.kind === 'metric' && !visual.source?.trim()) issues.push(mappingIssue(scene, 'metric 必须用 visual.source 记录数字来源位置。', 'error'));
  if (visual.kind === 'media' && (media.length !== 1 || scene.connections.length > 0)) issues.push(mappingIssue(scene, 'media 需要恰好一项真实素材，不以图解冒充截图。', 'error'));
  const contentIds = new Set([...primary, ...scene.layers.filter((layer) => visual.kind === 'statement' && layer.type === 'label')].map((layer) => layer.id));
  for (const beat of scene.beats) {
    const layerTarget = contentIds.has(beat.target);
    const connectionTarget = scene.connections.some((link) => link.id === beat.target);
    if (!(layerTarget && ['enter', 'reveal', 'focus', 'highlight', 'count'].includes(beat.action)) && !(connectionTarget && beat.action === 'draw')) {
      issues.push(mappingIssue(scene, `beat ${beat.id} 无法由 ${visual.kind} 语义画面执行。`, 'error'));
    }
    if (beat.action === 'count' && !metrics.some((layer) => layer.id === beat.target)) issues.push(mappingIssue(scene, `count beat ${beat.id} 只能作用于数字 metric。`, 'error'));
  }
  for (const layer of primary) {
    if (!scene.beats.some((beat) => beat.target === layer.id && ['enter', 'reveal', 'count'].includes(beat.action))) {
      issues.push(mappingIssue(scene, `主体 ${layer.id} 缺少可见入场 beat。`, 'error'));
    }
  }
  for (const layer of scene.layers.filter((item) => item.type === 'label')) {
    if (!scene.beats.some((beat) => beat.target === layer.id && ['enter', 'reveal'].includes(beat.action))) issues.push(mappingIssue(scene, `label ${layer.id} 缺少可见入场 beat。`, 'error'));
  }
  for (const link of scene.connections) {
    if (!scene.beats.some((beat) => beat.target === link.id && beat.action === 'draw')) issues.push(mappingIssue(scene, `connection ${link.id} 缺少 draw beat。`, 'error'));
  }
  if (visual.kind === 'change' && !scene.beats.some((beat) => beat.target === visual.afterId && ['enter', 'reveal'].includes(beat.action) && beat.start > 0)) issues.push(mappingIssue(scene, 'change 的后状态需要在前状态之后入场。', 'error'));
  return issues;
}

function overlaps(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return Math.max(start, otherStart) < Math.min(end, otherEnd);
}

export function validateContentMapping(storyboard: Storyboard): MappingIssue[] {
  const issues: MappingIssue[] = [];
  for (const scene of storyboard.scenes) {
    if (!['2.3', '2.4'].includes(storyboard.schemaVersion) && scene.visual && (scene.visual.networkDirection || scene.visual.changeMode || scene.visual.mediaFocus || scene.visual.shotPattern)) issues.push(mappingIssue(scene, '语义扩展只支持 Storyboard 2.3。', 'error'));
    if (storyboard.schemaVersion === '2.4' && !['semantic-default', 'compare-reveal', 'network-expand'].includes(scene.shot?.id ?? '')) {
      if (!scene.primaryClaim?.trim() || !scene.title.trim() || scene.visual?.representation !== (scene.shot?.id === 'media-before-after' ? 'source-media' : 'diagram') || scene.template !== (['network', 'sequence'].includes(scene.visual?.kind ?? '') ? 'graph-explainer' : scene.visual?.kind === 'metric' ? 'metric-grid' : 'statement')) issues.push(mappingIssue(scene, '配方需要主张、标题、diagram 与匹配的基础 template。', 'error'));
      if (scene.layers.some((layer) => UNUSED_LAYOUT_FIELDS.some((field) => field in layer && !(scene.shot?.id === 'media-before-after' && ['width','height','fit'].includes(field)) && !(scene.shot?.id === 'ai-stream-response' && field === 'state')))) issues.push(mappingIssue(scene, '配方不接受不会执行的坐标/状态字段。', 'error'));
      continue;
    }
    if (['2.3', '2.4'].includes(storyboard.schemaVersion)) {
      issues.push(...validateSemanticScene(scene));
      continue;
    }
    if (scene.purpose) {
      const sequencePurpose = ['opening', 'claim', 'process', 'closing'].includes(scene.purpose);
      const expectedTemplate = sequencePurpose ? 'graph-explainer' : scene.purpose === 'evidence' ? 'metric-grid' : 'statement';
      if (scene.template !== expectedTemplate) {
        issues.push(mappingIssue(scene, `${scene.purpose} 镜头的基础 template 必须为 ${expectedTemplate}。`, 'error'));
      }
      const content = scene.layers.filter((layer) => ['node', 'card'].includes(layer.type));
      const media = scene.layers.filter((layer) => ['screenshot', 'object'].includes(layer.type));
      const metrics = scene.layers.filter((layer) => layer.type === 'metric');
      const allowed = sequencePurpose ? new Set(['node', 'card', 'annotation'])
        : scene.purpose === 'evidence' ? new Set(['metric'])
          : scene.purpose === 'media' ? new Set(['screenshot', 'object'])
          : new Set(['annotation', 'label']);
      for (const layer of scene.layers) {
        if (!allowed.has(layer.type)) issues.push(mappingIssue(scene, `${scene.purpose} 镜头尚不能显示 ${layer.type} 图层。`, 'error'));
        if (['x', 'y', 'width', 'height', 'rotate', 'rotationDegrees', 'replacementGroup', 'visibleFrom', 'visibleUntil', 'state', 'target', 'color'].some((key) => key in layer)) {
          issues.push(mappingIssue(scene, `layer ${layer.id} 含镜头职责版式不会读取的坐标、状态或外观字段。`, 'error'));
        }
      }
      for (const beat of scene.beats) {
        if (!['enter', 'reveal', 'focus', 'highlight', 'count'].includes(beat.action) || !scene.layers.some((layer) => layer.id === beat.target && ['node', 'card', 'metric', 'screenshot', 'object'].includes(layer.type))) {
          issues.push(mappingIssue(scene, `beat ${beat.id} 无法由镜头职责版式执行；目前仅支持作用于主体内容层的 enter/reveal/focus/highlight/count。`, 'error'));
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
      if (sequencePurpose && (content.length < 2 || content.length > 5)) {
        issues.push(mappingIssue(scene, `${scene.purpose} 镜头需要 2–5 个 node/card 内容层。`, 'error'));
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
