import type {StoryboardLayer} from '../schemas/storyboard';

// Short catalog examples get a stronger hierarchy. Long production inputs retain
// the existing compact treatment; preflight uses the same choice as the renderer.
export function documentConclusionType(layer: StoryboardLayer) {
  return (layer.text?.length ?? 0) > 16 || (layer.label?.length ?? 0) > 6
    ? {label: 44, text: 30} : {label: 60, text: 40};
}
export function listType(items: StoryboardLayer[]) {
  const compact = items.length === 4;
  const dense = items.some(item => (item.label?.length ?? 0) > 9 || (item.text?.length ?? 0) > 18);
  return dense ? {label: compact ? 40 : 48, text: compact ? 30 : 36}
    : {label: compact ? 56 : 64, text: compact ? 40 : 44};
}
export function titleType(title: string) {
  return Math.min(136, Math.floor(1550 / Math.max(1, [...title].length)));
}
export function wordType(words: string[], prefix: string, suffix = '') {
  const length = [...prefix + suffix].length + Math.max(...words.map(word => [...word].length));
  return Math.min(144, Math.floor(1400 / Math.max(1, length)));
}
