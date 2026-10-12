// Screenshot helper: starts a headless Chromium-family browser (Edge / Chrome) on a debugging port, loads a URL,
// optionally runs some page code, saves a PNG, then stops ONLY the browser it started.
//   node scripts/shot.mjs --url http://127.0.0.1:3101/?sim=1 --out shot.png [--w 1920] [--h 1080] [--dpr 1] [--wait 4000]
//        [--eval "document.querySelector('[data-skin=flow]').click()"] [--after 1500] [--browser path] [--cdp 9333]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "../src/cli/args.mjs";

const a = parseArgs(process.argv.slice(2));
const W = +(a.w || 1920), H = +(a.h || 1080), DPR = +(a.dpr || 1), PORT = +(a.cdp || 9333);
const CANDIDATES = [a.browser, process.env.BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"].filter(Boolean);
const exe = CANDIDATES.find(p => fs.existsSync(p));
if (!exe) { console.error("No Edge/Chrome found. Pass --browser <path>."); process.exit(2); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "al-shot-"));
const br = spawn(exe, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

const done = code => { try { br.kill(); } catch {} setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(code); }, 400); };
try {
  let tab, lastErr;
  for (let i = 0; i < 80 && !tab; i++) { try { tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(a.url)}`, { method: "PUT" })).json(); } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 250)); } }
  if (!tab) throw new Error("browser did not start: " + (lastErr && lastErr.message));
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r));
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) pend[d.id](d.result); if (d.method === "Runtime.exceptionThrown") console.log("PAGE ERROR", JSON.stringify(d.params.exceptionDetails).slice(0, 300)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DPR, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await send("Page.enable");
  await new Promise(r => setTimeout(r, +(a.wait || 4000)));
  if (a.eval) { const r = await send("Runtime.evaluate", { expression: String(a.eval), returnByValue: true }); if (r.exceptionDetails) console.log("eval error", JSON.stringify(r.exceptionDetails).slice(0, 300)); await new Promise(r2 => setTimeout(r2, +(a.after || 1500))); }
  const s = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(a.out, Buffer.from(s.data, "base64"));
  console.log("saved", a.out, `${W}x${H} @${DPR}`);
  done(0);
} catch (e) { console.error(e.message); done(1); }
