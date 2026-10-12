# Troubleshooting

Start with `agent-live doctor`. Every red or yellow line has a `Fix:` line. This page explains the same problems in more detail.

## The page is empty ("No events yet")

1. **Hooks missing** (doctor: `Hooks for agent-flow are NOT installed in ...`). Without hooks Claude Code tells nobody what it does. Fix:
   - run `agent-live start` once (the relay installs the hooks into `~/.claude/settings.json` on its first run), **or**
   - for another Claude config folder: `agent-live hooks --install --config-dir "<folder>"` (a `.agent-live.bak` copy of the old settings is made), **or**
   - merge the JSON that `agent-live hooks` prints into your `settings.json` by hand.
   Then **start a new Claude Code session**: hooks are read at session start.
2. **Relay not running** (doctor: `Relay is not running on http://127.0.0.1:3001`). Run `agent-live start`. The first start downloads the relay and can take a minute. If it still does not answer, run `npx -y agent-flow-app@0.9.1 --no-open` in your project folder and read its output.
3. **Wrong workspace.** The hook forwarder only delivers to a relay whose workspace is the folder (or a parent of the folder) Claude Code runs in. Start the relay from your project folder (`agent-live start` does).
4. **Another page is selected.** The session picker defaults to the newest session. A session that only exists in simulate mode (`sim-` prefix) is hidden unless the URL has `?sim=1`.

## Agents show as "sub-agent" or `unmatched: N`

The page could not learn the agent type of those runs.
- doctor says `No Claude session folder for this project yet`: Claude Code has not run in this folder (it creates `<config dir>/projects/<encoded path>`). Run it once, or tell Agent Live where to look with `claude.configDirs` / `claude.extraProjectPaths` / `claude.projectMatch` ([CONFIG.md](CONFIG.md)).
- You use `CLAUDE_CONFIG_DIR` in your terminal but the server runs without it: set `claude.configDirs` explicitly.
- You work in a **git worktree**: its sessions live in a different encoded folder. Add the worktree path to `claude.extraProjectPaths`.
- Open `http://127.0.0.1:3002/status`: `unmatched` lists each run and why.
- Runs that started **before** the relay did have no events at all; nothing can be done for them.

## "No sub-agent types" / the map only shows tools

doctor: `No agent files found`. Agent definitions live in `.claude/agents/*.md`, each with a frontmatter:
```
---
name: researcher
description: Finds existing solutions and sources.
tools: Read, Grep, WebSearch
model: sonnet
---
```
Templates: `recipes/agents/`. If your agents are elsewhere, set `agentsDirs`. After adding agents run `agent-live init --force` (overwrites the config) or add nodes by hand; unlisted agent types still appear, in the *Other agents* row, when they run.

## Port in use

doctor: `Port 3002 is used by another program` (red).
- Change `"port"` in `agent-live.config.json` (any free port), or `agent-live start --port 3012`.
- To see who owns a port: Windows `netstat -ano | findstr :3002` (the last column is the PID; look it up in Task Manager); macOS / Linux `lsof -i :3002`. Stop that program yourself. Agent Live never kills processes.
- If it says `Agent Live is already running on port ...`, you already have one: just open it.

The relay port (3001 by default) can clash too: set `relayUrl` to another port, for example `http://127.0.0.1:3011`.

## Display scaling: text too big, too small or overlapping

- Use the **S / M / L** buttons in the top bar (remembered). The page also scales itself with the window width.
- Windows display scaling of 125 % to 200 % is supported: cards are HTML with ellipsis, so text should never overlap. If you see overlap, take a screenshot and open an issue with your window size and scaling.
- Browser zoom (Ctrl +/-) works as well; reload after changing it.
- Very small windows: use **Focus** (`F`) or hide the side panel (`T`) and the log (`L`).

## Windows specifics

- Use PowerShell, cmd or Git Bash; every command works the same. Paths in the config may use forward slashes (`C:/work/shop`) or doubled backslashes (`C:\\work\\shop`).
- `~` in `claude.configDirs` means your user folder (`C:\Users\you`).
- The relay is started through `npx.cmd`; the PID printed by `start` is the launcher. Stop it in Task Manager or with `taskkill /PID <pid> /T`.
- If `npx` is not found, reinstall Node 20+ and reopen the terminal.
- Security software may ask about Node opening a local port: allow it (it listens on 127.0.0.1 only).

## Config errors

doctor prints one line per problem, for example `port: should be a whole number, found string` or `nodez: unknown field (typo? allowed here: ...)`. Common ones: a trailing comma (JSON allows none), single quotes (use double), a single backslash inside a regular expression (write `\\b`).

## History file

- `Cannot write the history file`: set `history.file` to a folder you can write to.
- The file grows forever; it is trimmed to the last `history.maxLines` lines at start when it is more than twice that. Delete it any time (the page then starts empty).
- It may contain command lines and message text from your sessions. Keep it out of git: add `.agent-live/` to `.gitignore`.

## Still stuck

Run `agent-live doctor --json` and `node --test` (the tests also run on your machine) and share the output when asking for help. Remove secrets first.
