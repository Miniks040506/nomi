// README stage: what a README shows and tells must be checkable. `check` finds media that is not there, local links that
// lead nowhere, quick-start commands nobody ran, and claims with nothing behind them. `run` runs a command and keeps the
// result in .nomi/commands.json, which is how `check` knows a command was executed.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { stateDir } from './runs.mjs';

const DAY = 24 * 3600 * 1000;
const MEDIA = /\.(?:png|jpe?g|gif|webp|svg|avif|mp4|webm|mov)$/i;
const SHELL = /^(?:bash|sh|shell|zsh|console|terminal|powershell|pwsh|ps1|cmd|bat|text)?$/i;
const QUICK = /quick ?start|getting started|install|set ?up|usage|run(?:ning)?\b|try it|develop/i;
// Moving around and fetching the code say nothing about the product; they are not claims to verify.
const NEUTRAL = /^(?:cd|git clone|mkdir|#)\b/;
const ledgerFile = cwd => path.join(stateDir(cwd), 'commands.json');
const squash = command => command.replace(/\s+/g, ' ').trim();
export function readLedger(cwd = process.cwd()) {
  try { const list = JSON.parse(fs.readFileSync(ledgerFile(cwd), 'utf8')); return Array.isArray(list) ? list : []; } catch { return []; }
}
// GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens, repeats numbered.
export function anchors(text) {
  const seen = new Map();
  return [...text.replace(/^```[\s\S]*?^```/gm, '').matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map(m => {
    const base = m[1].replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_~]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
    const n = seen.get(base) || 0; seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  });
}

// The commands a README tells a reader to type: lines of shell blocks, and of unlabelled blocks under a quick-start heading.
export function commands(text) {
  const found = [];
  let heading = '', fence = null, pending = '', note = false;
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const open = /^\s*(```+|~~~+)\s*([\w-]*)/.exec(raw);
    if (!fence && /^#{1,6}\s/.test(raw)) heading = raw;
    if (open && !fence) { fence = { mark: open[1], lang: open[2], shell: open[2] ? SHELL.test(open[2]) && open[2] !== 'text' : QUICK.test(heading), prompt: false }; note = false; continue; }
    if (open && fence && raw.trim().startsWith(fence.mark)) { fence = null; pending = ''; continue; }
    if (!fence?.shell) continue;
    let line = raw.trim();
    // In a transcript, only the lines after a prompt are commands; the rest is output.
    if (/^(?:\$|>|PS [^>]*>)\s+/.test(line)) { fence.prompt = true; line = line.replace(/^(?:\$|>|PS [^>]*>)\s+/, ''); } else if (fence.prompt || fence.lang === 'console') continue;
    if (!line) { note = false; continue; }
    if (line.startsWith('#') || line.startsWith('//') || /^(?:rem|::)\s/i.test(line)) { note = /unverified|not verified/i.test(line); continue; }
    if (/[\\`^]$/.test(line)) { pending += `${line.slice(0, -1)} `; continue; }
    const whole = squash(pending + line), unverified = note || /(?:#|\/\/|&rem|::)\s*(?:unverified|not verified)\b/i.test(whole);
    pending = '';
    found.push({ line: i + 1, command: squash(whole.replace(/\s+#\s.*$/, '').replace(/\s+\/\/\s*(?:unverified|not verified)\b.*$/i, '')), unverified });
  }
  return found;
}

export function checkReadme(text, { root, cwd = root, ledger = readLedger(cwd), now = Date.now(), claims = JSON.parse(fs.readFileSync(new URL('../data/vague-words.json', import.meta.url), 'utf8')).claims } = {}) {
  const findings = [], add = (line, code, severity, message, value) => findings.push({ line, code, severity, message, value });
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/), ids = anchors(text);
  const local = ref => !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref);
  const exists = ref => { try { return fs.existsSync(path.resolve(root, decodeURIComponent(ref.split(/[?#]/)[0]))); } catch { return false; } };
  let fenced = false, media = 0, firstMedia = null;
  for (const [i, raw] of lines.entries()) {
    if (/^\s*(?:```|~~~)/.test(raw)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const n = i + 1, shown = new Set();
    for (const m of raw.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)|<(?:img|video|source)\b[^>]*?\b(?:src|srcset|poster)\s*=\s*["']([^"'\s]+)/gi)) {
      const ref = m[1] || m[2]; shown.add(ref); media++; firstMedia ??= n;
      if (local(ref) && !exists(ref)) add(n, 'readme.media', 'S1', `${ref} is shown and does not exist`, ref);
    }
    // Measured on the repository site (2026-10-08): its README renderer removes a <video> element; a linked image stays.
    if (/<video\b/i.test(raw)) add(n, 'readme.video-tag', 'S1', 'a <video> element is removed where the repository is shown: link an animated preview image to the video file instead, or use the link of a file uploaded there', '<video>');
    for (const m of raw.matchAll(/(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)|<a\b[^>]*?\bhref\s*=\s*["']([^"'\s]+)/gi)) {
      const ref = m[1] || m[2];
      if (shown.has(ref)) continue;
      if (ref.startsWith('#')) { if (!ids.includes(ref.slice(1).toLowerCase())) add(n, 'readme.link', 'S1', `${ref} matches no heading of this file`, ref); }
      else if (local(ref) && !exists(ref)) add(n, MEDIA.test(ref.split(/[?#]/)[0]) ? 'readme.media' : 'readme.link', 'S1', `${ref} is linked and does not exist`, ref);
    }
    for (const claim of claims) for (const m of raw.matchAll(new RegExp(claim.pattern, 'gi'))) add(n, 'readme.claim', 'S2', `"${m[0]}": ${claim.question}`, m[0]);
  }
  for (const c of commands(text)) {
    if (c.unverified || NEUTRAL.test(c.command)) continue;
    const ran = ledger.findLast(e => squash(e.command) === c.command);
    if (!ran) add(c.line, 'readme.command', 'S1', `\`${c.command}\` was not run. Run it: nomi readme run "${c.command.replace(/"/g, '\\"')}", or mark the line "# unverified: <why>"`, c.command);
    else if (!ran.ok) add(c.line, 'readme.command', 'S1', `\`${c.command}\` failed when it was run (exit ${ran.exit}). Fix the command or the product`, c.command);
    else if (now - Date.parse(ran.at) > DAY) add(c.line, 'readme.command', 'S1', `\`${c.command}\` was last run more than a day ago. Run it again`, c.command);
  }
  // The title is the first heading, in Markdown or as a centred <h1>. The opening is the first text under it that is
  // prose: pictures, badges and a row of links to sections are not.
  const title = lines.findIndex(l => /^#\s+\S|^\s*<h1[\s>]/i.test(l));
  const prose = p => p.replace(/<img\b[^>]*>|!\[[^\]]*\]\([^)]*\)/gi, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const opening = title < 0 ? '' : lines.slice(title + 1).join('\n').split(/\n\s*\n/).map(p => p.trim()).filter(p => !/^(?:#|\||```)/.test(p)).map(prose).find(p => p && !/ [·|•] .* [·|•] /.test(p)) || '';
  if (title < 0) add(1, 'readme.opening', 'S2', 'no title: the first heading names the product');
  else if (!opening || opening.length > 240) add(title + 1, 'readme.opening', 'S2', opening ? `the first paragraph is ${opening.length} characters: say what it is in one or two lines` : 'nothing says what this is under the title');
  // A product whose jobs are written as flows can be filmed: a README that shows no moving demo of it is asked why.
  const state = stateDir(cwd), filmable = [path.join(state, 'plan.md'), path.join(state, 'flows.json')].some(f => fs.existsSync(f) && (!f.endsWith('.md') || /^```json/m.test(fs.readFileSync(f, 'utf8'))));
  if (filmable && !/\.(?:webp|gif|mp4|webm)\b|user-attachments\/assets|<!--\s*no demo\b/i.test(text)) add(title + 1 || 1, 'readme.demo', 'S1', 'this product has flows and the README shows no demo of them. Record one: nomi brandvid <target>, then put its preview under the title. Only when the user said no video: write <!-- no demo: why --> under the title instead');
  else if (!media) add(title + 1 || 1, 'readme.demo', 'S2', 'nothing is shown: no image and no demo. Is there a capture or a demo video of the product to show?');
  else if (firstMedia - (title + 1) > 20) add(firstMedia, 'readme.demo', 'S2', `the first picture is ${firstMedia - title - 1} lines below the title: would a visitor see the product on the first screen?`);
  return findings;
}

// Runs one command the way a reader would, from the project folder, and records what happened. A command that is still
// running after `seconds` (a dev server) counts as started, and is stopped.
export async function runCommand(command, { cwd = process.cwd(), seconds = 20 } = {}) {
  const started = Date.now(), child = spawn(command, { cwd, shell: true, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', alive = false;
  child.stdout.on('data', d => { output = (output + d).slice(-4000); }); child.stderr.on('data', d => { output = (output + d).slice(-4000); });
  const stop = () => { if (process.platform === 'win32') spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 }); else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } } };
  const exit = await new Promise(resolve => {
    const timer = setTimeout(() => { alive = true; stop(); }, seconds * 1000);
    child.on('error', () => { clearTimeout(timer); resolve(127); });
    child.on('close', code => { clearTimeout(timer); resolve(code ?? 1); });
  });
  child.stdout.destroy(); child.stderr.destroy();
  const entry = { command: squash(command), ok: alive || exit === 0, exit: alive ? null : exit, alive, seconds: Math.round((Date.now() - started) / 100) / 10, at: new Date().toISOString() };
  const state = stateDir(cwd); fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(ledgerFile(cwd), `${JSON.stringify([...readLedger(cwd).filter(e => squash(e.command) !== entry.command), entry].slice(-50), null, 2)}\n`);
  return { ...entry, output: output.trim().split(/\r?\n/).slice(-12).join('\n') };
}
