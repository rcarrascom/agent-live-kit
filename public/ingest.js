// ---------- ingest ----------
function onMsg(m) {
  if (m.type === "server-status") return setConn(m.upstream);
  if (m.type === "run-info") { learnRun(m); if (!replay && selSession) rebuild(); return; }
  if (m.type === "session-list") for (const s of m.sessions || []) sessions[s.id] = { ...sessions[s.id], ...s };
  else if (m.type === "session-started") sessions[m.sessionId] = { ...sessions[m.sessionId], label: m.label, status: "active" };
  else if (m.type === "session-updated") { (sessions[m.sessionId] ||= {}).label = m.label; }
  else if (m.type === "session-ended") { (sessions[m.sessionId] ||= {}).status = "completed"; }
  if (m.type !== "agent-event") { fillSessions(); return; }
  const sid = m.event.sessionId;
  if (!SHOWSIM && String(sid).startsWith("sim-")) return;
  const fresh = !sessions[sid];
  if (fresh) sessions[sid] = { label: sid.slice(0, 8), status: "active" };
  learn(m); hist.push(m);
  if (sid === selSession) lastSelEv = Date.now();
  if (!userPicked && sid !== selSession && (fresh || !selSession || Date.now() - lastSelEv > 8000)) { selSession = sid; fillSessions(); if (!replay) rebuild(); }
  $("rrange").max = hist.length;
  if (replay) { $("rlab").textContent = `${rIdx}/${hist.length}`; return; }
  if (sid === selSession) { apply(model, m, spawnPacket); nowTs = Date.now(); dirty = true; if (matches(m)) appendRow(m); ticker(m); }
  fillSessions();
}
function setConn(up) {
  relayUp = !!up;
  $("cdot").className = "dot " + (up ? "up" : "half");
  $("ctxt").textContent = up ? "live: relay connected" : "page connected, relay not reachable (retrying)";
}
function connect() {
  const es = new EventSource("/events");
  es.onopen = () => { $("cdot").className = "dot half"; $("ctxt").textContent = "connected to server"; };
  es.onmessage = ev => { try { onMsg(JSON.parse(ev.data)); } catch {} };
  es.onerror = () => { $("cdot").className = "dot"; $("ctxt").textContent = "server down: reconnecting"; };
}

// ---------- session select ----------
function fillSessions() {
  const sel = $("sess"), ids = Object.keys(sessions);
  const sig = (userPicked ? "p" : "a") + ids.map(i => i + (sessions[i].label || "") + (sessions[i].status || "") + (titles[i] || "").length + (accounts[i] || "")).join("|") + selSession;
  if (sel.dataset.sig === sig) return; sel.dataset.sig = sig;
  sel.innerHTML = ids.length ? `<option value="auto" ${userPicked ? "" : "selected"}>Latest session (auto-follow)</option>` + ids.map(i => `<option value="${esc(i)}" ${userPicked && i === selSession ? "selected" : ""}>${esc((accounts[i] ? "Account " + accounts[i] + " · " : "") + String(titles[i] || sessions[i].label || "session").replace(/\s+/g, " ").slice(0, 48) + " · " + i.slice(0, 6) + (sessions[i].status === "completed" ? " (ended)" : ""))}</option>`).join("") : `<option>no session yet</option>`;
}
$("sess").onchange = e => {
  if (e.target.value === "auto") { userPicked = false; if (hist.length) selSession = hist[hist.length - 1].event.sessionId; }
  else { selSession = e.target.value; userPicked = true; }
  $("sess").dataset.sig = ""; fillSessions(); rebuild();
};

