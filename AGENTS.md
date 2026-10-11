# Agent workflow

## Where work happens

The repository holds two simulation cores:

- **The Life core** (`src/life/`, observer in `src/lifeView/` and `life.html`) is where new work goes. It is built bottom-up, one step at a time, following the ladder in [docs/MERGE.md](docs/MERGE.md#the-ladder).
- **The MVP9 core** (`src/sim/`, observer in `src/App.tsx` and `src/ui/`) is frozen as a reference. Do not change it unless explicitly asked; any change must keep its canonical trajectory bit-for-bit.

Before starting Life work, read:

- [docs/MERGE.md](docs/MERGE.md) for the direction, the ladder and the next step's open questions;
- [SIMULATION_DESIGN_RULES.md](SIMULATION_DESIGN_RULES.md), which is authoritative;
- the latest `docs/LIFE<n>_SPEC.md`;
- the Life sections of [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/VALIDATION.md](docs/VALIDATION.md);
- the newest entries in [LAB_NOTES.md](LAB_NOTES.md).

## Working through a Life step

The owner directs the project but does not write code. Explain choices in plain language with a recommendation, and ask only for decisions that are genuinely theirs.

1. **Spec first.** Write `docs/LIFE<n>_SPEC.md`, headed `[LIFE<n>-<Name>-<NNN>]` and modelled on [LIFE0_SPEC.md](docs/LIFE0_SPEC.md). It covers:
   - a question that could come out either way;
   - design decisions with their reasons;
   - the order of phases in a tick, defaults and configuration validation;
   - invariants, theory, and experiments with expected outcomes;
   - the observer, the code layout and the tests;
   - what the step leaves out.
2. **Check the predictions before presenting the spec.** Run a quick throwaway prototype in the scratchpad, not in the repository, and correct the spec wherever the prototype disagrees with it.
3. **Get the owner's approval** of the spec before implementing it.
4. **Implement.**
   - The step function is pure and deterministic.
   - Quantities are integers, and invariants are checked every tick.
   - Every random draw comes from a named, derived stream.
   - Each experiment is also a test.
   - The observer only interpolates between real states.
5. **Check it in the browser.**
   - `.claude/launch.json` starts the dev server on port 5180.
   - A hidden preview pane does not animate, so use the Step button and screenshots.
   - Check the 375px layout and the console.
6. **Document it.**
   - Add changelog and lab-notes entries, newest first, with the same ID.
   - Update the Life sections of the architecture and validation docs, and the README if anything user-visible changed.
   - Correct the spec wherever implementation proved it wrong.

   Update numbers (`NNN`) are global and sequential across the changelog and lab notes, one base number per commit; the last used is in the newest changelog entry.
7. **Git.** Work on a branch, never on `main`. Pull requests are squash-merged. Never add Claude attribution, such as `Co-Authored-By` trailers or "Generated with" lines, to commits or pull requests.

## Validation

Use `npm run agent:check` for final implementation validation. Do not run typecheck, tests, or build individually unless diagnosing a failure. Full output is stored in `.agent-logs/lint.log` (oxlint and the Prettier check), `.agent-logs/typecheck.log`, `.agent-logs/tests.log`, and `.agent-logs/build.log`.

If it passes, do not inspect the logs. If a stage fails, inspect only that stage's log and the smallest relevant excerpt, using targeted `rg`, `grep`, or `tail`; do not ingest an entire large log unless unavoidable. After fixing a failure, rerun `npm run agent:check`.

## Scope and Git

Make only task-required changes and preserve project behavior. Do not commit, push, or create pull requests unless explicitly instructed. At the end, provide a suggested commit message.

## Final response

Keep the final response concise: summarize changes, validation result, unresolved issues, and suggested commit message.
