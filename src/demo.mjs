// A generic demo: a small web-app team and a scripted session, so the page can be seen without running any agent.
import { withDefaults } from "./config.mjs";

export function demoConfig(root, port = 3010) {
  const n = (id, name, band, stage, role, cost = "") => ({ id, name, band, stage, role, cost });
  const tool = (id, name, role) => n(id, name, "tools", "build", role);
  return withDefaults({
    project: "Demo web app", port,
    human: { id: "human", name: "You", role: "Gives the task, answers questions, approves permissions." },
    orchestrator: { id: "orchestrator", name: "Claude (main session)", role: "Splits the task and hands pieces to the sub-agents." },
    nodes: [
      n("planner", "planner", "design", "design", "Turns a request into a short plan with acceptance criteria.", "opus"),
      n("coder", "coder", "build", "build", "Implements the plan in small, tested steps.", "sonnet"),
      n("tester", "tester", "check", "check", "Writes and runs tests; reports failures with the exact command.", "sonnet"),
      n("security-reviewer", "security-reviewer", "review", "review", "Reads the diff for injection, secrets and unsafe defaults. Read-only.", "opus"),
      n("docs-writer", "docs-writer", "ops", "ship", "Updates the README and the changelog.", "haiku"),
      n("gpt-second-opinion", "second opinion (outside AI)", "outside", "research", "An outside model asked for a second opinion. Dim unless a command mentions it."),
      tool("git", "git", "Version control."), tool("npm", "npm / node", "Package manager and scripts."), tool("docker", "docker", "Containers."),
      tool("tests", "tests", "Test runners."), tool("web", "web", "Search and fetch."),
    ],
    activityRules: [{ node: "gpt-second-opinion", tool: "^(Bash|PowerShell)$", match: "second-opinion" }],
  }, root);
}

const SID = "demo-session-0001";
// post(type, payload, extra) sends one agent-flow style event. Names ending in six hex digits are typed by the page.
export async function runScenario({ post, session, delay = () => Promise.resolve(), sessionStart }) {
  const sid = session || SID;
  await sessionStart({ type: "session-started", sessionId: sid, label: "Demo: add a login form" });
  const P = "planner-a1b2c3", C = "coder-d4e5f6", T = "tester-0a9b8c", S = "security-reviewer-77aa11", D = "docs-writer-5c5c5c";
  await post("agent_spawn", { name: "orchestrator", isMain: true, task: "Add a login form to the web app" });
  await post("message", { agent: "orchestrator", role: "user", content: "Add a login form with email and password, validate it on the server, add tests and update the docs." });
  await post("message", { agent: "orchestrator", role: "thinking", content: "Plan first, then code and tests in sequence, then a security review while docs are written." });
  await delay(600);
  await post("tool_call_start", { agent: "orchestrator", tool: "Grep", args: "pattern: login in src/", preview: "Grep" });
  await post("tool_call_end", { agent: "orchestrator", tool: "Grep", result: "4 files", tokenCost: 120 });
  await post("subagent_dispatch", { parent: "orchestrator", child: P, task: "Write a plan for the login form with acceptance criteria" });
  await post("agent_spawn", { name: P, parent: "orchestrator", task: "Write a plan for the login form with acceptance criteria" });
  await post("tool_call_start", { agent: P, tool: "Read", args: "src/routes/index.ts" });
  await post("tool_call_end", { agent: P, tool: "Read", result: "ok", tokenCost: 900 });
  await post("message", { agent: P, role: "assistant", content: "Plan: 1) POST /login with zod validation, 2) form component with inline errors, 3) rate limit 5 tries per minute, 4) tests for empty, wrong and correct passwords." });
  await post("subagent_return", { child: P, parent: "orchestrator", summary: "planner complete: 4-step plan" });
  await post("agent_complete", { name: P });
  await delay(500);
  await post("subagent_dispatch", { parent: "orchestrator", child: C, task: "Implement the login route and form from the plan" });
  await post("agent_spawn", { name: C, parent: "orchestrator", task: "Implement the login route and form from the plan" });
  for (const [a, tool, args] of [[C, "Write", "src/routes/login.ts"], [C, "Edit", "src/components/LoginForm.tsx"], [C, "Bash", "npm install zod"], [C, "Bash", "git add -A && git commit -m \"feat: login form\""]]) {
    await post("tool_call_start", { agent: a, tool, args, preview: tool + ": " + args });
    await delay(350);
    await post("tool_call_end", { agent: a, tool, result: "ok", tokenCost: 300 + (args.length * 7) % 800 });
  }
  await post("subagent_dispatch", { parent: "orchestrator", child: T, task: "Run the test suite and add tests for wrong passwords" });
  await post("agent_spawn", { name: T, parent: "orchestrator", task: "Run the test suite and add tests for wrong passwords" });
  await post("tool_call_start", { agent: T, tool: "Bash", args: "npm test -- --coverage" });
  await post("tool_call_end", { agent: T, tool: "Bash", result: "[FAILED] 1 test failed: rate limit not reset", tokenCost: 700 });
  await post("tool_call_start", { agent: T, tool: "Bash", args: "docker compose up -d db" });
  await post("tool_call_start", { agent: "orchestrator", tool: "WebSearch", args: "express rate limit reset window best practice" });
  await post("subagent_dispatch", { parent: "orchestrator", child: S, task: "Review the login diff for security problems" });
  await post("agent_spawn", { name: S, parent: "orchestrator", task: "Review the login diff for security problems" });
  await post("tool_call_start", { agent: S, tool: "Read", args: "src/routes/login.ts" });
  await post("message", { agent: S, role: "assistant", content: "Finding 1: the error message tells an attacker whether the email exists. Use one generic message. Finding 2: the password is logged at debug level." });
  await post("permission_requested", { agent: T, message: "Waiting for permission to run: npm run e2e" });
  await post("subagent_dispatch", { parent: "orchestrator", child: D, task: "Update README and CHANGELOG for the login form" });
  await post("agent_spawn", { name: D, parent: "orchestrator", task: "Update README and CHANGELOG for the login form" });
  await post("tool_call_start", { agent: D, tool: "Edit", args: "CHANGELOG.md" });
  await post("tool_call_start", { agent: "orchestrator", tool: "Bash", args: "node scripts/second-opinion.mjs --diff HEAD~1" });
  await post("context_update", { agent: "orchestrator", tokens: 74200, breakdown: {}, tokensMax: 200000 });
  await post("tool_call_start", { agent: "orchestrator", tool: "Bash", args: "git status" });
}
