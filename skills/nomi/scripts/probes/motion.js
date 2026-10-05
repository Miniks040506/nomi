// Paste the entire expression into a browser console. No dependencies or lasting DOM changes.
(() => {
  const node = el => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    for (let e = el; e && e !== document.body && e.parentElement; e = e.parentElement) {
      parts.unshift(`${e.localName}:nth-child(${[...e.parentElement.children].indexOf(e) + 1})`);
    }
    return parts.length ? `body > ${parts.join(' > ')}` : 'body';
  };
  const unique = values => [...new Set(values)];
  const css = name => name.replace(/^css(?=[A-Z])/, '').replace(/[A-Z]/g, c => `-${c.toLowerCase()}`).replace(/^-/, '');
  const ms = text => text.split(',').map(v => Math.round(parseFloat(v) * (/ms\s*$/.test(v) ? 1 : 1000) * 10) / 10);
  const round = value => typeof value === 'number' ? Math.round(value * 10) / 10 : null;
  // `observe --motion` records every animation from navigation on; a console run only sees the ones alive now.
  const recorded = window.__nomiMotion;
  const list = recorded ? [...recorded.seen] : document.getAnimations().map(a => [a, { step: 0, start: null }]);
  const animations = list.slice(0, 300).map(([a, seen]) => {
    const effect = a.effect, timing = effect?.getTiming?.() ?? {}, computed = effect?.getComputedTiming?.() ?? {};
    let frames = [];
    try { frames = effect.getKeyframes(); } catch { /* effect without keyframes */ }
    const rate = a.playbackRate || 1;
    const start = seen.start ?? (typeof a.startTime === 'number' ? a.startTime : null);
    const finite = Number.isFinite(computed.endTime);
    return {
      kind: a instanceof CSSTransition ? 'transition' : a instanceof CSSAnimation ? 'animation' : 'script',
      name: a.animationName || a.transitionProperty || a.id || '',
      node: effect?.target ? node(effect.target) + (effect.pseudoElement || '') : null,
      properties: unique(frames.flatMap(f => Object.keys(f)).filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)).map(css)).sort(),
      duration: round(Number(timing.duration) || 0), delay: round(timing.delay || 0),
      iterations: Number.isFinite(timing.iterations) ? timing.iterations : 'infinite',
      // CSS animations carry their timing function on the keyframes; transitions and script animations on the effect.
      easing: timing.easing && timing.easing !== 'linear' ? timing.easing : frames[0]?.easing || 'linear',
      direction: timing.direction || 'normal', fill: timing.fill || 'none',
      timeline: a.timeline === document.timeline ? 'document' : a.timeline ? 'scroll' : null,
      start: round(start), end: finite && start !== null ? round(start + computed.endTime / rate) : null,
      step: seen.step,
    };
  });
  const elements = [...document.querySelectorAll('*')];
  const transitions = [];
  for (const el of elements.slice(0, 5000)) {
    const s = getComputedStyle(el), durations = ms(s.transitionDuration);
    if (!durations.some(d => d > 0)) continue;
    transitions.push({ node: node(el), properties: s.transitionProperty.split(',').map(p => p.trim()), durations, delays: ms(s.transitionDelay), easings: s.transitionTimingFunction.split(/,(?![^(]*\))/).map(e => e.trim()) });
  }
  let rules = 0;
  const count = list => { for (const rule of list) { if (rule.media && /prefers-reduced-motion/.test(rule.conditionText || rule.media.mediaText)) rules++; if (rule.cssRules) count(rule.cssRules); } };
  for (const sheet of document.styleSheets) { try { count(sheet.cssRules); } catch { /* cross-origin sheet */ } }
  const notes = ['Script-driven motion (requestAnimationFrame loops, canvas, video) is not in this inventory.', 'Declared transitions list what can move; they run only when a state changes.'];
  if (!recorded) notes.push('Console run: only animations alive now are listed, without start times.');
  if (list.length > 300) notes.push('Inventory limited to the first 300 animations.');
  if (elements.length > 5000) notes.push('Transition scan limited to the first 5000 elements.');
  return {
    animations, transitions,
    reducedMotion: { rules, active: matchMedia('(prefers-reduced-motion: reduce)').matches },
    longFrames: recorded ? recorded.frames.slice(0, 50) : [],
    notes,
  };
})()
