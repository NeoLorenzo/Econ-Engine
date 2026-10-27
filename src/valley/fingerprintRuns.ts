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
    days: '6dd66e65:66501',
    totals: 'f7cf7980:464',
  },
  {
    config: 'canonical',
    seed: 1,
    days: '2ac589f6:66317',
    totals: '13558877:464',
  },
  {
    config: 'canonical',
    seed: 2,
    days: 'a47a374b:66221',
    totals: '55a6f741:463',
  },
  {
    config: 'together',
    seed: 20260813,
    days: '6b1d2742:66291',
    totals: '5b2a7159:463',
  },
  {
    config: 'together',
    seed: 1,
    days: 'cd30b991:66129',
    totals: 'f36c46d1:464',
  },
  {
    config: 'together',
    seed: 2,
    days: '1e2a7ee5:66146',
    totals: '6ddf9c6a:464',
  },
  {
    config: 'noPractice',
    seed: 20260813,
    days: '7a366264:66580',
    totals: 'da4c7848:464',
  },
  {
    config: 'noPractice',
    seed: 1,
    days: '995b0000:66296',
    totals: 'd4f2e53a:464',
  },
  {
    config: 'noPractice',
    seed: 2,
    days: '52cd85f9:66238',
    totals: '534d359f:462',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: 'b874662e:66551',
    totals: 'fd049345:464',
  },
  {
    config: 'talent',
    seed: 1,
    days: 'b93234b4:66380',
    totals: '400eb230:464',
  },
  {
    config: 'talent',
    seed: 2,
    days: '16f626b:66282',
    totals: 'acfb38c5:463',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: '90490841:78530',
    totals: '2b986826:468',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '294277b3:78475',
    totals: '68bfeec3:472',
  },
  {
    config: 'twelve',
    seed: 2,
    days: 'be666fe7:78187',
    totals: 'a3ea33b:470',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '6eead3:66600',
    totals: 'deec9194:463',
  },
  {
    config: 'alike',
    seed: 1,
    days: '9f26e36b:66432',
    totals: '797f9a88:464',
  },
  {
    config: 'alike',
    seed: 2,
    days: '83304d9b:66370',
    totals: '87404deb:463',
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
    days: '9645b9b3:162512',
    totals: '628f4e06:477',
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
