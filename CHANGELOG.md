# Changelog

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
