import type {StoryboardScene} from '../schemas/storyboard';

export function readingUnits(value: string): number {
  return [...value].reduce((sum, char) => {
    if (/\s/u.test(char)) return sum;
    return sum + (/\p{Script=Han}|[\u3000-\u303f\uff00-\uffef]/u.test(char) ? 1 : 0.5);
  }, 0);
}

export function estimateVisibleReadingSeconds(scene: StoryboardScene): number {
  const headline = [scene.title, scene.primaryClaim ?? ''].map((part) => part.trim()).filter(Boolean);
  const content = [...new Set(scene.layers.flatMap((layer) => [layer.label ?? '', layer.text ?? '', layer.value === undefined ? '' : String(layer.value)]).map((part) => part.trim()).filter(Boolean))];
  const headlineUnits = headline.reduce((sum, part) => sum + readingUnits(part), 0);
  const contentUnits = content.reduce((sum, part) => sum + readingUnits(part), 0);
  // Diagram labels and the headline remain on screen together; do not bill the
  // viewer twice for the same reading window as if each region were a new slide.
  const units = scene.visual?.kind === 'statement' ? headlineUnits : Math.max(headlineUnits, contentUnits);
  return units / 5 + 1;
}
