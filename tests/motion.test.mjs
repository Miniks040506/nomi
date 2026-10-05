import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBrowser } from '../skills/nomi/scripts/lib/browser.mjs';
import { observe, diffRuns } from '../skills/nomi/scripts/lib/capture.mjs';
import { parseScript, motionFindings } from '../skills/nomi/scripts/lib/motion.mjs';
import { summary } from '../skills/nomi/scripts/lib/runs.mjs';

const fixture = fileURLToPath(new URL('../evals/fixtures/motion-census', import.meta.url));
const cli = fileURLToPath(new URL('../skills/nomi/scripts/nomi.mjs', import.meta.url));
let executable;
try { executable = findBrowser(); } catch { /* explicit skip below */ }
const skip = !executable && 'No Chromium installed; set NOMI_BROWSER';
function workspace(t, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi motion ü '));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}
const animation = (over = {}) => ({ kind: 'animation', name: 'fade', node: '#a', properties: ['opacity'], duration: 300, delay: 0, iterations: 1, easing: 'ease', timeline: 'document', start: 10, end: 310, step: 0, ...over });
const motion = (over = {}) => ({ viewport: '1440x900', load: { firstStartMs: 10, endsAtMs: 310, settleMs: 300 }, animations: [], transitions: [], interactions: [], reduced: { rules: 0, animations: [] }, longFrames: [], ...over });
const codes = m => motionFindings(m).map(f => f.code);

test('interaction scripts are validated before a browser starts', () => {
  assert.deepEqual(parseScript('[{"do":"hover","target":"#a"},{"do":"scroll","y":400},{"do":"wait","ms":500}]').map(s => s.label), ['hover #a', 'scroll 400', 'wait 500 ms']);
  assert.equal(parseScript('﻿[{"do":"hover","target":"#a"}]').length, 1, 'a byte-order mark is not a syntax error');
  assert.throws(() => parseScript('{'), /not valid JSON/);
  assert.throws(() => parseScript('[]'), /1–6 steps/);
  assert.throws(() => parseScript(JSON.stringify(Array(7).fill({ do: 'hover', target: 'a' }))), /1–6 steps/);
  assert.throws(() => parseScript('[{"do":"drag","target":"a"}]'), /step 1: "do" must be one of hover/);
  assert.throws(() => parseScript('[{"do":"click"}]'), /needs a "target"/);
  assert.throws(() => parseScript('[{"do":"wait","ms":60000}]'), /100 to 3000/);
  assert.throws(() => parseScript('[{"do":"scroll"}]'), /"target" or "y"/);
});

test('motion findings: measured defects are flagged, fingerprints only ask, deliberate systems pass', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => animation({ name: 'fadeUp', node: `#c${i}`, properties: ['opacity', 'transform'] }));
  const generic = motionFindings(motion({ animations: twelve, transitions: [{ node: '#b', properties: ['all'], durations: [300], delays: [0], easings: ['ease'] }], reduced: { rules: 0, animations: twelve } }));
  assert.deepEqual(generic.map(f => f.code).sort(), ['motion.fingerprint.same-entrance', 'motion.fingerprint.uniform-timing', 'motion.reduced-motion', 'motion.transition-all']);
  assert.ok(generic.filter(f => f.code.includes('fingerprint')).every(f => f.severity === 'S2' && f.message.endsWith('?')), 'a fingerprint is a question');
  assert.equal(generic.find(f => f.code === 'motion.reduced-motion').severity, 'S1');
  assert.equal(generic.find(f => f.code === 'motion.reduced-motion').count, 12);

  // A staggered entrance on a two-step scale that becomes a fade under reduced motion: nothing to ask.
  const staggered = Array.from({ length: 12 }, (_, i) => animation({ name: 'rise', node: `#c${i}`, properties: ['opacity', 'transform'], delay: i * 60, duration: i ? 240 : 480, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }));
  assert.deepEqual(codes(motion({ animations: staggered, reduced: { rules: 1, animations: staggered.map(a => ({ ...a, properties: ['opacity'], duration: 120 })) } })), []);

  assert.deepEqual(codes(motion({ animations: [animation({ name: 'grow', properties: ['width'] })] })), ['motion.layout-property']);
  assert.deepEqual(codes(motion({ transitions: [{ node: '#panel', properties: ['max-height', 'opacity'], durations: [300, 300], delays: [0, 0], easings: ['ease-out'] }] })), ['motion.layout-property'], 'a declared layout transition is flagged without running it');
  assert.deepEqual(codes(motion({ animations: [animation({ name: 'spin', properties: ['transform'], iterations: 'infinite', end: null })] })), ['motion.fingerprint.infinite']);
  assert.deepEqual(codes(motion({ animations: [animation()], longFrames: [{ start: 100, duration: 180 }, { start: 5000, duration: 90 }] })), ['motion.long-frame'], 'only frames that overlap the load motion count');
  assert.deepEqual(codes(motion({ reduced: { rules: 1, animations: [animation({ name: 'pulse', iterations: 'infinite' })] } })), [], 'an opacity pulse under reduced motion is not travel');
  assert.deepEqual(codes(motion({ reduced: { rules: 1, animations: [animation({ name: 'spin', properties: ['transform'], iterations: 'infinite' })] } })), ['motion.reduced-motion']);
});

