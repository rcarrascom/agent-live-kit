"use strict";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const CHIP_MS = 10000;

// ---------- data ----------
let TEAM = [];                 // from /agents.json
const hist = [];               // agent-event messages (with _seq, _ts)
const sessions = {};           // id -> {label,status}
let selSession = null, userPicked = false, lastSelEv = 0;   // userPicked false = follow the latest session
let replay = false, rIdx = 0, playing = null;
let floor = 0;                 // log floor (Clear button)
const filt = { agents: new Set(), off: new Set(["ctx"]), q: "" };
let autoscroll = true;
const colorIdx = {};
function colorRaw(name) { return baseOf(name) === "orchestrator" ? (BANDCOL.claude || "#7cc8ff") : colorOf(name); }
function colorOf(name) {
  let b = baseOf(name);
  if (b === "orchestrator") return "var(--ice)";
  if (b === "sub-agent") b = String(name);
  if (!(b in colorIdx)) colorIdx[b] = Object.keys(colorIdx).length;
  return `hsl(${Math.round((colorIdx[b] * 137.5 + 20) % 360)} 68% 70%)`;
}
const SHOWSIM = new URLSearchParams(location.search).get("sim") === "1";
// run identity (type, task, merge of the two names of a resumed run): public/identity.js, unit-tested
const ID = Identity.create();
const { known, typeMap, accounts, titles, taskMap, idAlias, baseOf, learnRun, learn } = ID;
const labelOf = n => (baseOf(n) === "sub-agent" ? String(n) : baseOf(n));

