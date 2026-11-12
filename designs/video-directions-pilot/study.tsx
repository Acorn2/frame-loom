import React, {createContext, useContext, useEffect} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {useProjectFont} from '../../src/fonts/use-project-font';
import plan from './scene-plan.json';

// Approved scope: isolated design studies, with original geometry and real screenshots.
// These compositions do not register a production shot or change any existing style.
export type StudyProps = {kind: 'mechanism' | 'product'; assets: Record<string, string>};
const FONT = '"FrameLoom Source Han Sans SC"';
const Assets = createContext<Record<string, string>>({});
const ink = '#eff4f6', muted = '#9baab4', line = '#53616c', cyan = '#8bd0df', gold = '#f0bd6e';
const ease = Easing.bezier(.22, 1, .36, 1);
const p = (frame: number, start = 0, length = 24) => interpolate(frame, [start, start + length], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
const between = (a: number, b: number, t: number) => a + (b - a) * t;

function Text({x, y, size = 28, fill = ink, weight = 400, children, anchor = 'start', spacing = 0}: {
  x: number; y: number; size?: number; fill?: string; weight?: number; children: React.ReactNode; anchor?: 'start' | 'middle' | 'end'; spacing?: number;
}) {
  return <text data-study-text="true" x={x} y={y} fill={fill} fontSize={size} fontWeight={weight} textAnchor={anchor} letterSpacing={spacing}>{children}</text>;
}

function Draw({d, at = 0, color = cyan, width = 2, dashed = false}: {d: string; at?: number; color?: string; width?: number; dashed?: boolean}) {
  const f = useCurrentFrame();
  return <path d={d} fill="none" stroke={color} strokeWidth={width} pathLength={1}
    strokeDasharray={dashed ? '5 8' : 1} strokeDashoffset={dashed ? 0 : 1 - p(f, at, 30)} opacity={dashed ? p(f, at) : 1}/>;
}

function Appear({at = 0, children, shift = 18}: {at?: number; children: React.ReactNode; shift?: number}) {
  const f = useCurrentFrame(), v = p(f, at);
  return <g opacity={v} transform={`translate(0 ${shift * (1 - v)})`}>{children}</g>;
}

function Grid() {
  return <><defs><pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#34404a" strokeWidth="1" opacity=".42"/></pattern></defs>
    <rect width="1920" height="1080" fill="#151a1f"/><rect width="1920" height="1080" fill="url(#grid)"/>
    {[96, 1824].flatMap(x => [96, 984].map(y => <path key={`${x}-${y}`} d={`M${x - 8} ${y}h16M${x} ${y - 8}v16`} stroke={line}/>))}
  </>;
}

function DiagramPage({section, children, footnote = '流程依据：FrameLoom 当前审片与返工文档'}: {section: string; children: React.ReactNode; footnote?: string}) {
  return <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{fontFamily: FONT}}>
    <Grid/>
    <Text x={112} y={100} size={21} fill={cyan} spacing={3}>FRAMELOOM / MECHANISM STUDY</Text>
    <Text x={1808} y={100} size={21} fill={muted} anchor="end">{section}</Text>
    {children}
    <path d="M112 992H1808" stroke={line} opacity=".65"/>
    <Text x={112} y={1030} size={20} fill={muted}>{footnote}</Text>
    <Text x={1808} y={1030} size={20} fill={muted} anchor="end">设计试片 · 静音</Text>
  </svg>;
}

function FilmStrip({x, y, w = 220, h = 140, active = false, label = 'S02'}: {x: number; y: number; w?: number; h?: number; active?: boolean; label?: string}) {
  return <g transform={`translate(${x} ${y})`}>
    <rect width={w} height={h} fill={active ? '#263132' : '#1c242b'} stroke={active ? gold : line} strokeWidth={active ? 2 : 1}/>
    {Array.from({length: 7}, (_, i) => <g key={i}><rect x={12 + i * (w - 36) / 7} y={8} width={12} height={5} fill={line}/><rect x={12 + i * (w - 36) / 7} y={h - 13} width={12} height={5} fill={line}/></g>)}
    <Text x={20} y={45} size={21} fill={active ? gold : muted}>{label}</Text>
    <path d={`M20 ${h - 44}h${w * .44}M20 ${h - 30}h${w * .67}`} stroke={active ? gold : muted} strokeWidth="3"/>
  </g>;
}

