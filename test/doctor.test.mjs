import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { runChecks, verdict } from "../src/cli/doctor.mjs";
import { buildInitConfig } from "../src/cli/init.mjs";
import { fakeProject, fakeClaudeDir, fakeRelay, freePort, writeConfig, agentFile } from "./helpers.mjs";

async function setup(mutate, { hooks = true } = {}) {
  const root = fakeProject(), cd = fakeClaudeDir(root, { hooks }), relay = await fakeRelay();
  const { config } = buildInitConfig(root);
  Object.assign(config, { port: await freePort(), relayUrl: relay.url, claude: { configDirs: [cd] } });
  if (mutate) mutate(config, root);
  writeConfig(root, config);
  return { root, cd, relay };
}
const find = (res, re) => res.find(r => re.test(r.title));

test("doctor: all-green path", async () => {
  const { root, relay } = await setup();
  try {
    const res = await runChecks({ cwd: root });
    const notGreen = res.filter(r => r.level !== "ok");
    assert.deepEqual(notGreen, [], JSON.stringify(notGreen, null, 1));
    assert.equal(verdict(res).code, 0);
    assert.ok(find(res, /Test event went in/));
  } finally { await relay.close(); }
});

test("doctor: invalid config is red with a readable message", async () => {
  const { root, relay } = await setup(c => { c.port = "oops"; c.nodez = []; });
  try {
    const res = await runChecks({ cwd: root, skipRoundTrip: true });
    const r = find(res, /has \d+ problem/);
    assert.equal(r.level, "fail");
    assert.match(r.detail, /port: should be a whole number/);
    assert.match(r.detail, /nodez: unknown field/);
    assert.equal(verdict(res).code, 1);
  } finally { await relay.close(); }
});

test("doctor: hooks missing is red and says how to install", async () => {
  const { root, relay } = await setup(null, { hooks: false });
  try {
    const r = find(await runChecks({ cwd: root, skipRoundTrip: true }), /Hooks for agent-flow are NOT installed/);
    assert.equal(r.level, "fail");
    assert.match(r.fix, /agent-live hooks --install/);
  } finally { await relay.close(); }
});

test("doctor: agent without a description is yellow", async () => {
  const { root, relay } = await setup(null);
  try {
    agentFile(path.join(root, ".claude", "agents"), "tester", { description: "" });
    const r = find(await runChecks({ cwd: root, skipRoundTrip: true }), /incomplete/);
    assert.equal(r.level, "warn");
    assert.match(r.detail, /tester: no "description:"/);
  } finally { await relay.close(); }
});

test("doctor: relay not running is yellow with the start command", async () => {
  const { root, relay } = await setup();
  await relay.close();
  const r = find(await runChecks({ cwd: root, skipRoundTrip: true }), /Relay is not running/);
  assert.ok(r && r.level === "warn", "yellow (npx exists wherever node does)");
  assert.match(r.fix, /agent-live start/);
});

test("doctor: port used by another program is red", async () => {
  const port = await freePort();
  const srv = net.createServer(); await new Promise(r => srv.listen(port, "127.0.0.1", r));
  const { root, relay } = await setup(c => { c.port = port; });
  try {
    const r = find(await runChecks({ cwd: root, skipRoundTrip: true }), /is used by another program/);
    assert.equal(r.level, "fail");
  } finally { srv.close(); await relay.close(); }
});

test("doctor: orphan node is yellow, edge to nowhere is red", async () => {
  const { root, relay } = await setup(c => { c.nodes.push({ id: "lonely", name: "lonely", band: "build", stage: "build" }); c.edges.push(["orchestrator", "ghost"]); });
  try {
    const res = await runChecks({ cwd: root, skipRoundTrip: true });
    assert.equal(find(res, /orphan/).level, "warn");
    assert.equal(find(res, /Team map has errors/).level, "fail");
  } finally { await relay.close(); }
});

test("doctor: a rule that does not compile is red", async () => {
  const { root, relay } = await setup(c => { c.activityRules = [{ node: "git", tool: "^Bash$", match: "git (push" }]; });
  try {
    const r = find(await runChecks({ cwd: root, skipRoundTrip: true }), /do not compile/);
    assert.equal(r.level, "fail");
    assert.match(r.detail, /rule #1/);
  } finally { await relay.close(); }
});

test("doctor: no Claude session folder yet is yellow", async () => {
  const { root, relay } = await setup();
  try {
    const empty = fs.mkdtempSync(path.join(path.dirname(root), "al-empty-"));
    const { config } = buildInitConfig(root); Object.assign(config, { port: await freePort(), relayUrl: relay.url, claude: { configDirs: [empty] } });
    writeConfig(root, config);
    const res = await runChecks({ cwd: root, skipRoundTrip: true });
    assert.equal(find(res, /No Claude session folder/).level, "warn");
    assert.equal(find(res, /Hooks for agent-flow are NOT installed/).level, "fail");
  } finally { await relay.close(); }
});
