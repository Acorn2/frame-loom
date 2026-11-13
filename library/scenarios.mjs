// Browsing context only: choosing a task must not mutate production choices.
const scenarios = [
  {id: 'product', sample: 'studio-frame', styles: ['studio-frame'], zh: ['产品介绍与功能教程', '真实截图、操作状态与结果，让观众看到功能如何完成任务。', '需要产品说明与真实截图'], en: ['Product demos and tutorials', 'Show real interfaces, operation states and outcomes so viewers can see the task being completed.', 'Product information and real screenshots']},
  {id: 'mechanism', sample: 'signal-noir', styles: ['signal-noir'], zh: ['原理、流程与系统', '从整体路径进入局部，用分层、时间轴和确认门解释关系。', '需要有依据的流程与关系'], en: ['Mechanisms, processes and systems', 'Move from the overall path into detail, using layers, timelines and decision gates.', 'A sourced process and supported relationships']},
  {id: 'editorial', sample: 'retro-zine', styles: ['retro-zine', 'archive-grid', 'signal'], zh: ['文章、观点与数据', '围绕判断、证据和对照组织画面，逐步推进解释。', '需要文章或带来源的数据'], en: ['Articles, arguments and data', 'Build an explanation around a claim, its evidence and useful comparisons.', 'An article or sourced data']},
  {id: 'knowledge', sample: 'whiteboard', styles: ['whiteboard', 'annotated-reasoning', 'editorial-typography', 'scatterbrain'], zh: ['知识与故事讲解', '用白板书写、批注和情境画面，将材料讲清楚。', '需要文档；部分画法需生成插画'], en: ['Knowledge and storytelling', 'Explain source material through whiteboard drawing, annotations and contextual visuals.', 'A document; some directions require image generation']}
];
export function scenarioItems(locale = 'zh') {return scenarios.map(s => ({...s, title: s[locale === 'en' ? 'en' : 'zh'][0], description: s[locale === 'en' ? 'en' : 'zh'][1], materials: s[locale === 'en' ? 'en' : 'zh'][2]}));}
export const variantStyles = ['signal', 'archive-grid', 'scatterbrain'];
export function scenarioStyles(styles, scenario, selected) {
  const task = scenarios.find(s => s.id === scenario);
  return styles.filter(style => !task || task.styles.includes(style.id) || style.id === selected);
}
export function directionRecipeHint(style, canvas, locale = 'zh') {
  if (canvas !== 'landscape' || !['retro-zine', 'signal-noir', 'studio-frame'].includes(style)) return '';
  const mechanism = style === 'signal-noir', editorial = style === 'retro-zine', recipe = editorial ? 'editorial-explainer' : mechanism ? 'mechanism-map' : 'product-showcase';
  return locale === 'en' ? `For this direction, evaluate ${recipe} after reading the source${editorial ? '; preserve source context, units and exact data values' : mechanism ? '; only draw supported relationships' : '; real local screenshots are required'}. This is a recommendation, not a fixed pool.`
    : `读取材料后，可优先评估 ${recipe}${editorial ? '，保留来源上下文、单位和数值原文' : mechanism ? '，只绘制有依据的关系' : '，必须提供真实本地截图'}；这是建议，不是固定镜头集合。`;
}
export const expressionTasks = [
  {id: 'all', zh: '全部表达', en: 'All tasks'}, {id: 'evidence', zh: '展示证据', en: 'Show evidence'},
  {id: 'relations', zh: '解释关系', en: 'Explain relationships'}, {id: 'compare', zh: '比较变化', en: 'Compare changes'},
  {id: 'steps', zh: '呈现步骤', en: 'Present steps'}, {id: 'opening', zh: '提出观点', en: 'State a claim'}
];
export function recipeHasTask(recipe, task) {
  const kinds = recipe.visualKinds ?? [];
  return !task || task === 'all' || (task === 'evidence' ? kinds.some(k => ['media', 'metric'].includes(k)) : task === 'relations' ? kinds.includes('network') : task === 'compare' ? kinds.some(k => ['compare', 'change'].includes(k)) : task === 'steps' ? kinds.includes('sequence') : task === 'opening' ? kinds.includes('statement') : true);
}
