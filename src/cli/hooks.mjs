// agent-live hooks: show (default) or install (--install) the Claude Code hooks that feed agent-flow.
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config.mjs";
import { claudeConfigDirs } from "../paths.mjs";
import { hookSnippet, hookScriptPath, installHooks, hookStatus } from "../relay.mjs";
import { green, yellow, red, bold } from "./args.mjs";

export async function run(args) {
  const { cfg } = loadConfig({ cwd: path.resolve(args.cwd || process.cwd()), config: args.config });
  const dir = args["config-dir"] ? path.resolve(args["config-dir"]) : claudeConfigDirs(cfg)[0];
  const st = hookStatus(dir);
  console.log(bold(`Claude Code settings: ${st.file}`));
  console.log(st.hooked.length ? green(`agent-flow hooks present for: ${st.hooked.join(", ")}`) : yellow("no agent-flow hooks there yet"));
  if (!args.install) {
    console.log("\nThe relay (`agent-live start`) installs these into ~/.claude/settings.json by itself on its first run.");
    console.log("For another Claude config folder (CLAUDE_CONFIG_DIR, ~/.claude-work ...) merge this into its settings.json,");
    console.log("or run:  agent-live hooks --install --config-dir <folder>\n");
    console.log(JSON.stringify(hookSnippet(), null, 2));
    return 0;
  }
  if (!fs.existsSync(hookScriptPath())) { console.error(red(`${hookScriptPath()} does not exist yet. Run \`agent-live start\` once (the relay writes it), then try again.`)); return 1; }
  let f;
  try { f = installHooks(dir); } catch (e) { console.error(red(e.message)); return 1; }
  console.log(green(`Hooks merged into ${f} (the original is kept next to it as .agent-live.bak). Restart Claude Code sessions to pick them up.`));
  return 0;
}
