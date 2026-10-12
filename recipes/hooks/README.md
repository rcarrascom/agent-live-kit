# Hook recipes

Three small Node scripts (no dependencies, Windows / macOS / Linux). Copy the ones you want into your project, for example into `tools/hooks/`, and register them in `.claude/settings.json`.

| Script | Event | What it does |
|---|---|---|
| `guard.mjs` + `guard.rules.json` | `PreToolUse` | Blocks actions your rules forbid (destructive git, kill by name, recursive delete outside temp, secrets, vendored folders, commit message format). |
| `session_start.mjs` | `SessionStart` | Prints branch, last commits and the head of your status file into the session. |
| `agent_spawn.mjs` | `SubagentStart`, `SubagentStop` | Logs every sub-agent start / stop to a JSONL file. |

## Install

1. Copy the scripts to `tools/hooks/` and `guard.rules.json` to `.claude/guard.rules.json` (edit the rules for your project).
2. Merge this into your project's `.claude/settings.json` (keep any hooks you already have; the agent-flow hooks that Agent Live needs live in your *user* settings and do not conflict):

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write|NotebookEdit|Bash|PowerShell",
        "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/hooks/guard.mjs\"" } ] }
    ],
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/hooks/session_start.mjs\"", "timeout": 30 } ] }
    ],
    "SubagentStart": [
      { "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/hooks/agent_spawn.mjs\"", "async": true } ] }
    ],
    "SubagentStop": [
      { "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/hooks/agent_spawn.mjs\"", "async": true } ] }
    ]
  }
}
```

On Windows PowerShell-based setups `$CLAUDE_PROJECT_DIR` may need the form `%CLAUDE_PROJECT_DIR%`; if a hook does not run, test it by hand first (below).

3. **Start a new Claude Code session** (hooks are read at session start).

## Test a hook without Claude

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}' | node tools/hooks/guard.mjs ; echo "exit=$?"
# expect: BLOCKED by guard: destructive git command ...   exit=2
echo '{"tool_name":"Bash","tool_input":{"command":"git status"}}' | node tools/hooks/guard.mjs ; echo "exit=$?"
# expect: exit=0
```

## Writing your own rule

Add an object to `rules`:
```json
{ "id": "no-prod-db", "tools": ["Bash"], "field": "command", "pattern": "psql .*prod", "message": "never touch the production database from an agent." }
```
Test it with the echo command above. Keep the guard small and fast: it runs before every matching tool call.
