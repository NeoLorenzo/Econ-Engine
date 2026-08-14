import { describe, expect, it } from 'vitest'
import { analyzeCompetitiveTrajectory, runGeneralizedSpatialExperiment, type CompetitiveDayObservation } from './generalizedSpatialExperiment'
import { createSimulation, stepSimulation } from './engine'

const day = (shareA: number, unitsA: number, unitsB: number, postedA = 100, postedB = 200, incumbentA = 90, incumbentB = 180, profitA = unitsA * postedA, profitB = unitsB * postedB): CompetitiveDayObservation => ({
  a: { marketShare: shareA, unitsSold: unitsA, postedPriceCents: postedA, incumbentPriceCents: incumbentA, profitCents: profitA },
  b: { marketShare: 1 - shareA, unitsSold: unitsB, postedPriceCents: postedB, incumbentPriceCents: incumbentB, profitCents: profitB },
})

describe('competitive trajectory analytics', () => {
  it('measures occupancy, full-horizon means, cumulative sales, prices, and profit', () => {
    const observations = [day(0.6, 6, 4, 100, 200, 90, 180, 600, 800), day(0.5, 5, 5, 120, 180, 100, 170, 600, 900), day(0, 0, 10, 80, 220, 80, 200, 0, 2200)]
    const result = analyzeCompetitiveTrajectory(observations)
    expect(result.firmA.daysLeading + result.firmB.daysLeading + result.tieDays).toBe(3)
    expect(result.firmA.fractionDaysLeading + result.firmB.fractionDaysLeading + result.fractionDaysTied).toBeCloseTo(1)
    expect(result.firmA.meanDailyMarketShare).toBeCloseTo(1.1 / 3)
    expect(result.firmA.totalUnitsSold).toBe(11)
    expect(result.firmB.totalUnitsSold).toBe(19)
    expect(result.firmA.cumulativeSalesShare).toBeCloseTo(11 / 30)
    expect(result.firmB.cumulativeSalesShare).toBeCloseTo(19 / 30)
    expect(result.firmA.meanPostedPriceCents).toBe(100)
    expect([result.firmA.minimumPostedPriceCents, result.firmA.maximumPostedPriceCents]).toEqual([80, 120])
    expect(result.firmA.meanIncumbentPriceCents).toBe(90)
    expect(result.firmA.cumulativeProfitCents).toBe(1200)
    expect(result.firmA.meanDailyProfitCents).toBe(400)
    expect(result.firmA.fractionIndustryProfit).toBeCloseTo(1200 / 5100)
    expect(result.terminalSnapshot.marketShares).toEqual([0, 1])
    expect(result.firmB.meanDailyMarketShare).not.toBe(1)
  })

  it('counts direct and tie-bridged leadership transitions without false tie transitions', () => {
    expect(analyzeCompetitiveTrajectory([day(.6, 6, 4), day(.4, 4, 6)]).leadershipChanges).toBe(1)
    expect(analyzeCompetitiveTrajectory([day(.6, 6, 4), day(.5, 5, 5), day(.4, 4, 6)]).leadershipChanges).toBe(1)
    expect(analyzeCompetitiveTrajectory([day(.6, 6, 4), day(.5, 5, 5), day(.7, 7, 3)]).leadershipChanges).toBe(0)
  })

  it('measures leading and temporary 100%-share spells', () => {
    const result = analyzeCompetitiveTrajectory([day(.6, 6, 4), day(.7, 7, 3), day(.5, 5, 5), day(1, 10, 0), day(1, 10, 0), day(.4, 4, 6), day(0, 0, 10)])
    expect(result.firmA.leadingSpells).toEqual({ count: 2, longestDays: 2, averageDays: 2 })
    expect(result.firmB.leadingSpells).toEqual({ count: 1, longestDays: 2, averageDays: 2 })
    expect(result.firmA.daysAtFullShare).toBe(2)
    expect(result.firmA.fullShareSpells).toEqual({ count: 1, longestDays: 2, averageDays: 2 })
    expect(result.firmB.daysAtFullShare).toBe(1)
    expect(result.firmB.fullShareSpells.longestDays).toBe(1)
  })

  it('is pure and does not mutate its observations', () => {
    const observations = [day(.6, 6, 4), day(.4, 4, 6)]
    const before = structuredClone(observations)
    expect(analyzeCompetitiveTrajectory(observations)).toEqual(analyzeCompetitiveTrajectory(observations))
    expect(observations).toEqual(before)
  })

  it('does not consume simulation RNG or alter subsequent simulation results', () => {
    const state = stepSimulation(createSimulation({ seed: 91, startingPriceCents: 100, initialStepCents: 100, dailySupplyPerIndustry: 10 }))
    const before = structuredClone(state)
    const markets = state.metrics.at(-1)!.markets.filter(({ industryId }) => industryId === 'food')
    analyzeCompetitiveTrajectory([{ a: { marketShare: markets[0].marketShare, unitsSold: markets[0].unitsSold, postedPriceCents: markets[0].postedPriceCents, incumbentPriceCents: markets[0].incumbentPriceCents, profitCents: markets[0].preTaxProfitCents }, b: { marketShare: markets[1].marketShare, unitsSold: markets[1].unitsSold, postedPriceCents: markets[1].postedPriceCents, incumbentPriceCents: markets[1].incumbentPriceCents, profitCents: markets[1].preTaxProfitCents } }])
    expect(state).toEqual(before)
    expect(state.rngState).toBe(before.rngState)
    expect(stepSimulation(state)).toEqual(stepSimulation(before))
  })
})

describe('generalized spatial competition experiment', () => {
  it('records all four industries and aggregate Transport reproducibly', () => {
    const first = runGeneralizedSpatialExperiment([7, 42], 30)
    expect(first).toEqual(runGeneralizedSpatialExperiment([7, 42], 30))
    expect(first.every(({ industries }) => industries.length === 4 && industries.every(({ priceTrajectories, analytics }) => analytics.horizonDays === 30 && Object.values(priceTrajectories).every((history) => history.length === 30)))).toBe(true)
    expect(first.every(({ totalTripsAtHorizon, totalTransportRevenueCentsAtHorizon }) => totalTripsAtHorizon <= 40 && totalTransportRevenueCentsAtHorizon >= 0)).toBe(true)
  }, 15_000)

  it('reproduces the exact full 1000-day analysis for the same seed', () => {
    expect(runGeneralizedSpatialExperiment([7])).toEqual(runGeneralizedSpatialExperiment([7]))
  }, 30_000)
})
