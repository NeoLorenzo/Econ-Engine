import { SKILL_LEVELS, SKILL_LOOKBACK_DAYS, type skillCard } from './valleyViewModel'

const BAR_WIDTH = 200
const BAR_HEIGHT = 14
const SPARK_WIDTH = 200
const SPARK_HEIGHT = 28

/**
 * A person's skills on one scale from the floor to the ceiling no one reaches: a bar for each skill with the level
 * boundaries marked and a faint tick where it stood a month of finished days ago; then each axe technique, and their
 * craft skill over the last season.
 */
export function SkillCard({ card }: { card: ReturnType<typeof skillCard> }) {
  const { floor, max } = card
  const x = (percent: number) => (Math.min(max, Math.max(floor, percent)) - floor) / Math.max(1, max - floor)
  const bounds = SKILL_LEVELS.filter((level) => level.from > floor && level.from < max)
  return (
    <div className="life-skill-card" role="group" aria-label="Skills">
      {card.skills.map((skill) => {
        const change = skill.before === null ? 0 : skill.percent - skill.before
        return (
          <div key={skill.key} className={`life-skill-row is-${skill.key}`}>
            <span className="life-skill-name">
              {skill.label}
              {skill.learns && <span className="life-skill-learns"> · {skill.learns} learner</span>}
            </span>
            <span className="life-skill-value num">
              {skill.percent}% {skill.level}
              {change !== 0 && (
                <span className={change > 0 ? 'is-up' : 'is-down'} title={`Change over ${SKILL_LOOKBACK_DAYS} days`}>
                  {' '}
                  {change > 0 ? '▲' : '▼'}
                  {Math.abs(change)}
                </span>
              )}
            </span>
            <svg
              className="life-skill-bar"
              viewBox={`0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${skill.label} ${skill.percent}%, ${skill.level}`}
            >
              <rect className="track" x={0} y={3} width={BAR_WIDTH} height={BAR_HEIGHT - 6} rx={3} />
              <rect className="fill" x={0} y={3} width={x(skill.percent) * BAR_WIDTH} height={BAR_HEIGHT - 6} rx={3} />
              {bounds.map((level) => (
                <line
                  key={level.name}
                  className="bound"
                  x1={x(level.from) * BAR_WIDTH}
                  x2={x(level.from) * BAR_WIDTH}
                  y1={1}
                  y2={BAR_HEIGHT - 1}
                />
              ))}
              {skill.before !== null && (
                <line
                  className="before"
                  x1={x(skill.before) * BAR_WIDTH}
                  x2={x(skill.before) * BAR_WIDTH}
                  y1={0}
                  y2={BAR_HEIGHT}
                />
              )}
            </svg>
          </div>
        )
      })}
      <ul className="life-technique-list">
        {card.techniques.map((technique) => (
          <li key={technique.name} className={`is-${technique.status}`}>
            <span>{technique.name} axe</span>
            <span className="num">
              {technique.status === 'known'
                ? `${technique.percent}%${technique.attempts > 0 ? `, ${technique.worked} of ${technique.attempts} worked` : ''}`
                : technique.status === 'trying'
                  ? `trying, ${technique.worked} of ${technique.attempts} worked`
                  : technique.status === 'idea'
                    ? 'has the idea'
                    : 'unknown'}
            </span>
          </li>
        ))}
      </ul>
      {card.craft.length > 1 && <CraftSpark values={card.craft} floor={floor} max={max} />}
    </div>
  )
}

/** Craft skill at the end of each finished day of the last season, on the card's scale. */
function CraftSpark({ values, floor, max }: { values: number[]; floor: number; max: number }) {
  const low = Math.max(floor, Math.min(...values) - 5),
    high = Math.min(max, Math.max(...values) + 5)
  const points = values
    .map((value, index) => {
      const px = (index / (values.length - 1)) * SPARK_WIDTH
      const py = SPARK_HEIGHT - 2 - ((value - low) / Math.max(1, high - low)) * (SPARK_HEIGHT - 4)
      return `${px.toFixed(1)},${py.toFixed(1)}`
    })
    .join(' ')
  return (
    <figure className="life-craft-spark">
      <svg
        viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Craft skill over the last ${values.length} days, from ${values[0]}% to ${values.at(-1)}%`}
      >
        <polyline points={points} fill="none" />
      </svg>
      <figcaption className="num">
        Craft over the last {values.length} days: {values[0]}% to {values.at(-1)}%
      </figcaption>
    </figure>
  )
}