function OpeningMechanism() {
  const f = useCurrentFrame();
  return <DiagramPage section="01 / 定位修改">
    <Appear at={0}><Text x={112} y={274} size={28} fill={muted}>从一条反馈，到一个新版本</Text></Appear>
    <Appear at={8}><Text x={106} y={420} size={104} weight={750}>先改这一镜</Text><Text x={106} y={556} size={104} weight={750} fill={gold}>再更新整片</Text></Appear>
    <Appear at={29}><Text x={112} y={675} size={30} fill={muted}>定位 → 局部预览 → 确认 → 更新</Text></Appear>
    <g transform={`translate(0 ${14 * (1 - p(f, 8, 40))})`}>
      <Appear at={13}>
        <path d="M1120 620l360-170 300 146-360 170Z" fill="#1a242c" stroke={line}/>
        <path d="M1120 620v25l300 146v-25M1420 791l360-170v-25" fill="none" stroke={line}/>
        <path d="M1120 500l360-170 300 146-360 170Z" fill="#202d36" stroke={cyan} strokeWidth="1.5"/>
        <path d="M1120 500v25l300 146v-25M1420 671l360-170v-25" fill="none" stroke={cyan}/>
        <path d="M1120 380l360-170 300 146-360 170Z" fill="#2b3438" stroke={gold} strokeWidth="2"/>
        <path d="M1120 380v25l300 146v-25M1420 551l360-170v-25" fill="none" stroke={gold}/>
        <path d="M1220 380l140-66M1250 399l200-94M1280 417l170-80" stroke={gold} opacity=".7" strokeWidth="4"/>
      </Appear>
      <Draw d="M1565 260H1720V198" at={35} color={gold}/>
      <Appear at={47}><Text x={1735} y={201} size={24} fill={gold}>反馈</Text></Appear>
      <Draw d="M1500 590H1772V665" at={48}/>
      <Appear at={60}><Text x={1772} y={707} size={24} fill={cyan} anchor="end">场景记录</Text></Appear>
      <Draw d="M1390 770V870H1670" at={65} color={muted}/>
      <Appear at={78}><Text x={1700} y={880} size={24} fill={muted} anchor="end">候选版本</Text></Appear>
    </g>
  </DiagramPage>;
}

const routeNames = ['审片视频', '时间码反馈', '场景记录', '镜头预览', '新版整片'];
const routeNotes = ['看见问题', '留下原始意见', '绑定场景 ID', '先检查修改', '确认后生成'];

function Route({compact = false}: {compact?: boolean}) {
  const f = useCurrentFrame();
  return <g transform={compact ? 'translate(0 0)' : undefined}>
    {routeNames.map((name, i) => {
      const x = 128 + i * 350;
      const active = f >= i * 26 + 30;
      return <g key={name}>
        {i < 4 && <><path d={`M${x + 230} 550H${x + 344}`} fill="none" stroke={line}/><Draw d={`M${x + 230} 550H${x + 344}`} at={40 + i * 26} color={i === 3 ? gold : cyan} width={3}/><path d={`M${x + 334} 543l10 7-10 7`} fill="none" stroke={line}/></>}
        <Appear at={i * 14 + 8}>
          <Text x={x} y={406} size={23} fill={active ? cyan : muted}>0{i + 1}</Text>
          {i === 0 || i === 3 || i === 4 ? <FilmStrip x={x} y={478} w={230} h={145} active={i === 3 && active} label={i === 0 ? 'CANDIDATE' : i === 3 ? 'S02 / REVISE' : 'NEXT VERSION'}/> : <>
            <rect x={x} y={478} width={230} height={145} fill={i === 2 ? '#202d36' : '#1c242b'} stroke={active ? cyan : line}/>
            <Text x={x + 20} y={541} size={29} fill={active ? cyan : ink}>{i === 1 ? '00:12' : 'scene-02'}</Text>
            <Text x={x + 20} y={589} size={20} fill={muted}>{i === 1 ? '这一处需要解释' : '来源 · 旁白 · 画面'}</Text>
          </>}
          <Text x={x} y={688} size={32} weight={650}>{name}</Text>
          <Text x={x} y={735} size={23} fill={muted}>{routeNotes[i]}</Text>
        </Appear>
      </g>;
    })}
    {!compact && <>
      <Draw d="M1293 478V337H943V478" at={131} color={gold}/>
      <Appear at={145}><Text x={1118} y={312} anchor="middle" size={24} fill={gold}>需要再改？回到这一镜</Text></Appear>
      <Appear at={164}><path d="M1538 470V825H1215V650" fill="none" stroke={gold} strokeDasharray="5 7"/><Text x={1376} y={868} anchor="middle" size={23} fill={gold}>创作者确认</Text></Appear>
    </>}
  </g>;
}

