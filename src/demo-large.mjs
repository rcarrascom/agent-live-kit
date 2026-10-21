// A larger fictional team (about 30 boxes in several rows) for screenshots and for trying a busy map: `agent-live simulate --team large`.
// Every name here is invented.
import { withDefaults } from "./config.mjs";

export function largeDemoConfig(root, port = 3010) {
  const n = (id, name, band, stage, role, cost = "") => ({ id, name, band, stage, role, cost });
  const ag = (id, band, stage, role, cost) => n(id, id, band, stage, role, cost);
  const tool = (id, name, role, stage = "build") => n(id, name, "tools", stage, role);
  const agents = ["general-purpose", "explorer", "researcher", "product-planner", "ux-designer", "api-engineer", "mobile-engineer", "qa-tester",
    "accessibility-checker", "security-reviewer", "release-manager", "docs-writer", "model-x", "model-y", "local-llm", "notes-search", "image-gen", "sprite-tool"];
  return withDefaults({
    project: "Acme Mobile App", port,
    human: { id: "human", name: "Alex", role: "Gives the tasks, answers questions, approves permissions." },
    orchestrator: { id: "orchestrator", name: "Claude A", role: "Main session on the first account. Splits the work and hands pieces to the sub-agents." },
    bands: { art: { label: "Design and media", color: "#ff8fb3" }, local: { label: "Private AIs", color: "#6fd3a0" } },
    nodes: [
      n("claude-b", "Claude B", "claude", "plan", "Main session on the second account. Idle in this demo."),
      ag("general-purpose", "research", "plan", "Built-in agent type for open-ended multi-step work.", "built in"),
      ag("explorer", "research", "research", "Read-only search across the codebase.", "haiku"),
      ag("researcher", "research", "research", "Finds prior art, docs and sources before anything is built.", "sonnet"),
      ag("product-planner", "design", "design", "Turns a request into a short plan with acceptance criteria.", "opus"),
      ag("ux-designer", "design", "design", "Screens, flows and copy.", "sonnet"),
      ag("api-engineer", "build", "build", "Builds and changes the backend API.", "sonnet"),
      ag("mobile-engineer", "build", "build", "Builds the app screens and state.", "sonnet"),
      ag("qa-tester", "check", "check", "Writes and runs tests; reports failures with the exact command.", "sonnet"),
      ag("accessibility-checker", "check", "check", "Checks contrast, labels and touch targets.", "haiku"),
      ag("security-reviewer", "review", "review", "Reads the diff for injection, secrets and unsafe defaults. Read-only.", "opus"),
      ag("release-manager", "ops", "ship", "Version bump, changelog and store notes.", "haiku"),
      ag("docs-writer", "ops", "ship", "Keeps README and help pages current.", "haiku"),
      n("model-x", "Model X (outside AI)", "outside", "research", "An outside model asked for a second opinion. Dim unless a command mentions it."),
      n("model-y", "Model Y (outside AI)", "outside", "design", "Another outside model, used for brainstorming."),
      n("local-llm", "Local LLM", "local", "research", "A model running on this computer. Nothing leaves the machine."),
      n("notes-search", "Notes search", "local", "research", "Searches the team's private notes."),
      n("image-gen", "Image generator", "art", "design", "Makes concept images and icons."),
      n("sprite-tool", "Icon pack builder", "art", "build", "Packs icons into sheets."),
      tool("git", "git", "Version control."), tool("npm", "npm / node", "Package manager and scripts."), tool("docker", "docker", "Containers."),
      tool("tests", "tests", "Test runners.", "check"), tool("web", "web", "Search and fetch.", "research"), tool("simulator", "device simulator", "Runs the app on a virtual phone.", "check"),
      tool("lint", "lint", "Linters and formatters.", "check"),
    ],
    edges: [["human", "orchestrator"], ["human", "claude-b"], ...agents.map(id => ["orchestrator", id])],
    activityRules: [
      { node: "model-x", tool: "^(Bash|PowerShell)$", match: "model-x" }, { node: "model-y", tool: "^(Bash|PowerShell)$", match: "model-y" },
      { node: "local-llm", tool: "^(Bash|PowerShell)$", match: "local-llm" }, { node: "image-gen", tool: "^(Bash|PowerShell)$", match: "image-gen" },
      { node: "simulator", tool: "^(Bash|PowerShell)$", match: "simulator" }, { node: "lint", tool: "^(Bash|PowerShell)$", match: "\\b(eslint|prettier)\\b" },
    ],
  }, root);
}

