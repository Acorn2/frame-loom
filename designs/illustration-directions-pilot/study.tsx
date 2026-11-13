import React, {useEffect} from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {useProjectFont} from '../../src/fonts/use-project-font';
import plan from './scene-plan.json';

// hresh approved two isolated illustration studies: picture-bound annotation and
// scene-led narration. This does not register recipes or alter existing styles.
export type StudyProps = {kind: 'annotated' | 'narrative'; assets: Record<string, string>};
const C = {paper: '#ffffff', ink: '#243b34', muted: '#65716c', line: '#d8e1dc', green: '#34765b', red: '#c66a49', pale: '#f3f6f4'};
const family = '"FrameLoom Source Han Sans SC"';
const progress = (frame: number, at = 0, length = 24) => interpolate(frame, [at, at + length], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(.22, 1, .36, 1)});
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
type Box = {x: number; y: number; w: number; h: number};

function Text({x, y, size = 34, color = C.ink, weight = 400, anchor = 'start', role = 'body', children}: {
  x: number; y: number; size?: number; color?: string; weight?: number; anchor?: 'start' | 'middle' | 'end'; role?: string; children: React.ReactNode;
}) {return <text data-study-text={role} x={x} y={y} fontSize={size} fontWeight={weight} fill={color} textAnchor={anchor}>{children}</text>;}
function Reveal({at = 0, children, length = 22, shift = 12}: {at?: number; children: React.ReactNode; length?: number; shift?: number}) {
  const p = progress(useCurrentFrame(), at, length);
  return <g opacity={p} transform={`translate(0 ${shift * (1 - p)})`}>{children}</g>;
}
function Stroke({d, at = 0, duration = 30, color = C.green, width = 3}: {d: string; at?: number; duration?: number; color?: string; width?: number}) {
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress(useCurrentFrame(), at, duration)}/>;
}
function Ring({cx, cy, r, at = 0, color = C.red}: {cx: number; cy: number; r: number; at?: number; color?: string}) {
  return <Stroke d={`M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}`} at={at} width={3} color={color}/>;
}
function Picture({asset, box, source, crop, fit = 'meet', zoom = 1, focus = [.5, .5]}: {
  asset: string; box: Box; source: [number, number]; crop?: [number, number, number, number]; fit?: 'meet' | 'slice'; zoom?: number; focus?: number[];
}) {
  const [w, h] = source, v = crop ?? [0, 0, w, h];
  const vw = v[2]! / zoom, vh = v[3]! / zoom;
  return <svg data-study-image x={box.x} y={box.y} width={box.w} height={box.h}
    viewBox={`${v[0]! + (v[2]! - vw) * focus[0]!} ${v[1]! + (v[3]! - vh) * focus[1]!} ${vw} ${vh}`} preserveAspectRatio={`xMidYMid ${fit}`} overflow="hidden">
    <image href={asset} width={w} height={h}/>
  </svg>;
}
function Header({kind}: Pick<StudyProps, 'kind'>) {
  const f = useCurrentFrame();
  return <>
    <Text role="meta" x={104} y={78} size={23} color={C.muted}>{kind === 'annotated' ? '批注图解 / OBSERVATION NOTES' : '情境叙事 / SCENE NARRATIVE'}</Text>
    <path d="M104 111H1816" stroke={C.line}/>
    <g data-study-brand opacity={.72}>
      <Text role="brand" x={1814} y={73} size={28} anchor="end">Your Brand</Text>
      <Stroke d="M1666 85Q1740 93 1814 84" at={0} duration={36} width={2}/>
    </g>
    <Text role="meta" x={104} y={1038} size={21} color={C.muted}>原创插画 · 观察示意</Text>
    <Text role="meta" x={1816} y={1038} size={21} anchor="end" color={C.muted}>静音设计试片</Text>
    <path d="M736 1034H1184" stroke={C.line} strokeWidth={2}/>
    <path d={`M736 1034H${736 + Math.min(1, f / 899) * 448}`} stroke={C.green} strokeWidth={3}/>
  </>;
}
function Caption({index}: {index: number}) {
  const f = useCurrentFrame(), cue = plan.scenes[index]!.captions[f < 90 ? 0 : 1]!;
  const opacity = progress(f % 90, 2, 8);
  return <g opacity={opacity}><Text role="caption" x={960} y={975} size={37} anchor="middle" color="#42564d">{cue}</Text></g>;
}
function SceneHeading({index, right = false}: {index: number; right?: boolean}) {
  const scene = plan.scenes[index]!;
  return <Reveal shift={8}>
    <Text x={right ? 900 : 104} y={194} size={52} weight={600}>{scene.heading}</Text>
  </Reveal>;
}

