import fs from 'node:fs';
import { evaluate } from './cdp.mjs';

export async function compose(page, images, labels = []) {
  if (!images.length || images.length > 4) throw new Error('compose needs 1–4 images');
  const sources = images.map(file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`);
  // Use a separate blank target: never execute an observed page's canvas overrides.
  return evaluate(page, `(async () => {
    const sources = ${JSON.stringify(sources)}, labels = ${JSON.stringify(labels)};
    const images = await Promise.all(sources.map(src => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; })));
    const widths = images.map(i => Math.min(720, i.width));
    const heights = images.map((i,n) => Math.min(2000, Math.round(i.height * widths[n] / i.width)));
    const canvas = document.createElement('canvas'); canvas.width = widths.reduce((a,b) => a+b,0); canvas.height = Math.max(...heights) + 32;
    const c = canvas.getContext('2d'); c.fillStyle = '#eee'; c.fillRect(0,0,canvas.width,canvas.height); c.font = '16px sans-serif';
    let x = 0;
    images.forEach((i,n) => { c.fillStyle='#111'; c.fillText(labels[n] || String(n+1),x+8,22); c.drawImage(i,0,0,i.width,Math.min(i.height,2000*i.width/widths[n]),x,32,widths[n],heights[n]); x += widths[n]; });
    return canvas.toDataURL('image/png').split(',')[1];
  })()`);
}
