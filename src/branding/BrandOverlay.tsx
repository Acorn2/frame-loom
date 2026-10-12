import React, {useLayoutEffect, useState} from 'react';
import {Img, useCurrentFrame, useVideoConfig, delayRender, continueRender, cancelRender} from 'remotion';
import type {StyleTokens} from '../styles/style-loader';
import {contrastRatio} from '../styles/colors';
import {brandProgress, type BrandRuntime} from './config';

export function BrandOverlay({brand, tokens}: {brand: BrandRuntime; tokens: StyleTokens}) {
  const frame = useCurrentFrame(), {width, fps} = useVideoConfig(), scale = width / 1920;
  const wm = brand.watermark, pixel = tokens.id === 'paper-collage';
  const [handle] = useState(() => delayRender('品牌标识字体测量'));
  const [measure, setMeasure] = useState({size: wm.size, width: 0});
  const ink = brand.ink ?? tokens.ink, accent = brand.accent ?? (tokens.id === 'whiteboard' ? tokens.accentAlt : tokens.accent);
  useLayoutEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const context = document.createElement('canvas').getContext('2d')!;
      let size = wm.size;
      const available = 1920 - wm.margin - (1600 + wm.size * .85);
      const textWidth = (value: number) => {context.font = `500 ${value}px ${tokens.bodyFont}`; return context.measureText(brand.name).width;};
      while (!brand.logoDataUri && size > 24 && textWidth(size) > available) size--;
      const labelWidth = brand.logoDataUri ? Math.min(available, size * 1.6 * brand.logoAspect!) : textWidth(size);
      if (labelWidth > available + 1) throw new Error('品牌名超出右上角安全区，请使用较短名称或 Logo。');
      const blendedInk = '#' + [1, 3, 5].map(start => Math.round(parseInt(ink.slice(start, start + 2), 16) * wm.opacity + parseInt(tokens.background.slice(start, start + 2), 16) * (1 - wm.opacity)).toString(16).padStart(2, '0')).join('');
      if (!brand.logoDataUri && contrastRatio(blendedInk, tokens.background) < 4.5) throw new Error('品牌文字对比度不足，请调整 brand.ink 或 watermark.opacity。');
      setMeasure({size, width: labelWidth}); continueRender(handle);
    }).catch(error => cancelRender(error));
    return () => {cancelled = true; continueRender(handle);};
  }, [brand, wm.size, wm.margin, wm.opacity, tokens.bodyFont, tokens.background, ink, handle]);
  if (!measure.width) return null;
  const p = brandProgress(frame, fps, wm.drawInSeconds), size = measure.size * scale, w = measure.width * scale;
  const nameProgress = Math.min(1, p / .8), lineProgress = Math.max(0, (p - .7) / .3);
  return <div data-layout-brand aria-label={brand.name} style={{position: 'absolute', right: wm.margin * scale, top: wm.margin * scale, width: w, height: size * 2, opacity: p === 0 ? 0 : wm.opacity, pointerEvents: 'none', fontFamily: tokens.bodyFont, color: ink}}>
    {wm.sparkle ? <svg aria-hidden width={size * .7} height={size * .7} viewBox="0 0 24 24" style={{position: 'absolute', right: w + size * .12, top: -size * .08, opacity: Math.min(1, p * 8)}}><path d={pixel ? 'M9 0H15V9H24V15H15V24H9V15H0V9H9Z' : 'M12 0L15 9L24 12L15 15L12 24L9 15L0 12L9 9Z'} fill={accent}/></svg> : null}
    <div style={{clipPath: `inset(0 ${(1 - nameProgress) * 100}% 0 0)`, height: size * 1.5, whiteSpace: 'nowrap', fontSize: size, lineHeight: 1.35, fontWeight: 500}}>
      {brand.logoDataUri ? <Img src={brand.logoDataUri} style={{width: w, height: size * 1.5, objectFit: 'contain'}}/> : brand.name}
    </div>
    {wm.underline ? <svg aria-hidden width={w} height={size * .35} style={{display: 'block', overflow: 'visible'}}><path d={pixel ? `M0 ${size * .15} H${w * .5} V${size * .22} H${w}` : `M0 ${size * .10} Q${w * .52} ${size * .38} ${w} ${size * .08}`} fill="none" stroke={accent} strokeWidth={(pixel ? 5 : 4) * scale} strokeLinecap={pixel ? 'square' : 'round'} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - lineProgress}/></svg> : null}
  </div>;
}
