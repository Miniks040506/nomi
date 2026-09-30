import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
export async function serve(target) {
  const absolute = fs.realpathSync(target);
  const isFile = fs.statSync(absolute).isFile();
  const root = isFile ? path.dirname(absolute) : absolute;
  const server = http.createServer((req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const requested = decodeURIComponent(req.url.split('?')[0]);
      const parts = requested.replaceAll('\\', '/').split('/');
      if (parts.some(p => p === '..' || p.startsWith('.'))) { res.writeHead(403).end(); return; }
      let file = path.resolve(root, `.${requested}`);
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      file = fs.realpathSync(file);
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
      const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type + (type.startsWith('text/') ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store' });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch (error) { res.writeHead(error instanceof URIError ? 400 : 404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}/${isFile ? encodeURIComponent(path.basename(absolute)) : ''}`, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
