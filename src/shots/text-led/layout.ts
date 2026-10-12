import type {StoryboardScene} from '../../schemas/storyboard';
import type {TextLedShot, TextLedPlacement} from './schema';

export const textLedEase = (value: number) => {const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p);};
export function textLedProgress(frame: number, start: number, duration: number) {return textLedEase((frame - start) / duration);}
export function textLedStageFrames(scene: StoryboardScene, shot: TextLedShot) {
  return shot.id === 'editorial-flow' ? shot.stages.map(stage => scene.beats.find(beat => beat.id === stage.trigger)!) : [];
}
export function textLedPlacementAt(scene: StoryboardScene, shot: TextLedShot, id: string, frame: number): TextLedPlacement {
  let result: TextLedPlacement = shot.elements[id]!;
  if (shot.id !== 'editorial-flow') return result;
  for (const stage of shot.stages) {
    const beat = scene.beats.find(b => b.id === stage.trigger)!;
    if (frame < beat.start) break;
    const target = stage.placements[id]!, raw = Math.max(0, Math.min(1, (frame - beat.start) / beat.duration)), p = textLedEase(raw);
    const opacity = result.opacity === 0 && target.opacity > 0 ? target.opacity * textLedEase((raw - .75) / .25)
      : target.opacity === 0 && result.opacity > 0 ? result.opacity * (1 - textLedEase(raw / .25))
        : result.opacity + (target.opacity - result.opacity) * p;
    result = {...target, x: result.x + (target.x - result.x) * p, y: result.y + (target.y - result.y) * p,
      width: result.width + (target.width - result.width) * p, height: result.height + (target.height - result.height) * p,
      fontSize: result.fontSize + (target.fontSize - result.fontSize) * p, opacity,
      color: p < .5 ? result.color : target.color, weight: p < .5 ? result.weight : target.weight};
  }
  return result;
}
export function textLedStageAt(scene: StoryboardScene, shot: TextLedShot, frame: number) {
  return textLedStageFrames(scene, shot).filter(beat => frame >= beat.start).length;
}
export function textLedBoxes(shot: TextLedShot) {
  return [shot.elements, ...(shot.id === 'editorial-flow' ? shot.stages.map(stage => stage.placements) : [])];
}
export function textLedWeight(weight: TextLedPlacement['weight']) {return {regular: 400, medium: 500, semibold: 600}[weight];}
