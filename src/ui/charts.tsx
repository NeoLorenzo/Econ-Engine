import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { palette } from './theme'

export interface ChartSeries {
  key: string
  name: string
  color: string
  dashed?: boolean
  width?: number
  step?: boolean
}

const axis = {
  stroke: palette.text3,
  tick: { fill: palette.text3, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: palette.border },
}
const tooltipStyle = {
  contentStyle: {
    background: palette.surface2,
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    color: palette.text,
    fontSize: 13,
    boxShadow: '0 12px 32px rgba(0,0,0,.45)',
  },
  labelStyle: { color: palette.text2, marginBottom: 4 },
  itemStyle: { padding: 0 },
  cursor: { stroke: palette.border },
}

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="chart-legend">
      {series.map((item) => (
        <li key={item.key}>
          <i
            style={{ background: item.dashed ? 'transparent' : item.color, borderColor: item.color }}
            className={item.dashed ? 'dashed' : ''}
          />
          {item.name}
        </li>
      ))}
    </ul>
  )
}

export function TimeChart<Row extends { day: number }>({
  data,
  series,
  format,
  height = 220,
  domain,
  reference,
  legend = true,
}: {
  data: Row[]
  series: ChartSeries[]
  format: (value: number) => string
  height?: number
  domain?: [number | 'auto', number | 'auto']
  reference?: { y: number; label: string }
  legend?: boolean
}) {
  return (
    <figure className="chart">
      {legend && <ChartLegend series={series} />}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={palette.grid} vertical={false} />
            <XAxis dataKey="day" {...axis} minTickGap={32} />
            <YAxis
              {...axis}
              width={56}
              tickFormatter={(value) => format(Number(value))}
              domain={domain ?? ['auto', 'auto']}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, name) => [format(Number(value)), name]}
              labelFormatter={(value) => `Day ${value}`}
            />
            {reference && (
              <ReferenceLine
                y={reference.y}
                stroke={palette.text3}
                strokeDasharray="3 4"
                label={{ value: reference.label, fill: palette.text3, fontSize: 11, position: 'insideTopLeft' }}
              />
            )}
            {series.map((item) => (
              <Line
                key={item.key}
                type={item.step ? 'stepAfter' : 'linear'}
                dataKey={item.key}
                name={item.name}
                stroke={item.color}
                strokeWidth={item.width ?? 2}
                strokeDasharray={item.dashed ? '5 4' : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

/** Each firm's share of an industry's sales over time, stacked to 100%. */
export function ShareChart<Row extends { day: number }>({
  data,
  series,
  height = 180,
}: {
  data: Row[]
  series: ChartSeries[]
  height?: number
}) {
  return (
    <figure className="chart">
      <ChartLegend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={palette.grid} vertical={false} />
            <XAxis dataKey="day" {...axis} minTickGap={32} />
            <YAxis
              {...axis}
              width={56}
              domain={[0, 1]}
              ticks={[0, 0.5, 1]}
              tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, name) => [`${(Number(value) * 100).toFixed(0)}%`, name]}
              labelFormatter={(value) => `Day ${value}`}
            />
            {series.map((item) => (
              <Area
                key={item.key}
                type="stepAfter"
                dataKey={item.key}
                name={item.name}
                stackId="share"
                stroke={item.color}
                fill={item.color}
                fillOpacity={0.35}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

/**
 * Every household ranked by cash before redistribution. The shaded area runs from the starting
 * cash to each household's pre-tax cash (above = gained, below = lost); the line is what each
 * holds after tax and transfers. The gap between the two is what Government changed.
 */
export function DistributionChart({
  data,
  startingCents,
  height = 240,
}: {
  data: { rank: number; id: string; before: number; after: number }[]
  startingCents: number
  height?: number
}) {
  const values = data.flatMap(({ before, after }) => [before, after])
  const low = Math.min(startingCents, ...values)
  const high = Math.max(startingCents, ...values)
  const pad = Math.max(100, (high - low) * 0.12)
  const domain: [number, number] = [
    Math.max(0, Math.floor((low - pad) / 500) * 500),
    Math.ceil((high + pad) / 500) * 500,
  ]
  return (
    <figure className="chart">
      <ChartLegend
        series={[
          { key: 'before', name: 'Before tax & transfers', color: palette.household },
          { key: 'after', name: 'After', color: palette.accent },
          { key: 'start', name: `Starting cash`, color: palette.text3, dashed: true },
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} baseValue={startingCents}>
            <CartesianGrid stroke={palette.grid} vertical={false} />
            <XAxis dataKey="rank" {...axis} tick={false} height={6} />
            <YAxis
              {...axis}
              width={56}
              domain={domain}
              allowDataOverflow
              tickFormatter={(value) => `$${(Number(value) / 100).toFixed(0)}`}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, name) => [`$${(Number(value) / 100).toFixed(2)}`, name]}
              labelFormatter={(_, payload) =>
                payload?.[0] ? `Household ${String(payload[0].payload.id).replace('household-', '')}` : ''
              }
            />
            <ReferenceLine y={startingCents} stroke={palette.text3} strokeDasharray="3 4" />
            <Area
              type="stepAfter"
              dataKey="before"
              name="Before"
              baseValue={startingCents}
              stroke={palette.household}
              strokeWidth={1.5}
              fill={palette.household}
              fillOpacity={0.22}
              isAnimationActive={false}
            />
            <Line
              type="stepAfter"
              dataKey="after"
              name="After"
              stroke={palette.accent}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="chart-caption">Households, poorest → richest before redistribution</figcaption>
    </figure>
  )
}
