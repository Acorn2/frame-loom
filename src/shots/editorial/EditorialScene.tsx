import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import {isEditorialShot} from './schema';
import {editorialChartLayout, editorialDomain, editorialNumber, editorialTick} from './layout';
import {directionProgress} from '../directions/layout';

const weights = {regular: 400, medium: 550, bold: 700};
export function EditorialScene(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens} = props, shot = scene.shot, frame = useCurrentFrame(), {width} = useVideoConfig();
  if (!shot || !isEditorialShot(shot)) throw new Error('EditorialScene requires the exact editorial recipe');
  return <ShotShell {...props} ownTitle fullCanvas><div style={{position: 'absolute', width: 1920, height: 1080, transform: `scale(${width / 1920})`, transformOrigin: 'top left', fontFamily: tokens.bodyFont}}>
    <svg aria-hidden width={1920} height={1080} style={{position: 'absolute', inset: 0}}>{shot.rules.map((r, i) => <path key={i} d={`M${r.x} ${r.y}${r.vertical ? 'v' : 'h'}${r.length}`} stroke={tokens[r.color]} strokeWidth={r.width}/>)}</svg>
    {shot.slots.items.map(id => {
      const layer = scene.layers.find(l => l.id === id)!, e = shot.elements[id]!, reveal = directionProgress(scene, id, 'reveal', frame), underline = directionProgress(scene, id, 'highlight', frame);
      const style: React.CSSProperties = {margin: 0, whiteSpace: 'pre', fontFamily: tokens.bodyFont, fontSize: e.fontSize, fontWeight: weights[e.weight], lineHeight: 1.4, color: tokens[e.color], textAlign: e.align};
      const chart = shot.charts[id];
      const at = e.underline ? layer.label!.indexOf(e.underline) : -1;
      return <div key={id} data-layout-node={id} style={{position: 'absolute', left: e.x, top: e.y, width: e.width, height: e.height, opacity: reveal}}>
        <div data-layout-text-group style={style}>{at < 0 ? layer.label : <>{layer.label!.slice(0, at)}<span style={{position: 'relative', display: 'inline-block'}}>{e.underline}<span aria-hidden style={{position: 'absolute', bottom: 0, left: 0, width: '100%', height: 3, background: tokens.accent, transform: `scaleX(${underline})`, transformOrigin: 'left'}}/></span>{layer.label!.slice(at + e.underline!.length)}</>}</div>
        {chart ? (() => {
          const plot = editorialChartLayout(e, chart.metrics.length), domain = editorialDomain(scene, shot, id, frame), unit = scene.layers.find(l => l.id === chart.metrics[0])!.text ?? '';
          return <>
            <svg width={e.width} height={e.height} style={{position: 'absolute', inset: 0, overflow: 'visible', fontFamily: tokens.bodyFont}}>
              {(e.grid ? [domain.min, (domain.min + domain.max) / 2, domain.max] : [domain.min]).map((tick, i) => {const y = plot.baseline - (tick - domain.min) / (domain.max - domain.min) * plot.height;
                return <g key={i}><path d={`M${plot.x} ${y}h${plot.width}`} stroke={i === 0 ? tokens.ink : tokens.grid} strokeWidth={i === 0 ? 2 : 1}/><text data-layout-text-group x={plot.x - 18} y={y + e.bodySize * .35} textAnchor="end" fontSize={e.bodySize} fill={i === 0 ? tokens.accent : tokens.muted}>{editorialTick(tick)}</text></g>;
              })}
              {chart.metrics.map((metricId, i) => {
                const metric = scene.layers.find(l => l.id === metricId)!, p = directionProgress(scene, metricId, 'reveal', frame), center = plot.x + plot.cell * (i + .5), h = (Number(metric.value) - domain.min) / (domain.max - domain.min) * plot.height * p;
                const beat = scene.beats.find(b => b.target === metricId && b.action === 'reveal')!, complete = frame >= beat.start + beat.duration;
                const color = metricId === chart.accent ? tokens.accent : tokens.ink;
                return <g key={metricId}><rect x={center - plot.barWidth / 2} y={plot.baseline - h} width={plot.barWidth} height={h} fill={color}/>
                  {complete && <text data-layout-text-group x={center} y={plot.baseline - h - 18} textAnchor="middle" fontSize={e.valueSize} fontWeight={700} fill={color} stroke={tokens.background} strokeWidth={6} paintOrder="stroke">{editorialNumber(Number(metric.value))}{unit}</text>}
                  <text data-layout-text-group x={center} y={plot.baseline + e.bodySize * 1.65} textAnchor="middle" fontSize={e.bodySize} fill={tokens.ink}>{metric.label}</text>
                </g>;
              })}
            </svg>
            {layer.text && <div data-layout-text-group style={{...style, position: 'absolute', top: e.height - e.bodySize * 1.4, fontSize: e.bodySize, color: tokens.muted}}>{layer.text}</div>}
          </>;
        })() : layer.text && <div data-layout-text-group style={{...style, marginTop: 12, fontSize: e.bodySize, fontWeight: 400, color: tokens.muted}}>{layer.text}</div>}
      </div>;
    })}
  </div></ShotShell>;
}
