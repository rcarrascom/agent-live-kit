// Agent Live "Team live" skin: the team map (nodes, edges, stages from /team.json) with every node live.
// Loaded before the main script; uses its globals (model, hist, accounts, describe, ...) at call time only.
"use strict";
let TN = [], TE = [], TSTAGES = [], RULES = [], TLAY = null, TOPEN = null, TEAMCFG = {};
const BANDCOL = {}, BANDLBL = {};   // filled from /team.json "bands" (labels and colours come from the config)
let BANDORDER = [];
const isAgentBand = b => !["people", "claude", "tools", "outside"].includes(b);
let relayUp = false;
const orchId = () => (TEAMCFG.orchestratorByAccount || {})[accounts[selSession]] || TEAMCFG.orchestrator || "orchestrator";
const isOrch = id => id === (TEAMCFG.orchestrator || "orchestrator") || Object.values(TEAMCFG.orchestratorByAccount || {}).includes(id);
function nodeIdFor(name) {
  const n = String(name || "orchestrator");
  if (n === "orchestrator") return orchId();
  const b = baseOf(n);
  if (TN.some(x => x.id === b)) return b;
  return b === "sub-agent" ? "other:" + n.slice(0, 20) : b;
}
const fxName = n => (SKIN === "team" ? nodeIdFor(n) : n);
async function loadTeam() {
  try {
    const j = await (await fetch("/team.json")).json(); TEAMCFG = j; TN = j.nodes || []; TE = j.edges || []; TSTAGES = j.stages || [];
    for (const [k, v] of Object.entries(j.bands || {})) { BANDCOL[k] = v.color; BANDLBL[k] = v.label; }
    BANDORDER = [...new Set(["people", "claude", ...Object.keys(j.bands || {}), "other"])];
    try { if (!localStorage.getItem("al_keep") && j.keepFinishedMinutes) KEEP = String(j.keepFinishedMinutes); } catch {}
    const ks = $("keep"); if (ks && KEEP !== "session" && ![...ks.options].some(o => o.value === KEEP)) ks.add(new Option(KEEP + " min", KEEP), 1);
  } catch {}
  try {
    const r = await (await fetch("/rules.json")).json();
    RULES = Rules.compile(r.rules || []).rules;
  } catch {}
  TLAY = null;
}
// ---- reducer helpers (called from apply(); anim = live) ----
function tlNode(M, id) { return (M.tl.nodes[id] ||= { runs: 0, last: 0, stamps: [], hist: [], doing: "", by: "" }); }
function tlRules(M, a, p, ts, anim) {
  const text = `${p.tool || ""} ${a.arg || ""}`;
  for (const r of Rules.matchRules(RULES, p.tool, a.arg || text)) {
    if (!TN.some(x => x.id === r.node)) continue;   // rule for a node that is not on this map
    const n = tlNode(M, r.node); n.runs++; n.last = ts; n.stamps.push(ts); if (n.stamps.length > 200) n.stamps.shift();
    n.doing = `${p.tool}: ${a.arg}`.slice(0, 160); n.by = a.name;
    n.hist.push({ ts, who: a.name, text: `${p.tool}: ${a.arg}` }); if (n.hist.length > 40) n.hist.shift();
    if (r.waiting) M.tl.waiting = { ts, who: a.name, q: true, text: a.arg };
    if (anim && SKIN === "team") FX.hook("beam", { from: nodeIdFor(a.name), to: r.node, label: p.tool, col: BANDCOL[(TN.find(x => x.id === r.node) || {}).band] || "#9fb2cf" });
  }
}
function tlUser(M, p, ts) {
  const t = String(p.content || "");
  M.tl.waiting = null; const n = tlNode(M, TEAMCFG.human || "human"); n.runs++; n.last = ts; n.doing = "message: " + t; n.stamps.push(ts);
  n.hist.push({ ts, who: (TN.find(x => x.id === TEAMCFG.human) || {}).name || "you", text: t }); if (n.hist.length > 40) n.hist.shift();
}
function tlWait(M, p, ts, a) { M.tl.waiting = { ts, who: a.name, text: p.message || "permission" }; }
function tlClear(M, a) { if (M.tl.waiting && M.tl.waiting.who === a.name) M.tl.waiting = null; }

