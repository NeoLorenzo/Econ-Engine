import { describe, expect, it } from 'vitest'
import { LIFE3_BAND } from './config'
import { createValley, runValley } from './engine'
import { life7 } from './experiments'
import type { DaySummary } from './types'

// Life 8's experiment 5: with the shared fire off, the valley runs exactly as Life 7. The fingerprints were recorded
// from Life 7's code before Life 8 changed it, over 30 days on three seeds, for the band born equal and for Life 3's
// band.

/** The fields Life 8 added to a day's summary. */
const LIFE8_DAY_FIELDS = new Set(['fireGivenById', 'campfireBurnedWood', 'fireLitHours', 'fireDarkHours'])

function fingerprintOf(value: unknown) {
  let hash = 0x811c9dc5
  const text = JSON.stringify(value)
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return `${(hash >>> 0).toString(16)}:${text.length}`
}

const life7Days = (days: DaySummary[]) =>
  days.map((day) => Object.fromEntries(Object.entries(day).filter(([key]) => !LIFE8_DAY_FIELDS.has(key))))

const RECORDED = [
  { band: 'equal', seed: 20260813, days: 'a4a4a730:29173', totals: 'db262e27:237' },
  { band: 'equal', seed: 1, days: '9247b71c:29176', totals: '98b23c4f:237' },
  { band: 'equal', seed: 2, days: '209c2518:29179', totals: '8fb01529:242' },
  { band: 'born', seed: 20260813, days: 'acc4210c:29152', totals: 'f0c711cc:243' },
  { band: 'born', seed: 1, days: 'e81c991b:29266', totals: 'df33ee3c:243' },
  { band: 'born', seed: 2, days: 'e6d71c35:29304', totals: '42065af7:243' },
] as const

describe('Life 8 experiment 5: Life 7 is a special case', () => {
  for (const recorded of RECORDED) {
    it(`runs exactly as Life 7 did, for the band ${recorded.band === 'equal' ? 'born equal' : 'born unequal'} on seed ${recorded.seed}`, () => {
      const overrides = life7({ ...(recorded.band === 'born' ? LIFE3_BAND : {}), seed: recorded.seed })
      const end = runValley(createValley(overrides), 30 * 1_440, { recordEvents: false })
      expect(fingerprintOf(life7Days(end.days))).toBe(recorded.days)
      expect(fingerprintOf(end.totals)).toBe(recorded.totals)
    })
  }
})
