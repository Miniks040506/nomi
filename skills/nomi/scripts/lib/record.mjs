// brandvid: the demo video, recorded from the running product. The storyboard's flows are replayed for real through the
// flow engine while the page is filmed; a flow that does not complete is not shown. The picture (the product in a window,
// pointer, camera, captions, cards) and the sound are made afterwards on a separate blank page (probes/stage.js), which
// also encodes the file and measures it.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from './browser.mjs';
import { evaluate } from './cdp.mjs';
import { serve } from './serve.mjs';
import { settle } from './capture.mjs';
import { stateDir } from './runs.mjs';
import { HELPER, parseFlows, isLocal, track, visit, perform, call } from './flow.mjs';
import { productTypes } from './plan.mjs';
import { CLOCK, CARET } from './clock.mjs';

const PW = 1440, PH = 810, FPS = 60; // the product is filmed at 1440x810 and shown at that size in a 1920x1080 picture, 60 frames a second
const GLIDE = 0.4, KEY = 0.045;
// The pointer rests on a control for a moment before it clicks: without that it reads as a machine, with more as hesitation.
const SETTLE = 0.18;
// The page is filmed at one and a half device pixels a CSS pixel, so the closest shots are still sharp; time in it moves one frame at a time.
const SCALE = 1.5, TICK = 1000 / FPS;
// A scene opens before anything is done in it, and closes after its last step.
const OPEN = 0.9, CLOSE = 0.35;
// A composed video is rendered at 60 frames a second unless the page asks for 30 (<html data-fps="30">): a trailer is
// things in motion, and at 30 a fast move steps. Every frame is a screenshot of a whole 1920x1080 page, so 60 takes
// about twice as long to render.
const COMPOSED = 60;
// How long a jump of the page takes to come in.
const SOFT = 0.22; // the pointer's way to a target, and the time between two typed characters, in seconds
// A demo video is 20 to 25 seconds; the check accepts up to 30.
export const LIMITS = { min: 20, max: 30, hook: 60, problem: 80, caption: 70, cta: 80 };
// How fast it moves and sounds. The storyboard may name one; the picture's layout is the same for all.
export const TONES = { calm: { target: 25, bpm: 84, root: 57 }, default: { target: 23, bpm: 100, root: 60 }, punchy: { target: 21, bpm: 116, root: 62 } };
const count = text => text.trim().split(/\s+/).length;
// How far the decoded picture may be from the composed one (mean difference of brightness, of 255) before the file counts as broken.
const FAITHFUL = 14;
// Reading time for a line on screen, counted from when the whole line is in: a floor, measured by `check`.
export const readingTime = text => Math.max(1.2, 0.3 * count(text));

export function parseStoryboard(text, flows) {
  let board;
  try { board = JSON.parse(text.replace(/^﻿/, '')); } catch (error) { throw new Error(`storyboard is not valid JSON: ${error.message}`); }
  const line = (key, max) => { const v = board?.[key]; if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error(`storyboard: "${key}" is one line of at most ${max} characters`); return v.trim(); };
  const result = { hook: line('hook', LIMITS.hook), problem: board?.problem === undefined ? '' : line('problem', LIMITS.problem), cta: line('cta', LIMITS.cta) };
  if (!Array.isArray(board.scenes) || !board.scenes.length || board.scenes.length > 3) throw new Error('storyboard: "scenes" is a list of 1–3 flows to show');
  result.scenes = board.scenes.map((scene, i) => {
    const flow = flows.find(f => f.name === scene?.flow);
    if (!flow) throw new Error(`storyboard scene ${i + 1}: "flow" must name one of the flows: ${flows.map(f => f.name).join(', ')}`);
    if (board.scenes.findIndex(s => s?.flow === scene.flow) !== i) throw new Error(`storyboard: flow "${scene.flow}" is shown twice`);
    if (typeof scene.caption !== 'string' || !scene.caption.trim() || scene.caption.trim().length > LIMITS.caption) throw new Error(`storyboard scene ${i + 1}: "caption" is one line of at most ${LIMITS.caption} characters`);
    if (scene.wow !== undefined && !(Number.isInteger(scene.wow) && scene.wow >= 1 && scene.wow <= flow.steps.length)) throw new Error(`storyboard scene ${i + 1}: "wow" is the number of a step of the flow (1–${flow.steps.length})`);
    return { flow, caption: scene.caption.trim(), wow: scene.wow };
  });
  if (result.scenes.filter(s => s.wow).length !== 1) throw new Error('storyboard: exactly one scene marks its "wow" step, the moment the video is about');
  if (board.tone !== undefined && !Object.hasOwn(TONES, board.tone)) throw new Error(`storyboard: "tone" is one of ${Object.keys(TONES).join(', ')}`);
  result.tone = board.tone || 'default'; result.toneSaid = Boolean(board.tone);
  return result;
}

