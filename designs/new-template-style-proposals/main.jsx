import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DesignCanvas, DCArtboard, DCSection} from './design-canvas.jsx';
import './styles.css';

const scenes = [
  {id: 'opening', label: '开场', title: '把复杂问题讲清楚'},
  {id: 'process', label: '步骤', title: '三步，建立清晰的叙事'},
  {id: 'evidence', label: '数据', title: '一份材料，多种画面'},
  {id: 'media', label: '素材', title: '让真实素材成为主角'},
  {id: 'closing', label: '结尾', title: '让观点跟得上每一步'}
];

const families = [
  {
    id: 'editorial',
    name: 'Clean Editorial',
    subtitle: '现代编辑排版',
    description: '白场、硬朗网格与超大标题，适合知识讲解和报告摘要。'
  },
  {
    id: 'product',
    name: 'Product Frame',
    subtitle: '产品演示界面',
    description: '真实界面优先，使用产品窗口、步骤状态和来源标注组织内容。'
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    subtitle: '技术蓝图推演',
    description: '结构节点、连线和工程标注，适合解释系统、机制与流程。'
  }
];

function EditorialFrame({scene}) {
  if (scene === 'opening') {
    return (
      <div className="editorial-body editorial-opening">
        <div className="editorial-kicker">FRAMELOOM / FIELD GUIDE 01</div>
        <div className="editorial-open-title">
          <span>把复杂问题</span>
          <strong>讲清楚。</strong>
        </div>
        <div className="editorial-open-index">01</div>
        <div className="editorial-open-note">从问题出发<br />让每一步都有依据</div>
        <div className="editorial-rule" />
      </div>
    );
  }
  if (scene === 'process') {
    return (
      <div className="editorial-body editorial-process">
        <div className="editorial-kicker">A CLEAR NARRATIVE / 3 MOVES</div>
        <h2>三步，建立<br />清晰的叙事。</h2>
        <div className="editorial-columns">
          <div><b>01</b><strong>提问</strong><p>明确观众最关心的疑问。</p></div>
          <div><b>02</b><strong>拆解</strong><p>按顺序展开必要的事实。</p></div>
          <div><b>03</b><strong>回答</strong><p>收束为可复述的结论。</p></div>
        </div>
      </div>
    );
  }
  if (scene === 'evidence') {
    return (
      <div className="editorial-body editorial-evidence">
        <div className="editorial-kicker">ONE SOURCE / MANY FORMS</div>
        <h2>一份材料，<br />多种画面。</h2>
        <div className="editorial-measures">
          <div><strong>01</strong><span>份公开示例内容</span></div>
          <div><strong>03</strong><span>种视觉表达方向</span></div>
        </div>
        <div className="editorial-side-note">内容不变<br />构图与节奏改变</div>
      </div>
    );
  }
  if (scene === 'media') {
    return (
      <div className="editorial-body editorial-media">
        <div className="editorial-kicker">SOURCE MATERIAL / 01</div>
        <div className="editorial-media-screen">
          <img src="./assets/product-workflow.svg" alt="FrameLoom 风格选择公开示例界面" />
        </div>
        <div className="editorial-media-copy">
          <span>真实素材</span>
          <h2>成为<br />画面主角。</h2>
          <p>来源清楚，主体完整。</p>
        </div>
      </div>
    );
  }
  return (
    <div className="editorial-body editorial-closing">
      <div className="editorial-kicker">THE TAKEAWAY / 05</div>
      <div className="editorial-close-mark">CLEAR<br />BY DESIGN</div>
      <h2>让观点跟得上<br /><strong>每一步。</strong></h2>
      <div className="editorial-close-line"><span>重点突出</span><span>画面更好懂</span></div>
    </div>
  );
}

