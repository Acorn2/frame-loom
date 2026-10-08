import {p2CardType} from './layout';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import type {StoryboardBeat, StoryboardLayer} from '../../schemas/storyboard';
import {isP2Shot, type P2Shot} from './schema';
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const cubic = (v: number) => 1 - (1 - clamp(v)) ** 3;
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const progress = (beat: StoryboardBeat | undefined, frame: number) => beat ? clamp((frame - beat.start) / beat.duration) : 0;
// The freeze interval consumes real timeline frames while preserving source motion continuity.
export function freezeProgress(frame: number, motion: StoryboardBeat, freeze?: StoryboardBeat) {
  if (!freeze) return progress(motion, frame);
  const activeDuration = motion.duration - freeze.duration;
  const elapsed = frame - motion.start - Math.min(freeze.duration, Math.max(0, frame - freeze.start));
  return clamp(elapsed / activeDuration);
}
export function scrubPosition(p: number) {
  if (p < .2) return mix(.08, .76, cubic(p / .2));
  if (p < .3) return mix(.76, .7, cubic((p - .2) / .1));
  if (p < .5) return .7;
  return mix(.7, .4, (p - .5) / .5);
}
export function grainPosition(p: number, index: number, total: number) {
  if (p >= 1) return {y:1,visible:false};
  const t = clamp((p - index / total * .55) / .45);
  // One bounded impact, then exactly zero residual movement.
  const y = t < .8 ? (t / .8) ** 2 : 1 - Math.sin((t - .8) / .2 * Math.PI) * .12;
  return {y, visible: t > 0 && t < 1};
}
export function P2Scene(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, appearance, plan} = props;
  const frame = useCurrentFrame(); const shot = scene.shot;
  if (!shot || !isP2Shot(shot)) throw new Error('P2 contract required');
  const get = (id: string) => scene.layers.find(l => l.id === id)!;
  const beat = (id: string, action: string) => plan.actions.find(b => b.target === id && b.action === action);
  const entry = (id: string) => plan.actions.find(b => b.target === id && ['enter', 'reveal'].includes(b.action));
  const p = (id: string, action = 'enter') => progress(action === 'enter' ? entry(id) : beat(id, action), frame);
  const ink = appearance?.stageInk ?? tokens.ink, muted = appearance?.stageMuted ?? tokens.muted, accent = appearance?.lineInk ?? tokens.accentAlt;
  const uid = `p2-${scene.id}`;
  const effect = shot.effects?.[0]; const effectBeat = effect ? beat(effect.target, 'highlight') : undefined;
  const ep = progress(effectBeat, frame); const active = !!effectBeat && frame >= effectBeat.start && frame < effectBeat.start + effectBeat.duration;
  const footer = <text x={20} y={475} fill={muted} fontSize={13}>来源：{scene.visual?.source} {scene.visual?.unit ? `· ${scene.visual.unit}` : ''}</text>;
  const card = (l: StoryboardLayer, x: number, y: number, w: number, h: number, opacity = 1, color = '#ffffff') => {
    const type = p2CardType(h), padding=type.padding;
    return <g key={l.id} opacity={opacity}><rect x={x} y={y} width={w} height={h} rx={14} fill={color} stroke="#d4dce6" strokeWidth={1} style={{filter:"drop-shadow(0 5px 9px #00000014)"}}/><foreignObject x={x+padding} y={y+padding} width={w-padding*2} height={h-padding*2}><div style={{color:'#192330',fontFamily:tokens.bodyFont,overflowWrap:'anywhere',height:'100%',display:type.row?'flex':undefined,alignItems:'center',gap:type.gap}}><div style={{fontSize:type.label,fontWeight:700,lineHeight:1.2,width:type.row?'30%':undefined,flexShrink:0}}>{l.label}</div>{l.text?<div style={{fontSize:type.text,lineHeight:1.4,marginTop:type.row?0:type.gap,whiteSpace:'pre-wrap'}}>{l.text}</div>:null}</div></foreignObject></g>;
  };
  let body: React.ReactNode;
  if (shot.id === 'research-stack') {
    const ids = shot.slots.items;
    const current = Math.max(0, ids.reduce((n, id, i) => frame >= entry(id)!.start ? i : n, 0));
    body = <>{ids.map((id, i) => {
      if (i > current) return null;
      const k = cubic(p(id)); const distance = current - i;
      return <g key={id} transform={`translate(${distance * -24 + (1 - k) * -200},${distance * -22 + (1 - k) * -420}) rotate(${(1 - k) * -8},480,240)`} opacity={k * Math.max(.2, 1 - distance * .25)} style={{filter: distance ? 'blur(1px)' : undefined}}>
        {card({...get(id), text: distance ? undefined : get(id).text}, 210, 90, 600, 275)}
        {!distance ? <text x={235} y={326} fontSize={17} fill="#627187">{shot.authors[id]}</text> : null}
      </g>;
    })}<text x={860} y={150} fontSize={58} fill={accent} fontFamily={tokens.font ? tokens.bodyFont : 'monospace'}>{frame >= entry(ids[current]!)!.start + entry(ids[current]!)!.duration ? current + 1 : current}</text><text x={848} y={183} fontSize={15} fill={muted}>/{ids.length} 份资料</text></>;
  } else if (shot.id === 'list-stack-press') {
    const ids = shot.slots.items;
    let press = 0;
    for (const id of ids) {const t = p(id); if (t >= .75 && t < 1) press += Math.sin((t - .75) * 4 * Math.PI) * 7;}
    body = <><g transform={`translate(0,${press})`}>{ids.map((id, i) => {const k = cubic(clamp(p(id) / .75)); return <g key={id} opacity={k} transform={`translate(0,${(1 - k) * 520}) rotate(${(1 - k) * (i % 2 ? -2 : 2)},500,240)`}>{card(get(id), 110, 25 + i * 83, 760, 73)}<rect x={116} y={30 + i * 83} width={3} height={63} rx={2} fill={accent} opacity={clamp((p(id) - .78) / .22)}/></g>;})}</g><text x={910} y={90} fontSize={52} fill={accent}>{ids.filter(id => p(id) >= .75).length}</text><text x={890} y={120} fontSize={15} fill={muted}>已落位条目</text></>;
  } else if (shot.id === 'integration-hub' || shot.id === 'ring-annotation' || shot.id === 'cycle-mechanism') {
    body = <Graph shot={shot} connections={scene.connections} get={get} p={p} card={card} accent={accent} ink={ink} uid={uid} activeBoil={effect?.id === 'line-boil' && active} frame={frame} />;
  } else if (shot.id === 'scroll-brake') {
    const ids = shot.slots.items, focus = beat(shot.focusId, 'focus')!;
    const k = cubic(freezeProgress(frame, focus, effect?.id === 'speed-ramp-freeze' ? effectBeat : undefined));
    const prev = cubic(freezeProgress(frame - 1, focus, effect?.id === 'speed-ramp-freeze' ? effectBeat : undefined));
    const index = ids.indexOf(shot.focusId), shift = mix(0, 190 - index * 100, k);
    body = <><defs><clipPath id={`${uid}-scroll`}><rect x={100} y={12} width={800} height={416} rx={18}/></clipPath></defs><g clipPath={`url(#${uid}-scroll)`}>{ids.map((id, i) => <g key={id} opacity={cubic(p(id)) * (id === shot.focusId ? 1 : mix(1, .38, k))} transform={`translate(0,${shift})`} style={{filter: `blur(${Math.abs(k - prev) * 110}px)`}}>{card(get(id), 120, i * 100, 760, 90)}</g>)}</g>{active && effect?.id === 'speed-ramp-freeze' ? <g><path d="M80 228H116" stroke={accent} strokeWidth={4}/><text x={18} y={211} fill={accent} fontSize={16}>停留复核</text></g> : null}<rect x={113} y={190} width={774} height={90} rx={16} fill="none" stroke={accent} strokeWidth={2} opacity={k}/></>;
  } else if (shot.id === 'chart-live') {
    const values = shot.samples, k = p(shot.slots.series, 'focus'), position = k * (values.length - 1), max = Math.max(...values.map(v => v.value)) * 1.1;
    const sx = (i: number) => 900 - (position - i) * (780 / Math.min(7, values.length - 1)); const sy = (v: number) => 390 - v / max * 300;
    const whole = Math.floor(position), t = position - whole;
    const headValue = mix(values[whole]!.value, values[Math.min(whole + 1, values.length - 1)]!.value, t);
    const line = values.slice(0, whole + 1).map((v, i) => `${i ? 'L' : 'M'}${sx(i)} ${sy(v.value)}`).join(' ') + ` L900 ${sy(headValue)}`;
    body = <g opacity={cubic(p(shot.slots.series))}><defs><clipPath id={`${uid}-plot`}><rect x={120} y={80} width={785} height={315}/></clipPath></defs>{[0, .5, 1].map(v => <g key={v}><path d={`M120 ${sy(v * max)}H900`} stroke={`${muted}44`}/><text x={20} y={sy(v * max)} fill={muted} fontSize={18}>{Math.round(v * max)}</text></g>)}<g clipPath={`url(#${uid}-plot)`}><path d={line} stroke={accent} strokeWidth={4} fill="none" strokeLinejoin="round"/>{k < 1 ? <circle cx={900} cy={sy(headValue)} r={7} fill={accent}/> : null}</g>{values.map((v, i) => i <= whole && sx(i)>=120 ? <text key={v.label} x={sx(i)} y={426} fontSize={16} textAnchor="middle" fill={muted}>{v.label}</text> : null)}<text x={125} y={48} fontSize={23} fill={ink}>{get(shot.slots.series).label} · {scene.visual?.unit}</text><text x={900} y={48} textAnchor="end" fontSize={28} fill={accent}>{k >= 1 ? String(values.at(-1)!.value) : String(values[whole]!.value)}</text><text x={800} y={443} fontSize={13} fill={muted}>采样顺序 →</text></g>;
  } else if (shot.id === 'particle-sand-fill') {
    const ids = shot.slots.items, max = Math.max(...ids.map(id => Number(get(id).value))), width = 700 / ids.length;
    body = <>{ids.map((id, i) => {const l = get(id), value = Number(l.value), height = value / max * 280, k = p(id, 'count'), grains = Math.ceil(value / shot.grainUnit), x = 140 + i * (800 / ids.length);return <g key={id} opacity={cubic(p(id))}><path d={`M${x - 15} 388h${width + 30}`} stroke={muted}/><rect x={x} y={388 - height} width={width} height={height} rx={5} fill={`${accent}15`}/><rect x={x} y={388 - height} width={width} height={height} rx={5} fill={accent} opacity={clamp((k-.85)/.15)}/>{Array.from({length: grains}, (_, n) => {const g = grainPosition(k, n, grains);const gx = x + 9 + (n % 7) / 7 * (width - 18), gy = mix(16, 383 - Math.floor(n / 7) / Math.max(1,Math.ceil(grains/7)-1) * Math.max(0,height-14), g.y);return k>n/grains*.55 && k<1 ? <rect key={n} x={gx-3.5} y={gy-3.5} width={7} height={7} rx={1} fill={accent} opacity={1-clamp((k-.85)/.15)}/> : null;})}<text x={x + width / 2} y={418} textAnchor="middle" fontSize={21} fill={ink}>{l.label}</text><text x={x + width / 2} y={388 - height - 14} textAnchor="middle" fontSize={28} fill={ink}>{k >= 1 ? String(l.value) : ''}</text></g>;})}<text x={130} y={36} fill={muted} fontSize={16}>每粒约 {shot.grainUnit} {scene.visual?.unit}；柱高表示输入总量</text></>;
  } else if (shot.id === 'member-grid') {
    const ids = shot.slots.items, n = ids.length, cols = 4;
    body = <>{ids.map((id, i) => {const k = cubic(p(id)), flagged = shot.flagged.includes(id), h = flagged ? cubic(p(id, 'highlight')) : 0;
      const col = i % cols, row = Math.floor(i / cols); const baseX = 35 + col * 238, baseY = 30 + row * 132;
      const reframe = effect?.id === 'mosaic-reframe' ? cubic(clamp((ep - i * .015) / (1 - i * .015))) : 0;
      const targetX = i === 0 ? 35 : 510 + (i - 1) % 2 * 238, targetY = i === 0 ? 30 : 30 + Math.floor((i - 1) / 2) * 132;
      const x = mix(baseX, targetX, reframe), y = mix(baseY, targetY, reframe), w = mix(218, i === 0 ? 445 : 218, reframe), height = mix(114, i === 0 ? 378 : 114, reframe);
      return <g key={id} opacity={k} transform={`translate(${x + w / 2},${y + height / 2}) scale(${mix(.5, 1, k)}) translate(${-w / 2},${-height / 2})`}>{card(get(id), 0, 0, w, height, 1, h ? '#e5f0ed' : '#ffffff')}<circle cx={w - 18} cy={18} r={5} fill={flagged && h ? accent : '#cbd3dc'}/></g>;
    })}<text x={35} y={450} fill={muted} fontSize={17}>{shot.flagged.filter(id => p(id, 'highlight') >= 1).length}/{n} 个输入成员被标记；不含虚构头像</text></>;
  } else if (shot.id === 'media-before-after') {
    const a = get(shot.slots.before), b = get(shot.slots.after), k = p(b.id, 'focus'), x = 75, y = 10, w = 850, h = 390, cut = x + w * scrubPosition(k);
    if (!a.assetDataUri || !b.assetDataUri) throw new Error('Source images must be hydrated before rendering');
    body = <g opacity={Math.min(cubic(p(a.id)), cubic(p(b.id)))}><defs><clipPath id={`${uid}-after`}><rect x={x} y={y} width={cut - x} height={h}/></clipPath></defs><image href={a.assetDataUri} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet"/><image href={b.assetDataUri} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" clipPath={`url(#${uid}-after)`}/><path d={`M${cut} ${y}V${y+h}`} stroke={accent} strokeWidth={3}/><circle cx={cut} cy={y+h/2} r={20} fill="#ffffff" stroke={accent}/><path d={`M${cut-8} ${y+h/2}h16`} stroke={accent} strokeWidth={2}/><text x={x} y={431} fill={ink} fontSize={21}>{b.label}</text><text x={x+w} y={431} textAnchor="end" fill={ink} fontSize={21}>{a.label}</text></g>;
  } else if (shot.id === 'document-write') {
    const ids = shot.slots.blocks, h = 340 / ids.length;
    body = <><rect x={180} y={10} width={640} height={422} rx={14} fill="#ffffff" stroke="#d4dce6"/><text x={214} y={49} fontSize={14} fill="#718096">DOCUMENT / SOURCE TEXT</text>{ids.map((id, i) => {const k = p(id), l = get(id), y = 70 + i * h;return <g key={id}><defs><clipPath id={`${uid}-${i}`}><rect x={214} y={y} width={570 * k} height={h - 8}/></clipPath></defs><g clipPath={`url(#${uid}-${i})`}><foreignObject x={214} y={y} width={570} height={h - 8}><div style={{color:'#192330',fontFamily:tokens.bodyFont,fontSize:18,lineHeight:1.4,whiteSpace:'pre-wrap'}}><strong style={{fontSize:22}}>{l.label}</strong><div>{l.text}</div></div></foreignObject></g>{k > 0 && k < 1 ? <path d={`M${214+570*k} ${y}v${h-12}`} stroke={accent} strokeWidth={2}/> : null}</g>;})}{effect && effectBeat ? <DocumentEffect id={uid} effect={effect.id} targetIndex={ids.indexOf(effect.target)} count={ids.length} targetLabel={get(effect.target).label!} progress={ep} active={active} accent={accent}/> : null}</>;
  } else if (shot.id === 'code-reveal') {
    const carryIn = scene.transitionIn?.type === 'overlap-line-carry';
    const carryOut = props.chapterTransitionOut && get(shot.slots.code).semanticRole?.startsWith('carry:');
    const cp = carryOut ? clamp((frame-scene.durationFrames+props.overlapOutFrames)/props.overlapOutFrames) : 0;
    const code = get(shot.slots.code), chars = [...code.text!], k = p(code.id), count = Math.floor(k * chars.length);
    const lineCount = code.text!.split('\n').length, shown = shot.mode === 'lines' ? [...code.text!.split('\n').slice(0, Math.ceil(k * lineCount)).join('\n')].length : count;
    let offset = 0; const colors = {plain:'#e4eaf2',keyword:'#a9c7ff',string:'#9bdbc3',number:'#f1c58f',comment:'#92a0b3'};
    body = <><rect x={100} y={10} width={800} height={420} rx={18} fill="#0d121b" stroke="#364352"/><circle cx={130} cy={35} r={5} fill="#e6928e"/><circle cx={150} cy={35} r={5} fill="#e1c37e"/><circle cx={170} cy={35} r={5} fill="#8cc7aa"/><text x={870} y={42} textAnchor="end" fill="#92a0b3" fontSize={15}>{code.label}</text>{code.semanticRole?.startsWith('carry:') ? <path d={`M132 62H${870+1200*cp}`} stroke={accent} strokeWidth={2} opacity={carryIn || carryOut || k>=1 ? 1 : 0}/> : null}<foreignObject x={132} y={80} width={740} height={340}><pre style={{fontSize:24,lineHeight:1.5,fontFamily:tokens.font ? tokens.bodyFont : 'monospace',margin:0,whiteSpace:'pre-wrap',color:'#e4eaf2'}}>{shot.tokens.map((token,i)=>{const available=Math.max(0,shown-offset);offset += [...token.text].length;return <span key={i} style={{color:colors[token.kind]}}>{[...token.text].slice(0,available).join('')}</span>;})}{k > 0 && k < 1 ? <span style={{color:accent}}>▌</span> : null}</pre></foreignObject></>;
  } else {
    const k = p(shot.slots.title), eased = k < .5 ? 2*k*k : 1-2*(1-k)**2, total = shot.glyphs.reduce((sum,g)=>sum+g.advance+24,0)-24;let x=0;
    body = <><svg x={(1000-total)/2} y={90} width={total} height={220} viewBox={`0 0 ${total} 100`} overflow="visible">{shot.glyphs.map((g,i)=>{const gx=x;x+=g.advance+24;return <g key={i} transform={`translate(${gx},0)`}>{g.paths.map((path,j)=><path key={j} d={path} fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1-eased}/>)}</g>;})}</svg><text x={500} y={378} textAnchor="middle" fill={muted} fontSize={18}>所有字形共享描画进度 · 使用输入路径</text></>;
  }
  return <ShotShell {...props} ownTitle={shot.id === 'letterspace-materialize'}><svg viewBox="0 0 1000 490" width="100%" height="100%" style={{overflow:'visible'}}>{body}{footer}</svg></ShotShell>;
}