// What each step takes on screen without the pause after it, in seconds; the pause is what pacing sets.
const stepBase = step => step.do === 'wait' ? step.ms / 1000 + 0.02 : step.do === 'expect' ? 0.3 : (step.target || step.name) ? GLIDE + (step.do === 'click' ? SETTLE : 0) + 0.3 + (step.do === 'type' ? step.text.length * (KEY + 0.008) : 0) : 0.25;
const weight = step => step.do === 'expect' ? 0.6 : 1;
// A card lasts its entrance (word by word), its reading time and its exit.
const cardTime = (text, gap) => 0.5 + count(text) * gap + readingTime(text) + 0.35;
// The video plays in the product's own time: nothing is cut out of what was filmed, so a clock on the page runs evenly.
// What pacing decides, before filming, is the pause after each step, so that the whole lands on the tone's length.
export function pace(board) {
  const steps = board.scenes.flatMap(s => s.flow.steps), fixed = steps.reduce((a, s) => a + stepBase(s), 0) + board.scenes.length * (OPEN + CLOSE) + 0.45, flexible = steps.reduce((a, s) => a + weight(s), 0);
  // The hook is on screen under three seconds: it is a few words, and the product follows.
  const cards = { hook: Math.min(3, 0.6 + count(board.hook) * 0.07 + Math.max(1, 0.25 * count(board.hook))), problem: board.problem ? cardTime(board.problem, 0.05) : 0, cta: 3 }, said = cards.hook + cards.problem + cards.cta;
  // A pause is short: while it lasts only the pointer and the camera move. Only flows with little in them get longer
  // ones, up to a second, so that the video still reaches its shortest length and what a step saw can be read.
  let hold = Math.max(0.1, Math.min(0.45, (TONES[board.tone || 'default'].target - said - fixed) / flexible));
  if (said + fixed + flexible * hold < LIMITS.min + 1) hold = Math.min(1, (LIMITS.min + 1 - said - fixed) / flexible);
  const shortest = fixed + flexible * 0.1 + said;
  if (shortest > LIMITS.max - 0.5) throw new Error(`storyboard: these scenes need about ${Math.round(shortest)} s at the fastest pace, and a demo video is ${LIMITS.min}–25 s (${LIMITS.max} at most). Show fewer flows or shorter ones, or leave out the problem line`);
  const natural = board.scenes.map(scene => scene.flow.steps.reduce((a, st) => a + stepBase(st) + hold * weight(st), 0) + OPEN + CLOSE + (scene.wow ? 0.45 : 0));
  // A scene stays as long as its caption takes to come in, be read and leave. A flow shorter than that gets longer
  // pauses, up to a second and a half; the camera keeps moving through them.
  const needs = board.scenes.map(scene => 0.42 + count(scene.caption) * 0.045 + readingTime(scene.caption) + 0.35);
  const budgets = natural.map((time, n) => Math.max(time, needs[n]));
  const caps = natural.map((time, n) => time >= needs[n] ? Math.max(0.45, hold) : Math.min(1.5, hold + 0.1 + (needs[n] - time) / board.scenes[n].flow.steps.reduce((a, st) => a + weight(st), 0)));
  return { hold, cards, budgets, caps };
}

// What the product looks like, so cards and captions are set in its own type and colours.
const STYLE = `(() => {
  const solid = c => c && !/rgba\\([^)]*,\\s*0\\)$|transparent/.test(c);
  const body = getComputedStyle(document.body), root = getComputedStyle(document.documentElement);
  const bg = [body.backgroundColor, root.backgroundColor].find(solid) || 'rgb(255, 255, 255)';
  const heading = document.querySelector('h1, h2, [role=heading]');
  const accents = [...document.querySelectorAll('button, [role=button], input[type=submit], a')].map(e => getComputedStyle(e)).flatMap(s => [s.backgroundColor, s.color]).filter(c => solid(c) && c !== bg && c !== body.color);
  const families = [body.fontFamily, heading ? getComputedStyle(heading).fontFamily : body.fontFamily];
  const wanted = new Set(families.flatMap(f => f.split(',').map(n => n.trim().replace(/^["']|["']$/g, '').toLowerCase())));
  const fonts = [];
  for (const sheet of document.styleSheets) { let rules = []; try { rules = sheet.cssRules; } catch {} for (const r of rules) if (r instanceof CSSFontFaceRule) {
    const family = r.style.getPropertyValue('font-family').trim().replace(/^["']|["']$/g, ''), url = /url\\(["']?([^"')]+)["']?\\)/.exec(r.style.getPropertyValue('src'))?.[1];
    if (url && wanted.has(family.toLowerCase()) && fonts.length < 6) fonts.push({ family, url: new URL(url, sheet.href || location.href).href, descriptors: { weight: r.style.getPropertyValue('font-weight') || 'normal', style: r.style.getPropertyValue('font-style') || 'normal' } });
  } }
  return { bg, fg: body.color, accent: accents[0] || body.color, font: families[0], heading: families[1], fonts, title: document.title };
})()`;
// In the filmed page: where something is, and a scroll to it that moves the way a hand scrolls (the flow engine's own
// scroll is instant, which on film is a jump).
const FILM = `(() => {
  if (window.__nomiFilm || window.top !== window) return;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const box = e => { const r = e.getBoundingClientRect(); return { top: r.top, height: r.height, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; };
  window.__nomiFilm = {
    // A control, found the way a flow finds it, or the innermost element that shows a text.
    spot(l) {
      if (l.target || l.name) { const e = window.__nomiFlow && window.__nomiFlow.find(l); return e ? box(e) : null; }
      const want = (l.text || '').replace(/\\s+/g, ' ').trim().toLowerCase(); if (!want) return null;
      const e = [...document.querySelectorAll('body *')].filter(e => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && (e.innerText || e.value || '').replace(/\\s+/g, ' ').toLowerCase().includes(want)).at(-1);
      if (!e) return null;
      const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect();
      return b.width > 0 && b.height > 0 ? { top: b.top, height: b.height, x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2), w: Math.round(b.width), h: Math.round(b.height) } : box(e);
    },
    // Brings a place to the middle of the view, eased, in a time that grows with the distance. Returns how long that takes in ms (0: it was there).
    centre(top, height) {
      const from = scrollY, max = Math.max(0, document.documentElement.scrollHeight - innerHeight), to = Math.max(0, Math.min(max, from + top + height / 2 - innerHeight / 2));
      // A place that is comfortably in view is left where it is: the page moves only when it has to.
      if (Math.abs(to - from) < 8 || (top >= innerHeight * 0.1 && top + height <= innerHeight * 0.9)) return 0;
      const dur = Math.max(380, Math.min(800, Math.abs(to - from) * 1.1)), start = performance.now();
      const tick = now => { const p = Math.min(1, (now - start) / dur); scrollTo(0, from + (to - from) * ease(p)); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      return dur;
    },
  };
})()`;
// How wide the content really is in the view: the box around everything a person reads or uses.
const CONTENT = `(() => { let lo = Infinity, hi = -Infinity; for (const e of document.querySelectorAll('h1, h2, h3, p, li, label, button, input, select, textarea, td, th, a, img, [role=button]')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && e.checkVisibility()) { lo = Math.min(lo, r.left); hi = Math.max(hi, r.right); } } return hi > lo ? hi - lo : innerWidth; })()`;
const ZOOM = z => `(() => { const set = () => { document.documentElement.style.zoom = ${z}; }; document.documentElement ? set() : addEventListener('DOMContentLoaded', set); })()`;
const FONT = url => `fetch(${JSON.stringify(url)}).then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (!b || b.byteLength > 3e6) return null; let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); }).catch(() => null)`;

