import { useId, type ReactNode } from 'react'
import { palette } from './theme'

type IconName =
  'play' | 'pause' | 'step' | 'restart' | 'settings' | 'close' | 'camera' | 'help' | 'check' | 'search' | 'arrow'

const ICON_PATHS: Record<IconName, ReactNode> = {
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  step: (
    <>
      <path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none" />
      <path d="M18 5v14" />
    </>
  ),
  restart: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  camera: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4" />
      <circle cx="12" cy="17" r=".6" fill="currentColor" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
}

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

/** Small "?" that reveals an explanation on hover or keyboard focus, keeping methodology out of the main flow. */
export function InfoTip({ children, label = 'More information' }: { children: ReactNode; label?: string }) {
  const id = useId()
  return (
    <span className="infotip">
      <button type="button" className="infotip-trigger" aria-label={label} aria-describedby={id}>
        <Icon name="help" size={14} />
      </button>
      <span role="tooltip" id={id} className="infotip-bubble">
        {children}
      </span>
    </span>
  )
}

export function Sparkline({
  values,
  color = palette.text2,
  height = 32,
  baseline,
}: {
  values: number[]
  color?: string
  height?: number
  baseline?: number
}) {
  if (values.length < 2) return <svg className="sparkline" height={height} aria-hidden="true" />
  const min = Math.min(...values, baseline ?? Infinity)
  const max = Math.max(...values, baseline ?? -Infinity)
  const span = max - min || 1
  const width = 100
  const y = (value: number) => height - 2 - ((value - min) / span) * (height - 4)
  const points = values.map((value, index) => `${(index / (values.length - 1)) * width},${y(value)}`).join(' ')
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      height={height}
      aria-hidden="true"
    >
      {baseline !== undefined && (
        <line
          x1="0"
          x2={width}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke={palette.border}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Several series on one shared scale, so their relative levels stay honest. */
export function MultiSparkline({
  series,
  height = 28,
  label,
}: {
  series: { values: number[]; color: string }[]
  height?: number
  label?: string
}) {
  const all = series.flatMap(({ values }) => values)
  if (series.every(({ values }) => values.length < 2))
    return <svg className="sparkline" height={height} aria-hidden="true" />
  const min = Math.min(...all)
  const span = Math.max(...all) - min || 1
  const width = 100
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      height={height}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {series.map(({ values, color }, index) => (
        <polyline
          key={index}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          points={values
            .map(
              (value, step) =>
                `${(step / Math.max(1, values.length - 1)) * width},${height - 2 - ((value - min) / span) * (height - 4)}`,
            )
            .join(' ')}
        />
      ))}
    </svg>
  )
}

export function Stat({
  label,
  value,
  detail,
  info,
  spark,
  sparkColor,
  tone,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  info?: ReactNode
  spark?: number[]
  sparkColor?: string
  tone?: 'positive' | 'warning' | 'negative'
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <div className="stat-label">
        {label}
        {info && <InfoTip label={`About ${label}`}>{info}</InfoTip>}
      </div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
      {spark && <Sparkline values={spark} color={sparkColor} />}
    </div>
  )
}

export function Section({
  title,
  subtitle,
  info,
  actions,
  children,
  className = '',
  id,
}: {
  title: ReactNode
  subtitle?: ReactNode
  info?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section className={`card ${className}`} aria-labelledby={id}>
      <header className="card-head">
        <div>
          <h2 id={id}>
            {title}
            {info && <InfoTip label="About this view">{info}</InfoTip>}
          </h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: { id: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={`segmented segmented--${size}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button type="button" key={option.id} aria-pressed={option.id === value} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Firm A / Firm B split of today's sales. */
export function ShareBar({ a, b, label }: { a: number; b: number; label?: string }) {
  const total = a + b
  const aShare = total ? a / total : 0.5
  return (
    <div
      className="sharebar"
      role="img"
      aria-label={label ?? `Firm A ${Math.round(aShare * 100)}%, Firm B ${Math.round((1 - aShare) * 100)}%`}
    >
      <span className="sharebar-a" style={{ width: `${aShare * 100}%` }} />
      <span className="sharebar-b" style={{ width: `${(1 - aShare) * 100}%` }} />
    </div>
  )
}

export function FirmDot({ variant }: { variant: 'a' | 'b' | null }) {
  return <i className={`firm-dot firm-dot--${variant ?? 'none'}`} aria-hidden="true" />
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}