test('a summary with many findings keeps its image list and stays within 60 lines', () => {
  const report = { id: 'x', kind: 'motion', target: 'page', viewports: [], overview: Array(30).fill('  group'), findings: Array(50).fill({ severity: 'S2', code: 'motion.layout-property', message: 'm' }), notes: Array(8).fill('n'), images: ['load.png', 'interactions.png'] };
  const lines = summary(report).trim().split('\n');
  assert.ok(lines.length <= 60);
  assert.equal(lines.at(-1).trim(), 'interactions.png');
  assert.ok(lines.some(l => /more findings in report\.json/.test(l)));
});

test('motion capture: exact inventory, 8 load frames, settle time, reduced-motion comparison, interaction rows, diff', { skip }, async t => {
  const cwd = workspace(t, { 'steps.json': '[{"do":"hover","target":"#cta"},{"do":"press","target":"#cta"},{"do":"hover","target":"#link"}]' });
  const started = Date.now();
  const run = await observe(fixture, { cwd, motion: true, interact: 'steps.json' });
  assert.ok(Date.now() - started < 30000, 'a motion capture must finish within 30 seconds');
  const { report } = run, m = report.motion;
  assert.equal(report.kind, 'motion');

  // Inventory against the fixture's stylesheet: targets, properties, durations, delays, easings.
  const load = m.animations.filter(a => a.step === 0).map(a => [a.node, a.kind, a.name, a.properties.join(','), a.duration, a.delay, a.easing, a.iterations]).sort();
  assert.deepEqual(load, [
    ['#bar', 'animation', 'grow', 'width', 400, 300, 'ease-in', 1],
    ['#c1', 'animation', 'rise', 'opacity,transform', 600, 0, 'cubic-bezier(0.2, 0.8, 0.2, 1)', 1],
    ['#c2', 'animation', 'rise', 'opacity,transform', 600, 100, 'cubic-bezier(0.2, 0.8, 0.2, 1)', 1],
    ['#c3', 'animation', 'rise', 'opacity,transform', 600, 200, 'cubic-bezier(0.2, 0.8, 0.2, 1)', 1],
    ['#late', 'transition', 'opacity', 'opacity', 300, 0, 'ease-out', 1],
    ['#spin', 'animation', 'spin', 'transform', 1000, 0, 'linear', 'infinite'],
  ]);
  assert.deepEqual(m.transitions.map(x => [x.node, x.properties.join(','), x.durations.join(','), x.easings.join(',')]).sort(), [['#cta', 'all', '300', 'ease'], ['#late', 'opacity', '300', 'ease-out'], ['#link', 'color', '150', 'linear']]);

  // Ground truth: the cards end 800 ms after the first start; #late is added by a 700 ms timer and runs 300 ms.
  assert.ok(Math.abs(m.load.settleMs - 1000) <= 100, `settle ${m.load.settleMs} ms`);
  assert.equal(m.load.infinite, 1);
  assert.equal(m.load.frames.length, 8);
  assert.ok(m.load.frames.every(f => fs.statSync(f.image).size > 0));
  assert.equal(m.load.frames[0].ms, 0);
  assert.equal(m.load.frames[7].ms, m.load.settleMs, 'frames span the whole load sequence');

  // Steps: the hover runs transform and background-color; the pointer is parked, so the link step holds only its own colour change.
  assert.deepEqual(m.interactions.map(s => [s.label, s.settleMs]), [['hover #cta', 300], ['press #cta', 300], ['hover #link', 150]]);
  assert.deepEqual(m.animations.filter(a => a.step === 1).map(a => a.name).sort(), ['background-color', 'transform']);
  assert.deepEqual(m.animations.filter(a => a.step === 3).map(a => [a.node, a.name]), [['#link', 'color']]);

  // Reduced motion: the cards, the bar and the button still travel; the spinner and the link comply.
  const reduced = report.findings.filter(f => f.code === 'motion.reduced-motion');
  assert.deepEqual(reduced.map(f => f.node).sort(), ['#bar', '#c1', '#cta']);
  assert.ok(reduced.every(f => f.severity === 'S1'));
  assert.equal(m.reduced.rules, 1);
  assert.ok(!m.reduced.animations.some(a => a.node === '#spin' || a.node === '#link'));
  assert.deepEqual([...new Set(report.findings.map(f => f.code))].sort(), ['motion.fingerprint.infinite', 'motion.layout-property', 'motion.reduced-motion', 'motion.transition-all']);

  assert.deepEqual(report.images.map(p => path.basename(p)), ['load.png', 'interactions.png']);
  assert.ok(report.images.every(p => fs.statSync(p).size > 1000));
  const text = fs.readFileSync(path.join(run.dir, 'summary.md'), 'utf8');
  assert.ok(text.trim().split('\n').length <= 60);
  assert.match(text, /rise ×3 · animation · opacity, transform · 600 ms · cubic-bezier\(0\.2, 0\.8, 0\.2, 1\) · delay 0–200 ms/);
  assert.match(text, /interactions\.png/);

  // The printed probe returns the same keys as the engine's inventory.
  const { launchBrowser } = await import('../skills/nomi/scripts/lib/browser.mjs');
  const { evaluate } = await import('../skills/nomi/scripts/lib/cdp.mjs');
  const browser = await launchBrowser({ executable }); t.after(() => browser.close());
  await browser.page.send('Page.enable');
  await browser.page.send('Page.navigate', { url: `data:text/html,${encodeURIComponent('<style>@keyframes a{to{opacity:0}}p{animation:a 5s}</style><p>x</p>')}` });
  await evaluate(browser.page, 'new Promise(r => document.readyState === "complete" ? r() : addEventListener("load", r, { once: true }))');
  const printed = await evaluate(browser.page, spawnSync(process.execPath, [cli, 'probe', 'print', 'motion'], { encoding: 'utf8' }).stdout);
  assert.deepEqual(Object.keys(printed).sort(), ['animations', 'longFrames', 'notes', 'reducedMotion', 'transitions']);
  assert.deepEqual(Object.keys(printed.animations[0]).sort(), Object.keys(m.animations[0]).sort());
  assert.equal(printed.animations[0].duration, 5000);

  // A second run and a diff of the two.
  const fixed = workspace(t, { 'index.html': fs.readFileSync(path.join(fixture, 'index.html'), 'utf8').replace('grow 400ms', 'grow 0ms').replace('transition:all 300ms ease', 'transition:background-color 300ms ease') });
  const second = await observe(fixed, { cwd, motion: true });
  const diff = await diffRuns(run.id, second.id, { cwd });
  const delta = Object.fromEntries(diff.report.deltas.map(d => [d.metric, d.delta]));
  assert.equal(delta['motion.transition-all'], -1);
  assert.ok('motion.settle-ms' in delta && 'motion.animations' in delta);
  assert.ok(fs.existsSync(diff.report.images[0]));
  await assert.rejects(diffRuns(run.id, (await observe(fixture, { cwd, viewport: ['800x600'] })).id, { cwd }), /same kind/);
});