// The recorder's own loopback server: the stage page, the files it reads (frames, fonts, a video to measure) and what it posts back.
async function stageServer(assets, saved) {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.slice(1));
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')) { res.writeHead(403).end(); return; }
    if (req.method === 'POST' && name.startsWith('out/')) { const parts = []; req.on('data', d => parts.push(d)); req.on('end', () => { saved.set(name.slice(4), Buffer.concat(parts)); res.writeHead(204).end(); }); return; }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (name === '') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><meta charset="utf-8"><title>stage</title><script src="/stage.js"></script>'); return; }
    if (name === 'stage.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(fs.readFileSync(new URL('../probes/stage.js', import.meta.url))); return; }
    const asset = name.startsWith('a/') && assets.get(name.slice(2));
    if (asset) res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' }).end(asset); else res.writeHead(404).end();
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
// Opened last: a new tab takes the foreground, and a page behind it is no longer filmed or sent input.
async function openStage(browser, url) {
  const { targetId } = await browser.cdp.send('Target.createTarget', { url });
  const { sessionId } = await browser.cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const stage = { send: (method, params, timeout) => browser.cdp.send(method, params, sessionId, timeout) };
  for (const start = Date.now(); ; await delay(50)) {
    if (await evaluate(stage, 'typeof window.__nomiStage === "object"').catch(() => false)) break;
    if (Date.now() - start > 5000) throw new Error('the stage page did not load');
  }
  stage.run = async (fn, ...args) => {
    const result = await stage.send('Runtime.evaluate', { expression: `window.__nomiStage.${fn}(${args.map(a => JSON.stringify(a)).join(', ')})`, awaitPromise: true, returnByValue: true }, 170000);
    if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.exception?.description || result.exceptionDetails.text).split('\n')[0]);
    return result.result.value;
  };
  return stage;
}

// Films one flow in the product's own time. Times are seconds from the scene's first frame, and they are the times
// the video shows: nothing is cut afterwards. After each step comes a pause, sized as it goes from the time the scene
// has left (`budget`, in seconds) and what the steps still to come need, so the scene ends when pacing said it would.
// The recorder's side of the page's clock (lib/clock.mjs). Time in the page moves one frame at a time, and after a step
// that can have changed the picture a screenshot is taken: every filmed frame is the page at an exact time, whatever
// the machine was doing. A picture equal to the one before is not kept.
function filmClock(page, frames, tick = TICK) {
  let ms = 0, last = null;
  const shoot = async () => {
    const data = Buffer.from((await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true })).data, 'base64');
    if (!last || !data.equals(last)) frames.push({ at: ms, data });
    last = data;
  };
  return {
    now: () => ms, shoot,
    // A wait follows something done to the page from outside (a click, a key, a scroll): its first steps are filmed
    // whatever the page says.
    async wait(span) {
      for (let n = Math.max(1, Math.round(span / tick)), i = 0; i < n; i++) {
        // No clock in the page: a new document is loading. It runs in real time until its first step.
        const film = await evaluate(page, `window.__nomiClock ? window.__nomiClock.step(${tick}, ${i === 0}) : null`).catch(() => null);
        if (film === null) await delay(tick);
        ms += tick;
        if (film !== false) await shoot();
      }
    },
  };
}

async function film(ctx, scene, budget, tracker, cap = 0.45) {
  const { page, frames } = ctx, flow = scene.flow, events = [], first = frames.length, clock = filmClock(page, frames);
  let reason = await visit(ctx, flow, tracker);
  await page.send('Page.bringToFront').catch(() => {});
  // The page has loaded in real time. From here its clock moves only with the recorder's, a frame at a time.
  try { await evaluate(page, 'window.__nomiClock.hold()'); await clock.shoot(); } catch (error) { reason ||= `the page could not be filmed: ${error.message}`; }
  const now = () => clock.now() / 1000, steps = [];
  // Finds a place on the page and scrolls it into the middle of the view before anything is done there.
  const bring = async where => {
    const find = () => evaluate(page, `window.__nomiFilm ? window.__nomiFilm.spot(${JSON.stringify(where)}) : null`).catch(() => null), spot = await find();
    if (!spot) return null;
    const ms = await evaluate(page, `window.__nomiFilm.centre(${spot.top}, ${spot.height})`).catch(() => 0);
    if (!ms) return spot;
    await clock.wait(ms + 2 * TICK);
    return find();
  };
  await clock.wait(OPEN * 1000); // the window comes in, the caption is set, the camera makes its one move
  for (const [i, step] of flow.steps.entries()) {
    if (reason) break;
    const located = (step.target || step.name) && step.do !== 'expect';
    try {
      if (located) await bring({ target: step.target, name: step.name });
      const p = located ? await call(page, 'at', { target: step.target, name: step.name }).catch(() => null) : null;
      if (p) { events.push({ kind: 'aim', t: now(), g: GLIDE, x: p.x, y: p.y, w: p.w, h: p.h }); await clock.wait(GLIDE * 1000); if (step.do === 'click') await clock.wait(SETTLE * 1000); events.push({ kind: 'act', t: now(), x: p.x, y: p.y, click: step.do === 'click' }); }
      else if (step.do !== 'expect' && step.do !== 'wait') events.push({ kind: 'wide', t: now() });
      if (p && step.do === 'type') events.push({ kind: 'keys', t: now(), n: step.text.length });
      const done = await perform(page, step, tracker, KEY * 1000, clock);
      if (done?.dead) throw new Error('the click changed nothing');
      // What a step expected is brought into view, and the title bar says it was seen. The storyboard's moment is
      // looked at closer and held.
      const wow = scene.wow === i + 1, seen = step.do === 'expect' && step.state !== 'hidden';
      const at = seen ? await bring(step.target || step.name ? { target: step.target, name: step.name } : { text: step.text ?? '' }) : p;
      if (step.do === 'expect') events.push({ kind: 'tick', t: now(), text: step.label.replace(/^expect /, '').replace(/^"(.*)"$/, '$1') });
      // The storyboard's moment: the camera closes in on it while everything goes on; it is the poster.
      if (wow) { if (at) events.push({ kind: 'mark', zoom: true, t: now(), x: at.x, y: at.y, w: at.w, h: at.h }); scene.wowAt = now() + 0.4; await clock.wait(450); }
      else if (seen && at) events.push({ kind: 'see', t: now(), x: at.x, y: at.y, w: at.w, h: at.h });
    } catch (error) { reason = error.message; }
    steps.push({ n: i + 1, label: step.label, ok: !reason });
    if (!reason) {
      const later = flow.steps.slice(i + 1), left = budget - now() - later.reduce((a, st) => a + stepBase(st), 0) - (later.some((st, k) => scene.wow === i + 2 + k) ? 0.45 : 0) - 0.35;
      await clock.wait(Math.max(0.1, Math.min(cap, left / (weight(step) + later.reduce((a, st) => a + weight(st), 0)))) * weight(step) * (1 + 0.18 * Math.sin(i * 2.4 + 1)) * 1000);
    }
  }
  // A short flow under a long caption: the scene lasts until the caption has been read.
  if (!reason) await clock.wait(Math.max(350, cap > 0.45 ? Math.min(1500, (budget - now()) * 1000) : 0));
  const { errors } = tracker.take();
  return { flow: flow.name, caption: scene.caption, status: reason ? 'failed' : 'completed', failedStep: reason ? Math.max(1, steps.length) : null, reason, dur: now(), wowAt: scene.wowAt, events, consoleErrors: [...new Set(errors)], frames: frames.slice(first).map((f, n) => ({ i: first + n, t: f.at / 1000 })) };
}

