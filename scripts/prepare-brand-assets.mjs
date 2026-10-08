/* global Image, document */
import fs from 'node:fs';
import path from 'node:path';
import {Buffer} from 'node:buffer';
import {openBrowser} from '@remotion/renderer';
import {projectRoot} from './lib/style-catalog.mjs';

// Export committed web icons from their editable vectors; no browser is needed at site build time.
const root = path.join(projectRoot, 'library/brand');
const browser = await openBrowser('chrome');
try {
  const page = await browser.newPage({context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {}});
  const images = [];
  for (const size of [16, 32, 48, 180, 512]) {
    const svg = fs.readFileSync(path.join(root, size <= 32 ? 'favicon.svg' : 'logo.svg')).toString('base64');
    const encoded = await page.evaluate(async ({svg, size}) => {
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${svg}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    }, {svg, size});
    const data = Buffer.from(encoded, 'base64');
    if (size === 180) fs.writeFileSync(path.join(root, 'apple-touch-icon.png'), data);
    else if (size === 512) fs.writeFileSync(path.join(root, 'logo-512.png'), data);
    else images.push({size, data});
  }
  // ICO supports PNG payloads, one directory entry per browser fallback size.
  const directory = Buffer.alloc(6 + images.length * 16);
  directory.writeUInt16LE(1, 2); directory.writeUInt16LE(images.length, 4);
  let offset = directory.length;
  images.forEach(({size, data}, index) => {
    const entry = 6 + index * 16;
    directory[entry] = size; directory[entry + 1] = size;
    directory.writeUInt16LE(1, entry + 4); directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(data.length, entry + 8); directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  fs.writeFileSync(path.join(root, 'favicon.ico'), Buffer.concat([directory, ...images.map(image => image.data)]));
  console.log('BRAND ASSETS exported 16/32/48px favicon, 180px touch icon and 512px logo');
} finally {await browser.close({silent: true});}
