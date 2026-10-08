import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '../../sim/config'
import { createSimulation } from '../../sim/engine'
import {
  focusForPanel,
  focusForSelection,
  hashForPanel,
  INITIAL_FOCUS,
  panelFromHash,
  PANELS,
  selectedEntityKind,
  type WorldFocus,
} from './navigation'

const focus: WorldFocus = { selectedId: 'household-3', industry: 'healthcare', linkMode: 'jobs', measure: 'before' }

describe('panel hash', () => {
  it('shows the world, with no panel, for an empty or unknown hash', () => {
    for (const hash of ['', '#', '#nope', 'world']) expect(panelFromHash(hash)).toBeNull()
  })

  it('round-trips every panel through the hash, with or without the leading #', () => {
    for (const { id } of PANELS) expect(panelFromHash(hashForPanel(id))).toBe(id)
    expect(panelFromHash('overview')).toBe('overview')
  })

  it('writes no hash for the world and #id for a panel', () => {
    expect(hashForPanel(null)).toBe('')
    expect(hashForPanel('markets')).toBe('#markets')
  })

  it('opens only Experiments as a wide sheet', () => {
    expect(PANELS.map(({ id }) => id)).toEqual(['overview', 'markets', 'households', 'government', 'experiments'])
    expect(PANELS.filter(({ layout }) => layout === 'wide').map(({ id }) => id)).toEqual(['experiments'])
  })
})

describe('focusForPanel', () => {
  it('shows purchase links for Markets and Households', () => {
    expect(focusForPanel('markets', focus).linkMode).toBe('purchases')
    expect(focusForPanel('households', focus).linkMode).toBe('purchases')
  })

  it('shows after-tax heights for Government', () => {
    expect(focusForPanel('government', focus).measure).toBe('after')
  })

  it('leaves the focus alone for the world, Overview and Experiments', () => {
    for (const panel of [null, 'overview', 'experiments'] as const) expect(focusForPanel(panel, focus)).toEqual(focus)
  })

  it('never changes the selection or the industry', () => {
    for (const panel of [null, ...PANELS.map(({ id }) => id)]) {
      const next = focusForPanel(panel, focus)
      expect(next.selectedId).toBe('household-3')
      expect(next.industry).toBe('healthcare')
    }
  })
})

describe('focusForSelection', () => {
  const state = createSimulation({ seed: DEFAULT_SEED })

  it('keeps the industry when a household is selected', () => {
    expect(focusForSelection(state, focus, 'household-1')).toEqual({ ...focus, selectedId: 'household-1' })
  })

  it("switches to a consumer firm's industry", () => {
    expect(focusForSelection(state, focus, 'firm-utilities-a')).toEqual({
      ...focus,
      selectedId: 'firm-utilities-a',
      industry: 'utilities',
    })
  })

  it('keeps the industry for the transport firm', () => {
    expect(focusForSelection(state, focus, 'firm-transport').industry).toBe('healthcare')
  })

  it('clears the selection', () => {
    expect(focusForSelection(state, focus, null)).toEqual({ ...focus, selectedId: null })
  })
})

describe('selectedEntityKind', () => {
  const state = createSimulation({ seed: DEFAULT_SEED })

  it('recognizes households and firms that exist', () => {
    expect(selectedEntityKind(state, 'household-1')).toBe('household')
    expect(selectedEntityKind(state, 'firm-transport')).toBe('firm')
  })

  it('returns null for no selection or an unknown ID', () => {
    expect(selectedEntityKind(state, null)).toBeNull()
    expect(selectedEntityKind(state, 'household-999')).toBeNull()
  })

  it('returns null for a household removed by a smaller population', () => {
    const smaller = createSimulation({ seed: DEFAULT_SEED, householdCount: 50 })
    expect(selectedEntityKind(smaller, 'household-80')).toBeNull()
  })
})

describe('INITIAL_FOCUS', () => {
  it('starts on Food with purchase links and before-tax heights, nothing selected', () => {
    expect(INITIAL_FOCUS).toEqual({ selectedId: null, industry: 'food', linkMode: 'purchases', measure: 'before' })
  })
})
