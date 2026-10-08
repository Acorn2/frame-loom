import {chapterWindows, assertChapterCaptions} from '../../src/shots/shortlist/chapter-transitions.tsx';
import fs from 'node:fs';
import {validateStoryboard} from '../../src/validation/storyboard-validator.ts';
import {parseCaptions} from '../../src/audio/captions.ts';
import {checkSafeArea} from '../check-safe-area.mjs';
import {inspectAudio} from '../inspect-audio.mjs';
import {validateAssets} from '../validate-assets.mjs';
import {checkExternalCaptionLayout, checkTextLayout} from './text-layout.mjs';

export function checkStoryboardInput(storyboard, {storyboardPath, styleRoot, executionMode}) {
  return validateStoryboard(storyboard, {storyboardPath, styleRoot, executionMode});
}

export function checkAssetInput(storyboardPath) {
  return validateAssets(storyboardPath);
}

export function checkVisualInput(storyboard) {
  const safeArea = checkSafeArea(storyboard);
  const textLayout = checkTextLayout(storyboard);
  return {safeArea, textLayout};
}

export function checkAudioInput(storyboardPath, audioConfigPath) {
  if (!audioConfigPath) return undefined;
  const report = inspectAudio(storyboardPath, audioConfigPath);
  const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
  const captions = report.captionPath ? parseCaptions(fs.readFileSync(report.captionPath, 'utf8')) : [];
  if (chapterWindows(storyboard).length && report.tracks.some((track) => track.kind === 'voiceover') && !captions.length) throw new Error('有声换章需要字幕时间轴以检查关键词窗口。');
  assertChapterCaptions(storyboard, captions);
  const captionIssues = report.captionPath
    ? checkExternalCaptionLayout(storyboard, captions)
    : [];
  if (captionIssues.length > 0) {
    throw new Error(captionIssues.map((item) => `${item.target}: ${item.message}`).join('; '));
  }
  if (report.needsRetiming) {
    throw new Error(`音频或字幕超出 storyboard 时间轴，请先调整 scene、beat、caption 与项目时长：${report.issues.filter((item) => item.severity === 'error').map((item) => `${item.path}: ${item.message}`).join('; ')}`);
  }
  return report;
}
