import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { CDP } from './cdp.mjs';

// Absolute path: a host's reduced PATH must not silently leave a browser tree running.
const TASKKILL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
// A host that already confines this process (a restricted-token agent sandbox) cannot nest Chromium's own sandbox.
// Opt-in only, set by the user for local pages; the capture report notes it.
const NO_SANDBOX = process.env.NOMI_BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : [];
const FALLBACK ='Set NOMI_BROWSER to a Chromium executable, or run nomi probe print web with a host browser tool; otherwise report not visually verified.';
export function findBrowser(env = process.env) {
  if (env.NOMI_BROWSER) {
    if (fs.existsSync(env.NOMI_BROWSER) && fs.statSync(env.NOMI_BROWSER).isFile()) return path.resolve(env.NOMI_BROWSER);
    throw new Error(`NOMI_BROWSER is not a file. ${FALLBACK}`);
  }
  const candidates = process.platform === 'win32' ? [
    ...['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'].flatMap(key => env[key] ? ['Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe'].map(p => path.join(env[key], p)) : []),
  ] : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium'] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome'];
  const caches = [path.join(os.homedir(), '.cache', 'ms-playwright'), path.join(env.LOCALAPPDATA || os.tmpdir(), 'ms-playwright')];
  for (const cache of caches) if (fs.existsSync(cache)) for (const entry of fs.readdirSync(cache).sort().reverse()) {
    for (const inner of ['chrome-win/chrome.exe', 'chrome-win64/chrome.exe', 'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-headless-shell-win64/chrome-headless-shell.exe']) candidates.push(path.join(cache, entry, inner));
  }
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error(`No Chromium browser found. ${FALLBACK}`);
  return found;
}

export async function launchBrowser({ executable = findBrowser(), transport = 'auto' } = {}) {
  const started = Date.now();
  const attempts = transport === 'auto' ? (process.platform === 'win32' ? ['websocket'] : ['pipe', 'websocket']) : [transport];
  let last;
  for (const mode of attempts) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-browser-'));
    let child, cdp, stopped, stderr = '';
    const close = () => stopped ||= (async () => {
      process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
      // Windows taskkill /T must see the living root to include its children.
      // A launcher that hands over to another process and exits with 0 (seen with Edge 154) leaves nothing for taskkill to find: ask that browser to close itself.
      const relaunched = child?.exitCode === 0;
      const askToClose = () => cdp && !cdp.closed ? cdp.send('Browser.close', {}, undefined, 1500).catch(() => {}) : null;
      if (process.platform !== 'win32' || relaunched) await askToClose();
      if (child?.pid && child.exitCode === null) {
        // Inside a host sandbox taskkill is refused (Codex on Windows: "Access denied"): the browser lived on and held its profile. Then it is asked too.
        if (process.platform === 'win32') { if (spawnSync(TASKKILL, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 }).status !== 0) { await askToClose(); child.kill(); } }
        else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2000)]);
      }
      cdp?.close();
      // A browser that outlives its launcher keeps the inherited stderr pipe open; without this the command would wait on it forever.
      child?.stderr?.destroy(); child?.unref();
      // Windows releases a closed browser's file locks late (EBUSY). A leftover temp folder is reported, never allowed to fail or hold a
      // finished capture: rm's own retries nest per folder level, and with a browser that would not die they ran for minutes.
      let left;
      for (let tries = 0; tries < 30; tries++) { // about 9 s: a closed Edge has taken more than 3 s to let go
        left = await fs.promises.rm(profile, { recursive: true, force: true }).then(() => null, error => error);
        if (!left) break;
        await delay(300);
      }
      if (left) process.emitWarning(`temporary browser profile not removed: ${profile} (${left.code || left.message})`);
    })();
    const interrupt = () => { close().finally(() => process.exit(130)); };
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    try {
      const args = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', ...NO_SANDBOX, `--user-data-dir=${profile}`, mode === 'pipe' ? '--remote-debugging-pipe' : '--remote-debugging-port=0', 'about:blank'];
      child = spawn(executable, args, { windowsHide: true, detached: process.platform !== 'win32', stdio: mode === 'pipe' ? ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'] });
      let launchError;
      child.on('error', e => { launchError = e; });
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
      if (mode === 'pipe') cdp = CDP.pipe(child.stdio[4], child.stdio[3]);
      else {
        const portFile = path.join(profile, 'DevToolsActivePort');
        let port, endpoint;
        while (!port || !endpoint) {
          if (launchError) throw launchError;
          // Exit code 0 before the port file exists can be a hand-over to another process, not a failure: keep waiting for the port.
          if ((child.exitCode !== null && child.exitCode !== 0) || Date.now() - started > 5500) throw new Error('browser launch failed or timed out');
          try {
            const lines=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);
            if (/^\d+$/.test(lines[0]) && /^\/devtools\/browser\//.test(lines[1])) [port,endpoint]=lines;
          } catch(error) { if(!['ENOENT','EBUSY','EACCES','EPERM'].includes(error.code))throw error; }
          if(port && endpoint) break;
          await delay(40);
        }
        cdp = await CDP.websocket(`ws://127.0.0.1:${port}${endpoint}`);
      }
      const version = await cdp.send('Browser.getVersion', {}, undefined, 1800);
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      const page = { send: (method, params, timeout) => cdp.send(method, params, sessionId, timeout), cdp, sessionId };
      return { page, cdp, version, profile, pid: child.pid, transport: mode, close };
    } catch (error) {
      await close(); last = new Error(`${error.message}. ${stderr.trim().slice(-400)} ${FALLBACK}`);
      if (Date.now() - started > 6000) break;
    }
  }
  throw last;
}
