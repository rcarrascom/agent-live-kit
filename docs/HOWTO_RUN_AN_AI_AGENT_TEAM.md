# How to run a team of AI agents on any project

A practical guide written from real use: one person, Claude Code, a handful of specialised sub-agents, and a lot of mistakes that turned into rules. It applies to any project (software, writing, research, data, design). Nothing here needs special tools beyond Claude Code and a git repository; the [recipes](../recipes) folder has ready-to-copy files for most of it.

## The short version

1. **One orchestrator, several specialists.** The main session plans and merges; sub-agents (one Markdown file each) do narrow jobs.
2. **Separate thinking from doing.** Research and critique agents never touch your code; builders do.
3. **A critic that must disagree.** Before any big decision, an agent writes an opinion that has to push back on at least one thing.
4. **Research before building.** Find out what already exists first.
5. **Hooks are guard rails.** Anything that is a rule, not advice, becomes a small script that blocks the action.
6. **A check script is the source of truth.** No report counts until it passes on the real tree.
7. **Generate status pages from data**, never write them by hand.
8. **When something goes wrong, write a blameless retro** and turn it into rules with an owner and a check.
9. **Watch the team** (Agent Live) so you know what is happening and when it needs you.

---

## 1. Agents: a file per role

A sub-agent is a Markdown file in `.claude/agents/`:

```markdown
---
name: researcher
description: Finds what already exists (libraries, prior art, answered questions) before anything is designed. Use before building any new feature.
tools: Read, Grep, Glob, WebSearch, WebFetch, Write
model: sonnet
---
You are the researcher. ... (what to read first, what to produce, what you never do)
```

Rules of thumb:
- **The `description` is a trigger.** Claude decides when to use the agent from it. Say *when* ("Use after a code change to ..."), not only *what*.
- **Give the least tools that work.** A reviewer with `Read, Grep, Glob` cannot "just fix it", which keeps the review honest.
- **Cheap models for routine, strong models for judgement.** `haiku` / `sonnet` for lookups and formatting; the strongest model for design, critique and gates.
- **Each agent ends with "never": what it must not do.** Boundaries prevent most surprises.
- **Start with five:** researcher, critic, builder, reviewer, QA. Add one only when the same kind of job repeats. See `recipes/agents/`.

## 2. Two accounts, one repository (lanes)

If you have **two Claude accounts** (or just want two workers in parallel), use one repository and two folders:

```bash
git worktree add ../myproject-b  -b account-b        # second folder, its own branch
# terminal 1:  cd myproject      && claude                                   (account A, main branch)
# terminal 2:  cd myproject-b    && CLAUDE_CONFIG_DIR=~/.claude-b claude     (account B)
```

- **Separate config folders** (`CLAUDE_CONFIG_DIR`) are essential: logging in on the wrong terminal otherwise overwrites the other account's login.
- **Say who orchestrates.** A orchestrates normally. When A hits its usage limit, B takes over the shared docs and merges to `main`; when A returns it pulls first.
- **Lanes keep both busy.** *Code lane:* builders, QA, anything that changes the product. *Thinking lane:* research, design proposals, critique, documentation. Put caps on both so output never outruns the human who must review: for example, "3 unreviewed builds stop the code lane; 3 unread proposals stop the thinking lane".
- **Merge discipline:** both lanes append to shared logs, so conflicts happen; resolve by keeping both lines. Give each lane its **own file** for anything automatic (`logs/spawns_a.jsonl`, `logs/spawns_b.jsonl`).
- **Verify a constraint before accepting it.** "Builds need account A" turned out to be false (same machine, same files). Five minutes of checking would have saved days.

## 3. The critic: the third voice

Before any **big** decision (money, scope change, a new system, legal, anything costing more than a small job) run a *critic* agent whose brief says: *"You must disagree with at least three things and say what you cannot judge."* Then:

- write the decision with a `critic:` tag pointing at the memo (or `critic: checked, nothing to add`);
- show disagreement to the human **unsmoothed**; when the human overrides it, log that too;
- run it **at the start of each session** as a short "what changed since last time" note, and monthly with a stronger model;
- count **attempts, not job size**: a small job that failed twice deserves a critic.

Template: `recipes/agents/critic.md`.

## 4. The research gate

Before designing or building something new, run the researcher: *what already exists, how do others solve it, what are the pitfalls, with sources.* Then design, then numbers, then build. The gate asks two questions: "does a solution exist?" and, learned later, "**is our framing of the problem right?**" (see the retro pattern below).

## 5. Hooks: rules that block instead of advice that gets forgotten

A hook is a command Claude Code runs on an event. A `PreToolUse` hook that exits with code 2 **blocks** the action and shows the model the message.

