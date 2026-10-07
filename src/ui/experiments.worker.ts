import { runRequest, type ExperimentRequest, type ExperimentResponse } from './experimentRunner'

const scope = self as unknown as {
  addEventListener: (type: 'message', listener: (event: MessageEvent<ExperimentRequest>) => void) => void
  postMessage: (message: ExperimentResponse) => void
}

scope.addEventListener('message', (event) => {
  const { id } = event.data
  try {
    scope.postMessage({ id, ok: true, result: runRequest(event.data) })
  } catch (error) {
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})
