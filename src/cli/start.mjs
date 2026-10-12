// agent-live start: relay (if not running) + page. Never kills anything; prints the PIDs it started.
import path from "node:path";
import { loadConfig } from "../config.mjs";
import { createAgentLive } from "../server.mjs";
import { portOf, portInUse, relayAnswers, agentLiveAnswers, startRelay, RELAY_PACKAGE } from "../relay.mjs";
import { green, yellow, red, bold, dim } from "./args.mjs";
import { openUrl } from "./open.mjs";

export async function run(args) {
  const { cfg, root, file, errors } = loadConfig({ cwd: path.resolve(args.cwd || process.cwd()), config: args.config });
  if (errors.length) { console.error(red("Config problems (run: agent-live doctor):")); errors.forEach(e => console.error("  - " + e)); return 1; }
  if (!file) console.log(yellow("No agent-live.config.json found: using defaults (run `agent-live init` to tailor the map)."));
  if (args.port) cfg.port = +args.port;
  const url = `http://127.0.0.1:${cfg.port}`;

  if (await agentLiveAnswers(cfg.port)) { console.log(green(`Agent Live is already running: ${url}`)); if (args.open) openUrl(url); return 0; }
  if (await portInUse(cfg.port)) { console.error(red(`Port ${cfg.port} is used by another program. Change "port" in the config, or stop that program yourself.`)); return 1; }

  if (!args["no-relay"]) {
    if (await relayAnswers(cfg.relayUrl)) console.log(dim(`relay already answering on ${cfg.relayUrl}, left alone`));
    else {
      const pid = startRelay(root, portOf(cfg.relayUrl));
      console.log(`relay started (npx ${RELAY_PACKAGE}, telemetry off, launcher PID ${pid}). Stop it yourself by that PID when you are done.`);
      for (let i = 0; i < 40 && !(await relayAnswers(cfg.relayUrl)); i++) await new Promise(r => setTimeout(r, 1000));
      if (!(await relayAnswers(cfg.relayUrl))) console.log(yellow("The relay is not answering yet (first run downloads it). The page will keep retrying. See: agent-live doctor"));
    }
  }
  const al = createAgentLive({ cfg, root });
  try { await al.start(cfg.port); } catch (e) { console.error(red("Could not start the server: " + e.message)); return 1; }
  console.log(`${bold("Agent Live")} for "${cfg.project}" on ${green(url)}   (Ctrl+C stops the page, not the relay)`);
  if (args.open) openUrl(url);
  await new Promise(() => {});
}
