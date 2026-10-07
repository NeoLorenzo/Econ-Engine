import { useMemo } from 'react'
import type { SimulationState } from '../sim/types'
import { firmShortName, firmSlot, INDUSTRY_NAMES } from './format'
import { firmColor, palette } from './theme'
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
  const households = state.households.map((household) => {
    const outcome = household.industryOutcomes[industry].purchaseOutcomeToday
    return {
      id: household.id,
      x: household.coordinate.x,
      y: household.coordinate.y,
      chosen: outcome === 'purchased' ? (household.spatialPurchasesToday[industry]?.chosenFirmId ?? null) : null,
      missed: outcome === 'insufficient_funds' || outcome === 'stockout',
    }
  })
  const boughtFrom = Object.fromEntries(
    territory.firmIds.map((id) => [id, households.filter(({ chosen }) => chosen === id).length]),
  )
  const missed = households.filter((household) => household.missed).length
  const fill = (firmId: string | null) => (firmId ? firmColor(firmSlot(firmId)) : palette.neutral)
  const letter = (firmId: string) => firmShortName(firmId).replace('Firm ', '')
  const cheaperOn = territory.firmIds
    .map((id) => `${firmShortName(id)} is cheaper on ${territory.cellCounts[id] ?? 0} tiles`)
    .join(', ')
  const bought = territory.firmIds.map((id) => `${boughtFrom[id]} from ${letter(id)}`).join(', ')

  return (
    <figure className="market-map">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${INDUSTRY_NAMES[industry]} map: ${cheaperOn}. Today households bought ${bought}, and ${missed} missed out.`}
      >
        {territory.cells.map((cell) => (
          <rect
            key={`${cell.coordinate.x}-${cell.coordinate.y}`}
            x={cell.coordinate.x}
            y={cell.coordinate.y}
            width={1}
            height={1}
            fill={cell.tie ? palette.neutral : fill(cell.ownerFirmId)}
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
              fill={fill(household.chosen)}
              fillOpacity={household.chosen ? 1 : 0.6}
            />
          ),
        )}
        {firms.map((firm) => (
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
              fill={fill(firm.id)}
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
              {letter(firm.id)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="market-map-key">
        {territory.firmIds.map((id, index) => (
          <span key={id}>
            <i className="dot" style={{ background: fill(id) }} />
            {boughtFrom[id]} {index === 0 ? 'bought from' : 'from'} {letter(id)}
          </span>
        ))}
        {missed > 0 && (
          <span>
            <i className="dot dot--missed" />
            {missed} missed out
          </span>
        )}
      </figcaption>
    </figure>
  )
}
