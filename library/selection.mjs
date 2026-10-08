export function compatible(recipe, style, canvas) {
  return recipe.kind === 'scene' && recipe.styles.includes(style) && recipe.orientations.includes(canvas);
}
export function normalizeSelection(catalog, value = {}) {
  const style = catalog.styles.some(item => item.id === value.style) ? value.style : catalog.styles[0].id;
  const canvas = ['landscape', 'portrait'].includes(value.canvas) ? value.canvas : 'landscape';
  const selected = [...new Set(Array.isArray(value.selected) ? value.selected : [])].filter(id => {
    const recipe = catalog.recipes.find(item => item.id === id);
    return recipe && compatible(recipe, style, canvas);
  });
  const fonts = catalog.fonts ?? [];
  const validFont = fonts.some(item => item.id === value.font);
  const fontMode = validFont && value.fontMode !== 'recommended' ? 'manual' : 'recommended';
  const recommended = catalog.styles.find(item => item.id === style)?.recommendedFont ?? fonts[0]?.id;
  const font = fontMode === 'manual' ? value.font : recommended;
  return {style, canvas, selected, ...(fonts.length ? {font, fontMode} : {}), production: normalizeProduction(catalog, value.production)};
}
// The user chooses a deliverable and a voice route; the Agent owns files and project naming.
export function normalizeProduction(catalog, value = {}) {
  const presets = catalog.ttsPresets ?? [];
  return {
    goal: ['narrated', 'master'].includes(value?.goal) ? value.goal : 'narrated',
    audio: ['tts', 'external'].includes(value?.audio) ? value.audio : 'tts',
    ttsPreset: presets.some(p => p.id === value?.ttsPreset) ? value.ttsPreset : 'configured',
    review: value?.review === true
  };
}
export function createExports(catalog, selection) {
  const state = normalizeSelection(catalog, selection);
  if (!state.selected.length || state.selected.length !== selection.selected.length) throw new Error('请至少选择一个兼容镜头；组合中不能含无效镜头。');
  if (selection.font !== undefined && selection.font !== state.font) throw new Error('字体选项已失效，请重新选择。');
  if (selection.fontMode !== undefined && !['manual', 'recommended'].includes(selection.fontMode)) throw new Error('字体选择方式已失效，请重新选择。');
  const {goal, audio, ttsPreset, review} = state.production;
  for (const key of ['goal', 'audio', 'ttsPreset', 'review']) {
    if (selection.production?.[key] !== undefined && selection.production[key] !== state.production[key]) throw new Error('制作选项已失效，请重新选择。');
  }
  const purpose = goal === 'master' ? 'visual-master' : 'in-project-video';
  const audioMode = goal === 'master' ? 'silent' : audio;
  const mode = review ? 'review' : 'fast';
  const prompt = [`请使用 frame-loom Skill，根据我在对话中提供的文档与素材，制作${goal === 'master' ? '供后期剪辑的干净画面底片' : '带旁白的待审视频'}。尚未提供文档时先请我提供，不生成占位内容。`,
    `视频风格：${state.style}`, ...(state.font ? [`全片字体：${state.font}；初始化时使用 --font ${state.font}，标题、正文、图解和旁白字幕统一使用该字体家族。`] : []), `画幅：${state.canvas === 'landscape' ? '16:9 横屏' : '9:16 竖屏'}`,
    `可用镜头配方：${state.selected.join('、')}`,
    '根据原文自动生成简短项目主题，按项目规则创建带日期的生产目录，不要求我填写目录名。',
    `制作参数：--output-purpose ${purpose} --audio-mode ${audioMode} --mode ${mode}。`,
    '完整保留原文和来源；只在上述配方集合内编排，可重复、调整顺序或只用其中一部分，不补造事实。',
    review ? '先展示讲稿、分镜和时间安排，等我审核后再渲染。' : '完成讲稿、分镜、校验、渲染和 QA。'];
  if (goal === 'master') {
    prompt.push('底片无音轨、无旁白字幕和审片标记，保留画面标题与必要图解文字；同时提供讲稿与逐镜时间表，供后期配音和剪辑。');
  } else if (audio === 'external') {
    prompt.push('使用我提供的外部旁白文件；尚未提供时请我提供音频及可用的逐场或字幕时间信息。使用项目支持的外部音频配置，按实测旁白调整分镜，不调用 TTS，不退回静音结果。');
  } else if (ttsPreset === 'configured') {
    prompt.push('运行 list:tts-profiles 查看项目已启用的 TTS 配置；仅一个时使用它，多个时展示不含密钥的服务、模型和音色摘要让我选择，无可用配置时说明缺口并指导配置。实际使用时明确指定 --tts-config，按实测旁白调整分镜，不退回静音结果。');
  } else {
    const preset = catalog.ttsPresets.find(item => item.id === ttsPreset);
    prompt.push(`TTS 预设：${preset.name}；provider=${preset.provider}；${preset.model ? `model=${preset.model}；` : ''}${preset.voice ? `voiceType=${preset.voice}` : '音色使用本地配置解析的音色'}。`);
    prompt.push(`核对项目已启用配置与所选 ${preset.id} 公开预设是否匹配；匹配后明确使用该配置的 --tts-config。若未启用或参数不匹配，展示所需配置并确认后继续；不自动换服务、模型或音色，不退回静音结果。按实测旁白调整分镜。`);
  }
  prompt.push('返回实际项目路径、产物路径、时长与 QA 结果，说明完整播放复核仍需完成，不将自动 QA 当作交付批准。');
  return {prompt: prompt.join('\n'), purpose, audioMode, mode};
}
