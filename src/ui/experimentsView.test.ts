import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { runExperiment } from './experimentRunner'
import type { ExperimentState } from './experiments'
import { ExperimentsView } from './views/ExperimentsView'

const SEED_A = 20260707
const SEED_B = 4242

const render = (seed: number, experiments: ExperimentState) =>
  renderToStaticMarkup(createElement(ExperimentsView, { seed, experiments, onRun: () => {} }))

describe('Experiment result provenance across resets (#12)', () => {
  const resultA = runExperiment('pricingProbe', SEED_A)
  const resultB = runExperiment('pricingProbe', SEED_B)

  it('labels a seed-A result with seed A after the live run is reset to seed B', () => {
    const markup = render(SEED_B, { pricingProbe: { status: 'done', seed: SEED_A, result: resultA } })
    expect(markup).toContain(`Ran with seed ${SEED_A}; the current seed is ${SEED_B}.`)
  })

  it('shows no provenance note once the result belongs to the current seed', () => {
    expect(render(SEED_A, { pricingProbe: { status: 'done', seed: SEED_A, result: resultA } })).not.toContain(
      'Ran with seed',
    )
    expect(render(SEED_B, { pricingProbe: { status: 'done', seed: SEED_B, result: resultB } })).not.toContain(
      'Ran with seed',
    )
  })

  it('keeps the label tied to the stored entry rather than the live seed', () => {
    const experiments: ExperimentState = { pricingProbe: { status: 'done', seed: SEED_A, result: resultA } }
    for (const liveSeed of [SEED_B, 1, 99])
      expect(render(liveSeed, experiments)).toContain(`Ran with seed ${SEED_A}; the current seed is ${liveSeed}.`)
  })
})