// The longest time in a scene in which nothing happened: the product's own page was not repainted, and no step began,
// acted or saw what it expected (each of those moves the pointer or the camera, or says something in the title bar).
function stillest(scene, start) {
  const times = [...scene.frames.map(f => f.t), ...scene.events.map(e => e.t), scene.dur].sort((a, b) => a - b);
  let from = 0, span = 0;
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > span) { span = times[i] - times[i - 1]; from = times[i - 1]; }
  return { from: Math.round((start + from) * 10) / 10, for: Math.round(span * 10) / 10 };
}

// Findings of a finished video, from what the browser's own player shows (stage.js inspect) and the recording's report.
export function videoFindings(report, measured) {
  const findings = [], add = (code, severity, message, value) => findings.push({ code, severity, message, value });
  const stretch = (test, label, code, limit = 2) => {
    let from = null;
    const close = to => { if (from !== null && to - from > limit) add(code, 'S1', `${label} for ${(to - from).toFixed(1)} s, from ${from.toFixed(1)} s`, Math.round((to - from) * 10) / 10); from = null; };
    for (const s of measured.samples) { if (test(s)) from ??= s.t; else close(s.t); }
    close(measured.duration);
  };
  if (measured.duration < LIMITS.min || measured.duration > LIMITS.max) add('video.duration', 'S1', `the video runs ${measured.duration.toFixed(1)} s; a demo video is ${LIMITS.min}–25 s, ${LIMITS.max} at most`, measured.duration);
  else if (measured.duration > 25.5) add('video.duration', 'S2', `the video runs ${measured.duration.toFixed(1)} s; it is best at ${LIMITS.min}–25 s: leave out the problem line, or show fewer steps`, measured.duration);
  if (measured.width < 1280 || measured.height < 720) add('video.resolution', 'S1', `${measured.width}x${measured.height}; at least 1280x720`, `${measured.width}x${measured.height}`);
  stretch(s => s.luma < 12, 'the picture is black', 'video.black');
  // A still stretch counts where the product is on screen (the change is measured inside its window); a card is text being read.
  const card = t => (report.cards || []).some(c => t >= c.start - 0.2 && t <= c.end + 0.2);
  stretch(s => s.diff !== null && s.diff < 0.06 && !card(s.t), 'nothing moves', 'video.frozen', report.composed ? 4 : 2);
  // The camera keeps moving over a product that does nothing, so the picture cannot tell: the recording can. More
  // than two seconds in which the page is not repainted and no step does or sees anything is a wait the viewer sits through.
  for (const s of report.scenes) if (s.status === 'completed' && s.still?.for > 2) add('video.frozen', 'S1', `nothing happens in the product for ${s.still.for.toFixed(1)} s, from ${s.still.from.toFixed(1)} s (flow "${s.flow}"): shorten the wait, or show steps where something happens`, s.still.for);
  for (const name of report.storyboard) {
    const scene = report.scenes.find(s => s.flow === name && s.status === 'completed');
    const moves = scene && measured.samples.some(s => s.t > scene.start && s.t < scene.end && s.diff >= 0.06);
    if (!scene) add('video.flow-missing', 'S1', `flow "${name}" of the storyboard is not in the video${report.scenes.find(s => s.flow === name)?.reason ? `: it stopped while being recorded (${report.scenes.find(s => s.flow === name).reason})` : ''}`, name);
    else if (scene.end > measured.duration + 0.5 || !moves) add('video.flow-missing', 'S1', `flow "${name}" should play from ${scene.start.toFixed(1)} to ${scene.end.toFixed(1)} s, and nothing happens there`, name);
  }
  for (const cap of measured.captions) {
    if (cap.contrast < 4.5) add('video.caption-contrast', 'S1', `caption "${cap.text}" has contrast ${cap.contrast}:1 against the picture behind it; 4.5:1 is the floor`, cap.contrast);
    if (cap.end - cap.start < readingTime(cap.text)) add('video.caption-time', 'S1', `caption "${cap.text}" is on screen ${(cap.end - cap.start).toFixed(1)} s; reading it takes ${readingTime(cap.text).toFixed(1)} s`, Math.round((cap.end - cap.start) * 10) / 10);
  }
  if (report.sound && !(measured.audio?.rms >= 0.004)) add('video.sound', 'S1', measured.audio ? 'the sound track is silent' : `the video has no sound track this browser can play${report.audioError ? ` (the sound could not be made: ${report.audioError})` : ''}`);
  else if (report.sound && Math.abs(measured.audio.duration - measured.duration) > 0.6) add('video.sound', 'S1', `the sound runs ${measured.audio.duration} s and the picture ${measured.duration} s`);
  else if (report.sound && measured.audio.peak >= 0.999) add('video.sound', 'S2', 'the sound clips at full level');
  if (report.composed && report.scriptErrors?.length) add('video.script-error', 'S1', `the composition threw while it was rendered: ${report.scriptErrors.join('; ')}`);
  if (report.composed && !(report.pictures || []).some(p => p.width >= 600)) add('video.product', 'S1', 'the real product is not in the trailer: it shows no picture of the product (run the flows, then use the pictures of the page they leave: .nomi/runs/<id>/flow-<n>-step-<k>.png)');
  if (measured.fidelity?.worst > FAITHFUL) add('video.encode', 'S1', `at ${measured.fidelity.at} s the file does not show what was composed (a block differs by ${measured.fidelity.worst} of 255): the encoder left an older picture standing; record again`, measured.fidelity.worst);
  if (report.bytes > 10e6) add('video.size', 'S2', `${(report.bytes / 1e6).toFixed(1)} MB: above the 10 MB a free GitHub account can attach`, report.bytes);
  return findings;
}

