// Reads agent definition files (.md with a YAML-ish frontmatter) and guesses a band for each.
import fs from "node:fs";
import path from "node:path";
import { BAND_STAGE } from "./defaults.mjs";

export function frontmatter(txt) {
  const m = String(txt).replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) { key = kv[1]; out[key] = kv[2].trim().replace(/^["']|["']$/g, ""); }
    else if (key && /^\s+\S/.test(line)) out[key] += " " + line.trim();
  }
  return out;
}

export function readAgents(root, dirs) {
  const agents = [], problems = [];
  for (const d of dirs) {
    const dir = path.resolve(root, d);
    let files = [];
    try { files = fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort(); } catch { problems.push({ dir, error: "folder not found" }); continue; }
    for (const f of files) {
      let fm = {};
      try { fm = frontmatter(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { problems.push({ file: path.join(dir, f), error: String(e.message) }); continue; }
      agents.push({ file: path.join(dir, f), name: fm.name || f.replace(/\.md$/, ""), description: fm.description || "", model: fm.model || "inherit", tools: fm.tools || "", hasName: !!fm.name });
    }
  }
  return { agents, problems };
}

const R = s => new RegExp(s, "i");
const BY_NAME = [
  ["outside", R("gpt|gemini|openai|ollama|qwen|llama|grok|deepseek|external|outside|codex")],
  ["review", R("review|audit|critic|advis|security|judge|lawyer|legal")],
  ["check", R("test|qa\\b|quality|verif|valid|lint|check|e2e")],
  ["research", R("research|scout|explor|investigat|search|analy[sz]|survey|study")],
  ["design", R("design|architect|plan|spec|product|ux\\b|ui\\b|strateg")],
  ["ops", R("deploy|release|ops\\b|devops|infra|doc|writer|publish|changelog|ship|migrat")],
  ["build", R("build|code|implement|develop|engineer|fix|refactor|program|write")],
];
export function guessBand(a) {
  for (const [band, re] of BY_NAME) if (re.test(a.name)) return band;
  const tools = a.tools || "";
  const canEdit = /\b(Edit|Write|NotebookEdit|MultiEdit)\b/.test(tools) || tools === "";
  if (/Web(Search|Fetch)/.test(tools) && !/\b(Edit|MultiEdit)\b/.test(tools)) return "research";
  if (tools && !canEdit) return "review";
  for (const [band, re] of BY_NAME) if (re.test(a.description)) return band;
  return canEdit ? "build" : "review";
}
export const stageFor = band => BAND_STAGE[band] || "plan";

export function whyBand(a, band) {
  if (BY_NAME.find(([b, re]) => b === band && re.test(a.name))) return `the name "${a.name}" suggests ${band}`;
  if (band === "research" && /Web/.test(a.tools)) return "it can search the web but not edit files";
  if (band === "review" && a.tools && !/Edit|Write/.test(a.tools)) return "it has read-only tools";
  if (BY_NAME.find(([b, re]) => b === band && re.test(a.description))) return `its description mentions ${band} work`;
  return "default for an agent that can edit files";
}
