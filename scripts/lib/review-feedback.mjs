import path from 'node:path';
import {writeProjectJson} from './project-files.mjs';

import {verifyClip} from './preview-gate.mjs';

import {clipFile, ledgerName, readFeedback, versionOf} from './review-ledger.mjs';
export {ledgerName, readFeedback, versionOf} from './review-ledger.mjs';

export const timecode = seconds => {
  const ms = Math.round(seconds * 1000);
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};

export function locateFrame(candidate, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > candidate.frames / candidate.fps + 0.001) throw new Error('时间码超出当前视频。');
  const frame = Math.min(candidate.frames - 1, Math.floor(seconds * candidate.fps + 1e-7));
  const scenes = candidate.scenes.filter(scene => scene.start <= frame && frame < scene.end);
  if (!scenes.length) throw new Error('该帧没有对应镜头。');
  return {frame, scenes};
}

function note(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw new Error('请填写 1–2000 字的问题说明。');
  return text.trim();
}

export function changeFeedback(project, candidate, action) {
  // All callers hold the project production lock while checking the candidate and writing.
  const issues = readFeedback(project);
  if (action.version !== candidate.version) throw new Error('视频已换版，请刷新播放器。');
  if (typeof action.id !== 'string' || !/^[a-f0-9-]{36}$/u.test(action.id)) throw new Error('反馈编号无效。');
  const issue = issues.find(item => item.id === action.id);
  const now = new Date().toISOString();
  if (action.type === 'add') {
    const {frame, scenes} = locateFrame(candidate, action.seconds);
    const text = note(action.note);
    if (issue) {
      if (issue.version === candidate.version && issue.frame === frame && issue.note === text) return issues;
      throw new Error('反馈编号已被使用。');
    }
    issues.push({id: action.id, ...(candidate.basisHash ? {basisHash:candidate.basisHash} : {}), createdAt: now, version: candidate.version, frame, fps: candidate.fps,
      scenes: scenes.map(s => ({id: s.id, title: s.title, localFrame: frame - s.start})), note: text, revisions: []});
  } else {
    if (!issue) throw new Error('找不到这条反馈。');
    if (issue.basisHash) {
      const clip = issue.previews?.at(-1);
      if (!['accept-preview','change-preview'].includes(action.type) || issue.version !== candidate.version ||
          !clip || issue.producedVersion || clip.id !== action.clipId || clip.answer) throw new Error('请刷新并查看当前待确认的镜头预览。');
      verifyClip(project,clip);
      if (action.type === 'change-preview') clip.note = note(action.note);
      clip.answer = action.type === 'accept-preview' ? 'accepted' : 'changes';
      clip.answeredAt = now;
    } else {
      const last = issue.revisions.at(-1);
      if (action.type === 'revision') {
        if (last?.answer === 'accepted') throw new Error('这条反馈已确认。');
        const baseline = last?.version ?? issue.version;
        if (last?.version !== candidate.version && candidate.version.split('.')[1] === baseline.split('.')[1]) {
          throw new Error('请先生成并通过 QA 检查新版视频。');
        }
        if (last?.version === candidate.version && last.answer === 'changes') throw new Error('请先按补充意见生成下一版。');
        const originalIds = issue.scenes.map(s => s.id);
        const ids = action.scene ? [action.scene] : originalIds;
        const scenes = ids.map(id => candidate.scenes.find(s => s.id === id));
        if (scenes.includes(undefined)) throw new Error('原镜头已删改，请显式指定新版对应的镜头 ID。');
        scenes.sort((a, b) => a.start - b.start);
        if (last?.version === candidate.version) {
          if (JSON.stringify(last.scenes) === JSON.stringify(scenes)) return issues;
          throw new Error('本版已登记其他镜头。');
        }
        issue.revisions.push({version: candidate.version, submittedAt: now, scenes, fps: candidate.fps});
      } else {
        if (!last || last.version !== candidate.version || last.answer) throw new Error('请刷新并查看当前待复核的修改。');
        if (!['accepted', 'changes'].includes(action.type)) throw new Error('未知反馈操作。');
        if (action.type === 'changes') last.note = note(action.note);
        last.answer = action.type;
        last.answeredAt = now;
      }
    }
  }
  writeProjectJson(project, path.join(project, ledgerName), {schemaVersion: '1.0', issues});
  return issues;
}

export function feedbackStatus(project, run, production) {
  const issues = readFeedback(project);
  const open = issues.filter(issue => issue.basisHash && !issue.producedVersion);
  let waiting;
  for (const issue of open) {
    const clip = issue.previews?.at(-1);
    let reason = clip?.note ?? issue.note;
    let usable = clip && clip.answer !== 'changes';
    if (usable) {
      try {verifyClip(project,clip);} catch (error) {usable = false; reason = error.message;}
    }
    if (!usable) return {stage:'等待修改镜头预览', owner:'Agent', file:path.join(project,ledgerName),
      next:`${timecode(issue.frame / issue.fps)} · ${issue.scenes.map(s=>s.id).join(' / ')} · ${reason}。用 review:preview 提交镜头预览。`};
    if (!clip.answer) waiting ??= clip;
  }
  if (waiting) return {stage:'等待创作者确认修改镜头', owner:'创作者', file:clipFile(project,waiting.id), next:'在 review:player 播放修改预览，查看时码和字幕差异，确认或继续修改。'};
  if (open.length) {
    // A later failed full run takes precedence over the consent it consumed.
    // A newly reviewed clip can hand production back after that failure.
    if (['failed', 'blocked'].includes(run.status) && open.every(issue =>
      Date.parse(issue.previews.at(-1).answeredAt) <= Date.parse(run.updatedAt))) return production;
    return {stage:'镜头修改已确认',owner:'Agent',file:path.join(project,ledgerName),next:'用已确认的输入运行 produce，生成整片并执行 QA。'};
  }
  const active = issues.filter(issue => !issue.basisHash && issue.revisions.at(-1)?.answer !== 'accepted');
  if (!active.length) return production;
  const version = versionOf(run);
  const waitingLegacy = issue => {
    const last = issue.revisions.at(-1);
    return last?.version === version && !last.answer && production.owner === '创作者';
  };
  const pending = active.filter(issue => !waitingLegacy(issue));
  if (pending.length) {
    const first = pending[0];
    const text = first.revisions.at(-1)?.note ?? first.note;
    return {stage: `有 ${pending.length} 条审片反馈待处理`, owner: 'Agent', file: path.join(project, ledgerName),
      next: `${timecode(first.frame / first.fps)} · ${first.scenes.map(s => s.id).join(' / ')} · ${text}\n按反馈修订并登记新版对应镜头。`};
  }
  return {...production, stage: `新版有 ${active.length} 条修改待复核`, next: '打开本地审片播放器，点击对应反馈的「看修改」，确认或继续提意见。'};
}