function MapMechanism() {
  return <DiagramPage section="02 / 全局路径" footnote="时间码与场景编号为示意；确认流程依据当前文档">
    <Appear><Text x={112} y={225} size={65} weight={700}>一次返工，沿着这条路径</Text></Appear>
    <Route/>
  </DiagramPage>;
}

function AnchorMechanism() {
  const f = useCurrentFrame(), v = p(f, 95, 45);
  return <DiagramPage section="03 / 局部展开" footnote="时间段、反馈和场景编号均为示意，不是实测生产记录">
    <Appear><Text x={112} y={230} size={65} weight={700}>时间码定位，场景 ID 接住修改</Text></Appear>
    <Appear at={12}><Text x={112} y={295} size={28} fill={muted}>时长可以变化，修改仍然对应同一个场景</Text></Appear>
    <path d="M140 430H1780" stroke={line}/>
    {[{x: 140, w: 410, id: 'S01', t: '00:00', end: '00:08'}, {x: 570, w: 690, id: 'S02', t: '00:08', end: '00:18'}, {x: 1280, w: 500, id: 'S03', t: '00:18', end: '00:26'}].map((s, i) => <Appear key={s.id} at={16 + i * 12}>
      <Text x={s.x} y={405} size={23} fill={muted}>{s.t}</Text>
      <rect x={s.x} y={448} width={s.w} height={132} fill={i === 1 ? '#2b3438' : '#1b232a'} stroke={i === 1 ? gold : line} strokeWidth={i === 1 ? 2 : 1}/>
      <Text x={s.x + 25} y={500} size={29} fill={i === 1 ? gold : muted} weight={650}>{s.id}</Text>
      <path d={`M${s.x + 25} 540h${s.w - 62}`} stroke={line}/>
    </Appear>)}
    <g opacity={p(f, 53)}><path d="M846 418v180" stroke={gold} strokeWidth="2"/><circle cx="846" cy="430" r="7" fill={gold}/><Text x={846} y={634} size={26} fill={gold} anchor="middle">00:12 · 把这一句解释拆开</Text></g>
    <Draw d="M920 655V710H680" at={80} color={gold}/>
    <g opacity={v} transform={`translate(0 ${20 * (1 - v)})`}>
      <rect x={140} y={724} width={730} height={177} fill="#202b32" stroke={cyan}/>
      <Text x={173} y={776} size={23} fill={muted}>修改绑定</Text><Text x={173} y={839} size={39} fill={cyan} weight={650}>scene-02</Text>
      <Text x={445} y={777} size={22} fill={muted}>内容与版本线索</Text><Text x={445} y={825} size={25}>讲稿 · 画面 · 反馈</Text><Text x={445} y={867} size={23} fill={muted}>沿同一个场景继续修订</Text>
      <path d="M910 810H1060" stroke={cyan}/><path d="M1048 800l12 10-12 10" fill="none" stroke={cyan}/>
      <Text x={1110} y={789} size={28} weight={650}>先生成修改镜头</Text><Text x={1110} y={842} size={25} fill={muted}>并说明后续时码与字幕变化</Text>
    </g>
  </DiagramPage>;
}

