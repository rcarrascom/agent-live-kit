// agent-live open: open the page in the default browser (cross-platform, no dependencies).
import path from "node:path";
import { spawn } from "node:child_process";
import { loadConfig } from "../config.mjs";

export function openUrl(url) {
  const p = process.platform;
  const [cmd, args] = p === "win32" ? ["cmd", ["/c", "start", "", url]] : p === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try { spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => console.log("Open this address in your browser: " + url)).unref(); }
  catch { console.log("Open this address in your browser: " + url); }
}

export async function run(args) {
  const { cfg } = loadConfig({ cwd: path.resolve(args.cwd || process.cwd()), config: args.config });
  const url = `http://127.0.0.1:${args.port || cfg.port}`;
  console.log("Opening " + url);
  openUrl(url);
  return 0;
}