function AnnotatedScene({index, assets}: {index: number; assets: StudyProps['assets']}) {
  const f = useCurrentFrame(), leaf = assets['leaf-pair']!;
  if (index === 0) return <>
    <Reveal><Text x={120} y={246} size={29} color={C.green}>一起观察，也一起提问</Text></Reveal>
    <Reveal at={8}><Text x={114} y={380} size={92} weight={650}>好问题</Text><Text x={114} y={501} size={82} weight={650}>从观察开始</Text></Reveal>
    <Stroke d="M120 548H579" at={27} duration={35} width={4}/>
    <Reveal at={40}><Text x={120} y={638} size={33} color={C.muted}>先让目光，停在具体的事物上</Text></Reveal>
    <Reveal at={15} length={40} shift={8}><Picture asset={leaf} source={[1536, 1024]} box={{x: 825, y: 218, w: 912, h: 608}}/></Reveal>
    <Reveal at={65}><Text x={1290} y={866} anchor="middle" size={27} color={C.muted}>先观察</Text></Reveal>
  </>;
  if (index === 1) return <>
    <SceneHeading index={index}/>
    <Reveal at={4} shift={0}><Picture asset={leaf} source={[1536, 1024]} crop={[80, 50, 820, 920]} box={{x: 140, y: 220, w: 625, h: 700}} zoom={lerp(1, 1.035, progress(f, 12, 65))}/></Reveal>
    <Ring cx={683} cy={505} r={52} at={26}/>
    <Stroke d="M735 505H886L1042 370H1132" at={47} duration={29} color={C.red}/>
    <Reveal at={58}><Text x={1160} y={374} size={43} weight={600}>叶子的边缘</Text><Text x={1160} y={431} size={29} color={C.muted}>让目光沿着轮廓走一遍</Text></Reveal>
    <Ring cx={458} cy={598} r={55} at={84} color={C.green}/>
    <Stroke d="M510 613L918 670H1132" at={102} duration={27}/>
    <Reveal at={112}><Text x={1160} y={673} size={43} weight={600}>里面的纹路</Text><Text x={1160} y={730} size={29} color={C.muted}>把视线，移向叶片内部</Text></Reveal>
  </>;
  if (index === 2) return <>
    <SceneHeading index={index}/>
    <Reveal at={0}><Text x={1810} y={192} anchor="end" size={28} color={C.muted}>放在一起看</Text></Reveal>
    <Reveal at={9} shift={0}><Picture asset={leaf} source={[1536, 1024]} box={{x: 420, y: 227, w: 1010, h: 673}}/></Reveal>
    <Stroke d="M506 819H1310" at={40} color={C.line} width={2}/>
    <Stroke d="M578 770L362 688H142" at={49} duration={34} color={C.red}/>
    <Reveal at={66}><Text x={140} y={643} size={37} weight={600}>边缘轮廓</Text></Reveal>
    <Stroke d="M1173 420L1453 365H1760" at={83} duration={34}/>
    <Reveal at={100}><Text x={1490} y={326} size={37} weight={600}>叶片形状</Text></Reveal>
    <Reveal at={124}><Text x={960} y={904} size={30} anchor="middle" color={C.muted}>看见差异，再说出差异</Text></Reveal>
  </>;
  if (index === 3) return <>
    <SceneHeading index={index}/>
    <Reveal at={9} shift={0}><Picture asset={leaf} source={[1536, 1024]} box={{x: 160, y: 256, w: 770, h: 514}}/></Reveal>
    <Ring cx={489} cy={519} r={40} at={30}/>
    <Ring cx={727} cy={482} r={40} at={53}/>
    <Stroke d="M794 518H945" at={76} duration={30} color={C.red}/>
    <Reveal at={81}><Text x={1050} y={487} size={112} color={C.green} weight={650}>为什么？</Text></Reveal>
    <Reveal at={108}><Text x={1058} y={586} size={31} color={C.muted}>先把看见的细节说清楚</Text></Reveal>
    <Reveal at={127}><Text x={1058} y={646} size={31} color={C.muted}>再给问题，一个具体的起点</Text></Reveal>
  </>;
  return <>
    <Reveal at={3} shift={0}><Picture asset={leaf} source={[1536, 1024]} crop={[70, 60, 800, 900]} box={{x: 130, y: 206, w: 600, h: 675}}/></Reveal>
    <Reveal at={4}><Text x={820} y={252} size={54} weight={600}>让好奇</Text><Text x={820} y={329} size={54} weight={600}>有继续探索的方向</Text></Reveal>
    {['观察', '比较', '提问'].map((label, i) => <g key={label}>
      <Reveal at={30 + i * 32}><Text x={824} y={475 + i * 147} size={24} color={C.red}>0{i + 1}</Text><Text x={908} y={478 + i * 147} size={54} weight={600}>{label}</Text></Reveal>
      <Stroke d={`M907 ${498 + i * 147}H1515`} at={45 + i * 32} duration={24} width={2}/>
    </g>)}
  </>;
}

