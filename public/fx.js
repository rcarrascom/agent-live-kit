// Agent Live: canvas effects layer under the flow SVG (the SVG keeps all text crisp on top).
// API: FX.init({canvas, wrap, svg}), FX.setGeom(geo), FX.sync(state), FX.hook(kind, data), FX.setOn(bool).
// Hooks: dispatch / return (edge), tool / result / perm / error / done (agent name). Vanilla canvas, no libraries.
(function () {
  "use strict";
  const OSRM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let RM = OSRM;   // calm mode unless the user switched Effects on explicitly   // calm mode: static ambient + context ring only
  const FAM = { read: "#7cc8ff", write: "#ffb454", run: "#6fd3a0", search: "#a99bff", web: "#4fe3e8", other: "#9fb2cf" };
  const TOOLFAM = { Read: "read", Glob: "read", LS: "read", Write: "write", Edit: "write", NotebookEdit: "write", MultiEdit: "write",
    Bash: "run", PowerShell: "run", Grep: "search", ToolSearch: "search", WebFetch: "web", WebSearch: "web" };
  const famOf = t => FAM[TOOLFAM[t] || "other"];
  let cv, cx, wrap, svg, on = true, running = false, last = 0, t = 0, W = 0, Hh = 0, K = 1;
  let G = null, S = { agents: {}, edges: {}, ctx: null };
  const parts = [], sparks = [], rings = [], orbs = [], flies = [], queue = [];
  const emitAcc = {};
  let nextBeat = 1.0;
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: .25 + Math.random() * .75, p: Math.random() * 6.28 }));
  const rnd = (a, b) => a + Math.random() * (b - a);

  function init(o) {
    cv = o.canvas; cx = cv.getContext("2d"); wrap = o.wrap; svg = o.svg;
    document.addEventListener("visibilitychange", () => { if (document.hidden) running = false; else start(); });
    start();
  }
  function setOn(v, forced) { if (window.TLFX) TLFX.setOn(v, forced); on = !!v; RM = OSRM && !forced; cv.style.display = on ? "" : "none"; if (on) start(); }
  function setGeom(g) { G = g; }
  function sync(s) { S = s; if (!running && on) start(); }
  function start() { if (running || !on || document.hidden || !cv) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  function hook(kind, d) {
    if (window.TLFX && TLFX.active()) return TLFX.hook(kind, d);
    if (RM) return; queue.push({ kind, d, t0: performance.now() }); }

  // ---------- geometry ----------
  const bez = (e, u) => {
    const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return [a * e.p0[0] + b * e.p1[0] + c * e.p2[0] + d * e.p3[0], a * e.p0[1] + b * e.p1[1] + c * e.p2[1] + d * e.p3[1]];
  };
  function box() {   // svg box inside the wrap, in layout px (robust to CSS zoom)
    const rw = wrap.getBoundingClientRect(), rs = svg.getBoundingClientRect(), f = rw.width / (wrap.clientWidth || 1) || 1;
    return { l: (rs.left - rw.left) / f, t: (rs.top - rw.top) / f, w: rs.width / f, h: rs.height / f };
  }
  function view() {   // svg viewBox -> canvas css px
    const b = box(), sc = Math.min(b.w / G.VW, b.h / G.H);
    return { sc, ox: b.l + (b.w - G.VW * sc) / 2, oy: b.t + (b.h - G.H * sc) / 2 };
  }
  function outline(n, pad) {   // box or hexagon outline grown by pad
    if (n.hex) { cx.beginPath(); const R = n.R + pad * 1.15; for (let k = 0; k < 6; k++) { const a = (-90 + 60 * k) * Math.PI / 180; cx[k ? "lineTo" : "moveTo"](n.cx + R * Math.cos(a), n.cy + R * Math.sin(a)); } cx.closePath(); }
    else rr(n.x - pad, n.y - pad, n.w + pad * 2, n.h + pad * 2, 12 + pad * .8);
  }
  function rr(x, y, w, h, r) { cx.beginPath(); if (cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); }
  const busy = a => a && (a.status === "tool" || a.status === "thinking" || a.status === "perm");

  // ---------- effects ----------
  function burst(x, y, col, n, speed) {
    for (let i = 0; i < n; i++) { const an = rnd(0, 6.283), v = rnd(speed * .4, speed); sparks.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, life: 0, max: rnd(.4, .9), col, s: rnd(1, 2.4) }); }
  }
  function ring(x, y, col, max, life, w, node) { rings.push({ x, y, col, r: 0, max, life: 0, dur: life, w: w || 2, node }); }
  function handle(q) {
    if (!G) return false;
    const d = q.d;
    if (q.kind === "dispatch") {
      const e = G.edges[d.id]; if (!e) return false;
      orbs.push({ e, dir: 1, u: 0, dur: 1.1, trail: [], col: e.col, label: (d.task || "").replace(/\s+/g, " ").slice(0, 26), arrive: "spawn" });
      return true;
    }
    if (q.kind === "return") {
      const e = G.edges[d.id]; if (!e) return false;
      orbs.push({ e, dir: -1, u: 0, dur: 1.0, trail: [], col: "#6fd3a0", label: "result", arrive: "back" });
      const n = G.nodes[e.child]; if (n) burst(n.cx, n.cy, "#6fd3a0", 22, 90);
      return true;
    }
    if (q.kind === "beam") {   // who uses what: an orb from one node to another
      const a = G.nodes[d.from], b = G.nodes[d.to]; if (!a || !b || a === b) return false;
      const x1 = a.cx, y1 = a.cy, x2 = b.cx, y2 = b.cy, mx = (x1 + x2) / 2;
      const e = { p0: [x1, y1], p1: [mx, y1], p2: [mx, y2], p3: [x2, y2] };
      orbs.push({ e, dir: 1, u: 0, dur: 1.0, trail: [], col: d.col || a.col || "#7cc8ff", label: String(d.label || "").slice(0, 22), arrive: "beam", toNode: b, line: true });
      burst(x1, y1, d.col || "#7cc8ff", 8, 80);
      return true;
    }
    const n = G.nodes[d.name]; if (!n) return false;
    if (q.kind === "tool") {
      const col = famOf(d.tool);
      burst(n.cx, n.cy, col, 12, 110);
      const j = Math.min(2, (S.chips && S.chips[d.name]) || 0);
      if (n.chipX !== undefined) flies.push({ x0: n.cx, y0: n.cy, x1: n.chipX + 6, y1: n.chipY + (n.chipStep || 0) * Math.max(0, j - 1) + 9, u: 0, label: d.tool, col });
      n.lastFam = col;
    } else if (q.kind === "result") {
      ring(n.cx, n.cy, d.err ? "#ff6b5e" : famOf(d.tool), 46, .7, 1.6, n);
      if (d.err) burst(n.cx, n.cy, "#ff6b5e", 26, 140);
    } else if (q.kind === "perm") { ring(n.cx, n.cy, "#ffb454", 60, 1.1, 2.5, n); }
    else if (q.kind === "done") { burst(n.cx, n.cy, "#6fd3a0", 40, 150); ring(n.cx, n.cy, "#6fd3a0", 70, 1.0, 2.5, n); }
    return true;
  }

  // ---------- frame ----------
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; if (dt <= 0) return; t += dt;
    const cw = wrap.clientWidth, ch = wrap.clientHeight, z = parseFloat(document.body.style.zoom) || 1;
    K = (window.devicePixelRatio || 1) * z;
    if (cv.width !== Math.round(cw * K) || cv.height !== Math.round(ch * K)) { cv.width = Math.round(cw * K); cv.height = Math.round(ch * K); }
    cx.setTransform(K, 0, 0, K, 0, 0); cx.clearRect(0, 0, cw, ch);
    // queued hooks (geometry may lag the model by one render)
    for (let i = queue.length - 1; i >= 0; i--) { const q = queue[i]; if (handle(q) || now - q.t0 > 3000) queue.splice(i, 1); }
    ambient(cw, ch);
    if (!G || !svg.getBoundingClientRect().width) return;
    const v = view(); cx.setTransform(K * v.sc, 0, 0, K * v.sc, K * v.ox, K * v.oy);
    cx.globalCompositeOperation = "lighter";
    if (!RM) { edges(dt); } else { calmEdges(); }
    cx.globalCompositeOperation = "source-over";
    nodes();
    cx.globalCompositeOperation = "lighter";
    if (!RM) overlays(dt);
    cx.globalCompositeOperation = "source-over";
    ctxRing();
  }

  function ambient(cw, ch) {
    cx.strokeStyle = "rgba(124,200,255,.045)"; cx.lineWidth = 1;
    const g = 44, off = RM ? 0 : (t * 5) % g;
    cx.beginPath();
    for (let x = -off; x < cw; x += g) { cx.moveTo(Math.round(x) + .5, 0); cx.lineTo(Math.round(x) + .5, ch); }
    for (let y = -off * .5; y < ch; y += g) { cx.moveTo(0, Math.round(y) + .5); cx.lineTo(cw, Math.round(y) + .5); }
    cx.stroke();
    for (const s of stars) {
      const x = RM ? s.x * cw : (((s.x * cw - t * 7 * s.z) % cw) + cw) % cw, y = s.y * ch;
      cx.globalAlpha = RM ? .25 : .12 + .3 * (.5 + .5 * Math.sin(t * (.8 + s.z) + s.p)) * s.z;
      cx.fillStyle = "#b9e6ff"; cx.fillRect(x, y, s.z * 1.6, s.z * 1.6);
    }
    cx.globalAlpha = 1;
  }

  function calmEdges() {
    for (const id in G.edges) { const e = G.edges[id], a = S.agents[e.child]; if (!busy(a)) continue;
      cx.strokeStyle = e.col; cx.globalAlpha = .12; cx.lineWidth = 6; path(e); cx.stroke(); }
    cx.globalAlpha = 1;
  }
  function path(e) { cx.beginPath(); cx.moveTo(e.p0[0], e.p0[1]); cx.bezierCurveTo(e.p1[0], e.p1[1], e.p2[0], e.p2[1], e.p3[0], e.p3[1]); }

  function edges(dt) {
    const o = G.nodes.orchestrator;
    // heartbeat from the orchestrator
    if (o && t > nextBeat) { ring(o.cx, o.cy, "#7cc8ff", 150, 1.8, 1.4, o); nextBeat = t + 4; }
    for (const id in G.edges) {
      const e = G.edges[id], a = S.agents[e.child], act = S.edges[id] === "out" && busy(a);
      if (!act) continue;
      const rate = a.rate || 0, pps = (a.status === "perm" ? 2 : 4) + Math.min(rate * 12, 36);
      cx.strokeStyle = e.col; cx.lineWidth = 7; cx.globalAlpha = .07 + Math.min(.12, rate * .03); path(e); cx.stroke();
      cx.setLineDash([5, 9]); cx.lineDashOffset = -t * 42; cx.lineWidth = 1.6; cx.globalAlpha = .55; path(e); cx.stroke(); cx.setLineDash([]);
      emitAcc[id] = (emitAcc[id] || 0) + pps * dt;
      while (emitAcc[id] >= 1 && parts.length < 500) { emitAcc[id]--; parts.push({ e, u: 0, sp: rnd(.28, .55), col: e.col, r: rnd(1.3, 2.6), j: rnd(-3, 3) }); }
    }
    cx.globalAlpha = 1;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.u += p.sp * dt; if (p.u >= 1) { parts.splice(i, 1); continue; }
      const [x, y] = bez(p.e, p.u), fade = Math.sin(p.u * Math.PI);
      cx.fillStyle = p.col; cx.globalAlpha = .16 * fade; cx.beginPath(); cx.arc(x, y + p.j * (1 - Math.abs(2 * p.u - 1)), p.r * 3, 0, 6.283); cx.fill();
      cx.globalAlpha = .9 * fade; cx.beginPath(); cx.arc(x, y + p.j * (1 - Math.abs(2 * p.u - 1)), p.r, 0, 6.283); cx.fill();
    }
    cx.globalAlpha = 1;
  }

  function nodes() {   // state glows (outside the node box; the SVG node covers the inside)
    cx.globalCompositeOperation = "lighter";
    for (const name in G.nodes) {
      const n = G.nodes[name], a = S.agents[name]; if (!a) continue;
      const st = a.status, col = n.col, ph = n.cx * .013;
      if (st === "thinking" || st === "tool") {
        const br = .5 + .5 * Math.sin(t * (st === "tool" ? 5 : 2.2) + ph);
        const R = Math.max(n.w, n.h) * (RM ? .8 : .85 + .1 * br);
        const gr = cx.createRadialGradient(n.cx, n.cy, n.h * .3, n.cx, n.cy, R);
        gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
        cx.globalAlpha = RM ? .1 : (st === "tool" ? .22 : .08 + .1 * br); cx.fillStyle = gr; cx.beginPath(); cx.ellipse(n.cx, n.cy, R, R * .75, 0, 0, 6.283); cx.fill();
        if (!RM) {
          cx.globalAlpha = .9; cx.fillStyle = col;
          for (let i = 0; i < (st === "tool" ? 4 : 3); i++) {
            const an = t * (st === "tool" ? 2.4 : 1.1) + i * 6.283 / (st === "tool" ? 4 : 3) + ph;
            cx.beginPath(); cx.arc(n.cx + Math.cos(an) * (n.w * .62), n.cy + Math.sin(an) * (n.h * .85), st === "tool" ? 2.8 : 2.2, 0, 6.283); cx.fill();
          }
        }
        if (st === "tool" && !RM) { const u = (t * 1.6) % 1; cx.strokeStyle = n.lastFam || col; cx.globalAlpha = (1 - u) * .7; cx.lineWidth = 2; outline(n, u * 16); cx.stroke(); }
      } else if (st === "perm") {
        const p = .5 + .5 * Math.sin(t * 5);
        cx.strokeStyle = "#ffb454"; cx.lineWidth = 3; cx.globalAlpha = .3 + .6 * p; outline(n, 5); cx.stroke();
        cx.lineWidth = 8; cx.globalAlpha = .08 + .12 * p; outline(n, 8); cx.stroke();
      } else if (st === "error") {
        cx.strokeStyle = "#ff6b5e"; cx.lineWidth = 3; cx.globalAlpha = RM ? .6 : .3 + Math.random() * .5; outline(n, 4); cx.stroke();
      } else if (st === "recent") {
        cx.strokeStyle = col; cx.lineWidth = 1.5; cx.globalAlpha = RM ? .35 : .3 + .12 * Math.sin(t * 1.5 + ph); outline(n, 3); cx.stroke();
        const R = Math.max(n.w, n.h) * .75, gr = cx.createRadialGradient(n.cx, n.cy, n.h * .3, n.cx, n.cy, R); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
        cx.globalAlpha = .07; cx.fillStyle = gr; cx.beginPath(); cx.ellipse(n.cx, n.cy, R, R * .7, 0, 0, 6.283); cx.fill();
      } else if (st === "done") {
        cx.strokeStyle = "#6fd3a0"; cx.lineWidth = 2; cx.globalAlpha = .25; outline(n, 3); cx.stroke();
      }
    }
    cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
  }

  function overlays(dt) {
    // rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life += dt; const u = r.life / r.dur; if (u >= 1) { rings.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - u, 2); cx.strokeStyle = r.col; cx.globalAlpha = (1 - u) * .8; cx.lineWidth = r.w;
      if (r.node) { const g = e * r.max * .5; outline(r.node, g); cx.stroke(); }
      else { cx.beginPath(); cx.arc(r.x, r.y, e * r.max, 0, 6.283); cx.stroke(); }
    }
    // orbs with trails (dispatch: orchestrator -> child, return: child -> orchestrator)
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.u += dt / o.dur;
      if (o.u >= 1) {
        orbs.splice(i, 1);
        if (o.arrive === "beam") { const n = o.toNode; ring(n.cx, n.cy, o.col, 70, .9, 2.5, n); burst(n.cx, n.cy, o.col, 22, 120); }
        else if (o.arrive === "spawn") { const n = G.nodes[o.e.child]; if (n) { ring(n.cx, n.cy, o.col, 90, .9, 3, n); ring(n.cx, n.cy, "#ffffff", 40, .5, 2, n); burst(n.cx - n.w / 2, n.cy, o.col, 30, 130); } }
        else { const n = G.nodes.orchestrator; if (n) { ring(n.cx, n.cy, "#6fd3a0", 70, 1.0, 3, n); burst(n.cx + n.w / 2, n.cy, "#6fd3a0", 24, 110); } }
        continue;
      }
      const e = o.u * o.u * (3 - 2 * o.u), [x, y] = bez(o.e, o.dir > 0 ? e : 1 - e);
      if (o.line) { cx.strokeStyle = o.col; cx.globalAlpha = .28 * Math.sin(o.u * Math.PI); cx.lineWidth = 2; cx.beginPath(); cx.moveTo(o.e.p0[0], o.e.p0[1]); cx.bezierCurveTo(o.e.p1[0], o.e.p1[1], o.e.p2[0], o.e.p2[1], o.e.p3[0], o.e.p3[1]); cx.stroke(); }
      o.trail.push([x, y]); if (o.trail.length > 18) o.trail.shift();
      for (let k = 0; k < o.trail.length; k++) { const f = k / o.trail.length; cx.globalAlpha = f * .5; cx.fillStyle = o.col; cx.beginPath(); cx.arc(o.trail[k][0], o.trail[k][1], 1 + f * 5, 0, 6.283); cx.fill(); }
      cx.globalAlpha = .25; cx.fillStyle = o.col; cx.beginPath(); cx.arc(x, y, 13, 0, 6.283); cx.fill();
      cx.globalAlpha = 1; cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(x, y, 4, 0, 6.283); cx.fill();
      cx.globalCompositeOperation = "source-over"; cx.globalAlpha = .95; cx.font = "10px 'JetBrains Mono',monospace"; cx.textAlign = "center";
      cx.lineWidth = 3; cx.strokeStyle = "rgba(10,15,26,.85)"; cx.strokeText(o.label, x, y - 12); cx.fillStyle = o.col; cx.fillText(o.label, x, y - 12);
      cx.globalCompositeOperation = "lighter";
    }
    // flying tool chips
    for (let i = flies.length - 1; i >= 0; i--) {
      const f = flies[i]; f.u += dt / .5; if (f.u >= 1) { flies.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - f.u, 3), x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e;
      cx.globalCompositeOperation = "source-over"; cx.globalAlpha = 1 - f.u * f.u;
      cx.fillStyle = "rgba(20,30,50,.9)"; cx.strokeStyle = f.col; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(x + 6, y, 9, 0, 6.2832); cx.fill(); cx.stroke();
      TOOLICONS.draw(cx, TOOLICONS.famOfCol(f.col), x + 6, y, 12, f.col);
      cx.globalCompositeOperation = "lighter";
    }
    // sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.life += dt; if (s.life >= s.max) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .94; s.vy *= .94; const u = 1 - s.life / s.max;
      cx.globalAlpha = u; cx.fillStyle = s.col; cx.beginPath(); cx.arc(s.x, s.y, s.s * (.5 + u), 0, 6.283); cx.fill();
    }
    cx.globalAlpha = 1;
  }

  function ctxRing() {   // context window use around the orchestrator box
    const n = G && G.nodes.orchestrator; if (!n || !S.ctx) return;
    if (n.hex) { const pct = Math.min(1, S.ctx.pct), col = pct >= .8 ? "#ff6b5e" : pct >= .6 ? "#ffb454" : "#6fd3a0", R = n.R + 11;
      cx.lineWidth = 3; cx.strokeStyle = "rgba(124,200,255,.12)"; cx.beginPath(); cx.arc(n.cx, n.cy, R, 0, 6.283); cx.stroke();
      cx.strokeStyle = col; cx.lineCap = "round"; cx.globalAlpha = .95; cx.beginPath(); cx.arc(n.cx, n.cy, R, -Math.PI / 2, -Math.PI / 2 + pct * 6.283); cx.stroke(); cx.lineCap = "butt"; cx.globalAlpha = 1;
      cx.font = "10px 'JetBrains Mono',monospace"; cx.textAlign = "center"; cx.fillStyle = col; cx.fillText(`context ${Math.round(pct * 100)}%`, n.cx, n.cy - R - 6); return; }
    const pct = Math.min(1, S.ctx.pct), pad = 6, x = n.x - pad, y = n.y - pad, w = n.w + pad * 2, h = n.h + pad * 2, r = 16;
    const per = 2 * (w + h) - (8 - 2 * Math.PI) * r;
    const col = pct >= .8 ? "#ff6b5e" : pct >= .6 ? "#ffb454" : "#6fd3a0";
    cx.lineWidth = 2.5; cx.strokeStyle = "rgba(124,200,255,.12)"; rr(x, y, w, h, r); cx.stroke();
    cx.strokeStyle = col; cx.globalAlpha = .9; cx.setLineDash([per * pct, per]); cx.lineDashOffset = 0;
    cx.beginPath(); cx.moveTo(x + r, y); cx.lineTo(x + w - r, y); cx.arcTo(x + w, y, x + w, y + r, r); cx.lineTo(x + w, y + h - r); cx.arcTo(x + w, y + h, x + w - r, y + h, r);
    cx.lineTo(x + r, y + h); cx.arcTo(x, y + h, x, y + h - r, r); cx.lineTo(x, y + r); cx.arcTo(x, y, x + r, y, r); cx.stroke();
    cx.setLineDash([]); cx.globalAlpha = 1;
    cx.font = "10px 'JetBrains Mono',monospace"; cx.textAlign = "left"; cx.fillStyle = col;
    cx.fillText(`context ${Math.round(pct * 100)}%`, x, y - 5);
  }

  window.FX = { init, setOn, setGeom, sync, hook };
})();
