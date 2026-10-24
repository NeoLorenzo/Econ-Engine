import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 13 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 13's code. A change
// that alters any trajectory, even a refactor or a speed-up meant to change nothing, fails here. Those configurations
// were recorded with the first pull request's eight founders and keep them; the forty-founder default has one run.

function fingerprintOf(value: unknown) {
  let hash = 0x811c9dc5
  const text = JSON.stringify(value)
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return `${(hash >>> 0).toString(16)}:${text.length}`
}

const EIGHT = { founders: 8 }

const CONFIGS: Record<string, Partial<ValleyConfig>> = {
  canonical: EIGHT,
  together: { ...EIGHT, scattered: false },
  noPractice: { ...EIGHT, craftPractice: false },
  talent: { ...EIGHT, craftSkillMinPercent: 50, craftSkillMaxPercent: 150 },
  twelve: { founders: 12 },
  alike: { ...EIGHT, skillMinPercent: 100, skillMaxPercent: 100 },
  flat: FLAT_LAND,
  forty: {},
}

/** Water and observed-ground checks depend on the size of the discovered region; allow slower CI workers. */
const FINGERPRINT_TIMEOUT_MS = 1_800_000

const RECORDED = [
  {
    config: 'canonical',
    seed: 20260813,
    days: 'e98cba6:67108',
    totals: '63cdf0d9:465',
  },
  {
    config: 'canonical',
    seed: 1,
    days: '8905273e:67050',
    totals: '8df71ae8:463',
  },
  {
    config: 'canonical',
    seed: 2,
    days: 'c14df886:67237',
    totals: '1d31a8fc:465',
  },
  {
    config: 'together',
    seed: 20260813,
    days: '89933b50:67046',
    totals: '72d65ac0:462',
  },
  {
    config: 'together',
    seed: 1,
    days: 'd816035:66997',
    totals: 'f59bdd0e:462',
  },
  {
    config: 'together',
    seed: 2,
    days: '9480ef93:67138',
    totals: '37154fd6:462',
  },
  {
    config: 'noPractice',
    seed: 20260813,
    days: 'b7462fcf:67312',
    totals: 'c8697816:465',
  },
  {
    config: 'noPractice',
    seed: 1,
    days: 'c1edc1b3:67213',
    totals: 'b06beec8:463',
  },
  {
    config: 'noPractice',
    seed: 2,
    days: '18df5b83:67419',
    totals: '9efd6809:465',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: '4b6608f8:67079',
    totals: 'cde8353:465',
  },
  {
    config: 'talent',
    seed: 1,
    days: 'c3bdb928:66975',
    totals: 'a0065118:462',
  },
  {
    config: 'talent',
    seed: 2,
    days: '83d2c8aa:67126',
    totals: 'd6a4011c:465',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: '626b2278:79647',
    totals: '3d76d205:471',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '220f1866:79532',
    totals: 'a8772f54:471',
  },
  {
    config: 'twelve',
    seed: 2,
    days: '43a24198:79702',
    totals: 'e9805784:471',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '2f774b2b:67343',
    totals: '836e2100:465',
  },
  {
    config: 'alike',
    seed: 1,
    days: '50bdab6d:67282',
    totals: '9dc0b76f:465',
  },
  {
    config: 'alike',
    seed: 2,
    days: 'da2a2c6e:67227',
    totals: 'a44e3b3f:465',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: '34e75ef6:59405',
    totals: '9f5d0560:437',
  },
  {
    config: 'flat',
    seed: 1,
    days: '97e1893a:59461',
    totals: '1033ac19:437',
  },
  {
    config: 'flat',
    seed: 2,
    days: 'b673a494:59557',
    totals: '42ae31a4:437',
  },
  {
    config: 'forty',
    seed: 20260813,
    days: 'ba7d2c9c:166380',
    totals: 'b1ca689:474',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 13 runs exactly as recorded', () => {
    for (const recorded of RECORDED.filter(
      (row) =>
        configs.includes(row.config) && (!PR_TEST_PROFILE || (row.config === 'canonical' && row.seed === 20260813)),
    )) {
      it(
        `for the ${recorded.config} land on seed ${recorded.seed}`,
        () => {
          const start = createValley({ ...CONFIGS[recorded.config], seed: recorded.seed })
          const checker = new ValleyChecker(start)
          const end = runValley(start, 30 * 1_440, { recordEvents: false, onMinute: (state) => checker.assert(state) })
          expect({ days: fingerprintOf(end.days), totals: fingerprintOf(end.totals) }).toEqual({
            days: recorded.days,
            totals: recorded.totals,
          })
        },
        FINGERPRINT_TIMEOUT_MS,
      )
    }
  })
}
