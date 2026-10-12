// Agent Live "Classic skin": the same live data drawn in agent-flow's visual language (glowing hexagons, orbit ring,
// token rings, beams) with EVERY run shown. Loaded before the main script; uses its globals at call time only.
"use strict";
let SKIN = "team", KEEP = "30";   // KEEP: "5" / "30" minutes or "session"
try { SKIN = localStorage.getItem("al_skin") || "team"; KEEP = localStorage.getItem("al_keep") || "30"; } catch {}
{ const q = new URLSearchParams(location.search).get("skin"); if (q) SKIN = q; }
const hexExpanded = new Set();
const STC = { thinking: "#7cc8ff", tool: "#ffb454", perm: "#ffb454", done: "#6fd3a0", error: "#ff6b5e", idle: "#4a5d80" };
const hexPts = (cx, cy, R) => Array.from({ length: 6 }, (_, k) => { const a = (-90 + 60 * k) * Math.PI / 180; return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`; }).join(" ");
function wrapLines(str, n, max) {
  const words = String(str || "").replace(/\s+/g, " ").trim().split(" "), out = []; let cur = "";
  for (let w of words) {
    while (w.length > n) { if (cur) { out.push(cur); cur = ""; } out.push(w.slice(0, n)); w = w.slice(n); }
    if ((cur + " " + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > max) { const o = out.slice(0, max); o[max - 1] = o[max - 1].slice(0, n - 1) + "…"; return o; }
  return out;
}
// ---- Classic skin v2: equal hexagons evenly spaced on a ring, one label style, same effects engine as Team live (tlfx.js) ----
let CLG = {}, CLSVG = null, CLGHOST = null, TLPOS = {};
const CLNS = "http://www.w3.org/2000/svg";
function clsEl(tag, attrs, parent) { const e = document.createElementNS(CLNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function roleCol(type) { const n = typeof TN !== "undefined" && TN.find(x => x.id === type); return (n && BANDCOL[n.band]) || BANDCOL.research; }
function clsBuild(host, W, H) {
  host.innerHTML = ""; CLG = {}; CLGHOST = {};
  CLSVG = clsEl("svg", { id: "cls", width: W, height: H, viewBox: `0 0 ${W} ${H}` }); CLSVG.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
  host.appendChild(CLSVG); TLSIG = "";
}
function clsText(parent, cls, txt, attrs) { const t = clsEl("text", { class: cls, "text-anchor": "middle", ...attrs }, parent); t.textContent = txt; return t; }
function clsNode(name, R, big) {   // persistent group: outer = translate (CSS transition), inner = enter animation
  const g = clsEl("g", { class: "cg", "data-hex": name }, CLSVG), gi = clsEl("g", { class: "cgi" }, g);
  const o = { g, gi, R };
  o.track = clsEl("circle", { r: R + 8, fill: "none", "stroke-width": 3, "stroke-opacity": .16 }, gi);
  o.arc = clsEl("circle", { r: R + 8, fill: "none", "stroke-width": 3, "stroke-linecap": "round", transform: "rotate(-90)" }, gi);
  o.hex = clsEl("polygon", { points: hexPts(0, 0, R), "stroke-width": 2.6, "stroke-linejoin": "round" }, gi);
  o.inner = clsEl("polygon", { points: hexPts(0, 0, R - 9), fill: "none", "stroke-opacity": .5, "stroke-linejoin": "round" }, gi);
  o.num = clsText(gi, "cnum", "", { y: big ? 8 : 6, "font-size": big ? 30 : 21 });
  o.sub = clsText(gi, "csub", "", { y: big ? 24 : 18, "font-size": big ? 10 : 9 });
  o.needs = clsText(gi, "cneeds", "needs you", { y: -R - 14, "font-size": 11 }); o.needs.style.display = "none";
  o.title = clsText(gi, "ctitle", "", { y: R + 22 });
  o.lines = [0, 1, 2, 3, 4, 5].map(i => clsText(gi, "ctask", "", { y: R + 38 + i * 12.5, "font-size": 10.5 }));
  o.tt = clsEl("title", {}, g); return o;
}
function renderClassic() {
  TLSIG = "";
  const host = $("tlnodes"), ps = panelSize(), W = ps.W, H = Math.max(520, ps.foc || document.body.classList.contains("hide-log") ? ps.maxH : Math.min(ps.maxH, 660));
  if (!CLSVG || !CLSVG.isConnected) clsBuild(host, W, H);
  CLSVG.setAttribute("width", W); CLSVG.setAttribute("height", H); CLSVG.setAttribute("viewBox", `0 0 ${W} ${H}`); host.style.height = H + "px";
  const keepMs = KEEP === "session" ? Infinity : +KEEP * 60000, byChild = new Map();
  for (const ed of model.edges) byChild.set(ed.child, ed);
  const runs = [...byChild.values()].filter(ed => { const a = model.agents[ed.child]; if (!a || a.name === "subagent" || baseOf(a.name) === "sub-agent") return false; return a.status !== "done" || keepMs === Infinity || nowTs - (a.end || nowTs) < keepMs; });
  const n = runs.length, cx0 = W / 2, cy0 = H / 2, k = Math.min(W / 1500, H / 640, 1.25);
  const R0 = Math.max(52, Math.min(92, Math.min(W, H) * .145)), R = Math.max(34, Math.min(66, Math.min(W, H) * .108));
  const rings = n <= 9 ? [runs] : [runs.slice(0, 8), runs.slice(8)];
  const radii = n <= 9 ? [[.3, .3]] : [[.25, .26], [.38, .38]];
  const childPos = [], lay = { W, H, nodes: {}, edges: [] }, sNodes = {}, ST = { thinking: "#7cc8ff", tool: "#ffb454", perm: "#ffb454", done: "#6fd3a0", error: "#ff6b5e", idle: "#4a5d80" };
  const live = new Set(["orchestrator"]);
  // orchestrator
  const orch = model.agents.orchestrator, ost = orch ? orch.status : "idle", oc = "#7cc8ff";
  if (!CLG.orchestrator) { CLG.orchestrator = clsNode("orchestrator", R0, true); CLG.orchestrator.g.classList.add("main"); }
  const O = CLG.orchestrator; TLPOS.orchestrator = { x: cx0 - R0, y: cy0 - R0, w: 2 * R0, h: 2 * R0, side: true };
  O.g.style.transform = `translate(${cx0}px,${cy0}px)`;
  O.hex.setAttribute("fill", "#13243c"); O.hex.setAttribute("stroke", ST[ost] || ST.idle); O.inner.setAttribute("stroke", oc); O.track.setAttribute("stroke", oc); O.arc.setAttribute("stroke", "none");
  O.num.textContent = orch ? orch.calls : 0; O.num.setAttribute("fill", ST[ost] || ST.idle); O.sub.textContent = (ost === "tool" ? "tool call" : ost === "perm" ? "needs you" : ost); O.sub.setAttribute("fill", "#8fa1bf");
  O.title.textContent = "orchestrator"; O.title.setAttribute("fill", oc); O.title.setAttribute("font-size", 19);
  O.lines.forEach((l, i) => { l.textContent = i === 0 ? `${orch ? orch.calls : 0} tool calls this session` : (i === 1 && model.ctx ? `context ${Math.round(model.ctx.tokens / (model.ctx.max || 1000000) * 100)}%` : ""); l.setAttribute("fill", "#8fa1bf"); l.setAttribute("y", R0 + 38 + i * 13); });
  O.needs.style.display = ost === "perm" ? "" : "none"; O.needs.setAttribute("y", -R0 - 18);
  O.g.classList.toggle("perm", ost === "perm");
  lay.nodes.orchestrator = { x: cx0 - R0, y: cy0 - R0, w: 2 * R0, h: 2 * R0, cx: cx0, cy: cy0, col: oc, hex: true, R: R0 };
  sNodes.orchestrator = { busy: ost === "tool" || ost === "thinking" || ost === "perm", recent: false, status: ost, rate: orch ? (orch.stamps || []).filter(t => nowTs - t < 4000).length / 4 : 0 };
  // children: equal hexagons, evenly spaced per ring, positions animate (CSS transition) when the count changes
  const totTok = Math.max(1, model.tokens), seenKeys = new Set();
  rings.forEach((ring, ri) => ring.forEach((ed, j) => {
    const name = ed.child, a = model.agents[name], st = a.status, type = baseOf(name), col = roleCol(type), sc = ST[st] || ST.idle;
    const th = -Math.PI / 2 + (j + .5) * 2 * Math.PI / ring.length, x = cx0 + radii[ri][0] * W * Math.cos(th), y = cy0 + radii[ri][1] * H * Math.sin(th);
    seenKeys.add(name); live.add(name); childPos.push([x, y]);
    let o = CLG[name]; if (!o) { o = CLG[name] = clsNode(name, R, false); o.g.style.transform = `translate(${cx0}px,${cy0}px)`; o.gi.classList.add("enter"); void o.g.getBoundingClientRect(); }
    o.g.style.transform = `translate(${x}px,${y}px)`; o.g.classList.remove("exit");
    const task = taskMap[name] || a.task || ed.task || "", open = hexExpanded.has(name), maxc = Math.max(14, Math.floor((2 * R + 70) / 5.7));
    const lines = wrapLines(task, maxc, open ? 6 : 2), pct = Math.min(1, (a.tokens || 0) / totTok), C = 2 * Math.PI * (R + 8), on = st === "tool" || st === "thinking" || st === "perm";
    o.hex.setAttribute("fill", on ? "#15284a" : "#101a2e"); o.hex.setAttribute("stroke", sc); o.inner.setAttribute("stroke", col); o.track.setAttribute("stroke", col); o.arc.setAttribute("stroke", col);
    o.arc.setAttribute("stroke-dasharray", `${(C * pct).toFixed(1)} ${C.toFixed(1)}`);
    o.num.textContent = st === "done" ? "✓" : st === "error" ? "!" : (st === "perm" ? "!" : a.calls || 0); o.num.setAttribute("fill", sc);
    o.sub.textContent = st === "tool" ? "tool call" : st === "perm" ? "needs you" : st; o.sub.setAttribute("fill", "#8fa1bf");
    const fs = Math.max(11, Math.min(15, (2 * R + 60) / Math.max(8, type.length * .5))); o.title.textContent = type; o.title.setAttribute("fill", col); o.title.setAttribute("font-size", fs.toFixed(1));
    o.lines.forEach((l, i) => { const tx = lines[i] || ""; if (l.textContent !== tx) l.textContent = tx; l.setAttribute("fill", "#a9bad4"); });
    if (!open && task.length > maxc * 2) { o.lines[2].textContent = "click: full text"; o.lines[2].setAttribute("fill", "#7cc8ff"); o.lines[2].setAttribute("font-size", 9); } else o.lines[2].setAttribute("font-size", 10.5);
    o.needs.style.display = st === "perm" ? "" : "none"; o.g.classList.toggle("perm", st === "perm"); o.g.classList.toggle("done", st === "done"); o.g.classList.toggle("err", st === "error"); o.g.classList.toggle("on", on);
    o.tt.textContent = `${type} - ${task}`;
    TLPOS[name] = { x: x - R, y: y - R, w: 2 * R, h: 2 * R, side: true };
    lay.nodes[name] = { x: x - R, y: y - R, w: 2 * R, h: 2 * R, cx: x, cy: y, col, hex: true, R };
    sNodes[name] = { busy: on, recent: false, status: st, rate: (a.stamps || []).filter(t => nowTs - t < 4000).length / 4 };
    const dx = x - cx0, dy = y - cy0, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, x1 = cx0 + ux * (R0 + 10), y1 = cy0 + uy * (R0 + 10), x2 = x - ux * (R + 12), y2 = y - uy * (R + 12);
    lay.edges.push({ from: "orchestrator", to: name, p0: [x1, y1], p1: [x1 + (x2 - x1) / 3, y1 + (y2 - y1) / 3], p2: [x1 + 2 * (x2 - x1) / 3, y1 + 2 * (y2 - y1) / 3], p3: [x2, y2], col, bow: 1.5 });
  }));
  // remove groups of runs that left (fade out first)
  for (const nm in CLG) if (!live.has(nm) && !CLG[nm].dying) { const o = CLG[nm]; o.dying = true; o.g.classList.add("exit"); setTimeout(() => { o.g.remove(); delete CLG[nm]; }, 800); }
  // idle team: faint small hexagons on an outer ring (never a sparse panel)
  const used = new Set(runs.map(ed => baseOf(ed.child))), ghosts = (typeof TN !== "undefined" ? TN.filter(x => isAgentBand(x.band) && !used.has(x.id)) : []);
  const gsig = ghosts.map(g => g.id).join(",") + "|" + W + "x" + H + "|" + n;
  if (CLGHOST.sig !== gsig) {
    if (CLGHOST.g) CLGHOST.g.remove(); CLGHOST = { sig: gsig, g: clsEl("g", { class: "cghost" }, CLSVG), lay: {} };
    CLSVG.insertBefore(CLGHOST.g, CLSVG.firstChild);
    ghosts.forEach((gh, i) => { const th = -Math.PI / 2 + (i + .5) * 2 * Math.PI / ghosts.length, x = cx0 + .465 * W * Math.cos(th), y = cy0 + .445 * H * Math.sin(th), r = 15;
      if (childPos.some(c => Math.abs(c[0] - x) < 120 && Math.abs(c[1] - y) < R + 75) || (Math.abs(cx0 - x) < 150 && Math.abs(cy0 - y) < R0 + 80)) return;   // keep clear of runs and their labels
      const g = clsEl("g", { transform: `translate(${x},${y})`, opacity: .3 }, CLGHOST.g); clsEl("polygon", { points: hexPts(0, 0, r), fill: "#101a2e", stroke: roleCol(gh.id), "stroke-width": 1.2, "stroke-linejoin": "round" }, g);
      const t = clsText(g, "cghosttxt", gh.name, { y: r + 13, "font-size": 10 }); t.setAttribute("fill", roleCol(gh.id));
      CLGHOST.lay[gh.id] = { x: x - r, y: y - r, w: 2 * r, h: 2 * r, cx: x, cy: y, col: roleCol(gh.id), hex: true, R: r }; });
  }
  for (const id in CLGHOST.lay) { lay.nodes["ghost:" + id] = CLGHOST.lay[id]; sNodes["ghost:" + id] = { busy: false, recent: false, status: "idle", rate: 0 }; }
  if (!runs.length) { const t = CLSVG.querySelector(".cempty") || clsText(CLSVG, "cempty", "", { x: cx0, y: H - 14, "font-size": 12 }); t.setAttribute("x", cx0); t.setAttribute("y", H - 14); t.setAttribute("fill", "#7f92b3"); t.textContent = "No sub-agent runs in this session yet. The idle team is drawn faintly; each run becomes its own hexagon."; }
  else { const t = CLSVG.querySelector(".cempty"); if (t) t.remove(); }
  TLFX.setLayout(lay); TLFX.setStates({ nodes: sNodes, ctx: model.ctx ? { pct: model.ctx.tokens / (model.ctx.max || 1000000) } : null });
  $("legend").innerHTML = `<b>${runs.filter(r => { const s = model.agents[r.child].status; return s === "tool" || s === "thinking" || s === "perm"; }).length}</b> runs working &nbsp; <b>${runs.length}</b> shown (kept per the selector) &nbsp; hexagon number = tool calls &nbsp; ring = share of run tokens &nbsp; faint hexagons = idle team`;
}

// tabs, keep-finished select, click to expand a hexagon's task text
function applySkin() {
  document.querySelectorAll("[data-skin]").forEach(b => b.setAttribute("aria-pressed", b.dataset.skin === SKIN));
  $("keepwrap").hidden = SKIN !== "classic"; $("keep").value = KEEP;
  const f = document.querySelector(".flow"); if (f) f.dataset.skin = SKIN;
  const tl = document.getElementById("tl"); if (tl) { tl.hidden = SKIN === "flow"; document.getElementById("svg").style.display = SKIN === "flow" ? "" : "none"; if (SKIN !== "flow" && window.FX) FX.setGeom(null); }
  if (typeof dirty !== "undefined") dirty = true;
}
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-skin]");
  if (b) { SKIN = b.dataset.skin; try { localStorage.setItem("al_skin", SKIN); } catch {} applySkin(); renderFlow(); return; }
  const h = ev.target.closest("[data-hex]");
  if (h) { const n = h.dataset.hex; hexExpanded.has(n) ? hexExpanded.delete(n) : hexExpanded.add(n); renderFlow(); }
});
document.addEventListener("change", ev => { if (ev.target.id === "keep") { KEEP = ev.target.value; try { localStorage.setItem("al_keep", KEEP); } catch {} renderFlow(); } });
