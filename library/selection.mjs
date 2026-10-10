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
  // Keep existing hand-picked pools; new visitors can start from a document alone.
  const shotSelection = ['auto', 'manual'].includes(value.shotSelection) ? value.shotSelection
    : Array.isArray(value.selected) && value.selected.length ? 'manual' : 'auto';
  return {style, canvas, selected, shotSelection, ...(fonts.length ? {font, fontMode} : {}), production: normalizeProduction(catalog, value.production)};
}
export function shotSelectionWarning(catalog, selection) {
  const state = normalizeSelection(catalog, selection);
  const recipes = state.selected.map(id => catalog.recipes.find(item => item.id === id));
  return state.shotSelection === 'manual' && recipes.length && recipes.every(item => item.category === '标题')
    ? '当前集合只有标题镜头，适合短标题或章节路标；长篇讲解可能变成重复字卡。建议根据文档自动选镜头，或补充能解释正文的配方。' : '';
}
// The user chooses a deliverable and a voice route; the Agent owns files and project naming.
export function normalizeProduction(catalog, value = {}) {
  const presets = catalog.ttsPresets ?? [];
  return {
    goal: ['narrated', 'master'].includes(value?.goal) ? value.goal : 'narrated',
    audio: ['tts', 'external'].includes(value?.audio) ? value.audio : 'tts',
    ttsPreset: presets.some(p => p.id === value?.ttsPreset) ? value.ttsPreset : 'configured',
    review: value?.review === true,
    colorMode: ['auto', 'style', 'source'].includes(value?.colorMode) ? value.colorMode : 'auto'
  };
}
export function createExports(catalog, selection) {
  const state = normalizeSelection(catalog, selection);
  if (selection.shotSelection !== undefined && !['auto', 'manual'].includes(selection.shotSelection)) throw new Error('镜头选择方式已失效，请重新选择。');
  if (state.shotSelection === 'manual' && (!state.selected.length || state.selected.length !== selection.selected?.length)) throw new Error('请至少选择一个兼容镜头；组合中不能含无效镜头。');
  if (!catalog.recipes.some(recipe => compatible(recipe, state.style, state.canvas))) throw new Error('当前风格与画幅没有兼容镜头，请更换组合。');
  if (selection.font !== undefined && selection.font !== state.font) throw new Error('字体选项已失效，请重新选择。');
  if (selection.fontMode !== undefined && !['manual', 'recommended'].includes(selection.fontMode)) throw new Error('字体选择方式已失效，请重新选择。');
  const {goal, audio, ttsPreset, review, colorMode} = state.production;
  for (const key of ['goal', 'audio', 'ttsPreset', 'review', 'colorMode']) {
    if (selection.production?.[key] !== undefined && selection.production[key] !== state.production[key]) throw new Error('制作选项已失效，请重新选择。');
  }
  if (colorMode === 'source' && state.canvas !== 'landscape') throw new Error('跟随产品素材配色目前支持横屏，请切换画幅或选择风格配色。');
  const purpose = goal === 'master' ? 'visual-master' : 'in-project-video';
  const audioMode = goal === 'master' ? 'silent' : audio;
  const mode = review ? 'review' : 'fast';
  const prompt = [`请使用 frame-loom Skill，根据我在对话中提供的文档与素材，制作${goal === 'master' ? '供后期剪辑的干净画面底片' : '带旁白的待审视频'}。尚未提供文档时先请我提供，不生成占位内容。`,
    `视频风格：${state.style}`, ...(state.font ? [`全片字体：${state.font}；初始化时使用 --font ${state.font}，标题、正文、图解和旁白字幕统一使用该字体家族。`] : []), `画幅：${state.canvas === 'landscape' ? '16:9 横屏' : '9:16 竖屏'}`,
    ...(state.shotSelection === 'auto' ? [
      '镜头选择方式：根据文档自动推荐。先读取文档，再推荐组合并逐场编排。',
      `先读取文档，再运行 list:shots -- --style ${state.style} --canvas ${state.canvas}，从实际兼容配方中选择互补集合；选定后初始化时显式传入 --shots。`,
      '先说明每场的来源、观众要理解的内容、画面表达、配方与选择理由，以及素材需求，写入 shot-map.md；不按分类凑齐，不为增加种类补造关系、日期或数据。'
    ] : [
      '镜头选择方式：使用用户指定集合，严格限定。',
      `可用镜头配方：${state.selected.join('、')}`,
      '仅在指定集合内按文档编排，可重复或只使用其中一部分；不足时说明具体缺口，不擅自添加配方。',
      ...(shotSelectionWarning(catalog, state) ? [shotSelectionWarning(catalog, state)] : [])
    ]),
    `画面配色：${{auto: '自动判断', style: '使用风格配色', source: '跟随产品素材'}[colorMode]}；初始化时使用 --color-mode ${colorMode}。`,
    colorMode === 'style' ? '保留风格默认配色，不启用项目配色；真实截图保持原貌。'
      : colorMode === 'source' ? '使用我提供的主体产品截图或准确网址确定全片配色；网址先用 ego-browser 或可用浏览器截图到本地并登记来源。缺少有效参考时说明缺口，不静默回退。'
        : '自动判断配色来源：横屏产品介绍优先采用主体产品素材配色；纯文档、引用图、竞品证据或尚未支持的组合使用风格配色并说明判断。用户明确给出的品牌色优先。',
    '区分画面素材与配色参考；仅取色的截图不必出镜。采用主体产品素材配色时，背景、标题/正文、表面及强调色均参考截图，不能只替换按钮颜色；风格保留构图、装饰与动效，不覆盖素材配色。',
    '新项目配色使用 palette 1.1：逐角色记录采样区域、候选色、采用色及推导理由；背景、正文和强调色必须有直接采样。保留字体与镜头选择，真实素材不染色；渲染前后对照截图检查画布、标题/正文、卡片、图解及字幕。',
    '根据原文自动生成简短项目主题，按项目规则创建带日期的生产目录，不要求我填写目录名。',
    `制作参数：--output-purpose ${purpose} --audio-mode ${audioMode} --mode ${mode}。`,
    `完整保留原文和来源；只在${state.shotSelection === 'auto' ? '根据文档选定并记录的' : '上述'}配方集合内编排，可重复、调整顺序或只用其中一部分，不补造事实。`,
    '渲染前检查重复构图、正文是否只有标题、关键步骤与差异是否有对应画面、动作是否过早完成；按讲解顺序安排有意义的变化，必要阅读停留可保留并说明理由。不要用装饰动画消除警告，手动集合不足时说明限制，不擅自加配方。',
    review ? `先展示${state.shotSelection === 'auto' ? '推荐组合' : '指定集合内的镜头安排'}、讲稿、分镜和时间安排，等我审核后再渲染。` : `简要展示${state.shotSelection === 'auto' ? '推荐组合与逐场选择理由' : '指定集合内的逐场安排与选择理由'}后直接继续，完成讲稿、分镜、校验、渲染和 QA；不新增组合确认步骤。`];
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
