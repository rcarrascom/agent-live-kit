// Run identity on the server side. Claude Code writes <session>/subagents/agent-<id>.meta.json with the agent type and the full
// task description. The relay names a run after the first ~30 characters of that description, or "<type>-<last 6 of the id>".
// We scan the meta files and match by description prefix or id suffix (exact, never by time).
import fs from "node:fs";
import path from "node:path";
import { accountFor } from "./paths.mjs";

export function createMetaIndex({ cfg, getProjectDirs }) {
  const metas = [];            // { session, id, type, description, account }
  const seen = new Set();
  const accountBySession = {};
  let lastScan = 0;

  function scan() {
    lastScan = Date.now();
    for (const pr of getProjectDirs()) {
      const acct = accountFor(cfg, pr.name);
      let sess = [];
      try { sess = fs.readdirSync(pr.dir, { withFileTypes: true }).filter(d => d.isDirectory()); } catch { continue; }
      for (const sd of sess) {
        if (acct) accountBySession[sd.name] = acct;
        const sub = path.join(pr.dir, sd.name, "subagents");
        let files = [];
        try { files = fs.readdirSync(sub).filter(f => f.endsWith(".meta.json")); } catch { continue; }
        for (const f of files) {
          const fp = path.join(sub, f);
          if (seen.has(fp)) continue;
          try {
            const m = JSON.parse(fs.readFileSync(fp, "utf8"));
            seen.add(fp);
            metas.push({ session: sd.name, id: f.replace(/^agent-/, "").replace(/\.meta\.json$/, ""), type: m.agentType, description: m.description || "", account: acct });
          } catch {}
        }
      }
    }
  }

  function resolveRun(sid, name) {
    const suf = name.match(/-([0-9a-f]{6})$/);
    if (suf) { const r = metas.find(m => m.session === sid && m.id.endsWith(suf[1])); if (r) return r; }
    const nm = name.trim();
    if (nm.length >= 5) {
      const c = metas.filter(m => m.session === sid && m.description.startsWith(nm));
      if (c.length) return c[c.length - 1];
    }
    return null;
  }
  return { scan, resolveRun, metas, accountBySession, get lastScan() { return lastScan; } };
}
