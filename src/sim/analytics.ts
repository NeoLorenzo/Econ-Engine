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
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export function giniCoefficient(values: number[]): number {
  if (values.length === 0) return 0
  if (values.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error('Gini values must be finite and non-negative')
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total === 0) return 0
  // Σ over ordered pairs |xᵢ − xⱼ| equals 2 Σᵢ (2i − n + 1) x₍ᵢ₎ over ascending values (0-based i). For integer cents
  // every partial sum is an exact integer, so this O(n log n) form returns the same bits as the pairwise double loop.
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  let weightedSum = 0
  for (let index = 0; index < n; index += 1) weightedSum += (2 * index - n + 1) * sorted[index]!
  const absoluteDifferenceSum = 2 * weightedSum
  return absoluteDifferenceSum / (2 * values.length * total)
}

export function summarizeCashDistribution(values: number[]): CashDistribution {
  if (values.length === 0) return { minimumCents: 0, medianCents: 0, maximumCents: 0, gini: 0 }
  if (values.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error('Cash balances must be finite and non-negative')
  return {
    minimumCents: Math.min(...values),
    medianCents: median(values),
    maximumCents: Math.max(...values),
    gini: giniCoefficient(values),
  }
}
