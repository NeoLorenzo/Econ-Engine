import { runCompetitionStartingPriceGrid, type CompetitionGridSuite } from '../sim/competitionGridExperiment'
import { ensembleSeedMetrics, type EnsembleKind } from '../sim/ensemble'
import { runEmploymentDynamics, type EmploymentDynamicsReport } from '../sim/employmentDynamics'
import { runGeneralizedSpatialExperiment, type GeneralizedSpatialResult } from '../sim/generalizedSpatialExperiment'
import { runGovernmentBaselineComparison, type GovernmentTrajectorySummary } from '../sim/governmentExperiment'
import { runPopulationScaleComparison } from '../sim/populationScaleExperiment'
import { runMultiIndustryExperiment, type MultiIndustryExperimentResult } from '../sim/scarcityExperiment'

export interface ExperimentResults {
  population: ReturnType<typeof runPopulationScaleComparison>
  employment: EmploymentDynamicsReport
  government: { adaptive: GovernmentTrajectorySummary; baseline: GovernmentTrajectorySummary }
  competition: GeneralizedSpatialResult
  pricingProbe: MultiIndustryExperimentResult
  startingPriceGrid: CompetitionGridSuite
}

export type ExperimentKind = keyof ExperimentResults

/** Runs one research harness. Each starts from its own fresh economy, so the live run is never touched. */
export function runExperiment<K extends ExperimentKind>(kind: K, seed: number): ExperimentResults[K] {
  const run: { [Kind in ExperimentKind]: () => ExperimentResults[Kind] } = {
    population: () => {
      const result = runPopulationScaleComparison(seed)
      // The terminal states are large and unused by the view; dropping them keeps the worker hand-off cheap.
      return {
        ...result,
        n10: { ...result.n10, terminalState: undefined as never },
        n100: { ...result.n100, terminalState: undefined as never },
      }
    },
    employment: () => ({ ...runEmploymentDynamics(seed), observations: [] }),
    government: () => runGovernmentBaselineComparison(seed),
    competition: () => runGeneralizedSpatialExperiment([seed])[0]!,
    pricingProbe: () => runMultiIndustryExperiment({ seed }),
    startingPriceGrid: () => runCompetitionStartingPriceGrid({ startingPricesCents: [100, 500, 800], seed }),
  }
  return run[kind]() as ExperimentResults[K]
}

/** A whole single-seed experiment, or one seed of an ensemble (the pool runs ensemble seeds in parallel). */
export type ExperimentRequest =
  | { id: number; task: 'experiment'; kind: ExperimentKind; seed: number }
  | { id: number; task: 'ensembleSeed'; kind: EnsembleKind; seed: number; horizonDays: number }
export type ExperimentResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }

/** Executes one worker request; shared by the worker and the main-thread fallback. */
export function runRequest(request: ExperimentRequest): unknown {
  return request.task === 'experiment'
    ? runExperiment(request.kind, request.seed)
    : ensembleSeedMetrics(request.kind, request.seed, request.horizonDays)
}
