import React, {useEffect} from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {useProjectFont} from '../../src/fonts/use-project-font';
import plan from './scene-plan.json';

// Approved direction: editorial explainers retain their serif / ink / red identity.
// This isolated study explores evidence-led page compositions before registration.
const C = {paper: '#f5f5f3', ink: '#242424', muted: '#5c605f', line: '#c3c7c4', red: '#c84634', light: '#e7e9e6'};
const font = '"FrameLoom Source Han Serif SC"';
const data = plan.data;
const progress = (frame: number, start = 0, length = 25) => interpolate(frame, [start, start + length], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(.22, 1, .36, 1)});
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

function Text({x, y, size = 30, color = C.ink, weight = 400, anchor = 'start', children}: {
  x: number; y: number; size?: number; color?: string; weight?: number; anchor?: 'start' | 'middle' | 'end'; children: React.ReactNode;
}) {
  return <text data-study-text="true" x={x} y={y} fontSize={size} fontWeight={weight} fill={color} textAnchor={anchor}>{children}</text>;
}
function Reveal({at = 0, children, shift = 12}: {at?: number; children: React.ReactNode; shift?: number}) {
  const p = progress(useCurrentFrame(), at);
  return <g opacity={p} transform={`translate(0 ${shift * (1 - p)})`}>{children}</g>;
}
function Rule({x, y, width, at = 0, color = C.red, stroke = 2}: {x: number; y: number; width: number; at?: number; color?: string; stroke?: number}) {
  return <path d={`M${x} ${y}h${width}`} stroke={color} strokeWidth={stroke} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress(useCurrentFrame(), at, 30)}/>;
}
function Page({section, footer, children}: {section: string; footer?: string; children: React.ReactNode}) {
  return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{fontFamily: font}}>
    <rect width={1920} height={1080} fill={C.paper}/>
    <Text x={120} y={78} size={23} weight={600}>墨白杂志 / EDITORIAL INK</Text>
    <Text x={1800} y={78} size={23} color={C.muted} anchor="end">{section}</Text>
    <path d="M120 115H1800M120 966H1800" stroke={C.line}/>
    <Rule x={120} y={115} width={310} stroke={3}/>
    {children}
    <Text x={120} y={1014} size={22} color={C.muted}>{footer ?? '演示数据：A=90，B=100，不对应真实业务指标'}</Text>
    <Text x={1800} y={1014} size={22} color={C.muted} anchor="end">设计试片 · 静音</Text>
  </svg>;
}

function Opening() {
  const f = useCurrentFrame(), bars = progress(f, 44, 45);
  const base = 819, h = 367;
  return <Page section="01 / 提出问题">
    <Reveal><Text x={120} y={229} size={28} color={C.red}>数据阅读</Text></Reveal>
    <Reveal at={7}><Text x={114} y={385} size={116} weight={700}>同样的数据</Text></Reveal>
    <Reveal at={17}><Text x={114} y={560} size={116} weight={700}>另一种结论？</Text></Reveal>
    <Rule x={120} y={618} width={760} at={30} stroke={2}/>
    <Reveal at={42}><Text x={120} y={703} size={32} color={C.muted}>有时，差别藏在数轴的起点</Text></Reveal>
    <g>
      <path d="M1084 819H1770" stroke={C.ink} strokeWidth={2}/>
      <rect x={1160} y={base - h * .9 * bars} width={180} height={h * .9 * bars} fill={C.ink}/>
      <rect x={1490} y={base - h * bars} width={180} height={h * bars} fill={C.red}/>
      <Reveal at={85}><Text x={1250} y={431} size={108} weight={700} anchor="middle">90</Text><Text x={1580} y={393} size={108} weight={700} color={C.red} anchor="middle">100</Text></Reveal>
      <Reveal at={56}><Text x={1250} y={876} size={30} anchor="middle">A</Text><Text x={1580} y={876} size={30} anchor="middle">B</Text><Text x={1060} y={829} size={26} color={C.muted} anchor="end">0</Text></Reveal>
    </g>
    <Reveal at={106}><Text x={120} y={881} size={26}>先看表达，再看判断</Text></Reveal>
  </Page>;
}

