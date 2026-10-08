import {recipeDisplayText} from './presentation.mjs';

// Keep the complete guide, while surfacing its own input and motion sections first.
export function recipeSections(markdown = '') {
  const sections = []; let section = {title: '', lines: []};
  const clean = line => line.replaceAll('`', '').replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1');
  for (const raw of recipeDisplayText(markdown).split('\n')) {
    const line = raw.trim();
    if (!line || /^# /u.test(line)) continue;
    if (/^## /u.test(line)) {
      if (section.lines.length) sections.push(section);
      section = {title: clean(line.slice(3)), lines: []};
    } else {
      const prefix = line.match(/^(输入要求|宿主\/输入|关键参数|时间预算|阶段与参数|关键要求)[：:](.*)$/u);
      if (prefix) {
        if (section.lines.length) sections.push(section);
        section = {title: prefix[1], lines: [clean(prefix[2].trim())]};
      } else section.lines.push(clean(line));
    }
  }
  if (section.lines.length) sections.push(section);
  return sections;
}
export function recipeOverview(markdown) {
  const sections = recipeSections(markdown);
  const motion = sections.find(s => /运动制作方案/u.test(s.title)) ?? sections.find(s => /动作阶段|动作与边界|动作|阶段与参数/u.test(s.title));
  const input = sections.find(s => /输入/u.test(s.title));
  // P2 has an unheaded motion paragraph immediately after its input requirements.
  const motionLines = motion?.lines ?? (input?.title === '输入要求' ? input.lines.slice(1) : []);
  return {input: input?.title === '输入要求' ? input.lines.slice(0, 1) : input?.lines ?? [], motion: motionLines};
}

// Export production meaning, not FrameLoom's schema. Limits come from the catalog;
// narrative motion/parameters come from the maintained guide. Overrides cover
// entries whose guides mix several auxiliary effects or chapter methods together.
const contentNames = {items: '内容条目', phrases: '标题短语', emphasis: '强调短语', subtitle: '副标题', title: '标题', source: '原文摘录', anchor: '主体', root: '根节点', subject: '主体', before: '变化前内容', after: '变化后内容', hub: '中枢', series: '数据序列', blocks: '文本段落', code: '代码原文', prefix: '句干', suffix: '结尾短语', keywords: '证据关键词', result: '结果或结论', metric: '指标', fronts: '卡片正面'};
const terms = {flagged: '指定标记名单', focusId: '重点项', before: '旧结构', lines: '逐行', characters: '逐字符', tokens: '语法着色片段', draw: '描画', hold: '停留', emphasis: '强调短语', highlight: '强调动作', trace: '描线', enter: '入场', reveal: '显现', dock: '停靠', demote: '标题让位', focus: '聚焦', beat: '动作时间窗', fronts: '卡片正面', items: '内容条目', variant: '效果分支', camera: '视角', prefix: '句干', subtitle: '副标题', phrases: '标题短语', scene: '镜头', title: '标题', connections: '连线', beats: '动作时间窗'};
function productionText(text) {
  return recipeDisplayText(text)
    .replace(/优先A式；/gu, '')
    .replace(/仍保留已注册(?:几何实现；)?/gu, '')
    .replace(/所有阶段读取显式 beat；/gu, '各动作安排独立时间窗；')
    .replace(/此处仅说明事件点.*$/gu, '音效可选；使用自行授权的声音，保持旁白清晰。')
    .replace(/\b(?:flagged|focusId|before|lines|characters|tokens|draw|hold|emphasis|highlight|trace|enter|reveal|dock|demote|focus|beat|fronts|items|variant|camera|prefix|subtitle|phrases|scene|title|connections|beats)\b/gu, word => terms[word]);
}
const parameters = {
  'research-stack': '2–5份资料，作者与资料逐项对应；每份至少阅读1秒后换卡，不能从一篇文章虚构多份文献。',
  'list-stack-press': '2–5条真实记录，保留原始顺序；每条落定至少0.4秒后再接下一条，计数在条目落位时增加。',
  'integration-hub': '旧结构、中枢和2–4个外围节点；每个外围节点恰好一条指向中枢的真实连接，节点落定约1/3秒后描画路径。',
  'scroll-brake': '4–8条真实记录；重点项必须属于列表，列表建立后才开始滚动聚焦；模糊由位移速度驱动，刹停时归零。',
  'chart-live': '4–24个带唯一短标签的非负采样值，注明单位与来源；量程来自整组数据，同时显示最近最多8项，末值等于最后一个真实样本。',
  'particle-sand-fill': '3–5根柱，非负数值与统一单位；标明每粒近似代表的数量，每柱最多80粒，最终柱值不由粒子取整决定。',
  'member-grid': '4–12名真实成员；指定需要标记的成员，必须属于集合。集合完全建立后逐项标记，分母只计算实际可见成员，绝不随机按百分比染色。可选同内容重排仅用同一组4–7名成员。',
  'ring-annotation': '一个主体和2–4条解释，每条解释以真实连线指向主体；可选微颤只作用于环轮廓，结束后清除。',
  'cycle-mechanism': '一个主体和3–4个有序节点；节点依次连向下一节点并回到首项，只有真实循环关系才可画成闭环。',
  'media-before-after': '两张同尺寸、同视角的不同真实图片，保留原始比例；滑柄与裁切同步，由8%推至76%，回落70%停留，再缓慢回到40%。',
  'document-write': '2–5个真实文本块，保留原文顺序；前段完成后才开始后段，只在当前书写段显示光标；可选扫描注释或扫描括角，每次仅一种。',
  'code-reveal': '完整保留原文、缩进与换行；在逐行或逐字符揭示中选择一种。语法着色拼接后的文本必须逐字符等于原文，不执行代码，过长则拆镜头。',
  'letterspace-materialize': '2–8个字形，各字显式提供可授权的SVG路径与字距；顺序组成完整标题，所有字形同时起笔，不逐字错峰。参考路径坐标范围120单位，无自动字体转路径能力。',
  'semantic-default': '按真实内容选择陈述、比较、顺序、关系、变化、指标或媒体构图；标题在0.6秒内显现，图解完成后再出现结论。',
  'compare-reveal': '2–3个选项，使用相同比较维度；已出现项持续可读，新入场或聚焦项取得视觉强调。',
  'network-expand': '一个主体与2–5个对象；每个对象恰好一条从主体出发的真实连接，连线避开文字，不把关联改写为因果。'
};
const overrides = {
  'integration-hub': {motion: '先阅读旧结构，再将同一个载体翻面露出中枢；中枢和外围节点同步进入，节点落定约1/3秒后同时描画真实连接。'},
  'scroll-brake': {motion: '先建立完整真实列表，再将指定重点项随整体滚动逐渐移到中央；运动模糊随速度变化，刹停时归零，其他条目降低对比度但保留上下文。'},
  'member-grid': {motion: '卡片按中心距离分环显影与缩放，没有飞入位移；集合完全建立后，逐项标记指定成员，统计分母只计算实际可见成员。'},
  'semantic-default': {motion: '标题先显现，按真实内容顺序展开图形节点与连接；图解动作完成后出现结论，保留静止阅读时间。'},
  'scanline-annotate-focus': {input: '已完成书写的文档与一个指定文本块。', motion: '正文先静止；扫描线向下扫过，经过指定文本块后显示贴合内容的框、连接线与注释，随后清除扫描运动。', params: '框的位置与尺寸绑定真实段落，不任意圈住无关区域。', traps: '视觉扫描只是示意，不代表软件完成了真实识别。'},
  'scan-bracket-sweep': {input: '已完成书写的静止文档。', motion: '四角括线进入，扫描线在文档范围内往返扫过；扫描完成后移除扫描线与括角，恢复清晰正文。', params: '扫描范围保持一致，正文位置不随扫描移动。', traps: '不把机械扫描描述为真实AI操作。'},
  'line-boil': {input: '环形图解的主体轮廓。', motion: '图解建立后，环轮廓出现轻量、确定性的手绘微颤；结束时清除扰动，回到静止轮廓。', params: '只扰动轮廓，不移动文字或连接说明；相同帧使用相同种子。', traps: '不拿抖动填补无意义长停留。'},
  'speed-ramp-freeze': {input: '4–8条真实记录与列表中的重点项。', motion: '列表向重点滚动，中途冻结并作标注；冻结结束后继续同一条运动轨迹，最终停在重点并清除运动模糊。', params: '冻结窗必须包含在聚焦运动窗内，冻结消耗真实时长，不重新播放或跳过原运动。', traps: '不能用冻结制造不存在的事件或把标注当作实测识别。'},
  'mosaic-reframe': {input: '同一集合的4–7张真实内容卡，指定其中一张作为重点。', motion: '网格完整建立后，原卡连续重排为一张大重点卡与其余较小卡；内容与成员数量保持不变，落定后静止阅读。', params: '4–7个成员，复用相同内容和标识，不创建新卡替换旧卡。', traps: '不使用高速瀑布作为正文最终阅读布局。'},
  'line-carry-transition': {input: '两个不同章节的代码或配置画面，已有同名、同语义的标题线。', motion: '旧章完整读完，已有标题线向前延伸承接下一章；两章在共享时间窗交接，然后新章正文进入并静止阅读。', params: '交接0.6–2.4秒；线条必须来自前后章相同语义，不凭空制造线或关系。'},
  'print-texture-transitions': {input: '两个不同章节的完整画面。', motion: '旧章读完，用确定性的墨迹形遮罩逐步显露新章；旧章与新章遮罩互补，完成时彻底清除旧字。', params: '交接0.6–2.4秒；墨迹只改变遮罩，不扭曲正文；一次接缝只用一种动作。'},
  'page-turn-transitions': {input: '两个不同章节的完整画面。', motion: '旧页面分为左右两半，向两侧打开；中央同步显露新页面，结束后新页面回到完整、精确原比例。', params: '交接0.6–2.4秒，采用对开半页；不包含立方体旋转变体。', traps: '旧页面两半与中央新页面的遮罩须互补，交接不能覆盖旁白字幕。'}
};
function contentRequirements(item) {
  return Object.entries(item.slots ?? {}).map(([key, value]) => {
    const count = value.min === value.max ? value.min : `${value.min}–${value.max}`;
    const bounds = [value.labelMax ? `标题最多${value.labelMax}字` : '', value.textMax ? `正文最多${value.textMax}字` : ''].filter(Boolean).join('，');
    return `${contentNames[key] ?? '内容'}：${count}项${bounds ? `，${bounds}` : ''}。`;
  });
}
export function portableRecipe(item) {
  const sections = recipeSections(item.recipe);
  const find = pattern => sections.find(section => pattern.test(section.title))?.lines ?? [];
  const override = overrides[item.id] ?? {};
  const input = override.input ? [override.input] : contentRequirements(item);
  if (!input.length) input.push(item.kind === 'hosted-action' ? '已建立的宿主内容与明确的动作目标；此配方为附加动作，不单独组成场景。' : item.kind === 'cross-scene-transition' ? '两个不同章节的完整画面与独立交接窗口。' : '有来源的文档、明确的内容关系及所需真实素材。');
  const motion = override.motion ? [override.motion] : recipeOverview(item.recipe).motion;
  const params = override.params ?? parameters[item.id] ?? find(/关键参数/u)[0];
  const traps = override.traps ? [override.traps] : find(/容易做错/u).length ? find(/容易做错/u) : item.provenance?.retained?.slice(1) ?? [];
  const timing = item.timing;
  const duration = [];
  if (item.kind === 'cross-scene-transition') duration.push(`旧章完成阅读 → ${item.minSec}–${item.maxSec}秒交接 → 新章正文 → 静止阅读；交接窗不覆盖旁白字幕。`);
  else if (timing?.actions) {
    const first = timing.actions.enter ?? timing.actions.reveal;
    if (first) duration.push(`单次入场${first.minSec}–${first.maxSec}秒；动作顺序按内容安排，最后留至少${timing.readingSec}秒完整阅读。`);
    if (timing.actions.focus) duration.push(`聚焦动作（使用时）${timing.actions.focus.minSec}–${timing.actions.focus.maxSec}秒。`);
    if (timing.itemHoldSec >= .4) duration.push(`逐项提示起点至少相隔${timing.itemHoldSec}秒。`);
  } else duration.push(item.id === 'marker-underline' ? '关键词落定后，用0.15–0.6秒画线，再保留完整阅读时间。' : `在宿主内容落定后安排独立动作窗；依旁白与内容阅读量确定时长，结束后至少${['scanline-annotate-focus','scan-bracket-sweep','line-boil','speed-ramp-freeze','mosaic-reframe'].includes(item.id) ? 1.2 : .8}秒静止阅读。`);
  duration.push('总时长由条目数量、旁白及阅读量决定；按输出帧率换算，不强套公开样片长度。');
  const sound = find(/声音建议/u);
  const source = item.provenance ?? {};
  const attribution = ['说明整理：FrameLoom；依据本项目独立实现的制作指南。'];
  if (source.repository && /^https:\/\//u.test(source.repository)) {
    attribution.push(`方法参考：${source.repository}`);
    const revision = source.commit ?? 'HEAD';
    for (const field of ['recipe', 'implementation']) if (source[field] && !source[field].includes('..') && !source[field].startsWith('/')) attribution.push(`${field === 'recipe' ? '参考文档' : '参考实现'}：${source.repository}/blob/${revision}/${source[field]}`);
    if (source.upstreamLicense) attribution.push(`参考项目许可：${source.upstreamLicense}；FrameLoom实现：${source.implementationLicense ?? '以仓库许可为准'}。`);
  }
  attribution.push('方法参考不包含上游图片、字体、音乐或媒体授权；这些素材需自行准备并登记来源。');
  const block = (name, lines, translate = true) => `## ${name}\n${lines.map(line => (translate ? productionText(line) : line).replace(/^- /u, '')).join('\n')}`;
  return [
    `# ${item.name}\n镜头 ID：${item.id}${item.variantId ? "\n配方范围：默认效果。" : ""}`,
    '请根据以下动效制作说明，在目标项目中实现类似镜头。字段与代码结构按目标项目组织；仅使用我提供或可核查的内容，缺少素材时先说明缺口。',
    block('适用内容', [item.purpose ?? item.description]),
    block('所需输入', [...input, '文字、数据、数量与关系须有真实来源，标记对象必须属于提供的集合。']),
    block('运动顺序', motion.length ? motion : [item.description]),
    block('时长与节拍', duration),
    block('关键参数', params ? [params, '像素参数随画布等比例调整；缩放与缓动参数保持其含义。'] : ['按内容尺寸测量布局，最终态保持清晰，超出阅读容量时拆镜头。']),
    block('声音建议', sound.length ? sound : ['默认无音效；可使用自行授权的旁白，声音不得遮盖主要信息。']),
    block('容易做错的地方', [...traps, '完成态停止运动并清除模糊；保留准确数值、原文及上下文，不用装饰补造事实。']),
    block('来源与使用边界', attribution, false)
  ].join('\n\n');
}
