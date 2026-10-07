import { useMemo } from 'react'
import type { SimulationState } from '../sim/types'
import { firmVariant, INDUSTRY_NAMES } from './format'
import { palette } from './theme'
import { buildMarketTerritory, type CompetitiveIndustryId } from './worldViewModel'

/**
 * Top-down view of one market. The floor shows which firm is cheaper once the round trip is paid;
 * each dot is a household, coloured by the firm it actually bought from today.
 */
export function MarketMap({
  state,
  industry,
  onSelectFirm,
}: {
  state: SimulationState
  industry: CompetitiveIndustryId
  onSelectFirm?: (firmId: string) => void
}) {
  const territory = useMemo(() => buildMarketTerritory(state, industry), [state, industry])
  const width = state.config.gridWidth ?? 20
  const height = state.config.gridHeight ?? 20
  const firms = state.firms.filter((firm) => firm.industryId === industry && firm.coordinate)
  const counts = { a: 0, b: 0, missed: 0 }
  const households = state.households.map((household) => {
    const outcome = household.industryOutcomes[industry].purchaseOutcomeToday
    const chosen = household.spatialPurchasesToday[industry]?.chosenFirmId ?? null
    const variant = outcome === 'purchased' && chosen ? firmVariant(chosen) : null
    if (variant) counts[variant] += 1
    else if (outcome === 'insufficient_funds' || outcome === 'stockout') counts.missed += 1
    return {
      id: household.id,
      x: household.coordinate.x,
      y: household.coordinate.y,
      variant,
      missed: outcome === 'insufficient_funds' || outcome === 'stockout',
    }
  })
  const fill = (variant: 'a' | 'b' | null) =>
    variant === 'a' ? palette.firmA : variant === 'b' ? palette.firmB : palette.neutral

  return (
    <figure className="market-map">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${INDUSTRY_NAMES[industry]} map: Firm A is cheaper on ${territory.cellCounts[territory.firmIds[0]]} tiles and Firm B on ${territory.cellCounts[territory.firmIds[1]]}. Today ${counts.a} households bought from A, ${counts.b} from B, and ${counts.missed} missed out.`}
      >
        {territory.cells.map((cell) => (
          <rect
            key={`${cell.coordinate.x}-${cell.coordinate.y}`}
            x={cell.coordinate.x}
            y={cell.coordinate.y}
            width={1}
            height={1}
            fill={cell.tie ? palette.neutral : fill(cell.ownerVariant)}
            fillOpacity={cell.tie ? 0.25 : 0.2}
          />
        ))}
        {households.map((household) =>
          household.missed ? (
            <circle
              key={household.id}
              cx={household.x + 0.5}
              cy={household.y + 0.5}
              r={0.24}
              fill="none"
              stroke={palette.negative}
              strokeWidth={0.1}
            />
          ) : (
            <circle
              key={household.id}
              cx={household.x + 0.5}
              cy={household.y + 0.5}
              r={0.24}
              fill={fill(household.variant)}
              fillOpacity={household.variant ? 1 : 0.6}
            />
          ),
        )}
        {firms.map((firm) => {
          const variant = firmVariant(firm.id) ?? 'a'
          return (
            <g
              key={firm.id}
              className={onSelectFirm ? 'market-map-firm' : undefined}
              onClick={onSelectFirm ? () => onSelectFirm(firm.id) : undefined}
            >
              <rect
                x={firm.coordinate!.x + 0.05}
                y={firm.coordinate!.y + 0.05}
                width={0.9}
                height={0.9}
                rx={0.18}
                fill={fill(variant)}
                stroke={palette.bg}
                strokeWidth={0.12}
              />
              <text
                x={firm.coordinate!.x + 0.5}
                y={firm.coordinate!.y + 0.72}
                textAnchor="middle"
                fontSize={0.62}
                fontWeight={700}
                fill={palette.bg}
              >
                {variant.toUpperCase()}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="market-map-key">
        <span>
          <i className="dot dot--a" />
          {counts.a} bought from A
        </span>
        <span>
          <i className="dot dot--b" />
          {counts.b} from B
        </span>
        {counts.missed > 0 && (
          <span>
            <i className="dot dot--missed" />
            {counts.missed} missed out
          </span>
        )}
      </figcaption>
    </figure>
  )
}
