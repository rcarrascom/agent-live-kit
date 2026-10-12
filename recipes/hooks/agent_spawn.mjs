#!/usr/bin/env node
// Claude Code SubagentStart / SubagentStop hook: appends one JSON line per event to logs/agent_spawns.jsonl
// (who, when, which session). Set SPAWN_LOG to use another file, e.g. one file per account or worktree
// so two folders never conflict on merge. Never blocks: always exits 0.
import fs from "node:fs";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", c => (input += c));
process.stdin.on("end", () => {
  try {
    const d = JSON.parse(input.replace(/^﻿/, ""));
    const file = process.env.SPAWN_LOG || path.join(root, "logs", "agent_spawns.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const row = { t: new Date().toISOString(), event: d.hook_event_name || "", agent: d.agent_type || d.subagent_type || "", agent_id: d.agent_id || "", session: String(d.session_id || "").slice(0, 8) };
    fs.appendFileSync(file, JSON.stringify(row) + "\n");
  } catch { /* never break the session */ }
  process.exit(0);
});
