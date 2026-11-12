/* global document, fetch, crypto */
const el = id => document.getElementById(id);
const video = el('video');
let session, draft, stopAt;

function clock(s) {
  const ms = Math.round(s * 1000);
  return Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
}

async function action(data) {
  const res = await fetch('/feedback', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...data, version: session.version})});
  if (!res.ok) throw new Error(await res.text() || '反馈保存失败');
  session.issues = await res.json();
  listIssues();
}

function writeDraft(data, label) {
  video.pause();
  draft = data;
  el('label').textContent = label;
  el('note').value = '';
  el('form').hidden = false;
  el('note').focus();
}
el('mark').onclick = () => writeDraft({type: 'add', id: crypto.randomUUID(), seconds: video.currentTime}, clock(video.currentTime) + ' · 问题说明');
el('cancel').onclick = () => {el('form').hidden = true; draft = null;};
el('form').onsubmit = async event => {
  event.preventDefault();
  try {
    await action({...draft, note: el('note').value});
    el('form').hidden = true;
    el('message').textContent = '反馈已保存';
  } catch (error) {el('message').textContent = error.message;}
};

function position() {
  if (!session) return;
  const frame = Math.min(session.frames - 1, Math.floor(video.currentTime * session.fps + 1e-7));
  const labels = session.scenes.filter(s => s.start <= frame && frame < s.end).map(s => s.title);
  el('position').textContent = clock(video.currentTime) + ' · ' + labels.join(' / ');
  if (stopAt !== undefined && video.currentTime >= stopAt) {video.pause(); stopAt = undefined;}
}
video.ontimeupdate = position;
video.onloadedmetadata = () => {el('mark').disabled = false; position();};
function button(parent, title, handler) {
  const button = document.createElement('button');
  button.textContent = title;
  button.onclick = async () => {try {await handler();} catch (error) {el('message').textContent = error.message;}};
  parent.append(button);
}
function text(parent, tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  parent.append(node);
  return node;
}
function seekFrame(frame) {
  stopAt = undefined;
  document.querySelectorAll('video').forEach(v => v.pause());
  video.currentTime = (frame + 0.25) / session.fps;
  video.scrollIntoView({block:'nearest'});
}

function listQa() {
  const groups = el('groups');
  if (!session.qaGroups.length) text(groups,'small','本版没有逐项 QA 提示');
  for (const group of session.qaGroups) {
    const details = document.createElement('details');
    text(details,'summary',group.scene + ' · ' + group.rule + ' · ' + group.entries.length + ' 条 / ' + group.frames.length + ' 帧');
    for (const entry of group.entries) {
      const row = text(details,'article',entry.message);
      if (entry.frame !== null) button(row,'回到第 ' + entry.frame + ' 帧',() => seekFrame(entry.frame));
    }
    groups.append(details);
  }
}

function describeTiming(item, impact) {
  const details = document.createElement('details');
  details.open = true;
  text(details,'summary','时码与字幕 · 全片 ' + clock(impact.beforeSeconds) + ' → ' + clock(impact.afterSeconds));
  if (!impact.changes.length) text(details,'p','镜头时码、旁白文本和字幕均与原版相同。');
  for (const change of impact.changes) {
    const delta = change.old && change.next ? change.next.start - change.old.start : 0;
    const shift = delta ? ' · 起点' + (delta > 0 ? '后移 ' : '提前 ') + Math.abs(delta).toFixed(3) + ' 秒' : '';
    text(details,'strong',change.id + shift);
    for (const [label,scene,source] of [['原版',change.old,impact.beforeSource],['修改后',change.next,impact.afterSource]]) {
      if (!scene) {text(details,'p',label + '无此镜头'); continue;}
      text(details,'p',label + ' ' + clock(scene.start) + '–' + clock(scene.end));
      if (scene.speechSeconds != null) text(details,'small','配音片段 ' + scene.speechSeconds.toFixed(3) + ' 秒');
      if (change.old?.narration !== change.next?.narration) text(details,'p','旁白 · ' + (scene.narration || '无'));
      text(details,'small',source);
      if (!scene.captions.length) text(details,'p','无显示字幕');
      for (const cue of scene.captions) text(details,'p',clock(cue.startSec) + '–' + clock(cue.endSec) + '  ' + cue.text);
    }
  }
  item.append(details);
}

function showPreview(item,issue) {
  const clip = issue.previews?.at(-1);
  if (!clip) return;
  const player = document.createElement('video');
  player.controls = true;
  player.playsInline = true;
  player.preload = 'metadata';
  player.setAttribute('aria-label','修改镜头预览');
  player.src = '/clip/' + clip.id;
  player.onplay = () => document.querySelectorAll('video').forEach(v => {if (v !== player) v.pause();});
  item.append(player);
  describeTiming(item,clip.impact);
  if (clip.stale) text(item,'p',clip.stale);
  if (clip.note) text(item,'p','补充意见 · ' + clip.note);
  if (!clip.answer && !clip.stale && !issue.producedVersion) {
    button(item,'确认镜头，允许生成整片',() => action({type:'accept-preview',id:issue.id,clipId:clip.id}));
    button(item,'继续修改镜头',() => {player.pause(); writeDraft({type:'change-preview',id:issue.id,clipId:clip.id},'补充修改意见');});
  }
}
function listIssues() {
  const list = el('list');
  list.replaceChildren();
  if (!session.issues.length) text(list, 'small', '还没有反馈');
  for (const issue of session.issues) {
    const item = document.createElement('article');
    const revision = issue.revisions.at(-1);
    const current = revision?.version === session.version;
    const clip = issue.previews?.at(-1);
    const status = issue.basisHash ? (issue.producedVersion ? '已生成整片' : clip?.stale ? '等待更新预览' : clip?.answer === 'accepted' ? '镜头已确认，等待整片' :
      clip?.answer === 'changes' ? '等待再次修改' : clip ? '修改镜头待确认' : '等待修改镜头') : revision?.answer === 'accepted' ? '已确认修改' : current && !revision.answer ? '新版待复核' : '待处理';
    text(item, 'small', clock(issue.frame / issue.fps) + ' · ' + issue.scenes.map(s => s.title).join(' / ') + ' · ' + status);
    text(item, 'p', issue.note);
    if (revision?.note) text(item, 'p', revision.note);
    if (issue.version === session.version) button(item, '回到问题处', () => {stopAt = undefined; video.pause(); video.currentTime = issue.frame / issue.fps;});
    if (issue.producedVersion === session.version) {
      const target = session.scenes.find(s => issue.previews.at(-1).sceneIds.includes(s.id));
      if (target) button(item,'看整片中的修改处',() => seekFrame(target.start));
    }
    showPreview(item,issue);
    if (current) {
      button(item, '看修改', async () => {
        video.currentTime = revision.scenes[0].start / revision.fps;
        stopAt = revision.scenes.at(-1).end / revision.fps;
        await video.play();
      });
      if (!revision.answer) {
        button(item, '确认这处修改', () => action({id: issue.id, type: 'accepted'}));
        button(item, '继续修改', () => writeDraft({id: issue.id, type: 'changes'}, '补充修改意见'));
      }
    }
    list.append(item);
  }
}

try {
  const response = await fetch('/session');
  if (!response.ok) throw new Error(await response.text());
  session = await response.json();
  el('title').textContent = session.title;
  video.src = '/video/' + session.version;
  listQa();
  listIssues();
} catch (error) {el('message').textContent = error.message;}
