#!/usr/bin/env node
// Claude Code SessionStart hook: prints (into the session's context) the facts a session must not skip:
// the branch, the last commits, and the first lines of the files listed in .claude/session_start.json.
// Never fails the session: every step is wrapped and the exit code is always 0. Keep the output short (< 40 lines).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const run = (cmd, args) => { try { return execFileSync(cmd, args, { cwd: root, encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };

try {
  let cfg = { files: ["docs/STATUS.md"], lines: 20, commits: 5 };
  try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(path.join(root, ".claude", "session_start.json"), "utf8")) }; } catch {}
  const out = [`[session start] folder ${path.basename(root)}, branch ${run("git", ["branch", "--show-current"]) || "?"}`];
  const log = run("git", ["log", `-${cfg.commits}`, "--format=  %h %ad %s", "--date=short"]);
  if (log) out.push("Last commits:", log);
  const behind = run("git", ["rev-list", "--count", "HEAD..@{upstream}"]);
  if (behind && behind !== "0") out.push(`This branch is ${behind} commit(s) behind its upstream: pull first.`);
  for (const f of cfg.files) {
    try { const t = fs.readFileSync(path.join(root, f), "utf8").split(/\r?\n/).slice(0, cfg.lines); out.push(`--- ${f} (first ${cfg.lines} lines) ---`, ...t); } catch {}
  }
  console.log(out.join("\n"));
} catch (e) { console.log(`[session start] hook error: ${e.message}`); }
process.exit(0);
