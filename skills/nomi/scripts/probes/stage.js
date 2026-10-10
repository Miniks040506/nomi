// The stage: a blank loopback page where the demo video is composed, scored, encoded and measured. It never runs
// inside an observed page. Frames of the product arrive as files from the recorder's own loopback server; results are
// posted back to it. Picture and sound are encoded by the browser's own encoders (WebCodecs); the MP4 and animated WebP
// containers are written here. Every frame is a pure function of time.
// Structure of a launch video (hook, the product in use, a settled poster as frame 0, text held for its reading time,
// staggered transitions, sound in one key) follows the brag skill by Shunit Haviv Hakimi (MIT); no text or code of it is here.
(() => {
  const W = 1920, H = 1080;          // the picture
  const PW = 1440, PH = 810;         // the product's view, as it was filmed
  const K = 0.95, BAR = 40;          // the product is shown at 95% in a window with a title bar
  const WW = Math.round(PW * K), WH = Math.round(PH * K), WX = (W - WW) / 2, WY = 232;
  const LAP = 0.3;                   // how long two pictures share the screen when one hands over to the next
  const START = 0.15, MOVE = 1.2;    // the one move of the camera in a scene: when it begins and how long it takes, in seconds
  const SLIDE = 0.6;                 // the slide from one scene to the next
  const ease = p => p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const out = p => p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.pow(1 - p, 4);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mix = (a, b, p) => a + (b - a) * p;
  const rgb = c => { const m = /rgba?\(([^)]+)\)/.exec(c); return m ? m[1].split(/[, /]+/).slice(0, 3).map(Number) : [17, 17, 17]; };
  const css = ([r, g, b], a = 1) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
  const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const blend = (a, b, p) => a.map((v, i) => mix(v, b[i], p));
  const post = (name, blob) => fetch(`/out/${name}`, { method: 'POST', body: blob }).then(r => { if (!r.ok) throw new Error(`could not save ${name}`); });
  // Reading time of a line: about 0.3 s a word, never under 1.2 s, counted from when the whole line is in.
  const words = text => text.trim().split(/\s+/);
  const settle = text => Math.max(1.2, 0.3 * words(text).length);

  // ---- drawing -------------------------------------------------------------------------------------------------
  let spec, look;
  // The few filmed frames in use at one moment (the one shown, the one it dissolves from, the page sliding away).
  const bitmaps = new Map(), forget = () => { for (const b of bitmaps.values()) b.close(); bitmaps.clear(); };
  async function frame(i) {
    let b = bitmaps.get(i);
    if (b) bitmaps.delete(i); else b = await createImageBitmap(await (await fetch(`/a/frame-${i}`)).blob());
    bitmaps.set(i, b);
    if (bitmaps.size > 5) { const [old] = bitmaps.keys(); bitmaps.get(old).close(); bitmaps.delete(old); }
    return b;
  }
  function wrap(c, text, width) {
    const rows = [];
    let row = '';
    for (const word of words(text)) { const next = row ? `${row} ${word}` : word; if (row && c.measureText(next).width > width) { rows.push(row); row = word; } else row = next; }
    return [...rows, row];
  }
  // The product's colours, made safe to set type in: text on the ground at 4.5:1 or better, an accent that shows.
  function palette(style) {
    const ground = rgb(style.bg), dark = lum(ground) < 0.4;
    let ink = rgb(style.fg); if (ratio(ink, ground) < 4.5) ink = dark ? [250, 250, 250] : [17, 17, 17];
    let accent = rgb(style.accent); if (ratio(accent, ground) < 2.2) accent = ink;
    return { ground, ink, accent, dark, soft: blend(ground, ink, 0.62), stage: blend(ground, accent, dark ? 0.1 : 0.06), onAccent: ratio(accent, [255, 255, 255]) >= 3 ? [255, 255, 255] : [17, 17, 17] };
  }
  // The ground of every frame: the product's own background with two slow lights in its accent colour.
  function ground(c, T, quiet) {
    c.fillStyle = css(look.stage); c.fillRect(0, 0, W, H);
    const t = quiet ? 0 : T;
    for (const [x, y, r, a] of [[W * 0.18 + Math.sin(t * 0.21) * 90, H * 0.2 + Math.cos(t * 0.17) * 60, 760, 0.2], [W * 0.86 + Math.cos(t * 0.19) * 110, H * 0.92 + Math.sin(t * 0.23) * 70, 900, 0.16]]) {
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, css(look.accent, a)); g.addColorStop(1, css(look.accent, 0));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
  }
  // A line set word by word: each word rises in, the line then holds. Returns the box it occupies.
  function type(c, text, { x = W / 2, y, size, weight = 700, family = spec.style.heading, color = look.ink, t, gap = 0.06, width = W * 0.8, leave = Infinity, quiet, way = 'rise' }) {
    let rows;
    do { c.font = `${weight} ${size}px ${family}`; rows = wrap(c, text, width); size -= 4; } while (rows.length > 3 && size > 36);
    size += 4; c.font = `${weight} ${size}px ${family}`;
    const line = size * 1.16, top = y - (rows.length - 1) * line / 2, gone = quiet ? 0 : out((t - leave) / 0.22);
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = css(color);
    let n = 0, widest = 0;
    rows.forEach((row, i) => {
      const total = c.measureText(row).width; widest = Math.max(widest, total);
      let at = x - total / 2;
      for (const word of row.split(' ')) {
        const p = quiet ? 1 : out((t - n * gap) / 0.34), base = top + i * line - gone * 18;
        c.globalAlpha = p * (1 - gone);
        if (way === 'slide') c.fillText(word, at - (1 - p) * size * 0.7, base);
        else if (way === 'grow') { const w = c.measureText(word).width, s = 0.82 + 0.18 * p; c.save(); c.translate(at + w / 2, base); c.scale(s, s); c.fillText(word, -w / 2, 0); c.restore(); }
        else c.fillText(word, at, base + (1 - p) * size * 0.45);
        at += c.measureText(`${word} `).width; n++;
      }
    });
    c.globalAlpha = 1;
    return { rect: [Math.round(x - widest / 2), Math.round(top - line / 2), Math.round(widest), Math.round(rows.length * line)], settled: (n - 1) * gap + 0.34, size, rows: rows.length };
  }
  // Where the pointer is at time t, in the product's own pixels. It leaves for the next target in good time, slowly at
  // first, on a slight arc, and arrives when that click happens; with nowhere to go it rests.
  function pointer(scene, t) {
    scene.stops ||= (() => {
      const stops = [{ x: PW * 0.55, y: PH * 0.72, at: 0, from: 0 }];
      for (const e of scene.events) if (e.kind === 'aim') stops.push({ x: e.x, y: e.y, at: e.t + e.g });
      for (let i = 1; i < stops.length; i++) { const way = Math.hypot(stops[i].x - stops[i - 1].x, stops[i].y - stops[i - 1].y); stops[i].way = way; stops[i].from = Math.max(stops[i - 1].at + 0.1, stops[i].at - clamp(0.45 + way / 1500, 0.5, 1.1)); }
      return stops;
    })();
    const k = scene.stops.findIndex(s => s.at >= t), to = scene.stops[k < 0 ? scene.stops.length - 1 : k], from = k > 0 ? scene.stops[k - 1] : to;
    const p = k > 0 ? clamp((t - to.from) / (to.at - to.from), 0, 1) : 1, q = p * p * p * (10 - 15 * p + 6 * p * p); // least jerk: no sudden start, no sudden stop
    return { x: mix(from.x, to.x, q), y: mix(from.y, to.y, q) - Math.sin(q * Math.PI) * Math.min(36, (to.way || 0) * 0.07) * (k % 2 ? 1 : -0.6) };
  }
  // The camera of a scene at time t, in the product's own pixels: which place it looks at and how close. It holds.
  // A scene has one framing: everything the scene acts on and looks at, with air around it. When that is clearly less
  // than the whole page the camera goes there once, as the scene opens and before anything is done, in one eased move, and stays.
  // It follows nothing and never goes out and in again: a picture that keeps zooming is tiring to watch.
  // (The camera rules of the Hyperframes animation pack: one or two moves a scene, 1 to 2 s each, eased in and out,
  // no overshoot, a hold of a second or more after a move.)
  function camera(scene, t) {
    scene.shot ||= (() => {
      const seen = scene.events.filter(e => e.kind === 'aim' || e.kind === 'see' || e.kind === 'mark');
      if (!seen.length) return { z: 1, x: PW / 2, y: PH / 2, at: START };
      const x0 = Math.min(...seen.map(e => e.x - e.w / 2)), x1 = Math.max(...seen.map(e => e.x + e.w / 2)), y0 = Math.min(...seen.map(e => e.y - e.h / 2)), y1 = Math.max(...seen.map(e => e.y + e.h / 2));
      // Air: a sixth of the view on every side. A framing hardly closer than the whole page is not worth a move.
      let z = Math.min(PW / (x1 - x0 + PW / 3), PH / (y1 - y0 + PH / 3), 1.35);
      if (z < 1.1) z = 1;
      return { z, x: clamp((x0 + x1) / 2, PW / (2 * z), PW - PW / (2 * z)), y: clamp((y0 + y1) / 2, PH / (2 * z), PH - PH / (2 * z)), at: START };
    })();
    const s = scene.shot, p = clamp((t - s.at) / MOVE, 0, 1), q = p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2;
    return { z: mix(1, s.z, q), x: mix(PW / 2, s.x, q), y: mix(PH / 2, s.y, q) };
  }
  // The filmed page of a scene at time t, under its camera, inside the window at (x, y) and moved sideways by dx.
  async function page(c, scene, t, x, y, dx, alpha, cursor) {
    const k = Math.max(0, scene.frames.findLastIndex(f => f.t <= t)), shown = scene.frames[k], cam = camera(scene, t);
    // A jump of the page comes in over a fifth of a second, on top of the picture before it.
    const fresh = shown.soft ? ease((t - shown.since) / shown.soft) : 1, under = fresh < 1 ? await frame(shown.under) : null, image = await frame(shown.i);
    c.save();
    c.translate(x + dx + WW / 2, y + BAR + WH / 2); c.scale(K * cam.z, K * cam.z); c.translate(-cam.x, -cam.y);
    c.imageSmoothingQuality = 'high';
    if (under) { c.drawImage(under, 0, 0, PW, PH); c.globalAlpha = alpha * fresh; }
    c.drawImage(image, 0, 0, PW, PH); c.globalAlpha = alpha;
    for (const e of scene.events) { // a quiet ripple where a click landed
      if (e.kind !== 'act' || !e.click || t < e.t || t > e.t + 0.8) continue;
      for (const late of [0, 0.09]) { const p = (t - e.t - late) / 0.65; if (p <= 0 || p >= 1) continue; c.globalAlpha = alpha * 0.5 * (1 - p); c.strokeStyle = css(look.dark ? [255, 255, 255] : [20, 20, 20]); c.lineWidth = 2.5 / (K * cam.z); c.beginPath(); c.arc(e.x, e.y, 7 + 30 * (1 - Math.pow(1 - p, 3)), 0, 7); c.stroke(); }
      c.globalAlpha = alpha;
    }
    if (cursor) {
      const at = pointer(scene, t), press = scene.events.findLast(e => e.kind === 'act' && e.click && e.t <= t && t < e.t + 0.16), s = (press ? 0.86 : 1) * 1.5 / (K * cam.z);
      c.translate(at.x, at.y); c.scale(s, s); c.shadowColor = 'rgba(0, 0, 0, .35)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
      c.fillStyle = '#111'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 25); c.lineTo(6.5, 19); c.lineTo(11, 29); c.lineTo(15, 27); c.lineTo(10.5, 17.5); c.lineTo(19, 17.5); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  }
  // The product, in its window. `enter` 0..1 raises the window in; `leave` 0..1 dips it out; `from` is the scene
  // before, whose page slides away while this one slides in.
  async function product(c, scene, t, enter, leave, quiet, from) {
    const rise = (1 - enter) * 90 + leave * 30, alpha = enter * (1 - leave), x = WX, y = WY + rise, r = 16;
    if (alpha <= 0) return;
    c.save(); c.globalAlpha = alpha;
    const size = 1 - (1 - enter) * 0.05 - leave * 0.03;
    c.translate(W / 2, y + (WH + BAR) / 2); c.scale(size, size); c.translate(-W / 2, -(y + (WH + BAR) / 2));
    c.shadowColor = `rgba(0, 0, 0, ${look.dark ? 0.55 : 0.22})`; c.shadowBlur = 90; c.shadowOffsetY = 34;
    c.fillStyle = css(look.ground); c.beginPath(); c.roundRect(x, y, WW, WH + BAR, r); c.fill();
    c.shadowColor = 'transparent';
    c.beginPath(); c.roundRect(x, y, WW, WH + BAR, r); c.clip();
    // Title bar: three dots, the product's title, and on the right what the last expect step saw.
    c.fillStyle = css(blend(look.ground, look.ink, 0.07)); c.fillRect(x, y, WW, BAR);
    for (const i of [0, 1, 2]) { c.fillStyle = css(look.ink, 0.22); c.beginPath(); c.arc(x + 24 + i * 20, y + BAR / 2, 6, 0, 7); c.fill(); }
    c.font = `500 17px ${spec.style.font}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = css(look.ink, 0.6); c.fillText(spec.title || '', x + WW / 2, y + BAR / 2 + 1, WW * 0.5);
    const tick = scene.events.findLast(e => e.kind === 'tick' && e.t <= t && t < e.t + 1.7);
    if (tick) {
      const p = quiet ? 1 : Math.min(out((t - tick.t) / 0.28), out((tick.t + 1.7 - t) / 0.25)), label = `\u2713 ${tick.text}`;
      c.font = `600 16px ${spec.style.font}`; const w = Math.min(WW * 0.36, c.measureText(label).width + 26);
      c.globalAlpha = alpha * p; c.fillStyle = css(look.accent); c.beginPath(); c.roundRect(x + WW - 12 - w + (1 - p) * 24, y + 6, w, BAR - 12, 14); c.fill();
      c.fillStyle = css(look.onAccent); c.fillText(label, x + WW - 12 - w / 2 + (1 - p) * 24, y + BAR / 2 + 1, w - 20); c.globalAlpha = alpha;
    }
    c.beginPath(); c.rect(x, y + BAR, WW, WH); c.clip();
    const slide = from && !quiet ? ease(t / SLIDE) : 1;
    if (slide < 1) c.filter = `blur(${(Math.sin(slide * Math.PI) * 5).toFixed(1)}px)`;
    if (slide < 1) await page(c, from, from.dur, x, y, -slide * WW, alpha, false);
    await page(c, scene, t, x, y, (1 - slide) * WW, alpha * (from || quiet ? 1 : clamp((enter - 0.45) / 0.55, 0, 1)), slide >= 1);
    c.filter = 'none';
    c.restore();
  }
  async function drawScene(c, seg, t, quiet) {
    const at = spec.segments.indexOf(seg), before = spec.segments[at - 1], after = spec.segments[at + 1];
    const enter = quiet || before?.kind === 'scene' ? 1 : out((t + LAP) / (LAP + 0.45)), leave = quiet || after?.kind === 'scene' ? 0 : ease((t - (seg.dur - LAP)) / (2 * LAP));
    await product(c, seg, t, enter, leave, quiet, before?.kind === 'scene' ? before : null);
    // Which scene of how many: small marks above the caption.
    // Which scene of how many, and how far into it: one bar a scene, filling as the scene plays.
    for (let i = 0; i < spec.scenes; i++) {
      const x0 = W / 2 - spec.scenes * 36 + i * 72 + 6, done = i < seg.n ? 1 : i === seg.n ? clamp(t / seg.dur, 0, 1) : 0;
      c.fillStyle = css(look.ink, 0.16); c.beginPath(); c.roundRect(x0, 46, 60, 6, 3); c.fill();
      if (done > 0) { c.fillStyle = css(look.accent); c.beginPath(); c.roundRect(x0, 46, Math.max(6, 60 * done), 6, 3); c.fill(); }
    }
    return type(c, seg.caption, { y: 138, size: 58, t: t - 0.08, gap: 0.045, leave: seg.dur - 0.25, quiet, way: ['rise', 'slide', 'grow'][seg.n % 3] }).rect;
  }
  async function drawCard(c, card, t, quiet) {
    const leave = card.dur - 0.3, at = spec.segments.indexOf(card), before = spec.segments[at - 1], after = spec.segments[at + 1];
    // The hand-over: the product is already rising in under a line that leaves, and still going under the outro.
    if (!quiet && after?.kind === 'scene' && t > card.dur - LAP) await product(c, after, 0, out((t - (card.dur - LAP)) / (LAP + 0.45)), 0, false, null);
    if (!quiet && before?.kind === 'scene' && t < LAP) await product(c, before, before.dur, 1, ease((t + LAP) / (2 * LAP)), false, null);
    return cardText(c, card, t, quiet, leave);
  }
  function cardText(c, card, t, quiet, leave) {
    if (card.kind === 'cta') {
      // The outro: the product's name, what to do next, and what the video is: a recording of flows that passed.
      const name = type(c, spec.title || card.text, { y: H * 0.36, size: 104, t: t - 0.1, quiet });
      c.font = `600 34px ui-monospace, Consolas, monospace`;
      const w = Math.min(W * 0.8, c.measureText(card.text).width + 84), p = quiet ? 1 : out((t - 0.55) / 0.45), y = H * 0.36 + name.rows * name.size * 0.6 + 86;
      c.globalAlpha = p; c.fillStyle = css(look.accent); c.beginPath(); c.roundRect(W / 2 - w / 2, y - 38 + (1 - p) * 24, w, 76, 38); c.fill();
      c.fillStyle = css(look.onAccent); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(card.text, W / 2, y + 1 + (1 - p) * 24, w - 56);
      const q = quiet ? 1 : out((t - 1) / 0.5);
      c.globalAlpha = q; c.font = `500 26px ${spec.style.font}`; c.fillStyle = css(look.soft); c.fillText(card.sub, W / 2, y + 104);
      c.globalAlpha = 1;
      return null;
    }
    const big = card.kind === 'hook', line = type(c, card.text, { y: H / 2 - (big ? 10 : 0), size: big ? 112 : 72, t: t - 0.12, gap: big ? 0.07 : 0.05, leave, quiet, color: big ? look.ink : look.soft });
    const p = quiet ? 1 : out((t - line.settled) / 0.45) * (1 - out((t - leave) / 0.22));
    c.fillStyle = css(look.accent); c.fillRect(W / 2 - 70 * p, line.rect[1] + line.rect[3] + 26, 140 * p, 8);
    return null;
  }
  // Draws global time T. `quiet` leaves out entrances and drift: the preview repeats frames that are equal.
  async function draw(c, T, quiet = false) {
    let start = 0, seg = spec.segments[0];
    for (const s of spec.segments) { if (T < start + s.dur || s === spec.segments.at(-1)) { seg = s; break; } start += s.dur; }
    const t = clamp(T - start, 0, seg.dur);
    // A composed video: the page was rendered whole, frame by frame, and is shown as it is.
    if (seg.kind === 'film') { c.drawImage(await frame(seg.frames[Math.max(0, seg.frames.findLastIndex(f => f.t <= t))].i), 0, 0, W, H); return null; }
    ground(c, T, quiet);
    const rect = seg.kind === 'scene' ? await drawScene(c, seg, t, quiet) : await drawCard(c, seg, t, quiet);
    return rect && { rect, text: seg.caption, index: spec.segments.indexOf(seg) };
  }

  // ---- sound ---------------------------------------------------------------------------------------------------
  // One piece, written for this video's own timeline: a soft bed in one key, and effects in that key where things
  // happen on screen (a click, typing, a step that saw what it expected, a scene change). Rendered offline.
  async function score(duration) {
    const rate = 48000, ctx = new OfflineAudioContext(2, Math.ceil(duration * rate), rate), a = spec.audio;
    const master = ctx.createGain(), squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -16; squash.ratio.value = 3; squash.attack.value = 0.01; squash.release.value = 0.25;
    master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(0.9, 0.25); master.gain.setValueAtTime(0.9, Math.max(0.3, duration - 1.6)); master.gain.linearRampToValueAtTime(0, duration);
    master.connect(squash).connect(ctx.destination);
    const beat = 60 / a.bpm, bar = beat * 4, hz = n => 440 * Math.pow(2, (n - 69) / 12), root = a.root;
    const noise = ctx.createBuffer(1, rate, rate); { const d = noise.getChannelData(0); let seed = 7; for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; } }
    const tone = (at, f, len, gain, kind = 'sine', dest = master, attack = 0.005) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = kind; o.frequency.value = f; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + len); o.connect(g).connect(dest); o.start(at); o.stop(at + len + 0.02); return o; };
    const hiss = (at, len, gain, f, q = 1, kind = 'bandpass') => { const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; s.loop = true; b.type = kind; b.frequency.value = f; b.Q.value = q; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + Math.min(0.01, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, at + len); s.connect(b).connect(g).connect(master); s.start(at); s.stop(at + len + 0.02); return b; };
    // The bed, in the character the video asks for. Each is four chords of one key, a pad, a figure played over the
    // chord, and what keeps time under it.
    //   warm    a soft pad, a plucked figure with an echo, a light kick and hat           (the default)
    //   cafe    major sixths, a mellow bell figure with a little swing, a walking bass, brushes, no kick
    //   cinema  minor, a slow swelling pad, single low notes far apart, one deep beat a bar
    //   pulse   minor, a quick square-wave figure in sixteenths, a kick on every beat
    const STYLES = {
      warm: { chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]], pad: 'sawtooth', padGain: 0.026, open: 1500, steps: 8, figure: [0, 2, 1, 3, 2, 1, 3, 2], wave: 'triangle', gain: 0.05, len: 0.32, up: 12, swing: 0, kick: [0, 2], hat: 0.035, bass: 0 },
      cafe: { chords: [[0, 4, 7, 9], [5, 9, 12, 16], [2, 5, 9, 12], [-5, -1, 2, 5]], pad: 'triangle', padGain: 0.03, open: 2600, steps: 8, figure: [0, 2, 3, 2, 1, 3, 2, null], wave: 'sine', gain: 0.085, len: 0.5, up: 12, swing: 0.18, kick: [], hat: 0.05, bass: 0.13 },
      cinema: { chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -4, 0, 3], [-2, 2, 5, 9]], pad: 'sawtooth', padGain: 0.04, open: 900, steps: 4, figure: [0, null, 2, null], wave: 'sine', gain: 0.1, len: 1.6, up: 0, swing: 0, kick: [0], hat: 0, bass: 0.1 },
      pulse: { chords: [[0, 3, 7, 10], [0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 8]], pad: 'square', padGain: 0.011, open: 2200, steps: 16, figure: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2], wave: 'square', gain: 0.028, len: 0.11, up: 12, swing: 0, kick: [0, 1, 2, 3], hat: 0.03, bass: 0.12 },
    };
    const st = STYLES[a.style] || STYLES.warm, warm = ctx.createBiquadFilter(), echo = ctx.createDelay(1), back = ctx.createGain();
    warm.type = 'lowpass'; warm.frequency.setValueAtTime(st.open / 3, 0); warm.frequency.linearRampToValueAtTime(st.open, Math.min(duration, a.reveal + 1.5)); warm.connect(master);
    echo.delayTime.value = beat * 0.75; back.gain.value = 0.3; echo.connect(back).connect(echo); echo.connect(master);
    for (let n = 0; n * bar < duration; n++) {
      const at = n * bar, chord = st.chords[n % 4].map(s => root + s), step = bar / st.steps;
      for (const note of chord) for (const cents of [-6, 6]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = st.pad; o.frequency.value = hz(note); o.detune.value = cents; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(st.padGain, at + bar * 0.3); g.gain.linearRampToValueAtTime(0, at + bar * 1.05); o.connect(g).connect(warm); o.start(at); o.stop(at + bar * 1.06); }
      st.figure.forEach((k, i) => { const t = at + i * step + (i % 2 ? st.swing * step : 0); if (k !== null && t < duration - 0.2) tone(t, hz(chord[k] + st.up), st.len, st.gain, st.wave, echo); });
      for (let i = 0; i < 4; i++) {
        const t = at + i * beat;
        if (t < a.reveal || t > duration - 1.2) continue;
        if (st.kick.includes(i)) { const k = tone(t, 110, 0.22, 0.3); k.frequency.setValueAtTime(120, t); k.frequency.exponentialRampToValueAtTime(46, t + 0.14); }
        if (st.bass && i % 2 === 0) tone(t, hz(chord[i ? 2 : 0] - 24), beat * 1.6, st.bass);
        if (st.hat) hiss(t + beat / 2 + st.swing * beat / 2, 0.05, st.hat, 7000, 0.7, 'highpass');
      }
    }
    // Effects, at the moments of the picture.
    for (const given of a.events) {
      // A cue at the very start: its sound begins a moment before it, and time cannot be negative.
      const e = { ...given, at: Math.max(given.kind === "cut" ? 0.2 : 0.01, Number(given.at) || 0) };
      if (e.at >= duration - 0.05) continue;
      if (e.kind === 'click') { tone(e.at, 1500, 0.06, 0.09).frequency.exponentialRampToValueAtTime(700, e.at + 0.05); hiss(e.at, 0.03, 0.05, 3200, 2); }
      if (e.kind === 'key') hiss(e.at, 0.02, 0.028, 4200 + (e.n % 5) * 260, 3);
      if (e.kind === 'tick') { tone(e.at, hz(root + 28), 0.22, 0.07); tone(e.at + 0.09, hz(root + 31), 0.3, 0.07); }
      if (e.kind === 'wow') for (const [i, s] of [16, 19, 23, 28].entries()) tone(e.at + i * 0.07, hz(root + s), 0.7, 0.06, 'triangle', echo);
      if (e.kind === 'cut') { const b = hiss(e.at - 0.16, 0.42, 0.045, 600, 0.8); b.frequency.setValueAtTime(500, e.at - 0.16); b.frequency.exponentialRampToValueAtTime(5200, e.at + 0.2); }
      if (e.kind === 'end') for (const s of [0, 7, 12, 16, 19]) tone(e.at, hz(root + s), 2.6, 0.05, 'triangle', master, 0.04);
    }
    const buffer = await ctx.startRendering();
    // Brought to one level: the loudest moment just under full scale.
    let top = 0; for (const ch of [0, 1]) for (const v of buffer.getChannelData(ch)) if (Math.abs(v) > top) top = Math.abs(v);
    if (top > 0) for (const ch of [0, 1]) { const d = buffer.getChannelData(ch), k = 0.89 / top; for (let i = 0; i < d.length; i++) d[i] *= k; }
    let peak = 0, sum = 0; for (const ch of [0, 1]) { const d = buffer.getChannelData(ch); for (let i = 0; i < d.length; i += 4) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; } }
    return { buffer, peak: Math.round(peak * 1000) / 1000, rms: Math.round(Math.sqrt(sum / (buffer.length / 2)) * 1000) / 1000 };
  }
  async function encodeSound(buffer) {
    if (typeof AudioEncoder !== 'function') return null;
    for (const codec of ['mp4a.40.2', 'opus']) {
      const config = { codec, sampleRate: buffer.sampleRate, numberOfChannels: 2, bitrate: 128000 };
      if (!(await AudioEncoder.isConfigSupported(config).catch(() => ({}))).supported) continue;
      const samples = []; let description = null, failed = null;
      const encoder = new AudioEncoder({ output: (chunk, meta) => { const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); samples.push({ data, frames: Math.round((chunk.duration || 0) * buffer.sampleRate / 1e6) }); description ||= meta?.decoderConfig?.description && new Uint8Array(meta.decoderConfig.description); }, error: e => { failed = e.message; } });
      encoder.configure(config);
      for (let at = 0; at < buffer.length; at += 48000) { // a second at a time
        const n = Math.min(48000, buffer.length - at), data = new Float32Array(n * 2);
        data.set(buffer.getChannelData(0).subarray(at, at + n), 0); data.set(buffer.getChannelData(1).subarray(at, at + n), n);
        encoder.encode(new AudioData({ format: 'f32-planar', sampleRate: buffer.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(at * 1e6 / buffer.sampleRate), data }));
      }
      await encoder.flush(); encoder.close();
      if (failed || !samples.length) continue;
      const usual = codec === 'opus' ? 960 : 1024; for (const s of samples) s.frames ||= usual;
      return { codec, samples, description, rate: buffer.sampleRate };
    }
    return null;
  }

  // ---- containers ----------------------------------------------------------------------------------------------
  const u32 = n => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255], u16 = n => [n >> 8 & 255, n & 255], chars = s => [...s].map(ch => ch.charCodeAt(0));
  const box = (type, ...parts) => { const body = parts.flat(); return [...u32(body.length + 8), ...chars(type), ...body]; };
  const full = (type, version, flags, ...parts) => box(type, [version, ...u32(flags).slice(1)], ...parts);
  const runs = list => { const r = []; for (const v of list) { if (r.length && r.at(-1)[1] === v) r.at(-1)[0]++; else r.push([1, v]); } return r; };
  // One H.264 track and, when there is sound, one audio track; each track's samples in one chunk; the index before
  // the data so the file starts playing while it downloads.
  function mp4(video, config, fps, sound) {
    const scale = fps * 1000, total = video.length * 1000, matrix = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].flatMap(u32);
    const ftyp = box('ftyp', chars('isom'), u32(0x200), chars('isomiso2avc1mp41'));
    const track = (id, kind, name, duration, mediaScale, mediaDuration, header, entry, samples, deltas, keys, offset, dims = [0, 0]) => box('trak',
      full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(duration), Array(8).fill(0), u16(0), u16(0), u16(kind === 'soun' ? 0x100 : 0), u16(0), matrix, u32(dims[0] << 16), u32(dims[1] << 16)),
      box('mdia',
        full('mdhd', 0, 0, u32(0), u32(0), u32(mediaScale), u32(mediaDuration), u16(0x55c4), u16(0)),
        full('hdlr', 0, 0, u32(0), chars(kind), Array(12).fill(0), chars(name), [0]),
        box('minf', header, box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
          box('stbl',
            full('stsd', 0, 0, u32(1), entry),
            full('stts', 0, 0, u32(deltas.length), deltas.flatMap(([n, d]) => [...u32(n), ...u32(d)])),
            ...(keys ? [full('stss', 0, 0, u32(keys.length), keys.flatMap(u32))] : []),
            full('stsc', 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
            full('stsz', 0, 0, u32(0), u32(samples.length), samples.flatMap(s => u32(s.data.byteLength))),
            full('stco', 0, 0, u32(1), u32(offset))))));
    const size = list => list.reduce((a, s) => a + s.data.byteLength, 0), frames = sound ? sound.samples.reduce((a, s) => a + s.frames, 0) : 0;
    const audioEntry = () => {
      const head = [Array(6).fill(0), u16(1), Array(8).fill(0), u16(2), u16(16), u16(0), u16(0), u32(sound.rate << 16)];
      if (sound.codec === 'opus') { const d = sound.description, skip = d ? d[10] | d[11] << 8 : 312; return box('Opus', ...head, box('dOps', [0, 2], u16(skip), u32(sound.rate), u16(0), [0])); }
      const asc = [...(sound.description || [0x11, 0x90])], dec = [0x40, 0x15, 0, 0, 0, ...u32(128000), ...u32(128000), 0x05, asc.length, ...asc];
      return box('mp4a', ...head, full('esds', 0, 0, [0x03, dec.length + 8, 0, 2, 0, 0x04, dec.length, ...dec, 0x06, 1, 2]));
    };
    const moov = offset => box('moov',
      full('mvhd', 0, 0, u32(0), u32(0), u32(scale), u32(total), u32(0x10000), u16(0x100), Array(10).fill(0), matrix, Array(24).fill(0), u32(sound ? 3 : 2)),
      track(1, 'vide', 'VideoHandler', total, scale, total, full('vmhd', 0, 1, Array(8).fill(0)),
        box('avc1', Array(6).fill(0), u16(1), Array(16).fill(0), u16(W), u16(H), u32(0x480000), u32(0x480000), u32(0), u16(1), Array(32).fill(0), u16(24), u16(0xffff), box('avcC', [...config])),
        video, [[video.length, 1000]], video.flatMap((s, i) => s.key ? [i + 1] : []), offset, [W, H]),
      ...(sound ? [track(2, 'soun', 'SoundHandler', Math.round(frames / sound.rate * scale), sound.rate, frames, full('smhd', 0, 0, u16(0), u16(0)), audioEntry(), sound.samples, runs(sound.samples.map(s => s.frames)), null, offset + size(video))] : []));
    const data = size(video) + (sound ? size(sound.samples) : 0), index = moov(ftyp.length + moov(0).length + 8);
    return new Blob([new Uint8Array(ftyp), new Uint8Array(index), new Uint8Array([...u32(data + 8), ...chars('mdat')]), ...video.map(s => s.data), ...(sound ? sound.samples.map(s => s.data) : [])], { type: 'video/mp4' });
  }
  // An animated WebP from stills the browser encoded: each still's image chunks are wrapped in one animation frame.
  async function webp(stills, width, height) {
    const le = (n, bytes) => Array.from({ length: bytes }, (_, i) => n >> (8 * i) & 255);
    const chunk = (type, data) => [...chars(type), ...le(data.length, 4), ...data, ...(data.length & 1 ? [0] : [])];
    const body = [...chars('WEBP'), ...chunk('VP8X', [2, 0, 0, 0, ...le(width - 1, 3), ...le(height - 1, 3)]), ...chunk('ANIM', [0, 0, 0, 0, 0, 0])];
    const parts = [];
    for (const still of stills) {
      const bytes = new Uint8Array(await still.blob.arrayBuffer()), image = [];
      for (let at = 12; at + 8 <= bytes.length;) { const type = String.fromCharCode(...bytes.subarray(at, at + 4)), n = bytes[at + 4] | bytes[at + 5] << 8 | bytes[at + 6] << 16 | bytes[at + 7] << 24, end = at + 8 + n + (n & 1); if (['VP8 ', 'VP8L', 'ALPH'].includes(type)) image.push(bytes.subarray(at, end)); at = end; }
      const n = 16 + image.reduce((a, b) => a + b.length, 0);
      parts.push(new Uint8Array([...chars('ANMF'), ...le(n, 4), 0, 0, 0, 0, 0, 0, ...le(width - 1, 3), ...le(height - 1, 3), ...le(still.ms, 3), 2]), ...image);
    }
    const total = body.length + parts.reduce((a, p) => a + p.length, 0);
    return new Blob([new Uint8Array([...chars('RIFF'), ...le(total, 4), ...body]), ...parts], { type: 'image/webp' });
  }

  // ---- render --------------------------------------------------------------------------------------------------
  async function render(given) {
    spec = { floor: 0, keyEvery: 2, ...given }; forget(); look = palette(spec.style);
    for (const f of spec.fonts || []) try { const face = new FontFace(f.family, await (await fetch(`/a/${f.asset}`)).arrayBuffer(), f.descriptors || {}); await face.load(); document.fonts.add(face); } catch { /* the family falls back to the next one in the stack */ }
    spec.scenes = spec.segments.filter(s => s.kind === 'scene').length; spec.segments.filter(s => s.kind === 'scene').forEach((s, n) => { s.n = n; });
    const duration = spec.segments.reduce((a, x) => a + x.dur, 0), fps = spec.fps, count = Math.round(duration * fps);
    const canvas = new OffscreenCanvas(W, H), c = canvas.getContext('2d', { alpha: false });
    // Bits for a picture that is always in motion. As many as a file of under 10 MB allows (what a free account can
    // attach), and never fewer than keep text sharp while the camera moves.
    const bitrate = Math.round(Math.max(spec.floor, Math.min(spec.bitrate, 9.6e6 * 8 / duration - 140000)));
    // Baseline profile; level 4.2 carries 1920x1080 at 60 frames a second.
    const config = { codec: fps > 30 ? 'avc1.42002a' : 'avc1.420028', width: W, height: H, bitrate, framerate: fps, hardwareAcceleration: 'prefer-software', avc: { format: 'avc' } };
    const result = { duration: count / fps, width: W, height: H, fps, frames: count, captions: [], video: null, audio: null, window: spec.whole ? [0, 0, W, H] : [WX, WY + BAR, WW, WH] };
    const captions = new Map();
    const note = (shown, T) => { if (!shown) return; const cap = captions.get(shown.index) || { ...shown, start: T }; cap.end = T + 1 / fps; captions.set(shown.index, cap); };
    const each = async encode => { for (let i = 0; i < count; i++) { const T = i === 0 && !spec.whole ? spec.poster : i / fps, shown = await draw(c, T); if (i) note(shown, T); await encode?.(i); } };
    if (typeof VideoEncoder === 'function' && (await VideoEncoder.isConfigSupported(config)).supported) {
      const samples = []; let description = null, failed = null;
      const encoder = new VideoEncoder({ output: (chunk, meta) => { const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); samples.push({ data, key: chunk.type === 'key' }); description ||= meta?.decoderConfig?.description && new Uint8Array(meta.decoderConfig.description); }, error: e => { failed = e.message; } });
      encoder.configure(config);
      // Frame 0 is the poster, the settled moment the storyboard marks: it is what a page shows before the video plays.
      await each(async i => {
        const picture = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        encoder.encode(picture, { keyFrame: i % Math.round(fps * spec.keyEvery) === 0 || i === 1 }); picture.close();
        while (encoder.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
        if (failed) throw new Error(`video encoder: ${failed}`);
      });
      await encoder.flush(); encoder.close();
      if (failed || !description || samples.length !== count) throw new Error(`video encoder: ${failed || 'incomplete output'}`);
      let sound = null;
      if (spec.audio) try { const track = await score(result.duration); sound = await encodeSound(track.buffer); result.audio = sound ? { codec: sound.codec, peak: track.peak, rms: track.rms } : null; } catch (error) { result.audioError = error.message; }
      const file = mp4(samples, description, fps, sound);
      await post('demo.mp4', file); result.video = { bytes: file.size, codec: config.codec, bitrate };
      result.measured = await inspect(file, [...captions.values()], result.window);
      result.measured.fidelity = await faithful(samples, description, config.codec, fps, c, canvas);
    } else { await each(); result.noEncoder = true; }
    result.captions = [...captions.values()];
    await draw(c, spec.poster); await post('poster.png', await canvas.convertToBlob({ type: 'image/png' }));
    // Sheet: eight moments with their times, for a reader who cannot play a video.
    const sheet = new OffscreenCanvas(1280, 4 * 390), sc = sheet.getContext('2d'); sc.fillStyle = '#eee'; sc.fillRect(0, 0, sheet.width, sheet.height); sc.font = '16px sans-serif';
    for (const [n, T] of spec.sheet.entries()) { await draw(c, T); const x = n % 2 * 640, y = (n >> 1) * 390; sc.drawImage(canvas, x, y + 30, 640, 360); sc.fillStyle = '#111'; sc.fillText(`${T.toFixed(1)} s`, x + 8, y + 21); }
    await post('sheet.png', await sheet.convertToBlob({ type: 'image/png' }));
    // Preview: the scenes only, small and sped up, as an image that loops where a video cannot play.
    const small = new OffscreenCanvas(640, 360), pc = small.getContext('2d', { alpha: false }), stills = [];
    let last = null;
    for (const T of spec.preview.times) {
      await draw(c, T, true); pc.imageSmoothingQuality = 'high'; pc.drawImage(canvas, 0, 0, 640, 360);
      const blob = await small.convertToBlob({ type: 'image/webp', quality: 0.72 }), bytes = new Uint8Array(await blob.arrayBuffer());
      if (last && last.length === bytes.length && last.every((v, i) => v === bytes[i])) stills.at(-1).ms += spec.preview.ms; else stills.push({ blob, ms: spec.preview.ms });
      last = bytes;
    }
    const loop = await webp(stills, 640, 360);
    await post('preview.webp', loop); result.preview = { bytes: loop.size, frames: stills.length, seconds: spec.preview.times.length * spec.preview.ms / 1000 };
    forget();
    return result;
  }

  // ---- measure a finished video ---------------------------------------------------------------------------------
  // Plays the file in the browser's own player, five samples a second: mean brightness of the picture, change inside
  // the product's window from the sample before, the contrast of the pixels where each caption sits, and the sound.
  async function inspect(source, captions = [], region = [0, 0, W, H]) {
    const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
    const video = document.createElement('video'); video.muted = true; video.preload = 'auto'; video.src = URL.createObjectURL(blob);
    await new Promise((done, fail) => { video.onloadeddata = done; video.onerror = () => fail(new Error('the browser cannot play this file')); });
    // The frame of a time reaches the player a moment after "seeked": drawn at once, the picture can be the one of the
    // seek before. So the frame is asked for before the seek and taken when it is presented.
    const seek = t => new Promise(done => {
      let seeked = false, presented = false, timer = null;
      const end = () => { clearTimeout(timer); done(); };
      video.requestVideoFrameCallback(() => { presented = true; if (seeked) end(); });
      video.onseeked = () => { seeked = true; if (presented) end(); else timer = setTimeout(end, 300); };
      video.currentTime = t;
    });
    const k = video.videoWidth / W, small = new OffscreenCanvas(160, 90), sc = small.getContext('2d', { willReadFrequently: true }), samples = [];
    let before = null;
    for (let t = 0.2; t < video.duration - 0.01; t += 0.2) { // the first frame is the poster
      await seek(t);
      sc.drawImage(video, 0, 0, 160, 90); const whole = sc.getImageData(0, 0, 160, 90).data; let sum = 0;
      for (let i = 0; i < whole.length; i += 4) sum += 0.2126 * whole[i] + 0.7152 * whole[i + 1] + 0.0722 * whole[i + 2];
      sc.drawImage(video, region[0] * k, region[1] * k, region[2] * k, region[3] * k, 0, 0, 160, 90);
      const d = sc.getImageData(0, 0, 160, 90).data, now = new Float32Array(160 * 90); let diff = 0;
      for (let i = 0; i < now.length; i++) { now[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]; if (before) diff += Math.abs(now[i] - before[i]); }
      samples.push({ t: Math.round(t * 10) / 10, luma: Math.round(sum / now.length * 10) / 10, diff: before ? Math.round(diff / now.length * 100) / 100 : null });
      before = now;
    }
    const big = new OffscreenCanvas(video.videoWidth, video.videoHeight), bc = big.getContext('2d', { willReadFrequently: true }), read = [];
    for (const cap of captions) {
      await seek((cap.start + cap.end) / 2); bc.drawImage(video, 0, 0);
      const [x, y, w, h] = cap.rect.map(v => Math.round(v * k)), d = bc.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data, values = [];
      for (let i = 0; i < d.length; i += 4) values.push(lum([d[i], d[i + 1], d[i + 2]]));
      values.sort((a, b) => a - b);
      const lo = values[Math.floor(values.length * 0.01)], hi = values[Math.floor(values.length * 0.99)];
      read.push({ ...cap, contrast: Math.round((hi + 0.05) / (lo + 0.05) * 100) / 100 });
    }
    const info = { duration: Math.round(video.duration * 100) / 100, width: video.videoWidth, height: video.videoHeight, samples, captions: read, audio: null };
    URL.revokeObjectURL(video.src);
    // The sound, decoded from the same file: how long it is, how loud, and whether it clips.
    try {
      const heard = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(await blob.arrayBuffer());
      let peak = 0, sum = 0; const d = heard.getChannelData(0); for (let i = 0; i < d.length; i += 4) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
      info.audio = { duration: Math.round(heard.duration * 100) / 100, peak: Math.round(peak * 1000) / 1000, rms: Math.round(Math.sqrt(sum / (d.length / 4)) * 1000) / 1000 };
    } catch { /* no audio track, or one this browser cannot decode: reported as no sound */ }
    return info;
  }
  // Does the file show what was composed? Every frame of the file is decoded again, in order, and four times a second
  // the decoded picture is compared with the picture drawn for that frame, block by block. An encoder that ran out of
  // its budget leaves an older picture standing, in the whole frame or in one place (a line being typed), and that
  // block differs. Seeking a player to a time does not show this reliably; decoding every frame does.
  async function faithful(samples, description, codec, fps, c, canvas) {
    const SW = 480, SH = 270, B = 30, every = Math.round(fps / 4);
    const small = new OffscreenCanvas(SW, SH), sc = small.getContext('2d', { willReadFrequently: true });
    const grey = source => { sc.drawImage(source, 0, 0, SW, SH); const d = sc.getImageData(0, 0, SW, SH).data, g = new Uint8Array(SW * SH); for (let i = 0; i < g.length; i++) g[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]; return g; };
    const shown = new Map(); let failed = null;
    const decoder = new VideoDecoder({ output: frame => { const i = Math.round(frame.timestamp * fps / 1e6); if (i && i % every === 0) shown.set(i, grey(frame)); frame.close(); }, error: e => { failed = e.message; } });
    decoder.configure({ codec, description, codedWidth: W, codedHeight: H, hardwareAcceleration: 'prefer-software' });
    for (const [i, s] of samples.entries()) {
      if (failed) break;
      decoder.decode(new EncodedVideoChunk({ type: s.key ? 'key' : 'delta', timestamp: Math.round(i * 1e6 / fps), data: s.data }));
      while (decoder.decodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
    }
    if (!failed) await decoder.flush().catch(e => { failed = e.message; });
    if (decoder.state !== 'closed') decoder.close();
    if (failed || !shown.size) return { error: failed || 'nothing was decoded' };
    // The largest difference of one block (30x30 of 480x270) and the mean over all blocks, in steps of brightness.
    const apart = (a, b) => {
      let most = 0, all = 0;
      for (let by = 0; by < SH; by += B) for (let bx = 0; bx < SW; bx += B) {
        let d = 0;
        for (let y = by; y < by + B; y++) for (let x = bx, o = y * SW + bx; x < bx + B; x++, o++) d += Math.abs(a[o] - b[o]);
        d /= B * B; all += d; if (d > most) most = d;
      }
      return [most, all / (SW / B * SH / B)];
    };
    let worst = 0, at = 0, sum = 0;
    for (const [i, got] of shown) {
      await draw(c, i / fps); const meant = grey(canvas), [most, mean] = apart(got, meant);
      sum += mean; if (most > worst) { worst = most; at = i / fps; }
    }
    return { worst: Math.round(worst * 10) / 10, at: Math.round(at * 10) / 10, mean: Math.round(sum / shown.size * 100) / 100, checked: shown.size };
  }
  // How many frames an animated image holds, read by the browser's own decoder.
  async function frames(url, type) {
    const decoder = new ImageDecoder({ data: await (await fetch(url)).arrayBuffer(), type });
    await decoder.tracks.ready; await decoder.completed;
    return { frames: decoder.tracks.selectedTrack.frameCount, animated: decoder.tracks.selectedTrack.animated };
  }
  window.__nomiStage = { render, inspect, frames, settle };
})();
