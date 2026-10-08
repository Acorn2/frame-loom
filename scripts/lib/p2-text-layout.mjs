import {isP2Shot} from '../../src/shots/p2/schema.ts';
import {p2CardType} from '../../src/shots/p2/layout.ts';
export function checkP2Text(scene, lines) {
  const shot=scene.shot;if(!shot||!isP2Shot(shot))return [];
  const issues=[];
  const check=(id,w,h)=>{const l=scene.layers.find(l=>l.id===id),t=p2CardType(h),inner=w-t.padding*2;
    const label=lines(l.label,t.label,t.row?inner*.3:inner)*t.label*1.2;
    const text=lines(l.text,t.text,t.row?inner*.68:inner)*t.text*1.4;
    const used=t.row?Math.max(label,text):label+(l.text?t.gap+text:0);
    if(used>h-t.padding*2)issues.push({severity:'error',sceneId:scene.id,target:id,message:'P2 文本超出实际槽位；请缩短、减少条目或拆镜头。'});
  };
  if(shot.id==='research-stack')shot.slots.items.forEach(id=>check(id,600,220));
  if(shot.id==='list-stack-press')shot.slots.items.forEach(id=>check(id,760,73));
  if(shot.id==='scroll-brake')shot.slots.items.forEach(id=>check(id,760,90));
  if(shot.id==='integration-hub'){check(shot.slots.before,300,130);check(shot.slots.hub,300,130);shot.slots.items.forEach(id=>check(id,200,100));}
  if(shot.id==='ring-annotation'||shot.id==='cycle-mechanism'){check(shot.slots.subject,300,130);shot.slots.items.forEach(id=>check(id,shot.id==='ring-annotation'?345:200,shot.id==='ring-annotation'?94:100));}
  if(shot.id==='member-grid')shot.slots.items.forEach(id=>check(id,218,114));
  if(shot.id==='document-write')for(const id of shot.slots.blocks){const l=scene.layers.find(l=>l.id===id);if(lines(l.label,22,570)*22*1.4+lines(l.text,18,570)*18*1.4>340/shot.slots.blocks.length-8)issues.push({severity:'error',sceneId:scene.id,target:id,message:'文档段落超出书写槽位；拆分段落或镜头。'});}
  if(shot.id==='code-reveal'){const l=scene.layers.find(l=>l.id===shot.slots.code);if(lines(l.text,24,740)*36>340)issues.push({severity:'error',sceneId:scene.id,target:l.id,message:'代码行超出面板；减少行数或拆镜头。'});}
  return issues;
}
