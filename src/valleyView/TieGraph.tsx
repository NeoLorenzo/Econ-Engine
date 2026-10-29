import { useState } from 'react'
import { palette } from '../ui/theme'
import { foragerName } from './display'
import { CLOSE_TIE_MINUTES, formatMinutes, type tieGraph } from './valleyViewModel'

const SIZE = 300
const CENTRE = SIZE / 2
const RADIUS = 128

/** How warm a link is drawn: green with no grievance, through amber, to red as grievance nears the time together. */
function linkColor(familiarity: number, grievance: number) {
  if (grievance <= 0) return palette.positive
  return grievance * 4 < familiarity ? palette.warning : palette.negative
}

/**
 * Everyone alive round a circle, a group's members side by side in its colour, and a line for each pair who know each
 * other: thicker and brighter for more time together, warmer for grievance. The followed forager's ties stand out.
 */
export function TieGraph({
  graph,
  followed,
  onFollow,
}: {
  graph: ReturnType<typeof tieGraph>
  followed: number
  onFollow: (id: number) => void
}) {
  const [closeOnly, setCloseOnly] = useState(false)
  const spots = new Map(
    graph.people.map((person, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(1, graph.people.length)
      return [person.id, { x: CENTRE + RADIUS * Math.cos(angle), y: CENTRE + RADIUS * Math.sin(angle) }]
    }),
  )
  const most = Math.max(1, ...graph.links.map((link) => link.familiarity))
  const strength = (familiarity: number) => Math.log1p(familiarity / 60) / Math.log1p(most / 60)
  const shown = graph.links
    .filter((link) => !closeOnly || link.familiarity >= CLOSE_TIE_MINUTES)
    // Stronger links over weaker ones, and the followed forager's over everyone else's.
    .sort(
      (x, y) =>
        Number(x.a === followed || x.b === followed) - Number(y.a === followed || y.b === followed) ||
        x.familiarity - y.familiarity,
    )
  const anyFollowed = graph.people.some((person) => person.id === followed)
  return (
    <figure className="life-scatter life-tie-graph">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Who knows whom, and on what terms">
        {shown.map((link) => {
          const from = spots.get(link.a)!
          const to = spots.get(link.b)!
          const mine = link.a === followed || link.b === followed
          const level = strength(link.familiarity)
          // Curved towards the middle, so links between neighbours stay apart from the circle.
          const bend = { x: (from.x + to.x) / 4 + CENTRE / 2, y: (from.y + to.y) / 4 + CENTRE / 2 }
          return (
            <path
              key={`${link.a}-${link.b}`}
              d={`M${from.x},${from.y} Q${bend.x},${bend.y} ${to.x},${to.y}`}
              fill="none"
              stroke={linkColor(link.familiarity, link.grievance)}
              strokeWidth={0.4 + 2.6 * level}
              strokeOpacity={anyFollowed && !mine ? 0.12 + 0.35 * level : 0.35 + 0.6 * level}
            >
              <title>
                {foragerName(link.a)} and {foragerName(link.b)}: {formatMinutes(link.familiarity)} together
                {link.grievance > 0 && `, a grievance of ${formatMinutes(link.grievance)}`}
              </title>
            </path>
          )
        })}
        {graph.people.map((person) => {
          const spot = spots.get(person.id)!
          const isFollowed = person.id === followed
          return (
            <circle
              key={person.id}
              className="dot"
              cx={spot.x}
              cy={spot.y}
              r={isFollowed ? 6 : 4.5}
              fill={person.color}
              stroke={isFollowed ? 'var(--accent)' : 'var(--surface)'}
              strokeWidth={isFollowed ? 2.5 : 1}
              onClick={() => onFollow(person.id)}
            >
              <title>{foragerName(person.id)}</title>
            </circle>
          )
        })}
      </svg>
      <figcaption>
        {graph.links.length} pairs know each other, {graph.close} closely (a day together or more), {graph.aggrieved}{' '}
        with a grievance. Thicker lines: more time together. Green: no grievance; amber, red: growing grievance. Dots
        are coloured by group (grey: none); click one to follow them.
      </figcaption>
      <label className="life-switch-inline">
        <input type="checkbox" checked={closeOnly} onChange={(change) => setCloseOnly(change.currentTarget.checked)} />
        Close ties only
      </label>
    </figure>
  )
}