export async function runLargeScenario({ post, session, delay = () => Promise.resolve(), sessionStart }) {
  const sid = session || "demo-session-0002";
  await sessionStart({ type: "session-started", sessionId: sid, label: "Demo: ship version 2.4" });
  await post("agent_spawn", { name: "orchestrator", isMain: true, task: "Ship version 2.4 of the app" });
  await post("message", { agent: "orchestrator", role: "user", content: "Ship 2.4: dark mode, faster start-up, fix the sign-in bug, update the store notes." });
  await post("message", { agent: "orchestrator", role: "thinking", content: "Research and plan first, then backend and app in parallel, then tests and review, then release notes." });
  // [run id (type + 6 hex digits), task, [[tool, args], ...], finishes?]
  const runs = [
    ["researcher-1a2b3c", "Compare dark-mode approaches used by popular apps", [["WebSearch", "dark mode system setting vs in-app toggle"], ["WebFetch", "https://example.com/design-guidelines"], ["Read", "docs/ui/theme.md"]], true],
    ["product-planner-4d5e6f", "Write the plan and acceptance criteria for 2.4", [["Read", "docs/ROADMAP.md"], ["Write", "docs/plans/2.4.md"]], true],
    ["ux-designer-7a8b9c", "Draft dark-mode colours and the settings screen", [["Read", "src/theme/colors.ts"], ["Bash", "node scripts/image-gen.mjs --palette dark"], ["Edit", "src/theme/colors.ts"]], true],
    ["api-engineer-0d1e2f", "Fix the sign-in bug in the session endpoint", [["Grep", "pattern: refreshToken in api/"], ["Read", "api/session.ts"], ["Edit", "api/session.ts"], ["Bash", "npm test -- api/session"]], true],
    ["mobile-engineer-3a4b5c", "Add the dark-mode toggle and apply the theme", [["Read", "src/screens/Settings.tsx"], ["Edit", "src/screens/Settings.tsx"], ["Write", "src/theme/useTheme.ts"], ["Bash", "npx eslint src --fix"]], false],
    ["qa-tester-6d7e8f", "Run the full suite on the simulator and add sign-in tests", [["Bash", "npm test -- --coverage"], ["Bash", "node scripts/simulator.mjs --device small-phone"], ["Edit", "tests/signin.test.ts"]], false],
    ["accessibility-checker-9a0b1c", "Check contrast of the dark theme", [["Read", "src/theme/colors.ts"], ["Bash", "node scripts/contrast-check.mjs"]], true],
    ["security-reviewer-2d3e4f", "Review the sign-in change for security problems", [["Read", "api/session.ts"], ["Grep", "pattern: password|token in api/"]], false],
    ["release-manager-5a6b7c", "Prepare the changelog and store notes for 2.4", [["Read", "CHANGELOG.md"], ["Edit", "CHANGELOG.md"], ["Bash", "git log --oneline v2.3..HEAD"]], false],
  ];
  for (const [id, task] of runs) {
    await post("subagent_dispatch", { parent: "orchestrator", child: id, task });
    await post("agent_spawn", { name: id, parent: "orchestrator", task });
  }
  await delay(400);
  for (let round = 0; round < 4; round++) for (const [id, , steps] of runs) {
    const [tool, args] = steps[round % steps.length];
    await post("tool_call_start", { agent: id, tool, args, preview: tool + ": " + args });
    await post("tool_call_end", { agent: id, tool, result: "ok", tokenCost: 150 + ((args.length * 13 + round * 97) % 900) });
  }
  await post("message", { agent: runs[7][0], role: "assistant", content: "Finding: the refresh token is written to the debug log. Remove it before release." });
  for (const [id, , , done] of runs) if (done) { await post("subagent_return", { child: id, parent: "orchestrator", summary: "complete" }); await post("agent_complete", { name: id }); }
  await post("tool_call_start", { agent: "orchestrator", tool: "Bash", args: "node scripts/model-x.mjs --review docs/plans/2.4.md" });
  await post("tool_call_start", { agent: "orchestrator", tool: "Bash", args: "git status" });
  await post("permission_requested", { agent: runs[5][0], message: "Waiting for permission to run: npm run e2e:device" });
  await post("context_update", { agent: "orchestrator", tokens: 118000, breakdown: {}, tokensMax: 200000 });
}
