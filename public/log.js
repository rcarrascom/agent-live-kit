// ---------- log ----------
const KIND = {
  tool_call_start: ["tool", "tool"], tool_call_end: ["result", "res"], message: ["msg", "msg"], subagent_dispatch: ["hand-off", "hand"],
  subagent_return: ["return", "ret"], agent_spawn: ["spawn", "hand"], agent_complete: ["done", "ret"], agent_idle: ["idle", "msg"],
  permission_requested: ["permission", "err"], context_update: ["context", "ctx"], error: ["error", "err"],
};
const GROUP = { tool: "tools", res: "results", msg: "msgs", hand: "hand", ret: "hand", err: "hand", ctx: "ctx" };
function clean(s) {
  s = String(s ?? "");
  if (/"type"\s*:\s*"image"/.test(s) || /"base64"\s*:/.test(s)) return `image (${Math.max(1, Math.round(s.length / 1024))} KB)`;
  return s.replace(/\S{600,}/g, m => `[binary, ${Math.max(1, Math.round(m.length / 1024))} KB]`);
}
function describe(e) {
  const p = e.payload || {};
  switch (e.type) {
    case "tool_call_start": return { who: p.agent, text: `${p.tool}  ${clean(argPreview(p.args))}` };
    case "tool_call_end": { let r = String(p.result || ""); try { const o = JSON.parse(r); r = o.stdout ?? o.content ?? r; } catch {} return { who: p.agent, text: `${p.tool} → ${clean(typeof r === "string" ? r : JSON.stringify(r)).replace(/\s+/g, " ").trim()}${p.tokenCost ? "  (" + p.tokenCost + " tok)" : ""}`, err: String(p.result || "").startsWith("[FAILED]") }; }
    case "message": return { who: p.agent, text: `[${p.role}] ${clean(p.content || "")}` };
    case "subagent_dispatch": return { who: p.parent, text: `→ ${labelOf(p.child)}: ${p.task || ""}` };
    case "subagent_return": return { who: p.child, text: `← ${p.parent}: ${labelOf(p.child)} ${p.summary || "returned"}` };
    case "agent_spawn": return { who: p.name, text: `started${p.parent ? " by " + p.parent : ""}${p.task ? ": " + p.task : ""}` };
    case "agent_complete": return { who: p.name, text: p.sessionEnd ? "session ended" : "finished" };
    case "agent_idle": return { who: p.name, text: "back to work" };
    case "permission_requested": return { who: p.agent, text: `needs permission: ${p.message || p.title || ""}` };
    case "context_update": return { who: p.agent, text: `context ${p.tokens} / ${p.tokensMax || "?"} tokens` };
    default: return { who: p.agent || p.name || "?", text: JSON.stringify(p) };
  }
}
function matches(m) {
  if (m._seq <= floor) return false;
  const [kname, kc] = KIND[m.event.type] || ["other", "msg"];
  if (filt.off.has(GROUP[kc] || "msgs")) return false;
  const d = describe(m.event), b = baseOf(d.who);
  if (filt.agents.size && !filt.agents.has(b)) return false;
  if (filt.q && !(d.text + " " + d.who + " " + kname).toLowerCase().includes(filt.q)) return false;
  return true;
}
const hh = ts => { const d = new Date(ts); return d.toTimeString().slice(0, 8); };
function rowEl(m) {
  const e = m.event, [kname, kc] = KIND[e.type] || [e.type, "msg"], d = describe(e);
  const r = document.createElement("div");
  r.className = "row" + (kc === "res" ? " res" : "") + (m._sim ? " sim" : "");
  r.style.setProperty("--c", colorOf(d.who));
  r.innerHTML = `<span class="t">${hh(m._ts)}</span><span class="w" title="${esc(d.who)}">${esc(labelOf(d.who || "?"))}</span><span class="k ${d.err ? "err" : kc}">${esc(kname)}</span><span class="x"><span class="xt">${esc(d.text)}</span>${d.text.length > 170 ? '<span class="lmore"></span>' : ""}</span><pre class="raw">${esc(JSON.stringify(e, null, 1))}</pre>`;
  r.onclick = () => r.classList.toggle("open");
  return r;
}
let shown = 0;
function appendRow(m) {
  const rows = $("rows"); if (rows.firstElementChild?.className === "empty") rows.innerHTML = "";
  rows.appendChild(rowEl(m)); shown++;
  if (HIDE.log) { logNew++; const b = $("rail-logn"); if (b) b.textContent = `+${logNew} new`; }
  if (autoscroll) rows.scrollTop = rows.scrollHeight;
  $("logn").textContent = shown + " rows";
}
function renderLog() {
  const rows = $("rows"), frag = document.createDocumentFragment(); shown = 0;
  const upto = replay ? rIdx : hist.length;
  for (let i = 0; i < upto; i++) { const m = hist[i]; if (m.event.sessionId === selSession && matches(m)) { frag.appendChild(rowEl(m)); shown++; } }
  rows.innerHTML = ""; if (!shown) rows.innerHTML = `<div class="empty">No events yet. Waiting for the relay (or run <code>agent-live simulate</code>).</div>`; else rows.appendChild(frag);
  $("logn").textContent = shown + " rows";
  if (autoscroll) rows.scrollTop = rows.scrollHeight;
}
function renderFilters() {
  const names = new Set(); for (const a of Object.values(model.agents)) names.add(baseOf(a.name));
  let h = `<button class="fchip" data-all="1" aria-pressed="${filt.agents.size === 0}">all agents</button>`;
  for (const n of names) h += `<button class="fchip" style="--c:${colorOf(n)}" data-ag="${esc(n)}" aria-pressed="${filt.agents.has(n)}"><i></i>${esc(n)}</button>`;
  h += `<span class="sep"></span>`;
  for (const [g, l] of [["tools", "tools"], ["results", "results"], ["msgs", "messages"], ["hand", "hand-offs"], ["ctx", "context"]]) h += `<button class="fchip" data-g="${g}" aria-pressed="${!filt.off.has(g)}">${l}</button>`;
  h += `<span class="sep"></span><input type="search" id="q" placeholder="search log" value="${esc(filt.q)}" style="width:130px"><button class="btn" id="auto" aria-pressed="${autoscroll}">Auto-scroll</button><button class="btn" id="clr">Clear</button>`;
  if ($("lf").dataset.sig === h) return; $("lf").dataset.sig = h;
  const had = document.activeElement?.id === "q"; $("lf").innerHTML = h; if (had) { $("q").focus(); $("q").setSelectionRange(99, 99); }
}
$("lf").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  if (b.dataset.all) filt.agents.clear();
  else if (b.dataset.ag) { filt.agents.has(b.dataset.ag) ? filt.agents.delete(b.dataset.ag) : filt.agents.add(b.dataset.ag); }
  else if (b.dataset.g) { filt.off.has(b.dataset.g) ? filt.off.delete(b.dataset.g) : filt.off.add(b.dataset.g); }
  else if (b.id === "auto") autoscroll = !autoscroll;
  else if (b.id === "clr") { floor = hist.length ? hist[hist.length - 1]._seq : 0; }
  $("lf").dataset.sig = ""; renderFilters(); renderLog();
});
$("lf").addEventListener("input", ev => { if (ev.target.id === "q") { filt.q = ev.target.value.toLowerCase(); renderLog(); } });
$("rows").addEventListener("wheel", () => { }, { passive: true });

