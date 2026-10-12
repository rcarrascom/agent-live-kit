// Agent Live "Team live" effects engine: ONE canvas behind HTML node cards (text stays DOM, always crisp).
// Techniques studied from agent-flow's webview (Apache-2.0, https://github.com/patoles/agent-flow): a half/quarter-resolution
// blurred bloom pass added back with 'lighter', cached radial-gradient glow sprites, a depth-parallax starfield, a pulsing
// hex-grid backdrop, glowing trail particles on beams and spinner arcs on working items. Re-implemented here (no code copied).
// API: TLFX.init({canvas, box}), setLayout(L), setStates(S), hook(kind, data), setOn(bool, forced), active(), onChip(fn)
(function () {
  "use strict";
  const TAU = Math.PI * 2, OSRM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let calm = OSRM, on = true, running = false, last = 0, t = 0, cv, cx, box, W = 0, H = 0, K = 1, L = null, S = { nodes: {}, ctx: null }, chipFn = null;
  const A = {};                         // per-node animation state
  const orbs = [], sparks = [], ripples = [], parts = [], queue = [];
  const stars = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), z: .15 + Math.random() * .85, p: Math.random() * TAU }));
  const bloom = document.createElement("canvas"), bctx = bloom.getContext("2d"), tmp = document.createElement("canvas"), tctx = tmp.getContext("2d");
  const sprites = new Map(); let hexCache = null, hexKey = "";
  const FAM = { read: "#7cc8ff", write: "#ffb454", run: "#6fd3a0", search: "#a99bff", web: "#4fe3e8", other: "#9fb2cf" };
  const TOOLFAM = { Read: "read", Glob: "read", LS: "read", Write: "write", Edit: "write", NotebookEdit: "write", MultiEdit: "write", Bash: "run", PowerShell: "run", Grep: "search", ToolSearch: "search", WebFetch: "web", WebSearch: "web" };
  const famCol = tool => FAM[TOOLFAM[tool] || "other"];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function sprite(col, r) {             // cached soft radial glow (alpha 1 at the centre, 0 at the edge)
    r = Math.max(4, Math.round(r / 4) * 4); const key = col + "|" + r; let s = sprites.get(key); if (s) return s;
    s = document.createElement("canvas"); s.width = s.height = r * 2; const c = s.getContext("2d"), [R, G, B] = rgb(col);
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, `rgba(${R},${G},${B},1)`); g.addColorStop(.35, `rgba(${R},${G},${B},.45)`); g.addColorStop(.7, `rgba(${R},${G},${B},.1)`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
    c.fillStyle = g; c.fillRect(0, 0, r * 2, r * 2); sprites.set(key, s); return s;
  }
  function init(o) { cv = o.canvas; cx = cv.getContext("2d"); box = o.box; document.addEventListener("visibilitychange", () => { if (document.hidden) running = false; else start(); }); }
  function active() { return typeof SKIN !== "undefined" && (SKIN === "team" || SKIN === "classic"); }
  function setOn(v, forced) { on = !!v; calm = OSRM && !forced; if (cv) cv.style.display = on ? "" : "none"; if (on) start(); }
  function setLayout(l) { L = l; for (const e of l.edges) { /* curved beam control points: a gentle perpendicular bow */
      const dx = e.p3[0] - e.p0[0], dy = e.p3[1] - e.p0[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, bow = Math.min(40, d * .12) * (e.bow || 1);
      e.c1 = [e.p1[0] + nx * bow, e.p1[1] + ny * bow]; e.c2 = [e.p2[0] + nx * bow, e.p2[1] + ny * bow]; }
    hexKey = ""; if (!running) start(); }
  function setStates(s) { S = s; if (!running && on) start(); }
  function start() { if (running || !on || document.hidden || !cv) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  function hook(kind, d) { if (calm) return; queue.push({ kind, d, t0: performance.now() }); }
  const na = id => (A[id] ||= { a: 0, ph: Math.random() * TAU, st: "idle", hit: 0, err: 0, done: 0 });
  const bez = (e, u) => { const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u; return [a * e.p0[0] + b * e.c1[0] + c * e.c2[0] + d * e.p3[0], a * e.p0[1] + b * e.c1[1] + c * e.c2[1] + d * e.p3[1]]; };
  function path(n, pad) {               // outline path of a card (rounded rect) or a hexagon, grown by pad
    if (n.hex) { cx.beginPath(); const R = n.R + pad * 1.15; for (let k = 0; k < 6; k++) { const a = (-90 + 60 * k) * Math.PI / 180; cx[k ? "lineTo" : "moveTo"](n.cx + R * Math.cos(a), n.cy + R * Math.sin(a)); } cx.closePath(); }
    else rr(n.x - pad, n.y - pad, n.w + pad * 2, n.h + pad * 2, 10 + pad);
  }
  function rr(x, y, w, h, r) { cx.beginPath(); if (cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); }
  function perim(n, u, pad) {
    if (n.hex) { const a = u * TAU, R = n.R + pad + 2; return [n.cx + R * Math.cos(a), n.cy + R * Math.sin(a)]; }           // point at fraction u around the rounded card outline
    const w = n.w + pad * 2, h = n.h + pad * 2, P = 2 * (w + h); let d = ((u % 1) + 1) % 1 * P; const x = n.x - pad, y = n.y - pad;
    if (d < w) return [x + d, y]; d -= w; if (d < h) return [x + w, y + d]; d -= h; if (d < w) return [x + w - d, y + h]; d -= w; return [x, y + h - d];
  }
  function burst(x, y, col, n, v) { for (let i = 0; i < n && sparks.length < 260; i++) { const an = rnd(0, TAU), s = rnd(v * .35, v); sparks.push({ x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: 0, max: rnd(.45, 1), col, s: rnd(1, 2.6) }); } }
  function ripple(n, col, max, dur) { ripples.push({ n, col, life: 0, dur: dur || .9, max: max || 34 }); }
  function handle(q) {
    if (!L) return false; const d = q.d;
    if (q.kind === "beam") {
      const a = L.nodes[d.from], b = L.nodes[d.to]; if (!a || !b || a === b) return false;
      const e = mkEdge(a, b); orbs.push({ e, u: 0, dur: 1.15, trail: [], col: d.col || a.col, label: String(d.label || "").slice(0, 28), to: b, from: a });
      burst(a.cx, a.cy, d.col || a.col, 10, 90); ripple(a, d.col || a.col, 26, .7); return true;
    }
    const n = L.nodes[d.name]; if (!n) return false; const s = na(d.name);
    if (q.kind === "tool") { const c = famCol(d.tool); burst(n.cx, n.cy, c, 14, 120); ripple(n, c, 38, .9); s.hit = 1; s.fam = c; if (chipFn) chipFn(d.name, `${d.tool}${d.arg ? ": " + d.arg : ""}`, c); }
    else if (q.kind === "result") { ripple(n, d.err ? "#ff6b5e" : famCol(d.tool), 30, .7); if (d.err) { burst(n.cx, n.cy, "#ff6b5e", 30, 160); s.err = 1; } }
    else if (q.kind === "perm") { ripple(n, "#ffb454", 54, 1.3); }
    else if (q.kind === "done") { burst(n.cx, n.cy, "#6fd3a0", 44, 170); ripple(n, "#6fd3a0", 60, 1.1); s.done = 1; }
    return true;
  }
  function mkEdge(a, b) {
    const x1 = a.cx, y1 = a.cy, x2 = b.cx, y2 = b.cy, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, bow = Math.min(70, d * .18), nx = -dy / d * bow, ny = dx / d * bow;
    return { p0: [x1, y1], p3: [x2, y2], c1: [x1 + dx / 3 + nx, y1 + dy / 3 + ny], c2: [x1 + 2 * dx / 3 + nx, y1 + 2 * dy / 3 + ny] };
  }
  function hexGrid() {                  // pulsing hex-grid backdrop, rendered once per size
    const key = W + "x" + H + "@" + K; if (hexKey === key && hexCache) return hexCache; hexKey = key;
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(W * K)); c.height = Math.max(1, Math.round(H * K)); const g = c.getContext("2d"); g.scale(K, K);
    g.strokeStyle = "rgba(124,200,255,.55)"; g.lineWidth = .6; const R = 34, hh = R * Math.sqrt(3); g.beginPath();
    for (let x = -R, col = 0; x < W + R; x += R * 1.5, col++) for (let y = -hh; y < H + hh; y += hh) {
      const cy = y + (col % 2 ? hh / 2 : 0); for (let k = 0; k < 6; k++) { const a = TAU / 6 * k - Math.PI / 2, px = x + R * .42 * Math.cos(a), py = cy + R * .42 * Math.sin(a); k ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath();
    }
    g.stroke(); hexCache = c; return c;
  }
  function frame(now) {
    if (!running) return; requestAnimationFrame(frame);
    if (!active() || !L) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now; if (dt <= 0) return; t += dt;
    W = box.clientWidth; H = box.clientHeight; const z = parseFloat(document.body.style.zoom) || 1; K = (window.devicePixelRatio || 1) * z;
    if (cv.width !== Math.round(W * K) || cv.height !== Math.round(H * K)) { cv.width = Math.round(W * K); cv.height = Math.round(H * K); }
    cx.setTransform(K, 0, 0, K, 0, 0); cx.clearRect(0, 0, W, H);
    for (let i = queue.length - 1; i >= 0; i--) { if (handle(queue[i]) || now - queue[i].t0 > 3000) queue.splice(i, 1); }
    // ---- backdrop
    cx.globalCompositeOperation = "source-over";
    cx.globalAlpha = calm ? .05 : .05 + .025 * Math.sin(t * .5); cx.drawImage(hexGrid(), 0, 0, W, H);
    const orch = L.nodes.orchestrator;
    if (orch) { const g = cx.createRadialGradient(orch.cx, orch.cy, 0, orch.cx, orch.cy, Math.max(W, H) * .45); g.addColorStop(0, "rgba(124,200,255,.07)"); g.addColorStop(1, "rgba(124,200,255,0)"); cx.globalAlpha = 1; cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
    for (const s of stars) {
      const x = calm ? s.x * W : (((s.x * W + t * 6 * s.z) % W) + W) % W, y = calm ? s.y * H : (((s.y * H - t * 2.5 * s.z) % H) + H) % H;
      cx.globalAlpha = (.1 + .35 * s.z) * (calm ? .7 : .6 + .4 * Math.sin(t * (.6 + s.z) + s.p)); cx.fillStyle = "#b9e6ff"; cx.fillRect(x, y, s.z * 1.7, s.z * 1.7);
    }
    cx.globalAlpha = 1; cx.globalCompositeOperation = "lighter";
    // ---- wires (curved) and flowing particles
    let any = false;
    for (const e of L.edges) {
      const fa = S.nodes[e.from], ta = S.nodes[e.to], hot = fa && ta && fa.busy && ta.busy;
      cx.strokeStyle = e.col; cx.lineWidth = hot ? 2 : 1; cx.globalAlpha = hot ? .55 : .13 + .04 * Math.sin(t * .7 + e.p0[0] * .01);
      if (e.side) cx.setLineDash([4, 6]); cx.beginPath(); cx.moveTo(e.p0[0], e.p0[1]); cx.bezierCurveTo(e.c1[0], e.c1[1], e.c2[0], e.c2[1], e.p3[0], e.p3[1]); cx.stroke(); cx.setLineDash([]);
      if (hot && !calm) {
        any = true; cx.lineWidth = 8; cx.globalAlpha = .08; cx.stroke();
        e.acc = (e.acc || 0) + (6 + Math.min(30, (ta.rate || 0) * 10)) * dt;
        while (e.acc >= 1 && parts.length < 420) { e.acc--; parts.push({ e, u: 0, sp: rnd(.22, .5), r: rnd(1.4, 2.8), j: rnd(-4, 4), col: e.col }); }
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.u += p.sp * dt; if (p.u >= 1) { parts.splice(i, 1); continue; }
      const [x, y] = bez(p.e, p.u), f = Math.sin(p.u * Math.PI), yy = y + p.j * (1 - Math.abs(2 * p.u - 1));
      cx.globalAlpha = .6 * f; cx.drawImage(sprite(p.col, 14), x - 7, yy - 7, 14, 14); cx.globalAlpha = .95 * f; cx.fillStyle = "#fff"; cx.fillRect(x - .8, yy - .8, 1.6, 1.6);
    }
    // ---- nodes: eased glow, orbit ring, state rings
    for (const id in L.nodes) {
      const n = L.nodes[id], st = S.nodes[id] || {}, s = na(id), tgt = st.busy ? 1 : st.recent ? .5 : 0;
      s.a += (tgt - s.a) * (1 - Math.exp(-dt * 3.2)); s.hit = Math.max(0, s.hit - dt * 2.2); s.err = Math.max(0, s.err - dt * 1.2); s.done = Math.max(0, s.done - dt * .5);
      const br = .5 + .5 * Math.sin(t * 2.2 + s.ph), R = Math.max(n.w, n.h) * (calm ? .85 : .85 + .09 * br + .18 * s.hit);
      const base = .035 + .02 * Math.sin(t * .6 + s.ph);                                   // idle nodes still breathe, very faintly
      cx.globalAlpha = Math.min(1, base + s.a * (.15 + .07 * br) + s.hit * .22); cx.drawImage(sprite(n.col, R * 1.35), n.cx - R * 1.35, n.cy - R * 1.35, R * 2.7, R * 2.7);
      if (s.a > .03) {
        any = true; cx.strokeStyle = n.col; cx.lineWidth = 1.3; cx.globalAlpha = s.a * .55; cx.setLineDash([10, 8]); cx.lineDashOffset = -t * (18 + st.rate * 25);
        path(n, 6); cx.stroke(); cx.setLineDash([]);
        if (!calm) for (let k = 0; k < 3; k++) { const [x, y] = perim(n, t * (.07 + .05 * st.rate) + k / 3 + s.ph, 6); cx.globalAlpha = s.a * .95; cx.drawImage(sprite(n.col, 12), x - 12, y - 12, 24, 24); cx.fillStyle = "#fff"; cx.globalAlpha = s.a; cx.fillRect(x - 1, y - 1, 2, 2); }
      }
      if (st.status === "tool" && !calm) { cx.strokeStyle = s.fam || "#ffb454"; cx.lineWidth = 2.2; cx.globalAlpha = .8; cx.setLineDash([46, 150]); cx.lineDashOffset = -t * 160; path(n, 4); cx.stroke(); cx.setLineDash([]); }
      else if (st.status === "thinking" && !calm) { cx.strokeStyle = "#7cc8ff"; cx.lineWidth = 1.6; cx.globalAlpha = .45; cx.setLineDash([24, 120]); cx.lineDashOffset = t * 40; path(n, 4); cx.stroke(); cx.setLineDash([]); }
      if (st.status === "perm") { const p = .5 + .5 * Math.sin(t * 4.5); cx.strokeStyle = "#ffb454"; cx.lineWidth = 2.6; cx.globalAlpha = .35 + .55 * p; path(n, 5); cx.stroke(); cx.lineWidth = 9; cx.globalAlpha = .06 + .1 * p; cx.stroke(); }
      if (st.status === "error" || s.err > 0) { cx.strokeStyle = "#ff6b5e"; cx.lineWidth = 2.4; cx.globalAlpha = calm ? .6 : .25 + Math.random() * .5; path(n, 4); cx.stroke(); }
      if (s.done > 0) { cx.strokeStyle = "#6fd3a0"; cx.lineWidth = 2; cx.globalAlpha = s.done * .6; path(n, 4); cx.stroke(); }
    }
    cx.globalAlpha = 1;
    // ---- ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; r.life += dt; const u = r.life / r.dur; if (u >= 1) { ripples.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - u, 2.2), g = e * r.max; cx.strokeStyle = r.col; cx.lineWidth = 2 * (1 - u) + .5; cx.globalAlpha = (1 - u) * .8; any = true;
      path(r.n, g); cx.stroke();
    }
    // ---- orbs: eased head with glowing trail, carrying the label
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.u += dt / o.dur; any = true;
      if (o.u >= 1) { orbs.splice(i, 1); ripple(o.to, o.col, 44, 1); burst(o.to.cx, o.to.cy, o.col, 28, 140); continue; }
      const e = o.u * o.u * (3 - 2 * o.u), [x, y] = bez(o.e, e); o.trail.push([x, y]); if (o.trail.length > 26) o.trail.shift();
      cx.strokeStyle = o.col; cx.lineWidth = 2; cx.globalAlpha = .22 * Math.sin(o.u * Math.PI); cx.beginPath(); cx.moveTo(o.e.p0[0], o.e.p0[1]); cx.bezierCurveTo(o.e.c1[0], o.e.c1[1], o.e.c2[0], o.e.c2[1], o.e.p3[0], o.e.p3[1]); cx.stroke();
      for (let k = 0; k < o.trail.length; k++) { const f = k / o.trail.length; cx.globalAlpha = f * .55; cx.drawImage(sprite(o.col, 14), o.trail[k][0] - 7 * (.4 + f), o.trail[k][1] - 7 * (.4 + f), 14 * (.4 + f), 14 * (.4 + f)); }
      cx.globalAlpha = .9; cx.drawImage(sprite(o.col, 26), x - 26, y - 26, 52, 52); cx.globalAlpha = 1; cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(x, y, 3.2, 0, TAU); cx.fill();
      if (o.label) { cx.globalCompositeOperation = "source-over"; cx.font = "10.5px 'JetBrains Mono',monospace"; cx.textAlign = "center"; cx.lineWidth = 3; cx.strokeStyle = "rgba(8,12,22,.9)"; cx.strokeText(o.label, x, y - 14); cx.fillStyle = o.col; cx.globalAlpha = .95; cx.fillText(o.label, x, y - 14); cx.globalCompositeOperation = "lighter"; }
    }
    // ---- sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.life += dt; if (p.life >= p.max) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .93; p.vy *= .93; const u = 1 - p.life / p.max; any = true;
      cx.globalAlpha = u * .8; cx.drawImage(sprite(p.col, 8), p.x - 5 * (.5 + u), p.y - 5 * (.5 + u), 10 * (.5 + u), 10 * (.5 + u)); cx.globalAlpha = u; cx.fillStyle = "#fff"; cx.fillRect(p.x - .7, p.y - .7, 1.4, 1.4);
    }
    cx.globalAlpha = 1;
    // ---- context ring around a hexagonal orchestrator
    const oc = L.nodes.orchestrator;
    if (oc && oc.hex && S.ctx) {
      const pct = Math.min(1, S.ctx.pct), col = pct >= .8 ? "#ff6b5e" : pct >= .6 ? "#ffb454" : "#6fd3a0", Rr = oc.R + 14;
      cx.lineWidth = 3; cx.strokeStyle = "rgba(124,200,255,.14)"; cx.beginPath(); cx.arc(oc.cx, oc.cy, Rr, 0, TAU); cx.stroke();
      cx.strokeStyle = col; cx.lineCap = "round"; cx.globalAlpha = .95; cx.beginPath(); cx.arc(oc.cx, oc.cy, Rr, -Math.PI / 2, -Math.PI / 2 + pct * TAU); cx.stroke(); cx.lineCap = "butt"; cx.globalAlpha = 1;
    }
    // ---- bloom: blurred quarter-resolution copy added back (agent-flow's soft glow technique)
    if (!calm && any) {
      const bw = Math.max(2, Math.round(cv.width / 4)), bh = Math.max(2, Math.round(cv.height / 4));
      if (bloom.width !== bw) { bloom.width = bw; bloom.height = bh; tmp.width = bw; tmp.height = bh; }
      bctx.clearRect(0, 0, bw, bh); bctx.drawImage(cv, 0, 0, bw, bh);
      tctx.clearRect(0, 0, bw, bh); tctx.filter = "blur(5px)"; tctx.drawImage(bloom, 0, 0); tctx.filter = "none";
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = "lighter"; cx.globalAlpha = .38; cx.drawImage(tmp, 0, 0, cv.width, cv.height); cx.globalAlpha = 1;
    }
    cx.globalCompositeOperation = "source-over";
  }
  window.TLFX = { init, setLayout, setStates, hook, setOn, active, onChip: f => { chipFn = f; } };
})();
