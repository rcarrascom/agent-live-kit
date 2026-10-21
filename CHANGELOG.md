# Changelog

## 0.2.0

Security
- The server now answers only its own page: a foreign `Host` header (DNS rebinding) or a foreign `Origin` (another web page posting to `127.0.0.1`) gets 403. `curl` and `agent-live simulate` still work.
- `/inject` refuses bodies over 1 MB and no longer returns internal error text.
- `history.file` in a project config must be inside the project folder.
- `public/package.json` is no longer served; the session select escapes session ids.

Fixes
- `hooks --install` kept overwriting its own backup, so a second run destroyed the original `settings.json` copy. The first backup is now kept, and an invalid `settings.json` is reported and left untouched.
- A missing `npx` no longer crashes `agent-live start`; `open --port` accepts only a port number.
- An `agent-event` without an `event` is rejected cleanly and no longer advances the sequence counter.

Features
- Tool calls are small fading icons by family (read, write, run, search, web, other) with a key in the legend, in Team live, Flow and the canvas. The full text stays in the node card and the log.
- Optional headless job runs (`jobs.pidDirs`) shown as live sessions.
- 7 new tests (security, hooks backup, config confinement, jobs): 56 in total.

## 0.1.0 (first public version)

- `agent-live` CLI: `init`, `doctor`, `start`, `simulate`, `open`, `hooks`. Node 20+, built-ins only.
- One config file, `agent-live.config.json`, with a JSON schema and readable validation errors.
- Generic activity rules (git, package managers, test runners, builds, linters, docker, web, browsers, databases, cloud CLIs, CI) and a way to add your own.
- UI: Team live (default), Flow, Classic skin, Focus mode, hide team panel / log (`T` / `L`), S / M / L size, effects toggle, replay, persistent log, latest-session auto-follow.
- Server: ring buffer plus JSONL history, exact run identity from Claude Code `meta.json` files, resumed runs merged into one.
- Recipes: agent templates, guard / session-start / spawn-log hooks, a `CLAUDE.md` template, a retro template.
- Docs: README, CONFIG, HOW_IT_WORKS, TROUBLESHOOTING, HOWTO_RUN_AN_AI_AGENT_TEAM.
- Tests (`node --test`): schema, init, doctor, rules, run identity, history, guard hook.
- Visual techniques studied from agent-flow (Apache-2.0) and re-implemented; see NOTICE.
