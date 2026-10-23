import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { BaseSequencer, type TestSpecification } from 'vitest/node'
import react from '@vitejs/plugin-react'

/**
 * Roughly how many seconds each long test file takes on one core of a CI runner, from CI's own logs. Files not listed
 * are short and count as `SHORT_TEST_SECONDS`. Only the order of magnitude matters: the weights decide which files go
 * first and which shard each goes to, never whether a test runs.
 */
const TEST_SECONDS: Record<string, number> = {
  'fingerprints.test.ts': 130,
  'fingerprintsSkills.test.ts': 130,
  'fingerprintsBand.test.ts': 130,
  // New Life 11 partitions inherit the fingerprint scheduling weight until CI records their own timings.
  'fingerprintsTogether.test.ts': 130,
  'fingerprintsTalent.test.ts': 130,
  'fingerprintsAlike.test.ts': 130,
  'fingerprintsFlat.test.ts': 130,
  // One forty-founder run, measured at about 45 s alone.
  'fingerprintsForty.test.ts': 110,
  'wagesProfits.test.ts': 20,
  'performance.test.ts': 20,
  'competitionGridExperiment.test.ts': 16,
  'employmentDynamics.test.ts': 15,
  'engine.test.ts': 14,
  'generalizedSpatialExperiment.test.ts': 12,
  'government.test.ts': 11,
}
const SHORT_TEST_SECONDS = 2
const testEnvironment = loadEnv('test', '.', 'ECON_TEST_')
const prTests = testEnvironment.ECON_TEST_PROFILE === 'pr'

const secondsOf = (file: TestSpecification) => TEST_SECONDS[file.moduleId.split(/[\\/]/).at(-1)!] ?? SHORT_TEST_SECONDS

/**
 * Runs the longest files first, so no worker is left with one at the end, and with `--shard` deals files to shards by
 * cost rather than by a hash of their names: each file, longest first, goes to the shard with the least work so far.
 * Every file goes to exactly one shard, and the deal depends only on the files, so every CI job agrees on it.
 */
class CostSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]) {
    const { index, count } = this.ctx.config.shard!
    const loads = Array.from({ length: count }, () => 0)
    const shards: TestSpecification[][] = loads.map(() => [])
    const longestFirst = [...files].sort(
      (a, b) => secondsOf(b) - secondsOf(a) || (a.moduleId < b.moduleId ? -1 : a.moduleId > b.moduleId ? 1 : 0),
    )
    for (const file of longestFirst) {
      const least = loads.indexOf(Math.min(...loads))
      loads[least]! += secondsOf(file)
      shards[least]!.push(file)
    }
    return shards[index - 1]!
  }

  override async sort(files: TestSpecification[]) {
    const sorted = await super.sort(files)
    return [...sorted].sort((a, b) => secondsOf(b) - secondsOf(a))
  }
}

export default defineConfig({
  define: { PR_TEST_PROFILE: prTests },
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      // The MVP9 observer and the Life valley are separate pages, relative to the project root.
      input: { main: 'index.html', life: 'life.html' },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Other fingerprint partitions are retained for local/manual full runs. The PR profile keeps the canonical file.
    exclude: prTests ? ['src/valley/fingerprints[A-Z]*.test.ts'] : [],
    // The valley experiments run in parallel and load every core, so a test that takes a second alone can take several
    // in the full suite. The default of 5 seconds failed tests that were only slowed down.
    testTimeout: 60_000,
    // The tests are simulations bound by computation, and the process that farms them out is nearly idle, so every core
    // runs a worker rather than the default of one fewer, a third more on a 4-core CI runner.
    // Bound local memory use without changing which tests run; CI retains its existing default.
    maxWorkers: testEnvironment.ECON_TEST_WORKERS ? Number(testEnvironment.ECON_TEST_WORKERS) : '100%',
    sequence: { sequencer: CostSequencer },
  },
})
