// Loads, merges and validates agent-live.config.json, and builds the team map (nodes, edges, stages).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./schema.mjs";
import { BANDS, STAGES, defaultRules } from "./defaults.mjs";
import { readAgents, guessBand, stageFor } from "./agents.mjs";

export const CONFIG_NAME = "agent-live.config.json";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA = JSON.parse(fs.readFileSync(path.join(HERE, "..", "schema", "agent-live.config.schema.json"), "utf8"));

export function findConfig(cwd, explicit) {
  if (explicit) return path.resolve(cwd, explicit);
  let dir = path.resolve(cwd);
  for (;;) {
    const f = path.join(dir, CONFIG_NAME);
    if (fs.existsSync(f)) return f;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

// Returns { cfg, root, file, raw, errors[] }. Never throws: problems come back as human-readable errors.
export function loadConfig({ cwd = process.cwd(), config } = {}) {
  const file = findConfig(cwd, config);
  let raw = {}, errors = [];
  if (file) {
    try { raw = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")); }
    catch (e) { errors.push(`${file}: not valid JSON (${e.message}). Tip: no trailing commas, use double quotes.`); }
    if (!errors.length) errors = validate(SCHEMA, raw);
  }
  const root = file ? path.dirname(file) : path.resolve(cwd);
  return { cfg: withDefaults(errors.length ? {} : raw, root), root, file, raw, errors };   // a broken config falls back to defaults so doctor can keep checking
}

export function withDefaults(raw, root) {
  const r = raw && typeof raw === "object" ? raw : {};
  const bands = { ...BANDS };
  for (const [k, v] of Object.entries(r.bands || {})) bands[k] = { ...(bands[k] || { label: k, color: "#9fb2cf" }), ...v };
  const hist = r.history || {};
  return {
    project: r.project || path.basename(root),
    port: r.port || 3002,
    relayUrl: r.relayUrl || "http://127.0.0.1:3001",
    agentsDirs: r.agentsDirs && r.agentsDirs.length ? r.agentsDirs : [".claude/agents"],
    claude: r.claude || {},
    accounts: r.accounts || [],
    human: { id: "human", name: "You", role: "The person who gives the tasks, answers questions and approves permissions.", ...(r.human || {}) },
    orchestrator: { id: "orchestrator", name: "Claude", role: "The main Claude Code session. It splits the task and hands pieces to the sub-agents.", byAccount: {}, ...(r.orchestrator || {}) },
    relayNode: r.relayNode === undefined ? "agent-flow" : r.relayNode,
    bands,
    stages: r.stages || STAGES,
    nodes: r.nodes || [],
    edges: r.edges || [],
    useDefaultRules: r.useDefaultRules !== false,
    activityRules: r.activityRules || [],
    history: { file: path.resolve(root, hist.file || ".agent-live/events.jsonl"), ring: hist.ring || 2000, maxLines: hist.maxLines || 6000 },
    keepFinishedMinutes: r.keepFinishedMinutes || 30,
  };
}

export function allRules(cfg) {
  const rules = (cfg.useDefaultRules ? defaultRules() : []).concat(cfg.activityRules);
  return rules.map(r => (r.node === "@human" ? { ...r, node: cfg.human.id } : r));
}

// Nodes and edges. With configured nodes they are used as given (human, main session and relay boxes are added if missing);
// without them the map is built from the agent files.
export function buildTeam(cfg, root) {
  const nodes = cfg.nodes.map(n => ({ stage: "", role: "", cost: "", lane: "", sees: "", ...n }));
  const have = new Set(nodes.map(n => n.id));
  const add = (n, front) => { if (!have.has(n.id)) { have.add(n.id); front ? nodes.unshift(n) : nodes.push(n); } };
  if (!cfg.nodes.length) {
    for (const a of readAgents(root, cfg.agentsDirs).agents) {
      const band = guessBand(a);
      add({ id: a.name, name: a.name, band, stage: stageFor(band), role: a.description, cost: a.model, lane: "", sees: a.tools || "all tools" });
    }
  }
  add({ id: cfg.orchestrator.id, name: cfg.orchestrator.name, band: "claude", stage: "plan", role: cfg.orchestrator.role, cost: "", lane: "", sees: "" }, true);
  add({ id: cfg.human.id, name: cfg.human.name, band: "people", stage: "plan", role: cfg.human.role, cost: "", lane: "", sees: "everything" }, true);
  if (cfg.relayNode) add({ id: cfg.relayNode, name: "agent-flow relay", band: "tools", stage: "plan", role: "Collects Claude Code hook events and streams them to this page. Green means it is answering.", cost: "", lane: "", sees: "hook events" });
  let edges = cfg.edges.map(e => [...e]);
  if (!edges.length) {
    edges.push([cfg.human.id, cfg.orchestrator.id]);
    for (const n of nodes) if (!["people", "claude", "tools", "other"].includes(n.band)) edges.push([cfg.orchestrator.id, n.id]);
  }
  return { nodes, edges, stages: cfg.stages };
}

export function teamPayload(cfg, root) {
  const t = buildTeam(cfg, root);
  return { project: cfg.project, human: cfg.human.id, orchestrator: cfg.orchestrator.id, orchestratorByAccount: cfg.orchestrator.byAccount || {},
    relayNode: cfg.relayNode || "", bands: cfg.bands, keepFinishedMinutes: cfg.keepFinishedMinutes, ...t };
}

// Node/edge sanity used by doctor: nodes nobody connects to, edges that point nowhere, duplicate ids, unknown bands/stages.
export function teamProblems(cfg, root) {
  const t = buildTeam(cfg, root), ids = new Set(), out = [];
  const stages = new Set(t.stages.map(s => s[0]));
  for (const n of t.nodes) {
    if (ids.has(n.id)) out.push(`duplicate node id "${n.id}"`);
    ids.add(n.id);
    if (!cfg.bands[n.band]) out.push(`node "${n.id}" uses band "${n.band}" which is not defined in "bands"`);
    if (n.stage && !stages.has(n.stage)) out.push(`node "${n.id}" uses stage "${n.stage}" which is not in "stages"`);
  }
  const linked = new Set();
  for (const [a, b] of t.edges) {
    if (!ids.has(a)) out.push(`edge ${a} -> ${b}: "${a}" is not a node`);
    if (!ids.has(b)) out.push(`edge ${a} -> ${b}: "${b}" is not a node`);
    linked.add(a); linked.add(b);
  }
  const loose = t.nodes.filter(n => !linked.has(n.id) && n.band !== "tools" && n.band !== "people").map(n => n.id);
  for (const id of loose) out.push(`node "${id}" has no edge (orphan): connect it in "edges" or remove it`);
  return out;
}
