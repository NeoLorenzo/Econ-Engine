import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Icon } from '../components'
import { insetFromPanel, NO_INSET, type ViewInset } from '../world/cameraMath'
import type { PanelId, PanelLayout } from './navigation'

const NARROW_QUERY = '(max-width: 860px)'

/**
 * A section panel over the world: docked on the right, a wide sheet for Experiments, or a bottom sheet on
 * narrow screens. It reports how much of the world it covers so the camera can keep its target in view.
 */
export function Panel({
  id,
  label,
  layout,
  onClose,
  onInset,
  children,
}: {
  id: PanelId
  label: string
  layout: PanelLayout
  onClose: () => void
  onInset: (inset: ViewInset) => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const onInsetRef = useRef(onInset)
  useLayoutEffect(() => {
    onInsetRef.current = onInset
  })

  // Panels are keyed by ID, so this runs each time a panel opens.
  useEffect(() => titleRef.current?.focus({ preventScroll: true }), [])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const narrow = window.matchMedia(NARROW_QUERY)
    const report = () => {
      const { width, height } = panel.getBoundingClientRect()
      onInsetRef.current(insetFromPanel({ width, height }, narrow.matches))
    }
    const observer = new ResizeObserver(report)
    observer.observe(panel)
    narrow.addEventListener('change', report)
    report()
    return () => {
      observer.disconnect()
      narrow.removeEventListener('change', report)
      onInsetRef.current(NO_INSET)
    }
  }, [])

  return (
    <aside ref={panelRef} id={`panel-${id}`} className={`panel panel--${layout}`} aria-labelledby={`panel-title-${id}`}>
      <header className="panel-head">
        <h2 id={`panel-title-${id}`} ref={titleRef} tabIndex={-1}>
          {label}
        </h2>
        <button type="button" className="icon-button" aria-label="Close panel" title="Close (Esc)" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </aside>
  )
}