function ProductFrame({scene}) {
  const header = (
    <div className="product-topbar">
      <div className="product-brand"><i /> FRAMELOOM <span>STUDIO</span></div>
      <div className="product-project">项目 / 复杂问题讲解</div>
      <div className="product-status"><b /> REVIEW PREVIEW</div>
    </div>
  );

  if (scene === 'opening') {
    return (
      <div className="product-shell">
        {header}
        <div className="product-opening">
          <div className="product-side-label">PROJECT 01<br />KNOWLEDGE VIDEO</div>
          <div className="product-opening-copy">
            <span>从材料到可审阅视频</span>
            <h2>把复杂问题<br /><strong>讲清楚。</strong></h2>
            <p>先确定问题，再组织证据与表达。</p>
            <div className="product-action">开始梳理 <b>↗</b></div>
          </div>
          <div className="product-opening-graphic">
            <img src="./assets/product-workflow.svg" alt="" />
            <span>STORYBOARD / 01</span>
          </div>
        </div>
      </div>
    );
  }
  if (scene === 'process') {
    return (
      <div className="product-shell">
        {header}
        <div className="product-workspace">
          <div className="product-pane-title"><span>制作流程</span><b>3 STEPS</b></div>
          <div className="product-step-list">
            <div className="product-step"><i>01</i><strong>提问</strong><span>明确观众最关心的疑问。</span><b>完成</b></div>
            <div className="product-step is-active"><i>02</i><strong>拆解</strong><span>按顺序展开必要的事实。</span><b>当前</b></div>
            <div className="product-step"><i>03</i><strong>回答</strong><span>收束为可复述的结论。</span><b>待处理</b></div>
          </div>
          <div className="product-progress"><span>叙事结构</span><i><b /></i><strong>2 / 3</strong></div>
        </div>
      </div>
    );
  }
  if (scene === 'evidence') {
    return (
      <div className="product-shell">
        {header}
        <div className="product-workspace product-metrics">
          <div className="product-pane-title"><span>内容概览</span><b>SOURCE SUMMARY</b></div>
          <div className="product-metric-grid">
            <div><small>输入内容</small><strong>01</strong><span>份公开示例</span></div>
            <div className="product-metric-highlight"><small>视觉方向</small><strong>03</strong><span>套模板提案</span></div>
          </div>
          <div className="product-compare-line"><i /><span>文案与素材一致</span><b>构图各异</b></div>
        </div>
      </div>
    );
  }
  if (scene === 'media') {
    return (
      <div className="product-shell">
        {header}
        <div className="product-media-workspace">
          <div className="product-toolbar"><span>素材预览</span><span>FIT: CONTAIN</span><span>SOURCE: VERIFIED</span></div>
          <div className="product-media-image"><img src="./assets/product-workflow.svg" alt="FrameLoom 风格选择公开示例界面" /></div>
          <div className="product-inspector">
            <small>ASSET / 01</small>
            <strong>风格选择界面</strong>
            <span>来源已登记</span>
            <div>画面完整<br />适配留白</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="product-shell">
      {header}
      <div className="product-close-workspace">
        <div className="product-close-label">FINAL FRAME <span>05 / 05</span></div>
        <h2>让观点跟得上<br /><strong>每一步。</strong></h2>
        <p>重点突出，画面更好懂。</p>
        <div className="product-close-footer"><span>审核状态</span><b>✓ 已完成</b><span>视频预览已就绪</span></div>
      </div>
    </div>
  );
}

function BlueprintFrame({scene}) {
  if (scene === 'opening') {
    return (
      <div className="blueprint-body blueprint-opening">
        <div className="blueprint-meta">SYSTEM STUDY / FL-001 <span>FIG. 01</span></div>
        <div className="blueprint-title"><small>COMPLEXITY → CLARITY</small><h2>把复杂问题<br /><strong>讲清楚。</strong></h2></div>
        <div className="blueprint-flow">
          <div><b>01</b><span>问题</span></div><i /><div><b>02</b><span>证据</span></div><i /><div><b>03</b><span>结论</span></div>
        </div>
        <div className="blueprint-coord">X 042 / Y 118<br />FLOW: NORMAL</div>
      </div>
    );
  }
  if (scene === 'process') {
    return (
      <div className="blueprint-body blueprint-process">
        <div className="blueprint-meta">NARRATIVE SEQUENCE / 03 NODES <span>FIG. 02</span></div>
        <h2>三步，建立清晰的叙事。</h2>
        <div className="blueprint-route">
          <div className="blueprint-node"><b>01</b><strong>提问</strong><span>明确观众最关心的疑问。</span><small>INPUT / QUESTION</small></div>
          <i />
          <div className="blueprint-node blueprint-node-active"><b>02</b><strong>拆解</strong><span>按顺序展开必要的事实。</span><small>PROCESS / EVIDENCE</small></div>
          <i />
          <div className="blueprint-node"><b>03</b><strong>回答</strong><span>收束为可复述的结论。</span><small>OUTPUT / TAKEAWAY</small></div>
        </div>
      </div>
    );
  }
  if (scene === 'evidence') {
    return (
      <div className="blueprint-body blueprint-evidence">
        <div className="blueprint-meta">CONTENT VARIANTS / CONTROLLED INPUT <span>FIG. 03</span></div>
        <h2>一份材料，多种画面。</h2>
        <div className="blueprint-measure"><div><strong>01</strong><span>份公开示例内容</span></div><i>→</i><div><strong>03</strong><span>套视觉表达方向</span></div></div>
        <div className="blueprint-stamp">SAME<br />SOURCE</div>
        <div className="blueprint-caption">保持输入不变 / 比较视觉输出</div>
      </div>
    );
  }
  if (scene === 'media') {
    return (
      <div className="blueprint-body blueprint-media">
        <div className="blueprint-meta">ASSET TRACE / SOURCE VERIFIED <span>FIG. 04</span></div>
        <div className="blueprint-media-screen"><img src="./assets/product-workflow.svg" alt="FrameLoom 风格选择公开示例界面" /><span className="blueprint-corner tl">A1</span><span className="blueprint-corner br">1280 × 720</span></div>
        <div className="blueprint-media-note"><small>FOCUS OBJECT</small><h2>真实素材<br />成为主角。</h2><i /><span>完整显示<br />来源可追溯</span></div>
      </div>
    );
  }
  return (
    <div className="blueprint-body blueprint-closing">
      <div className="blueprint-meta">DESIGN RESULT / STABLE STATE <span>FIG. 05</span></div>
      <div className="blueprint-crosshair">+</div>
      <div className="blueprint-close-copy"><small>FINAL TAKEAWAY</small><h2>让观点跟得上<br /><strong>每一步。</strong></h2><span>重点突出，画面更好懂。</span></div>
      <div className="blueprint-dimension"><i /><span>CLARITY 100%</span><i /></div>
    </div>
  );
}

function TemplateArtboard({family, scene}) {
  const Frame = family.id === 'editorial' ? EditorialFrame : family.id === 'product' ? ProductFrame : BlueprintFrame;
  return (
    <div className={`template-frame family-${family.id}`} data-screen-label={`${family.name} / ${scene}`}>
      <div className="frame-running-head">
        <span>{family.id === 'editorial' ? 'FRAMELOOM / VISUAL ESSAY' : family.id === 'product' ? 'FRAMELOOM STUDIO' : 'FRAMELOOM / TECHNICAL PLATE'}</span>
        <span>{scenes.find((item) => item.id === scene)?.label.toUpperCase()} <b>·</b> 01—05</span>
      </div>
      <Frame scene={scene} />
      <div className="frame-caption"><span>同一份分镜 / 视觉提案</span><b>{family.id === 'editorial' ? 'EDITORIAL' : family.id === 'product' ? 'PRODUCT DEMO' : 'SYSTEMS'}</b></div>
    </div>
  );
}

function App() {
  const [scene, setScene] = useState('opening');
  return (
    <>
      <DesignCanvas minScale={0.12} maxScale={1.5}>
        <div className="canvas-top-space" />
        <DCSection
          id="new-template-directions"
          title="三套新增模板方向"
          subtitle="同一分镜，逐镜头切换；拖动画板比较，点击放大查看。"
          gap={44}
        >
          {families.map((family) => (
            <DCArtboard key={family.id} id={family.id} label={`${family.name} · ${family.subtitle}`} width={1200} height={675}>
              <TemplateArtboard family={family} scene={scene} />
            </DCArtboard>
          ))}
        </DCSection>
      </DesignCanvas>
      <header className="control-dock">
        <div className="dock-heading">
          <div><span className="dock-eyebrow">FRAMELOOM / TEMPLATE STUDY</span><h1>新增模板视觉提案</h1></div>
          <span className="proposal-badge">提案稿 · 未接入生产</span>
        </div>
        <nav className="scene-tabs" aria-label="选择分镜镜头">
          {scenes.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={scene === item.id}
              className={scene === item.id ? 'scene-tab is-selected' : 'scene-tab'}
              onClick={() => setScene(item.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>{item.label}
            </button>
          ))}
        </nav>
      </header>
      <aside className="dock-note">16:9 静帧提案 <span>同一内容 / 五个镜头</span></aside>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
