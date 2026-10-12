# Retro: <what happened, in plain words> (<date>)

**Trigger:** <who asked, or which rule fired (cost over 2x, same complaint failed twice, lost data...)>
**Blameless:** the people and agents did careful work on the question they were given. We look for what in the process allowed this, never for who.

## 1. What happened (timeline)
| Date | Event | Source (commit, note, message) |
|---|---|---|
| | | |

**Cost:** <days, agent runs, commits, the human's time>

## 2. Five whys (one block per failure; quote the evidence)

### Failure 1: <short name>
1. Why did <the visible problem> happen? <answer + evidence>
2. Why? <answer + evidence>
3. Why? <answer + evidence>
4. Why? <answer + evidence>
5. **Root:** <the process gap, one sentence>

(Common roots to check: a cost decision became an unexamined premise; a proxy metric was reported as success; a "needs X" was accepted without checking; the same complaint failed twice with no rethink; other work absorbed effort while the top complaint waited; a QA concern was summarised as progress; the critic was never asked.)

### Failure 2: <short name>
...

## 3. What worked
- <things to keep>

## 4. Proposed rules (not active until the human approves)
| # | Rule | Owner | Trigger | How it is checked |
|---|---|---|---|---|
| 1 | <imperative sentence> | <agent or person> | <when it applies> | <a script, a template field, a review step> |

A rule without a check is a wish. Prefer a **script or a hook** over a sentence in a document.

## 5. Decision
- [ ] Human approved rules: <numbers>
- [ ] Added to: <CLAUDE.md / rules file / hook / template>
- [ ] Date to look again: <date>, to see whether it happened again
