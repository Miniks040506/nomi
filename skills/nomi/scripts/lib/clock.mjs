// The product's clock while it is filmed. A page filmed in real time is filmed unevenly: frames arrive when the machine
// gets to them, and a busy machine films a slower product. So the page's time is taken over: it runs as usual until
// the recorder holds it, and from then on it moves only when the recorder says so, one frame at a time, and a picture
// is taken after every step. Every filmed frame is then the page at an exact time, whatever the machine did.
// What follows the clock: Date, performance.now, setTimeout, setInterval, requestAnimationFrame, CSS animations and
// transitions, element.animate, SVG animation. What does not: animated images, <video>, the browser's own smooth
// scrolling and anything timed outside the page (a server that answers later). Those run in real time, which while
// filming is faster than the clock.
// The method (take over the page's time functions, step them, take a picture per step) is that of timesnap and timeweb
// by Steve Tung (BSD-3-Clause); no code of them is here.
export const CLOCK = `(() => {
  if (window.__nomiClock || window.top !== window) return;
  const RealDate = Date, perf = performance, realNow = perf.now.bind(perf), realFrame = window.requestAnimationFrame.bind(window), realEvery = window.setInterval.bind(window);
  const base = realNow(), epoch = RealDate.now(), timers = new Map(), frames = new Map(), placed = new Map(), rested = new WeakSet();
  let t = 0, held = false, busy = false, seq = 0, last = base;
  perf.now = () => base + t;
  window.Date = new Proxy(RealDate, {
    construct: (target, args, as) => Reflect.construct(target, args.length ? args : [epoch + t], as),
    apply: target => new target(epoch + t).toString(),
    get: (target, key) => key === 'now' ? () => epoch + t : Reflect.get(target, key),
  });
  const add = (fn, ms, args, every) => { const id = ++seq; timers.set(id, { id, at: t + Math.max(0, Number(ms) || 0), fn, args, every }); return id; };
  window.setTimeout = (fn, ms, ...args) => add(fn, ms, args, 0);
  window.setInterval = (fn, ms, ...args) => add(fn, ms, args, Math.max(1, Number(ms) || 0));
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  window.requestAnimationFrame = fn => { const id = ++seq; frames.set(id, fn); return id; };
  window.cancelAnimationFrame = id => { frames.delete(id); };
  const run = (fn, args) => { try { if (typeof fn === 'function') fn.apply(window, args); else (0, eval)(String(fn)); } catch (error) { if (window.reportError) window.reportError(error); else console.error(error); } };
  // Between two callbacks promises settle, as they do between two tasks. A step stays one task all the same, so the
  // browser paints the page once per step, never half-way through one.
  const turn = async () => { for (let i = 0; i < 8; i++) await null; };
  // Can the picture have changed? Anything that ran or moved says so, and so do the two steps after it (an image
  // that finishes decoding, a font that arrives). A step in which nothing can have changed needs no picture.
  let dirty = 3;
  const touch = () => { dirty = 3; };
  new MutationObserver(touch).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  for (const type of ['load', 'error', 'scroll', 'input', 'change', 'toggle', 'selectionchange', 'focusin', 'focusout', 'resize']) window.addEventListener(type, touch, true);
  // Runs the timers due up to a time, in the order of their times; each sees the clock at its own time.
  async function due(to) {
    for (let guard = 0; guard < 2000; guard++) {
      let next = null;
      for (const timer of timers.values()) if (timer.at <= to && (!next || timer.at < next.at || (timer.at === next.at && timer.id < next.id))) next = timer;
      if (!next) break;
      t = Math.max(t, next.at);
      if (next.every) next.at += next.every; else timers.delete(next.id);
      run(next.fn, next.args); touch(); await turn();
    }
    t = to;
  }
  async function paint() { const now = perf.now(); for (const [id, fn] of [...frames]) { if (!frames.delete(id)) continue; run(fn, [now]); touch(); await turn(); } }
  // Animations do not read the page's clock, so they are held and put where the clock says. One met for the first
  // time while it runs began at \`since\`: at its start if it is new, where it stood if the page had it at rest.
  function place(since) {
    for (const a of document.getAnimations()) {
      if (a.timeline !== document.timeline) continue;
      let p = placed.get(a);
      if (!p) {
        if (a.playState !== 'running') { rested.add(a); continue; }
        p = { at: since, from: since === null || rested.has(a) ? a.currentTime || 0 : 0, rate: a.playbackRate || 1 };
        if (since === null) p.at = t;
        placed.set(a, p); a.pause();
      }
      const want = p.from + (t - p.at) * p.rate, end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      try { if (want >= end) { placed.delete(a); a.currentTime = end; a.finish(); touch(); } else { a.currentTime = want; const now = a.effect ? a.effect.getComputedTiming().progress : want; if (now !== p.seen) { p.seen = now; touch(); } } } catch { placed.delete(a); }
    }
    for (const svg of document.querySelectorAll('svg')) if (svg.pauseAnimations && svg.ownerSVGElement === null) { if (!svg.animationsPaused()) svg.pauseAnimations(); svg.setCurrentTime(t / 1000); }
  }
  // Until it is held the clock follows real time, so the page loads and behaves as it always does.
  realEvery(() => { if (held || busy) return; const now = realNow(), to = t + now - last; last = now; busy = true; due(to).finally(() => { busy = false; }); }, 4);
  realFrame(function loop() { if (!held) { if (!busy) { busy = true; paint().finally(() => { busy = false; }); } realFrame(loop); } });
  window.__nomiClock = {
    get time() { return t; },
    // From here on time moves only in steps.
    async hold() { if (held) return; held = true; while (busy) await turn(); place(null); },
    // One step: what an action since the last step started is met first, then the timers, the frame callbacks and the
    // animations. Answers whether a picture is needed; "acted" says something was done to the page from outside.
    async step(ms, acted) { await this.hold(); if (acted) touch(); const before = t; place(before); await due(t + ms); await paint(); place(t); await turn(); return dirty-- > 0; },
  };
})()`;
// The caret of a text field blinks on the browser's own time: left alone it would flicker at the pace of filming.
export const CARET = `(() => { const add = () => { const s = document.createElement('style'); s.textContent = '* { caret-animation: manual !important }'; (document.head || document.documentElement).append(s); }; if (document.documentElement) add(); else document.addEventListener('readystatechange', add, { once: true }); })()`;
