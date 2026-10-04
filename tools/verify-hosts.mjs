// Host smoke test (the `host-smoke` suite). For every host CLI on PATH: temp project -> install -> one headless
// prompt -> evidence of discovery, activation, a script run, capture, image viewing and subagents.
// Usage: node tools/verify-hosts.mjs [--hosts claude,codex] [--record] [--keep]
//   --record  write status, version, date and evidence into adapters/hosts.json (then update INTEGRATIONS.md)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ROOT, loadHosts, resolveBin, install } from './install.mjs';
import { invoke, findReports, loadAuth } from '../evals/harness/runner.mjs';
import { observe } from '../skills/nomi/scripts/lib/capture.mjs';

const RUN_ID = /\d{13}-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g;
const PROMPT = [
  'The Nomi web skill is installed for this project. Use it on index.html and edit no files.',
  '1. Run the skill\'s doctor command and its observe command on index.html, from this folder.',
  '2. Open the phone screenshot that observe printed.',
  '3. Open proof.png in this folder.',
  'Then answer in exactly four lines: "RUN: <run id>", "DOMAINS: <the domains line doctor printed>",',
  '"PROOF: <the number shown in proof.png>", "SUBAGENTS: yes|no" (can you start a subagent or separate agent here?).',
].join('\n');

// Evidence is read from the host's raw output and the files it left, so one grader serves every host.
export function gradeSmoke(text, host, root, proof) {
  const reports = findReports(root);
  const ran = [...new Set(text.match(RUN_ID) || [])].filter((id) => reports.has(id)).map((id) => reports.get(id));
  const said = (label) => new RegExp(`${label}:\\W*([\\w-]+)`, 'gi').exec(text.replace(/\\n/g, '\n'))?.[1] ?? null;
  return {
    activated: new RegExp(host.activation).test(text),
    doctor: /domains\s+web/.test(text),
    observed: ran.length > 0,
    // U1: runs belong in the project's .nomi/runs, not next to the skill.
    inProject: ran.length > 0 && ran.every((r) => r.dir.startsWith(path.join(root, 'project', '.nomi'))),
    image: new RegExp(`PROOF:\\W*${proof}\\b`).test(text.replace(/\\n/g, '\n')),
    subagents: said('SUBAGENTS'),
  };
}

async function proofImage(scratch, number) {
  fs.mkdirSync(path.join(scratch, '.nomi'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'proof.html'), `<!doctype html><title>proof</title><body style="margin:0;display:grid;place-items:center;height:100vh;font:700 120px system-ui">${number}`);
  const { report } = await observe('proof.html', { cwd: scratch, viewport: ['640x360'] });
  return report.viewports[0].image;
}

async function verify(host, temp, proof) {
  const command = resolveBin(host.bin);
  if (!command) return { host: host.id, present: false, blocker: `\`${host.bin}\` is not installed on this machine` };
  const version = spawnSync(command[0], [...command.slice(1), '--version'], { encoding: 'utf8', windowsHide: true, timeout: 30000 }).stdout?.trim().split(/\r?\n/)[0] || 'unknown';
  const root = path.join(temp, host.id), workspace = path.join(root, 'project');
  fs.cpSync(path.join(ROOT, 'evals', 'fixtures', 'web-bike-bench'), workspace, { recursive: true });
  fs.copyFileSync(proof.file, path.join(workspace, 'proof.png'));
  spawnSync('git', ['init', '-q'], { cwd: workspace, windowsHide: true }); // some hosts load project skills only inside a repository
  const installed = install({ scope: 'project', hosts: [host.id], dir: workspace }).map((a) => path.relative(workspace, a.dest).split(path.sep).join('/'));
  const env = { ...process.env };
  if (host.id === 'claude') { // same isolation as the eval runner: access token only, fresh config folder
    const config = path.join(root, 'config'); fs.mkdirSync(config);
    fs.writeFileSync(path.join(config, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true }));
    try { Object.assign(env, loadAuth(), { CLAUDE_CONFIG_DIR: config }); } catch (error) { return { host: host.id, present: true, version, installed, pass: false, blocker: `not run: ${error.message}` }; }
    delete env.CLAUDECODE;
  }
  const output = path.join(root, 'output'); fs.mkdirSync(output);
  const started = Date.now();
  const run = await invoke(command[0], [...command.slice(1), ...host.headless.map((a) => a.replace('{prompt}', PROMPT))], { cwd: workspace, env, output, timeout: 420000 });
  fs.rmSync(path.join(root, 'config'), { recursive: true, force: true, maxRetries: 3 });
  const grade = gradeSmoke(run.stdout + run.stderr, host, root, proof.number);
  const pass = grade.activated && grade.doctor;
  const blocker = pass ? null : run.timedOut ? 'headless run timed out' : `headless run did not show ${grade.activated ? 'a Nomi script run' : 'skill activation'} (exit ${run.code}): ${(run.stderr || run.stdout).trim().split(/\r?\n/).at(-1)?.slice(0, 200) || 'no output'}`;
  return { host: host.id, present: true, version, installed, seconds: Math.round((Date.now() - started) / 1000), exit: run.code, ...grade, pass, blocker, output };
}

