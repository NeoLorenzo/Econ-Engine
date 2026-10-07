import { useCallback, useRef, useState } from 'react'
import {
  ensembleSeeds,
  summarizeEnsemble,
  type EnsembleKind,
  type EnsembleResult,
  type EnsembleSeedMetrics,
} from '../sim/ensemble'
import { runRequest, type ExperimentRequest, type ExperimentResponse } from './experimentRunner'

export type { EnsembleKind, EnsembleResult } from '../sim/ensemble'

export const ENSEMBLE_HORIZON_DAYS = 1_000
export const ENSEMBLE_SIZES = [4, 8, 16] as const
export type EnsembleSize = (typeof ENSEMBLE_SIZES)[number]

type Entry<K extends EnsembleKind> =
  | { status: 'running'; base: number; seeds: number[]; done: number }
  | { status: 'done'; base: number; result: EnsembleResult<K> }
  | { status: 'error'; base: number; seeds: number[]; error: string }
export type EnsembleState = { [K in EnsembleKind]?: Entry<K> }
/** A result of any ensemble kind, for views that render every kind the same way. */
export type AnyEnsembleResult = { [K in EnsembleKind]: EnsembleResult<K> }[EnsembleKind]

type Job = { request: ExperimentRequest; resolve: (result: unknown) => void; reject: (error: Error) => void }

/**
 * A few Web Workers that take one seed at a time, so an ensemble's seeds run in parallel off the main thread.
 * Without Worker support, jobs run on the main thread one by one, yielding between seeds so progress can paint.
 */
class WorkerPool {
  private idle: Worker[] = []
  private queue: Job[] = []
  private running = new Map<number, Job>()
  private readonly available: boolean
  private created = 0
  private readonly size: number

  constructor() {
    this.available = typeof Worker !== 'undefined'
    const cores = typeof navigator === 'undefined' ? 2 : (navigator.hardwareConcurrency ?? 2)
    this.size = Math.max(1, Math.min(4, cores - 1))
  }

  run(request: ExperimentRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject })
      this.dispatch()
    })
  }

  private dispatch() {
    if (!this.available) {
      const job = this.queue.shift()
      if (!job) return
      setTimeout(() => {
        try {
          job.resolve(runRequest(job.request))
        } catch (error) {
          job.reject(error instanceof Error ? error : new Error(String(error)))
        }
        this.dispatch()
      }, 0)
      return
    }
    while (this.queue.length > 0) {
      const worker = this.idle.pop() ?? this.spawn()
      if (!worker) return
      const job = this.queue.shift()!
      this.running.set(job.request.id, job)
      worker.postMessage(job.request)
    }
  }

  private spawn(): Worker | null {
    if (this.created >= this.size) return null
    this.created += 1
    const worker = new Worker(new URL('./experiments.worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', (event: MessageEvent<ExperimentResponse>) => {
      const job = this.running.get(event.data.id)
      this.running.delete(event.data.id)
      this.idle.push(worker)
      if (job) {
        if (event.data.ok) job.resolve(event.data.result)
        else job.reject(new Error(event.data.error))
      }
      this.dispatch()
    })
    return worker
  }
}

let pool: WorkerPool | undefined
let nextId = 1

/** Runs multi-seed ensembles on demand and tracks their progress. Never touches the live simulation. */
export function useEnsembles() {
  const [ensembles, setEnsembles] = useState<EnsembleState>({})
  // Guards against a slow, superseded run overwriting a newer one of the same kind.
  const generation = useRef<Partial<Record<EnsembleKind, number>>>({})

  const run = useCallback((kind: EnsembleKind, base: number, size: EnsembleSize) => {
    const seeds = ensembleSeeds(base, size)
    const runId = (generation.current[kind] ?? 0) + 1
    generation.current[kind] = runId
    const current = () => generation.current[kind] === runId
    setEnsembles((state) => ({ ...state, [kind]: { status: 'running', base, seeds, done: 0 } }))
    pool ??= new WorkerPool()
    const workers = pool
    const perSeed: { seed: number; metrics: EnsembleSeedMetrics<typeof kind> }[] = []
    Promise.all(
      seeds.map((seed) =>
        workers
          .run({ id: nextId++, task: 'ensembleSeed', kind, seed, horizonDays: ENSEMBLE_HORIZON_DAYS })
          .then((metrics) => {
            perSeed.push({ seed, metrics: metrics as EnsembleSeedMetrics<typeof kind> })
            if (current())
              setEnsembles((state) => {
                const entry = state[kind]
                return entry?.status === 'running' ? { ...state, [kind]: { ...entry, done: perSeed.length } } : state
              })
          }),
      ),
    )
      .then(() => {
        if (!current()) return
        const result = summarizeEnsemble(kind, ENSEMBLE_HORIZON_DAYS, perSeed)
        setEnsembles((state) => ({ ...state, [kind]: { status: 'done', base, result } }))
      })
      .catch((error: unknown) => {
        if (!current()) return
        setEnsembles((state) => ({ ...state, [kind]: { status: 'error', base, seeds, error: String(error) } }))
      })
  }, [])

  return { ensembles, run }
}
