// Review: the measured part of a verdict, from the latest runs and the plan, and the proof card built from the same data.
// The script decides what blocks SHIP; ranking, the fix and RETHINK stay with the model.
import fs from 'node:fs';
import path from 'node:path';
import { stateDir } from './runs.mjs';
import { checkPlan } from './plan.mjs';
import { launchBrowser } from './browser.mjs';
import { compose } from './compose.mjs';

const SOURCE = /\.(?:html?|css|m?js|jsx|tsx?|vue|svelte|astro)$/i;
// The newest interface file in the project: a run older than it measured another version of the work.
// ponytail: bounded walk (4000 entries, 6 levels, build folders skipped); a monorepo needs the run's own target instead.
function newestSource(root) {
  let newest = { time: 0, file: '' }, seen = 0;
  const walk = (dir, depth) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'coverage'].includes(entry.name) || ++seen > 4000) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (depth < 6) walk(full, depth + 1); continue; }
      const time = SOURCE.test(entry.name) ? fs.statSync(full).mtimeMs : 0;
      if (time > newest.time) newest = { time, file: full };
    }
  };
  walk(root, 0);
  return newest;
}

export function review(cwd = process.cwd()) {
  const state = stateDir(cwd), root = path.dirname(state), runsDir = path.join(state, 'runs');
  const reports = (fs.existsSync(runsDir) ? fs.readdirSync(runsDir).sort() : []).flatMap(id => {
    try { const r = JSON.parse(fs.readFileSync(path.join(runsDir, id, 'report.json'), 'utf8')); return r.nomi === 1 && r.id === id ? [r] : []; } catch { return []; }
  });
  const latest = kind => reports.findLast(r => r.kind === kind);
  const runs = { web: latest('web'), motion: latest('motion'), flow: latest('flow') };
  const before = runs.web && reports.find(r => r.kind === 'web' && r.target === runs.web.target && r.id !== runs.web.id);
  const blockers = [], judge = [], notVerified = [], rel = p => path.relative(root, p).split(path.sep).join('/');
  const block = (text, evidence) => blockers.push({ text, evidence });

  if (!runs.web && !runs.motion && !runs.flow) block('nothing was captured in this project: there is no evidence to review', 'run observe first');
  else if (!runs.web) block('the interface was never captured: nothing shows how it renders', 'observe <url-or-index.html>, then open the images');
  const newest = newestSource(root);
  for (const [kind, run] of Object.entries(runs)) if (run && newest.time > Date.parse(run.created)) block(`the ${kind} run is older than ${rel(newest.file)}: it measured an earlier version`, `capture again (run ${run.id})`);

  const planFile = path.join(state, 'plan.md'), plan = fs.existsSync(planFile) ? checkPlan(fs.readFileSync(planFile, 'utf8')) : null;
  if (plan?.findings.length) block(`the plan has ${plan.findings.length} finding(s)`, 'plan check');
  if (plan?.flows.length && !runs.flow) block(`the plan has ${plan.flows.length} flow(s) and none was run`, 'observe <target> --flow .nomi/plan.md');
  // A page a person can act on (it has fields or buttons) is not reviewed until one of its jobs was run.
  const controls = runs.web?.viewports[0]?.census?.controls || 0;
  if (!plan && !runs.flow && controls) block(`the page has ${controls} form control(s) and none of its jobs was run`, 'write .nomi/flows.json, then review <target>');
  if (plan && runs.flow) for (const flow of plan.flows) if (!runs.flow.flows.some(f => f.name === flow.name)) block(`planned flow "${flow.name}" is not in the latest flow run`, `run ${runs.flow.id}`);
  for (const flow of runs.flow?.flows || []) {
    if (flow.status === 'failed') block(`flow "${flow.name}" stops at step ${flow.failedStep} of ${flow.steps} (${flow.timeline.at(-1)?.label || 'opening the page'}): ${flow.reason}`, flow.sheet ? rel(flow.sheet) : `run ${runs.flow.id}`);
    for (const dead of flow.deadClicks) block(`flow "${flow.name}" step ${dead.step} (${dead.label}) changed nothing`, flow.sheet ? rel(flow.sheet) : `run ${runs.flow.id}`);
  }
  for (const run of [runs.web, runs.motion, runs.flow].filter(Boolean)) {
    const seen = new Set();
    for (const f of run.findings) {
      const key = `${f.code}|${f.node}`;
      if (f.code.startsWith('flow.failed') || f.code === 'flow.dead-click' || seen.has(key)) continue;
      seen.add(key);
      const line = `${f.code} ${f.node || ''}: ${f.message}`.replace(/\s+/g, ' ');
      if (f.severity === 'S1') block(line, `run ${run.id}${f.viewport ? `, ${f.viewport}` : ''}`); else judge.push(`${line} (run ${run.id})`);
    }
  }
  if (!runs.web) notVerified.push('how the interface renders: no capture');
  if (!runs.flow && !controls) notVerified.push('whether its jobs complete: no flow was run');
  if (!runs.motion) notVerified.push('motion, hover and press states: no --motion run');
  if (runs.web?.viewports.some(v => v.census?.contrast?.some(c => c.status === 'unknown'))) notVerified.push('contrast over images or gradients (reported as unknown)');
  if (runs.flow) notVerified.push('anything outside the flows that ran, and effects a flow cannot see (canvas, sound, clipboard)');
  return { root, state, runs, before, plan, blockers, judge, notVerified, verdict: blockers.length ? 'FIX' : 'SHIP' };
}

