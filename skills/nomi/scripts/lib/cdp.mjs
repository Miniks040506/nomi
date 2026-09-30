// Chromium's null-delimited pipe protocol, or Node's native WebSocket.
export class CDP {
  constructor(write, shutdown) { this.write = write; this.shutdown = shutdown; this.next = 0; this.pending = new Map(); this.listeners = new Set(); this.closed = false; }
  receive(text) {
    let message;
    try { message = JSON.parse(text); } catch { return this.close(new Error('invalid CDP response')); }
    if (message.id) {
      const job = this.pending.get(message.id);
      if (!job) return;
      clearTimeout(job.timer); this.pending.delete(message.id);
      if (message.error) job.reject(new Error(`${job.method}: ${message.error.message}`));
      else job.resolve(message.result);
    } else for (const listener of this.listeners) listener(message);
  }
  send(method, params = {}, sessionId, timeout = 5000) {
    if (this.closed) return Promise.reject(new Error('CDP transport closed'));
    return new Promise((resolve, reject) => {
      const id = ++this.next;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeout);
      this.pending.set(id, { resolve, reject, timer, method });
      try { this.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
      catch (error) { this.close(error); }
    });
  }
  close(error = new Error('CDP transport closed')) {
    if (this.closed) return;
    this.closed = true;
    for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(error); }
    this.pending.clear(); this.listeners.clear(); this.shutdown();
  }
  static pipe(input, output) {
    const client = new CDP(text => output.write(`${text}\0`), () => { input.destroy(); output.destroy(); });
    let buffer = '';
    input.setEncoding('utf8');
    input.on('data', chunk => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\0')) !== -1) { const frame = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (frame) client.receive(frame); }
      if (buffer.length > 64 * 1024 * 1024) client.close(new Error('CDP frame exceeds 64 MiB'));
    });
    input.on('end', () => client.close()); input.on('error', e => client.close(e)); output.on('error', e => client.close(e));
    return client;
  }
  static async websocket(url, timeout = 2500) {
    const socket = new WebSocket(url);
    const client = new CDP(text => socket.send(text), () => socket.close());
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('CDP WebSocket timeout')); }, timeout);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP WebSocket failed')); }, { once: true });
    });
    socket.addEventListener('message', e => client.receive(e.data));
    socket.addEventListener('close', () => client.close()); socket.addEventListener('error', () => client.close());
    return client;
  }
}

export async function evaluate(page, expression) {
  const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`page evaluation: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
  return result.result.value;
}
