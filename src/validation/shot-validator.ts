import {validateChapterTransitions} from '../shots/shortlist/chapter-transitions';
import type {Storyboard} from '../schemas/storyboard';
import {compileShot} from '../shots/compile-shot';
import {getSceneTimeline} from '../timeline/scene-timeline';
import {assertTemplateCompatibility} from '../video-templates/resolve-template';
import {assertStoryboardShotSelection} from '../shots/selection';
import type {MappingIssue} from './mapping-validator';

export function validateShots(storyboard: Storyboard): MappingIssue[] {
  if (storyboard.schemaVersion !== '2.4') return [];
  const issues: MappingIssue[] = [];
  try {validateChapterTransitions(storyboard);} catch (error) {issues.push({path: 'transitions', severity: 'error', message: String(error)});}
  try {assertStoryboardShotSelection(storyboard);} catch (error) {
    issues.push({path: 'shotRecipes', severity: 'error', message: error instanceof Error ? error.message : String(error)});
  }
  try {assertTemplateCompatibility(storyboard);} catch (error) {
    issues.push({path: 'videoTemplate', severity: 'error', message: String(error)});
  }
  for (const {scene, overlapOutFrames} of getSceneTimeline(storyboard)) {
    try {compileShot(scene, {...storyboard.project, style: storyboard.style, overlapOutFrames});} catch (error) {
      issues.push({path: `scene ${scene.id}.shot`, severity: 'error', message: error instanceof Error ? error.message : String(error)});
    }
  }
  return issues;
}
