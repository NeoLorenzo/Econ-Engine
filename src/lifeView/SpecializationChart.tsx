import type { LifeConfig } from '../life/types'
import { ownTermsRange } from './lifeViewModel'

export interface SpecializationPoint {
  id: number
  ownTerms: number
  woodShare: number
  alive: boolean
  color: string
}

const WIDTH = 360
const HEIGHT = 130
const PAD = { left: 30, right: 8, top: 8, bottom: 22 }

/**
 * Each forager as a point: across, what wood costs it in food (its own terms, on a log scale over the range its born
 * skills and practice allow); up, the share of its working hours spent gathering. Without swaps the points rise to the right; when foragers
 * specialize by comparative advantage they fall.
 */
export function SpecializationChart({
  points,
  config,
  followed,
}: {
  points: SpecializationPoint[]
  config: LifeConfig
  followed: number
}) {
  const range = ownTermsRange(config)
  const low = Math.log(range.low)
  const high = Math.log(range.high)
  const x = (terms: number) =>
    PAD.left + (high > low ? (Math.log(terms) - low) / (high - low) : 0.5) * (WIDTH - PAD.left - PAD.right)
  const y = (share: number) => PAD.top + (1 - share) * (HEIGHT - PAD.top - PAD.bottom)
  const ticks = [range.low, range.base, range.high]
  return (
    <figure className="life-scatter">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Each forager’s share of working hours spent gathering wood, against what wood costs it in food"
      >
        <line className="axis" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} />
        <line className="axis" x1={PAD.left} x2={PAD.left} y1={y(0)} y2={y(1)} />
        {[0, 0.5, 1].map((share) => (
          <text key={share} className="tick" x={PAD.left - 4} y={y(share) + 3} textAnchor="end">
            {share * 100}%
          </text>
        ))}
        {ticks.map((terms) => (
          <text key={terms} className="tick" x={x(terms)} y={HEIGHT - 6} textAnchor="middle">
            {Math.round(terms)}
          </text>
        ))}
        {points.map((point) => (
          <circle
            key={point.id}
            cx={x(point.ownTerms)}
            cy={y(point.woodShare)}
            r={point.id === followed ? 5.5 : 4}
            fill={point.alive ? point.color : 'none'}
            stroke={point.id === followed ? 'var(--accent)' : point.color}
            strokeWidth={point.id === followed ? 2 : 1.2}
          />
        ))}
      </svg>
      <figcaption>
        Share of work spent gathering, by what wood costs each forager in kcal a unit (hollow: dead)
      </figcaption>
    </figure>
  )
}