function ConfirmMechanism() {
  const f = useCurrentFrame(), accepted = f >= 125;
  return <DiagramPage section="04 / 确认门">
    <Appear><Text x={112} y={229} size={65} weight={700}>先确认局部，再更新整片</Text></Appear>
    <Appear at={12}><Text x={112} y={298} size={28} fill={muted}>把改动的范围交给创作者检查</Text></Appear>
    <Appear at={24}>
      <FilmStrip x={150} y={445} w={390} h={230} label="S02 / 原镜头"/>
      <Text x={150} y={737} size={26} fill={muted}>原来的解释</Text>
    </Appear>
    <Draw d="M570 560H674" at={45}/>
    <Appear at={50}>
      <FilmStrip x={700} y={445} w={390} h={230} active label="S02 / 修改镜头"/>
      <Text x={700} y={737} size={26} fill={gold}>对应意见，修改这一镜</Text>
      <path d="M754 551h165M754 581h250M754 611h205" stroke={gold} strokeWidth="3"/>
    </Appear>
    <Draw d="M1110 560H1200" at={80} color={gold}/>
    <Appear at={86}>
      <path d="M1290 468l90 92-90 92-90-92Z" fill={accepted ? '#283833' : '#20292f'} stroke={accepted ? cyan : gold} strokeWidth="2"/>
      <Text x={1290} y={551} size={25} anchor="middle" fill={accepted ? cyan : gold}>{accepted ? '已确认' : '待确认'}</Text>
      <Text x={1290} y={591} size={21} anchor="middle" fill={muted}>创作者</Text>
    </Appear>
    <Draw d="M1380 560H1490" at={125}/>
    <Appear at={134}>
      <FilmStrip x={1510} y={455} w={255} h={210} label="新版整片"/>
      <Text x={1510} y={737} size={25}>重新生成与 QA</Text>
    </Appear>
    <Draw d="M1290 652V863H895V695" at={100} color={gold}/>
    <Appear at={112}><Text x={1102} y={912} anchor="middle" size={26} fill={gold}>还需调整，就继续修改局部</Text></Appear>
  </DiagramPage>;
}

function CloseMechanism() {
  return <DiagramPage section="05 / 留下依据">
    <Appear><Text x={112} y={291} size={90} weight={750}>改动有范围</Text><Text x={112} y={416} size={90} fill={gold} weight={750}>交付有依据</Text></Appear>
    <g transform="translate(25 216) scale(.62)"><Route compact/></g>
    <Appear at={40}>
      <path d="M1306 265V748" stroke={line}/>
      {[['场景记录', '知道修改落在哪里'], ['原始反馈', '知道为什么修改'], ['候选版本', '知道正在检查哪一版']].map(([a, b], i) => <g key={a} transform={`translate(1370 ${315 + i * 154})`}>
        <Text x={0} y={0} size={31} weight={650}>{a}</Text><Text x={0} y={51} size={24} fill={muted}>{b}</Text>
      </g>)}
    </Appear>
    <Appear at={67}><Text x={112} y={926} size={29} fill={cyan}>从整体定位问题，在局部完成修改</Text></Appear>
  </DiagramPage>;
}

type Crop = {x: number; y: number; w: number; h: number};
const imageSize: Record<string, [number, number]> = {'styles-overview.png': [1600, 1000], 'styles-selected.png': [1377, 963], 'fonts.png': [1377, 963], 'settings.png': [1377, 963], 'instruction.png': [1377, 963]};

