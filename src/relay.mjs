// Helpers for the agent-flow relay, ports and Claude Code hook settings. Nothing here kills a process.
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

export const RELAY_PACKAGE = "agent-flow-app@0.9.1";
export const HOOK_EVENTS = ["SessionStart", "PreToolUse", "PostToolUse", "PostToolUseFailure", "SubagentStart", "SubagentStop", "Notification", "Stop", "SessionEnd"];
export const HOOK_RE = /agent-flow[\\/]hook\.js/;

export const portOf = url => { try { const u = new URL(url); return +(u.port || (u.protocol === "https:" ? 443 : 80)); } catch { return 0; } };

// true when something accepts connections on host:port
export function portInUse(port, host = "127.0.0.1", timeout = 800) {
  return new Promise(resolve => {
    const s = net.connect({ port, host });
    const done = v => { s.destroy(); resolve(v); };
    s.setTimeout(timeout, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}

// Does the relay answer? (it sends no bytes until the first event, so we only probe "/")
export async function relayAnswers(url) {
  try { const r = await fetch(url + "/", { signal: AbortSignal.timeout(1500) }); return r.status < 500; } catch { return false; }
}
export async function agentLiveAnswers(port) {
  try { const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) }); const j = await r.json(); return !!j.agentLive; } catch { return false; }
}

export function npxAvailable() {
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--version"], { encoding: "utf8", shell: process.platform === "win32", timeout: 15000 });
  return r.status === 0;
}

// Starts the relay detached with telemetry off. Returns the launcher PID (stop that PID yourself if you want it gone).
export function startRelay(root, port) {
  const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["-y", RELAY_PACKAGE, "--no-open", "-p", String(port)],
    { cwd: root, detached: true, stdio: "ignore", windowsHide: true, shell: process.platform === "win32", env: { ...process.env, AGENT_FLOW_TELEMETRY: "false" } });
  child.unref();
  return child.pid;
}

export const settingsPath = configDir => path.join(configDir, "settings.json");

// { file, exists, hooked: [events with an agent-flow hook], readable }
export function hookStatus(configDir) {
  const file = settingsPath(configDir);
  if (!fs.existsSync(file)) return { file, exists: false, hooked: [], readable: true };
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
    const hooked = [];
    for (const [ev, entries] of Object.entries(s.hooks || {})) {
      if (Array.isArray(entries) && entries.some(e => (e.hooks || []).some(h => HOOK_RE.test(h.command || "")))) hooked.push(ev);
    }
    return { file, exists: true, hooked, readable: true };
  } catch { return { file, exists: true, hooked: [], readable: false }; }
}

export const hookScriptPath = (home = os.homedir()) => path.join(home, ".claude", "agent-flow", "hook.js");

export function hookSnippet(home = os.homedir()) {
  const cmd = `"${process.execPath}" "${hookScriptPath(home)}"`;
  const entry = [{ hooks: [{ type: "command", command: cmd, timeout: 2 }] }];
  return { hooks: Object.fromEntries(HOOK_EVENTS.map(e => [e, entry])) };
}

// Merges the agent-flow hooks into a settings file (keeps everything else, makes a .bak copy first).
export function installHooks(configDir, home = os.homedir()) {
  const file = settingsPath(configDir);
  let s = {};
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, file + ".agent-live.bak");
    s = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } else fs.mkdirSync(configDir, { recursive: true });
  const snip = hookSnippet(home).hooks;
  s.hooks = s.hooks || {};
  for (const ev of HOOK_EVENTS) {
    const keep = (s.hooks[ev] || []).filter(e => !(e.hooks || []).some(h => HOOK_RE.test(h.command || "")));
    s.hooks[ev] = [...keep, ...snip[ev]];
  }
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
  return file;
}
