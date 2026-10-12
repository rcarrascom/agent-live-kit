#!/usr/bin/env node
// Claude Code PreToolUse guard. Reads the hook JSON on stdin and a rules file, blocks what the rules forbid.
//   exit 0 = allow      exit 2 = block (the message on stderr goes back to the model)
// Rules file: $GUARD_RULES, else <project>/.claude/guard.rules.json, else the guard.rules.json next to this script.
// Never breaks a session: any internal error allows the action.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const candidates = [process.env.GUARD_RULES, path.join(project, ".claude", "guard.rules.json"), path.join(HERE, "guard.rules.json")].filter(Boolean);

function block(msg) { process.stderr.write("BLOCKED by guard: " + msg + "\n"); process.exit(2); }

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", c => (input += c));
process.stdin.on("end", () => {
  try { main(JSON.parse(input.replace(/^﻿/, ""))); } catch { /* malformed payload or rules: allow */ }
  process.exit(0);
});

function main(data) {
  const file = candidates.find(f => fs.existsSync(f));
  if (!file) return;
  const rules = JSON.parse(fs.readFileSync(file, "utf8")).rules || [];
  const tool = data.tool_name || "", inp = data.tool_input || {};
  const text = { command: String(inp.command || ""), file_path: String(inp.file_path || inp.path || "").replace(/\\/g, "/") };
  for (const r of rules) {
    if (r.tools && !r.tools.includes(tool)) continue;
    if (r.kind === "commit-prefix") { checkCommit(r, text.command); continue; }
    const subject = text[r.field || "command"];
    if (!subject) continue;
    if (new RegExp(r.pattern, r.flags || "i").test(subject) && !(r.unless && new RegExp(r.unless, r.flags || "i").test(subject))) block(r.message || `rule ${r.id} matched`);
  }
}

// { "kind": "commit-prefix", "tools": ["Bash"], "prefixes": ["feat", "fix", "docs", "chore"] }
function checkCommit(r, cmd) {
  if (!/\bgit\s+(-\S+\s+)*commit\b/i.test(cmd) || /--amend/.test(cmd)) return;
  let msg = null;
  const f = cmd.match(/(?:^|\s)(?:-F|--file)\s+["']?([^"'\s;|]+)/);
  if (f) {
    try { const raw = fs.readFileSync(f[1]); if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) block("the commit message file has a BOM: save it as UTF-8 without BOM."); msg = raw.toString("utf8"); } catch { return; }
  } else { const m = cmd.match(/(?:^|\s)-m\s+["']([^"']*)/); msg = m ? m[1] : null; }
  if (msg !== null && !new RegExp(`^\\s*(${r.prefixes.join("|")}):`).test(msg)) block(r.message || `commit messages must start with one of: ${r.prefixes.join(", ")}`);
}
