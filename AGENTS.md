# Agent workflow

## Validation

Use `npm run agent:check` for final implementation validation. Do not run typecheck, tests, or build individually unless diagnosing a failure. Full output is stored in `.agent-logs/typecheck.log`, `.agent-logs/tests.log`, and `.agent-logs/build.log`.

If it passes, do not inspect the logs. If a stage fails, inspect only that stage's log and the smallest relevant excerpt, using targeted `rg`, `grep`, or `tail`; do not ingest an entire large log unless unavoidable. After fixing a failure, rerun `npm run agent:check`.

## Scope and Git

Make only task-required changes and preserve project behavior. Do not commit, push, or create pull requests unless explicitly instructed. At the end, provide a suggested commit message.

## Final response

Keep the final response concise: summarize changes, validation result, unresolved issues, and suggested commit message.
