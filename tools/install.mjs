// Copies the Nomi skill folders, always as a set, into the folders hosts read (adapters/hosts.json).
// Usage: node tools/install.mjs [--scope project|user] [--hosts all|claude,codex,...] [--dir <project>] [--dry-run] [--uninstall]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const loadHosts = (root = ROOT) => JSON.parse(fs.readFileSync(path.join(root, 'adapters', 'hosts.json'), 'utf8')).hosts;

// A host CLI as spawn arguments, or null when it is not on PATH. npm installs .cmd shims on Windows,
// which spawn cannot run without a shell, so the shim's script is run with Node instead.
export function resolveBin(bin, env = process.env) {
  for (const dir of (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean)) {
    if (process.platform !== 'win32') { if (fs.existsSync(path.join(dir, bin))) return [path.join(dir, bin)]; continue; }
    if (fs.existsSync(path.join(dir, `${bin}.exe`))) return [path.join(dir, `${bin}.exe`)];
    const shim = path.join(dir, `${bin}.cmd`);
    const script = fs.existsSync(shim) && /%dp0%\\([^"\r\n]+?\.[cm]?js)"/.exec(fs.readFileSync(shim, 'utf8'));
    if (script) return [process.execPath, path.join(dir, script[1])];
  }
  return null;
}

// Hosts share folders (.agents/skills serves seven of them), so targets are the distinct folders of the chosen hosts.
export function targets(hosts, ids, scope, base) {
  const chosen = ids === 'all' ? hosts : hosts.filter((h) => ids.includes(h.id));
  const unknown = ids === 'all' ? [] : ids.filter((id) => !hosts.some((h) => h.id === id));
  if (unknown.length) throw new Error(`unknown host "${unknown[0]}"; use: ${hosts.map((h) => h.id).join(', ')}`);
  return [...new Set(chosen.map((h) => path.join(base, scope === 'user' ? h.user : h.project)))];
}

export function install({ scope = 'project', hosts = 'all', dir = process.cwd(), home = os.homedir(), dryRun = false, uninstall = false, root = ROOT } = {}) {
  if (!['project', 'user'].includes(scope)) throw new Error('--scope must be project or user');
  const skills = fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const actions = [];
  for (const target of targets(loadHosts(root), hosts, scope, scope === 'user' ? home : path.resolve(dir))) {
    for (const name of skills) {
      const dest = path.join(target, name);
      const skillFile = path.join(dest, 'SKILL.md');
      // Replace only what is ours: a folder of the same name that is not this Nomi skill stays untouched.
      if (fs.existsSync(dest) && !(fs.existsSync(skillFile) && new RegExp(`^name: ${name}\\r?$`, 'm').test(fs.readFileSync(skillFile, 'utf8')))) {
        throw new Error(`${dest} exists and is not the Nomi skill "${name}"; move it away first`);
      }
      if (uninstall && !fs.existsSync(dest)) continue;
      actions.push({ action: uninstall ? 'remove' : fs.existsSync(dest) ? 'replace' : 'copy', dest });
      if (dryRun) continue;
      fs.rmSync(dest, { recursive: true, force: true, maxRetries: 5 });
      if (!uninstall) fs.cpSync(path.join(root, 'skills', name), dest, { recursive: true });
    }
  }
  return actions;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values: o } = parseArgs({ options: { scope: { type: 'string', default: 'project' }, hosts: { type: 'string', default: 'all' }, dir: { type: 'string', default: process.cwd() }, 'dry-run': { type: 'boolean' }, uninstall: { type: 'boolean' } } });
    const actions = install({ scope: o.scope, hosts: o.hosts === 'all' ? 'all' : o.hosts.split(','), dir: o.dir, dryRun: o['dry-run'], uninstall: o.uninstall });
    for (const a of actions) console.log(`${o['dry-run'] ? 'would ' : ''}${a.action}  ${a.dest}`);
    console.log(actions.length ? `install: ${actions.length} folder(s)${o['dry-run'] ? ' (dry run)' : ''}` : 'install: nothing to do');
  } catch (error) {
    console.error(`install: ${error.message}`);
    process.exitCode = 2;
  }
}
