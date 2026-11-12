import {readEpisode} from './lib/series.mjs';
import {usesScenePlan, readScenePlan, stalePlanDocuments, checkScenePlan} from './lib/scene-plan.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {URL, fileURLToPath, pathToFileURL} from 'node:url';
import {assertProjectOutput} from './lib/project-files.mjs';
import {fingerprintFiles, fingerprintProjectInputs} from './lib/input-fingerprint.mjs';
import {assertProductionLock} from './lib/production-lock.mjs';
import {buildNarrationHandoff, formatNarrationHandoff} from './lib/narration-handoff.mjs';

import {feedbackStatus} from './lib/review-feedback.mjs';
import {readCheckpoint, checkpointStatus} from './workflow-checkpoint.mjs';

const styleRoot = fileURLToPath(new URL('../styles', import.meta.url));
function readJson(file) {
  const data = fs.readFileSync(file, 'utf8');
  try {return JSON.parse(data);}
  catch {throw new Error(`JSON 格式无效：${file}`);}
}
const agent = (stage, next, file) => ({stage, owner: 'Agent', next, file});
const creator = (stage, next, file) => ({stage, owner: '创作者', next, file});

function artifact(project, name) {
  if (typeof name !== 'string' || !name) throw new Error('运行记录缺少产物路径。');
  return assertProjectOutput(project, path.resolve(project, name));
}

function planningStatus(project) {
  const final = artifact(project, 'storyboard.json');
  const draft = artifact(project, 'storyboard.draft.json');
  const file = fs.existsSync(final) ? final : draft;
  if (usesScenePlan(project)) {
    const planFile = artifact(project, 'scene-plan.json');
    const plan = readScenePlan(project);
    const adopted = readEpisode(project);
    if (adopted && plan.scenes.length === 1 && plan.scenes[0].id === 'series-ending' && !fs.existsSync(final)) {
      return agent('本期内容待编排', `系列 ${adopted.series.id} · ${adopted.series.version}，当期用途 ${adopted.outputPurpose}。在固定结尾前编写本期内容；角色及来源见 asset-manifest.json。`, planFile);
    }
    if (!plan.scenes.length) return agent('待编写逐场计划', '按场景填写来源、旁白、画面意图和观众要看清的变化。', planFile);
    if (stalePlanDocuments(project, plan).length) return agent('逐场计划待导出', '运行 export:scene-plan 更新讲稿与逐场审阅表。', planFile);
    if (!fs.existsSync(file) || !readJson(file).scenes?.length) return agent('逐场计划已导出', '按审阅表中的场景 ID 编排分镜。', artifact(project, 'scene-review.md'));
    const [issue] = checkScenePlan(project, readJson(file));
    if (issue) return agent('逐场计划与分镜待同步', issue.path + ' ' + issue.message, file);
  }
  if (!fs.existsSync(file)) {
    if (!fs.existsSync(artifact(project, 'project-input.json'))) throw new Error('目录中没有 FrameLoom 项目记录。');
    return agent('待编排', '读取原文，准备讲稿和分镜。');
  }
  const board = readJson(file);
  if (!Array.isArray(board?.scenes)) throw new Error('分镜缺少 scenes。');
  if (!board.scenes.length) return agent('待编排', '依据来源填写讲稿、逐场画面和旁白。', file);
  return agent('已有分镜，尚无生产记录', '核对讲稿和分镜。按本次选择的模式推进，review 模式需取得当前分镜批准。', file);
}

const purposes = {
  'visual-preview': {pending: 'preview-only', stage: '静音预览可审阅', next: '观看预览，指出需要调整的镜头。'},
  'visual-master': {pending: 'visual-handoff-pending', ready: 'visual-handoff-ready', approval: 'visualHandoffReady',
    stage: '画面底片已通过自动 QA，等待创作者复核', next: '完整观看，检查文字、构图和后期叠加空间，再决定是否批准交后期。'},
  'in-project-video': {pending: 'manual-review-pending', ready: 'release-ready', approval: 'releaseReady',
    stage: '有声视频已通过自动 QA，等待创作者复核', next: '完整播放，核对发音、音画、字幕和素材使用，再决定是否批准交付。'}
};

