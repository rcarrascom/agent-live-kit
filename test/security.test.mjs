import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { withDefaults, loadConfig } from "../src/config.mjs";
import { createAgentLive } from "../src/server.mjs";
import { installHooks, HOOK_EVENTS } from "../src/relay.mjs";
import { createJobs, jobTitle } from "../src/jobs.mjs";
import { tmpDir } from "./helpers.mjs";

function call(port, method, p, headers = {}, body) {
  return new Promise(resolve => {
    const r = http.request({ host: "127.0.0.1", port, method, path: p, headers }, res => { let b = ""; res.on("data", d => (b += d)); res.on("end", () => resolve({ status: res.statusCode, body: b })); });
    r.on("error", e => resolve({ status: 0, body: String(e) }));
    if (body) r.write(body);
    r.end();
  });
}
async function withServer(fn) {
  const root = tmpDir("al-sec-");
  const al = createAgentLive({ cfg: withDefaults({}, root), root, upstream: false, watchMetas: false });
  const port = await al.start(0);
  try { await fn(port, al); } finally { await al.stop(); }
}
const ev = sid => JSON.stringify({ type: "agent-event", event: { sessionId: sid, time: 1, type: "message", payload: { agent: "orchestrator", role: "user", content: "hi" } } });

test("a page on another origin cannot post events or read the server", () => withServer(async port => {
  const own = `127.0.0.1:${port}`;
  assert.equal((await call(port, "POST", "/inject", { host: own, origin: "https://evil.example", "content-type": "text/plain" }, ev("x1"))).status, 403);
  assert.equal((await call(port, "GET", "/history", { host: own, origin: "https://evil.example" })).status, 403);
  assert.equal((await call(port, "GET", "/history", { host: `attacker.example:${port}` })).status, 403, "DNS rebinding: foreign Host header");
}));

test("the page itself, curl and localhost still work", () => withServer(async port => {
  const own = `127.0.0.1:${port}`;
  assert.equal((await call(port, "POST", "/inject", { host: own, origin: `http://${own}` }, ev("sim-a"))).status, 200);
  assert.equal((await call(port, "POST", "/inject", {}, ev("sim-b"))).status, 200);
  assert.equal((await call(port, "GET", "/health", { host: `localhost:${port}` })).status, 200);
}));

test("/inject refuses huge bodies and malformed events without leaking errors", () => withServer(async port => {
  const big = await call(port, "POST", "/inject", {}, "[" + "0,".repeat(700000) + "0]");
  assert.ok(big.status === 413 || big.status === 0, "oversized body is refused (status " + big.status + ")");
  const bad = await call(port, "POST", "/inject", {}, JSON.stringify({ type: "agent-event" }));
  assert.equal(bad.status, 400);
  assert.ok(!/TypeError|undefined/.test(bad.body), "no internal error text");
}));

test("hooks --install keeps the FIRST backup and refuses invalid JSON", () => {
  const dir = tmpDir("al-hooks-"), file = path.join(dir, "settings.json");
  fs.writeFileSync(file, JSON.stringify({ theme: "dark" }));
  installHooks(dir, dir); installHooks(dir, dir);
  assert.deepEqual(JSON.parse(fs.readFileSync(file + ".agent-live.bak", "utf8")), { theme: "dark" }, "second run must not overwrite the original backup");
  const s = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(s.theme, "dark");
  for (const e of HOOK_EVENTS) assert.equal(s.hooks[e].length, 1, "no duplicate hook on a second run");
  fs.writeFileSync(file, "{ not json");
  assert.throws(() => installHooks(dir, dir), /not valid JSON/);
  assert.equal(fs.readFileSync(file, "utf8"), "{ not json", "a broken file is left untouched");
});

test("a project config cannot point the history file outside its folder", () => {
  const root = tmpDir("al-cfg-");
  for (const f of ["../elsewhere.jsonl", path.join(tmpDir("al-out-"), "x.jsonl")]) {
    fs.writeFileSync(path.join(root, "agent-live.config.json"), JSON.stringify({ history: { file: f } }));
    assert.ok(loadConfig({ cwd: root }).errors.some(e => /outside the project folder/.test(e)), f);
  }
  fs.writeFileSync(path.join(root, "agent-live.config.json"), JSON.stringify({ history: { file: "logs/ev.jsonl" } }));
  assert.deepEqual(loadConfig({ cwd: root }).errors, []);
});

test("headless jobs: a live pid file becomes a session, an exited one completes it", () => {
  const root = tmpDir("al-jobs-"), dir = path.join(root, "runs"); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "2026-01-01_nightly_build.pid"), "4242");
  fs.writeFileSync(path.join(dir, "2026-01-01_nightly_build.md"), "# Nightly build\nbody");
  const got = []; let up = true;
  const j = createJobs({ cfg: withDefaults({ jobs: { pidDirs: ["runs", "../escape"] } }, root), root, ingest: m => got.push(m), getProjectDirs: () => [], alive: () => up });
  assert.equal(jobTitle(dir, "2026-01-01_nightly_build.pid"), "Nightly build");
  j.scan(); j.scan();
  assert.equal(got.filter(m => m.type === "session-started").length, 1, "announced once");
  assert.ok(got.some(m => m.type === "session-started" && m.sessionId === "job-2026-01-01_nightly_build"));
  up = false; j.scan();
  assert.ok(got.some(m => m.type === "session-ended"));
  assert.ok(got.some(m => m.event && m.event.type === "agent_complete"));
});

test("jobs is off by default", () => {
  const root = tmpDir("al-jobs-off-");
  assert.equal(createJobs({ cfg: withDefaults({}, root), root, ingest() {}, getProjectDirs: () => [] }).enabled, false);
});

test("the large demo team is a valid map and its scenario runs", async () => {
  const { largeDemoConfig, runLargeScenario } = await import("../src/demo-large.mjs");
  const { teamProblems } = await import("../src/config.mjs");
  const root = tmpDir("al-large-"), cfg = largeDemoConfig(root, 0);
  assert.deepEqual(teamProblems(cfg, root), []);
  const al = createAgentLive({ cfg, root, upstream: false, watchMetas: false });
  let n = 0;
  await runLargeScenario({ sessionStart: m => al.ingest(m, true), post: async (type, payload) => { al.ingest({ type: "agent-event", event: { time: ++n, type, payload, sessionId: "demo-t" } }, true); } });
  assert.ok(n > 60);
  assert.ok(!JSON.stringify([cfg.project, cfg.human, cfg.nodes, cfg.activityRules]).match(new RegExp("[A-Za-z]:\\\\|/Users/|/home/|@")), "demo data has no paths or emails");
});
