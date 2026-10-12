// Agent Live server: serves the page, proxies the relay's event stream (it sends no CORS headers), keeps a ring buffer plus a
// JSONL history file, and answers /team.json, /rules.json, /agents.json, /history, /status. Node built-ins only.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { teamPayload, allRules } from "./config.mjs";
import { readAgents } from "./agents.mjs";
import { claudeConfigDirs, claudeProjectDirs } from "./paths.mjs";
import { createHistory } from "./history.mjs";
import { createMetaIndex } from "./metas.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.join(HERE, "..", "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml" };
const SEEN_MAX = 6000;

export function createAgentLive({ cfg, root, upstream = true, watchMetas = true, publicDir = PUBLIC_DIR }) {
  const hist = createHistory(cfg.history);
  const ring = hist.events;
  const sessions = {}, clients = new Set(), seen = new Set(), named = new Set(), warned = new Set(), unmatched = [], runInfo = new Map();
  let seq = 0, upstreamUp = false, httpServer = null, timers = [], stopped = false;

  const configDirs = claudeConfigDirs(cfg);
  const metas = createMetaIndex({ cfg, getProjectDirs: () => claudeProjectDirs(cfg, root, configDirs) });

  const broadcast = obj => { const s = `data: ${JSON.stringify(obj)}\n\n`; for (const c of clients) { try { c.write(s); } catch {} } };
  const isSim = id => String(id).startsWith("sim-");

  // ---- identity: attach the exact agent type and task to the first event of every run ----
  function annotate(e) {
    const p = e.payload || {};
    const name = p.agent || p.name || p.child;
    if (!name || name === "orchestrator" || name === "subagent" || p.isMain) return;
    const key = e.sessionId + "|" + name;
    if (named.has(key)) return;
    let r = metas.resolveRun(e.sessionId, name);
    if (!r && Date.now() - metas.lastScan > 1000) { metas.scan(); r = metas.resolveRun(e.sessionId, name); }
    if (r) {
      named.add(key); e._type = r.type; e._task = r.description; e._name = name; e._agentId = r.id; e._account = r.account;
      const info = { type: "run-info", sessionId: e.sessionId, name, agentType: r.type, task: r.description, agentId: r.id, account: r.account };
      runInfo.set(key, info); broadcast(info);
      const k = unmatched.findIndex(u => u.name === name && u.session === String(e.sessionId).slice(0, 8)); if (k >= 0) unmatched.splice(k, 1);
    } else if (!warned.has(key) && !isSim(e.sessionId) && !String(e.sessionId).startsWith("demo-")) {
      warned.add(key);
      unmatched.push({ name, session: String(e.sessionId).slice(0, 8), reason: "no subagents/*.meta.json of this session has a description starting with the name (the file may not exist yet; retried on the next event)" });
    }
  }
  function metaApply(msg) {
    if (msg.type === "session-list") for (const s of msg.sessions || []) sessions[s.id] = { ...sessions[s.id], ...s };
    if (msg.type === "session-started") sessions[msg.sessionId] = { ...sessions[msg.sessionId], id: msg.sessionId, label: msg.label, status: "active" };
    if (msg.type === "session-updated" && sessions[msg.sessionId]) sessions[msg.sessionId].label = msg.label;
    if (msg.type === "session-ended" && sessions[msg.sessionId]) sessions[msg.sessionId].status = "completed";
  }
  const evKey = e => `${e.sessionId}|${e.time}|${e.type}|${JSON.stringify(e.payload)}`;
  function replayOne(o) {
    if (isSim(JSON.stringify(o).slice(0, 400).match(/"sessionId":"([^"]*)"/)?.[1] || "")) return;
    if (o.type === "agent-event") {
      const e = o.event;
      if (!e._type) annotate(e);
      hist.push(o); seen.add(evKey(e));
      if (e.sessionId && !sessions[e.sessionId]) sessions[e.sessionId] = { id: e.sessionId, label: e.sessionId.slice(0, 8), status: "active" };
    } else metaApply(o);
  }
  function ingest(msg, sim = false) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "agent-event-batch") { for (const e of msg.events || []) ingest({ type: "agent-event", event: e }, sim); return; }
    metaApply(msg);
    if (msg.type === "agent-event") {
      const e = msg.event || {};
      if (!sim) { const k = evKey(e); if (seen.has(k)) return; seen.add(k); if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value); }
      if (e.sessionId && !sessions[e.sessionId]) sessions[e.sessionId] = { id: e.sessionId, label: e.sessionId.slice(0, 8), status: "active" };
    }
    const out = { ...msg, _seq: ++seq, _ts: Date.now(), ...(sim ? { _sim: true } : {}) };
    if (msg.type === "agent-event" && !out.event._type) annotate(out.event);
    if (!sim) hist.append(out);
    if (msg.type === "agent-event") hist.push(out);
    broadcast(out);
  }

  // ---- relay connection ----
  function setUp(v) { if (v !== upstreamUp) { upstreamUp = v; broadcast({ type: "server-status", upstream: v }); } }
  async function connectUpstream() {
    while (!stopped) {
      try {
        const res = await fetch(cfg.relayUrl + "/events", { headers: { accept: "text/event-stream" } });
        if (!res.ok || !res.body) throw new Error("status " + res.status);
        setUp(true);
        const dec = new TextDecoder(); let buf = "";
        for await (const chunk of res.body) {
          buf += dec.decode(chunk, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i); buf = buf.slice(i + 2);
            const data = block.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n");
            if (!data) continue;
            try { ingest(JSON.parse(data)); } catch {}
          }
        }
      } catch {}
      if (!stopped) await new Promise(r => setTimeout(r, 2000));
    }
  }

  // ---- http ----
  const json = (res, o, code = 200) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(o)); };
  function agentsJson() {
    const { agents } = readAgents(root, cfg.agentsDirs);
    const team = teamPayload(cfg, root), byId = Object.fromEntries(team.nodes.map(n => [n.id, n]));
    const list = agents.map(a => ({ name: a.name, description: a.description, model: a.model, tools: a.tools || "all", lane: (byId[a.name] || {}).lane || "", role: (byId[a.name] || {}).role || "" }));
    list.unshift({ name: "orchestrator", description: cfg.orchestrator.role, model: "session model", tools: "all", lane: "", role: "main session" });
    return list;
  }
  function historyJson(url) {
    const showSim = url.searchParams.get("sim") === "1", ok = id => showSim || !isSim(id), ss = {}, acc = {};
    for (const id of Object.keys(sessions)) { if (!ok(id)) continue; ss[id] = sessions[id]; const a = metas.accountBySession[id]; if (a) acc[id] = a; }
    return { runs: [...runInfo.values()].filter(r => ok(r.sessionId)), events: ring.filter(x => ok(x.event ? x.event.sessionId : "")), sessions: ss, accounts: acc, upstream: upstreamUp, seq };
  }
  function handler(req, res) {
    const url = new URL(req.url, "http://x"), p = url.pathname;
    if (p === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`data: ${JSON.stringify({ type: "server-status", upstream: upstreamUp })}\n\n`);
      clients.add(res);
      const ka = setInterval(() => { try { res.write(": ka\n\n"); } catch {} }, 15000);
      req.on("close", () => { clearInterval(ka); clients.delete(res); });
      return;
    }
    if (p === "/history") return json(res, historyJson(url));
    if (p === "/agents.json") return json(res, agentsJson());
    if (p === "/team.json") return json(res, teamPayload(cfg, root));
    if (p === "/rules.json") return json(res, { rules: allRules(cfg) });
    if (p === "/health") return json(res, { agentLive: true, project: cfg.project });
    if (p === "/status") return json(res, { agentLive: true, project: cfg.project, upstream: upstreamUp, clients: clients.size, buffered: ring.length, seq, runsKnown: metas.metas.length, unmatched, historyFile: hist.file, historyWritable: hist.writable });
    if (p === "/inject" && req.method === "POST") {
      let b = ""; req.on("data", d => b += d);
      req.on("end", () => { try { const m = JSON.parse(b); for (const x of Array.isArray(m) ? m : [m]) ingest(x, true); json(res, { ok: true }); } catch (e) { json(res, { error: String(e) }, 400); } });
      return;
    }
    if (p === "/clear-sim" && req.method === "POST") { for (let i = ring.length - 1; i >= 0; i--) if (ring[i]._sim) ring.splice(i, 1); return json(res, { ok: true }); }
    const file = p === "/" ? "index.html" : path.basename(p);
    const fp = path.join(publicDir, file);
    if (MIME[path.extname(fp)] && fs.existsSync(fp)) { res.writeHead(200, { "content-type": MIME[path.extname(fp)], "cache-control": "no-store" }); return res.end(fs.readFileSync(fp)); }
    res.writeHead(404); res.end("not found");
  }

  function start(port = cfg.port, host = "127.0.0.1") {
    hist.load(o => { if (o._seq > seq) seq = o._seq; replayOne(o); });
    if (watchMetas) { metas.scan(); timers.push(setInterval(metas.scan, 3000)); }
    if (upstream) {
      const probe = async () => { try { const r = await fetch(cfg.relayUrl + "/", { signal: AbortSignal.timeout(1500) }); setUp(r.ok || r.status < 500); } catch { setUp(false); } };
      timers.push(setInterval(probe, 2000)); connectUpstream();
    }
    httpServer = http.createServer(handler);
    return new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(port, host, () => resolve(httpServer.address().port));
    });
  }
  function stop() {
    stopped = true; timers.forEach(clearInterval);
    for (const c of clients) { try { c.end(); } catch {} }
    return new Promise(r => { if (!httpServer) return r(); httpServer.close(() => r()); if (httpServer.closeAllConnections) httpServer.closeAllConnections(); });
  }
  return { start, stop, ingest, hist, metas, sessions, runInfo, annotate, get seq() { return seq; } };
}
