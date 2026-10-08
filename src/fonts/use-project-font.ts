import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {resolveFont, type FontRef} from './catalog';

const loaded = new Map<string, Promise<void>>();
export function loadProjectFont(ref: FontRef): Promise<void> {
  const font = resolveFont(ref);
  const key = `${ref.id}@${ref.version}`;
  let promise = loaded.get(key);
  if (!promise) {
    promise = Promise.all(font.faces.map(async face => {
      const fontFace = new FontFace(font.family, `url("${staticFile(face.file)}") format("${face.format}")`, {weight: face.weight});
      const result = await fontFace.load();
      document.fonts.add(result);
    })).then(() => undefined);
    loaded.set(key, promise);
  }
  return promise;
}

// Mount layout-measuring scenes only after the selected files have loaded.
export function useProjectFont(ref?: FontRef): boolean {
  const key = ref ? `${ref.id}@${ref.version}` : '';
  const [ready, setReady] = useState('');
  const [initial] = useState(() => ({key, handle: delayRender('Load project font', {timeoutInMilliseconds: 60000})}));
  useEffect(() => {
    if (!ref) {continueRender(initial.handle); return;}
    let live = true;
    const handle = key === initial.key ? initial.handle : delayRender(`Load project font ${key}`, {timeoutInMilliseconds: 60000});
    loadProjectFont(ref).then(() => {
      if (live) setReady(key);
      continueRender(handle);
    }).catch(error => {continueRender(handle); cancelRender(new Error(`项目字体加载失败：${key}；${String(error)}`));});
    return () => {live = false; continueRender(handle);};
  }, [key, ref, initial]);
  return !ref || ready === key;
}
