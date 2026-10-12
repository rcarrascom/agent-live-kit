// ---------- team cards ----------
function cardHTML(a, extra) {
  return `<h3>${esc(a.name)}</h3>
    <div class="badges">${a.model === "?" ? '<span class="b">built-in type</span>' : `<span class="b">${esc(a.model)}</span>${a.lane && a.lane !== "?" ? `<span class="b">lane ${esc(a.lane)}</span>` : ""}`}${extra || ""}<span class="b" data-f="acct" hidden></span></div>
    <span class="pill" data-f="pill">idle</span>
    <div class="blk"><div class="lbl" data-f="tasklbl">Task</div><div class="txt prompt" data-f="task" data-k="task">-</div><button class="more" data-more="task" hidden>show more</button></div>
    <div class="desc-wrap"><div class="lbl">Role</div><p class="desc">${esc(a.description)}</p></div>
    <div class="blk"><div class="lbl">Now</div><div class="now" data-f="now" data-k="now"><span class="idle">-</span></div></div>
    <div class="recent" data-f="recent"></div>
    <div class="blk"><div class="lbl">Latest message <span data-f="role"></span></div><div class="txt msgtxt" data-f="msg" data-k="msg">-</div><button class="more" data-more="msg" hidden>show more</button></div>
    <div class="spark" data-f="spark"></div>
    <div class="bar" data-f="barwrap"><div class="barlbl"><span data-f="barl">tokens</span><b data-f="barv"></b></div><div class="track"><i data-f="bar"></i></div></div>
    <div class="stats"><span>time <b data-f="el">-</b></span><span>calls <b data-f="calls">0</b></span><span>tokens <b data-f="tok">0</b></span></div>`;
}
function buildTeam() {
  const g = $("grid"); g.innerHTML = "";
  for (const a of TEAM) {
    const d = document.createElement("article");
    d.className = "card"; d.dataset.name = a.name; d.style.setProperty("--c", colorOf(a.name));
    d.innerHTML = cardHTML(a); g.appendChild(d);
  }
  for (const [k, txt, o] of [["w", "Working now", 99], ["f", "Finished runs", 199], ["i", "Idle team (not called yet)", 299]]) {
    const d = document.createElement("div"); d.className = "sec"; d.dataset.sec = k; d.textContent = txt; d.style.order = o; d.hidden = true; g.appendChild(d);
  }
  $("teamn").textContent = TEAM.length + " agent types";
}
const PRIO = { perm: 5, error: 4, tool: 3, thinking: 2, done: 1, idle: 0 };
const LABEL = { idle: "idle", thinking: "thinking", tool: "tool call", perm: "waiting for permission", done: "done", error: "error" };
function fmtDur(ms) { if (!ms || ms < 0) return "-"; const s = Math.round(ms / 1000); return s < 60 ? s + "s" : Math.floor(s / 60) + "m" + String(s % 60).padStart(2, "0") + "s"; }
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n);
function ensureCard(base) {
  if ($("grid").querySelector(`[data-name="${CSS.escape(base)}"]`)) return;
  const a = { name: base, model: "?", lane: "?", description: base === "sub-agent" ? "Sub-agent runs the relay could not match to a type (no matching meta.json found). Each run is shown by its own task text." : "Seen live; not defined in your agents folder (a built-in agent type)." };
  TEAM.push(a);
  const d = document.createElement("article");
  d.className = "card live-extra"; d.dataset.name = base; d.style.setProperty("--c", colorOf(base));
  d.innerHTML = cardHTML(a, '<span class="b">live</span>'); $("grid").appendChild(d);
}
const expanded = new Set();   // "card|field" keys the user opened
document.addEventListener("click", ev => {
  const card = ev.target.closest(".card"); if (!card) return;
  const more = ev.target.closest("[data-more]");
  const el = more ? card.querySelector(`[data-k="${more.dataset.more}"]`) : ev.target.closest("[data-k]");
  if (!el) return;
  const key = card.dataset.name + "|" + el.dataset.k;
  expanded.has(key) ? expanded.delete(key) : expanded.add(key);
  card.classList.contains("card") && renderTeam();
});
function setBlock(card, field, text) {
  const el = card.querySelector(`[data-f="${field}"]`), btn = card.querySelector(`[data-more="${field}"]`);
  text = text || "-";
  if (el.textContent !== text) el.textContent = text;
  const open = expanded.has(card.dataset.name + "|" + field);
  el.classList.toggle("open", open);
  if (btn) { btn.hidden = text.length < 150; btn.textContent = open ? "show less" : "show more"; }
}
function sparkSvg(stamps) {
  const B = 12, W = 5000, bk = new Array(B).fill(0);
  for (const t of stamps) { const age = nowTs - t; if (age >= 0 && age < B * W) bk[B - 1 - Math.floor(age / W)]++; }
  const mx = Math.max(3, ...bk);
  let r = ""; bk.forEach((v, i) => { const h = v ? Math.max(3, v / mx * 22) : 1; r += `<rect x="${i * 9 + 1}" y="${24 - h}" width="7" height="${h}" rx="1.5" opacity="${v ? 1 : .35}"/>`; });
  return `<svg viewBox="0 0 108 24" preserveAspectRatio="none" aria-label="tool calls in the last 60 s">${r}</svg><span>tool calls, last 60 s</span>`;
}
function recentHTML(tools) {
  return tools.map((t, i) => `<div class="rc ${i === 0 ? "" : "old"}"><span class="tc">${esc(t.tool)}</span><span class="ta">${esc(t.arg || "")}</span></div>`).join("");
}
function runCardFor(a) {
  if ($("grid").querySelector(`[data-name="${CSS.escape(a.name)}"]`)) return;
  const type = baseOf(a.name), t = TEAM.find(x => x.name === type) || { model: "?", lane: "?", description: type === "sub-agent" ? "A run the relay could not match to an agent type yet (see /status unmatched)." : "Built-in agent type (not defined in your agents folder)." };
  const d = document.createElement("article");
  d.className = "card"; d.dataset.name = a.name; d.dataset.run = "1"; d.style.setProperty("--c", colorOf(a.name));
  d.innerHTML = cardHTML({ ...t, name: type === "sub-agent" ? "sub-agent" : type }, '<span class="b">run</span>'); $("grid").appendChild(d);
}
function renderTeam() {
  const allRuns = Object.values(model.agents).filter(a => a.name !== "orchestrator" && a.name !== "subagent");
  const runs = allRuns.filter(a => baseOf(a.name) !== "sub-agent"), unm = allRuns.filter(a => baseOf(a.name) === "sub-agent");
  const um = $("unm"); if (um) { const tx = unm.length ? `unmatched: ${unm.length}` : ""; if (um.textContent !== tx) { um.textContent = tx; um.title = unm.map(a => a.name).join("\n"); um.hidden = !unm.length; } }
  const typesWithRuns = new Set(runs.map(a => baseOf(a.name)));
  for (const a of runs) runCardFor(a);
  const byName = {}; for (const a of Object.values(model.agents)) byName[a.name] = a;
  const acct = accounts[selSession], cnt = { w: 0, f: 0, i: 0 };
  for (const card of $("grid").children) {
    if (card.classList.contains("sec")) continue;
    const nm = card.dataset.name, isRun = card.dataset.run === "1";
    const list = (isRun || nm === "orchestrator") && byName[nm] ? [byName[nm]] : [];
    const hide = (isRun && !list.length) || (!isRun && nm !== "orchestrator" && typesWithRuns.has(nm));
    card.hidden = hide; if (hide) continue;
    let st = "idle", calls = 0, tok = 0, start = 0, end = 0, run = 0, stamps = [], recent = [], lastMsg = null, task = "", cur = null;
    for (const a of list) {
      if ((PRIO[a.status] || 0) > (PRIO[st] || 0)) st = a.status;
      calls += a.calls; tok += a.tokens; if (!start || a.start < start) start = a.start;
      if (a.status === "tool" || a.status === "thinking" || a.status === "perm") run++;
      end = Math.max(end, a.end || 0); stamps = stamps.concat(a.stamps || []); recent = recent.concat(a.recent || []);
      if (a.lastMsg && (!lastMsg || a.lastMsg.ts > lastMsg.ts)) lastMsg = a.lastMsg;
      if (a.task && (!task || a.start >= start)) task = a.task;
      if (a.status === "tool" && (!cur || a.last > cur.last)) cur = a;
    }
    if (nm === "orchestrator") task = model.prompt || task;
    if (isRun) task = taskMap[nm] || task;
    recent.sort((x, y) => y.ts - x.ts);
    const on = st === "tool" || st === "thinking" || st === "perm" || st === "error";
    card.classList.toggle("on", on); card.classList.toggle("done", st === "done");
    const grp = nm === "orchestrator" ? "o" : on ? "w" : isRun ? "f" : "i";
    card.style.order = grp === "o" ? 0 : grp === "w" ? 100 : grp === "f" ? 200 : 300; if (cnt[grp] !== undefined) cnt[grp]++;
    const pill = card.querySelector('[data-f="pill"]');
    pill.className = "pill " + st; pill.textContent = LABEL[st] + (list.length > 1 ? ` (${run || list.length} of ${list.length} runs)` : "");
    card.querySelector('[data-f="tasklbl"]').textContent = nm === "orchestrator" ? "Session prompt (first message, full)" : "Task (full text)";
    setBlock(card, "task", task);
    const ac = card.querySelector('[data-f="acct"]');
    if (nm === "orchestrator") { ac.hidden = false; ac.textContent = "main session" + (acct ? ", " + acct : ""); }
    // now line: tool chip + full argument (wraps, click expands)
    const nowEl = card.querySelector('[data-f="now"]');
    const nowSig = cur ? cur.tool + "\u0001" + cur.arg + (expanded.has(nm + "|now") ? "1" : "0") : (st === "perm" ? "perm" : "-" + st);
    if (nowEl.dataset.sig !== nowSig) {
      nowEl.dataset.sig = nowSig;
      nowEl.innerHTML = cur ? `<span class="tc">${esc(cur.tool)}</span><span class="ta">${esc(cur.arg)}</span>` : (st === "perm" ? `<span class="tc warn">permission</span><span class="ta">waiting for your approval</span>` : `<span class="idle">${st === "thinking" ? "thinking" : "-"}</span>`);
    }
    nowEl.classList.toggle("open", expanded.has(nm + "|now"));
    const rc = card.querySelector('[data-f="recent"]'), rh = recentHTML(recent.slice(cur ? 1 : 0, cur ? 4 : 3));
    if (rc.dataset.sig !== rh) { rc.dataset.sig = rh; rc.innerHTML = rh; }
    setBlock(card, "msg", lastMsg ? lastMsg.text : "");
    card.querySelector('[data-f="role"]').textContent = lastMsg ? "(" + lastMsg.role + ")" : "";
    const sp = card.querySelector('[data-f="spark"]'), sh = sparkSvg(stamps);
    if (sp.dataset.sig !== sh) { sp.dataset.sig = sh; sp.innerHTML = sh; }
    // bar: orchestrator = context window use, others = share of the run's tokens
    const bar = card.querySelector('[data-f="bar"]'), bl = card.querySelector('[data-f="barl"]'), bv = card.querySelector('[data-f="barv"]');
    let pct = 0, txt = "", col = "var(--ice)";
    if (nm === "orchestrator" && model.ctx) {
      const mx = model.ctx.max || 1000000; pct = Math.min(100, model.ctx.tokens / mx * 100);
      bl.textContent = "context"; txt = `${fmtN(model.ctx.tokens)} / ${fmtN(mx)} tokens (${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%)`;
      col = pct >= 80 ? "var(--blood)" : pct >= 60 ? "var(--ember)" : "var(--moss)";
    } else { const tot = Math.max(1, model.tokens); pct = Math.min(100, tok / tot * 100); bl.textContent = "share of run tokens"; txt = `${fmtN(tok)} (${Math.round(pct)}%)`; }
    bar.style.width = Math.max(pct, tok || pct ? 2 : 0) + "%"; bar.style.background = col; bv.textContent = txt;
    card.querySelector('[data-f="el"]').textContent = list.length ? fmtDur((on ? nowTs : (end || nowTs)) - start) : "-";
    card.querySelector('[data-f="calls"]').textContent = calls;
    card.querySelector('[data-f="tok"]').textContent = fmtN(tok);
  }
  for (const d of $("grid").querySelectorAll(".sec")) d.hidden = !cnt[d.dataset.sec];
}

