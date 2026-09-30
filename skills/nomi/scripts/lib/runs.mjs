import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function stateDir(cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.nomi'))) return path.join(dir, '.nomi');
    if (path.dirname(dir) === dir) return path.join(path.resolve(cwd), '.nomi');
  }
}
const ID = /^\d{13}-[a-f0-9-]{36}$/;
export function createRun(cwd = process.cwd()) {
  const state = stateDir(cwd);
  const root = path.join(state, 'runs');
  fs.mkdirSync(root, { recursive: true });
  const ignore = path.join(state, '.gitignore');
  const previous = fs.existsSync(ignore) ? fs.readFileSync(ignore, 'utf8') : '';
  if (!previous.split(/\r?\n/).includes('runs/')) fs.writeFileSync(ignore, `${previous}${previous && !previous.endsWith('\n') ? '\n' : ''}runs/\n`);
  const id = `${Date.now()}-${randomUUID()}`;
  const dir = path.join(root, id); fs.mkdirSync(dir);
  return { id, dir, root };
}
export function summary(report) {
  const lines = [`Run ${report.id} · ${report.kind}`, report.target || '', ...report.viewports.map(v => `${v.width}x${v.height}: ${v.census?.type.families.length ?? '?'} declared families, ${v.census?.type.sizes.length ?? '?'} sizes; ${v.findings?.length ?? 0} findings`), ...report.findings.slice(0, 35).map(f => `${f.severity} ${f.code} ${f.node || ''}: ${f.message}`)];
  if (report.findings.length > 35) lines.push(`${report.findings.length - 35} more findings in report.json`);
  lines.push(...report.notes.slice(0, 8).map(n => `Note: ${n}`), 'Open images:', ...report.images.slice(0, 4).map(p => `  ${p}`));
  return lines.filter(Boolean).slice(0, 60).join('\n') + '\n';
}
export function saveRun(run, report) {
  fs.writeFileSync(path.join(run.dir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(run.dir, 'summary.md'), summary(report));
  const owned = fs.readdirSync(run.root, { withFileTypes: true }).filter(e => {
    if(!e.isDirectory() || !ID.test(e.name))return false;
    try {const r=JSON.parse(fs.readFileSync(path.join(run.root,e.name,'report.json'),'utf8'));return r.nomi===1&&r.id===e.name&&['web','diff'].includes(r.kind)&&Array.isArray(r.viewports)&&Array.isArray(r.images)&&Array.isArray(r.findings)&&Array.isArray(r.notes);}catch{return false;}
  }).map(e => e.name).sort();
  for (const id of owned.slice(0, -10)) fs.rmSync(path.join(run.root, id), { recursive: true, force: true, maxRetries: 3 });
}
export function readRun(id, cwd = process.cwd()) {
  if (!ID.test(id || '')) throw new Error('invalid run id; use the id printed by observe');
  const dir = path.join(stateDir(cwd), 'runs', id);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
  if (report.nomi !== 1 || report.id !== id) throw new Error('unsupported or mismatched run report');
  return { dir, report };
}