const age = run => { const min = Math.round((Date.now() - Date.parse(run.created)) / 60000); return min < 1 ? 'just now' : `${min} min ago`; };
export function reviewText(r) {
  const flows = r.runs.flow?.flows || [], lines = ['Review'];
  lines.push(`Evidence: ${Object.entries(r.runs).map(([kind, run]) => run ? `${kind} ${run.id} (${age(run)})` : `${kind} none`).join(' · ')}`);
  if (flows.length) lines.push(`Flows: ${flows.filter(f => f.status === 'completed').length} of ${flows.length} completed${r.plan ? ` (${r.plan.flows.length} planned)` : ''}`);
  if (r.blockers.length) lines.push('Blocking:', ...r.blockers.slice(0, 12).map((b, i) => `  ${i + 1}. ${b.text} — evidence: ${b.evidence}`));
  if (r.blockers.length > 12) lines.push(`  ${r.blockers.length - 12} more in .nomi/proof.md`);
  if (r.judge.length) lines.push(`For you to judge (${r.judge.length}):`, ...r.judge.slice(0, 5).map(j => `  - ${j}`));
  lines.push('Not verified:', ...r.notVerified.map(n => `  - ${n}`));
  const open = [r.runs.web?.images[0], ...(r.runs.flow?.images || []).slice(0, 3), r.runs.motion?.images[0]].filter(Boolean);
  if (open.length) lines.push('Open images:', ...open.map(p => `  ${p}`));
  lines.push(r.verdict === 'FIX' ? `Measured verdict: FIX (${r.blockers.length} blocking). Do not report SHIP: fix, capture again, run review again.` : 'Measured verdict: nothing measured blocks SHIP. SHIP, FIX or RETHINK is now your judgment of the opened images.');
  return lines;
}

// The proof card: what was measured, in the state it was measured, for the final report and the README.
export async function writeProof(r) {
  const { runs, before } = r, flows = runs.flow?.flows || [], count = (run, s) => run.findings.filter(f => f.severity === s).length;
  const md = [`# Proof — ${path.basename(r.root)}`, '', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · measured verdict: **${r.verdict === 'FIX' ? `FIX (${r.blockers.length} blocking)` : 'nothing measured blocks SHIP'}**`, ''];
  if (flows.length) md.push(`## Flows (run ${runs.flow.id}, ${runs.flow.viewport})`, '', '| Flow | Result | Steps | Time | Dead clicks | Console errors |', '|---|---|---|---|---|---|',
    ...flows.map(f => `| ${f.name} | ${f.status === 'completed' ? 'completed' : `**failed at step ${f.failedStep}**: ${f.reason}`} | ${f.steps} | ${(f.ms / 1000).toFixed(1)} s | ${f.deadClicks.length} | ${f.consoleErrors.length} |`), '');
  if (runs.web) md.push(`## Interface (run ${runs.web.id})`, '', ...runs.web.viewports.map(v => `- ${v.width}x${v.height}: ${v.findings.filter(f => f.severity === 'S1').length} S1, ${v.findings.filter(f => f.severity === 'S2').length} S2 findings`),
    ...(before ? [`- Before (run ${before.id}): ${count(before, 'S1')} S1, ${count(before, 'S2')} S2 findings; now ${count(runs.web, 'S1')} S1, ${count(runs.web, 'S2')} S2`] : []), '');
  if (runs.motion) md.push(`## Motion (run ${runs.motion.id})`, '', `- ${runs.motion.motion.load.animations} load animations${runs.motion.motion.load.settleMs === null ? '' : `, settles after ${runs.motion.motion.load.settleMs} ms`}; ${count(runs.motion, 'S1')} S1, ${count(runs.motion, 'S2')} S2 findings`, '');
  if (r.blockers.length) md.push('## Blocking', '', ...r.blockers.map(b => `- ${b.text} — ${b.evidence}`), '');
  md.push('## Not verified', '', ...r.notVerified.map(n => `- ${n}`), '');
  const parts = [[before?.images[0], 'Before'], [runs.web?.images[0], 'Interface'], [runs.flow?.images[0], 'Flows'], [runs.motion?.images[0], 'Motion']].filter(([file]) => file && fs.existsSync(file));
  const image = path.join(r.state, 'proof.png');
  let browser;
  fs.rmSync(image, { force: true });
  if (parts.length) try {
    browser = await launchBrowser();
    fs.writeFileSync(image, Buffer.from(await compose(browser.page, parts.map(p => p[0]), parts.map(p => p[1]), { columns: 2, cell: 720, max: 4 }), 'base64'));
    md.push(`![${parts.map(p => p[1]).join(', ')}](proof.png)`, '');
  } catch (error) { md.push(`No image: ${error.message.split('.')[0]}.`, ''); } finally { await browser?.close(); }
  fs.writeFileSync(path.join(r.state, 'proof.md'), md.join('\n'));
  return { card: path.join(r.state, 'proof.md'), image: parts.length && fs.existsSync(image) ? image : null };
}
