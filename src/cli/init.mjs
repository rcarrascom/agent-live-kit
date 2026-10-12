// agent-live init: scan the project and write agent-live.config.json (and explain every choice).
import fs from "node:fs";
import path from "node:path";
import { CONFIG_NAME, withDefaults } from "../config.mjs";
import { readAgents, guessBand, stageFor, whyBand } from "../agents.mjs";
import { detectTools } from "../detect.mjs";
import { TOOL_CATALOGUE } from "../defaults.mjs";
import { bold, dim, green, yellow } from "./args.mjs";

// Pure part (tested): returns { config, notes[] } for a project folder.
export function buildInitConfig(root, { project } = {}) {
  const notes = [];
  const dirs = [".claude/agents"];
  const { agents, problems } = readAgents(root, dirs);
  if (!agents.length) notes.push(yellow("No agent files in .claude/agents. The map will show only the main session and tools; add agents later and re-run init --force."));
  const nodes = [];
  for (const a of agents) {
    const band = guessBand(a);
    nodes.push({ id: a.name, name: a.name, band, stage: stageFor(band), role: a.description, cost: a.model });
    notes.push(`agent ${bold(a.name)} -> band ${band} (${whyBand(a, band)}), stage ${stageFor(band)}`);
  }
  for (const p of problems) notes.push(yellow(`could not read ${p.file || p.dir}: ${p.error}`));
  const tools = detectTools(root);
  for (const t of tools) {
    const c = TOOL_CATALOGUE[t.id];
    nodes.push({ id: t.id, name: c.name, band: "tools", stage: "build", role: c.role });
    notes.push(`tool ${bold(t.id)} -> ${t.why}; built-in activity rule lights it when an agent runs a matching command`);
  }
  const edges = [["human", "orchestrator"]];
  for (const a of agents) edges.push(["orchestrator", a.name]);
  const config = {
    $schema: "./node_modules/agent-live-kit/schema/agent-live.config.schema.json",
    project: project || path.basename(root),
    port: 3002,
    agentsDirs: dirs,
    human: { id: "human", name: "You" },
    orchestrator: { id: "orchestrator", name: "Claude" },
    nodes, edges,
    useDefaultRules: true,
    activityRules: [],
  };
  notes.push(`edges: you -> main session, main session -> each of the ${agents.length} agent(s) (add more in "edges" if agents hand work to each other)`);
  return { config, notes };
}

export async function run(args) {
  const root = path.resolve(args.cwd || process.cwd());
  const file = path.resolve(args.config || path.join(root, CONFIG_NAME));
  if (fs.existsSync(file) && !args.force && !args["dry-run"]) {
    console.log(yellow(`${file} already exists. Use --force to overwrite, or --dry-run to preview.`));
    return 1;
  }
  const { config, notes } = buildInitConfig(root);
  withDefaults(config, root);   // sanity: must be loadable
  console.log(bold(`Scanning ${root}`));
  for (const n of notes) console.log("  - " + n);
  if (args["dry-run"]) { console.log(dim("\n(dry run, nothing written)")); return 0; }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  console.log(green(`\nWrote ${file}`));
  console.log("Next:  agent-live doctor   (checks everything)   then   agent-live start");
  return 0;
}