test('motion capture is bounded on pages that never rest, finds long frames, and reports a still page honestly', { skip }, async t => {
  const busy = workspace(t, { 'index.html': '<style>@keyframes pulse{50%{opacity:.3}}@keyframes in{from{transform:translateX(-80px)}}#dot{width:20px;height:20px;background:#000;animation:pulse 800ms ease-in-out infinite}#box{width:80px;height:80px;background:#c00;animation:in 900ms ease-out}</style><div id="dot"></div><div id="box"></div><script>addEventListener("load",()=>setTimeout(()=>{const end=performance.now()+220;while(performance.now()<end);},200));setInterval(()=>fetch("data:,x").catch(()=>{}),100)</script>' });
  const started = Date.now();
  const run = await observe(busy, { cwd: busy, motion: true });
  assert.ok(Date.now() - started < 30000);
  const codes = run.report.findings.map(f => f.code);
  assert.ok(codes.includes('motion.long-frame'), JSON.stringify(run.report.motion.longFrames));
  assert.ok(codes.includes('motion.fingerprint.infinite'));
  assert.ok(Math.abs(run.report.motion.load.settleMs - 900) <= 100);

  const still = workspace(t, { 'index.html': '<p>Nothing moves here.</p>' });
  const quiet = await observe(still, { cwd: still, motion: true, viewport: ['390x844'] });
  assert.deepEqual(quiet.report.findings, []);
  assert.equal(quiet.report.motion.load.settleMs, null);
  assert.equal(quiet.report.motion.load.frames.length, 1);
  assert.ok(quiet.report.notes.includes('No load animation was recorded.'));
  assert.ok(!quiet.report.notes.some(n => n.startsWith('DNA Motion')), 'no DNA, no direction to compare with');

  // The project's declared motion direction is printed beside the measurements, so drift is visible in one read.
  fs.mkdirSync(path.join(still, '.nomi'), { recursive: true });
  fs.writeFileSync(path.join(still, '.nomi', 'dna.md'), '---\nnomi: 1\ndomains: [web, motion]\n---\n## Intent\nx\n## Motion\nRows enter 40ms apart, 240ms each.\nNothing loops.\n## Decisions\n');
  const directed = await observe(still, { cwd: still, motion: true });
  assert.ok(directed.report.notes.some(n => n.startsWith('DNA Motion: "Rows enter 40ms apart, 240ms each. Nothing loops."') && /drift to fix/.test(n)));
  assert.ok(fs.readFileSync(path.join(directed.dir, 'summary.md'), 'utf8').includes('DNA Motion:'));
});

test('motion CLI: flag errors exit 2 before any capture, findings exit 1', { skip }, async t => {
  const cwd = workspace(t, { 'index.html': '<style>a{transition:all 200ms}</style><a href="#">x</a>', 'bad.json': '[{"do":"hover","target":"#missing"}]' });
  const nomi = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NOMI_BROWSER: executable } });
  assert.match(nomi('observe', '.', '--interact', 'bad.json').stderr, /--interact needs --motion/);
  assert.match(nomi('observe', '.', '--motion', '--viewport', '800x600', '--viewport', '390x844').stderr, /one viewport/);
  const missing = nomi('observe', '.', '--motion', '--interact', 'bad.json');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /no element matches #missing/);
  assert.deepEqual(fs.readdirSync(path.join(cwd, '.nomi', 'runs')), [], 'a failed capture keeps no partial run');
  const found = nomi('observe', '.', '--motion', '--json');
  assert.equal(found.status, 1, found.stderr);
  assert.deepEqual(JSON.parse(found.stdout).findings.map(f => f.code), ['motion.transition-all']);
  assert.equal(nomi('probe', 'print', 'gone').status, 2);
});
