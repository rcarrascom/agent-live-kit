# Configuration: `agent-live.config.json`

Put this file in your project folder (or point to it with `--config path`). `agent-live init` writes a good first version. **Every field is optional**: with no file at all, the map is built from `.claude/agents/*.md`.

Add `"$schema": "./node_modules/agent-live-kit/schema/agent-live.config.schema.json"` at the top and most editors will autocomplete and underline mistakes. `agent-live doctor` validates the file and explains errors in plain words.

A complete small example:

```json
{
  "project": "Shop backend",
  "port": 3002,
  "agentsDirs": [".claude/agents"],
  "human": { "id": "human", "name": "You" },
  "orchestrator": { "id": "orchestrator", "name": "Claude" },
  "nodes": [
    { "id": "planner", "name": "planner", "band": "design",   "stage": "design", "role": "Writes the plan." },
    { "id": "coder",   "name": "coder",   "band": "build",    "stage": "build",  "role": "Implements it." },
    { "id": "git",     "name": "git",     "band": "tools",    "stage": "build",  "role": "Version control." }
  ],
  "edges": [["human", "orchestrator"], ["orchestrator", "planner"], ["planner", "coder", "plan"]],
  "activityRules": [{ "node": "git", "tool": "^Bash$", "match": "\\bgit\\s+push" }]
}
```

## Fields

### `project` (string)
Name shown in the top bar and the browser tab. Default: the folder name.

### `port` (integer, default `3002`)
Port of the page. It listens on `127.0.0.1` only. Must differ from the relay's port.

### `relayUrl` (string, default `http://127.0.0.1:3001`)
Where the agent-flow relay listens. `start` launches it on this port if nothing answers.

### `agentsDirs` (array of folders, default `[".claude/agents"]`)
Folders (relative to the config file) with agent `.md` files. Each file needs a frontmatter with `name` and `description`; `tools` and `model` are shown on the cards.

### `claude` (object): where Claude Code keeps its files
Agent Live reads the `subagents/agent-<id>.meta.json` files Claude Code writes, to learn the **type and full task** of each sub-agent run.

Claude Code stores them in `<config dir>/projects/<encoded project path>/<session id>/subagents/`. The *encoded project path* is your project's absolute path with every character that is not a letter or a digit replaced by `-`:

| Project path | Folder name |
|---|---|
| `C:\work\shop` | `C--work-shop` |
| `/home/ana/my app` | `-home-ana-my-app` |

The *config dir* is `$CLAUDE_CONFIG_DIR` if set, else `~/.claude`.

| Field | Meaning |
|---|---|
| `configDirs` | Array of config dirs to look in. Default: `$CLAUDE_CONFIG_DIR`, `~/.claude`, and every `~/.claude-*` folder that has a `projects` folder. `~` is allowed. |
| `extraProjectPaths` | More project folders whose sessions belong to this team (for example your git worktrees). They are encoded the same way. |
| `projectMatch` | A regular expression on the encoded folder name; every folder that matches is included. Useful for many worktrees: `"^C--work-shop"`. |

### `accounts` (array): optional session labels
Label sessions by the **encoded folder name** (handy when two Claude accounts or worktrees work in the same project):

```json
"accounts": [ { "match": "-work$", "label": "work account" }, { "match": "-b$", "label": "B" } ]
```
The first rule that matches wins. The label shows in the session picker and on the main-session card. Leave it out and no label is shown.

### `human` (object)
The person's node: `id` (default `human`), `name` (default `You`), `role`. It lights when you send a message and turns amber ("waiting for you") when Claude asks a question or a permission is pending.

### `orchestrator` (object)
The main-session node: `id` (default `orchestrator`), `name` (default `Claude`), `role`. Optional `byAccount` maps an account label to a different node id, if you want one box per account:
```json
"orchestrator": { "id": "claude-a", "name": "Claude A", "byAccount": { "B": "claude-b" } }
```
(then add both nodes in `nodes`).