function Graph({shot,connections,get,p,card,accent,ink,uid,activeBoil,frame}:{shot:Extract<P2Shot,{id:'integration-hub'|'ring-annotation'|'cycle-mechanism'}>;connections:Array<{id:string;from:string;to:string}>;get:(id:string)=>StoryboardLayer;p:(id:string,action?:string)=>number;card:(l:StoryboardLayer,x:number,y:number,w:number,h:number,opacity?:number,color?:string)=>React.ReactNode;accent:string;ink:string;uid:string;activeBoil:boolean;frame:number}) {
  const hub=shot.id==='integration-hub', ring=shot.id==='ring-annotation';
  const subject=hub?shot.slots.before:shot.slots.subject, k=cubic(p(subject,'focus')), ids=shot.slots.items;
  const cx=mix(500,ring?285:500,k), cy=ring?230:220;
  const positions=ids.map((_,i)=> {const a=(i/ids.length*Math.PI*2-Math.PI/2);return ring ? {x:620,y:25+i*110} : {x:500+Math.cos(a)*310-100,y:220+Math.sin(a)*150-50};});
  return <><defs><marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill={accent}/></marker>{activeBoil ? <filter id={`${uid}-boil`}><feTurbulence type="fractalNoise" baseFrequency=".015" numOctaves={2} seed={Math.floor(frame/3)}/><feDisplacementMap in="SourceGraphic" scale={5} xChannelSelector="R" yChannelSelector="G"/></filter> : null}</defs>
    {ring ? <g filter={activeBoil?`url(#${uid}-boil)`:undefined}><circle cx={cx} cy={cy} r={mix(260,155,k)} fill="none" stroke={`${accent}66`} strokeWidth={2}/><circle cx={cx} cy={cy} r={mix(280,170,k)} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="14 8"/></g>:null}
    {ids.map((id,i)=>{
      const a=positions[i]!, next=positions[(i+1)%ids.length]!;
      const ac={x:a.x+(ring?172.5:100),y:a.y+(ring?47:50)};
      const bc=hub||ring?{x:cx,y:cy}:{x:next.x+100,y:next.y+50};
      const edge=(center:{x:number;y:number}, other:{x:number;y:number}, halfW:number, halfH:number)=>{
        const dx=other.x-center.x,dy=other.y-center.y,amount=1/Math.max(Math.abs(dx)/halfW,Math.abs(dy)/halfH);
        return {x:center.x+dx*amount,y:center.y+dy*amount};
      };
      const from=ring?{x:a.x,y:a.y+47}:edge(ac,bc,100,50);
      const to=ring?{x:cx+175,y:cy}:edge(bc,ac,hub?120:100,hub?52:50);
      const mx=(from.x+to.x)/2,my=(from.y+to.y)/2;
      const qx=hub||ring?mx:mx+(mx-500)*.5,qy=hub||ring?my:my+(my-220)*.5;
      const dp=cubic(p(connections.find(c=>c.from===id)!.id,'draw'));
      return <path key={id} d={`M${from.x} ${from.y}Q${qx} ${qy} ${to.x} ${to.y}`} stroke={accent} strokeWidth={2} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1-dp} opacity={dp?1:0} markerEnd={dp>=1?`url(#${uid}-arrow)`:undefined}/>;
    })}
    <g opacity={cubic(p(subject))} transform={`translate(${cx},${cy}) scale(${mix(1.7,hub?.8: .95,k)}) translate(-150,-65)`}>{hub&&k>=1?card(get(shot.slots.hub),0,0,300,130,cubic(p(shot.slots.hub))):<g style={{transformOrigin:'150px 65px',transform:hub?`perspective(700px) rotateY(${k>.5?(k-1)*180:k*180}deg)`:undefined}}>{card(get(hub&&k>.5?shot.slots.hub:subject),0,0,300,130)}</g>}</g>
    {ids.map((id,i)=>{const {x,y}=positions[i]!,t=p(id), b=shot.id==='cycle-mechanism'&&t>0&&t<1?1+1.7*(t-1)**3+.7*(t-1)**2:cubic(t);return <g key={id} transform={`translate(0,${(1-b)*65})`}>{card(get(id),x,y,ring?345:200,ring?94:100,clamp(b),shot.id==='cycle-mechanism'?'#e7edf3ed':'#ffffff')}</g>;})}

    {shot.id==='cycle-mechanism'&&k>0&&k<1?<path d={`M${mix(70,900,k)} 10l180 400`} stroke={ink} strokeWidth={2} opacity={Math.sin(k*Math.PI)*.3}/>:null}
  </>;
}
function DocumentEffect({id,effect,targetIndex,count,targetLabel,progress:k,active,accent}:{id:string;effect:string;targetIndex:number;count:number;targetLabel:string;progress:number;active:boolean;accent:string}) {
  const y=70+targetIndex*340/count,h=340/count-8;
  if(effect==='scanline-annotate-focus')return <>{active?<path d={`M195 ${mix(60,418,k)}H804`} stroke={accent} strokeWidth={2}/>:null}{k>clamp((y+h-60)/358)?<g><rect x={204} y={y-5} width={590} height={h+8} rx={5} fill="none" stroke={accent} strokeWidth={2}/><path d={`M794 ${y+h/2}H839`} stroke={accent}/><foreignObject x={848} y={y} width={125} height={h}><div style={{color:accent,fontSize:16,lineHeight:1.4}}>已标注<br/>{targetLabel}</div></foreignObject></g>:null}</>;
  const phase=k*5,pass=Math.min(4,Math.floor(phase)), t=clamp((phase-pass)/.88), s=(1-Math.cos(t*Math.PI))/2, sy=mix(pass%2?418:60,pass%2?60:418,s);
  return <>{active?<><defs><clipPath id={`${id}-scan`}><rect x={181} y={11} width={638} height={420} rx={14}/></clipPath></defs><g clipPath={`url(#${id}-scan)`}><rect x={182} y={sy-(pass%2?0:18)} width={636} height={18} fill={`${accent}22`}/><path d={`M182 ${sy}H819`} stroke={accent} strokeWidth={2}/></g>{[0,1,2,3].map(i=><path key={i} d={['M170 50V0H210','M790 0H830V50','M170 390V440H210','M790 440H830V390'][i]} stroke={accent} strokeWidth={3} fill="none" opacity={clamp((k-i*.035)/.12)}/>)}</>:null}</>;
}
