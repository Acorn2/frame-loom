// Present the reusable recipe without exposing internal release bookkeeping.
// Keep source Markdown, motion parameters, compatibility and QA limits intact.
export function recipeDisplayText(text) {
  return text
    .replace(/场景旧版[^。\n]*仍按[^。\n]*解析，新建项目选当前版本。/gu, '')
    .replace(/当前版本\s+\d+\.\d+\.\d+。/gu, '')
    .replace(/(?:精确版本为|版本)\s+\d+\.\d+\.\d+，/gu, '')
    .replace(/@\d+\.\d+\.\d+/gu, '')
    .replace(/\b\d+\.\d+\.\d+\s+(?=experimental)/gu, '')
    .replace(/已注册\d+\.\d+\.\d+/gu, '已注册')
    .replace(/^## 版本与验证边界$/gmu, '## 验证边界')
    .replace(/^## \d+\.\d+\.\d+ /gmu, '## ');
}
export function previewStatusText(item) {
  return item.previewStatus === 'stale' ? '样片待更新' : '样片待生成';
}

// Never substitute another style's media when the chosen sample is missing.
export function recipePreview(item, style, canvas = 'landscape') {
  if (!item.stylePreviews) return item;
  const preview = item.stylePreviews.find(sample => sample.style === style && (sample.canvas ?? 'landscape') === canvas);
  return {...item, poster: preview?.poster ?? null, video: preview?.video ?? null,
    previewStatus: preview?.previewStatus ?? 'missing', sampleStyle: style, sampleCanvas: canvas,
    previewVariants: item.previewVariants?.map(variant => recipePreview(variant, style, canvas))};
}
