# Life 12 Re-foundation, pull request 2: run settings and forty founders

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Life 12 as the specification assigns it to the second pull request: a run-settings screen with ranges and a Start button, settings fixed once the run starts, forty founders as the default, and a forty-founder canonical fingerprint.

**Architecture:** A new pure module `src/valleyView/runSettings.ts` turns the five typed settings into a configuration and lists what is wrong with them. A new `RunSettingsScreen.tsx` (not `RunSettings.tsx`, which clashes with `runSettings.ts` on a case-insensitive disk) shows the five settings with their ranges; Start shows the existing loading card, builds the valley and hands it to `ValleyApp`, which no longer builds valleys itself. The engine changes only its `founders` default.

**Tech Stack:** TypeScript, Vitest, React 19, three.js, Vite; `npm run agent:check` for final validation.

**Spec:** `docs/LIFE12_SPEC.md` (approved 2026-10-23). Part 1's plan is `2026-10-23-life12-refoundation-1.md`.

## Global Constraints

- The MVP9 core (`src/sim/`, `src/App.tsx`, `src/ui/`) is not touched.
- The 21 recorded fingerprints stay exactly as they are. They were recorded with eight founders, so the eight-person configurations name `founders: 8` explicitly when the default becomes 40; the hashes do not change because the configuration each run sees is identical. `twelve` already names 12. The forty-founder run is added beside them.
- Work on branch `claude/life12-refoundation-2-b6c3cf`, based on `life/12-refoundation-1`. Commit per task. No Claude attribution.
- Changelog and lab-notes entries start at update ID 060.

## Decisions (recommended, for the owner's approval)

