import { describe, expect, it } from 'vitest'
import { createSimulation, stepSimulation } from './engine'
import { SimulationRunner, type SimulationScheduler } from './simulationRunner'

type ScheduledTask = { id: number; callback: () => void; delayMs: number; cancelled: boolean }

class ManualScheduler implements SimulationScheduler {
  private nextId = 1
  private timeMs = 0
  private tasks: ScheduledTask[] = []

  schedule(callback: () => void, delayMs: number): unknown {
    const task = { id: this.nextId++, callback, delayMs, cancelled: false }
    this.tasks.push(task)
    return task.id
  }

  cancel(handle: unknown): void {
    const task = this.tasks.find(({ id }) => id === handle)
    if (task) task.cancelled = true
  }

  now(): number {
    return this.timeMs
  }

  runNext(): boolean {
    while (this.tasks.length) {
      const task = this.tasks.shift()!
      if (task.cancelled) continue
      this.timeMs += task.delayMs
      task.callback()
      return true
    }
    return false
  }

  run(count: number): void {
    for (let index = 0; index < count; index += 1) expect(this.runNext()).toBe(true)
  }

  runRemaining(limit = 100): void {
    for (let index = 0; index < limit && this.runNext(); index += 1) {
      // Drain scheduled work up to the supplied safety limit.
    }
  }

  activeCount(): number {
    return this.tasks.filter(({ cancelled }) => !cancelled).length
  }
}

describe('SimulationRunner', () => {
  it('matches direct sequential simulation state after the same number of completed days', () => {
    const scheduler = new ManualScheduler()
    const runner = new SimulationRunner(createSimulation(), stepSimulation, () => {}, { scheduler })
    let direct = createSimulation()

    runner.start(100)
    scheduler.run(25)
    runner.stop()
    for (let index = 0; index < 25; index += 1) direct = stepSimulation(direct)

    expect(runner.getState()).toEqual(direct)
  })

  it('publishes fewer observer snapshots than simulation days at fast speed', () => {
    const scheduler = new ManualScheduler()
    const publishedDays: number[] = []
    const runner = new SimulationRunner(createSimulation(), stepSimulation, (state) => publishedDays.push(state.day), { scheduler, publicationIntervalMs: 100 })

    runner.start(100)
    scheduler.run(20)
    runner.stop()

    expect(publishedDays).toEqual([10, 20])
    expect(publishedDays.length).toBeLessThan(20)
  })

  it('cancels future scheduled work when paused', () => {
    const scheduler = new ManualScheduler()
    const runner = new SimulationRunner(createSimulation(), stepSimulation, () => {}, { scheduler })

    runner.start(100)
    scheduler.run(3)
    runner.stop()
    const pausedDay = runner.getState().day
    scheduler.runRemaining()

    expect(runner.getState().day).toBe(pausedDay)
    expect(scheduler.activeCount()).toBe(0)
  })

  it('replaces the execution schedule when speed changes instead of overlapping timers', () => {
    const scheduler = new ManualScheduler()
    const runner = new SimulationRunner(createSimulation(), stepSimulation, () => {}, { scheduler })

    runner.start(5)
    expect(scheduler.activeCount()).toBe(1)
    runner.start(100)
    expect(scheduler.activeCount()).toBe(1)
    scheduler.run(1)

    expect(runner.getState().day).toBe(1)
  })

  it('reset replaces authoritative and published state and cancels pending work', () => {
    const scheduler = new ManualScheduler()
    const publishedSeeds: number[] = []
    const runner = new SimulationRunner(createSimulation(), stepSimulation, (state) => publishedSeeds.push(state.config.seed ?? 0), { scheduler })
    const resetState = createSimulation({ seed: 42 })

    runner.start(100)
    scheduler.run(4)
    runner.reset(resetState)
    scheduler.runRemaining()

    expect(runner.getState()).toEqual(resetState)
    expect(publishedSeeds.at(-1)).toBe(42)
    expect(scheduler.activeCount()).toBe(0)
  })

  it('produces the same final state under different publication cadences', () => {
    const fastScheduler = new ManualScheduler()
    const slowScheduler = new ManualScheduler()
    const initialFast = createSimulation({ seed: 7 })
    const initialSlow = createSimulation({ seed: 7 })
    const fastPublishing = new SimulationRunner(initialFast, stepSimulation, () => {}, { scheduler: fastScheduler, publicationIntervalMs: 20 })
    const slowPublishing = new SimulationRunner(initialSlow, stepSimulation, () => {}, { scheduler: slowScheduler, publicationIntervalMs: 250 })

    fastPublishing.start(100)
    slowPublishing.start(100)
    fastScheduler.run(30)
    slowScheduler.run(30)
    fastPublishing.stop()
    slowPublishing.stop()

    expect(fastPublishing.getState()).toEqual(slowPublishing.getState())
  })
})
