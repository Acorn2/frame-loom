/* global Image, document */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {openBrowser} from '@remotion/renderer';
import {projectRoot} from './style-catalog.mjs';

// Derive compact web covers from the actual renderer's PNGs; production originals stay intact.
export async function prepareLibraryPosters(sources) {
  const cache = path.join(projectRoot, '.tmp/library-webp');
  const result = new Map();
  let browser;
  let page;
  try {
    for (const source of new Set(sources.filter(Boolean))) {
      const input = fs.readFileSync(path.join(projectRoot, source));
      const digest = createHash('sha256').update(input).update('webp-quality-0.88-v1').digest('hex');
      const output = path.join(cache, `${digest}.webp`);
      if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
        if (!browser) {
          browser = await openBrowser('chrome');
          page = await browser.newPage({context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {}});
        }
        const encoded = await page.evaluate(async (data) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          canvas.getContext('2d').drawImage(image, 0, 0);
          const url = canvas.toDataURL('image/webp', .88);
          if (!url.startsWith('data:image/webp;base64,')) throw new Error('浏览器不支持 WebP 封面。');
          return url.split(',')[1];
        }, input.toString('base64'));
        fs.mkdirSync(cache, {recursive: true});
        fs.writeFileSync(output, Buffer.from(encoded, 'base64'));
      }
      result.set(source, output);
    }
  } finally {if (browser) await browser.close({silent: true});}
  return result;
}