1. **The settings are the spec's five:** seed (any integer), days per year (8 to 365), world size in km (1 to 10), founders, and start scattered or together. Each field shows its range.
2. **The Life 11 setup form goes.** Load, skill spread, practice, sight, check-after hours, group fire and craft spread stop being editable on the page; they remain configuration that tests and later experiments can set. The specification names only the five as run settings, and the project is building features, not running experiments.
3. **Fixed after the first minute.** Once Start is pressed there is no form; the history panel shows the settings read-only and a **New run** button returns to the settings screen, prefilled, which discards the current run. Nothing can change the running valley's settings.
4. **The page allows 1 to 100 founders.** The engine accepts up to 1,000, but the observer draws every person as a figure and stays smooth to about 100 (Life 11's limit). The specification is corrected to say so.
5. **World size scales the places and landforms with the area.** Measured on part 1's code: with today's fixed counts of thickets, stands, outcrops and landforms, worlds of 1, 2 and 3 km cannot place them and are refused; 4 km builds in about 9 s and 10 km in about 66 s. `configOfSettings` multiplies every count by (km / 4)², rounded, at least 1, so 4 km is exactly today's world (fingerprints unaffected) and a 1 km world has a sixteenth of the places. The engine does not change. If 1 km still cannot be laid out, the minimum is raised to the smallest size that can, and the spec corrected. The loading card warns that large worlds take up to about a minute to build.
6. **Forty founders are slow.** Measured: 90 days of forty run in about 64 s in Node (eight took 5 to 8 s), against the spec's "about a second". The page will play map speeds far below a year a second. No performance pass in this pull request; the lab notes record the numbers and the spec's speed row says it is not met.
7. **The page opens on the settings screen** instead of building the default valley straight away, so nobody waits for a valley they did not ask for. The static card in `life.html`, shown only while the script loads, says "Loading" rather than "Generating the valley".

---

### Task 0: Baseline

- [ ] Run `npx vitest run src/valley/fingerprints.test.ts` (canonical, three seeds) in the background; it must pass before any engine edit.

### Task 1: Forty founders by default, old fingerprints pinned to eight

**Files:** `src/valley/config.ts`, `src/valley/fingerprintRuns.ts`, tests that rely on the default.

- [ ] `VALLEY_DEFAULT_CONFIG.founders = 40`; update the doc comment ("Forty founders …").
- [ ] `FLAT_LAND` gains `founders: 8`: it is the small test land for rule tests and the `flat` fingerprint, both written for eight.
- [ ] In `fingerprintRuns.ts`, a shared `EIGHT = { founders: 8 }` is spread into `canonical`, `together`, `noPractice`, `talent` and `alike`; rename nothing, so test names and hashes stay.
- [ ] Unit tests that call `createValley()` with the default and assume eight people (`engine.test.ts`, `invariants.test.ts`, `ruleFixtures.ts` callers) pass `founders: 8`; run the narrow files to find them.
- [ ] Run `fingerprints.test.ts` again: unchanged hashes.

### Task 2: The forty-founder fingerprint

**Files:** `src/valley/fingerprintRuns.ts`, new `src/valley/fingerprintsForty.test.ts`, `vite.config.ts`.

- [ ] `CONFIGS.forty = {}` (the new default) and one recorded row, seed 20260813, 30 days with the checker at every daily interval, as the others.
- [ ] `fingerprintsForty.test.ts` calls `checkFingerprints(['forty'])`; give it a scheduling weight in `vite.config.ts` from its measured time. It is a capitalised partition, so the PR profile skips it like the other partitions; the full suite (`agent:check`) runs it.
- [ ] Record the hash after the run passes the checker; never to hide a failed rule.

### Task 3: Run settings, pure part

**Files:** new `src/valleyView/runSettings.ts`, new `src/valleyView/runSettings.test.ts`.

- [ ] `RunSettings` = `{ seed, daysPerYear, worldKm, founders, scattered }`; `RUN_SETTING_FIELDS` with label and range; `defaultRunSettings()` from `VALLEY_DEFAULT_CONFIG` (`worldKm = valleySizeCm / 100_000`).
- [ ] `configOfSettings(settings)` → `Partial<ValleyConfig>` (`valleySizeCm = worldKm × 100,000`; place and landform counts scaled by area, decision 5).
- [ ] `runSettingsErrors(settings)`: the page's own ranges (founders 1 to 100, world 1 to 10 km, whole numbers), then `valleyConfigErrors` and `layoutError` on the full configuration, first message wins.
- [ ] Tests: 7 and 366 days rejected, 8 and 365 accepted; 0 and 11 km rejected; 101 founders rejected; a fractional value rejected; the default settings give the default configuration; a 1 km world builds.

### Task 4: The settings screen and the observer

**Files:** new `src/valleyView/RunSettingsScreen.tsx`, new `src/valleyView/LifePage.tsx`, `main.tsx`, `ValleyApp.tsx`, `life.css`, `life.html`.

- [ ] `LifePage` holds either the settings screen or a running `ValleyApp`. Start validates, shows the existing `life-loading` card, waits for it to be painted (`afterPaint`), builds the valley and mounts `ValleyApp` with it.
- [ ] `ValleyApp` takes `start: Display` and `onNewRun`. Remove `firstPair`, the setup form, its draft, switches, error and `reset`/`build`/`applySetup`, and the loading state it no longer needs. The history panel keeps its read-only description of the run and gains **New run**.
- [ ] `life.html`'s static card reads "Loading".

### Task 5: Browser check

- [ ] `preview_start econ-engine`, `/life.html`: the settings screen, 7 and 366 days rejected with a message, Start shows the loading card and then forty people; a minute a second shows a walk, a day a second the same, the map at a year in seconds; New run returns to the prefilled settings; console clean.

### Task 6: Documents

- [ ] Spec: founders default 40 (drop "from the second pull request"), the observer paragraph describes the settings screen, the page's founder limit, measured times for forty founders and for creating 1 km and 10 km worlds.
- [ ] Changelog and lab notes, IDs 060 (settings and forty founders) and 061 if a second commit needs one; architecture and validation Life sections; README if the page's description changed.

### Task 7: Finish

- [ ] `npm run agent:check` in the background; fix and rerun until it passes.
- [ ] Commit, push, open the PR on `life/12-refoundation-1` (or `main` if PR #80 has merged).
