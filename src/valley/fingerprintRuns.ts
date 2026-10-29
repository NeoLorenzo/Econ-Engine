import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 16 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 16's code. A change
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
    days: 'e7faeec1:75501',
    totals: 'e7c8640b:464',
  },
  {
    config: 'canonical',
    seed: 1,
    days: '91f1eac0:75227',
    totals: '2d125f06:464',
  },
  {
    config: 'canonical',
    seed: 2,
    days: 'da01f7e5:75150',
    totals: '6ec74796:462',
  },
  {
    config: 'together',
    seed: 20260813,
    days: '8fe14cb9:75164',
    totals: '454c3ceb:463',
  },
  {
    config: 'together',
    seed: 1,
    days: '1a6a68d1:74997',
    totals: '14d50b3e:462',
  },
  {
    config: 'together',
    seed: 2,
    days: '2aa13837:75029',
    totals: '73739d4c:464',
  },
  {
    config: 'noPractice',
    seed: 20260813,
    days: '5c0ccdbe:75476',
    totals: 'ad2ad555:464',
  },
  {
    config: 'noPractice',
    seed: 1,
    days: '52e5a03c:75296',
    totals: 'fc863177:470',
  },
  {
    config: 'noPractice',
    seed: 2,
    days: '942d1437:75102',
    totals: '772cf603:463',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: 'd06baf83:75472',
    totals: 'b034905c:464',
  },
  {
    config: 'talent',
    seed: 1,
    days: 'e75c9b4a:75317',
    totals: '623f35e2:464',
  },
  {
    config: 'talent',
    seed: 2,
    days: 'dd8e1463:75128',
    totals: 'c2dbb2c4:462',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: 'de4d46a1:89345',
    totals: '1aedf364:468',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '84f854d4:89248',
    totals: '336dac:472',
  },
  {
    config: 'twelve',
    seed: 2,
    days: '62ea2f66:89106',
    totals: 'e9d47b42:469',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '3fb09a5a:75474',
    totals: '5ad45a7c:464',
  },
  {
    config: 'alike',
    seed: 1,
    days: 'abd59964:75274',
    totals: '6207dab2:464',
  },
  {
    config: 'alike',
    seed: 2,
    days: 'ea04ab1f:75251',
    totals: '5597355c:463',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: '9b38cfe6:68264',
    totals: '7b9b0885:437',
  },
  {
    config: 'flat',
    seed: 1,
    days: 'cd2a8086:68315',
    totals: 'd41aa245:437',
  },
  {
    config: 'flat',
    seed: 2,
    days: 'aafff1c7:68404',
    totals: '42c6e2eb:437',
  },
  {
    config: 'forty',
    seed: 20260813,
    days: 'b217cec4:187454',
    totals: '5c88d196:476',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 16 runs exactly as recorded', () => {
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