// ---------- model ----------
function newModel() { return { agents: {}, edges: [], chips: [], ctx: null, prompt: "", tl: { nodes: {}, waiting: null }, calls: 0, tokens: 0, events: 0, first: 0 }; }
function ensure(M, name, ts) {
  if (!M.agents[name]) M.agents[name] = { name, base: baseOf(name), parent: null, task: "", status: "idle", tool: "", arg: "", start: ts, end: 0, calls: 0, tokens: 0, last: ts, stamps: [], recent: [], lastMsg: null };
  return M.agents[name];
}
function argPreview(a) {
  if (a == null) return "";
  let s = String(a);
  if (s[0] === "{") {
    try {
      const o = JSON.parse(s);
      const k = ["command", "file_path", "pattern", "prompt", "description", "url", "query", "path"].find(k => o[k]);
      s = k ? String(o[k]) : Object.values(o).join(" ");
    } catch {}
  }
  return s.replace(/\s+/g, " ").trim();
}
function apply(M, msg, anim) {
  const e = msg.event, p = { ...(e.payload || {}) }, ts = msg._ts;
  for (const k of ["agent", "name", "child"]) if (p[k] && idAlias[p[k]]) p[k] = idAlias[p[k]];
  M.events++; if (!M.first) M.first = ts;
  const A = n => {
    const a = ensure(M, n || "orchestrator", ts);
    // a sub-agent seen without a dispatch event (the relay often sends only agent_spawn): draw its edge anyway
    if (!M.noLazy && a.name !== "orchestrator" && a.name !== "subagent" && !M.edges.some(x => x.child === a.name)) {
      const ed = { id: M.edges.length, parent: a.parent || "orchestrator", child: a.name, task: a.task || taskMap[a.name] || "", state: "out", ts, lazy: true };
      M.edges.push(ed); if (anim) anim(ed, "out");
    }
    return a;
  };
  const closeOldest = (anim2) => { const ed = M.edges.find(x => x.state === "out"); if (ed) { ed.state = "done"; const c = M.agents[ed.child]; if (c) { c.status = "done"; c.end = ts; c.tool = ""; c.arg = ""; } if (anim2 && anim) anim(ed, "back"); } return ed; };
  switch (e.type) {
    case "agent_spawn": {
      const a = A(p.name); a.status = "thinking"; a.start = ts; a.end = 0; if (p.parent) a.parent = p.parent; if (p.task) a.task = p.task;
      const le = M.edges.find(x => x.child === p.name && x.lazy && !x.task); if (le && p.task) le.task = p.task;
      break; }
    case "subagent_dispatch": {
      M.noLazy = true; const c = A(p.child); M.noLazy = false; c.parent = p.parent || "orchestrator"; c.task = p.task || c.task; c.status = "thinking"; c.start = ts; c.end = 0;
      A(c.parent);
      const ed = { id: M.edges.length, parent: c.parent, child: p.child, task: p.task || "", state: "out", ts };
      M.edges.push(ed); if (anim) anim(ed, "out");
      break; }
    case "tool_call_start": {
      const a = A(p.agent); a.status = "tool"; a.tool = p.tool; a.arg = argPreview(p.args); a.calls++; a.last = ts; a.end = 0; M.calls++;
      if (anim) FX.hook("tool", { name: fxName(a.name), tool: p.tool, arg: a.arg });
      tlClear(M, a); if (typeof tlRules === "function") tlRules(M, a, p, ts, anim);
      a.lastDoing = `${p.tool}: ${a.arg}`; a.stamps.push(ts); if (a.stamps.length > 300) a.stamps.shift(); a.recent.unshift({ tool: p.tool, arg: a.arg, ts }); if (a.recent.length > 6) a.recent.pop();
      M.chips.push({ agent: a.name, tool: p.tool, arg: a.arg, ts }); if (M.chips.length > 60) M.chips.shift();
      break; }
    case "tool_call_end": {
      const a = A(p.agent); a.tokens += p.tokenCost || 0; M.tokens += p.tokenCost || 0; a.last = ts;
      a.status = String(p.result || "").startsWith("[FAILED]") ? "error" : "thinking"; a.tool = ""; a.arg = "";
      if (a.status === "error") a.errAt = ts;
      if (anim) FX.hook("result", { name: fxName(a.name), tool: p.tool, err: a.status === "error" });
      tlClear(M, a);
      break; }
    case "message": { const a = A(p.agent); if (a.status === "idle" || a.status === "done") a.status = "thinking"; a.last = ts;
      if (p.role !== "user") a.lastMsg = { role: p.role, text: p.content || "", ts };
      else if ((p.agent || "orchestrator") === "orchestrator") { if (!M.prompt) M.prompt = p.content || ""; tlUser(M, p, ts); }
      break; }
    case "permission_requested": { const a = A(p.agent); a.status = "perm"; a.last = ts; if (anim) FX.hook("perm", { name: fxName(a.name) }); tlWait(M, p, ts, a); break; }
    case "agent_idle": { const a = A(p.name); a.status = "thinking"; break; }
    case "subagent_return": {
      if (p.child === "subagent") { closeOldest(true); break; }   // hook-born returns carry no name: close the oldest open run
      let ed = null;
      for (let i = M.edges.length - 1; i >= 0; i--) if (M.edges[i].state === "out" && (M.edges[i].child === p.child)) { ed = M.edges[i]; break; }
      if (!ed) for (let i = M.edges.length - 1; i >= 0; i--) if (M.edges[i].state === "out" && M.edges[i].parent === p.parent) { ed = M.edges[i]; break; }
      if (ed) { ed.state = "done"; ed.summary = p.summary; if (anim) anim(ed, "back"); }
      break; }
    case "agent_complete": {
      if (p.name === "subagent") { closeOldest(false); break; }
      const a = A(p.name); a.status = "done"; a.end = ts; a.tool = ""; a.arg = "";
      if (anim) FX.hook("done", { name: fxName(a.name) });
      const ed = M.edges.find(x => x.child === p.name && x.state === "out"); if (ed) ed.state = "done";
      break; }
    case "context_update": M.ctx = { tokens: p.tokens, max: p.tokensMax }; break;
  }
}
let model = newModel();
function sessionEvents(sid, upto) {
  const out = [];
  for (let i = 0; i < hist.length && i < upto; i++) if (hist[i].event.sessionId === sid) out.push(hist[i]);
  return out;
}
function rebuild() {
  model = newModel();
  const upto = replay ? rIdx : hist.length;
  for (const m of sessionEvents(selSession, upto)) apply(model, m, null);
  nowTs = replay ? (hist[Math.max(0, rIdx - 1)]?._ts || Date.now()) : Date.now();
  renderAll(true);
}
let nowTs = Date.now();

