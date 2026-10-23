import { describe, it, expect } from 'vitest'
import { valleyTheory } from './theory'
import { resolveValleyConfig, FLAT_LAND, fishCapacityKcal } from './config'
describe('analytic Life 12 magnitudes', () => {
  const config = resolveValleyConfig(FLAT_LAND),
    t = valleyTheory(config)
  it('counts aggregate food and log offers', () => {
    expect(t.initialFoodKcal).toBe(32 * 3120 + 32 * 75000 + fishCapacityKcal(config))
    expect(t.logsOnOffer).toBe(12 * 36)
  })
  it('prices making by its extra energy', () => {
    expect(t.axeAsk(100)).toBe(3000)
    expect(t.axeAsk(50)).toBe(6000)
  })
  it('saves firewood with a shared fire', () => {
    expect(t.campfireNightWood).toBe(12)
    expect(t.campfireWoodPerMember(8)).toBe(1.5)
    expect(t.campfireGatherHoursPerDay(3, 24)).toBeCloseTo(1 / 6)
  })
  it('declares exact lazy-body examples', () => {
    expect(t.lazyRestDay).toEqual({ kcal: 2160, waterMl: 2000 })
    expect(t.lazyPickingFourHours).toEqual({ kcal: 800, extraWaterMl: 440 })
  })
  it('anchors growth to years and body costs to days', () => {
    const fast = valleyTheory({ ...config, daysPerYear: 8 }),
      slow = valleyTheory({ ...config, daysPerYear: 365 })
    expect(fast.yearlyRegrowthKcal).toBe(slow.yearlyRegrowthKcal)
    expect(fast.dailyRegrowthKcal * 8).toBe(slow.dailyRegrowthKcal * 365)
    expect(fast.lazyRestDay).toEqual(slow.lazyRestDay)
  })
})
