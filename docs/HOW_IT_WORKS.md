# How it works

```
 Claude Code ──hooks──► agent-flow relay ──SSE /events──► agent-live server ──SSE /events──► page
                         (third party)                     │  ring (2000) + JSONL file
 <config dir>/projects/<encoded path>/<session>/subagents/  │  meta.json scanner (every 3 s)
   agent-<id>.meta.json  ──────────────────────────────────►│  /team.json  /rules.json  /agents.json
                                                            │  /history   /status   /inject
```

## 1. Hooks: where the events come from
Claude Code can run a command when something happens (a *hook*). agent-flow installs one small forwarder script (`~/.claude/agent-flow/hook.js`) and registers it, in the `settings.json` of your Claude config folder, for nine events: `SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Notification`, `Stop`, `SessionEnd`. Each time, the script posts the event to the relay. It finds the relay by looking in `~/.claude/agent-flow/` for a file naming a live relay whose *workspace* matches the folder Claude Code runs in, which is why `agent-live start` runs the relay **from your project folder**.

The relay's first run writes the hook script and edits `~/.claude/settings.json` itself. Claude Code reads `settings.json` when a session starts, so **start a new session** after the first run. If you use another config folder (`CLAUDE_CONFIG_DIR`), run `agent-live hooks --install --config-dir <folder>`.

## 2. The relay and the proxy
The relay (`npx agent-flow-app@0.9.1`, pinned, telemetry off) streams events as Server-Sent Events on `/events`. It sends no CORS headers, so a browser page cannot read it directly. The Agent Live **server** connects to it, and re-serves the stream to the page.

The server keeps:
- a **ring buffer** of the last `history.ring` events (default 2000). The page loads it from `/history` when it opens, then follows `/events`;
- a **JSONL file** (`.agent-live/events.jsonl`): every event is appended, and the last `history.maxLines` lines are read back at start. Duplicates (the relay can resend) are dropped by a key of session, time, type and payload. Simulated events (`/inject`) are never written.

## 3. Which agent is this? Type matching through `meta.json`
The relay names a sub-agent run by the **first ~30 characters of its task description**, or, for runs it learns from hooks, `<agent type>-<last 6 characters of the run id>`. Neither is the agent's *type* (the name of the file in `.claude/agents`).

Claude Code writes, per run, `<session>/subagents/agent-<id>.meta.json` containing the `agentType` and the full `description`. The server scans these files every 3 seconds (and immediately when it meets an unknown name) in every folder selected by the `claude.*` config, and matches **exactly**, never by time:
- by **description prefix**: the run's name is the start of the description;
- by **id suffix**: the name ends in the last six characters of the id.

A match produces a `run-info` message `{ session, name, agentType, task, agentId, account }` that is sent to the page, stored, and attached to the run's events. A run with no meta file yet is listed under `unmatched` in `/status`, and retried at its next event.

Session folders also give the optional **account label**: the encoded project folder name is tested against `accounts[].match`.

## 4. Persistent run identity (and why it exists)
The first version attached the type only to the **first event** of a run. The 2000-event ring dropped that event on long runs, and the card fell back to a generic "sub-agent". Worse, a **resumed** run shows up under its second name (`<type>-<suffix>`), which looked like a second, unknown agent.

Fix, in `public/identity.js` (unit-tested):
- the server keeps a map `session|name -> identity` that never expires and sends it as `run-info` messages and in `/history` (`runs`);
- the page keeps `agentId -> first name` and an alias table: **every later name of the same id is rewritten to the first name** before events are applied, so a run is one run;
- a name that still cannot be typed is shown only as a small `unmatched: N` chip, never as a card or a node.

## 5. The model on the page
`apply()` in `public/model.js` is a plain reducer: one event in, state out. State per agent: status (`idle`, `thinking`, `tool`, `perm`, `done`, `error`), current tool and argument, recent tools, call count, tokens, timestamps (for the sparkline), last message. It also tracks hand-off edges. Replay rebuilds the state from the first event up to the slider position; live mode applies new events as they arrive. All the views render from this one model.

## 6. Inference rules: lighting up things Claude Code cannot see directly
Tools like git or docker are not agents; Claude Code only sees *commands*. `activityRules` map a tool call (tool name regex plus argument regex) to a node id (see [CONFIG.md](CONFIG.md)). When a rule hits: the node gets a "last seen" entry and a short glow, and a **beam** is drawn from the agent that ran the command to the node. The human node is driven separately: lit by a user message, amber while a permission request or a question is pending. A node with no hit says "no activity seen". Rules are compiled by `public/rules.js`, shared by the page and Node (so `doctor` and the tests use the same matcher).

## 7. The map layout
`/team.json` gives bands (rows), stages (columns), nodes and edges. `team.js` places a node at its band's row and its stage's column, stretches the grid to the panel (never below a readable card size), and builds **HTML cards** (a flex column with ellipsis, so text can never overlap, at any font or display scaling). Runs of agent types that are not on the map are added to the *Other agents* row on the fly.

## 8. The effects layer
One canvas sits **behind** the cards and draws only light (`tlfx.js`); the cards are HTML on top. Techniques: a hex-grid backdrop, a depth-parallax starfield, cached radial-gradient glow sprites (one per colour, drawn instead of re-computing gradients), eased breathing glows, an orbit ring with moving dots, a spinner arc while a tool runs, curved beams with flowing particles and trails, orbs that carry the task name, ripples and sparks per event, and a **quarter-resolution blurred bloom pass** added back with additive blending. Floating chips with the full tool text are DOM elements animated by CSS, so they cost nothing per frame. The Effects button switches the canvas off; with the OS "reduce motion" setting on, the page starts calm.

These techniques were studied from agent-flow's client and **re-implemented**; see [NOTICE](../NOTICE).

## 9. Server API
| Path | Returns |
|---|---|
| `GET /` and static files | the page |
| `GET /events` | SSE: every event as it happens, `run-info`, `server-status` |
| `GET /history[?sim=1]` | `{ runs, events, sessions, accounts, upstream, seq }` |
| `GET /team.json`, `/rules.json`, `/agents.json` | team map, activity rules (defaults + yours), agent files |
| `GET /status` | health, counts, `unmatched`, history file path |
| `GET /health` | `{ agentLive: true }` (used by `doctor` and `start`) |
| `POST /inject` | send events by hand (used by `simulate`); never persisted; max 1 MB. Every path answers 403 to a foreign `Host` or `Origin`. |
