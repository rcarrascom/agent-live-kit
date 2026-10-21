// agent-live simulate: a demo team and a scripted session (no agents, no relay). Starts its own page.
//   --port N        page port (default 3010)       --instant   send all events at once (screenshots)
//   --loop          repeat the session             --inject URL  post the events to an already running page instead
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAgentLive } from "../server.mjs";
import { demoConfig, runScenario } from "../demo.mjs";
import { largeDemoConfig, runLargeScenario } from "../demo-large.mjs";
import { green, bold } from "./args.mjs";

export async function run(args) {
  const instant = !!args.instant, port = +(args.port || 3010), large = args.team === "large";
  const pause = ms => new Promise(r => setTimeout(r, instant ? 0 : ms));
  let base, al = null, tmp = null;
  if (args.inject) base = String(args.inject).replace(/\/$/, "");
  else {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-live-demo-"));
    const cfg = (large ? largeDemoConfig : demoConfig)(tmp, port); cfg.history.file = path.join(tmp, "events.jsonl");
    al = createAgentLive({ cfg, root: tmp, upstream: false, watchMetas: false });
    await al.start(port);
    base = `http://127.0.0.1:${port}`;
    console.log(`${bold("Agent Live demo")} on ${green(base)}   (Ctrl+C to stop)`);
  }
  const send = body => fetch(base + "/inject", { method: "POST", body: JSON.stringify(body) });
  let t = 0;
  const once = async () => {
    const session = "demo-" + Date.now().toString(36);
    await (large ? runLargeScenario : runScenario)({
      session, delay: pause,
      sessionStart: m => send(m),
      post: async (type, payload, extra = {}) => { t += 1.3; await send({ type: "agent-event", event: { time: t, type, payload, sessionId: session, ...extra } }); await pause(150); },
    });
  };
  await once();
  console.log("demo session sent");
  if (!al) return 0;
  if (args.loop) for (;;) { await new Promise(r => setTimeout(r, 8000)); await once(); }
  await new Promise(() => {});
}
