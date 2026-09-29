import {loadStylePack} from './style-catalog.mjs';
import {splitCaptionWindow} from '../../src/audio/captions.ts';

function glyphWidth(char) {
  if (/\p{Script=Han}|[\u3000-\u303f\uff00-\uffef]/u.test(char)) return 1;
  if (/\s/u.test(char)) return 0.33;
  if (/[A-Z0-9]/u.test(char)) return 0.68;
  return 0.57;
}

export function estimateTextLines(value, fontSize, width) {
  if (!value || width <= 0) return 0;
  const maxUnits = width / fontSize;
  let lines = 1;
  let used = 0;
  for (const char of value) {
    if (char === '\n') {
      lines += 1;
      used = 0;
      continue;
    }
    const units = glyphWidth(char);
    if (used > 0 && used + units > maxUnits) {
      lines += 1;
      used = 0;
    }
    used += units;
  }
  return lines;
}

function familyTitleSlot(scene, styleId, contentWidth, contentHeight, portrait, scale) {
  const structural = scene.purpose === 'process' || scene.purpose === 'evidence';
  const media = scene.purpose === 'media';
  const slots = {
    'retro-zine': structural
      ? {width: portrait ? contentWidth * 0.9 : contentWidth * 0.29, height: portrait ? contentHeight * 0.17 : contentHeight * 0.52, max: 76, min: 34}
      : media
        ? {width: contentWidth * (portrait ? 0.9 : 0.25), height: contentHeight * (portrait ? 0.18 : 0.3), max: 63, min: 28}
        : {width: contentWidth * (portrait ? 0.86 : 0.67), height: contentHeight * 0.36, max: portrait ? 105 : 146, min: 46},
    signal: structural
      ? {width: contentWidth * 0.95, height: contentHeight * 0.17, max: 74, min: 34}
      : media
        ? {width: contentWidth * (portrait ? 0.95 : 0.23), height: contentHeight * (portrait ? 0.14 : 0.25), max: portrait ? 52 : 58, min: 27}
        : {width: contentWidth * 0.76, height: contentHeight * 0.33, max: portrait ? 108 : 136, min: 42},
    scatterbrain: structural
      ? {width: contentWidth * 0.9, height: contentHeight * 0.18, max: 68, min: 34}
      : media
        ? {width: contentWidth * (portrait ? 0.82 : 0.21), height: contentHeight * (portrait ? 0.13 : 0.3), max: portrait ? 52 : 62, min: 28}
        : {width: contentWidth * (portrait ? 0.75 : 0.69), height: contentHeight * 0.38, max: portrait ? 110 : 136, min: 42}
  };
  const slot = slots[styleId];
  return slot ? {...slot, max: slot.max * scale, min: slot.min * scale} : null;
}

