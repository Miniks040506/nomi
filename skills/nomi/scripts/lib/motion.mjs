// Motion capture: every Web Animation from navigation on, measured and replayed from its own timing data
// (never from frame timestamps: headless frame pacing jitters).
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { evaluate } from './cdp.mjs';
import { compose } from './compose.mjs';
import { findDna, parseDna } from './dna.mjs';

// Runs before the page's own scripts. Finished animations leave document.getAnimations(), so each one is kept
// from the frame it first appears in, tagged with the step that was running (0 = load, n = interaction n).
export const RECORDER = `(() => {
  if (window.__nomiMotion || window.top !== window) return;
  const m = window.__nomiMotion = { seen: new Map(), frames: [], step: 0 };
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) m.frames.push({ start: Math.round(e.startTime), duration: Math.round(e.duration), blocking: Math.round(e.blockingDuration || 0) }); }).observe({ type: 'long-animation-frame', buffered: true }); } catch {}
  const tick = () => {
    for (const a of document.getAnimations()) {
      let r = m.seen.get(a);
      if (!r) m.seen.set(a, r = { step: m.step, seen: performance.now(), start: null });
      if (r.start === null && typeof a.startTime === 'number') r.start = a.startTime;
    }
    requestAnimationFrame(tick);
  };
  tick();
})()`;
const LAYOUT = /^(?:width|height|min-|max-|top$|right$|bottom$|left$|inset|margin|padding|border.*width|font-size|line-height|gap$|row-gap|column-gap|flex-basis|grid-template)/;
const MOVES = /^(?:transform|translate|rotate|scale|offset|zoom|background-position)/;
const ACTIONS = ['hover', 'press', 'click', 'focus', 'scroll', 'wait'];

