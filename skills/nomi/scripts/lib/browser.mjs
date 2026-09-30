import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { CDP } from './cdp.mjs';

// Absolute path: a host's reduced PATH must not silently leave a browser tree running.
const TASKKILL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
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
      if (process.platform !== 'win32' && cdp && !cdp.closed) await cdp.send('Browser.close', {}, undefined, 700).catch(() => {});
      cdp?.close();
      if (child?.pid && child.exitCode === null) {
        if (process.platform === 'win32') spawnSync(TASKKILL, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 });
        else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2000)]);
      }
      // Windows releases a killed tree's file locks late (EBUSY). A leftover temp folder is reported, never allowed to fail a finished capture.
      await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 })
        .catch(error => process.emitWarning(`temporary browser profile not removed: ${profile} (${error.code || error.message})`));
    })();
    const interrupt = () => { close().finally(() => process.exit(130)); };
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    try {
      const args = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', `--user-data-dir=${profile}`, mode === 'pipe' ? '--remote-debugging-pipe' : '--remote-debugging-port=0', 'about:blank'];
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
          if (child.exitCode !== null || Date.now() - started > 5500) throw new Error('browser launch failed or timed out');
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
