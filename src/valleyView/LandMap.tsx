import { useEffect, useMemo, useRef } from 'react'
import type { ValleyState } from '../valley/types'
import { groupColor } from './valleyViewModel'

/** The map's colours for grass, dirt and stone, by ground code. */
const MAP_GROUND = [
  [79, 122, 66],
  [120, 91, 59],
  [133, 130, 122],
]
const MAP_SIZE = 180

/** The whole land, drawn once: each pixel coloured by its ground and shaded by its height and the slope facing north-west. */
function landImage(layout: ValleyState['layout']) {
  const { terrain, ground } = layout
  const { cells, height } = terrain
  const points = cells + 1
  const image = new ImageData(MAP_SIZE, MAP_SIZE)
  let highest = 1
  for (const h of height) highest = Math.max(highest, h)
  for (let py = 0; py < MAP_SIZE; py += 1)
    for (let px = 0; px < MAP_SIZE; px += 1) {
      const i = Math.min(cells - 1, Math.floor((px * cells) / MAP_SIZE))
      const j = Math.min(cells - 1, Math.floor((py * cells) / MAP_SIZE))
      const h = height[j * points + i]!
      const slope = (height[(j + 1) * points + i + 1]! - h) / terrain.cellCm
      const light = Math.max(0.55, Math.min(1.35, 0.75 + (0.45 * h) / highest - 4 * slope))
      const colour = MAP_GROUND[ground[j * cells + i]!]!
      const at = (py * MAP_SIZE + px) * 4
      image.data[at] = colour[0]! * light
      image.data[at + 1] = colour[1]! * light
      image.data[at + 2] = colour[2]! * light
      image.data[at + 3] = 255
    }
  return image
}

/**
 * A small map of the whole land in a corner: its ground and relief, the lake along its north edge, every living
 * forager and standing flag, and the part the camera looks at. Clicking it moves the camera there.
 */
export function LandMap({
  state,
  view,
  onPick,
}: {
  state: ValleyState
  view: { x: number; y: number; distanceCm: number } | null
  onPick: (x: number, y: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const layout = state.layout
  const image = useMemo(() => landImage(layout), [layout])
  const size = state.config.valleySizeCm
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    context.putImageData(image, 0, 0)
    const scale = MAP_SIZE / size
    context.fillStyle = 'rgb(46, 93, 120)'
    context.fillRect(0, 0, MAP_SIZE, 2)
    for (const group of state.groups) {
      if (group.dissolvedMinute !== null) continue
      context.fillStyle = groupColor(group.id)
      context.fillRect(group.flag.x * scale - 3, group.flag.y * scale - 3, 6, 6)
    }
    for (const forager of state.foragers) {
      if (!forager.alive) continue
      context.fillStyle = '#ffffff'
      context.beginPath()
      context.arc(forager.x * scale, forager.y * scale, 2, 0, Math.PI * 2)
      context.fill()
    }
    if (view) {
      // About what the camera shows: a square as wide as twice its distance.
      const half = Math.max(3, view.distanceCm * scale)
      context.strokeStyle = 'rgba(255, 240, 160, 0.9)'
      context.lineWidth = 1.5
      context.strokeRect(view.x * scale - half, view.y * scale - half, 2 * half, 2 * half)
    }
  }, [image, state, view, size])
  return (
    <canvas
      ref={canvas}
      className="life-map"
      width={MAP_SIZE}
      height={MAP_SIZE}
      aria-label="Map of the land"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onPick(
          Math.round(((event.clientX - rect.left) / rect.width) * size),
          Math.round(((event.clientY - rect.top) / rect.height) * size),
        )
      }}
    />
  )
}
