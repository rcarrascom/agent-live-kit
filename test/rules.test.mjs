import test from "node:test";
import assert from "node:assert/strict";
import { Rules } from "../src/umd.mjs";
import { allRules, withDefaults } from "../src/config.mjs";

const compiled = (cfg = {}) => Rules.compile(allRules(withDefaults(cfg, "/x"))).rules;
const nodes = (tool, arg, c = compiled()) => Rules.matchRules(c, tool, arg).map(r => r.node);

test("git commands light the git node", () => {
  assert.deepEqual(nodes("Bash", "git commit -m x"), ["git"]);
  assert.ok(nodes("Bash", "gh pr create").includes("git"));
});
test("one command can light several nodes", () => {
  const n = nodes("Bash", "npm test");
  assert.ok(n.includes("npm") && n.includes("tests"));
});
test("tests, builds, docker, lint, cloud, database, web", () => {
  assert.ok(nodes("Bash", "pytest -q").includes("tests"));
  assert.ok(nodes("Bash", "cargo build --release").includes("build"));
  assert.ok(nodes("PowerShell", "docker compose up -d").includes("docker"));
  assert.ok(nodes("Bash", "eslint src").includes("lint"));
  assert.ok(nodes("Bash", "terraform apply").includes("cloud"));
  assert.ok(nodes("Bash", "psql -c 'select 1'").includes("database"));
  assert.ok(nodes("WebSearch", "anything").includes("web"));
  assert.ok(nodes("Bash", "curl -s https://example.com").includes("web"));
});
test("tool name filter: an Edit that mentions git does not light git", () => {
  assert.deepEqual(nodes("Edit", "git commit"), []);
});
test("an unrelated command lights nothing", () => assert.deepEqual(nodes("Bash", "ls -la"), []));
test("the question tool marks the human node (waiting)", () => {
  const hits = Rules.matchRules(compiled(), "AskUserQuestion", "");
  assert.equal(hits[0].node, "human");
  assert.equal(hits[0].waiting, true);
});
test("your own rules are added to the defaults and the matcher is case-insensitive by default", () => {
  const c = compiled({ activityRules: [{ node: "deploy", tool: "^Bash$", match: "release\\.sh" }] });
  assert.deepEqual(nodes("Bash", "./RELEASE.SH prod", c), ["deploy"]);
});
test("useDefaultRules:false keeps only yours", () => {
  const c = compiled({ useDefaultRules: false, activityRules: [{ node: "a", tool: "^X$" }] });
  assert.deepEqual(nodes("Bash", "git push", c), []);
  assert.deepEqual(nodes("X", "", c), ["a"]);
});
test("a bad regex is reported, not thrown", () => {
  const r = Rules.compile([{ node: "a", tool: "(" }, { node: "b", tool: "^ok$" }]);
  assert.equal(r.errors.length, 1);
  assert.equal(r.rules.length, 1);
});
test("a rule with neither tool nor match never fires", () => assert.deepEqual(nodes("Bash", "x", Rules.compile([{ node: "z" }]).rules), []));