export function checkTextLayout(storyboard, style = loadStylePack(storyboard.style.id)) {
  const {width, height} = storyboard.project;
  const portrait = width < height;
  const safeArea = style.safeArea[portrait ? 'portrait' : 'landscape'];
  const contentWidth = width - safeArea.left - safeArea.right;
  const scale = portrait ? width / 1080 : width / 1920;
  const issues = [];
  for (const scene of storyboard.scenes) {
    const familyLayout = Boolean(scene.purpose);
    const captionReserve = scene.captions.length > 0 ? (portrait ? 170 : 125) : 0;
    const contentHeight = height - safeArea.top - safeArea.bottom - captionReserve;
    if (scene.visual) {
      const titleWidth = contentWidth * (scene.visual.kind === 'statement' ? 0.83 : 0.96);
      const titleFont = (scene.visual.kind === 'statement' ? 120 : 78) * scale;
      const titleHeight = contentHeight * (scene.visual.kind === 'statement' ? 0.5 : 0.2);
      if (estimateTextLines(scene.title, titleFont, titleWidth) * titleFont * 1.1 > titleHeight) {
        issues.push({severity: 'error', sceneId: scene.id, target: 'title', message: '语义画面标题超出可读区域；请缩短标题或拆屏。'});
      }
      const items = scene.layers.filter((layer) => ['node', 'card', 'metric'].includes(layer.type));
      const itemWidth = scene.visual.kind === 'network' ? contentWidth * 0.22
        : scene.visual.kind === 'change' ? contentWidth * 0.65
          : scene.visual.kind === 'sequence' || scene.visual.kind === 'compare' ? contentWidth / Math.max(1, items.length) - 85 * scale
            : contentWidth * 0.3;
      const maxLines = scene.visual.kind === 'network' ? 2 : 3;
      for (const layer of items) {
        for (const value of [layer.label ?? layer.text ?? String(layer.value ?? ''), layer.label && layer.text ? layer.text : '']) {
          const lines = estimateTextLines(value, 39 * scale, itemWidth);
          if (lines > maxLines) issues.push({severity: 'error', sceneId: scene.id, target: layer.id, message: `语义图解文字预计占 ${lines} 行；请缩短文案或拆屏。`});
        }
      }
      const claimLines = estimateTextLines(scene.primaryClaim ?? '', 25 * scale, contentWidth);
      if (claimLines > 2) issues.push({severity: 'warning', sceneId: scene.id, target: 'primaryClaim', message: '屏底结论超过两行，建议浓缩为一句。'});
      const captionFont = portrait ? 32 : 28;
      const captionWidth = Math.min(contentWidth, portrait ? 850 : 1160) - (portrait ? 48 : 44);
      for (const caption of scene.captions) {
        const shortCues = splitCaptionWindow(caption.text, caption.start, caption.end);
        for (const cue of shortCues) {
          if (estimateTextLines(cue.text, captionFont, captionWidth) > 1) {
            issues.push({severity: 'error', sceneId: scene.id, target: caption.id, message: '字幕超出单行安全区；请缩短字幕窗口。'});
          }
          if (shortCues.length > 1 && cue.end - cue.start < storyboard.project.fps * 0.8) issues.push({severity: 'error', sceneId: scene.id, target: caption.id, message: '字幕拆分后切换过快；请延长字幕窗口或缩短文字。'});
        }
      }
      continue;
    }
    const slot = familyLayout ? familyTitleSlot(scene, style.id, contentWidth, contentHeight, portrait, scale) : null;
    if (slot) {
      let fits = false;
      for (let fontSize = slot.max; fontSize >= slot.min; fontSize -= 2 * scale) {
        const lines = estimateTextLines(scene.title, fontSize, slot.width);
        if (lines * fontSize * 1.12 <= slot.height) { fits = true; break; }
      }
      if (!fits) issues.push({severity: 'error', sceneId: scene.id, target: 'title', message: '标题超出当前模板的可读区域；请缩短标题或拆分镜头。'});
    }
    const titleFont = familyLayout
      ? Math.min(portrait ? 110 : 146, contentWidth * (portrait ? 0.12 : 0.086))
      : portrait ? Math.min(style.tokens.titleFontSize, 88) : style.tokens.titleFontSize;
    const titleWidth = familyLayout
      ? contentWidth * (scene.purpose === 'process' || scene.purpose === 'evidence' ? 0.95 : portrait ? 0.88 : 0.7)
      : portrait ? Math.max(520, contentWidth) : 1120;
    const titleLines = estimateTextLines(scene.title, titleFont, titleWidth);
    if (!familyLayout && titleLines > 2) {
      issues.push({severity: 'warning', sceneId: scene.id, target: 'title', message: `标题预计占 ${titleLines} 行，请缩短标题或拆分镜头。`});
    }

    if (familyLayout) {
      const items = scene.layers.filter((layer) => scene.purpose === 'evidence' ? layer.type === 'metric' : ['node', 'card'].includes(layer.type));
      if (['process', 'evidence'].includes(scene.purpose)) {
        const columns = portrait ? (items.length > 3 ? 2 : 1) : Math.min(3, Math.max(1, items.length));
        const slotWidth = contentWidth / columns - 80;
        for (const layer of items) {
          for (const value of [layer.label ?? layer.text ?? String(layer.value ?? ''), layer.label && layer.text ? layer.text : '']) {
            const lines = estimateTextLines(value, portrait ? 36 : 42, slotWidth);
            if (lines > 3) issues.push({severity: 'error', sceneId: scene.id, target: layer.id, message: `内容预计占 ${lines} 行，超出模板信息槽；请缩短或拆镜头。`});
          }
        }
      }
    }

    if (!familyLayout) {
    for (const layer of scene.layers) {
      if (!['node', 'card'].includes(layer.type) || !layer.text || !layer.width || !layer.height) continue;
      const emphasized = layer.state === 'current' || layer.state === 'resolved' || scene.beats.some((beat) => beat.target === layer.id && beat.action === 'set-state' && ['current', 'resolved'].includes(beat.state));
      const fontSize = layer.type === 'node' ? (emphasized ? 44 : 34) : 40;
      const usableWidth = layer.width - 64 - 10;
      const usableHeight = layer.height - 32 - (layer.label ? 23 + 16 : 0) - 18;
      const lines = estimateTextLines(layer.text, fontSize, usableWidth);
      if (usableWidth <= 0 || lines * fontSize * 1.12 > usableHeight) {
        issues.push({severity: 'error', sceneId: scene.id, target: layer.id, message: `文字预计需要 ${lines} 行，超出卡片可用高度；请缩短文案或扩大图层。`});
      }
    }
    }

    const captionFont = portrait ? 32 : 28;
    const captionWidth = Math.min(contentWidth, portrait ? 850 : 1160) - (portrait ? 48 : 44);
    for (const caption of scene.captions) {
      const shortCues = splitCaptionWindow(caption.text, caption.start, caption.end);
      for (const cue of shortCues) {
        const lines = estimateTextLines(cue.text, captionFont, captionWidth);
        if (lines > 1) {
          issues.push({severity: 'error', sceneId: scene.id, target: caption.id, message: `字幕预计占 ${lines} 行，超出单行安全区；请缩短字幕窗口。`});
        }
        if (shortCues.length > 1 && cue.end - cue.start < storyboard.project.fps * 0.8) issues.push({severity: 'error', sceneId: scene.id, target: caption.id, message: '字幕拆分后切换过快；请延长字幕窗口或缩短文字。'});
      }
    }
  }
  return issues;
}

