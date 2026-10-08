import type { SimulationState } from '../../sim/types'
import type { CashMeasure, CompetitiveIndustryId, LinkMode } from '../worldViewModel'

export type PanelId = 'overview' | 'markets' | 'households' | 'government' | 'experiments'
export type PanelLayout = 'docked' | 'wide'

export const PANELS: readonly { id: PanelId; label: string; layout: PanelLayout }[] = [
  { id: 'overview', label: 'Overview', layout: 'docked' },
  { id: 'markets', label: 'Markets', layout: 'docked' },
  { id: 'households', label: 'Households', layout: 'docked' },
  { id: 'government', label: 'Government', layout: 'docked' },
  { id: 'experiments', label: 'Experiments', layout: 'wide' },
]

/** Everything that decides what the 3D world highlights. Panels and the map tools both change it. */
export interface WorldFocus {
  selectedId: string | null
  industry: CompetitiveIndustryId
  linkMode: LinkMode
  measure: CashMeasure
  /** Whether the data overlay (territory tiles and household cash pillars) is drawn over the town. */
  overlay: boolean
  /** Whether the grass island, trees and bushes are drawn around the town. Decoration only. */
  scenery: boolean
}

export const INITIAL_FOCUS: WorldFocus = {
  selectedId: null,
  industry: 'food',
  linkMode: 'purchases',
  measure: 'before',
  overlay: false,
  scenery: true,
}

/** The open panel for a URL hash; anything unrecognized shows the world with no panel. */
export function panelFromHash(hash: string): PanelId | null {
  const id = hash.startsWith('#') ? hash.slice(1) : hash
  return PANELS.find((panel) => panel.id === id)?.id ?? null
}

export function hashForPanel(panel: PanelId | null) {
  return panel ? `#${panel}` : ''
}

/** The starting focus a panel sets when it opens. It is applied once, so the user can change it afterwards. */
export function focusForPanel(panel: PanelId | null, focus: WorldFocus): WorldFocus {
  if (panel === 'markets' || panel === 'households') return { ...focus, linkMode: 'purchases' }
  // Redistribution is only readable as pillar heights, so Government also shows the overlay.
  if (panel === 'government') return { ...focus, measure: 'after', overlay: true }
  return focus
}

/** Selecting a consumer firm also shows its market; Transport has no market of its own to show. */
export function focusForSelection(state: SimulationState, focus: WorldFocus, id: string | null): WorldFocus {
  const firm = id ? state.firms.find((candidate) => candidate.id === id) : null
  return firm && firm.industryId !== 'transport'
    ? { ...focus, selectedId: id, industry: firm.industryId }
    : { ...focus, selectedId: id }
}

/** What the selection refers to, or null when it names nothing that exists in this run. */
export function selectedEntityKind(
  state: SimulationState,
  id: string | null,
): 'household' | 'firm' | 'government' | null {
  if (!id) return null
  if (id === state.government.id) return 'government'
  if (state.households.some((household) => household.id === id)) return 'household'
  if (state.firms.some((firm) => firm.id === id)) return 'firm'
  return null
}
