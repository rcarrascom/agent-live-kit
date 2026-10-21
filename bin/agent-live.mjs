#!/usr/bin/env node
// agent-live: init | doctor | start | simulate | open | hooks.  Node 20+, built-ins only.
import { parseArgs } from "../src/cli/args.mjs";

const HELP = `agent-live - a live map of your Claude Code agent team

Usage: agent-live <command> [options]

  init        scan this project and write agent-live.config.json   (--force, --dry-run)
  doctor      check everything and say how to fix what is wrong     (--json)
  start       start the relay (if needed) and the page              (--no-relay, --open)
  simulate    demo team with fake events, no agents needed          (--team large, --port, --instant, --loop)
  open        open the page in your browser
  hooks       show or install the Claude Code hooks                 (--install, --config-dir DIR)

Options for every command: --config <file>   --help
Docs: README.md and docs/ in the package.`;

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") { console.log(HELP); process.exit(0); }
const COMMANDS = { init: "init", doctor: "doctor", start: "start", simulate: "simulate", open: "open", hooks: "hooks" };
if (!COMMANDS[cmd]) { console.error(`Unknown command "${cmd}".\n\n${HELP}`); process.exit(2); }
const mod = await import(`../src/cli/${COMMANDS[cmd]}.mjs`);
const code = await mod.run(parseArgs(rest));
process.exit(code || 0);
