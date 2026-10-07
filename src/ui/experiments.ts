import { useCallback, useEffect, useRef, useState } from 'react'
import {
  runExperiment,
  type ExperimentKind,
  type ExperimentRequest,
  type ExperimentResponse,
  type ExperimentResults,
} from './experimentRunner'

export type { ExperimentKind, ExperimentResults } from './experimentRunner'

type Entry<K extends ExperimentKind> =
  | { status: 'running'; seed: number }
  | { status: 'done'; seed: number; result: ExperimentResults[K] }
  | { status: 'error'; seed: number; error: string }
export type ExperimentState = { [K in ExperimentKind]?: Entry<K> }

let worker: Worker | null | undefined

function getWorker() {
  if (worker !== undefined) return worker
  try {
    worker =
      typeof Worker === 'undefined'
        ? null
        : new Worker(new URL('./experiments.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }
  return worker
}

/** Runs experiments in a Web Worker so the page stays responsive; falls back to the main thread if workers are unavailable. */
export function useExperiments() {
  const [experiments, setExperiments] = useState<ExperimentState>({})
  const nextId = useRef(1)
  const pending = useRef(new Map<number, { kind: ExperimentKind; seed: number }>())

  const settle = useCallback((kind: ExperimentKind, seed: number, outcome: { result: unknown } | { error: string }) => {
    setExperiments((current) => ({
      ...current,
      [kind]:
        'error' in outcome
          ? { status: 'error', seed, error: outcome.error }
          : { status: 'done', seed, result: outcome.result },
    }))
  }, [])

  useEffect(() => {
    const instance = getWorker()
    if (!instance) return
    const onMessage = (event: MessageEvent<ExperimentResponse>) => {
      const request = pending.current.get(event.data.id)
      if (!request) return
      pending.current.delete(event.data.id)
      settle(request.kind, request.seed, event.data.ok ? { result: event.data.result } : { error: event.data.error })
    }
    instance.addEventListener('message', onMessage)
    return () => instance.removeEventListener('message', onMessage)
  }, [settle])

  const run = useCallback(
    (kind: ExperimentKind, seed: number) => {
      setExperiments((current) => ({ ...current, [kind]: { status: 'running', seed } }))
      const instance = getWorker()
      if (instance) {
        const id = nextId.current++
        pending.current.set(id, { kind, seed })
        instance.postMessage({ id, kind, seed } satisfies ExperimentRequest)
        return
      }
      // Let the "Running…" state paint before blocking the main thread.
      setTimeout(() => {
        try {
          settle(kind, seed, { result: runExperiment(kind, seed) })
        } catch (error) {
          settle(kind, seed, { error: String(error) })
        }
      }, 30)
    },
    [settle],
  )

  return { experiments, run }
}
