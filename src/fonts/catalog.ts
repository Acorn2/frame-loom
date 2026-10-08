import index from '../../fonts/font-index.json' with {type: 'json'};

// Approved: styles and a single project-wide font family are independent choices.
export const FONT_IDS = ['source-han-sans-sc', 'source-han-serif-sc', 'lxgw-wenkai', 'smiley-sans', 'xiaolai'] as const;
export type FontId = typeof FONT_IDS[number];
export interface FontRef {id: FontId; version: string}
export const FONT_CATALOG = index.fonts;

export function resolveFont(ref: FontRef) {
  const font = FONT_CATALOG.find(item => item.id === ref.id);
  if (!font || font.version !== ref.version) throw new Error(`未知字体或字体版本不匹配：${ref.id}@${ref.version}`);
  return font;
}

export function recommendedFont(styleId: string): FontRef {
  const id = index.recommended[styleId as keyof typeof index.recommended] ?? 'source-han-sans-sc';
  const font = FONT_CATALOG.find(item => item.id === id)!;
  return {id: font.id as FontId, version: font.version};
}
