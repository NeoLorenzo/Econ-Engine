import { useState } from 'react'
import { createValley } from '../valley/engine'
import { RunSettingsScreen } from './RunSettingsScreen'
import { configOfSettings, defaultRunSettings, runSettingsError, type RunSettings } from './runSettings'
import ValleyApp from './ValleyApp'
import { startDisplay, type Display } from './valleyViewModel'

/** Runs `work` after the browser has painted, so a loading screen shown just before it is on screen meanwhile. */
const afterPaint = (work: () => void) => requestAnimationFrame(() => setTimeout(work, 0))

/** The Life page: the settings screen until Start, then the run those settings began. */
export default function LifePage() {
  const [settings, setSettings] = useState<RunSettings>(defaultRunSettings)
  const [start, setStart] = useState<Display | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const begin = (next: RunSettings) => {
    setSettings(next)
    setLoading(true)
    afterPaint(() => {
      try {
        const problem = runSettingsError(next)
        setError(problem)
        if (!problem) setStart(startDisplay(createValley(configOfSettings(next))))
      } finally {
        setLoading(false)
      }
    })
  }

  return (
    <>
      {start ? (
        <ValleyApp start={start} onNewRun={() => setStart(null)} />
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