async function main() {
  const { values: o } = parseArgs({ options: { hosts: { type: 'string' }, record: { type: 'boolean' }, keep: { type: 'boolean' } } });
  const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'adapters', 'hosts.json'), 'utf8'));
  const date = new Date().toISOString().slice(0, 10);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-hosts-'));
  const number = String(10000 + Math.floor(Math.random() * 89999));
  const proof = { number, file: await proofImage(path.join(temp, 'proof'), number) };
  const results = [];
  for (const host of loadHosts().filter((h) => !o.hosts || o.hosts.split(',').includes(h.id))) {
    const r = await verify(host, temp, proof);
    results.push(r);
    console.log(JSON.stringify(r));
    if (!o.record) continue;
    const entry = table.hosts.find((h) => h.id === host.id);
    if (r.pass) Object.assign(entry, { status: 'L', version: r.version, verified: date, blocker: null, evidence: `skill activated; doctor ran (domains web); observe ${r.observed ? `captured${r.inProject ? ' in the project' : ' outside the project'}` : 'did not capture'}; image ${r.image ? 'read' : 'not read'}; subagents ${r.subagents || 'unknown'}` });
    else Object.assign(entry, { blocker: r.blocker });
  }
  const yes = (v) => (v === true ? 'yes' : v === false ? 'no' : v ?? '—');
  const lines = [
    `# Host verification ${date}`, '',
    'Written by `tools/verify-hosts.mjs`: temp project, project-scope install, one headless prompt per host CLI on PATH.',
    `Machine: ${os.platform()} ${os.release()}, Node ${process.versions.node}.`, '',
    '| Host | Version | Installed to | Activated | doctor ran | Captured | Run in project | Read image | Subagents | Seconds | Result |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...results.map((r) => r.present
      ? `| ${r.host} | ${r.version} | ${r.installed.map((d) => `\`${d}\``).join(' ')} | ${yes(r.activated)} | ${yes(r.doctor)} | ${yes(r.observed)} | ${yes(r.inProject)} | ${yes(r.image)} | ${yes(r.subagents)} | ${r.seconds ?? "—"} | ${r.pass ? 'pass' : `fail: ${r.blocker}`} |`
      : `| ${r.host} | — | — | — | — | — | — | — | — | — | not run: ${r.blocker} |`),
    '',
  ];
  const file = path.join(ROOT, 'evals', 'reports', `hosts-${date}.md`);
  fs.writeFileSync(file, lines.join('\n'));
  if (o.record) { table.updated = date; fs.writeFileSync(path.join(ROOT, 'adapters', 'hosts.json'), `${JSON.stringify(table, null, 2)}\n`); }
  console.log(`wrote ${path.relative(ROOT, file)}${o.keep ? `; transcripts in ${temp}` : ''}`);
  if (!o.keep) fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`verify-hosts: ${error.message}`); process.exitCode = 2; });
