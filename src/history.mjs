// Event history: an in-memory ring (what the page loads) plus an append-only JSONL file (survives restarts).
import fs from "node:fs";
import path from "node:path";

export function createHistory({ file, ring = 2000, maxLines = 6000 }) {
  const events = [];
  let writable = true;
  function append(obj) {
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, JSON.stringify(obj) + "\n"); }
    catch { writable = false; }
  }
  // Reads the last maxLines lines, compacts the file when it grew past twice that, and calls onItem for each line.
  function load(onItem) {
    let txt = "";
    try { txt = fs.readFileSync(file, "utf8"); } catch { return 0; }
    const all = txt.split("\n").filter(Boolean);
    const lines = all.slice(-maxLines);
    if (all.length > maxLines * 2) { try { fs.writeFileSync(file, lines.join("\n") + "\n"); } catch {} }
    let n = 0;
    for (const l of lines) { try { onItem(JSON.parse(l)); n++; } catch {} }
    return n;
  }
  function push(item) { events.push(item); while (events.length > ring) events.shift(); }
  function check() {   // used by doctor: can the history file be written?
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.accessSync(path.dirname(file), fs.constants.W_OK); return true; } catch { return false; }
  }
  return { events, append, load, push, check, get writable() { return writable; }, file };
}
