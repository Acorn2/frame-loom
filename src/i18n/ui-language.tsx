import React from 'react';

// UI chrome language for rendered frames. The storyboard declares it via
// project.language ('zh' | 'en'); anything rendered outside a provider
// (legacy compositions, tests) keeps the historical Chinese chrome.
export type UiLanguage = 'zh' | 'en';

const UiLanguageContext = React.createContext<UiLanguage>('zh');

export const UiLanguageProvider = UiLanguageContext.Provider;

export function useUiLanguage(): UiLanguage {
  return React.useContext(UiLanguageContext);
}

export interface UiText {
  sourcePrefix: string;
  excerptPrefix: string;
  diagramBadge: string;
  sourceMediaBadge: string;
  diagramPanel: string;
  kindLabels: Record<'statement' | 'compare' | 'sequence' | 'network' | 'change' | 'metric' | 'media', string>;
  before: string;
  after: string;
  statementMeta: {opening: string; claim: string; closing: string};
  diagramObjectFallback: string;
  particleNote: (grainUnit: string | number, unit: string) => string;
  dotEquals: (unit: string) => string;
  timelineNote: (source: string) => string;
  sourcesCounter: (total: number) => string;
  flaggedNote: (flagged: number, total: number) => string;
  annotatedLabel: string;
  holdReview: string;
  placedItems: string;
  samplingOrder: string;
  glyphNote: string;
  routeFallback: string;
}

const ZH: UiText = {
  sourcePrefix: '来源：',
  excerptPrefix: '原文摘录 / ',
  diagramBadge: '示意图',
  sourceMediaBadge: '来源素材',
  diagramPanel: '图解',
  kindLabels: {statement: '观点', compare: '对照', sequence: '顺序', network: '关联', change: '变化', metric: '数据', media: '素材'},
  before: '之前',
  after: '之后',
  statementMeta: {opening: '开篇', claim: '观点', closing: '结语'},
  diagramObjectFallback: '示意对象',
  particleNote: (grainUnit, unit) => `每粒约 ${grainUnit} ${unit}；柱高表示输入总量`,
  dotEquals: (unit) => `每个点 = 1 ${unit}`,
  timelineNote: (source) => `日期按顺序等距排列，不表示时间跨度 · ${source}`,
  sourcesCounter: (total) => `/${total} 份资料`,
  flaggedNote: (flagged, total) => `${flagged}/${total} 个输入成员被标记；不含虚构头像`,
  annotatedLabel: '已标注',
  holdReview: '停留复核',
  placedItems: '已落位条目',
  samplingOrder: '采样顺序 →',
  glyphNote: '所有字形共享描画进度 · 使用输入路径',
  routeFallback: '沿着一个入口继续回查，不必重新搜索。'
};

const EN: UiText = {
  sourcePrefix: 'Source: ',
  excerptPrefix: 'Excerpt / ',
  diagramBadge: 'Diagram',
  sourceMediaBadge: 'Source media',
  diagramPanel: 'Diagram',
  kindLabels: {statement: 'Claim', compare: 'Compare', sequence: 'Sequence', network: 'Network', change: 'Change', metric: 'Data', media: 'Media'},
  before: 'Before',
  after: 'After',
  statementMeta: {opening: 'Opening', claim: 'Claim', closing: 'Closing'},
  diagramObjectFallback: 'Diagram element',
  particleNote: (grainUnit, unit) => `Each dot ≈ ${grainUnit} ${unit}; bar height shows the total`,
  dotEquals: (unit) => `Each dot = 1 ${unit}`,
  timelineNote: (source) => `Dates are spaced evenly in sequence order — spacing does not show elapsed time · ${source}`,
  sourcesCounter: (total) => `/${total} sources`,
  flaggedNote: (flagged, total) => `${flagged} of ${total} input members flagged; no fictional avatars`,
  annotatedLabel: 'Annotated',
  holdReview: 'Hold to review',
  placedItems: 'Placed items',
  samplingOrder: 'Sampling order →',
  glyphNote: 'All glyphs share one draw progress · using the input paths',
  routeFallback: 'Keep tracing from one entry point — no need to search again.'
};

export function uiText(language: UiLanguage): UiText {
  return language === 'en' ? EN : ZH;
}

export function useUiText(): UiText {
  return uiText(useUiLanguage());
}