function Screenshot({file, x, y, w, h, crop, opacity = 1, border = true}: {file: string; x: number; y: number; w: number; h: number; crop?: Crop; opacity?: number; border?: boolean}) {
  const assets = useContext(Assets), [iw, ih] = imageSize[file]!;
  const c = crop ?? {x: 0, y: 0, w: iw, h: ih};
  const scale = Math.max(w / c.w, h / c.h);
  return <div data-study-image={file} style={{position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', opacity, border: border ? '1px solid #d5dce5' : undefined, boxShadow: border ? '0 30px 70px rgba(29,43,68,.11)' : undefined, background: '#f7f8fa'}}>
    {assets[file] && <Img src={assets[file]} style={{position: 'absolute', width: iw * scale, height: ih * scale, maxWidth: 'none', left: -c.x * scale, top: -c.y * scale}}/>}
  </div>;
}

function Copy({x = 112, y, size = 70, color = '#202835', weight = 750, children, width = 680, at = 0}: {x?: number; y: number; size?: number; color?: string; weight?: number; width?: number; children: React.ReactNode; at?: number}) {
  const f = useCurrentFrame(), v = p(f, at, 28);
  return <div data-study-copy="true" style={{position: 'absolute', left: x, top: y, fontSize: size, lineHeight: 1.28, letterSpacing: size > 50 ? -2.5 : 0, color, fontWeight: weight, width, whiteSpace: 'pre-line', opacity: v, transform: `translateY(${22 * (1 - v)}px)`}}>{children}</div>;
}

function ProductPage({step, children}: {step: number; children: React.ReactNode}) {
  return <AbsoluteFill style={{background: '#f5f7fa', fontFamily: FONT, color: '#202835'}}>
    <div style={{position: 'absolute', left: 112, top: 77, fontSize: 23, letterSpacing: 2.5, color: '#526478'}}>FRAMELOOM / PRODUCT STUDY</div>
    {children}
    <div style={{position: 'absolute', left: 112, right: 112, top: 995, borderTop: '1px solid #d8dfe8', display: 'flex', paddingTop: 19, gap: 44, fontSize: 21, color: '#6e7b8e'}}>
      {['看样片', '选字体', '交给 Agent'].map((label, i) => <span key={label} style={{color: step === i ? '#2855d9' : '#6e7b8e', fontWeight: step === i ? 700 : 400}}>{`0${i + 1} / ${label}`}</span>)}
      <span style={{marginLeft: 'auto'}}>真实界面 · 截图状态演示 · 静音试片</span>
    </div>
  </AbsoluteFill>;
}

function OpeningProduct() {
  const f = useCurrentFrame(), v = p(f, 12, 42);
  return <ProductPage step={0}>
    <Copy y={220} size={28} color="#526478" weight={450}>从公开配方库开始</Copy>
    <Copy y={320} size={104} width={600} at={6}>{'先看见\n再决定'}</Copy>
    <Copy y={645} size={31} color="#526478" weight={450} width={590} at={24}>{'选画法、定字体\n把组合交给本地 Agent'}</Copy>
    <div style={{opacity: v, transform: `translate(${70 * (1 - v)}px, 0)`}}>
      <div style={{position: 'absolute', left: 738, top: 226, width: 1100, height: 630, background: '#e5ebf4', transform: 'translate(28px, 28px)'}}/>
      <Screenshot file="styles-overview.png" x={710} y={200} w={1096} h={685}/>
    </div>
    <Copy x={710} y={916} size={24} color="#526478" weight={450} width={1050} at={37}>原始网页取景，保留界面与样片原貌</Copy>
  </ProductPage>;
}

function StyleProduct() {
  const f = useCurrentFrame(), v = p(f, 70, 52);
  return <ProductPage step={0}>
    <Copy y={160} size={72} width={1680}>{'看清画法，再选风格'}</Copy>
    <Screenshot file="styles-selected.png" x={between(112, 1040, v)} y={between(300, 170, p(f, 90, 32))} w={between(1696, 740, v)} h={between(571, 756, v)}
      crop={{x: between(25, 916, v), y: between(380, 383, v), w: between(1324, 431, v), h: between(447, 440, v)}}/>
    <div style={{opacity: v}}>
      <Copy y={370} size={44} width={710} at={114}>{'画面怎么展开\n比名字更直观'}</Copy>
      <Copy y={570} size={29} color="#526478" width={700} weight={450} at={126}>{'从实际样片观察文字、关系和动效\n这里选择「编辑式排印」'}</Copy>
      <Copy y={802} size={24} color="#2855d9" width={680} at={102}>取景进入已选卡片，界面像素保持原样</Copy>
    </div>
  </ProductPage>;
}

function FontProduct() {
  const f = useCurrentFrame(), v = p(f, 68, 50);
  return <ProductPage step={1}>
    <Copy y={164} size={75} width={1600}>{'一个选择，贯穿全片'}</Copy>
    <Copy y={277} size={29} weight={450} color="#526478" width={1500} at={12}>风格决定画法，字体独立选择</Copy>
    <Screenshot file="fonts.png" x={112} y={389} w={between(1696, 1025, v)} h={between(540, 404, v)}
      crop={{x: between(30, 32, v), y: between(249, 351, v), w: between(1317, 431, v), h: between(424, 170, v)}}/>
    <div style={{opacity: v}}>
      <Copy x={1220} y={443} size={39} width={580} at={111}>思源黑体</Copy>
      <Copy x={1220} y={530} size={29} weight={450} color="#526478" width={580} at={124}>{'标题、正文、图解\n使用同一个字体家族'}</Copy>
      <Copy x={1220} y={745} size={25} color="#2855d9" weight={500} width={580} at={95}>当前真实选项：全片字体单选</Copy>
    </div>
  </ProductPage>;
}

function HandoffProduct() {
  const f = useCurrentFrame(), v = p(f, 84, 42);
  return <ProductPage step={2}>
    <Copy y={216} size={83} width={700}>{'带着选择\n回到本地制作'}</Copy>
    <Copy y={515} size={30} width={655} color="#526478" weight={450} at={18}>{'复制制作指令\n在 Agent 中附上文档与素材'}</Copy>
    <Copy y={781} size={25} width={620} color="#2855d9" at={33}>网页负责选型，制作在本地进行</Copy>
    <Screenshot file="settings.png" x={855} y={193} w={951} h={665} opacity={1 - v}/>
    <Screenshot file="instruction.png" x={855} y={193} w={951} h={665} crop={{x: 372, y: 352, w: 968, h: 676}} opacity={v}/>
    <Copy x={855} y={900} size={24} width={950} color="#526478" weight={450} at={32}>制作设置与指令入口，均来自当前网页</Copy>
  </ProductPage>;
}

function CloseProduct() {
  const f = useCurrentFrame(), v = p(f, 15, 42);
  return <ProductPage step={2}>
    <Copy y={181} size={104} width={1600}>{'网页选型。本地制作。'}</Copy>
    <Copy y={345} size={30} width={1600} color="#526478" weight={450} at={12}>画法、字体和交付用途，随同一条指令交给 Agent</Copy>
    <div style={{opacity: v}}>
      <Screenshot file="styles-selected.png" x={112} y={471} w={539} h={406} crop={{x: 915, y: 382, w: 435, h: 328}}/>
      <Screenshot file="fonts.png" x={690} y={471} w={539} h={406} crop={{x: 32, y: 352, w: 430, h: 324}}/>
      <Screenshot file="instruction.png" x={1268} y={471} w={539} h={406} crop={{x: 391, y: 381, w: 927, h: 698}}/>
    </div>
    <Copy x={112} y={908} size={24} color="#526478" weight={450} width={500} at={30}>从样片做选择</Copy>
    <Copy x={690} y={908} size={24} color="#526478" weight={450} width={500} at={38}>为全片定字体</Copy>
    <Copy x={1268} y={908} size={24} color="#526478" weight={450} width={540} at={46}>把选择带入制作</Copy>
  </ProductPage>;
}

const mechanism = [OpeningMechanism, MapMechanism, AnchorMechanism, ConfirmMechanism, CloseMechanism];
const product = [OpeningProduct, StyleProduct, FontProduct, HandoffProduct, CloseProduct];

function Fade({frames, children}: {frames: number; children: React.ReactNode}) {
  const f = useCurrentFrame();
  const alpha = Math.min(p(f, 0, 12), interpolate(f, [frames - 12, frames - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  return <AbsoluteFill style={{opacity: alpha}}>{children}</AbsoluteFill>;
}

// A narrow measured check for these prototypes. It is not a production QA receipt.
function Measure({frame}: {frame: number}) {
  useEffect(() => {
    const texts = [...document.querySelectorAll<SVGGraphicsElement | HTMLElement>('[data-study-text], [data-study-copy]')];
    const issues = texts.flatMap((el) => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || getComputedStyle(el).opacity === '0') return [];
      return box.left < 65 || box.top < 40 || box.right > 1860 || box.bottom > 1050 ? [{text: el.textContent, box: {left: box.left, top: box.top, right: box.right, bottom: box.bottom}}] : [];
    });
    console.log(`STUDY_LAYOUT ${JSON.stringify({frame, count: texts.length, issues})}`);
  }, [frame]);
  return null;
}

export function Study({kind, assets}: StudyProps) {
  const ready = useProjectFont(plan.font as {id: 'source-han-sans-sc'; version: string});
  const frame = useCurrentFrame();
  const film = plan.films.find(f => f.slug === kind)!;
  const components = kind === 'mechanism' ? mechanism : product;
  let cursor = 0;
  return <Assets.Provider value={assets}>
    <AbsoluteFill style={{background: kind === 'mechanism' ? '#151a1f' : '#f5f7fa'}}>
      {ready && film.scenes.map((scene, index) => {
        const start = cursor, duration = scene.seconds * plan.fps, Scene = components[index]!;
        cursor += duration;
        return <Sequence key={scene.id} from={start} durationInFrames={duration} premountFor={15}>
          <Fade frames={duration}><Scene/></Fade>
        </Sequence>;
      })}
      {ready && <Measure frame={frame}/>}
    </AbsoluteFill>
  </Assets.Provider>;
}
