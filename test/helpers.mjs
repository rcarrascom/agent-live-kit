// Shared helpers: a fake project on disk, a fake relay, a free port.
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { encodeProjectPath } from "../src/paths.mjs";
import { HOOK_EVENTS } from "../src/relay.mjs";

export const tmpDir = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

export function agentFile(dir, name, { description = `${name} does its job.`, tools = "Read, Grep", model = "sonnet" } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + ".md"), `---\nname: ${name}\ndescription: ${description}\ntools: ${tools}\nmodel: ${model}\n---\nYou are ${name}.\n`);
}

// A project with 3 agents and a package.json (and a git folder marker).
export function fakeProject() {
  const root = tmpDir("al-proj-");
  const agents = path.join(root, ".claude", "agents");
  agentFile(agents, "researcher", { tools: "Read, WebSearch, WebFetch", description: "Finds prior art and sources." });
  agentFile(agents, "tester", { tools: "Read, Bash", description: "Writes and runs tests." });
  agentFile(agents, "code-reviewer", { tools: "Read, Grep, Glob", description: "Reviews diffs. Read-only." });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fake", scripts: { test: "node --test", build: "tsc" }, devDependencies: { eslint: "9" } }));
  fs.mkdirSync(path.join(root, ".git"));
  return root;
}

// A Claude config dir with the project's session folder and (optionally) the agent-flow hooks.
export function fakeClaudeDir(root, { hooks = true } = {}) {
  const cd = tmpDir("al-claude-");
  fs.mkdirSync(path.join(cd, "projects", encodeProjectPath(root)), { recursive: true });
  const entry = [{ hooks: [{ type: "command", command: "node /home/u/.claude/agent-flow/hook.js", timeout: 2 }] }];
  const settings = hooks ? { hooks: Object.fromEntries(HOOK_EVENTS.map(e => [e, entry])) } : {};
  fs.writeFileSync(path.join(cd, "settings.json"), JSON.stringify(settings));
  return cd;
}

export function freePort() {
  return new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}

export async function fakeRelay() {
  const port = await freePort();
  const srv = http.createServer((q, r) => { r.writeHead(200); r.end("ok"); });
  await new Promise(r => srv.listen(port, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise(r => { srv.close(() => r()); srv.closeAllConnections?.(); }) };
}

export function writeConfig(root, cfg) {
  const f = path.join(root, "agent-live.config.json");
  fs.writeFileSync(f, JSON.stringify(cfg, null, 2));
  return f;
}