// ---- layout (from the Team Map; stretched to fill the panel, but never below a readable card size) ----
const LBLW = 100, TOP = 6, MINNH = 42, BUILTIN = [
  { id: "general-purpose", name: "general-purpose", stage: "plan", role: "Built-in Claude Code agent type: researches and executes multi-step tasks (not defined in your agents folder)." },
  { id: "Explore", name: "Explore", stage: "plan", role: "Built-in read-only search agent for broad fan-out searches." },
  { id: "Plan", name: "Plan", stage: "plan", role: "Built-in architect agent that returns an implementation plan." }];
function panelSize() {
  const foc = document.body.classList.contains("focus"), z = parseFloat(document.body.style.zoom) || 1, host = $("flowwrap");
  const W = Math.max(640, (host.clientWidth || 900) - 8);
  const nolog = document.body.classList.contains("hide-log");
  const maxH = foc ? innerHeight / z - 150 : nolog ? innerHeight / z - 190 : innerHeight * .66 / z - 90;
  return { W, maxH: Math.max(360, maxH), foc };
}
function layout() {
  const ps = panelSize(), extras = [], seen = new Set(TN.map(x => x.id));
  for (const a of Object.values(model.agents)) {
    const id = nodeIdFor(a.name);
    if (id.startsWith("other:")) continue;   // unmatched: shown as a small chip, never as a card
    if (!isOrch(id) && !seen.has(id)) { seen.add(id); extras.push({ id, name: baseOf(a.name) === "sub-agent" ? a.name.slice(0, 26) : baseOf(a.name), band: "other", stage: "plan", role: (BUILTIN.find(b => b.id === id) || {}).role || "An agent type your team map does not list.", lane: "", cost: "", runs: 0, last: "", extra: true }); }
  }
  const all = TN.concat(extras), stIdx = Object.fromEntries(TSTAGES.map((s, i) => [s[0], i]));
  const bands = BANDORDER.filter(b => all.some(n => n.band === b)), cell = {}, bandRows = {}; let rowsTotal = 0;
  for (const b of bands) {
    const cols = {};
    for (const n of all.filter(n => n.band === b)) { const c = stIdx[n.stage] ?? 0; (cols[c] ||= []).push(n); }
    bandRows[b] = Math.max(1, ...Object.values(cols).map(l => l.length)); rowsTotal += bandRows[b]; cell[b] = cols;
  }
  const gap = 8, foot = 18, minH = TOP + rowsTotal * (MINNH + 5) + bands.length * gap + foot;
  const H = Math.max(minH, Math.min(ps.maxH, TOP + rowsTotal * 78 + bands.length * gap + foot));
  const pitch = (H - TOP - bands.length * gap - foot) / rowsTotal;
  const colW = (ps.W - LBLW - 6) / TSTAGES.length, nw = colW - 8, nh = Math.min(pitch - 5, 92);
  const pos = {}, bandY = {}; let y = TOP;
  for (const b of bands) {
    bandY[b] = y;
    for (const c in cell[b]) cell[b][c].forEach((n, i) => { pos[n.id] = { x: LBLW + c * colW, y: y + i * pitch }; });
    y += bandRows[b] * pitch + gap;
  }
  return { all, pos, bands, bandY, bandRows, pitch, W: ps.W, H, nw, nh, colW, sig: ps.W + "x" + Math.round(H) + "|" + all.length + "|" + Math.round(nh) };
}
// ---- per-node live state from the model ----
const PRIOT = { perm: 5, error: 4, tool: 3, thinking: 2, done: 1, idle: 0 };
const RECENT_MS = 60000;
function nodeStates() {
  const out = {}, now = nowTs, byId = {};
  for (const a of Object.values(model.agents)) { if (a.name === "subagent") continue; (byId[nodeIdFor(a.name)] ||= []).push(a); }
  const W = model.tl.waiting;
  for (const n of TLAY.all) {
    const st = { status: "idle", doing: "", runs: 0, last: 0, stamps: [], seen: false, hist: [] };
    const list = byId[n.id] || [];
    if (list.length) {
      st.seen = true; st.runs = list.length;
      for (const a of list) {
        if ((PRIOT[a.status] || 0) > (PRIOT[st.status] || 0)) st.status = a.status;
        st.stamps = st.stamps.concat(a.stamps || []); st.last = Math.max(st.last, a.last || a.start || 0);
        if (a.status === "tool") st.doing = `${a.tool}: ${a.arg}`;
        else if (!st.doing) st.doing = (a.status === "thinking" ? (taskMap[a.name] || a.task) : (a.lastDoing || taskMap[a.name] || a.task)) || "";
      }
      if (n.id === orchId()) st.runs = model.calls;
      if (!st.doing && st.status === "done") st.doing = "finished";
    } else if (model.tl.nodes[n.id]) {
      const t = model.tl.nodes[n.id]; st.seen = true; st.runs = t.runs; st.last = t.last; st.stamps = t.stamps; st.doing = t.doing; st.hist = t.hist;
      st.status = now - t.last < 6000 ? "tool" : "idle";
    }
    if (n.id === TEAMCFG.human) {
      const u = model.tl.nodes[TEAMCFG.human];
      if (W) { st.status = "perm"; st.doing = W.q ? "waiting for you: " + (W.text || "question") : "waiting for you (permission): " + (W.text || ""); st.last = W.ts; st.seen = true; }
      else if (u) { st.status = now - u.last < 8000 ? "tool" : "idle"; st.doing = u.doing; st.runs = u.runs; st.last = u.last; st.seen = true; st.stamps = u.stamps; }
    }
    if (TEAMCFG.relayNode && n.id === TEAMCFG.relayNode && relayUp) { st.status = "up"; st.doing = "relay answering"; st.seen = true; }
    // activity memory: stays softly lit for 60 s after the last event
    if ((st.status === "idle" || st.status === "done") && st.last && now - st.last < RECENT_MS && st.seen) st.recent = true;
    out[n.id] = st;
  }
  return out;
}
const sideOf = (a, b, w) => (b.x > a.x + w ? "r" : b.x < a.x - w ? "l" : "v");
function wire(a, b, w, h) {   // from node a to node b, returns [p0,p1,p2,p3]
  const s = sideOf(a, b, w);
  if (s === "r") { const x1 = a.x + w, y1 = a.y + h / 2, x2 = b.x, y2 = b.y + h / 2, m = (x1 + x2) / 2; return [[x1, y1], [m, y1], [m, y2], [x2, y2]]; }
  if (s === "l") { const x1 = a.x, y1 = a.y + h / 2, x2 = b.x + w, y2 = b.y + h / 2, m = (x1 + x2) / 2; return [[x1, y1], [m, y1], [m, y2], [x2, y2]]; }
  const down = b.y > a.y, x1 = a.x + w / 2, y1 = a.y + (down ? h : 0), x2 = b.x + w / 2, y2 = b.y + (down ? 0 : h), m = (y1 + y2) / 2;
  return [[x1, y1], [x1, m], [x2, m], [x2, y2]];
}
function agoStr(ts) { if (!ts) return ""; const s = Math.max(0, Math.round((nowTs - ts) / 1000)); return s < 60 ? s + "s" : s < 3600 ? Math.floor(s / 60) + "m" : Math.floor(s / 3600) + "h"; }
function splitName(name, maxc) {
  if (name.length <= maxc) return [name];
  const i = name.lastIndexOf(" ", maxc), j = i > 4 ? i : name.indexOf(" ", 4);
  if (j > 0) return [name.slice(0, j), name.slice(j + 1, j + 1 + maxc + 4)];
  return [name.slice(0, maxc), name.slice(maxc, maxc * 2)];
}
const compact0 = (th, v, cap) => (th < 54 ? Math.min(v, cap) : v);
// ---- DOM cards (text can never overlap: each card is a flex column with ellipsis) ----
let TLSIG = "", TLEL = {}, TLC = {};
function buildTeamDom(L) {
  const host = $("tlnodes"); host.innerHTML = ""; TLEL = {}; TLC = {};
  host.style.height = L.H + "px";
  for (const b of L.bands) {
    const d = document.createElement("div"); d.className = "tband"; d.style.top = L.bandY[b] + "px"; d.style.color = BANDCOL[b];
    d.innerHTML = BANDLBL[b].toUpperCase().split(" ").map(w => `<span>${esc(w)}</span>`).join(""); host.appendChild(d);
  }
  const sg = document.createElement("div"); sg.className = "tstages";
  sg.innerHTML = TSTAGES.map((s, i) => `<span style="left:${LBLW + i * L.colW + 4}px">${i + 1} ${esc(s[1])}</span>`).join(""); host.appendChild(sg);
  for (const n of L.all) {
    const p = L.pos[n.id], d = document.createElement("div");
    d.className = "tnode"; d.dataset.tn = n.id; d.style.cssText = `left:${p.x}px;top:${p.y}px;width:${L.nw}px;height:${L.nh}px;--c:${BANDCOL[n.band]}`;
    d.innerHTML = `<div class="nm"></div><div class="dn"></div><div class="mt"><svg class="sp" viewBox="0 0 48 10" preserveAspectRatio="none"></svg><span></span></div><i class="bg"></i>`;
    host.appendChild(d); TLEL[n.id] = { d, nm: d.children[0], dn: d.children[1], sp: d.children[2].children[0], mt: d.children[2].children[1], bg: d.children[3] };
  }
  TLC = {};
}
function renderTeamLive() {
  if (!TN.length) { return; }
  const L = layout(); TLAY = L; const ST = nodeStates();
  if (L.sig !== TLSIG || !$("tlnodes").querySelector(".tnode")) { TLSIG = L.sig; buildTeamDom(L); }
  const compact = L.nh < 54;
  $("tl").classList.toggle("compact", compact); $("tl").style.setProperty("--k", Math.max(1, Math.min(1.5, L.nh / 56, L.nw / 150)).toFixed(2));
  const lay = { W: L.W, H: L.H, nodes: {}, edges: [] }, sNodes = {};
  let working = 0, recent = 0;
  for (const n of L.all) {
    const p = L.pos[n.id], x = ST[n.id], e = TLEL[n.id], col = BANDCOL[n.band];
    const on = x.status === "tool" || x.status === "thinking" || x.status === "perm";
    if (on) working++; else if (x.recent) recent++;
    const cls = "tnode" + (on ? " on" : "") + (x.recent ? " recent" : "") + (x.seen ? " seen" : "") + (x.status === "perm" ? " perm" : "") + (x.status === "error" ? " err" : "") + (x.status === "up" ? " up" : "") + (x.status === "done" ? " done" : "") + (x.status === "tool" ? " tool" : "");
    if (e.d.className !== cls) e.d.className = cls;
    if (e.nm.textContent !== n.name) { e.nm.textContent = n.name; e.d.title = n.name + " - " + (n.role || ""); }
    const text = x.doing ? ((!on && x.last ? "last: " : "") + x.doing) : (x.seen ? "idle" : "no activity seen");
    const clean = String(text).replace(/\s+/g, " ").slice(0, 160); if (e.dn.textContent !== clean) e.dn.textContent = clean;
    let hist = x.last ? `${x.runs}r · ${agoStr(x.last)} ago` : (n.runs ? `log ${n.runs}r · ${n.last}` : "never seen");
    if (n.id === orchId() && model.ctx) hist += ` · ctx ${Math.round(model.ctx.tokens / (model.ctx.max || 1000000) * 100)}%`;
    if (e.mt.textContent !== hist) e.mt.textContent = hist;
    const bk = new Array(12).fill(0); for (const t of x.stamps) { const age = nowTs - t; if (age >= 0 && age < 60000) bk[11 - Math.floor(age / 5000)]++; }
    const sig = bk.join(","); if (TLC[n.id] !== sig) { TLC[n.id] = sig; const mx = Math.max(2, ...bk); e.sp.innerHTML = bk.map((v, i) => { const h = v ? Math.max(1.5, v / mx * 9.5) : .8; return `<rect x="${i * 4}" y="${10 - h}" width="3" height="${h}" fill="${col}" opacity="${v ? 1 : .3}"/>`; }).join(""); }
    lay.nodes[n.id] = { x: p.x, y: p.y, w: L.nw, h: L.nh, cx: p.x + L.nw / 2, cy: p.y + L.nh / 2, col }; TLPOS[n.id] = { x: p.x, y: p.y, w: L.nw, h: L.nh };
    sNodes[n.id] = { busy: on, recent: !!x.recent && !on, status: x.status, rate: x.stamps.filter(t => nowTs - t < 4000).length / 4 };
  }
  lay.nodes.orchestrator = lay.nodes[orchId()]; sNodes.orchestrator = sNodes[orchId()];
  for (const ed of TE) {
    const a = L.pos[ed[0]], b = L.pos[ed[1]]; if (!a || !b) continue; const w = wire(a, b, L.nw, L.nh);
    lay.edges.push({ from: ed[0], to: ed[1], p0: w[0], p1: w[1], p2: w[2], p3: w[3], col: BANDCOL[(L.all.find(n => n.id === ed[0]) || {}).band] || "#7cc8ff", side: !!ed[2], bow: sideOf(a, b, L.nw) === "v" ? 1.6 : 1 });
  }
  if (!TLFXSIG || TLFXSIG !== L.sig) { TLFXSIG = L.sig; TLFX.setLayout(lay); } else TLFX.setLayout(lay);
  TLFX.setStates({ nodes: sNodes, ctx: model.ctx ? { pct: model.ctx.tokens / (model.ctx.max || 1000000) } : null });
  const unmN = Object.values(model.agents).filter(a => a.name !== "orchestrator" && a.name !== "subagent" && baseOf(a.name) === "sub-agent").length;
  $("legend").innerHTML = `${unmN ? `<span class="unm" title="runs the matcher could not type yet">unmatched: ${unmN}</span> ` : ""}<b>${working}</b> working now &nbsp;<b>${recent}</b> recently active (60 s) &nbsp; of ${L.all.length} nodes &nbsp; <i style="--k:#7cc8ff"></i>working (glow) <i style="--k:#5f8bb5"></i>recently active <i style="--k:#ffb454"></i>waiting for you <i style="--k:#6fd3a0"></i>up / done <i style="--k:#2c4a72"></i>dim = not seen &nbsp; beams = who is using what ${TOOLICONS.legendHTML()}`;
  if (TOPEN) showCard(TOPEN, ST);
}
let TLFXSIG = "";
// floating tool chips: full tool text drifts up from the working card and fades (CSS-animated, no per-frame work)
function floatChip(id, text, col) {
  const e = TLPOS[id], host = $("tlnodes"); if (!e || !host) return;
  if (host.querySelectorAll(".tchip").length > 9) host.querySelector(".tchip").remove();
  const fam = TOOLICONS.famOfCol(col), c = document.createElement("div"); c.className = "tchip ic"; c.style.setProperty("--c", col || "#ffb454");
  c.innerHTML = TOOLICONS.svg(fam, 14, col); c.setAttribute("aria-hidden", "true");   // full text: node "now" line, card and log
  // beside the card, never on top of its text: right edge (left edge when there is no room), stacked a little apart
  const slot = (floatChip.n = ((floatChip.n || 0) + 1) % 4);
  let x = e.x + e.w + 6 + (slot % 2) * 20, y = e.y + 4 + slot * 14;
  if (x > host.clientWidth - 30) x = Math.max(2, e.x - 26 - (slot % 2) * 20);
  c.style.left = x + "px"; c.style.top = Math.min(y, e.y + Math.max(8, e.h - 24)) + "px";
  c.addEventListener("animationend", () => c.remove()); setTimeout(() => c.remove(), 4200); host.appendChild(c);   // timeout: reduced-motion turns the animation off
}
function showCard(id, ST) {
  const n = TLAY && TLAY.all.find(x => x.id === id), box = $("tcard"); if (!n) { box.hidden = true; return; }
  ST = ST || nodeStates(); const x = ST[id]; TOPEN = id;
  let rows = x.hist.slice();
  if (!rows.length) {
    for (let i = hist.length - 1; i >= 0 && rows.length < 30; i--) {
      const m = hist[i]; if (m.event.sessionId !== selSession) continue;
      const d = describe(m.event); if (nodeIdFor(d.who) !== id || m.event.type === "context_update") continue;
      rows.push({ ts: m._ts, who: d.who, text: d.text });
    }
    rows.reverse();
  }
  const list = rows.slice(-30).reverse().map(r => `<div class="tr"><span>${new Date(r.ts).toTimeString().slice(0, 8)}</span><span>${esc(labelOf(r.who || ""))}</span><span>${esc(String(r.text).replace(/\s+/g, " ").slice(0, 300))}</span></div>`).join("") || `<div class="tr"><span></span><span></span><span>no activity seen for this node in this session</span></div>`;
  box.innerHTML = `<button class="tx" data-close="1" aria-label="Close">&times;</button><h4 style="color:${BANDCOL[n.band]}">${esc(n.name)}</h4><div class="tm2">${esc(BANDLBL[n.band])} · stage ${esc(n.stage || "-")} · ${n.lane ? "lane " + esc(n.lane) + " · " : ""}${esc(n.cost || "")}</div><p>${esc(n.role || "")}</p><div class="tm2">status <b>${esc(x.status)}</b> · live ${x.runs} runs${n.runs ? " · history " + n.runs + " runs, last " + esc(n.last) : ""}${x.last ? " · last " + agoStr(x.last) + " ago" : ""}</div><div class="tm2">now: ${esc(x.doing || "no activity seen")}</div><div class="trs">${list}</div>`;
  box.hidden = false;
}
document.addEventListener("click", ev => {
  if (ev.target.closest("[data-close]")) { TOPEN = null; $("tcard").hidden = true; return; }
  const t = ev.target.closest("[data-tn]"); if (t) showCard(t.dataset.tn);
});
