import { useCallback, useState } from 'react'
import { createValley } from '../valley/engine'
import { RunSettingsScreen } from './RunSettingsScreen'
import { configOfSettings, defaultRunSettings, runSettingsError, type RunSettings } from './runSettings'
import ValleyApp from './ValleyApp'
import { startEngine, type EngineLink } from './engineLink'

/** Runs `work` after the browser has painted, so a loading screen shown just before it is on screen meanwhile. */
const afterPaint = (work: () => void) => requestAnimationFrame(() => setTimeout(work, 0))

/** The Life page: the settings screen until Start, then the run those settings began. */
export default function LifePage() {
  const [settings, setSettings] = useState<RunSettings>(defaultRunSettings)
  const [start, setStart] = useState<EngineLink | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const ready = useCallback(() => setLoading(false), [])

  const begin = (next: RunSettings) => {
    setSettings(next)
    setLoading(true)
    afterPaint(() => {
      let started = false
      try {
        const problem = runSettingsError(next)
        setError(problem)
        if (!problem) {
          // The engine's thread builds its own valley meanwhile.
          const config = configOfSettings(next)
          const connect = startEngine(config)
          setStart(connect(createValley(config)))
          started = true
        }
      } finally {
        // A run that started keeps the card until the 3D view has drawn its first frame, so no blank page shows meanwhile.
        if (!started) setLoading(false)
      }
    })
  }

  return (
    <>
      {start ? (
        <ValleyApp
          engine={start}
          onNewRun={() => {
            start.stop()
            setStart(null)
          }}
          onReady={ready}
        />
      ) : (
        <RunSettingsScreen initial={settings} error={error} onStart={begin} />
      )}
      {loading && (
        <div className="life-loading" role="status" aria-live="polite">
          <div className="life-loading-card">
            <span className="life-loading-spinner" aria-hidden="true" />
            <p className="life-loading-title">Generating the valley</p>
            <p className="life-loading-note">
              Terrain, water and routes take about ten seconds to build, and up to a minute or more for a large world.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
