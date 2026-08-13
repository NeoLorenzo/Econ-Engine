export interface CashDistribution {
  minimumCents: number
  medianCents: number
  maximumCents: number
  gini: number
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

export function giniCoefficient(values: number[]): number {
  if (values.length === 0) return 0
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Gini values must be finite and non-negative')
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total === 0) return 0
  let absoluteDifferenceSum = 0
  for (const left of values) {
    for (const right of values) absoluteDifferenceSum += Math.abs(left - right)
  }
  return absoluteDifferenceSum / (2 * values.length * total)
}

export function summarizeCashDistribution(values: number[]): CashDistribution {
  if (values.length === 0) return { minimumCents: 0, medianCents: 0, maximumCents: 0, gini: 0 }
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Cash balances must be finite and non-negative')
  return {
    minimumCents: Math.min(...values),
    medianCents: median(values),
    maximumCents: Math.max(...values),
    gini: giniCoefficient(values),
  }
}

export function countAffordableAtPrice(values: number[], priceCents: number): number {
  return values.filter((value) => value >= priceCents).length
}