function NarrativeScene({index, assets}: {index: number; assets: StudyProps['assets']}) {
  const f = useCurrentFrame(), observe = assets['story-observe']!, compare = assets['story-compare']!, question = assets['story-question']!;
  if (index === 0) return <>
    <Reveal at={0} shift={0} length={28}><Picture asset={observe} source={[1672, 941]} box={{x: 610, y: 206, w: 1240, h: 698}} zoom={lerp(1, 1.035, progress(f, 0, 100))}/></Reveal>
    <Reveal at={4}><Text x={114} y={354} size={83} weight={650}>好问题</Text><Text x={114} y={466} size={70} weight={650}>从观察开始</Text></Reveal>
    <Reveal at={35}><Text x={120} y={567} size={28} color={C.green}>一起观察，也一起提问</Text></Reveal>
    <Reveal at={62}><Text x={120} y={675} size={30} color={C.muted}>先让目光</Text><Text x={120} y={725} size={30} color={C.muted}>停在具体的事物上</Text></Reveal>
  </>;
  if (index === 1) return <>
    <SceneHeading index={index}/>
    <Reveal shift={0}><Picture asset={compare} source={[1672, 941]} crop={[385, 270, 770, 585]} box={{x: 104, y: 235, w: 1080, h: 650}} fit="slice" zoom={lerp(1, 1.04, progress(f, 0, 110))} focus={[.5, .65]}/></Reveal>
    <Reveal at={29}><Text x={1300} y={389} size={43} weight={600}>叶子的边缘</Text><Text x={1300} y={451} size={29} color={C.muted}>让目光沿着轮廓走一遍</Text></Reveal>
    <Stroke d="M1300 476H1740" at={49} width={2}/>
    <Reveal at={88}><Text x={1300} y={623} size={43} weight={600}>里面的纹路</Text><Text x={1300} y={685} size={29} color={C.muted}>把视线，移向叶片内部</Text></Reveal>
    <Stroke d="M1300 710H1740" at={108} width={2}/>
  </>;
  if (index === 2) return <>
    <SceneHeading index={index}/>
    <Reveal shift={0} length={24}><Picture asset={compare} source={[1672, 941]} box={{x: 133, y: 228, w: 1654, h: 620}} zoom={lerp(1.09, 1, progress(f, 0, 85))}/></Reveal>
    <Reveal at={45}><Text x={500} y={900} size={30} color={C.muted}>边缘轮廓</Text><Text x={1200} y={900} size={30} color={C.muted}>叶片形状</Text></Reveal>
    <Reveal at={100}><Text x={1810} y={191} anchor="end" size={28} color={C.green}>放在一起看</Text></Reveal>
  </>;
  if (index === 3) return <>
    <SceneHeading index={index}/>
    <Reveal at={0} length={28} shift={0}><Picture asset={question} source={[1672, 941]} box={{x: 486, y: 230, w: 1340, h: 670}} zoom={lerp(1, 1.04, progress(f, 0, 100))}/></Reveal>
    <Reveal at={30}><Text x={114} y={423} size={94} color={C.green} weight={650}>为什么？</Text></Reveal>
    <Reveal at={68}><Text x={120} y={542} size={31} color={C.muted}>先把看见的</Text><Text x={120} y={595} size={31} color={C.muted}>细节说清楚</Text></Reveal>
    <Reveal at={110}><Text x={120} y={705} size={29} color={C.muted}>再给问题</Text><Text x={120} y={755} size={29} color={C.muted}>一个具体的起点</Text></Reveal>
  </>;
  return <>
    <Reveal at={0} shift={0} length={28}><Picture asset={question} source={[1672, 941]} box={{x: 672, y: 284, w: 1165, h: 602}}/></Reveal>
    <Reveal at={5}><Text x={114} y={237} size={54} weight={600}>让好奇，有继续探索的方向</Text></Reveal>
    {['观察', '比较', '提问'].map((label, i) => <g key={label}><Reveal at={30 + i * 32}>
      <Text x={120} y={426 + i * 160} size={23} color={C.red}>0{i + 1}</Text><Text x={200} y={430 + i * 160} size={62} weight={600}>{label}</Text>
    </Reveal><Stroke d={`M201 ${457 + i * 160}H532`} at={45 + i * 32} duration={25} width={2}/></g>)}
  </>;
}