function Source() {
  return <Page section="02 / 阅读来源" footer="规则依据：Government Analysis Function《Bar charts》；中文为意译">
    <Reveal><Text x={120} y={246} size={76} weight={700}>先读规则，再看结论</Text></Reveal>
    <path d="M1200 334V863" stroke={C.line}/>
    <Reveal at={16}><Text x={120} y={362} size={25} color={C.muted}>规则摘记 / 英国政府分析职能部门</Text></Reveal>
    <Reveal at={29}><Text x={120} y={479} size={66} weight={600}>条形图的数轴</Text><Text x={120} y={576} size={66} weight={600}>应从零开始</Text></Reveal>
    <Rule x={120} y={603} width={402} at={65} stroke={4}/>
    <Reveal at={80}><Text x={120} y={716} size={31}>截短起点，会改变柱长的相对比例</Text><Text x={120} y={774} size={31} color={C.muted}>比较时，保留完整的数量背景</Text></Reveal>
    <Reveal at={104}><Text x={120} y={876} size={25} color={C.muted}>这里讨论的是：以长度编码数量的条形图</Text></Reveal>
    <Reveal at={61}><Text x={1270} y={399} size={63} color={C.red}>01</Text><Text x={1400} y={391} size={39} weight={600}>长度就是数值</Text><Text x={1270} y={488} size={28}>我们先读出柱子的高低</Text><Text x={1270} y={535} size={28} color={C.muted}>再形成对数量差别的印象</Text></Reveal>
    <Reveal at={113}><Text x={1270} y={669} size={63} color={C.red}>02</Text><Text x={1400} y={661} size={39} weight={600}>起点影响比例</Text><Text x={1270} y={758} size={28}>缺掉的部分，也在改变判断</Text><Text x={1270} y={805} size={28} color={C.muted}>因此先把比较的尺度讲清楚</Text></Reveal>
  </Page>;
}

function Chart({x, y = 810, width = 680, height = 360, origin, entry = 0, dynamic = false}: {x: number; y?: number; width?: number; height?: number; origin: number; entry?: number; dynamic?: boolean}) {
  const f = useCurrentFrame(), p = progress(f, entry, 38), plotX = x + 70;
  const scale = height / (data.maximum - origin);
  const ticks = [origin, (origin + data.maximum) / 2, data.maximum];
  const display = (n: number) => Number(n.toFixed(0));
  return <g>
    {ticks.map((tick, i) => {
      const yy = y - (tick - origin) * scale;
      return <g key={i}><path d={`M${plotX} ${yy}h${width - 80}`} stroke={i === 0 ? C.ink : C.line} strokeWidth={i === 0 ? 2 : 1}/><Text x={plotX - 22} y={yy + 9} size={26} anchor="end" color={i === 0 ? C.red : C.muted}>{display(tick)}</Text></g>;
    })}
    {[{name: 'A', value: data.A, color: C.ink}, {name: 'B', value: data.B, color: C.red}].map((bar, i) => {
      const bx = plotX + 98 + i * (width - 80) * .42, bh = (bar.value - origin) * scale * p;
      return <g key={bar.name}>
        <rect x={bx} y={y - bh} width={133} height={bh} fill={bar.color}/>
        <g opacity={dynamic ? 1 : progress(f, entry + 39, 15)}><Text x={bx + 66.5} y={y - bh - 23} size={43} weight={700} color={bar.color} anchor="middle">{bar.value}</Text></g>
        <Text x={bx + 66.5} y={y + 57} size={29} anchor="middle">{bar.name}</Text>
      </g>;
    })}
  </g>;
}

function Compare() {
  return <Page section="03 / 并置证据">
    <Reveal><Text x={120} y={240} size={73} weight={700}>同一组数值，两种视觉印象</Text></Reveal>
    <path d="M960 323V917" stroke={C.line}/>
    <Reveal at={14}><Text x={180} y={346} size={39} weight={600}>零起点</Text><Text x={1090} y={346} size={39} weight={600}>截短到 80</Text></Reveal>
    <Reveal at={23}><Chart x={180} origin={0} entry={28}/></Reveal>
    <Reveal at={77}><Chart x={1090} origin={data.truncatedOrigin} entry={82}/></Reveal>
    <Reveal at={140}><Text x={180} y={923} size={25} color={C.muted}>两图都只使用 90 和 100</Text><Text x={1090} y={923} size={25} color={C.red}>右图柱长为 2 倍，数值并未翻倍</Text></Reveal>
  </Page>;
}

