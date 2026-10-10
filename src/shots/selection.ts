import {ShotSelectionSchema, type ShotRef} from '../schemas/shot-recipe';
import type {Storyboard} from '../schemas/storyboard';
import type {ShotContext} from './compile-shot';
import {resolveShot} from './catalog';

// A creator-selected pool constrains planning; it is not a forced shot sequence.
export function assertShotSelectionCompatibility(selection: readonly ShotRef[], context: ShotContext) {
  const shots = ShotSelectionSchema.parse(selection);
  const orientation = context.width < context.height ? 'portrait' : 'landscape';
  for (const ref of shots) {
    const recipe = resolveShot(ref.id, ref.version);
    if (!recipe.styles.includes(context.style.id) || (ref.id !== 'semantic-default' && context.style.version !== '1.0.0')) throw new Error(`${ref.id}@${ref.version} 尚未适配风格 ${context.style.id}@${context.style.version}。`);
    if (!recipe.orientations.includes(orientation) || (ref.id !== 'semantic-default' && Math.abs(context.width / context.height - (orientation === 'portrait' ? 9 / 16 : 16 / 9)) > 0.001)) throw new Error(`${ref.id}@${ref.version} 尚未适配该画幅。`);
  }
}

export function assertStoryboardShotSelection(storyboard: Storyboard) {
  if (!storyboard.shotRecipes) return;
  assertShotSelectionCompatibility(storyboard.shotRecipes, {...storyboard.project, style: storyboard.style});
  for (const scene of storyboard.scenes) {
    if (!storyboard.shotRecipes.some((ref) => ref.id === scene.shot?.id && ref.version === scene.shot.version)) throw new Error(`${scene.id}: 镜头 ${scene.shot?.id} 不在用户选择的 shotRecipes 集合中。`);
  }
}