### `relayNode` (string, default `agent-flow`)
Node id that turns green while the relay answers. Set `""` to not have one.

### `bands` (object)
A **band** is a row on the map. Define or restyle bands by id:
```json
"bands": { "build": { "label": "Engineering", "color": "#6fd3a0" }, "legal": { "label": "Legal", "color": "#ffa8d5" } }
```
Built-in bands: `people`, `claude`, `research`, `design`, `build`, `check`, `review`, `ops`, `outside`, `tools`, `other`. Colours are `#rgb` or `#rrggbb`.

### `stages` (array of `[id, label]`)
The **columns** of the map, left to right, the order of a job. Default: plan, research, design, build, check, review, ship. Replace it with your own process:
```json
"stages": [["intake", "Intake"], ["analysis", "Analysis"], ["delivery", "Delivery"]]
```

### `nodes` (array)
The boxes. Leave empty to build them from the agent files. Fields: `id` (must equal the agent's `name` for agents), `name` (label), `band`, `stage` (a stage id), and optional `role` (shown on click), `cost` (e.g. the model), `lane`, `sees`.
Node kinds you can add: agents (band `research`...`ops`), outside AIs (`outside`), tools (`tools`), anything else.

### `edges` (array of `[from, to]` or `[from, to, label]`)
Lines between nodes. A third item makes it a dashed side link with that label. Leave empty for: you -> main session -> every agent. `agent-live doctor` warns about nodes with no edge (tools are exempt).

### `useDefaultRules` (boolean, default `true`) and `activityRules` (array)
**Activity rules** decide which node lights up when a tool call happens. A rule is:

```json
{ "node": "git", "tool": "^(Bash|PowerShell)$", "match": "\\bgit\\s+push", "flags": "i", "waiting": false }
```
- `node`: the node id to light (rules for nodes not on your map are ignored).
- `tool`: regular expression on the **tool name** (`Bash`, `Edit`, `WebFetch`, `mcp__server__tool`...).
- `match`: regular expression on the **argument text** (the command line, file path, URL...). Case-insensitive unless `flags` says otherwise.
- At least one of `tool` / `match` is required. All rules that match fire, so `npm test` can light both `npm` and `tests`.
- `waiting: true` marks the human as "waiting for you" (used for the question tool).
- Remember to double every backslash inside JSON.

**Defaults** cover: git and gh, npm / pnpm / yarn / bun / node, python / pip / uv, cargo, go, make / cmake, docker / kubectl / helm, test runners, build tools, linters / formatters, web fetch and search and curl, browsers and UI-test drivers, database clients and migrations, cloud and deploy CLIs, CI runs. They apply only to nodes that exist on your map; `init` adds the nodes it detects in your project.

**Add your own.** Say you have a script `./bin/second-opinion` that calls an outside model, and a node `second-opinion` in band `outside`:
```json
"activityRules": [
  { "node": "second-opinion", "tool": "^(Bash|PowerShell)$", "match": "second-opinion" },
  { "node": "figma", "tool": "^mcp__figma" }
]
```
Switch the defaults off with `"useDefaultRules": false` if you want only your own.

### `history` (object)
| Field | Default | Meaning |
|---|---|---|
| `file` | `.agent-live/events.jsonl` | Where every event is appended (one JSON object per line). Relative to the config file. |
| `ring` | `2000` | Events kept in memory and sent to the page on load. |
| `maxLines` | `6000` | Lines read back at start. A file longer than twice this is trimmed to the last `maxLines`. |

Simulated events are never written to the file.

### `keepFinishedMinutes` (integer, default `30`)
How long the Classic tab keeps finished runs (the page also has a selector: 5 min / 30 min / session; your choice is remembered in the browser).

### `telemetry` (boolean)
Ignored: the relay is always started with telemetry off.

## Browser URL options
`?sim=1` shows simulated sessions · `?session=<id>` pins a session · `?focus=1` opens in Focus mode · `?hide=team,log` hides panels.