export function parseScript(text) {
  let steps;
  // Windows editors and shells often write a byte-order mark.
  try { steps = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (error) { throw new Error(`--interact is not valid JSON: ${error.message}`); }
  if (!Array.isArray(steps) || !steps.length || steps.length > 6) throw new Error('--interact needs a JSON array of 1–6 steps');
  return steps.map((step, i) => {
    const at = `--interact step ${i + 1}`;
    if (!ACTIONS.includes(step?.do)) throw new Error(`${at}: "do" must be one of ${ACTIONS.join(', ')}`);
    if (step.do === 'wait') { if (!(step.ms >= 100 && step.ms <= 3000)) throw new Error(`${at}: wait needs "ms" from 100 to 3000`); }
    else if (step.do === 'scroll' && step.target === undefined) { if (!(step.y >= 0)) throw new Error(`${at}: scroll needs "target" or "y"`); }
    else if (typeof step.target !== 'string' || !step.target.trim()) throw new Error(`${at}: needs a "target" CSS selector`);
    return { do: step.do, target: step.target, y: step.y, ms: step.ms, label: String(step.label || `${step.do} ${step.target ?? step.y ?? `${step.ms} ms`}`).slice(0, 60) };
  });
}

const group = (items, key) => { const map = new Map(); for (const item of items) map.set(key(item), [...(map.get(key(item)) || []), item]); return [...map.values()]; };
const range = values => { const lo = Math.min(...values), hi = Math.max(...values); return lo === hi ? `${lo}` : `${lo}–${hi}`; };
// Settle time is the span of the finite animations, from animation data.
const timing = list => {
  const timed = list.filter(a => a.start !== null && a.end !== null);
  if (!timed.length) return { firstStartMs: null, endsAtMs: null, settleMs: null };
  const first = Math.min(...timed.map(a => a.start)), end = Math.max(...timed.map(a => a.end));
  return { firstStartMs: Math.round(first), endsAtMs: Math.round(end), settleMs: Math.round(end - first) };
};
// What a replay covers: the finite span, or one cycle of the longest loop when everything loops.
const span = list => {
  const started = list.filter(a => a.start !== null && a.timeline === 'document');
  if (!started.length) return null;
  const first = Math.min(...started.map(a => a.start)), ends = started.filter(a => a.end !== null).map(a => a.end);
  return { first, end: ends.length ? Math.max(...ends) : first + Math.max(...started.map(a => a.duration)) };
};

export function motionFindings(motion) {
  const { motion: questions } = JSON.parse(fs.readFileSync(new URL('../data/fingerprints.json', import.meta.url), 'utf8'));
  const ask = id => questions.find(q => q.id === id).question;
  const findings = [];
  const add = (code, severity, items, message) => { const count = new Set(items.map(i => i.node)).size; findings.push({ code, severity, node: items[0].node, count, message: `${message}${count > 1 ? ` (${count} elements)` : ''}` }); };
  const name = a => a.name || a.kind;
  const { animations, transitions } = motion;

  for (const items of group(animations.filter(a => a.properties.some(p => LAYOUT.test(p))), a => `${a.name}|${a.properties}`)) add('motion.layout-property', 'S2', items, `${name(items[0])} animates ${items[0].properties.filter(p => LAYOUT.test(p)).join(', ')} for ${items[0].duration} ms; layout runs on every frame`);
  for (const items of group(transitions.filter(t => t.properties.some(p => LAYOUT.test(p)) && !findings.some(f => f.node === t.node)), t => `${t.properties}`)) add('motion.layout-property', 'S2', items, `transition on ${items[0].properties.filter(p => LAYOUT.test(p)).join(', ')} (${range(items.flatMap(t => t.durations))} ms); layout runs on every frame`);
  const all = transitions.filter(t => t.properties.includes('all'));
  if (all.length) add('motion.transition-all', 'S2', all, `transition: all (${range(all.flatMap(t => t.durations))} ms); name the properties that should move`);
  if (motion.reduced) {
    // Travel only: a fade or a slow opacity pulse that replaces movement is a valid reduced-motion answer.
    const still = motion.reduced.animations.filter(a => a.duration > 0 && a.properties.some(p => MOVES.test(p) || LAYOUT.test(p)));
    for (const items of group(still, a => `${a.name}|${a.properties}|${a.duration}`)) add('motion.reduced-motion', 'S1', items, `${name(items[0])} still moves (${items[0].properties.join(', ')}, ${items[0].duration} ms) under prefers-reduced-motion`);
  }
  const timed = [...animations.filter(a => a.kind !== 'transition' && a.duration > 0).map(a => ({ node: a.node, key: `${a.duration} ms ${a.easing}` })), ...transitions.flatMap(t => t.durations.map((d, i) => ({ node: t.node, key: `${d} ms ${t.easings[i % t.easings.length]}` })).filter(x => !x.key.startsWith('0 ms')))];
  if (timed.length >= 4 && new Set(timed.map(t => t.key)).size === 1) findings.push({ code: 'motion.fingerprint.uniform-timing', severity: 'S2', node: timed[0].node, count: timed.length, message: `Every motion uses ${timed[0].key} (${timed.length} elements). ${ask('uniform-timing')}` });
  for (const items of group(animations.filter(a => a.step === 0 && a.start !== null && a.iterations !== 'infinite'), a => `${a.name}|${Math.round((a.start + a.delay) / 20)}`)) if (items.length >= 6) findings.push({ code: 'motion.fingerprint.same-entrance', severity: 'S2', node: items[0].node, count: items.length, message: `${items.length} elements run ${name(items[0])} at the same moment. ${ask('same-entrance')}` });
  for (const items of group(animations.filter(a => a.iterations === 'infinite'), a => a.name)) findings.push({ code: 'motion.fingerprint.infinite', severity: 'S2', node: items[0].node, count: items.length, message: `${name(items[0])} loops forever (${items.length} element${items.length > 1 ? 's' : ''}). ${ask('infinite')}` });
  const { firstStartMs, endsAtMs } = motion.load;
  const long = firstStartMs === null ? [] : motion.longFrames.filter(f => f.start < endsAtMs && f.start + f.duration > firstStartMs);
  if (long.length) findings.push({ code: 'motion.long-frame', severity: 'S2', value: Math.max(...long.map(f => f.duration)), message: `${long.length} long frame(s), up to ${Math.max(...long.map(f => f.duration))} ms, while load motion ran; headless timing is indicative, confirm in a real browser` });
  return findings;
}

function overview(motion) {
  const describe = (list, max) => group(list, a => [a.kind, a.name, a.properties, a.duration, a.easing, a.iterations].join('|')).slice(0, max)
    .map(g => `  ${g[0].name || g[0].kind} ×${g.length} · ${g[0].kind} · ${g[0].properties.join(', ') || 'no properties'} · ${g[0].duration} ms · ${g[0].easing} · delay ${range(g.map(a => a.delay))} ms${g[0].iterations === 'infinite' ? ' · infinite' : ''}`);
  const settles = t => t.settleMs === null ? '' : `, first at ${t.firstStartMs} ms, settles after ${t.settleMs} ms`;
  const load = motion.animations.filter(a => a.step === 0);
  const lines = [`${motion.viewport} load: ${load.length} animations${settles(motion.load)}${motion.load.infinite ? `; ${motion.load.infinite} infinite` : ''}`, ...describe(load, 10)];
  if (motion.transitions.length) lines.push(`Declared transitions on ${motion.transitions.length} elements:`, ...group(motion.transitions, t => [t.properties, t.durations, t.easings].join('|')).slice(0, 6).map(g => `  ${g[0].properties.join(', ')} ×${g.length} · ${g[0].durations.join(', ')} ms · ${g[0].easings.join(', ')}`));
  motion.interactions.forEach((step, i) => lines.push(`${step.label}: ${step.animations} animations${settles(step).replace(/, first at \d+ ms/, '')}`, ...describe(motion.animations.filter(a => a.step === i + 1), 3)));
  if (motion.reduced) lines.push(`Reduced motion: ${motion.reduced.animations.length} of ${motion.animations.length} animations still run; ${motion.reduced.rules} prefers-reduced-motion rule(s)`);
  lines.push(`Long frames: ${motion.longFrames.length}${motion.longFrames.length ? ` (max ${Math.max(...motion.longFrames.map(f => f.duration))} ms)` : ''}`);
  return lines;
}

// Step -1 is the pointer being parked between steps: not evidence.
const inventory = async page => { const found = await evaluate(page, fs.readFileSync(new URL('../probes/motion.js', import.meta.url), 'utf8')); found.animations = found.animations.filter(a => a.step >= 0); return found; };
// Small captures: frames are for reading a sequence. With a pointer position, a 480x300 crop around it,
// because a button's hover state is a few pixels of a full viewport.
export async function shot(page, file, point) {
  const [x, y, width, height] = await evaluate(page, '[scrollX, scrollY, innerWidth, innerHeight]');
  const w = Math.min(480, width), h = Math.min(300, height), clamp = (v, max) => Math.max(0, Math.min(max, v));
  const clip = point ? { x: x + clamp(point.x - w / 2, width - w), y: y + clamp(point.y - h / 2, height - h), width: w, height: h, scale: 320 / w } : { x, y, width, height, scale: 0.5 };
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}
// Waits until one step's animations have ended and nothing new has started for 300 ms; bounded by cap.
async function watch(page, step, cap) {
  for (const start = Date.now(); Date.now() - start < cap; await delay(50)) {
    const s = await evaluate(page, `(() => { const m = window.__nomiMotion; if (!m) return null; let end = 0, last = 0; for (const [a, r] of m.seen) { if (r.step !== ${step}) continue; last = Math.max(last, r.seen); const e = a.effect?.getComputedTiming().endTime; if (r.start !== null && Number.isFinite(e)) end = Math.max(end, r.start + e / (a.playbackRate || 1)); } return { now: performance.now(), end, last }; })()`);
    if (!s) throw new Error('motion recorder is missing from the page');
    if (Date.now() - start >= 300 && s.now >= s.end && s.now - s.last >= 300) return true;
  }
  return false;
}
// Replay: pause the step's animations at document time t. A transition before its start shows its from-value.
const seek = (page, step, t) => evaluate(page, `(() => { for (const [a, r] of window.__nomiMotion.seen) { if (r.step !== ${step} || r.start === null || a.timeline !== document.timeline || a.playState === 'idle') continue; try { a.pause(); const local = (${t} - r.start) * (a.playbackRate || 1); a.currentTime = a instanceof CSSTransition ? Math.max(0, local) : local; } catch {} } return new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(true)))); })()`);
const release = (page, step) => evaluate(page, `(() => { for (const [a, r] of window.__nomiMotion.seen) { if (r.step !== ${step} || a.playState !== 'paused') continue; try { Number.isFinite(a.effect.getComputedTiming().endTime) ? a.finish() : a.play(); } catch {} } return new Promise(done => requestAnimationFrame(() => done(true))); })()`);
export const mouse = (page, type, point) => page.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });

