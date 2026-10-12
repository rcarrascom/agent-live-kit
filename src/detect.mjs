// Looks at the project folder and reports which tools it uses (for init): returns [{ id, why }].
import fs from "node:fs";
import path from "node:path";

const has = (root, ...p) => fs.existsSync(path.join(root, ...p));
const read = (root, f) => { try { return fs.readFileSync(path.join(root, f), "utf8"); } catch { return ""; } };

export function detectTools(root) {
  const out = [], add = (id, why) => { if (!out.some(o => o.id === id)) out.push({ id, why }); };
  const pkgTxt = read(root, "package.json");
  let pkg = {};
  try { pkg = JSON.parse(pkgTxt || "{}"); } catch {}
  const scripts = pkg.scripts || {}, deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const py = read(root, "pyproject.toml") + read(root, "requirements.txt") + read(root, "setup.cfg");
  let workflows = [];
  try { workflows = fs.readdirSync(path.join(root, ".github", "workflows")); } catch {}

  if (has(root, ".git")) add("git", ".git folder found");
  if (pkgTxt) add("npm", "package.json found");
  if (py || has(root, "setup.py") || has(root, "Pipfile")) add("python", "Python project files found");
  if (has(root, "Cargo.toml")) add("rust", "Cargo.toml found");
  if (has(root, "go.mod")) add("go", "go.mod found");
  if (has(root, "Makefile")) add("make", "Makefile found");
  if (has(root, "Dockerfile") || has(root, "docker-compose.yml") || has(root, "docker-compose.yaml") || has(root, "compose.yaml")) add("docker", "Dockerfile or compose file found");
  if (workflows.length) add("ci", `${workflows.length} workflow file(s) in .github/workflows`);
  if (scripts.test || /pytest/.test(py) || has(root, "tests") || has(root, "test") || has(root, "Cargo.toml") || has(root, "go.mod")) add("tests", "tests folder, test script or test runner found");
  if (scripts.build || has(root, "Makefile") || has(root, "Cargo.toml") || has(root, "go.mod") || deps.vite || deps.webpack || deps.typescript) add("build", "build script or compiler found");
  if (scripts.lint || deps.eslint || deps.prettier || /ruff|flake8|black|pylint/.test(py) || has(root, ".eslintrc.json") || has(root, ".prettierrc")) add("lint", "linter or formatter configured");
  if (deps.playwright || deps["@playwright/test"] || deps.puppeteer || deps.cypress) add("browser", "browser test driver in package.json");
  if (has(root, "prisma") || has(root, "migrations") || has(root, "alembic") || deps.prisma || deps.knex || /alembic|sqlalchemy|psycopg/.test(py)) add("database", "database or migrations found");
  if (["vercel.json", "netlify.toml", "wrangler.toml", "fly.toml", "serverless.yml"].some(f => has(root, f)) || safeList(root).some(f => f.endsWith(".tf"))) add("cloud", "cloud deploy config found");
  add("web", "agents can always search and fetch");
  return out;
}
function safeList(root) { try { return fs.readdirSync(root); } catch { return []; } }
