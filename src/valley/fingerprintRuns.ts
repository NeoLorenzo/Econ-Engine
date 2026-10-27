import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 15 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 15's code. A change
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
    days: 'ba06bf58:66472',
    totals: 'd224a9e8:464',
  },
  {
    config: 'canonical',
    seed: 1,
    days: 'a4716341:66323',
    totals: '4a7749ce:464',
  },
  {
    config: 'canonical',
    seed: 2,
    days: '596e9d14:66288',
    totals: '48191fa1:462',
  },
  {
    config: 'together',
    seed: 20260813,
    days: 'ea71fe3e:66306',
    totals: '325c9d26:463',
  },
  {
    config: 'together',
    seed: 1,
    days: '68cbaf19:66147',
    totals: '767e9c5f:464',
  },
  {
    config: 'together',
    seed: 2,
    days: '3e669b9d:66159',
    totals: '475f385e:464',
  },
  {
    config: 'noPractice',
    seed: 20260813,
    days: '54e0fe72:66508',
    totals: '3127dfd:464',
  },
  {
    config: 'noPractice',
    seed: 1,
    days: 'eab2ebaa:66294',
    totals: 'e71379e5:464',
  },
  {
    config: 'noPractice',
    seed: 2,
    days: '103a4189:66239',
    totals: 'd7b155ca:462',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: '7fd46fbd:66549',
    totals: '5318db71:464',
  },
  {
    config: 'talent',
    seed: 1,
    days: '42e51fc7:66390',
    totals: '404b2f07:464',
  },
  {
    config: 'talent',
    seed: 2,
    days: '2fe9f587:66272',
    totals: '181e967d:463',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: 'cd844009:78552',
    totals: '151c9ee4:468',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '16dd5839:78457',
    totals: '3e37d3bd:472',
  },
  {
    config: 'twelve',
    seed: 2,
    days: '265be79b:78210',
    totals: '26d287f6:470',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '84e3c4af:66526',
    totals: 'b4917c8a:464',
  },
  {
    config: 'alike',
    seed: 1,
    days: 'f9a95463:66369',
    totals: 'a7164861:464',
  },
  {
    config: 'alike',
    seed: 2,
    days: '8aef2320:66372',
    totals: '4f44c0d2:463',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: 'a90ffa46:59415',
    totals: 'cea4ed8b:437',
  },
  {
    config: 'flat',
    seed: 1,
    days: 'a89f2479:59466',
    totals: 'd41aa245:437',
  },
  {
    config: 'flat',
    seed: 2,
    days: '9c1e249f:59554',
    totals: '42c6e2eb:437',
  },
  {
    config: 'forty',
    seed: 20260813,
    days: 'dc285484:162403',
    totals: '3f77d959:477',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 15 runs exactly as recorded', () => {
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