function Rescale() {
  const f = useCurrentFrame(), p = progress(f, 44, 100), origin = mix(data.truncatedOrigin, 0, p);
  const steps = [
    {title: '看数值', body: '始终是 90 和 100', at: 8},
    {title: '看起点', body: '把被截掉的部分补回来', at: 52},
    {title: '看比较方式', body: '用同一把尺子读差异', at: 143}
  ];
  return <Page section="04 / 展开论证">
    <Reveal><Text x={120} y={242} size={76} weight={700}>把起点补回来</Text></Reveal>
    {steps.map((step, i) => <Reveal at={step.at} key={step.title}>
      <Text x={120} y={421 + i * 173} size={30} color={C.red}>0{i + 1}</Text><Text x={201} y={425 + i * 173} size={44} weight={600}>{step.title}</Text>
      <Text x={201} y={484 + i * 173} size={29} color={C.muted}>{step.body}</Text>
    </Reveal>)}
    <Reveal at={12}><Text x={1120} y={346} size={31} color={C.muted}>数据不变，只还原比较尺度</Text><Chart x={1030} origin={origin} width={740} entry={-100} dynamic/></Reveal>
    <Reveal at={154}><Text x={1120} y={922} size={29} color={C.red}>真实差值始终是 10</Text></Reveal>
  </Page>;
}

function Closing() {
  const delta = data.B - data.A, relative = (delta / data.A * 100).toFixed(1);
  return <Page section="05 / 给出结论">
    <Reveal><Text x={120} y={265} size={89} weight={700}>好观点，要经得起</Text><Text x={120} y={396} size={89} weight={700}>同一把尺子的比较</Text></Reveal>
    <Reveal at={23}><Text x={120} y={626} size={158} weight={700}>90 → 100</Text></Reveal>
    <Reveal at={39}><Text x={1310} y={538} size={74} weight={700} color={C.red}>+{delta}</Text><Text x={1310} y={598} size={26} color={C.muted}>增加的数量</Text><Text x={1310} y={714} size={74} weight={700}>+{relative}%</Text><Text x={1310} y={774} size={26} color={C.muted}>以 90 为基数，四舍五入</Text></Reveal>
    <Rule x={120} y={745} width={970} at={62}/>
    {['保留上下文', '对齐比较尺度', '标明材料来源'].map((s, i) => <Reveal at={75 + i * 15} key={s}><Text x={120 + i * 565} y={882} size={34} weight={600}>{s}</Text></Reveal>)}
  </Page>;
}

function Measure({frame}: {frame: number}) {
  useEffect(() => {
    const visible = (node: Element) => {let el: Element | null = node; while (el) {if (Number(getComputedStyle(el).opacity) < .1) return false; el = el.parentElement;} return true;};
    const texts = [...document.querySelectorAll<SVGGraphicsElement>('[data-study-text]')].filter(visible).map(el => ({text: el.textContent, rect: el.getBoundingClientRect()}));
    const issues = texts.flatMap(({text, rect: r}) => r.left < 94 || r.right > 1826 || r.top < 42 || r.bottom > 1042 ? [{type: 'bounds', text, x: r.x, y: r.y, width: r.width, height: r.height}] : []);
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!, b = texts[j]!, x = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left), y = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (x > 5 && y > 6) issues.push({type: 'overlap', text: `${a.text} / ${b.text}`, x, y, width: x, height: y});
    }
    console.log(`EDITORIAL_LAYOUT ${JSON.stringify({frame, texts: texts.length, issues})}`);
  }, [frame]);
  return null;
}

const scenes = [Opening, Source, Compare, Rescale, Closing];
export function EditorialStudy() {
  const ready = useProjectFont(plan.font as {id: 'source-han-serif-sc'; version: string}), frame = useCurrentFrame();
  let cursor = 0;
  return <AbsoluteFill style={{background: C.paper}}>
    {ready && plan.scenes.map((scene, index) => {
      const start = cursor, duration = scene.seconds * plan.fps, Scene = scenes[index]!;
      cursor += duration;
      return <Sequence key={scene.id} from={start} durationInFrames={duration}><Scene/></Sequence>;
    })}
    {ready && <Measure frame={frame}/>}
  </AbsoluteFill>;
}
