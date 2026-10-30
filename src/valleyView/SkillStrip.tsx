import { foragerName } from './display'
import { SKILL_LEVELS, type skillStrip } from './valleyViewModel'

const WIDTH = 300
const LEFT = 58
const RIGHT = 8
const ROW = 46
const TOP = 6
const AXIS = 22
const DOT = 3.2

/**
 * Lanes for dots on one row so none overlap: in order of skill, each dot takes the lane nearest the row's line, below
 * it then above, where the last dot placed is at least a dot's width to its left. A crowded row squeezes its lanes
 * together so the dots stay inside it.
 */
function lanes(xs: number[]) {
  const order = xs.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value || a.index - b.index)
  const lastInLane = new Map<number, number>()
  const lane = xs.map(() => 0)
  for (const { value, index } of order) {
    for (let step = 0; ; step += 1) {
      const candidate = step === 0 ? 0 : step % 2 === 1 ? (step + 1) / 2 : -step / 2
      const last = lastInLane.get(candidate)
      if (last === undefined || value - last >= 2 * DOT + 0.6) {
        lastInLane.set(candidate, value)
        lane[index] = candidate
        break
      }
    }
  }
  return lane
}

/**
 * The band's skills as three rows on one scale from the floor to the ceiling no one reaches, with the levels marked:
 * each living person a dot coloured by group, the followed person outlined and a ring for anyone who knows a better
 * axe. Click a dot to follow them.
 */
export function SkillStrip({
  strip,
  followed,
  onFollow,
}: {
  strip: ReturnType<typeof skillStrip>
  followed: number
  onFollow: (id: number) => void
}) {
  const { floor, max, rows } = strip
  const x = (percent: number) =>
    LEFT + ((Math.min(max, Math.max(floor, percent)) - floor) / Math.max(1, max - floor)) * (WIDTH - LEFT - RIGHT)
  const bounds = SKILL_LEVELS.filter((level) => level.from > floor && level.from < max)
  const height = TOP + rows.length * ROW + AXIS
  return (
    <figure className="life-scatter life-skill-strip">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Everyone alive placed by each of their skills">
        {bounds.map((level) => (
          <g key={level.name}>
            <line className="grid" x1={x(level.from)} x2={x(level.from)} y1={TOP} y2={TOP + rows.length * ROW} />
            <text className="tick" x={x(level.from)} y={TOP + rows.length * ROW + 10} textAnchor="middle">
              {level.from}
            </text>
            <text className="tick level" x={x(level.from)} y={TOP + rows.length * ROW + 19} textAnchor="middle">
              {level.name}
            </text>
          </g>
        ))}
        {rows.map((row, r) => {
          const centre = TOP + r * ROW + ROW / 2
          const xs = row.people.map((person) => x(person.percent))
          const lane = lanes(xs)
          const widest = Math.max(1, ...lane.map(Math.abs))
          const spacing = Math.min(2 * DOT + 0.6, (ROW / 2 - DOT - 2) / widest)
          const sorted = [...row.people.keys()].sort(
            (a, b) => Number(row.people[a]!.id === followed) - Number(row.people[b]!.id === followed),
          )
          const median = row.people.map((person) => person.percent).sort((a, b) => a - b)[
            Math.floor(row.people.length / 2)
          ]
          return (
            <g key={row.label}>
              <text className="corner" x={0} y={centre + 4}>
                {row.label}
              </text>
              <line className="axis" x1={LEFT} x2={WIDTH - RIGHT} y1={centre} y2={centre} />
              {median !== undefined && (
                <line
                  className="median"
                  x1={x(median)}
                  x2={x(median)}
                  y1={centre - ROW / 2 + 3}
                  y2={centre + ROW / 2 - 3}
                >
                  <title>Middle of the band: {median}%</title>
                </line>
              )}
              {sorted.map((index) => {
                const person = row.people[index]!
                const isFollowed = person.id === followed
                const cy = centre + lane[index]! * spacing
                return (
                  <g key={person.id}>
                    {person.better && (
                      <circle className="ring" cx={xs[index]} cy={cy} r={DOT + 2} fill="none" stroke={person.color} />
                    )}
                    <circle
                      className="dot"
                      cx={xs[index]}
                      cy={cy}
                      r={isFollowed ? DOT + 1 : DOT}
                      fill={person.color}
                      fillOpacity={0.85}
                      stroke={isFollowed ? 'var(--accent)' : person.color}
                      strokeWidth={isFollowed ? 2 : 0.8}
                      onClick={() => onFollow(person.id)}
                    >
                      <title>
                        {foragerName(person.id)}: {row.label.toLowerCase()} {person.percent}%, {person.level}
                        {person.better && ', knows a better axe'}
                      </title>
                    </circle>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      <figcaption>
        Everyone alive by each skill, from the floor of 50% to the ceiling no one reaches, coloured by group (grey:
        none). The upright line marks the middle of the band; a ring marks someone who knows the tranchet or ground axe.
        Click a dot to follow them.
      </figcaption>
    </figure>
  )
}
