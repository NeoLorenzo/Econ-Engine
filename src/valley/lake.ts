import { lakeCapacityKcal } from './config'
import { HOURS_PER_YEAR } from './work'
import type { Forager, Point, ValleyConfig } from './types'

// The lake beyond the valley's north edge, `y < 0`. Its shore is the edge `y = 0`, and a forager fishes standing on it
// straight north of where it is. Its fish breed by the logistic rule: a full or empty lake gains nothing, and a lake
// at half its stock gains most.

/** The point on the shore where a forager at `x` fishes. */
export const shorePoint = (forager: Pick<Forager, 'x'>): Point => ({ x: forager.x, y: 0 })

/** Whether a forager at `y` sees the shore, within sight `sight`: the nearest shore point is straight north. */
export const seesShore = (y: number, sight: number) => y <= sight

/**
 * One hour's growth of the lake's fish: `lakeGrowthPercentPerYear · F · (K − F)` owed in units of `100 · K · 8,760`,
 * with what is owed carried in `remainder`, so no growth is lost to rounding. Returns the whole kilocalories grown and
 * the remainder left.
 */
export function lakeGrowth(config: ValleyConfig, stock: number, remainder: number) {
  const capacity = lakeCapacityKcal(config)
  const unit = 100 * capacity * HOURS_PER_YEAR
  const owed = remainder + config.lakeGrowthPercentPerYear * stock * (capacity - stock)
  const grown = Math.floor(owed / unit)
  return { grown, remainder: owed - grown * unit }
}