export function completedStatus(project, run) {
  const fileFor = key => artifact(project, run.artifacts?.[key]);
  if (run.outputPurpose === 'script-handoff' && run.deliveryStatus === 'script-ready') {
    const file = fileFor('narrationScript');
    const manifest = fileFor('narrationManifest');
    const board = readJson(fileFor('storyboard'));
    const expected = buildNarrationHandoff(project, board);
    const previous = readJson(manifest);
    if (previous.storyboardFingerprint !== expected.storyboardFingerprint || previous.scriptFingerprint !== expected.scriptFingerprint ||
        JSON.stringify(previous.scenes) !== JSON.stringify(expected.scenes) || fs.readFileSync(file, 'utf8') !== formatNarrationHandoff(board, expected)) {
      throw new Error('当前分镜、讲稿或交接文件已变化。');
    }
    return creator('配音讲稿已生成', '核对逐场旁白后，交给配音人员。', file);
  }
  const purpose = run.outputPurpose;
  const route = purposes[purpose];
  if (!route || run.stages?.qa !== 'completed') throw new Error('交付用途未知或自动 QA 尚未完成。');
  const file = fileFor('video');
  const qa = readJson(fileFor('qaReport'));
  if (!qa.automatedPassed || qa.checks?.output?.passed !== true || !qa.video || !fs.existsSync(qa.video) || fs.realpathSync(qa.video) !== file ||
      (qa.outputPurpose && qa.outputPurpose !== purpose)) throw new Error('QA 报告与本次产物不匹配。');
  if (fingerprintFiles([file], project) !== run.outputFingerprint || !fs.existsSync(file)) throw new Error('候选视频缺失或字节已变化。');
  const board = readJson(artifact(project, 'storyboard.json'));
  const lock = assertProductionLock(board, file, undefined, project);
  if (lock && (run.productionLockHash !== lock.hash || qa.checks?.productionLock?.hash !== lock.hash)) throw new Error('生产锁与 QA 记录不一致。');
  if (purpose === 'visual-master') {
    const script = fileFor('narrationScript');
    const files = [script, artifact(project, path.join(path.dirname(script), 'narration-manifest.json')), fileFor('shotTiming'), fileFor('visualHandoff')];
    if (fingerprintFiles(files, project) !== run.handoffFingerprint) throw new Error('底片交接包已变化。');
  }
  // produce fingerprints the requested route before resolving an automatic output purpose.
  const includeAudio = !['visual-preview', 'visual-master'].includes(run.outputPurposeRequested);
  let currentInputs;
  try {
    currentInputs = fingerprintProjectInputs(project, styleRoot, run.audioConfigPath, run.ttsConfigPath, {includeAudio});
  } catch (error) {
    // A fresh shell may lack the original voice selection. Report only the recorded
    // candidate after verifying the output bytes, QA and lock independently.
    if (run.audioModeResolved === 'tts' && error.message.startsWith('TTS 缺少音色')) {
      return agent('有声候选已定位，输入指纹待核验', '在原配音环境中重新查询状态。可先试听此版本，批准前须核对当前输入。', file);
    }
    throw error;
  }
  if (currentInputs !== run.inputFingerprint) throw new Error('当前输入与生产记录的指纹不同。');
  if (run.deliveryStatus === route.pending) return creator(route.stage, route.next + ' 可通过 review:player 在播放处记录问题。', file);
  if (route.ready && run.deliveryStatus === route.ready && qa[route.approval] === true &&
      qa.approvedInputFingerprint === run.inputFingerprint && qa.approvedOutputFingerprint === run.outputFingerprint) {
    return creator(purpose === 'visual-master' ? '已批准交给后期' : '已批准交付', '领取已复核的当前版本。', file);
  }
  throw new Error('交付状态缺少相应的 QA 或批准记录。');
}

export function workflowStatus(directory) {
  const project = fs.realpathSync(directory);
  if (!fs.statSync(project).isDirectory()) throw new Error('需要 FrameLoom 项目目录。');
  const record = artifact(project, 'run.json');
  const checkpoint = readCheckpoint(project);
  const run = fs.existsSync(record) ? readJson(record) : null;
  // Production captures the checkpoint ID at its start. An older run, including
  // a delayed QA or approval update, cannot supersede a newer editorial handoff.
  if (checkpoint && checkpoint.id !== run?.workflowCheckpointId) {
    if (checkpoint.stage === 'review' && ['script.md', 'scene-review.md'].includes(checkpoint.document) && usesScenePlan(project) &&
        stalePlanDocuments(project, readScenePlan(project)).includes(checkpoint.document)) {
      return agent('逐场计划待导出', '重新导出并登记当前审阅版本。', artifact(project, 'scene-plan.json'));
    }
    return checkpointStatus(project, checkpoint);
  }
  if (!run) return planningStatus(project);
  if (run.status === 'completed') {
    let production;
    try {production = completedStatus(project, run);}
    catch (error) {production = agent('候选待核验', `核对生产记录并修复失效证据。原因：${error.message}`, record);}
    return feedbackStatus(project, run, production);
  }
  if (run.status === 'running') return agent('生产记录停在 ' + run.currentStage, '检查当前生产进程，再决定等待或恢复。', record);
  if (['failed', 'blocked'].includes(run.status)) {
    const production = agent('生产受阻 · ' + run.currentStage, '查看 run.json 的 errors，修复原因后按已有运行的恢复条件继续。', record);
    return feedbackStatus(project, run, production);
  }
  throw new Error('无法识别 run.json 的生产状态。');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [dir, ...extra] = process.argv.slice(2);
    if (!dir || extra.length) {
      throw new Error('Usage: npm run workflow:status -- <project-dir>');
    }
    const result = workflowStatus(dir);
    if (result.goal) console.log(`当前目标  ${result.goal}`);
    console.log(`当前阶段  ${result.stage}`);
    if (result.file) console.log(`打开文件  ${result.file}`);
    console.log(`下一步  ${result.owner}：${result.next}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
