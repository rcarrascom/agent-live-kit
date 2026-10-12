// Minimal argument parser: --flag, --key value, --key=value. Everything else goes to _.
const BOOLEAN = new Set(["force", "dry-run", "json", "install", "instant", "loop", "open", "no-relay", "help", "fast"]);
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (!BOOLEAN.has(a.slice(2)) && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

const C = process.stdout.isTTY && !process.env.NO_COLOR;
export const color = (code, s) => (C ? `\x1b[${code}m${s}\x1b[0m` : s);
export const green = s => color(32, s), yellow = s => color(33, s), red = s => color(31, s), dim = s => color(2, s), bold = s => color(1, s);
