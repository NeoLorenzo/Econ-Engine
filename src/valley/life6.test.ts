import { describe, expect, it } from 'vitest'
import { LIFE3_BAND } from './config'
import { createValley, runValley } from './engine'
import { life6 } from './experiments'
import type { DaySummary } from './types'

// Life 7's experiment 5: with long sight, checking sites, the carrying cost and taking loads home off, and Life 8's
// shared fire, the valley runs exactly as Life 6. The fingerprints were recorded from Life 6's code before Life 7 changed it, over 30 days on three
// seeds, for the band born equal and for Life 3's band.

/** The fields Life 7 and Life 8 added to a day's summary. */
const LIFE7_DAY_FIELDS = new Set([
  'loadedWalkSecondsById',
  'sitesKnownById',
  'sitesCheckedById',
  'fireGivenById',
  'campfireBurnedWood',
  'fireLitHours',
  'fireDarkHours',
])

function fingerprintOf(value: unknown) {
  let hash = 0x811c9dc5
  const text = JSON.stringify(value)
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return `${(hash >>> 0).toString(16)}:${text.length}`
}

const life6Days = (days: DaySummary[]) =>
  days.map((day) => Object.fromEntries(Object.entries(day).filter(([key]) => !LIFE7_DAY_FIELDS.has(key))))

const RECORDED = [
  { band: 'equal', seed: 20260813, days: 'f85ac505:25307', totals: '518ad246:237' },
  { band: 'equal', seed: 1, days: '93502f91:25340', totals: '6fb7b851:237' },
  { band: 'equal', seed: 2, days: 'd0513782:25353', totals: '69589fc6:237' },
  { band: 'born', seed: 20260813, days: 'f3bea238:25385', totals: '684fc3bf:243' },
  { band: 'born', seed: 1, days: '5d67589d:25303', totals: 'a41eb6ae:243' },
  { band: 'born', seed: 2, days: 'ef6f33e3:25434', totals: '35f40d72:244' },
] as const

describe('Life 7 experiment 5: Life 6 is a special case', () => {
  for (const recorded of RECORDED) {
    it(`runs exactly as Life 6 did, for the band ${recorded.band === 'equal' ? 'born equal' : 'born unequal'} on seed ${recorded.seed}`, () => {
      const overrides = life6({ ...(recorded.band === 'born' ? LIFE3_BAND : {}), seed: recorded.seed })
      const end = runValley(createValley(overrides), 30 * 1_440, { recordEvents: false })
      expect(fingerprintOf(life6Days(end.days))).toBe(recorded.days)
      expect(fingerprintOf(end.totals)).toBe(recorded.totals)
    })
  }
})
