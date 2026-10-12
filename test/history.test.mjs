import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHistory } from "../src/history.mjs";
import { createAgentLive } from "../src/server.mjs";
import { withDefaults } from "../src/config.mjs";
import { tmpDir } from "./helpers.mjs";

test("ring keeps only the newest N events", () => {
  const h = createHistory({ file: path.join(tmpDir("al-h-"), "e.jsonl"), ring: 100 });
  for (let i = 0; i < 250; i++) h.push({ i });
  assert.equal(h.events.length, 100);
  assert.equal(h.events[0].i, 150);
});

test("JSONL: append, then reload from a fresh instance", () => {
  const file = path.join(tmpDir("al-h-"), "sub", "e.jsonl");
  const a = createHistory({ file });
  for (let i = 0; i < 5; i++) a.append({ i });
  const b = createHistory({ file }), got = [];
  assert.equal(b.load(o => got.push(o.i)), 5);
  assert.deepEqual(got, [0, 1, 2, 3, 4]);
});

test("a corrupt line is skipped, not fatal", () => {
  const file = path.join(tmpDir("al-h-"), "e.jsonl");
  fs.writeFileSync(file, '{"i":1}\nnot json\n{"i":2}\n');
  const got = []; createHistory({ file }).load(o => got.push(o.i));
  assert.deepEqual(got, [1, 2]);
});

test("a long file is compacted to the last maxLines on load", () => {
  const file = path.join(tmpDir("al-h-"), "e.jsonl");
  fs.writeFileSync(file, Array.from({ length: 500 }, (_, i) => JSON.stringify({ i })).join("\n") + "\n");
  const got = []; createHistory({ file, maxLines: 100 }).load(o => got.push(o.i));
  assert.equal(got.length, 100); assert.equal(got[0], 400);
  assert.equal(fs.readFileSync(file, "utf8").split("\n").filter(Boolean).length, 100);
});

test("server: real events persist and come back after a restart; injected (sim) events never persist", async () => {
  const root = tmpDir("al-srv-"), cfg = withDefaults({ history: { file: ".agent-live/e.jsonl" } }, root);
  const ev = (sid, text) => ({ type: "agent-event", event: { time: 1, type: "message", payload: { agent: "orchestrator", role: "user", content: text }, sessionId: sid } });
  const one = createAgentLive({ cfg, root, upstream: false, watchMetas: false });
  const p1 = await one.start(0);
  await fetch(`http://127.0.0.1:${p1}/inject`, { method: "POST", body: JSON.stringify(ev("demo-1", "injected")) });
  one.ingest(ev("real-1", "real event"));            // what the relay would deliver
  one.ingest(ev("real-1", "real event"));            // duplicate: dropped
  await one.stop();
  const two = createAgentLive({ cfg, root, upstream: false, watchMetas: false });
  const p2 = await two.start(0);
  const h = await (await fetch(`http://127.0.0.1:${p2}/history`)).json();
  await two.stop();
  assert.deepEqual(h.events.map(e => e.event.payload.content), ["real event"]);
});