function Scene({index, kind, assets}: StudyProps & {index: number}) {
  const f = useCurrentFrame(), opacity = index < plan.scenes.length - 1 && f > 173 ? (180 - f) / 7 : 1;
  return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', fontFamily: family}}>
    <g opacity={opacity}>{kind === 'annotated' ? <AnnotatedScene index={index} assets={assets}/> : <NarrativeScene index={index} assets={assets}/>}</g>
    <Caption index={index}/>
  </svg>;
}
function Measurement({kind}: Pick<StudyProps, 'kind'>) {
  const frame = useCurrentFrame();
  useEffect(() => {
    const roles = ['body', 'caption', 'meta', 'brand'];
    const visible = (element: Element) => {
      for (let current: Element | null = element; current; current = current.parentElement) {
        const opacity = getComputedStyle(current).opacity;
        if (Number(opacity) < .05) return false;
      }
      return true;
    };
    const text = [...document.querySelectorAll<SVGTextElement>('[data-study-text]')].filter(visible).map(el => {
      const r = el.getBoundingClientRect(); return {role: el.dataset.studyText ?? 'body', text: el.textContent ?? '', x: r.x, y: r.y, w: r.width, h: r.height};
    });
    const issues = text.flatMap(t => {
      const result: {type: string; text: string}[] = [];
      if (t.x < 70 || t.x + t.w > 1850 || t.y < 24 || t.y + t.h > 1055) result.push({type: 'canvas-bounds', text: t.text});
      if (t.role === 'body' && t.y + t.h > 922) result.push({type: 'caption-reserve', text: t.text});
      if (t.role === 'body' && t.x + t.w > 1600 && t.y < 108) result.push({type: 'brand-reserve', text: t.text});
      return result;
    });
    for (const role of roles) {
      const items = text.filter(t => t.role === role);
      for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
        const x = items[a]!, y = items[b]!;
        if (Math.min(x.x + x.w, y.x + y.w) - Math.max(x.x, y.x) > 5 && Math.min(x.y + x.h, y.y + y.h) - Math.max(x.y, y.y) > 5) issues.push({type: 'text-overlap', text: `${x.text} / ${y.text}`});
      }
    }
    console.log(`ILLUSTRATION_LAYOUT ${JSON.stringify({kind, frame, text, issues})}`);
  }, [frame, kind]);
  return null;
}
export function IllustrationStudy({kind, assets}: StudyProps) {
  const ready = useProjectFont({id: 'source-han-sans-sc', version: '2.005'});
  if (!ready) return null;
  return <AbsoluteFill style={{background: C.paper, fontFamily: family}}>
    {plan.scenes.map((s, index) => <Sequence key={s.id} from={index * 180} durationInFrames={180}><Scene index={index} kind={kind} assets={assets}/></Sequence>)}
    <svg width={1920} height={1080} style={{position: 'absolute', pointerEvents: 'none', fontFamily: family}}><Header kind={kind}/></svg>
    <Measurement kind={kind}/>
  </AbsoluteFill>;
}