export function checkExternalCaptionLayout(storyboard, cues, style = loadStylePack(storyboard.style.id)) {
  const {width, height} = storyboard.project;
  const portrait = width < height;
  const safeArea = style.safeArea[portrait ? 'portrait' : 'landscape'];
  const contentWidth = width - safeArea.left - safeArea.right;
  const captionWidth = Math.min(contentWidth, portrait ? 860 : 1180) - (portrait ? 48 : 40);
  const fontSize = portrait ? 34 : 30;
  return cues.flatMap((cue, index) => {
    const shortCues = splitCaptionWindow(cue.text, cue.startSec, cue.endSec);
    return shortCues.flatMap((shortCue) => {
      const lines = estimateTextLines(shortCue.text, fontSize, captionWidth);
      const errors = [];
      if (lines > 1) errors.push({severity: 'error', sceneId: 'external-captions', target: `cue-${index + 1}`, message: `外部字幕预计占 ${lines} 行，超出单行安全区；请缩短字幕 cue。`});
      if (shortCues.length > 1 && shortCue.end - shortCue.start < 0.8) errors.push({severity: 'error', sceneId: 'external-captions', target: `cue-${index + 1}`, message: '外部字幕拆分后切换过快；请延长 cue 或缩短文字。'});
      return errors;
    });
  });
}