Good first rules (`recipes/hooks/guard.mjs` reads them from a JSON file):
- no destructive git (`reset --hard`, `push --force`, `branch -D`, `stash drop`), or only after asking;
- never write secrets files, never print them;
- never delete recursively outside temp folders;
- never edit vendored or licensed folders;
- commit message format (a required prefix; no byte-order mark);
- never kill programs by name (it closes the human's own windows); stop only the process IDs you started.

Also: a **session-start hook** that prints the facts a session must not skip (branch, last commits, the status file head), and a **spawn-log hook** that appends one line per sub-agent start/stop to a file (who, when, how long). Keep hooks small, dependency-free, **never able to break a session** (catch everything, exit 0 unless blocking on purpose), and test them with fake payloads.

## 6. Path-scoped instructions

One giant `CLAUDE.md` is loaded on every message and gets expensive and ignored. Keep a **short core** (what the project is, how to run and test, the "never break" list) and move detail into `.claude/rules/<topic>.md` with a `paths:` frontmatter so it loads only when matching files are touched. Safeguards: keep a short "never break" list in the core; leave a one-line pointer for every decision you move; add a **canary test** (ask an agent that touches no files whether it still knows the key rules). Template: `recipes/CLAUDE.template.md`.

## 7. The check script is the source of truth

Write **one command** that proves the project is healthy: build, run the tests, start the app, exercise the main paths. Rules:
- agents must run it, and a report only counts if it passed **on the real tree**;
- log each run to a file so you can see trends (pass counts, duration);
- add a **bot** for each thing that broke once (a script that does the real action, not a mock);
- it must be fast enough to run often, and exit non-zero on any failure.

This is also what answers "is it really done?" without trusting anyone's summary, including the model's.

## 8. Generated pages: status you never write by hand

Roadmaps, dashboards and indexes drift when edited by hand. Build them with a small script from files that already exist: the task board (Markdown), the agent log (a table), `git log`, the agent files. Pattern: gather data into **one JSON block**, inject it into a single self-contained HTML template, publish the file, regenerate at every milestone. Check the result on a phone-size viewport with a screenshot (headless Chrome / Edge + the DevTools protocol, as `scripts/shot.mjs` does) and look at it every time.

## 9. Prompts that worked

- **Give evidence, not a summary.** Save the human's screenshots into the repository and tell the agent to *look at them first*.
- **State "done" in the human's words**, and require a before/after image or output.
- **Name known failure modes** ("do not leave the project broken: the user runs it from this folder", "files under 450 lines", "test at 100 %, 125 % and 150 % display scaling").
- **Force a verification step the agent cannot skip:** a script that must pass, a screenshot it must view, an iteration cap, and a closing list of **what it did NOT verify**.
- **One writer per area.** Agents write to different folders; one commit per job so any job can be reverted alone.
- **After a limit kills background agents,** each should have written exactly where it stopped; resume them from there.
- **Ask for the premise.** For a top complaint: "Before fixing, state in one paragraph the simplest thing a professional would do, and whether our approach is it."

## 10. The blameless retro pattern

When something costs more than expected (a week on the wrong approach, a lost file, a repeated bug) run a short retro the same day. **Blameless** means the question is "what in our process allowed this?", never "who". Format (template in `recipes/retro_template.md`):

1. **Timeline** with sources (commits, notes, dates).
2. **5 whys for each failure**, with evidence quoted: why, why, why, why, **root**.
3. **What worked.**
4. **Proposed rules**, each with an **owner, a trigger and how it is checked**. A rule without a check is a wish.
5. Get the human's approval before adding the rules to your instruction files.

Typical roots, worth checking in your own project:
- a **cost decision turned into an unexamined premise** (every brief asks "how do we do X", none asks "should we");
- **proxy metrics** reported as success while the user's criterion ("does it look right?") was never checked;
- a **"needs X" constraint accepted without a five-minute check**;
- the **same complaint failing twice** with nothing forcing a rethink (add a stop rule: second miss on one complaint forces a premise review plus a critic check);
- **parallel work absorbing effort** while the number-one complaint got research (mark one card as blocking);
- a QA **concern summarised as progress** (quote concerns verbatim and first);
- the **critic never asked** because the job looked small.

## 11. Make the team visible: Agent Live

Run `agent-live init`, `doctor`, `start` (see the [README](../README.md)). Keep it on a second monitor. You will notice things a terminal hides: two agents stuck waiting for permission, a research agent that never ran, a builder editing before the plan exists. The Replay slider is useful in retros.

## 12. A starting checklist

- [ ] 3 to 5 agent files from `recipes/agents/`
- [ ] `CLAUDE.md` core (under ~10 KB) + `.claude/rules/` for detail
- [ ] guard hook with your rules file; session-start hook; spawn-log hook
- [ ] one `check` command, run before every "done"
- [ ] a status file and a decisions file (date + decision + `critic:` tag)
- [ ] a rule for who orchestrates (if you use two accounts) and the lane caps
- [ ] Agent Live running
- [ ] the first retro scheduled for the first thing that goes wrong
