import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Identity } from "../src/umd.mjs";
import { createMetaIndex } from "../src/metas.mjs";
import { tmpDir } from "./helpers.mjs";

test("hook-born names resolve to the agent type", () => {
  const id = Identity.create();
  assert.equal(id.baseOf("coder-d4e5f6"), "coder");
  assert.equal(id.baseOf("Write a plan for the login"), "sub-agent");
});

test("a known type name wins", () => {
  const id = Identity.create(); id.known.add("tester");
  assert.equal(id.baseOf("tester"), "tester");
});

test("a run seen under its task text and later under <type>-<id suffix> is ONE run", () => {
  const id = Identity.create();
  // the server's exact identity for the first name ...
  id.learnRun({ name: "Resumed run: grip alignment ch", agentType: "tester", task: "Resumed run: full text", agentId: "a3d44e5cf45ffffff" });
  // ... and for the resumed name (same agent id)
  id.learnRun({ name: "tester-ffffff", agentType: "tester", task: "Resumed run: full text", agentId: "a3d44e5cf45ffffff" });
  assert.equal(id.alias("tester-ffffff"), "Resumed run: grip alignment ch");
  assert.equal(id.baseOf("Resumed run: grip alignment ch"), "tester");
  assert.equal(id.taskMap["tester-ffffff"], "Resumed run: full text");
  assert.equal(id.alias("some other name"), "some other name");
});

test("identity survives when only a later event carries the type (ring eviction)", () => {
  const id = Identity.create();
  id.learn({ event: { sessionId: "s", type: "tool_call_start", payload: { agent: "tester-ffffff" }, _type: "tester", _agentId: "AA", _task: "T", _name: "tester-ffffff" } });
  assert.equal(id.baseOf("tester-ffffff"), "tester");
  assert.equal(id.taskMap["tester-ffffff"], "T");
});

test("the first user prompt becomes the session title", () => {
  const id = Identity.create();
  id.learn({ event: { sessionId: "s1", type: "message", payload: { role: "user", content: "Add a login form" } } });
  id.learn({ event: { sessionId: "s1", type: "message", payload: { role: "user", content: "later" } } });
  assert.equal(id.titles.s1, "Add a login form");
});

test("server side: meta.json files are matched by description prefix or id suffix, and account labels come from folder rules", () => {
  const cd = tmpDir("al-meta-");
  const proj = path.join(cd, "projects", "C--work-app-b"), sub = path.join(proj, "sess-1", "subagents");
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, "agent-abc123def456.meta.json"), JSON.stringify({ agentType: "researcher", description: "Find prior art for the login flow" }));
  const cfg = { accounts: [{ match: "-b$", label: "B" }] };
  const idx = createMetaIndex({ cfg, getProjectDirs: () => [{ dir: proj, name: "C--work-app-b", configDir: cd }] });
  idx.scan();
  assert.equal(idx.resolveRun("sess-1", "Find prior art for the log").type, "researcher");   // relay names a run after the first ~30 chars
  assert.equal(idx.resolveRun("sess-1", "researcher-def456").id, "abc123def456");           // or "<type>-<last 6 of id>"
  assert.equal(idx.resolveRun("sess-1", "something else entirely"), null);
  assert.equal(idx.resolveRun("other-session", "Find prior art for the log"), null);
  assert.equal(idx.accountBySession["sess-1"], "B");
});
