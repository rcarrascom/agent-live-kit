# <Project name>: notes for Claude

<One paragraph: what this project is, who it is for, the stack.>

## Run and test
- Install: `<command>`
- Run: `<command>`
- **Check (must pass before anything is called done):** `<one command>`
- Test a single thing: `<command>`

## Where things are
- `src/...` <one line each for the 5 to 10 places that matter>
- Decisions: `docs/DECISIONS.md` (dated, with a `critic:` tag). Status / handoff: `docs/STATUS.md`. Read both at session start.

## Never break (keep this list short; it stays here, not in a rules file)
- Never commit secrets, never print them. Never edit `vendor/`.
- No destructive git (`reset --hard`, force push) without asking.
- Never kill programs by name; stop only the process IDs you started.
- "Done" means the check command passed on the real tree, and you list what you did NOT verify.
- Commit messages start with `feat:`, `fix:`, `docs:`, `test:`, `refactor:` or `chore:`.

## Working agreements
- Validate before changing things, unless it is a direct order to keep working.
- Before building a new system: run the **researcher**; before a big decision: run the **critic** and record `critic: <file or "checked: one line">`.
- One writer per area; one commit per job.
- Keep files under ~450 lines; split by job.

## Rules loaded only when relevant
Detail lives in `.claude/rules/*.md` and loads when matching files are touched (see the example below). Each moved decision keeps a one-line pointer here:
- API conventions -> `.claude/rules/api.md`
- Frontend conventions -> `.claude/rules/frontend.md`

---

## Example: `.claude/rules/api.md` (a path-scoped rule file)

```markdown
---
paths:
  - "src/api/**"
  - "tests/api/**"
---
# API conventions
- Every endpoint validates input with the shared schema helper and returns `{ error: { code, message } }` on failure.
- Never return raw database errors to the client.
- New endpoints need a test in `tests/api/` and a line in `docs/api.md`.
```

Tip: after moving rules out of this file, ask an agent that touches no files "what are the never-break rules?" (the **canary test**). If it cannot answer, the core is too thin.
