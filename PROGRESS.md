# Progress (resume notes)

Order of work: 1 skeleton + server + config + CLI -> 2 UI port -> 3 tests -> 4 docs + recipes -> 5 screenshots -> 6 privacy scan.

- [x] 1 skeleton, server, config + schema, CLI (init, doctor, start, simulate, open, hooks). Smoke-tested on Windows.
- [x] 2 UI port done (public/: style.css + model, ingest, cards, flow, log, main, team, classic, fx, tlfx; T and L hide toggles came along; source index.html was last changed 16:52 on 12 Oct, re-diff if it changes later)
- [x] 3 tests: node --test, 44 passing (config schema, init, doctor green + red paths, rules, identity, history)
- [x] 4 docs + recipes (README, CONFIG, HOW_IT_WORKS, TROUBLESHOOTING, HOWTO, recipes/, CHANGELOG). README links docs/img/team-live.png and flow.png: produced in step 5
- [ ] 5 screenshots on ports 3101/3102 into docs/img
- [ ] 6 privacy scan, final commit, copy 2 screenshots to the main repo's docs/visual_qa/agent_live_kit_2026-10-12/
