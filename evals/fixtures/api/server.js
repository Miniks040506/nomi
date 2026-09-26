import http from 'node:http';

const users = [];

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); }
    });
  });
}

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/users') return send(res, 200, users);

  if (req.method === 'POST' && req.url === '/users') {
    const data = await readJson(req);
    const user = { id: users.length + 1, name: data.name, email: data.email };
    users.push(user);
    return send(res, 201, user);
  }

  send(res, 404, { error: 'not found' });
});

if (process.argv[1] && process.argv[1].endsWith('server.js')) server.listen(3000);
