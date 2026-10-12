// Where Claude Code keeps its files. Everything here is overridable from the config (claude.* fields).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Claude Code names a project's folder after its absolute path with every character that is not a letter or digit
// replaced by "-"  (C:\work\my app -> C--work-my-app,  /home/me/app -> -home-me-app).
export const encodeProjectPath = p => path.resolve(p).replace(/[^A-Za-z0-9]/g, "-");

export function claudeConfigDirs(cfg, home = os.homedir(), env = process.env) {
  const given = cfg && cfg.claude && cfg.claude.configDirs;
  if (given && given.length) return given.map(d => path.resolve(d.replace(/^~(?=$|[\\/])/, home)));
  const out = [];
  if (env.CLAUDE_CONFIG_DIR) out.push(path.resolve(env.CLAUDE_CONFIG_DIR));
  out.push(path.join(home, ".claude"));
  try {
    for (const d of fs.readdirSync(home)) {
      if (/^\.claude-/.test(d) && fs.existsSync(path.join(home, d, "projects"))) out.push(path.join(home, d));
    }
  } catch {}
  return [...new Set(out)];
}

// Project folders (inside each config dir) whose sessions belong to this team.
export function claudeProjectDirs(cfg, root, configDirs) {
  const wanted = new Set([encodeProjectPath(root), ...((cfg.claude && cfg.claude.extraProjectPaths) || []).map(encodeProjectPath)]);
  let re = null;
  try { if (cfg.claude && cfg.claude.projectMatch) re = new RegExp(cfg.claude.projectMatch, "i"); } catch {}
  const out = [];
  for (const cd of configDirs) {
    let names = [];
    try { names = fs.readdirSync(path.join(cd, "projects")); } catch { continue; }
    for (const n of names) if (wanted.has(n) || (re && re.test(n))) out.push({ dir: path.join(cd, "projects", n), name: n, configDir: cd });
  }
  return out;
}

export function accountFor(cfg, projectName) {
  for (const a of cfg.accounts || []) { try { if (new RegExp(a.match, "i").test(projectName)) return a.label; } catch {} }
  return "";
}
