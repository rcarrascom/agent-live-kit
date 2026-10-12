// Built-in defaults: bands, stages, generic activity rules and the catalogue of tool nodes.
export const BANDS = {
  people:   { label: "People",       color: "#ffb454" },
  claude:   { label: "Main session", color: "#7cc8ff" },
  research: { label: "Research",     color: "#b9e6ff" },
  design:   { label: "Design",       color: "#d7a8ff" },
  build:    { label: "Build",        color: "#6fd3a0" },
  check:    { label: "Check",        color: "#ffd166" },
  review:   { label: "Review",       color: "#ff8fb3" },
  ops:      { label: "Ops",          color: "#8fd0ff" },
  outside:  { label: "Outside AIs",  color: "#a99bff" },
  tools:    { label: "Tools",        color: "#8ea3c4" },
  other:    { label: "Other agents", color: "#9fb2cf" },
};
export const BAND_ORDER = ["people", "claude", "research", "design", "build", "check", "review", "ops", "outside", "tools", "other"];
export const STAGES = [["plan", "Plan"], ["research", "Research"], ["design", "Design"], ["build", "Build"], ["check", "Check"], ["review", "Review"], ["ship", "Ship"]];
export const BAND_STAGE = { people: "plan", claude: "plan", research: "research", design: "design", build: "build", check: "check", review: "review", ops: "ship", outside: "research", tools: "build", other: "plan" };

const SH = "^(Bash|PowerShell|shell|Shell)$";
// id -> { name, role, rules[] }. A rule only does something when its node exists on your map.
export const TOOL_CATALOGUE = {
  git:      { name: "git", role: "Version control and the code host CLI.", rules: [{ tool: SH, match: "\\bgit\\s+(push|pull|commit|merge|checkout|switch|add|rebase|clone|fetch|stash|tag|worktree|restore|reset|diff|log|status)|\\bgh\\s+(pr|issue|repo|api|release)" }] },
  npm:      { name: "npm / node", role: "Node package managers and runners.", rules: [{ tool: SH, match: "\\b(npm|pnpm|yarn|bun|npx|node|deno)\\b" }] },
  python:   { name: "python / pip", role: "Python interpreter and package tools.", rules: [{ tool: SH, match: "\\b(pip3?|pipx|uv|poetry|python3?|py|conda|virtualenv)\\b" }] },
  rust:     { name: "cargo", role: "Rust build tool.", rules: [{ tool: SH, match: "\\bcargo\\b|\\brustc\\b" }] },
  go:       { name: "go", role: "Go toolchain.", rules: [{ tool: SH, match: "\\bgo\\s+(run|mod|get|vet|fmt|install|test|build|generate)" }] },
  make:     { name: "make", role: "Makefile targets.", rules: [{ tool: SH, match: "\\b(make|cmake|ninja)\\b" }] },
  docker:   { name: "docker", role: "Containers and orchestration CLIs.", rules: [{ tool: SH, match: "\\b(docker|docker-compose|podman|kubectl|helm|minikube)\\b" }] },
  tests:    { name: "tests", role: "Test runners.", rules: [{ tool: SH, match: "\\b(pytest|jest|vitest|mocha|phpunit|rspec|tox|nose2)\\b|\\b(go|cargo|dotnet|mvn|gradle|gradlew)\\s+test|\\b(npm|pnpm|yarn|bun)\\s+(run\\s+)?test|\\bmake\\s+test|node\\s+--test" }] },
  build:    { name: "build", role: "Compilers and bundlers.", rules: [{ tool: SH, match: "\\b(npm|pnpm|yarn|bun)\\s+run\\s+build|\\bcargo\\s+build|\\bgo\\s+build|\\bmake(\\s+(all|build))?\\s*$|\\b(tsc|webpack|rollup|esbuild)\\b|vite\\s+build|gradlew?\\s+(build|assemble)|mvn\\s+(package|install|compile)|dotnet\\s+build" }] },
  lint:     { name: "lint / format", role: "Linters and formatters.", rules: [{ tool: SH, match: "\\b(eslint|prettier|ruff|flake8|pylint|mypy|pyright|clippy|golangci-lint|rubocop|shellcheck|stylelint|black|isort|biome)\\b|cargo\\s+fmt|gofmt" }] },
  web:      { name: "web", role: "HTTP calls and web search/fetch.", rules: [{ tool: "^(WebFetch|WebSearch)$" }, { tool: SH, match: "\\b(curl|wget|httpie|invoke-webrequest|iwr)\\b" }] },
  browser:  { name: "browser", role: "Headless browsers and UI test drivers.", rules: [{ tool: "^mcp__.*(playwright|puppeteer|browser|chrome)", flags: "i" }, { tool: SH, match: "\\b(playwright|puppeteer|cypress|selenium|msedge|chrome|chromium)\\b" }] },
  database: { name: "database", role: "Database clients and migration tools.", rules: [{ tool: SH, match: "\\b(psql|mysql|sqlite3|mongosh|redis-cli|prisma|alembic|knex|sequelize|flyway|liquibase)\\b" }] },
  cloud:    { name: "cloud", role: "Cloud and deploy CLIs.", rules: [{ tool: SH, match: "\\b(aws|gcloud|terraform|pulumi|vercel|netlify|flyctl|heroku|wrangler|serverless|az)\\s" }] },
  ci:       { name: "CI", role: "Continuous-integration runs.", rules: [{ tool: SH, match: "\\bgh\\s+(run|workflow)|\\bact\\b" }] },
};
// "@human" is replaced by the configured human node id.
export const HUMAN_WAIT_RULE = { node: "@human", tool: "^AskUserQuestion$", waiting: true };

export function defaultRules() {
  const out = [HUMAN_WAIT_RULE];
  for (const [id, t] of Object.entries(TOOL_CATALOGUE)) for (const r of t.rules) out.push({ node: id, ...r });
  return out;
}