// Composes and encodes a prepared timeline (the recorder's, or a test's), writes the files, measures the video.
export async function produce(browser, spec, assets, outDir, report) {
  const saved = new Map(), server = await stageServer(assets, saved);
  try {
    const stage = await openStage(browser, server.url), result = await stage.run('render', spec);
    fs.mkdirSync(outDir, { recursive: true });
    for (const [name, data] of saved) fs.writeFileSync(path.join(outDir, name), data);
    Object.assign(report, { sound: Boolean(spec.audio), audio: result.audio, window: result.window, fidelity: result.measured?.fidelity ?? null, audioError: result.audioError ?? null, file: result.video ? 'demo.mp4' : null, poster: 'poster.png', preview: 'preview.webp', sheet: 'sheet.png', width: result.width, height: result.height, fps: result.fps, duration: result.duration, bytes: result.video?.bytes ?? 0, codec: result.video?.codec ?? null, previewSeconds: result.preview.seconds, previewBytes: result.preview.bytes });
    if (result.noEncoder) { report.findings.push({ code: 'video.encoder', severity: 'S1', message: 'this browser cannot encode H.264, so there is no video file; the poster, the sheet and the preview were written. Use Chrome or Edge (NOMI_BROWSER)' }); report.captions = result.captions; }
    else { report.captions = result.measured.captions; report.findings.push(...videoFindings(report, result.measured)); }
    fs.writeFileSync(path.join(outDir, 'video.json'), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally { await server.close(); }
}

export async function record(target, opts = {}) {
  if (!target) throw new Error('brandvid needs the product to film: a URL, an HTML file or a folder');
  const cwd = opts.cwd || process.cwd(), state = stateDir(cwd);
  const flowFile = [path.join(state, 'plan.md'), path.join(state, 'flows.json')].find(f => fs.existsSync(f) && (path.basename(f) !== 'plan.md' || /^```json/m.test(fs.readFileSync(f, 'utf8'))));
  if (!flowFile) throw new Error('brandvid films the product\'s flows and found none: write them in .nomi/flows.json (or .nomi/plan.md) and run them first: nomi review <target>');
  const boardFile = path.resolve(cwd, opts.storyboard || path.join(state, 'storyboard.json'));
  if (!fs.existsSync(boardFile)) throw new Error(`no storyboard at ${path.relative(cwd, boardFile)}: write it first (modules/brandvid.md shows the five fields)`);
  const board = parseStoryboard(fs.readFileSync(boardFile, 'utf8'), parseFlows(fs.readFileSync(flowFile, 'utf8')));
  if (!board.toneSaid && path.basename(flowFile) === 'plan.md') board.tone = productTypes().find(t => t.id === /^type:\s*([\w-]+)/m.exec(fs.readFileSync(flowFile, 'utf8'))?.[1])?.tone || board.tone;
  if (!isLocal(target) && !opts.live) throw new Error('brandvid replays the flows for real, so it only films a local target (a file, a folder or a localhost URL). For another URL add --live, and only when the user named that URL and asked for it');
  if (process.env.NOMI_BROWSER_NO_SANDBOX === '1' && !isLocal(target)) throw new Error('NOMI_BROWSER_NO_SANDBOX=1 only films local pages; unset it for other URLs');
  const { cards, budgets, caps } = pace(board), tone = TONES[board.tone], outDir = path.resolve(cwd, opts.out || path.join(state, 'video'));
  let server, browser;
  try {
    let url;
    if (/^https?:\/\//i.test(target)) url = new URL(target).href; else { server = await serve(path.resolve(cwd, target)); url = server.url; }
    browser = await launchBrowser();
    const page = browser.page, frames = [], local = isLocal(url);
    await page.send('Page.enable'); await page.send('Network.enable'); await page.send('Runtime.enable');
    // The clock first: what the other helpers and the page itself take as the time functions are already the clock's.
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CARET });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: HELPER });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: FILM });
    // The view is the size the product is shown at; each picture of it is a screenshot, one and a half device pixels a CSS pixel.
    await page.send('Emulation.setDeviceMetricsOverride', { width: PW, height: PH, deviceScaleFactor: SCALE, mobile: false });
    await page.send('Emulation.setScrollbarsHidden', { hidden: true }).catch(() => {});
    if (local) await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    const tracker = track(page, local);
    const ctx = { page, url, wait: 1800, settle, frames }, scenes = [];
    // Look once before filming: when the content is a narrow column, the page is shown larger (the browser's own zoom, at most 1.4).
    await visit(ctx, board.scenes[0].flow, tracker);
    const zoom = Math.round(Math.max(1, Math.min(1.4, PW * 0.84 / (await evaluate(page, CONTENT).catch(() => PW)))) * 20) / 20;
    if (zoom > 1) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: ZOOM(zoom) });
    try { for (const [n, scene] of board.scenes.entries()) scenes.push(await film(ctx, scene, budgets[n], tracker, caps[n])); } finally { tracker.stop(); }
    const style = await evaluate(page, STYLE).catch(() => ({ bg: 'rgb(255, 255, 255)', fg: 'rgb(17, 17, 17)', accent: 'rgb(17, 17, 17)', font: 'sans-serif', heading: 'sans-serif', fonts: [], title: '' }));
    const assets = new Map(frames.map((f, i) => [`frame-${i}`, f.data])), fonts = [];
    for (const [i, font] of style.fonts.entries()) { const data = await evaluate(page, FONT(font.url)).catch(() => null); if (data) { assets.set(`font-${i}`, Buffer.from(data, 'base64')); fonts.push({ family: font.family, asset: `font-${i}`, descriptors: font.descriptors }); } }

    // Only what completed while it was filmed is shown. The cards take up the slack towards the window.
    const shown = scenes.filter(s => s.status === 'completed');
    // No change is cut to. A jump of the page is dissolved in over a fifth of a second, on top of the picture before it:
    // what an action brings up (the first paint after a click or a key, and whatever follows in that time: the new
    // state, an image that arrives), and a change that stands alone (a clock that ticks). A run of paints that nothing
    // was done to start is a movement the page itself animates (a scroll, a transition) and is shown as it was filmed.
    for (const s of shown) {
      const acts = s.events.filter(e => e.kind === 'act').map(e => e.t), all = s.frames;
      let until = -1, under = 0, since = 0;
      s.frames = all.map((f, k) => {
        if (k > 0 && f.t >= until && f.t - all[k - 1].t >= 0.05) {
          let end = k;
          while (end + 1 < all.length && all[end + 1].t - all[end].t < 0.1) end++;
          if (end - k < 3 || acts.some(a => f.t >= a && f.t - a < 0.15)) { until = f.t + SOFT; under = all[k - 1].i; since = f.t; }
        }
        return f.t < until ? { ...f, soft: SOFT, since, under } : { ...f, soft: 0 };
      });
    }
    const filmed = shown.reduce((a, s) => a + s.dur, 0);
    const report = { nomi: 1, kind: 'video', created: new Date().toISOString(), target, browser: browser.version.product, storyboard: board.scenes.map(s => s.flow.name), scenes: [], cards: [], captions: [], findings: [], notes: [] };
    if (process.env.NOMI_BROWSER_NO_SANDBOX === '1') report.notes.push('Browser sandbox was off (NOMI_BROWSER_NO_SANDBOX=1).');
    if (zoom > 1) report.notes.push(`The page is filmed at ${zoom} times its size (browser zoom): its content is a narrow column in a 1440 px view.`);
    if (!shown.length) {
      report.scenes = scenes.map(({ flow, status, failedStep, reason }) => ({ flow, status, failedStep, reason }));
      report.findings = scenes.map(s => ({ code: 'video.flow-failed', severity: 'S1', message: `flow "${s.flow}" stops at step ${s.failedStep} while being recorded: ${s.reason}`, value: s.flow }));
      report.notes.push('No video was written: no flow of the storyboard completed. Fix the product (nomi review <target>), then record again.');
      return { report, outDir: null };
    }
    // A product with little to show: the outro holds a little longer, so the video still reaches its shortest length.
    cards.cta += Math.min(2.5, Math.max(0, LIMITS.min + 0.8 - filmed - cards.hook - cards.problem - cards.cta));
    const proved = `Filmed from the running product · ${shown.length} of ${shown.length} flows passed`;
    const segments = [{ kind: 'hook', dur: cards.hook, text: board.hook }, ...(cards.problem ? [{ kind: 'problem', dur: cards.problem, text: board.problem }] : []),
      ...shown.map(s => ({ kind: 'scene', dur: s.dur, caption: s.caption, frames: s.frames, events: s.events })), { kind: 'cta', dur: cards.cta, text: board.cta, sub: proved }];
    let at = 0;
    for (const seg of segments) {
      if (seg.kind === 'scene') { const s = shown.find(x => x.frames === seg.frames); report.scenes.push({ flow: s.flow, status: s.status, caption: s.caption, start: at, end: at + seg.dur, still: stillest(s, at), consoleErrors: s.consoleErrors }); if (s.wowAt) report.posterAt = at + s.wowAt; }
      else report.cards.push({ kind: seg.kind, text: seg.text, start: at, end: at + seg.dur });
      at += seg.dur;
    }
    for (const s of scenes.filter(x => x.status !== 'completed')) {
      report.scenes.push({ flow: s.flow, status: 'failed', failedStep: s.failedStep, reason: s.reason });
      report.findings.push({ code: 'video.flow-failed', severity: 'S1', message: `flow "${s.flow}" stops at step ${s.failedStep} while being recorded (${s.reason}); it is not in the video`, value: s.flow });
    }
    const starts = report.scenes.filter(s => s.status === 'completed'), total = at, speed = Math.max(1.5, filmed / 12);
    // The sound follows the picture: where a click lands, a key is typed, a step saw what it expected, a scene begins.
    const heard = [{ kind: 'cut', at: cards.hook }, { kind: 'end', at: total - cards.cta + 0.1 }];
    for (const [n, s] of shown.entries()) {
      heard.push({ kind: 'cut', at: starts[n].start });
      for (const e of s.events) {
        const t = starts[n].start + e.t;
        if (e.kind === 'act' && e.click) heard.push({ kind: 'click', at: t });
        if (e.kind === 'keys') for (let k = 0; k < e.n; k++) heard.push({ kind: 'key', at: t + 0.02 + k * Math.round(KEY * 1000 / TICK) * TICK / 1000, n: k });
        if (e.kind === 'tick') heard.push({ kind: e.zoom ? 'wow' : 'tick', at: t });
        if (e.kind === 'mark' && e.zoom) heard.push({ kind: 'wow', at: t });
      }
    }
    const audio = opts['no-sound'] ? null : { bpm: tone.bpm, root: tone.root, reveal: starts[0].start, events: heard.sort((a, b) => a.at - b.at) };
    const spec = { fps: FPS, bitrate: 6e6, floor: 3e6, keyEvery: 2, style, title: style.title, fonts, segments, audio, poster: report.posterAt ?? starts[0].start + 1.5,
      sheet: [cards.hook - 0.5, cards.problem ? cards.hook + cards.problem - 0.5 : starts[0].start + 0.9, ...Array.from({ length: 5 }, (_, i) => starts[0].start + filmed * (i + 0.5) / 5), total - 0.4],
      preview: { ms: 125, times: starts.flatMap(s => Array.from({ length: Math.floor((s.end - s.start) / (0.125 * speed)) }, (_, i) => s.start + i * 0.125 * speed)) } };
    report.notes.push('The video shows only flows that completed while they were filmed, in the product\'s own time: nothing is cut or sped up.', 'sheet.png shows eight moments of the video with their times. Open it and poster.png before describing the video.');
    return { report: await produce(browser, spec, assets, outDir, report), outDir };
  } finally { try { await browser?.close(); } finally { await server?.close(); } }
}

// A composed video: a trailer written as one HTML page of 1920x1080, rendered frame by frame under the page's clock.
// The page says how long it runs (<html data-duration="22">), which moment is its poster (data-poster), its tone
// (data-tone) and, in window.nomiVideo.cues, where its sounds fall. All its motion starts at time 0: CSS animations are
// rewound when rendering starts, and motion driven by script goes in window.nomiVideo.start().
// How such a video is planned (hook first, the product's own markup animated, items arriving one by one, text held for
// its reading time, every frame a function of time) follows the brag skills by Shunit Haviv Hakimi (MIT).
export async function compose(source, opts = {}) {
  if (!source) throw new Error('brandvid compose needs the composition: an HTML file');
  const cwd = opts.cwd || process.cwd(), file = path.resolve(cwd, source);
  if (!fs.existsSync(file) || !/\.html?$/i.test(file)) throw new Error(`no composition at ${path.relative(cwd, file)}: it is one HTML file (modules/brandvid.md says what goes in it)`);
  const root = path.dirname(file), outDir = path.resolve(cwd, opts.out || path.join(stateDir(cwd), 'video'));
  let server, browser;
  try {
    server = await serve(root); browser = await launchBrowser();
    const page = browser.page, frames = [], tracker = track(page, true);
    await page.send('Page.enable'); await page.send('Network.enable'); await page.send('Runtime.enable');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await page.send('Emulation.setScrollbarsHidden', { hidden: true }).catch(() => {});
    await settle(page, 2500, async () => { await page.send('Page.navigate', { url: new URL(path.relative(root, file).split(path.sep).join('/'), server.url).href }); });
    await evaluate(page, 'document.fonts.ready.then(() => 0)').catch(() => {});
    const said = await evaluate(page, `(() => { const r = document.documentElement.dataset, v = window.nomiVideo || {}; return { duration: Number(v.duration ?? r.duration), poster: Number(v.poster ?? r.poster), tone: String(v.tone ?? r.tone ?? 'default'), fps: Number(v.fps ?? r.fps) === 30 ? 30 : ${COMPOSED}, music: v.music && typeof v.music === 'object' ? { style: String(v.music.style || ''), bpm: Number(v.music.bpm) || 0, root: Number(v.music.root) || 0 } : null, cues: Array.isArray(v.cues) ? v.cues.filter(c => c && typeof c.at === 'number' && typeof c.kind === 'string').slice(0, 200) : [], title: document.title, size: [innerWidth, document.documentElement.scrollWidth, document.documentElement.scrollHeight] }; })()`);
    if (!(said.duration >= LIMITS.min && said.duration <= LIMITS.max)) throw new Error(`the composition says how long it runs, ${LIMITS.min} to ${LIMITS.max} seconds: <html data-duration="22">`);
    const tone = TONES[said.tone] || TONES.default, dur = said.duration, clock = filmClock(page, frames, 1000 / said.fps);
    // Time 0: every animation is rewound, the clock is held, and the page is told to begin.
    await evaluate(page, 'for (const a of document.getAnimations()) a.currentTime = 0; window.__nomiClock.hold().then(() => { document.documentElement.classList.add("play"); try { if (window.nomiVideo && typeof window.nomiVideo.start === "function") window.nomiVideo.start(); } catch (error) { window.__nomiStartError = String(error && error.message || error); } return 0; })');
    await clock.shoot();
    await clock.wait(dur * 1000);
    const { errors } = tracker.take(); tracker.stop();
    const startError = await evaluate(page, "window.__nomiStartError || null").catch(() => null);
    if (startError) errors.unshift(startError);
    // The pictures the page shows: a trailer introduces a product, so the product's own screens must be in it.
    const pictures = await evaluate(page, `Promise.all([...new Set([...[...document.images].map(i => i.currentSrc), ...[...document.querySelectorAll('*')].flatMap(e => [...getComputedStyle(e).backgroundImage.matchAll(/url\\("?([^")]+)"?\\)/g)].map(m => m[1]))].filter(u => u && u.startsWith(location.origin)))].map(u => new Promise(done => { const i = new Image(); i.onload = () => done({ file: decodeURIComponent(new URL(u).pathname.slice(1)), width: i.naturalWidth, height: i.naturalHeight }); i.onerror = () => done(null); i.src = u; })))`).then(list => list.filter(Boolean)).catch(() => []);
    const assets = new Map(frames.map((f, i) => [`frame-${i}`, f.data])), kinds = new Set(['click', 'key', 'tick', 'wow', 'cut', 'end']);
    const report = { nomi: 1, kind: 'video', composed: true, created: new Date().toISOString(), target: path.relative(cwd, file).split(path.sep).join('/'), browser: browser.version.product, pictures, scriptErrors: [...new Set(errors)].slice(0, 3), storyboard: [], scenes: [], cards: [], captions: [], findings: [], notes: [] };
    const poster = said.poster > 0 && said.poster < dur ? said.poster : dur * 0.6, speed = Math.max(1.5, dur / 12);
    const audio = opts['no-sound'] ? null : { style: said.music?.style || 'warm', bpm: said.music?.bpm >= 50 && said.music.bpm <= 160 ? said.music.bpm : tone.bpm, root: said.music?.root >= 40 && said.music.root <= 72 ? said.music.root : tone.root, reveal: 0.5, events: [...said.cues.filter(c => kinds.has(c.kind) && c.at >= 0 && c.at < dur).map(c => ({ kind: c.kind, at: c.at, n: 0 })), { kind: 'end', at: Math.max(0, dur - 2.9) }].sort((a, b) => a.at - b.at) };
    const spec = { fps: said.fps, bitrate: 6e6, floor: 2e6, keyEvery: 2, whole: true, style: { bg: 'rgb(255, 255, 255)', fg: 'rgb(17, 17, 17)', accent: 'rgb(17, 17, 17)', font: 'sans-serif', heading: 'sans-serif' }, title: said.title, fonts: [],
      segments: [{ kind: 'film', dur, frames: frames.map((f, i) => ({ i, t: f.at / 1000 })) }], audio, poster,
      sheet: Array.from({ length: 8 }, (_, i) => dur * (i + 0.5) / 8), preview: { ms: 125, times: Array.from({ length: Math.floor(dur / (0.125 * speed)) }, (_, i) => i * 0.125 * speed) } };
    report.posterAt = poster;
    report.notes.push('A composed video: written as a page and rendered frame by frame. It is a trailer, not a recording of the product in use.', 'sheet.png shows eight moments of the video with their times. Open it and poster.png before describing the video.');
    return { report: await produce(browser, spec, assets, outDir, report), outDir };
  } finally { try { await browser?.close(); } finally { await server?.close(); } }
}

// Measures an existing video again, from its folder (video.json beside demo.mp4).
export async function checkVideo(dir) {
  const file = path.join(dir, 'video.json');
  if (!fs.existsSync(file)) throw new Error(`no video.json in ${dir}: record the video first with nomi brandvid <target>`);
  const report = JSON.parse(fs.readFileSync(file, 'utf8')), missing = ['file', 'poster', 'preview'].filter(k => !report[k] || !fs.existsSync(path.join(dir, report[k])));
  const findings = missing.map(k => ({ code: 'video.files', severity: 'S1', message: `the ${k === 'file' ? 'video' : k} file is missing from ${dir}` }));
  if (missing.includes('file')) return { report, findings };
  const video = fs.readFileSync(path.join(dir, report.file)), saved = new Map(), server = await stageServer(new Map([['video', video], ['preview', fs.readFileSync(path.join(dir, report.preview))]]), saved);
  let browser;
  try {
    browser = await launchBrowser();
    const stage = await openStage(browser, server.url), measured = await stage.run('inspect', '/a/video', report.captions.map(({ text, rect, start, end }) => ({ text, rect, start, end })), report.window || [0, 0, report.width, report.height]);
    const loop = await stage.run('frames', '/a/preview', 'image/webp').catch(() => ({ frames: 0 }));
    if (!(loop.frames > 1)) findings.push({ code: 'video.files', severity: 'S1', message: 'the preview is not an animated image the browser can play' });
    return { report, measured, findings: [...findings, ...videoFindings({ ...report, bytes: video.length }, measured)] };
  } finally { try { await browser?.close(); } finally { await server.close(); } }
}

export function videoText(report, outDir, cwd = process.cwd()) {
  const rel = name => path.relative(cwd, path.join(outDir, name)).split(path.sep).join('/'), lines = [];
  if (report.file) lines.push(`Video   ${rel(report.file)}  ${report.duration.toFixed(1)} s, ${report.width}x${report.height}, ${(report.bytes / 1e6).toFixed(1)} MB (H.264 MP4${report.audio ? `, sound ${report.audio.codec === 'opus' ? 'Opus' : 'AAC'}` : ', no sound'})`);
  if (report.poster) lines.push(`Preview ${rel(report.preview)}  ${report.previewSeconds.toFixed(0)} s loop, ${(report.previewBytes / 1e6).toFixed(1)} MB (animated image)`, `Poster  ${rel(report.poster)}`);
  if (report.composed) lines.push(`Composed from ${report.target}`);
  else lines.push('Scenes:', ...report.scenes.map(s => s.status === 'completed' ? `  ok   ${s.flow}: ${s.start.toFixed(1)}–${s.end.toFixed(1)} s` : `  FAIL ${s.flow}: step ${s.failedStep}, ${s.reason} (not shown)`));
  lines.push(...report.findings.map(f => `${f.severity} ${f.code}: ${f.message}`), ...report.notes.map(n => `Note: ${n}`));
  if (report.poster) lines.push('Open images:', `  ${path.join(outDir, report.sheet)}`, `  ${path.join(outDir, report.poster)}`);
  if (report.file) lines.push('In a README, from the repository itself (the preview plays; a click opens the video):', `  [![Demo](${rel(report.preview)})](${rel(report.file)})`, 'A player inside the README needs the file uploaded by hand: drag demo.mp4 into the README editor on the repository site and keep the link it inserts.');
  lines.push(report.findings.some(f => f.severity === 'S1') ? 'Check: FAILED. Fix what is listed and record again.' : 'Check: passed.');
  return lines;
}
