import fs from 'node:fs';
import { evaluate } from './cdp.mjs';

// One row by default; `columns` wraps into a grid. A null image leaves its cell empty.
export async function compose(page, images, labels = [], { columns = images.length, cell = 720, max = 4 } = {}) {
  if (!images.length || images.length > max) throw new Error(`compose needs 1–${max} images`);
  const sources = images.map(file => file && `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`);
  // Use a separate blank target: never execute an observed page's canvas overrides.
  return evaluate(page, `(async () => {
    const sources = ${JSON.stringify(sources)}, labels = ${JSON.stringify(labels)}, columns = ${columns}, cell = ${cell};
    const images = await Promise.all(sources.map(src => src && new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; })));
    const cells = images.map((i,n) => { const width = i ? Math.min(cell, i.width) : cell; return { i, width, height: i ? Math.min(2000, Math.round(i.height * width / i.width)) : 0, label: labels[n] || String(n+1) }; });
    const rows = []; for (let n = 0; n < cells.length; n += columns) rows.push(cells.slice(n, n + columns));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(...rows.map(r => r.reduce((a,c) => a+c.width,0))); canvas.height = rows.reduce((a,r) => a + Math.max(...r.map(c => c.height)) + 32, 0);
    const c = canvas.getContext('2d'); c.fillStyle = '#eee'; c.fillRect(0,0,canvas.width,canvas.height); c.font = '16px sans-serif';
    let y = 0;
    for (const row of rows) {
      let x = 0;
      for (const { i, width, height, label } of row) { if (i) { c.fillStyle='#111'; c.fillText(label,x+8,y+22); c.drawImage(i,0,0,i.width,Math.min(i.height,2000*i.width/width),x,y+32,width,height); } x += width; }
      y += Math.max(...row.map(c => c.height)) + 32;
    }
    return canvas.toDataURL('image/png').split(',')[1];
  })()`);
}