// Brings the step's target into view and returns its centre; null for steps without a pointer position.
async function locate(page, step) {
  if (step.target === undefined) return null;
  const point = await evaluate(page, `(() => { const el = document.querySelector(${JSON.stringify(step.target)}); if (!el) return null; el.scrollIntoView({ block: ${step.do === 'scroll' ? '"center"' : '"nearest"'}, inline: 'nearest', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  if (!point) throw new Error(`--interact: no element matches ${step.target}`);
  return point;
}
// Returns the pointer position while a press is still held, so the caller can release it after capturing.
async function act(page, step, point) {
  if (step.do === 'wait') await delay(step.ms);
  if (step.do === 'scroll' && !point) await evaluate(page, `scrollTo({ top: ${Number(step.y)}, behavior: 'instant' })`);
  if (step.do === 'focus') await evaluate(page, `document.querySelector(${JSON.stringify(step.target)}).focus({ preventScroll: true })`);
  if (!['hover', 'press', 'click'].includes(step.do)) return null;
  await mouse(page, 'mouseMoved', point);
  if (step.do === 'hover') return null;
  await mouse(page, 'mousePressed', point);
  if (step.do === 'press') return point;
  await mouse(page, 'mouseReleased', point);
  return null;
}

async function pass(ctx, reduced) {
  const { page, url, wait, steps, run } = ctx, shots = !reduced;
  await mouse(page, 'mouseMoved', { x: 0, y: 0 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: ctx.dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  const started = Date.now();
  const notes = await ctx.settle(page, wait, async () => {
    const navigation = await page.send('Page.navigate', { url });
    if (navigation.errorText) throw new Error(`navigate: ${navigation.errorText}`);
  });
  if (!await watch(page, 0, Math.max(400, wait - (Date.now() - started)))) notes.push(`Motion watch window ${wait} ms reached; animations that start later are not recorded.`);
  const frames = [], rows = [];
  if (shots) {
    const load = span((await inventory(page)).animations.filter(a => a.step === 0));
    for (let i = 0; i < (load ? 8 : 1); i++) {
      if (load) await seek(page, 0, load.first + (load.end - load.first) * i / 7);
      frames.push({ ms: load ? Math.round((load.end - load.first) * i / 7) : 0, image: await shot(page, path.join(run.dir, `load-${i + 1}.png`)) });
    }
    if (load) await release(page, 0);
  }
  for (const [i, step] of steps.entries()) {
    const n = i + 1;
    await evaluate(page, `window.__nomiMotion.step = ${n}`);
    const point = await locate(page, step);
    const row = shots ? { label: step.label, before: await shot(page, path.join(run.dir, `step-${n}-before.png`), point), mid: [] } : null;
    const held = await act(page, step, point);
    await watch(page, n, 1500);
    if (shots) {
      const s = span((await inventory(page)).animations.filter(a => a.step === n));
      for (const k of s ? [1, 2] : []) {
        await seek(page, n, s.first + (s.end - s.first) * k / 3);
        row.mid.push({ ms: Math.round((s.end - s.first) * k / 3), image: await shot(page, path.join(run.dir, `step-${n}-${k}.png`), point) });
      }
      if (s) await release(page, n);
      row.after = await shot(page, path.join(run.dir, `step-${n}-after.png`), point);
      rows.push(row);
    }
    if (point && step.do !== 'scroll' && step.do !== 'focus') { // park the pointer, so the way back is not counted in the next step
      await evaluate(page, 'window.__nomiMotion.step = -1');
      if (held) await mouse(page, 'mouseReleased', held);
      await mouse(page, 'mouseMoved', { x: 0, y: 0 });
      await watch(page, -1, 800);
    }
  }
  return { inventory: await inventory(page), frames, rows, notes };
}

function dnaMotion(cwd) {
  try {
    const file = findDna(cwd);
    const section = file && parseDna(fs.readFileSync(file, 'utf8')).sections.find(s => s.title === 'Motion');
    return section ? section.lines.map(l => l.text.trim()).filter(Boolean).join(' ').slice(0, 320) : '';
  } catch { return ''; } // an unreadable DNA is reported by `dna check`, not by a capture
}

export async function captureMotion(ctx) {
  const { page, viewport, steps, run, report } = ctx;
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER });
  await page.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: viewport.width < 768 });
  const normal = await pass(ctx, false), reduced = await pass(ctx, true);
  const animations = normal.inventory.animations, load = animations.filter(a => a.step === 0);
  const motion = report.motion = {
    viewport: `${viewport.width}x${viewport.height}`,
    load: { ...timing(load), animations: load.length, infinite: load.filter(a => a.iterations === 'infinite').length, frames: normal.frames },
    animations, transitions: normal.inventory.transitions,
    interactions: steps.map((step, i) => { const own = animations.filter(a => a.step === i + 1); return { do: step.do, target: step.target, label: step.label, animations: own.length, ...timing(own) }; }),
    reduced: { rules: normal.inventory.reducedMotion.rules, animations: reduced.inventory.animations },
    longFrames: normal.inventory.longFrames,
  };
  report.findings = motionFindings(motion);
  report.overview = overview(motion);
  const blank = await ctx.blank();
  const sheet = async (name, images, labels) => {
    const file = path.join(run.dir, name);
    fs.writeFileSync(file, Buffer.from(await compose(blank, images, labels, { columns: 4, cell: 320, max: 24 }), 'base64'));
    report.images.push(file);
  };
  await sheet('load.png', normal.frames.map(f => f.image), normal.frames.map(f => `load +${f.ms} ms`));
  if (normal.rows.length) await sheet('interactions.png', normal.rows.flatMap(r => [r.before, r.mid[0]?.image || null, r.mid[1]?.image || null, r.after]), normal.rows.flatMap(r => [`${r.label}: before`, `+${r.mid[0]?.ms} ms`, `+${r.mid[1]?.ms} ms`, 'after']));
  if (!load.length) report.notes.push('No load animation was recorded.');
  // The project's own motion direction, next to what was measured: the model compares, the script does not judge.
  const declared = dnaMotion(ctx.cwd);
  if (declared) report.notes.push(`DNA Motion: "${declared}" A measured value or a fingerprint that contradicts this is drift to fix, not a question.`);
  report.notes.push(...new Set([...normal.notes, ...normal.inventory.notes]), 'Frames are replayed from animation data at the labelled times; replay can fire a page\'s animation end handlers again.', 'Timings are evidence, not a taste score. Open the sheets before making claims about motion.');
}
