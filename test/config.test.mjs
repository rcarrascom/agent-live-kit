import test from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/schema.mjs";
import { SCHEMA } from "../src/config.mjs";

const good = {
  project: "Shop", port: 3002, agentsDirs: [".claude/agents"],
  human: { id: "human", name: "You" }, orchestrator: { id: "orchestrator", name: "Claude" },
  nodes: [{ id: "coder", name: "coder", band: "build", stage: "build" }],
  edges: [["orchestrator", "coder"]], activityRules: [{ node: "git", tool: "^Bash$", match: "git push" }],
  history: { file: ".agent-live/events.jsonl", ring: 2000 }, keepFinishedMinutes: 30,
};

test("a valid config passes", () => assert.deepEqual(validate(SCHEMA, good), []));
test("an empty config passes (everything has defaults)", () => assert.deepEqual(validate(SCHEMA, {}), []));

const bad = [
  ["port is text", { ...good, port: "3002" }, /port: should be a whole number/],
  ["port out of range", { ...good, port: 70000 }, /port: must be at most 65535/],
  ["unknown field (typo)", { ...good, projct: "x" }, /projct: unknown field/],
  ["node without band", { ...good, nodes: [{ id: "a", name: "a" }] }, /missing required field "band"/],
  ["edge with one end", { ...good, edges: [["only-one"]] }, /needs at least 2 item/],
  ["bad relay url", { ...good, relayUrl: "localhost:3001" }, /relayUrl: .* does not look right/],
  ["bad band colour", { ...good, bands: { build: { color: "green" } } }, /bands.build.color/],
];
for (const [name, cfg, re] of bad) {
  test(`bad config: ${name}`, () => {
    const errors = validate(SCHEMA, cfg);
    assert.ok(errors.length > 0, "expected errors");
    assert.match(errors.join("\n"), re);
  });
}
