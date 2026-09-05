export interface SimulationScheduler {
  schedule(callback: () => void, delayMs: number): unknown
  cancel(handle: unknown): void
  now(): number
}

const defaultScheduler: SimulationScheduler = {
  schedule: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => performance.now(),
}

interface SimulationRunnerOptions {
  publicationIntervalMs?: number
  scheduler?: SimulationScheduler
}

export class SimulationRunner<State> {
  private state: State
  private readonly stepState: (state: State) => State
  private readonly publishState: (state: State) => void
  private readonly publicationIntervalMs: number
  private readonly scheduler: SimulationScheduler
  private running = false
  private speed = 1
  private pendingHandle: unknown | null = null
  private generation = 0
  private dirty = false
  private lastPublishedAt: number

  constructor(initialState: State, stepState: (state: State) => State, publishState: (state: State) => void, options: SimulationRunnerOptions = {}) {
    this.state = initialState
    this.stepState = stepState
    this.publishState = publishState
    this.publicationIntervalMs = Math.max(0, options.publicationIntervalMs ?? 100)
    this.scheduler = options.scheduler ?? defaultScheduler
    this.lastPublishedAt = this.scheduler.now()
  }

  getState(): State {
    return this.state
  }

  start(speed: number): void {
    this.stop(true)
    this.running = true
    this.speed = Math.max(1, speed)
    const generation = ++this.generation
    this.lastPublishedAt = this.scheduler.now()
    this.scheduleNext(generation)
  }

  stop(publishLatest = true): void {
    if (this.pendingHandle !== null) this.scheduler.cancel(this.pendingHandle)
    this.pendingHandle = null
    this.running = false
    this.generation += 1
    if (publishLatest && this.dirty) this.publishSnapshot()
  }

  reset(nextState: State): void {
    this.stop(false)
    this.state = nextState
    this.dirty = true
    this.publishSnapshot()
  }

  stepOnce(): void {
    this.state = this.stepState(this.state)
    this.dirty = true
    this.publishSnapshot()
  }

  destroy(): void {
    this.stop(false)
  }

  private scheduleNext(generation: number): void {
    const delayMs = 1000 / this.speed
    this.pendingHandle = this.scheduler.schedule(() => {
      this.pendingHandle = null
      if (!this.running || generation !== this.generation) return

      this.state = this.stepState(this.state)
      this.dirty = true
      if (this.scheduler.now() - this.lastPublishedAt >= this.publicationIntervalMs) this.publishSnapshot()
      this.scheduleNext(generation)
    }, delayMs)
  }

  private publishSnapshot(): void {
    this.publishState(this.state)
    this.dirty = false
    this.lastPublishedAt = this.scheduler.now()
  }
}
