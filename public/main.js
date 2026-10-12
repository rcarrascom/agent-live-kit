// ---------- ticker (last 3 events, fading; the full log stays below) ----------
function ticker(m) {
  if (m.event.type === "context_update") return;
  const d = describe(m.event), box = $("ticker"), el = document.createElement("div");
  el.textContent = `${labelOf(d.who || "?")}: ${String(d.text).replace(/\s+/g, " ").slice(0, 140)}`;
  box.appendChild(el); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 12000);
}
let FXON = true, FXEXPL = false; try { const v = localStorage.getItem("al_fx"); if (v !== null) { FXON = v === "1"; FXEXPL = FXON; } } catch {}
function applyFx() { FX.setOn(FXON, FXEXPL); $("fxbtn").setAttribute("aria-pressed", FXON); }
$("fxbtn").onclick = () => { FXON = !FXON; FXEXPL = FXON; try { localStorage.setItem("al_fx", FXON ? "1" : "0"); } catch {} applyFx(); };
// ---------- top bar ----------
function renderKpis() {
  let act = 0; for (const a of Object.values(model.agents)) if (a.status === "tool" || a.status === "thinking" || a.status === "perm") act++;
  $("k_act").textContent = act; { const rn = $("rail-n"); if (rn) rn.textContent = act ? `· ${act} working` : ""; } $("k_calls").textContent = model.calls;
  $("k_tok").textContent = fmtN(model.tokens + (model.ctx?.tokens || 0)); $("k_ev").textContent = model.events;
}
let dirty = true, lastSlow = 0;
function renderAll(full) {
  renderTeam(); renderFlow(); renderKpis(); renderFilters();
  if (full) renderLog();
  dirty = false;
}
setInterval(() => {
  if (!replay) nowTs = Date.now();
  if (dirty || performance.now() - lastSlow > 1000) { lastSlow = performance.now(); renderTeam(); renderFlow(); renderKpis(); renderFilters(); dirty = false; }
}, 150);

// ---------- replay ----------
$("rbtn").onclick = () => {
  replay = !replay; $("rbtn").setAttribute("aria-pressed", replay); $("rctl").hidden = !replay;
  stopPlay(); rIdx = replay ? hist.length : 0; $("rrange").max = hist.length; $("rrange").value = rIdx;
  $("rlab").textContent = `${rIdx}/${hist.length}`; rebuild();
};
$("rrange").oninput = e => { stopPlay(); rIdx = +e.target.value; $("rlab").textContent = `${rIdx}/${hist.length}`; rebuild(); };
function stopPlay() { if (playing) { clearInterval(playing); playing = null; $("rplay").textContent = "Play"; } }
$("rplay").onclick = () => {
  if (playing) return stopPlay();
  if (rIdx >= hist.length) rIdx = 0;
  $("rplay").textContent = "Pause"; rebuild();
  playing = setInterval(() => {
    if (rIdx >= hist.length) return stopPlay();
    const m = hist[rIdx++];
    $("rrange").value = rIdx; $("rlab").textContent = `${rIdx}/${hist.length}`;
    if (m.event.sessionId === selSession) { apply(model, m, spawnPacket); nowTs = m._ts; dirty = true; if (matches(m)) appendRow(m); }
  }, 120);
};

