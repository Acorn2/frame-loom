import {compatible} from './selection.mjs';
import {isFixedStyle} from './style-policy.mjs';
export {createCardPreviewPlayback as createStyleCardPlayback} from './playback.mjs';

const copy = {
  'annotated-reasoning': {features: '大幅主体 · 局部圈注 · 引线图解', use: '知识观察、细节解释、对象比较'},
  'editorial-typography': {features: '完整场景 · 连贯人物 · 细节取景', use: '知识故事、亲子观察、情境讲解'},
  'flat-explainer': {features: '大幅情境 · 有机曲线 · 连续入场', use: '情境讲解、关系解释、流程对照'},
  'paper-collage': {features: '阶梯模块 · 像素笔记 · 分块显现', use: '日常情境、逐项笔记、行动清单'},
  whiteboard: {features: '原创手绘贴纸 · 开放白板 · 逐笔展开', use: '观察笔记、流程拆解、知识解释'},
  'retro-zine': {features: '来源分栏 · 证据并置 · 比较推演', use: '文章、观点、报告与数据'},
  signal: {features: '石墨暗场 · 中央焦点 · 淡紫强调', use: '核心观点、转折、重点说明'},
  scatterbrain: {features: '黄色便签 · 中文楷体 · 手绘批注', use: '学习笔记、方法拆解'},
  'archive-grid': {features: '克莱因蓝 · 直角色块 · 强字号对比', use: '报告、分析、方法论'},
  'signal-noir': {features: '结构分层 · 路径展开 · 局部确认', use: '技术机制、系统流程'},
  'studio-frame': {features: '真实界面 · 连续取景 · 状态证据', use: '产品说明、操作步骤、更新'}
};
export function styleCardInfo(style, recipes, canvas) {
  const scenes = recipes.filter(recipe => compatible(recipe, style.id, canvas));
  const count = scenes.length;
  return {...copy[style.id], count, available: count > 0,
    capability: !count ? style.canvas?.length === 1 && style.canvas[0] === 'landscape' ? '仅支持横屏' : '当前画幅不支持'
      : isFixedStyle(style.id) ? '镜头自动编排' : count === 1 && scenes[0].id === 'semantic-default' ? '1 个基础镜头' : `${count} 个可用镜头`,
    basicOnly: count === 1 && scenes[0].id === 'semantic-default'};
}
