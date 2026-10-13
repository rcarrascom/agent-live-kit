---
name: agent-live
description: Install, repair and start Agent Live Kit, a local live map of your Claude Code agent team (who is working, hand-offs, activity log). Use when the user says "install agent live", "set up the agent tracker / live map", "show my agents working", or asks to fix or restart it. Works on macOS, Linux and Windows.
---

# Agent Live: install and run

Agent Live Kit is a small Node tool (no dependencies) that shows your sub-agents on a local web page. Everything stays on this computer. Do the steps in order, run the commands yourself, and fix problems instead of handing them back. Say what you are doing in one short line per step.

Repository: https://github.com/rcarrascom/agent-live-kit (the kit is cloned once and reused for every project).

## 0. Ask before touching settings (once)

Tell the user in two sentences: the first `start` merges hooks into the Claude settings file (`~/.claude/settings.json`, or the folder in `CLAUDE_CONFIG_DIR`) and keeps a backup next to it as `.agent-live.bak`; it also downloads the open-source relay `agent-flow-app` with npx on first run. Continue only after a yes.

## 1. Check the basics

- `node -v` must print v20 or higher. If Node is missing or old, tell the user to install the LTS from https://nodejs.org (macOS with Homebrew: `brew install node`) and stop until it works. Never install system software without asking.
- `git --version` must work.
- Decide the project: the current folder, the one where the user runs Claude Code. It should have `.claude/agents/*.md` (if it has none, `init` still works and builds a minimal team).

## 2. Find or get the kit (once per computer)

KIT is the folder that contains `bin/agent-live.mjs`. Look in this order and use the first that exists:
1. `~/agent-live-kit`
2. `~/agent-live-kit-main` (what a GitHub zip unpacks to), also in `~/Downloads` and `~/Desktop`
3. A folder the user names. If they sent a zip and it is not unpacked yet, unpack it to `~/agent-live-kit` (it may contain one nested `agent-live-kit-main` folder; KIT is the one that holds `bin/`).

If none exists, clone it (never inside the user's project). If KIT is a git clone, run `git -C KIT pull` to update; a zip copy needs no update.

```bash
git clone https://github.com/rcarrascom/agent-live-kit.git ~/agent-live-kit
```

If the clone fails with an authentication error (the repository is private), run `gh auth login` if `gh` exists; otherwise ask the user to accept the GitHub invite and sign in, or to send the zip. Then retry. On Windows, `~` is `%USERPROFILE%`; use the real path.

## 3. Set up the project

From the project folder:

```bash
node KIT/bin/agent-live.mjs init      # writes agent-live.config.json, explains every choice
node KIT/bin/agent-live.mjs doctor    # green / yellow / red checks, each with a fix
```

Read the `doctor` output. Fix every red line yourself using its "Fix:" text (for example, a busy port: set another `"port"` in `agent-live.config.json`). Yellow "No Claude session folder yet" is fine on a fresh install. If the user runs Claude with a custom `CLAUDE_CONFIG_DIR`, make sure `doctor` is run with that variable set, or add the folder to `claude.configDirs` in the config. Do not kill other programs by name; if a port is taken by something unknown, change the port.

## 4. Start it

```bash
node KIT/bin/agent-live.mjs start --open
```

Run it in the background so the session stays usable, note the printed address (default http://127.0.0.1:3002) and the PIDs it prints, and tell the user. Stop only those PIDs later.

## 5. Tell the user the one manual step

Hooks are read when a Claude Code session starts, so the user must **open a new Claude Code session** in this project (a restart of this one is not enough). Then any sub-agent they run appears on the map. To preview without agents: `node KIT/bin/agent-live.mjs simulate --port 3012`.

## 6. Verify

- `curl -s http://127.0.0.1:3002/status` should return JSON with `"agentLive":true`.
- Rerun `doctor`; the only acceptable non-green items are the "port in use" line (that is the running server itself) and the session-folder warning before the first new session.

## When something is wrong

- Page is blank: the server is not running or the port differs. Check `/status` and the address `start` printed.
- Agents never appear: hooks missing or session not restarted. Run `node KIT/bin/agent-live.mjs hooks --install --config-dir <the Claude config folder>` and ask for a new session.
- Show the full `doctor` output to the user and to anyone helping; it contains no secrets.
