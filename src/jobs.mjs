// Headless job runs: background `claude -p` runs (cron, scripts, a conductor) never fire the interactive hooks the same way, so
// they are invisible on the map. If your script writes a pid file per run into a folder listed in "jobs.pidDirs", each file
// becomes a live session "job-<name>": started while the process is alive, completed when it exits. The tool calls come from
// the newest transcript (.jsonl) of this project's Claude session folders. Optional, off unless "jobs.pidDirs" is set.
import fs from "node:fs";
import path from "node:path";

// true when a process with this pid exists (works on Windows, macOS and Linux; EPERM means it exists but is not ours)
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

// "2026-10-01_nightly_build.pid" -> "nightly build"; a "<same name>.md" next to it gives its first "# heading" instead
export function jobTitle(dir, file) {
  const base = file.replace(/\.pid$/, "");
  try {
    const t = fs.readFileSync(path.join(dir, base + ".md"), "utf8").split(/\r?\n/).find(l => /^#\s/.test(l));
    if (t) return t.replace(/^#+\s*/, "").slice(0, 120);
  } catch {}
  return base.replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/[_-]+/g, " ").slice(0, 120);
}

export function createJobs({ cfg, root, ingest, getProjectDirs, alive = pidAlive, log = () => {} }) {
  const dirs = ((cfg.jobs && cfg.jobs.pidDirs) || []).map(d => path.resolve(root, d)).filter(d => { const r = path.relative(root, d); return !r.startsWith("..") && !path.isAbsolute(r); });
  const jobs = new Map();   // pid file -> job
  const ev = (j, type, payload) => ingest({ type: "agent-event", event: { time: Date.now() / 1000, type, payload, sessionId: j.sid } });

  function newestTranscript(since) {
    let best = null, bt = 0;
    for (const pr of getProjectDirs()) {
      let files = []; try { files = fs.readdirSync(pr.dir).filter(f => f.endsWith(".jsonl")); } catch { continue; }
      for (const f of files) { const fp = path.join(pr.dir, f); try { const m = fs.statSync(fp).mtimeMs; if (m > bt && m >= since - 60000) { bt = m; best = fp; } } catch {} }
    }
    return best;
  }
  function tail(j) {
    const tx = newestTranscript(j.start); if (!tx) return;
    let st; try { st = fs.statSync(tx); } catch { return; }
    if (j.tx !== tx) { j.tx = tx; j.off = Math.max(0, st.size - 200000); }
    if (st.size <= j.off) return;
    const b = Buffer.alloc(Math.min(st.size - j.off, 2000000));
    const fd = fs.openSync(tx, "r"); try { fs.readSync(fd, b, 0, b.length, j.off); } finally { fs.closeSync(fd); }
    const txt = b.toString("utf8"), cut = txt.lastIndexOf("\n") + 1; j.off += Buffer.byteLength(txt.slice(0, cut));
    for (const line of txt.slice(0, cut).split("\n")) {
      let r; try { r = JSON.parse(line); } catch { continue; }
      if ((r.timestamp ? new Date(r.timestamp).getTime() : Date.now()) < j.start - 5000) continue;
      const c = r.message && r.message.content; if (!Array.isArray(c)) continue;
      for (const x of c) {
        if (x.type === "tool_use") { const a = typeof x.input === "string" ? x.input : JSON.stringify(x.input || {}); j.pending = x.name; ev(j, "tool_call_start", { agent: "orchestrator", tool: x.name, args: a.slice(0, 400), preview: x.name }); }
        else if (x.type === "tool_result" && j.pending) { const t = typeof x.content === "string" ? x.content : JSON.stringify(x.content || ""); ev(j, "tool_call_end", { agent: "orchestrator", tool: j.pending, result: t.slice(0, 200), tokenCost: Math.round(t.length / 4) }); j.pending = null; }
        else if (x.type === "text" && r.type === "assistant" && x.text) ev(j, "message", { agent: "orchestrator", role: "assistant", content: x.text.slice(0, 1500) });
      }
    }
  }
  function scan() {
    for (const dir of dirs) {
      let files = []; try { files = fs.readdirSync(dir).filter(f => f.endsWith(".pid")); } catch { continue; }
      for (const f of files) {
        const fp = path.join(dir, f); let j = jobs.get(fp);
        if (!j) {
          let st, pid; try { st = fs.statSync(fp); pid = parseInt(fs.readFileSync(fp, "utf8").trim(), 10); } catch { continue; }
          if (!alive(pid) || Date.now() - st.mtimeMs > 24 * 3600e3) { jobs.set(fp, { done: true }); continue; }
          const title = jobTitle(dir, f), sid = "job-" + f.replace(/\.pid$/, "");
          j = { sid, pid, start: st.mtimeMs, title, alive: true }; jobs.set(fp, j);
          ingest({ type: "session-started", sessionId: sid, label: "headless: " + title });
          ev(j, "agent_spawn", { name: "orchestrator", isMain: true, task: "Headless job: " + title });
          ev(j, "message", { agent: "orchestrator", role: "user", content: `Headless job (pid ${pid}): ${title}` });
          log("job run seen: " + sid);
        }
        if (j.done) continue;
        if (!alive(j.pid)) { j.done = true; ev(j, "agent_complete", { name: "orchestrator" }); ingest({ type: "session-ended", sessionId: j.sid }); log("job run finished: " + j.sid); continue; }
        try { tail(j); } catch {}
      }
    }
  }
  return { scan, enabled: dirs.length > 0, jobs };
}
