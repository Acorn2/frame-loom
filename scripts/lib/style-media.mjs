// Public style samples always come from the selected style's production renderer.
export function styleMediaSources(style) {
  const illustration = {'annotated-reasoning': 'annotated', 'editorial-typography': 'narrative'}[style.id];
  if (illustration) return {posterSource: `examples/illustration-directions/previews/${illustration}.png`, videoSource: `examples/illustration-directions/previews/${illustration}.mp4`};
  const direction = {'retro-zine': 'editorial', 'signal-noir': 'mechanism', 'studio-frame': 'product'}[style.id];
  if (direction) return {posterSource: `examples/scenario-directions/previews/${direction}.png`, videoSource: `examples/scenario-directions/previews/${direction}.mp4`};
  const suffix = style.id === 'whiteboard' ? 'original' : ['annotated-reasoning', 'editorial-typography'].includes(style.id) ? 'text-led' : style.role === 'primary' ? 'illustrated' : 'semantic';
  return {posterSource: `examples/template-families/previews/${style.id}-${suffix === 'semantic' ? 'semantic-process' : suffix}.png`, videoSource: `examples/template-families/previews/${style.id}-${suffix}.mp4`};
}
