import { useEffect, type RefObject } from 'react'

/** Publishes an element's rendered height as a CSS variable on the document, so overlays can sit below it. */
export function useHeightVar(ref: RefObject<HTMLElement | null>, name: `--${string}`) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const root = document.documentElement
    const observer = new ResizeObserver(() =>
      root.style.setProperty(name, `${Math.ceil(element.getBoundingClientRect().height)}px`),
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty(name)
    }
  }, [ref, name])
}
