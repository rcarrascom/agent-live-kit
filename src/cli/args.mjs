// Minimal argument parser: --flag, --key value, --key=value. Everything else goes to _.
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") && ["config", "port", "config-dir", "cwd", "session"].includes(a.slice(2))) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

const C = process.stdout.isTTY && !process.env.NO_COLOR;
export const color = (code, s) => (C ? `\x1b[${code}m${s}\x1b[0m` : s);
export const green = s => color(32, s), yellow = s => color(33, s), red = s => color(31, s), dim = s => color(2, s), bold = s => color(1, s);
