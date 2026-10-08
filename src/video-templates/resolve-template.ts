import previous from '../../video-templates/retro-zine-explainer/history/1.1.0.template.json';
import legacy from '../../video-templates/retro-zine-explainer/history/1.0.0.template.json';
import manifest from '../../video-templates/retro-zine-explainer/template.json';
import {VideoTemplateRefSchema, VideoTemplateSchema, type VideoTemplateRef} from '../schemas/video-template';
import type {Storyboard} from '../schemas/storyboard';
import {resolveShot} from '../shots/catalog';
export const VIDEO_TEMPLATES = [VideoTemplateSchema.parse(manifest)];
export function resolveVideoTemplate(ref: VideoTemplateRef) {
  VideoTemplateRefSchema.parse(ref);
  const template = [...VIDEO_TEMPLATES, VideoTemplateSchema.parse(previous), VideoTemplateSchema.parse(legacy)].find((item) => item.id === ref.id && item.version === ref.version);
  if (!template) throw new Error(`缺少视频模板 ${ref.id}@${ref.version}。`);
  for (const shot of template.shots) resolveShot(shot.id, shot.version);
  return template;
}
export function assertTemplateCompatibility(storyboard: Storyboard) {
  if (!storyboard.videoTemplate) return;
  const template = resolveVideoTemplate(storyboard.videoTemplate);
  if (storyboard.style.id !== template.defaultStyle.id || storyboard.style.version !== template.defaultStyle.version) throw new Error('videoTemplate 与 style 必须精确匹配默认风格。');
  const orientation = storyboard.project.width < storyboard.project.height ? 'portrait' : 'landscape';
  if (!template.orientations.includes(orientation)) throw new Error(`视频模板不支持 ${orientation}。`);
  for (const ref of storyboard.shotRecipes ?? []) if (!template.shots.some((shot) => shot.id === ref.id && shot.version === ref.version)) throw new Error(`${ref.id}: 所选配方不在预设模板集合中。`);
  for (const scene of storyboard.scenes) if (!template.shots.some((shot) => shot.id === scene.shot?.id && shot.version === scene.shot.version)) throw new Error(`${scene.id}: 镜头不在视频模板集合中。`);
}