// ---------- size (S / M / L), remembered ----------
let ZS = "M"; try { ZS = localStorage.getItem("al_zoom") || "M"; } catch {}
function applyZoom() {
  const base = { S: .64, M: .8, L: 1 }[ZS] || .8, w = innerWidth;
  const z = w <= 1100 ? 1 : base * Math.min(1.35, Math.max(.85, w / 1920));
  document.documentElement.style.setProperty("--z", z.toFixed(3)); document.body.style.zoom = z.toFixed(3);
  document.querySelectorAll(".zoom button").forEach(b => b.setAttribute("aria-pressed", b.dataset.z === ZS));
  dirty = true;
}
document.querySelector(".zoom").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; ZS = b.dataset.z; try { localStorage.setItem("al_zoom", ZS); } catch {} applyZoom(); });
addEventListener("resize", applyZoom);
// ---------- focus mode: the Live Flow panel fills the window (F, Esc) ----------
function setFocus(on) { document.body.classList.toggle("focus", on); $("focusbtn").innerHTML = on ? "&#10005; Exit focus (Esc)" : "&#9974; Focus"; dirty = true; renderFlow(); }
$("focusbtn").onclick = () => setFocus(!document.body.classList.contains("focus"));
addEventListener("keydown", ev => {
  if (ev.target.closest && ev.target.closest("input,select,textarea")) return;
  if (ev.key === "Escape" && document.body.classList.contains("focus")) setFocus(false);
  else if ((ev.key === "f" || ev.key === "F") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) setFocus(!document.body.classList.contains("focus"));
});
addEventListener("resize", () => { dirty = true; });
// ---------- hide / show the Team panel and the Activity log (T, L; remembered) ----------
const HIDE = { team: false, log: false }; let logNew = 0;
try { HIDE.team = localStorage.getItem("al_hide_team") === "1"; HIDE.log = localStorage.getItem("al_hide_log") === "1"; } catch {}
{ const hp = new URLSearchParams(location.search).get("hide"); if (hp !== null) { HIDE.team = hp.includes("team"); HIDE.log = hp.includes("log"); } }   // ?hide=team,log forces a state (tests)
function applyHide(animate) {
  document.body.classList.toggle("hide-team", HIDE.team); document.body.classList.toggle("hide-log", HIDE.log);
  $("rail-team").hidden = !HIDE.team; $("rail-log").hidden = !HIDE.log;
  if (!HIDE.log) { logNew = 0; const r = $("rows"); if (r && autoscroll) r.scrollTop = r.scrollHeight; }
  $("rail-logn").textContent = logNew ? `+${logNew} new` : "";
  try { localStorage.setItem("al_hide_team", HIDE.team ? "1" : "0"); localStorage.setItem("al_hide_log", HIDE.log ? "1" : "0"); } catch {}
  dirty = true; for (const ms of [0, 120, 260, 480, 800]) setTimeout(() => { dirty = true; renderFlow(); }, ms);
}
function toggleHide(which, v) { HIDE[which] = v === undefined ? !HIDE[which] : v; applyHide(); }
document.addEventListener("click", ev => {
  const c = ev.target.closest("[data-hide]"); if (c) toggleHide(c.dataset.hide, true);
  const s = ev.target.closest("[data-show]"); if (s) toggleHide(s.dataset.show, false);
});
addEventListener("keydown", ev => {
  if (ev.target.closest && ev.target.closest("input,select,textarea")) return; if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key === "t" || ev.key === "T") toggleHide("team");
  else if (ev.key === "l" || ev.key === "L") toggleHide("log");
  else if (ev.key === "Escape" && (HIDE.team || HIDE.log) && !document.body.classList.contains("focus")) { HIDE.team = HIDE.log = false; applyHide(); }
});
if (typeof ResizeObserver !== "undefined") { let rt = 0; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { dirty = true; renderFlow(); }, 60); }).observe($("flowwrap")); }
// ---------- boot ----------
(async function boot() {
  applySkin(); applyZoom(); applyHide(); await loadTeam(); { const pj = TEAMCFG.project || ""; $("proj").textContent = pj; document.title = (pj ? pj + " - " : "") + "Agent Live"; }
  if (new URLSearchParams(location.search).get("focus") === "1") document.body.classList.add("focus"); FX.init({ canvas: $("fx"), wrap: $("flowwrap"), svg: $("svg") }); TLFX.init({ canvas: $("fx2"), box: $("tl") }); TLFX.onChip(floatChip); applyFx(); applySkin();
  try { TEAM = await (await fetch("/agents.json")).json(); } catch { TEAM = [{ name: "orchestrator", description: "Main session.", model: "?", lane: "" }]; }
  TEAM.forEach(a => known.add(a.name)); TN.forEach(n => known.add(n.id)); TEAM.forEach(a => colorOf(a.name));
  buildTeam();
  try {
    const h = await (await fetch("/history" + (SHOWSIM ? "?sim=1" : ""))).json();
    Object.assign(sessions, h.sessions || {});
    Object.assign(accounts, h.accounts || {});
    for (const r of h.runs || []) learnRun(r);
    for (const m of h.events) { learn(m); hist.push(m); }
    setConn(h.upstream);
    { const pq = new URLSearchParams(location.search).get("session"); if (pq) userPicked = true; lastSelEv = Date.now(); if (hist.length) selSession = pq || hist[hist.length - 1].event.sessionId; }
  } catch {}
  if (!selSession) selSession = Object.keys(sessions)[0] || null;
  fillSessions(); $("rrange").max = hist.length; rebuild();
  connect();
})();
