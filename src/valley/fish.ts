export interface FishStock {
  bodyId: number
  capacity: number
  stock: number
  remainder: number
  grown: number
  caught: number
}

export function fishCapacity(areaM2: number, minimumAreaM2: number, kgPerHectare: number, kcalPerKg: number) {
  if (areaM2 < minimumAreaM2) return 0
  const capacity = (BigInt(areaM2) * BigInt(kgPerHectare) * BigInt(kcalPerKg)) / 10_000n
  if (capacity * 876_000n > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Fish capacity exceeds supported stock/remainder limits')
  return Number(capacity)
}

/** Exact hourly logistic growth, including large intermediate products. */
export function fishGrowth(capacity: number, stock: number, remainder: number, percentPerYear: number) {
  if (capacity === 0 || stock === capacity) return { grown: 0, remainder: 0 }
  const unit = 876_000n * BigInt(capacity)
  const owed = BigInt(remainder) + BigInt(percentPerYear) * BigInt(stock) * BigInt(capacity - stock)
  const grown = Math.min(capacity - stock, Number(owed / unit))
  return { grown, remainder: grown === capacity - stock ? 0 : Number(owed % unit) }
}

export function fishRate(fullRate: number, stock: number, capacity: number) {
  return capacity === 0 ? 0 : Number((BigInt(fullRate) * BigInt(stock)) / BigInt(capacity))
}
