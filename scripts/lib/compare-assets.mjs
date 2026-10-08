import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
function imageDimensions(file) {
  if (path.extname(file).toLowerCase() === '.svg') {
    const head=fs.readFileSync(file,'utf8').slice(0,65536).match(/<svg\b[^>]*>/u)?.[0];
    if(!head)throw new Error('SVG 没有可解析根元素');
    const attr=name=>head.match(new RegExp(`\\b${name}=["']([^"']+)["']`))?.[1];
    const number=value=>value&&/^\d+(?:\.\d+)?(?:px)?$/u.test(value)?Number.parseFloat(value):0;
    const box=(attr('viewBox')??'').trim().split(/[\s,]+/u).map(Number);
    const width=number(attr('width')) || (box.length===4?box[2]:0),height=number(attr('height')) || (box.length===4?box[3]:0);
    if(!width||!height)throw new Error('SVG 需要明确画布尺寸');
    return {width,height};
  }
  const result=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',file],{encoding:'utf8',timeout:10000}));
  const size=result.streams?.[0];if(!size?.width||!size?.height)throw new Error('素材尺寸无法读取');return size;
}
export function compareAssetIssues(scene,directory) {
  if(scene.shot?.id!=='media-before-after')return [];
  try {
    const layers=[scene.shot.slots.before,scene.shot.slots.after].map(id=>scene.layers.find(l=>l.id===id));
    const files=layers.map(l=>path.resolve(directory,l.asset));
    const sizes=files.map(imageDimensions);
    if(sizes.some((size,i)=>size.width!==layers[i].width||size.height!==layers[i].height))return [`scene ${scene.id}: 前后图真实尺寸与声明尺寸不符，必须使用同尺寸素材`];
    const hashes=files.map(file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
    if(hashes[0]===hashes[1])return [`scene ${scene.id}: 前后图不能是相同文件内容`];
    return [];
  } catch(error) {return [`scene ${scene.id}: 前后素材检查失败：${error.message}`];}
}
