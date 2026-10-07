import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { runExperiment } from './experimentRunner'
import type { ExperimentState } from './experiments'
import { runEnsemble } from '../sim/ensemble'
import { ExperimentsView } from './views/ExperimentsView'
import { EnsemblesSection } from './views/EnsemblesSection'

const SEED_A = 20260707
const SEED_B = 4242

const render = (seed: number, experiments: ExperimentState) =>
  renderToStaticMarkup(
    createElement(ExperimentsView, { seed, experiments, onRun: () => {}, ensembles: {}, onRunEnsemble: () => {} }),
  )

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

describe('Ensemble results are labelled as ensembles (#3)', () => {
  const result = runEnsemble('government', [SEED_A, SEED_B, 7], 20)
  const renderEnsemble = (seed: number) =>
    renderToStaticMarkup(
      createElement(EnsemblesSection, {
        seed,
        ensembles: { government: { status: 'done', base: SEED_A, result } },
        onRun: () => {},
      }),
    )

  it('presents the summary as a spread across seeds, with every seed listed', () => {
    const markup = renderEnsemble(SEED_A)
    expect(markup).toContain('Summary across 3 seeds')
    expect(markup).toContain('not one trajectory')
    expect(markup).toContain('Middle 80% (p10–p90)')
    for (const seed of result.seeds) expect(markup).toContain(`<td class="num">${seed}</td>`)
    expect(markup).not.toContain('Seed set built from seed')
  })

  it('keeps the seed set it was built from after the live seed changes', () => {
    expect(renderEnsemble(SEED_B)).toContain(`Seed set built from seed ${SEED_A}; the current seed is ${SEED_B}.`)
  })
})
