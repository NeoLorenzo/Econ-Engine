import { runExperiment, type ExperimentRequest, type ExperimentResponse } from './experimentRunner'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ExperimentRequest>) => void) | null
  postMessage: (message: ExperimentResponse) => void
}

scope.onmessage = (event) => {
  const { id, kind, seed } = event.data
  try {
    scope.postMessage({ id, ok: true, result: runExperiment(kind, seed) })
  } catch (error) {
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
