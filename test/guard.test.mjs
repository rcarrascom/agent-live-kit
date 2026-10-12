import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const guard = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "recipes", "hooks", "guard.mjs");
const run = (tool_name, tool_input) => spawnSync(process.execPath, [guard], { input: JSON.stringify({ tool_name, tool_input }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: path.dirname(guard) + "/none" } });

test("guard blocks destructive git, allows normal git", () => {
  const b = run("Bash", { command: "git push --force origin main" });
  assert.equal(b.status, 2); assert.match(b.stderr, /destructive git/);
  assert.equal(run("Bash", { command: "git status" }).status, 0);
});
test("guard blocks writes to secret files and vendored code", () => {
  assert.equal(run("Write", { file_path: "C:\\app\\.env" }).status, 2);
  assert.equal(run("Edit", { file_path: "/app/vendor/lib/x.js" }).status, 2);
  assert.equal(run("Edit", { file_path: "/app/src/x.js" }).status, 0);
});
test("guard enforces the commit prefix", () => {
  assert.equal(run("Bash", { command: 'git commit -m "oops no prefix"' }).status, 2);
  assert.equal(run("Bash", { command: 'git commit -m "feat: add login"' }).status, 0);
});
test("recursive delete is allowed in temp folders only", () => {
  assert.equal(run("Bash", { command: "rm -rf /home/u/project" }).status, 2);
  assert.equal(run("Bash", { command: "rm -rf /tmp/scratch" }).status, 0);
});
test("a malformed payload never blocks", () => {
  const r = spawnSync(process.execPath, [guard], { input: "not json", encoding: "utf8" });
  assert.equal(r.status, 0);
});
