import { useMemo, useRef, useState } from 'react'
import type { SimulationState } from '../../sim/types'
import { Icon, Segmented } from '../components'
import { CONSUMER_INDUSTRIES } from '../economyModel'
import { firmName, firmShortName, firmSlot, householdName, INDUSTRY_NAMES, money } from '../format'
import type { WorldFocus } from '../shell/navigation'
import { useHeightVar } from '../shell/useHeightVar'
import { firmColor } from '../theme'
import { buildMarketTerritory } from '../worldViewModel'

/** Search, market and relationship switches, pillar height and the territory legend, floating over the world. */
export function MapTools({
  state,
  focus,
  onFocus,
  onSelect,
  onResetCamera,
  ready,
}: {
  state: SimulationState
  focus: WorldFocus
  onFocus: (next: WorldFocus) => void
  onSelect: (id: string) => void
  onResetCamera: () => void
  ready: boolean
}) {
  const [query, setQuery] = useState('')
  const toolsRef = useRef<HTMLDivElement | null>(null)
  // The inspector and the intro card sit above the tools, which wrap onto more rows on narrow screens.
  useHeightVar(toolsRef, '--tools-h')
  const territory = useMemo(() => buildMarketTerritory(state, focus.industry), [state, focus.industry])
  const territoryFirms = territory.firmIds.map((id) => state.firms.find((firm) => firm.id === id)!)
  const searchOptions = useMemo(
    () => [
      ...state.firms.map(({ id }) => ({ id, label: firmName(id) })),
      ...state.households.map(({ id }) => ({ id, label: householdName(id) })),
    ],
    [state.firms, state.households],
  )

  const onSearch = (value: string) => {
    setQuery(value)
    const match = searchOptions.find((option) => option.label.toLowerCase() === value.trim().toLowerCase())
    if (match) {
      onSelect(match.id)
      setQuery('')
    }
  }

  return (
    <div ref={toolsRef} className="map-tools">
      <div className="world-overlay world-overlay--tools">
        <label className="world-search">
          <Icon name="search" size={14} />
          <input
            list="world-entities"
            placeholder="Find a household or firm"
            aria-label="Find a household or firm"
            value={query}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
        <datalist id="world-entities">
          {searchOptions.map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>
        <button
          type="button"
          className="icon-button"
          aria-label="Reset camera"
          title="Reset camera"
          disabled={!ready}
          onClick={onResetCamera}
        >
          <Icon name="camera" />
        </button>
        <div className="world-tools">
          <Segmented
            label="Market shown on the map"
            size="sm"
            value={focus.industry}
            onChange={(industry) => onFocus({ ...focus, industry })}
            options={CONSUMER_INDUSTRIES.map((id) => ({ id, label: INDUSTRY_NAMES[id] }))}
          />
          <Segmented
            label="Relationship lines"
            size="sm"
            value={focus.linkMode}
            onChange={(linkMode) => onFocus({ ...focus, linkMode })}
            options={[
              { id: 'purchases', label: 'Purchases' },
              { id: 'jobs', label: 'Jobs' },
            ]}
          />
        </div>
      </div>
      <div className="world-overlay world-overlay--legend world-legend">
        <span className="legend-height">
          Height
          <Segmented
            label="Pillar height shows"
            size="sm"
            value={focus.measure}
            onChange={(measure) => onFocus({ ...focus, measure })}
            options={[
              { id: 'before', label: 'Before tax' },
              { id: 'after', label: 'After tax' },
            ]}
          />
        </span>
        {territoryFirms.map((firm) => (
          <span key={firm.id}>
            <i className="swatch" style={{ background: firmColor(firmSlot(firm.id)) }} />
            {firmShortName(firm.id)} · {money(firm.postedPriceCents)} · {territory.cellCounts[firm.id] ?? 0} tiles
          </span>
        ))}
      </div>
    </div>
  )
}
