export const VIDEO_REVIEW_CHECKS = ['fullPlaybackPassed', 'visualHierarchyPassed', 'textReadabilityPassed', 'transitionTimingPassed', 'audioQualityPassed', 'captionReadabilityPassed', 'assetRightsPassed'];
export const VISUAL_REVIEW_CHECKS = ['fullPlaybackPassed', 'visualHierarchyPassed', 'textReadabilityPassed', 'overlaySafeAreaPassed', 'assetRightsPassed'];

export function reviewFingerprintIssues(run, review) {
  return ['inputFingerprint', 'outputFingerprint'].flatMap(key =>
    typeof review?.[key] !== 'string' || !/^[a-f0-9]{64}$/u.test(review[key]) || review[key] !== run[key]
      ? [`人工审片 ${key} 缺失或与当前候选不匹配；请为当前视频重新准备审片记录并完整播放复核。`] : []);
}

export function createReviewTemplate(run) {
  if (run.status !== 'completed' || run.stages?.qa !== 'completed' || !['visual-master', 'in-project-video'].includes(run.outputPurpose)) throw new Error('先完成画面底片或有声视频的生产与自动 QA。');
  const template = {inputFingerprint: run.inputFingerprint, outputFingerprint: run.outputFingerprint, reviewer: '', notes: '',
    ...Object.fromEntries((run.outputPurpose === 'visual-master' ? VISUAL_REVIEW_CHECKS : VIDEO_REVIEW_CHECKS).map(key => [key, false]))};
  const issues = reviewFingerprintIssues(run, template);
  if (issues.length) throw new Error(issues.join('\n'));
  return template;
}
