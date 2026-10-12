// agent-live doctor: the check tool. Every line is green (ok), yellow (works, but look) or red (broken) with a concrete fix.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, teamProblems, allRules, buildTeam, CONFIG_NAME } from "../config.mjs";
import { readAgents } from "../agents.mjs";
import { claudeConfigDirs, claudeProjectDirs, encodeProjectPath } from "../paths.mjs";
import { portOf, portInUse, relayAnswers, agentLiveAnswers, npxAvailable, hookStatus, HOOK_EVENTS, RELAY_PACKAGE } from "../relay.mjs";
import { createAgentLive } from "../server.mjs";
import { createHistory } from "../history.mjs";
import { Rules } from "../umd.mjs";
import { bold, dim, green, red, yellow } from "./args.mjs";

const ok = (title, detail = "") => ({ level: "ok", title, detail });
const warn = (title, detail, fix) => ({ level: "warn", title, detail, fix });
const bad = (title, detail, fix) => ({ level: "fail", title, detail, fix });

export async function runChecks({ cwd = process.cwd(), config, skipRoundTrip = false } = {}) {
  const out = [];
  const major = +process.versions.node.split(".")[0];
  out.push(major >= 20 ? ok(`Node ${process.versions.node}`) : bad(`Node ${process.versions.node} is too old`, "Agent Live needs Node 20 or newer.", "Install Node 20+ from https://nodejs.org and run the command again."));

  const { cfg, root, file, errors } = loadConfig({ cwd, config });
  if (!file) out.push(warn("No agent-live.config.json found", `Looked from ${cwd} upwards. Defaults are used.`, "Run: agent-live init"));
  else if (errors.length) out.push(bad(`${path.basename(file)} has ${errors.length} problem(s)`, errors.map(e => "  - " + e).join("\n"), `Edit ${file} and fix the lines above (field reference: docs/CONFIG.md). Schema: schema/agent-live.config.schema.json`));
  else out.push(ok(`Config ${file} is valid`));

  // agents
  const { agents, problems } = readAgents(root, cfg.agentsDirs);
  for (const p of problems) out.push(warn(`Agents folder problem: ${p.dir || p.file}`, p.error, `Create the folder or change "agentsDirs" in ${CONFIG_NAME}. Claude Code reads agents from .claude/agents/*.md`));
  if (agents.length) {
    const noDesc = agents.filter(a => !a.description), noName = agents.filter(a => !a.hasName);
    if (noDesc.length || noName.length) {
      out.push(warn(`${agents.length} agent file(s) read, some incomplete`, [...noName.map(a => `  - ${path.basename(a.file)}: no "name:" in the frontmatter`), ...noDesc.map(a => `  - ${a.name}: no "description:"`)].join("\n"), "Add the missing lines between the --- markers at the top of the file (see recipes/agents/)."));
    } else out.push(ok(`${agents.length} agent file(s) read, all with name and description`));
  } else if (!problems.length) out.push(warn("No agent files found", `Nothing in ${cfg.agentsDirs.join(", ")}.`, "Add agents (recipes/agents/ has templates). The map still shows the main session and tools."));

  // team map
  const tp = teamProblems(cfg, root);
  const hard = tp.filter(p => !/orphan/.test(p)), orphans = tp.filter(p => /orphan/.test(p));
  if (hard.length) out.push(bad("Team map has errors", hard.map(p => "  - " + p).join("\n"), `Fix the nodes / edges in ${CONFIG_NAME}.`));
  if (orphans.length) out.push(warn("Team map has orphan nodes", orphans.map(p => "  - " + p).join("\n"), 'Add an edge like ["orchestrator", "<id>"] to "edges", or delete the node.'));
  if (!hard.length && !orphans.length) out.push(ok(`Team map: ${buildTeam(cfg, root).nodes.length} nodes, no orphans`));
  if (cfg.nodes.length) {
    const ids = new Set(cfg.nodes.map(n => n.id)), missing = agents.filter(a => !ids.has(a.name));
    if (missing.length) out.push(warn(`${missing.length} agent file(s) have no node on the map`, missing.map(a => "  - " + a.name).join("\n"), "They still appear in the 'Other agents' row when they run. To place them: agent-live init --force (overwrites the config) or add nodes by hand."));
  }

  // rules
  const compiled = Rules.compile(allRules(cfg));
  out.push(compiled.errors.length ? bad(`${compiled.errors.length} activity rule(s) do not compile`, compiled.errors.map(e => `  - rule #${e.index + 1} (node ${e.node}): ${e.error}`).join("\n"), 'Fix the regular expression in "activityRules" (remember to double every backslash in JSON: \\\\b).')
    : ok(`${compiled.rules.length} activity rules compile`));

  // Claude Code files
  const dirs = claudeConfigDirs(cfg), projDirs = claudeProjectDirs(cfg, root, dirs);
  if (projDirs.length) {
    let n = 0, unreadable = [];
    for (const p of projDirs) { try { n += fs.readdirSync(p.dir).length; } catch { unreadable.push(p.dir); } }
    out.push(unreadable.length ? bad("Claude project folder not readable", unreadable.join("\n"), "Check the folder permissions.") : ok(`Claude session folder found (${projDirs.length}): sub-agent types can be matched`, projDirs.map(p => "  " + p.dir).join("\n")));
  } else out.push(warn("No Claude session folder for this project yet", `Expected a folder named ${encodeProjectPath(root)} under ${dirs.map(d => path.join(d, "projects")).join(" or ")}.`, `Run Claude Code once in ${root} (it creates the folder). Until then sub-agents show as "unmatched". If you use a different config dir or worktrees, set claude.configDirs / claude.extraProjectPaths in ${CONFIG_NAME}.`));

  // hooks
  const hookDirs = projDirs.length ? [...new Set(projDirs.map(p => p.configDir))] : dirs.slice(0, 1);
  for (const d of hookDirs) {
    const h = hookStatus(d);
    if (!h.readable) out.push(bad(`Cannot parse ${h.file}`, "The settings file is not valid JSON.", "Open it, fix the JSON, and run doctor again."));
    else if (h.hooked.length === 0) out.push(bad(`Hooks for agent-flow are NOT installed in ${d}`, `No agent-flow hook found in ${h.file}. Without hooks the page stays empty.`,
      `Run: agent-live hooks --install --config-dir "${d}"   (needs ~/.claude/agent-flow/hook.js, which "agent-live start" creates the first time the relay runs). Preview first with: agent-live hooks`));
    else if (h.hooked.length < HOOK_EVENTS.length) out.push(warn(`Hooks partly installed in ${d}`, `Missing: ${HOOK_EVENTS.filter(e => !h.hooked.includes(e)).join(", ")}`, `Run: agent-live hooks --install --config-dir "${d}"`));
    else out.push(ok(`Hooks installed in ${h.file} (${h.hooked.length} events)`));
  }

  // relay + ports
  const relayPort = portOf(cfg.relayUrl);
  const relayUp = await relayAnswers(cfg.relayUrl);
  if (relayUp) out.push(ok(`Relay answers on ${cfg.relayUrl}`));
  else if (npxAvailable()) out.push(warn(`Relay is not running on ${cfg.relayUrl}`, "That is normal before you start.", `Run: agent-live start   (it runs npx ${RELAY_PACKAGE} with telemetry off)`));
  else out.push(bad("Relay is not running and npx was not found", "npx comes with Node.", "Reinstall Node 20+ (https://nodejs.org) so that npx is on your PATH."));
  const myPort = cfg.port;
  if (myPort === relayPort) out.push(bad(`The page port ${myPort} equals the relay port`, "They must differ.", `Change "port" in ${CONFIG_NAME}.`));
  else if (await agentLiveAnswers(myPort)) out.push(ok(`Agent Live is already running on port ${myPort}`));
  else if (await portInUse(myPort)) out.push(bad(`Port ${myPort} is used by another program`, "Something else is listening there.", `Pick a free port: set "port" in ${CONFIG_NAME} (or stop the other program yourself: find it with  netstat -ano | findstr :${myPort}  on Windows, or  lsof -i :${myPort}  on macOS/Linux).`));
  else out.push(ok(`Port ${myPort} is free`));

  // history file
  const hist = createHistory(cfg.history);
  out.push(hist.check() ? ok(`History file location is writable: ${cfg.history.file}`) : bad("Cannot write the history file", cfg.history.file, 'Set "history.file" in the config to a folder you can write to.'));

  // round trip through the proxy (ephemeral server, temp history, no relay)
  if (!skipRoundTrip) {
    let al = null;
    try {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-live-doctor-"));
      al = createAgentLive({ cfg: { ...cfg, history: { ...cfg.history, file: path.join(tmp, "events.jsonl") } }, root, upstream: false, watchMetas: false });
      const port = await al.start(0);
      const ev = { type: "agent-event", event: { time: 1, type: "message", payload: { agent: "orchestrator", role: "user", content: "doctor test" }, sessionId: "sim-doctor" } };
      const r = await fetch(`http://127.0.0.1:${port}/inject`, { method: "POST", body: JSON.stringify(ev) });
      const h = await (await fetch(`http://127.0.0.1:${port}/history?sim=1`)).json();
      const got = r.ok && h.events.some(x => x.event && x.event.payload.content === "doctor test");
      out.push(got ? ok("Test event went in and came back through the proxy") : bad("Test event round trip failed", "The server accepted no event.", "Run the tests (npm test) and report the output."));
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch (e) { out.push(bad("Test event round trip crashed", String(e.message), "Report this message.")); }
    finally { if (al) await al.stop(); }
  }
  return out;
}

export function verdict(results) {
  const f = results.filter(r => r.level === "fail").length, w = results.filter(r => r.level === "warn").length;
  return { fails: f, warns: w, code: f ? 1 : 0, text: f ? `NOT READY: ${f} problem(s) to fix, ${w} warning(s).` : w ? `READY, with ${w} warning(s) worth a look.` : "ALL GREEN. Run: agent-live start" };
}

export async function run(args) {
  const results = await runChecks({ cwd: path.resolve(args.cwd || process.cwd()), config: args.config });
  const v = verdict(results);
  if (args.json) { console.log(JSON.stringify({ results, verdict: v }, null, 2)); return v.code; }
  console.log(bold("Agent Live doctor\n"));
  const tag = { ok: green("[ OK ]"), warn: yellow("[WARN]"), fail: red("[FAIL]") };
  for (const r of results) {
    console.log(`${tag[r.level]} ${r.title}`);
    if (r.detail && r.level !== "ok") console.log(dim(r.detail.split("\n").map(l => "       " + l).join("\n")));
    else if (r.detail) console.log(dim(r.detail.split("\n").map(l => "       " + l).join("\n")));
    if (r.fix) console.log("       " + bold("Fix: ") + r.fix);
  }
  console.log("\n" + (v.code ? red(v.text) : v.warns ? yellow(v.text) : green(v.text)));
  return v.code;
}
