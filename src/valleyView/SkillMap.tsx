import { foragerName } from './display'
import type { skillMapPoints } from './valleyViewModel'

const SIZE = 300
const CENTRE = SIZE / 2
const RADIUS = 112

/** The corners, one per skill, starting at the top and going clockwise. */
const corner = (index: number, count: number) => {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  return { x: CENTRE + RADIUS * Math.cos(angle), y: CENTRE + RADIUS * Math.sin(angle) }
}

/**
 * Each forager as a point pulled towards each skill's corner by where they stand in it among the living, from the
 * least skilled to the most: someone in the same place in every skill sits in the middle, a specialist near their
 * corner. Because the middle holds the equally good and the equally poor alike, the dot's size shows how skilled they
 * are overall, as a share of the most anyone could reach.
 */
export function SkillMap({
  points,
  followed,
  onFollow,
}: {
  points: ReturnType<typeof skillMapPoints>
  followed: number
  onFollow: (id: number) => void
}) {
  const labels = points[0]?.skills ?? []
  const corners = labels.map((_, index) => corner(index, labels.length))
  // Each skill's range among the living, so a skill everyone has alike pulls nobody.
  const living = points.filter((person) => person.alive)
  const ranges = labels.map((_, index) => {
    const percents = living.map((person) => person.skills[index]!.percent)
    return { low: Math.min(...percents), high: Math.max(...percents) }
  })
  const standing = (index: number, percent: number) => {
    const { low, high } = ranges[index]!
    return high > low ? Math.min(1, Math.max(0, (percent - low) / (high - low))) : 0.5
  }
  const place = (shares: number[]) => {
    const total = shares.reduce((sum, share) => sum + share, 0)
    if (!total) return { x: CENTRE, y: CENTRE }
    return {
      x: shares.reduce((sum, share, index) => sum + share * corners[index]!.x, 0) / total,
      y: shares.reduce((sum, share, index) => sum + share * corners[index]!.y, 0) / total,
    }
  }
  // The followed forager is drawn last, on top.
  const ordered = [...points].sort((a, b) => Number(a.id === followed) - Number(b.id === followed))
  return (
    <figure className="life-scatter life-skill-map">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Each forager placed by the mix of their skills">
        <polygon className="axis" points={corners.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" />
        {corners.map((point, index) => (
          <line key={index} className="grid" x1={CENTRE} y1={CENTRE} x2={point.x} y2={point.y} />
        ))}
        {labels.map((skill, index) => {
          const point = corners[index]!
          const below = point.y > CENTRE
          return (
            <text
              key={skill.key}
              className="corner"
              x={point.x}
              y={point.y + (below ? 16 : -8)}
              textAnchor={point.x < CENTRE - 1 ? 'start' : point.x > CENTRE + 1 ? 'end' : 'middle'}
            >
              {skill.label}
            </text>
          )
        })}
        {ordered.map((person) => {
          const spot = place(person.skills.map((skill, index) => standing(index, skill.percent)))
          const level = person.skills.reduce((sum, skill) => sum + skill.share, 0) / Math.max(1, person.skills.length)
          const isFollowed = person.id === followed
          return (
            <circle
              key={person.id}
              className="dot"
              cx={spot.x}
              cy={spot.y}
              r={2.5 + 6 * level}
              fill={person.alive ? person.color : 'none'}
              fillOpacity={0.85}
              stroke={isFollowed ? 'var(--accent)' : person.color}
              strokeWidth={isFollowed ? 2.5 : 1}
              onClick={() => onFollow(person.id)}
            >
              <title>
                {foragerName(person.id)}
                {!person.alive && ' (dead)'}:{' '}
                {person.skills.map((skill) => `${skill.label.toLowerCase()} ${skill.percent}%`).join(', ')}
              </title>
            </circle>
          )
        })}
      </svg>
      <figcaption>
        Each forager pulled towards the skills they are best at compared with everyone else, coloured by group (grey:
        none, hollow: dead). Larger dots are more skilled overall. Click one to follow them.
      </figcaption>
    </figure>
  )
}
