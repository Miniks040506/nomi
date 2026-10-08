// Flow playtest: runs a product's jobs as scripted steps in a real page and reports what happened to each one:
// completed or the step it stopped at, console errors, failed requests, and clicks that changed nothing.
import path from 'node:path';
import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { evaluate } from './cdp.mjs';
import { compose } from './compose.mjs';
import { shot, mouse } from './motion.mjs';

const ACTIONS = ['click', 'type', 'select', 'press-key', 'hover', 'focus', 'scroll', 'wait', 'expect'];
const STATES = ['visible', 'hidden', 'enabled', 'disabled', 'checked', 'unchecked'];
const KEYS = { Enter: 13, Tab: 9, Escape: 27, Backspace: 8, Delete: 46, Space: 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
// A flow clicks and submits for real, so "local" decides what it may touch: a file, a folder or a loopback server.
export const isLocal = url => !/^https?:\/\//i.test(url) || /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[\/?#]|$)/i.test(url);

// Flows come as a JSON list, or as the ```json block under "## Flows" of a plan (.nomi/plan.md): one list, written once.
export function parseFlows(text) {
  text = text.replace(/^﻿/, '');
  const section = /^## Flows\b[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1];
  const source = /^\s*\[/.test(text) ? text : section && /^```json[^\n]*\n([\s\S]*?)^```/m.exec(section)?.[1];
  if (typeof source !== 'string') throw new Error('flows: expected a JSON list of flows, or a plan with a ```json block under "## Flows"');
  let flows;
  try { flows = JSON.parse(source); } catch (error) { throw new Error(`flows are not valid JSON: ${error.message}`); }
  if (!Array.isArray(flows) || !flows.length || flows.length > 7) throw new Error('flows: a JSON array of 1–7 flows');
  const text1 = v => typeof v === 'string' && v.trim() ? v.trim() : undefined;
  return flows.map((flow, f) => {
    const name = text1(flow?.name);
    if (!name) throw new Error(`flow ${f + 1}: needs a "name"`);
    if (flows.findIndex(x => text1(x?.name) === name) !== f) throw new Error(`flow "${name}": the name is used twice`);
    if (flow.start !== undefined && (typeof flow.start !== 'string' || /^[a-z][a-z\d+.-]*:|^\/\//i.test(flow.start))) throw new Error(`flow "${name}": "start" is a page path on the target, not another site`);
    if (!Array.isArray(flow.steps) || !flow.steps.length || flow.steps.length > 12) throw new Error(`flow "${name}": needs 1–12 steps`);
    const steps = flow.steps.map((step, i) => {
      const at = `flow "${name}" step ${i + 1}`, bad = message => { throw new Error(`${at}: ${message}`); };
      if (!ACTIONS.includes(step?.do)) bad(`"do" must be one of ${ACTIONS.join(', ')}`);
      const target = text1(step.target), label = text1(step.name), located = target || label;
      if (['click', 'type', 'select', 'hover', 'focus'].includes(step.do) && !located) bad('needs "name" (the visible label or button text) or "target" (a CSS selector)');
      if (step.do === 'type' && typeof step.text !== 'string') bad('type needs "text"');
      if (step.do === 'select' && typeof step.value !== 'string') bad('select needs "value" (an option value or its label)');
      if (step.do === 'press-key' && !(Object.hasOwn(KEYS, step.key) || (typeof step.key === 'string' && step.key.length === 1))) bad(`"key" is one character or one of ${Object.keys(KEYS).join(', ')}`);
      if (step.do === 'wait' && !(step.ms >= 100 && step.ms <= 3000)) bad('wait needs "ms" from 100 to 3000');
      if (step.do === 'scroll' && !located && !(step.y >= 0)) bad('scroll needs "name", "target" or "y"');
      if (step.do === 'expect') {
        if (step.state !== undefined && !STATES.includes(step.state)) bad(`"state" must be one of ${STATES.join(', ')}`);
        const form = typeof step.url === 'string' || (typeof step.text === 'string' && [undefined, 'visible', 'hidden'].includes(step.state)) || (located && step.state && typeof step.text !== 'string');
        if (!form) bad('expect needs "text" (optionally with "state": "hidden"), "url", or a "name"/"target" with a "state"');
        if (step.ms !== undefined && !(step.ms >= 100 && step.ms <= 5000)) bad('expect waits "ms" from 100 to 5000');
      }
      const what = label ? `"${label}"` : target || '';
      const said = step.do === 'expect' ? (typeof step.url === 'string' ? `address has ${step.url}` : typeof step.text === 'string' ? `${what ? `${what} has ` : ''}"${step.text}"${step.state === 'hidden' ? ' gone' : ''}` : `${what} ${step.state}`)
        : step.do === 'type' ? `${what} = "${step.text}"` : step.do === 'select' ? `${what} = ${step.value}` : step.do === 'press-key' ? step.key : step.do === 'wait' ? `${step.ms} ms` : what || `${step.y}`;
      return { do: step.do, target, name: label, text: step.text, value: step.value, key: step.key, y: step.y, ms: step.ms, state: step.state, url: step.url, label: `${step.do} ${said}`.slice(0, 70) };
    });
    return { name, screen: text1(flow.screen), covers: text1(flow.covers), start: flow.start, steps };
  });
}

// Runs before the page's own scripts: counts DOM mutations, and finds controls the way a person names them.
export const HELPER = `(() => {
  if (window.__nomiFlow || window.top !== window) return;
  const f = window.__nomiFlow = { id: Math.random().toString(36).slice(2), n: 0, last: performance.now() };
  new MutationObserver(list => { f.n += list.length; f.last = performance.now(); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  // Timers of up to 3 s that a handler started: a click that answers later is not a dead click.
  const later = window.setTimeout, cancel = window.clearTimeout, pending = new Set();
  window.setTimeout = (fn, ms, ...rest) => { if (typeof fn !== 'function' || ms > 3000) return later(fn, ms, ...rest); const id = later(() => { pending.delete(id); fn(...rest); }, ms); pending.add(id); return id; };
  window.clearTimeout = id => { pending.delete(id); cancel(id); };
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h; };
  // there: laid out and able to take a click (a transparent input over its label counts). visible: a person can see it.
  f.there = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && e.checkVisibility({ checkVisibilityCSS: true }); };
  f.visible = e => f.there(e) && e.checkVisibility({ checkOpacity: true });
  f.find = l => {
    if (l.target) { const all = [...document.querySelectorAll(l.target)]; return all.find(f.there) || all[0] || null; }
    const want = norm(l.name);
    const names = e => [e.getAttribute('aria-label'), e.labels && [...e.labels].map(x => x.textContent).join(' '), e.placeholder, /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) ? (/^(submit|button|reset)$/.test(e.type) ? e.value : e.name) : e.textContent, e.title].map(norm).filter(Boolean);
    const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=radio], [role=switch], [role=option], [contenteditable=""], [contenteditable=true]')].filter(f.there);
    const labels = [...document.querySelectorAll('label')].filter(f.visible);
    const pick = (list, test) => list.find(e => names(e).some(test)), exact = n => n === want, part = n => n.includes(want);
    const hit = pick(controls, exact) || pick(labels, exact) || pick(controls, part) || pick(labels, part) || [...document.querySelectorAll('body *')].filter(e => norm(e.textContent) === want && f.visible(e)).pop() || null;
    return hit && hit.tagName === 'LABEL' && hit.control && f.there(hit.control) ? hit.control : hit;
  };
  // Form values are compared as a hash: what was typed never leaves the page.
  f.sig = () => ({ id: f.id, n: f.n, url: location.href, form: hash([...document.querySelectorAll('input, select, textarea')].map(e => /^(checkbox|radio)$/.test(e.type) ? e.checked : e.value).join('\\u0001')), scroll: scrollX + ',' + scrollY, timers: pending.size, quiet: performance.now() - f.last, ready: document.readyState === 'complete' });
  f.at = l => {
    const e = f.find(l); if (!e) return null; e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    // A checkbox or radio drawn by its label (the input itself clipped away) is clicked where a person clicks it.
    let r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), label = /^(checkbox|radio)$/.test(e.type) && top !== e && [...(e.labels || [])].find(f.visible);
    if (label) r = label.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), visible: f.there(e), disabled: e.matches(':disabled') || e.getAttribute('aria-disabled') === 'true', field: (/^(INPUT|SELECT|TEXTAREA|LABEL)$/.test(e.tagName) && !/^(submit|button|reset|image)$/.test(e.type)) || e.isContentEditable };
  };
  // "Click Saturday" also means choosing Saturday in a closed list.
  f.option = name => {
    const want = norm(name);
    for (const e of document.querySelectorAll('select')) {
      const o = f.visible(e) && !e.disabled && ([...e.options].find(o => norm(o.textContent) === want) || [...e.options].find(o => norm(o.textContent).includes(want)));
      if (o && !o.disabled) { e.value = o.value; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    }
    return false;
  };
  f.focus = l => { const e = f.find(l); if (e) e.focus(); return !!e; };
  // Text fields are selected so real typing replaces their content; pickers (date, time, range, colour) are set directly.
  f.fill = (l, text) => {
    const e = f.find(l); if (!e) return 'nothing on the page matches'; if (e.disabled || e.readOnly) return 'the field is not editable'; e.focus();
    if (e.isContentEditable) { getSelection().selectAllChildren(e); return ''; }
    if (e.tagName === 'TEXTAREA' || (e.tagName === 'INPUT' && /^(text|search|email|url|tel|password|number|)$/.test(e.getAttribute('type') || ''))) { e.select(); return ''; }
    if (e.tagName !== 'INPUT') return 'it is not a text field';
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, text); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return 'set';
  };
  f.choose = (l, value) => {
    const e = f.find(l); if (!e || e.tagName !== 'SELECT') return 'no select element matches';
    const o = [...e.options].find(o => o.value === value) || [...e.options].find(o => norm(o.textContent) === norm(value)); if (!o) return 'it has no option ' + value; if (e.disabled || o.disabled) return 'the option is disabled';
    e.value = o.value; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return '';
  };
  f.check = (x, said) => {
    if (typeof x.url === 'string') return location.href.includes(x.url) ? '' : 'the address is ' + location.pathname + location.search + location.hash;
    const located = x.target || x.name, e = located ? f.find(x) : null, shown = !!e && f.visible(e);
    if (typeof x.text === 'string') { const has = norm(located ? (shown ? (e.innerText || '') + ' ' + (e.value || '') : '') : document.body.innerText + ' ' + said).includes(norm(x.text)), want = x.state !== 'hidden'; return has === want ? '' : want ? 'that text is not ' + (located ? 'in the element' : 'on the page') : 'that text is still shown'; }
    const c = e && e.tagName === 'LABEL' && e.control ? e.control : e, off = !!c && (c.matches(':disabled') || c.getAttribute('aria-disabled') === 'true');
    const seen = shown || (!!e && f.there(e) && [...(e.labels || [])].some(f.visible)); // a transparent input is seen through its label
    const got = { visible: seen, hidden: !seen, enabled: seen && !off, disabled: off, checked: !!c && c.checked === true, unchecked: !!c && c.checked === false }[x.state];
    return got ? '' : e ? 'it is not ' + x.state : 'nothing on the page matches';
  };
})()`;

const call = (page, fn, ...args) => evaluate(page, `window.__nomiFlow.${fn}(${args.map(a => JSON.stringify(a ?? null)).join(', ')})`);
// null while a navigation is replacing the document
const sig = page => call(page, 'sig').catch(() => null);

// Everything the page does while a flow runs. On a local target a request that would change data on another site is refused.
function track(page, local) {
  const t = { inflight: new Set(), urls: new Map(), requests: 0, errors: [], failed: [], dialogs: [], blocked: [] };
  const listener = m => {
    if (m.sessionId !== page.sessionId) return;
    const p = m.params;
    if (m.method === 'Network.requestWillBeSent' && !['WebSocket', 'EventSource'].includes(p.type)) { t.inflight.add(p.requestId); t.urls.set(p.requestId, p.request.url); t.requests++; }
    else if (m.method === 'Network.responseReceived' && p.response.status >= 400 && !/\/favicon\.ico$/.test(p.response.url)) t.failed.push(`${p.response.status} ${p.response.url}`);
    else if (m.method === 'Network.loadingFinished') t.inflight.delete(p.requestId);
    else if (m.method === 'Network.loadingFailed') { t.inflight.delete(p.requestId); if (!p.canceled && !/BLOCKED_BY_CLIENT|ERR_ABORTED/.test(p.errorText)) t.failed.push(`${p.errorText} ${t.urls.get(p.requestId) || ''}`.trim()); }
    else if (m.method === 'Runtime.exceptionThrown') t.errors.push(String(p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0].slice(0, 200));
    else if (m.method === 'Runtime.consoleAPICalled' && p.type === 'error') t.errors.push(p.args.map(a => a.value ?? a.description ?? '').join(' ').split('\n')[0].slice(0, 200));
    else if (m.method === 'Page.javascriptDialogOpening') { t.dialogs.push(p.message); page.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); }
    else if (m.method === 'Fetch.requestPaused') {
      const refuse = !isLocal(p.request.url) && !['GET', 'HEAD', 'OPTIONS'].includes(p.request.method);
      if (refuse) t.blocked.push(`${p.request.method} ${p.request.url}`);
      page.send(refuse ? 'Fetch.failRequest' : 'Fetch.continueRequest', refuse ? { requestId: p.requestId, errorReason: 'BlockedByClient' } : { requestId: p.requestId }).catch(() => {});
    }
  };
  page.cdp.listeners.add(listener);
  t.take = () => { const taken = { errors: t.errors, failed: t.failed, dialogs: t.dialogs }; Object.assign(t, { errors: [], failed: [], dialogs: [] }); return taken; };
  t.stop = () => page.cdp.listeners.delete(listener);
  return t;
}

// Waits for the page to come to rest after an action and says whether anything changed. With `before` (a click), nothing
// changing for 600 ms with no timer of the page pending is the answer; otherwise it returns once loading, requests and
// DOM mutations have been quiet for 150 ms. Bounded by cap.
async function rest(page, t, before, cap = 2500) {
  const requests = t.requests, dialogs = t.dialogs.length, start = Date.now();
  for (let changed = !before; ; await delay(40)) {
    const s = await sig(page), elapsed = Date.now() - start;
    changed ||= !s || s.id !== before.id || s.n !== before.n || s.url !== before.url || s.form !== before.form || s.scroll !== before.scroll || t.requests !== requests || t.dialogs.length !== dialogs;
    if (elapsed >= cap || (changed ? s?.ready && !t.inflight.size && s.quiet >= 150 && elapsed >= 150 : elapsed >= 600 && !s.timers)) return changed;
  }
}
// A control may render a moment after the previous step: look for up to 1.5 s.
async function locate(page, where, ready = p => p) {
  for (const start = Date.now(); ; await delay(60)) {
    const p = await call(page, 'at', where).catch(() => null);
    if ((p && ready(p)) || Date.now() - start > 1500) return p;
  }
}

async function perform(page, step, t) {
  const where = { target: step.target, name: step.name }, located = step.target || step.name;
  const fail = message => { throw new Error(message); };
  if (step.do === 'wait') return void await delay(step.ms);
  if (step.do === 'expect') {
    for (const start = Date.now(); ; await delay(80)) {
      const miss = await call(page, 'check', step, t.dialogs.join(' ')).catch(() => 'the page did not answer');
      if (!miss) return;
      if (Date.now() - start > (step.ms ?? 2000)) fail(miss);
    }
  }
  if (step.do === 'press-key') {
    const text = step.key === 'Enter' ? '\r' : step.key === 'Space' ? ' ' : step.key.length === 1 ? step.key : undefined;
    const key = { key: step.key === 'Space' ? ' ' : step.key, code: step.key.length === 1 ? undefined : step.key, windowsVirtualKeyCode: KEYS[step.key] ?? step.key.toUpperCase().charCodeAt(0), text };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
    return void await rest(page, t);
  }
  if (step.do === 'scroll' && !located) return void await evaluate(page, `scrollTo({ top: ${Number(step.y)}, behavior: 'instant' })`);
  const p = await locate(page, where, p => step.do !== 'click' || (p.visible && !p.disabled));
  if (!p && step.do === 'click' && step.name && await call(page, 'option', step.name).catch(() => false)) return void await rest(page, t);
  if (!p) fail('nothing on the page matches');
  if (step.do === 'scroll') return;
  if (step.do === 'focus') return void await call(page, 'focus', where);
  if (step.do === 'select') { const miss = await call(page, 'choose', where, step.value); if (miss) fail(miss); return void await rest(page, t); }
  if (step.do === 'type') {
    const miss = await call(page, 'fill', where, step.text);
    if (miss && miss !== 'set') fail(miss);
    if (!miss) await (step.text ? page.send('Input.insertText', { text: step.text }) : page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 }));
    return void await rest(page, t);
  }
  if (!p.visible) fail('it is not visible');
  await mouse(page, 'mouseMoved', p);
  if (step.do === 'hover') return void await delay(120);
  if (p.disabled) fail('it is disabled');
  await delay(60); // hover handlers settle before the "before" state is read
  const before = await sig(page);
  await mouse(page, 'mousePressed', p); await mouse(page, 'mouseReleased', p);
  // Putting the caret in a field or ticking a box is the effect; only other clicks can be dead.
  return { dead: !(await rest(page, t, before)) && !p.field };
}

async function play(ctx, flow, index, t) {
  const { page, run } = ctx, started = Date.now(), steps = [], shots = [], labels = [];
  const snap = async label => { try { shots.push(await shot(page, path.join(run.dir, `flow-${index + 1}-step-${shots.length}.png`))); labels.push(label); } catch { /* a page mid-navigation has no frame; the next step shows it */ } };
  let reason = '';
  // Every flow starts from a clean visit: no cookies or stored state from the flow before it.
  await evaluate(page, 'try { sessionStorage.clear() } catch {}').catch(() => {});
  await page.send('Network.clearBrowserCookies').catch(() => {});
  await page.send('Storage.clearDataForOrigin', { origin: new URL(ctx.url).origin, storageTypes: 'all' }).catch(() => {});
  t.take();
  try {
    await ctx.settle(page, ctx.wait, async () => {
      const navigation = await page.send('Page.navigate', { url: new URL(flow.start || '', ctx.url).href });
      if (navigation.errorText) throw new Error(`navigate: ${navigation.errorText}`);
    });
  } catch (error) { reason = error.message; }
  await snap('start');
  for (const [i, step] of flow.steps.entries()) {
    if (reason) break;
    const began = Date.now();
    let dead = false;
    try { dead = Boolean((await perform(page, step, t))?.dead); } catch (error) { reason = error.message; }
    steps.push({ n: i + 1, label: step.label, ok: !reason, ms: Date.now() - began, ...(dead ? { dead } : {}) });
    if (step.do !== 'wait') await snap(`${i + 1}. ${step.label}${reason ? ' — FAILED' : dead ? ' — NO EFFECT' : ''}`);
  }
  const { errors, failed, dialogs } = t.take();
  return { name: flow.name, screen: flow.screen, covers: flow.covers, status: reason ? 'failed' : 'completed', failedStep: reason ? Math.max(1, steps.length) : null, reason, steps: flow.steps.length, ms: Date.now() - started,
    deadClicks: steps.filter(s => s.dead).map(s => ({ step: s.n, label: s.label })), consoleErrors: [...new Set(errors)], failedRequests: [...new Set(failed)], dialogs, timeline: steps, sheet: shots.length ? path.join(run.dir, `flow-${index + 1}.png`) : null, shots, labels };
}

export function flowFindings(flows) {
  const findings = [];
  for (const f of flows) {
    if (f.status === 'failed') findings.push({ code: 'flow.failed', severity: 'S1', node: f.name, value: f.failedStep, message: `stops at step ${f.failedStep} of ${f.steps} (${f.timeline.at(-1)?.label || 'opening the page'}): ${f.reason}` });
    for (const d of f.deadClicks) findings.push({ code: 'flow.dead-click', severity: 'S1', node: f.name, value: d.step, message: `step ${d.step} (${d.label}) changed nothing: no update, no request, no navigation` });
    if (f.consoleErrors.length) findings.push({ code: 'flow.console-error', severity: 'S2', node: f.name, value: f.consoleErrors.length, message: `${f.consoleErrors.length} console error(s), first: ${f.consoleErrors[0]}` });
    if (f.failedRequests.length) findings.push({ code: 'flow.failed-request', severity: 'S2', node: f.name, value: f.failedRequests.length, message: `${f.failedRequests.length} failed request(s), first: ${f.failedRequests[0]}` });
  }
  return findings;
}

export async function captureFlows(ctx) {
  const { page, viewport, flows, report } = ctx, local = isLocal(ctx.url);
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: HELPER });
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: viewport.width < 768 });
  if (local) await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  const t = track(page, local), results = [];
  try { for (const [i, flow] of flows.entries()) results.push(await play(ctx, flow, i, t)); } finally { t.stop(); }
  // Sheets are composed last: a new tab takes the foreground, and input sent to the page behind it never returns.
  const blank = await ctx.blank();
  for (const f of results) {
    if (f.sheet) fs.writeFileSync(f.sheet, Buffer.from(await compose(blank, f.shots, f.labels, { columns: 3, cell: 480, max: 24 }), 'base64'));
    delete f.shots; delete f.labels;
  }
  const done = results.filter(f => f.status === 'completed').length;
  report.viewport = `${viewport.width}x${viewport.height}`;
  report.flows = results;
  report.findings = flowFindings(results);
  report.overview = [`${report.viewport} flows: ${done} of ${results.length} completed`, ...results.map(f => f.status === 'completed' ? `  ok   ${f.name}: ${f.steps} steps, ${(f.ms / 1000).toFixed(1)} s` : `  FAIL ${f.name}: step ${f.failedStep} of ${f.steps}`)];
  // Failed flows first: the summary lists four images.
  report.images = [...results].sort((a, b) => (a.status === 'completed') - (b.status === 'completed')).map(f => f.sheet).filter(Boolean);
  if (t.blocked.length) report.notes.push(`Refused ${t.blocked.length} request(s) that would change data on another site (${t.blocked[0]}); flows only act on the local target.`);
  if (results.some(f => f.dialogs.length)) report.notes.push('Browser dialogs (alert, confirm) were accepted automatically; their text counts as shown.');
  report.notes.push('Each flow starts from a clean visit (no cookies or stored state).', 'A dead click is one after which the document, the address, form values and scroll position were unchanged and no request started; an effect that is only drawn on a canvas, played as sound or put on the clipboard is not seen.', 'Each sheet shows the page after every step. Open it before saying a flow works.');
}
