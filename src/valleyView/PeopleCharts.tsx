import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartLegend, type ChartSeries } from '../ui/charts'
import { palette } from '../ui/theme'

const axis = {
  stroke: palette.text3,
  tick: { fill: palette.text3, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: palette.border },
}
const tooltip = {
  contentStyle: {
    background: palette.surface2,
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    color: palette.text,
    fontSize: 13,
  },
  labelStyle: { color: palette.text2, marginBottom: 4 },
  itemStyle: { padding: 0 },
  cursor: { fill: palette.grid },
}

/**
 * Bars by label, each series in its own stack (bars sharing a stack pile up, separate stacks stand side by side),
 * with faint lines over them for comparison.
 */
export function BarsChart<Row extends { label: string }>({
  data,
  bars,
  lines = [],
  format,
  height = 120,
}: {
  data: Row[]
  bars: (ChartSeries & { stack: string })[]
  lines?: ChartSeries[]
  format: (value: number) => string
  height?: number
}) {
  return (
    <figure className="chart">
      <ChartLegend series={[...bars, ...lines]} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={palette.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} minTickGap={8} />
            <YAxis {...axis} width={40} allowDecimals={false} tickFormatter={(value) => format(Number(value))} />
            <Tooltip {...tooltip} formatter={(value, name) => [format(Number(value)), name]} />
            {bars.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.name}
                stackId={item.stack}
                fill={item.color}
                isAnimationActive={false}
              />
            ))}
            {lines.map((item) => (
              <Line
                key={item.key}
                dataKey={item.key}
                name={item.name}
                type="monotone"
                stroke={item.color}
                strokeOpacity={0.6}
                strokeWidth={item.width ?? 1.5}
                strokeDasharray={item.dashed ? '4 3' : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
