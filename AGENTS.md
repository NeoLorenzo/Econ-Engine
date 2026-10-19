# Agent workflow

## Where work happens

The repository holds two simulation cores:

- **The Life core** (`src/valley/`, observer in `src/valleyView/` and `life.html`) is where new work goes. It is built bottom-up, one step at a time, following the [roadmap](docs/ROADMAP.md). Only the current Life step exists: its specification describes the whole simulation. Earlier steps live in git history, the changelog and the lab notes.
- **The MVP9 core** (`src/sim/`, observer in `src/App.tsx` and `src/ui/`) is frozen as a reference. Do not change it unless explicitly asked; any change must keep its canonical trajectory bit-for-bit.

Before starting Life work, read:

- [docs/ROADMAP.md](docs/ROADMAP.md) for the goal, the setting and the steps ahead;
- [docs/MERGE.md](docs/MERGE.md) for why Life Engine merged into this project, and steps 0 to 9;
- [SIMULATION_DESIGN_RULES.md](SIMULATION_DESIGN_RULES.md), which is authoritative;
- the current `docs/LIFE<n>_SPEC.md`;
- the Life sections of [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/VALIDATION.md](docs/VALIDATION.md);
- the newest entries in [LAB_NOTES.md](LAB_NOTES.md).

## Working through a Life step

The owner directs the project but does not write code. Explain choices in plain language with a recommendation, and ask only for decisions that are genuinely theirs.

The Life core is in a feature-building phase: get features working, and leave experiments for a later, stable version of the engine. Do not run throwaway prototypes, multi-seed sweeps or experiment tests unless the owner asks for them.

1. **Spec first.** Write a short `docs/LIFE<n>_SPEC.md`, headed `[LIFE<n>-<Name>-<NNN>]` and modelled on the current spec. It describes the whole simulation, not only what changes, and replaces the current spec. It covers:
   - what the step makes realistic and the real measurements it is checked against, and its design decisions with their reasons;
   - the order of phases in a tick, defaults and configuration validation;
   - invariants and the observer;
   - the code layout and the tests;
   - questions left for later experiments, and what the step leaves out.
2. **Get the owner's approval** of the spec before implementing it.
3. **Implement.**
   - The step function is pure and deterministic.
   - Quantities are integers, and invariants are checked every tick.
   - Every random draw comes from a named, derived stream.
   - The observer only interpolates between real states.
   - Add a few fast unit tests for the new rules and for the checker catching broken records; no experiment tests.
   - Remove any switch whose only purpose was to recreate an earlier step.
   - Before changing the engine, check `fingerprints.test.ts` passes; afterwards, record new fingerprints for the new step. A refactor or speed-up must leave them unchanged.
4. **Check it in the browser.**
   - `.claude/launch.json` starts the dev server on port 5180.
   - A hidden preview pane does not animate: show the pane, or use the Step button and screenshots.
   - A quick look at the new feature and the console is enough.
5. **Document it, briefly.**
   - Add changelog and lab-notes entries, newest first, with the same ID.
   - Update the Life sections of the architecture and validation docs, and the README if anything user-visible changed.
   - Correct the spec wherever implementation proved it wrong.

   Update numbers (`NNN`) are global and sequential across the changelog and lab notes, one base number per commit; the last used is in the newest changelog entry.
6. **Git.** Work on a branch, never on `main`. Pull requests are squash-merged. Never add Claude attribution, such as `Co-Authored-By` trailers or "Generated with" lines, to commits or pull requests.

## Validation

Use `npm run agent:check` for final implementation validation. Do not run typecheck, tests, or build individually unless diagnosing a failure. Full output is stored in `.agent-logs/lint.log` (oxlint and the Prettier check), `.agent-logs/typecheck.log`, `.agent-logs/tests.log`, and `.agent-logs/build.log`.

If it passes, do not inspect the logs. If a stage fails, inspect only that stage's log and the smallest relevant excerpt, using targeted `rg`, `grep`, or `tail`; do not ingest an entire large log unless unavoidable. After fixing a failure, rerun `npm run agent:check`.

## Scope and Git

Make only task-required changes and preserve project behavior. Do not commit, push, or create pull requests unless explicitly instructed. At the end, provide a suggested commit message.

## Final response

Keep the final response concise: summarize changes, validation result, unresolved issues, and suggested commit message.
