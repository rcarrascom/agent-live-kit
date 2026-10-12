import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildInitConfig, run } from "../src/cli/init.mjs";
import { loadConfig, teamProblems } from "../src/config.mjs";
import { guessBand } from "../src/agents.mjs";
import { fakeProject } from "./helpers.mjs";

test("init on a fake project: nodes, bands, edges, tools", () => {
  const root = fakeProject();
  const { config, notes } = buildInitConfig(root);
  const byId = Object.fromEntries(config.nodes.map(n => [n.id, n]));
  assert.equal(byId.researcher.band, "research");
  assert.equal(byId.tester.band, "check");
  assert.equal(byId["code-reviewer"].band, "review");
  for (const t of ["git", "npm", "tests", "build", "lint", "web"]) assert.ok(byId[t], `tool node ${t}`);
  assert.equal(byId.git.band, "tools");
  assert.ok(config.edges.some(e => e[0] === "orchestrator" && e[1] === "tester"));
  assert.ok(notes.some(n => /researcher/.test(n)), "explains its choices");
});

test("init writes a config that loads, validates and has no orphans", async () => {
  const root = fakeProject();
  const log = console.log; console.log = () => {};
  try { assert.equal(await run({ cwd: root }), 0); } finally { console.log = log; }
  const { errors, cfg } = loadConfig({ cwd: root });
  assert.deepEqual(errors, []);
  assert.deepEqual(teamProblems(cfg, root), []);
  assert.ok(fs.existsSync(path.join(root, "agent-live.config.json")));
});

test("init refuses to overwrite without --force", async () => {
  const root = fakeProject();
  const log = console.log; console.log = () => {};
  try { await run({ cwd: root }); assert.equal(await run({ cwd: root }), 1); assert.equal(await run({ cwd: root, force: true }), 0); } finally { console.log = log; }
});

test("band heuristics: tools and descriptions", () => {
  assert.equal(guessBand({ name: "helper", tools: "Read, Grep", description: "" }), "review");
  assert.equal(guessBand({ name: "helper", tools: "Read, WebSearch", description: "" }), "research");
  assert.equal(guessBand({ name: "helper", tools: "Read, Edit, Write", description: "" }), "build");
  assert.equal(guessBand({ name: "gemini-second-opinion", tools: "Bash", description: "" }), "outside");
});
