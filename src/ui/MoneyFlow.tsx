import type { MoneyFlows } from './economyModel'
import { moneyWhole } from './format'
import { palette } from './theme'

type Point = [number, number]
interface Edge { key: keyof MoneyFlows; label: string; from: Point; control: Point; to: Point; labelAt: Point; anchor: 'start' | 'middle' | 'end'; color: string }

const NODES = [
  { id: 'households', label: 'Households', center: [96, 110] as Point, color: palette.household },
  { id: 'firms', label: 'Firms', center: [344, 110] as Point, color: palette.firmA },
  { id: 'government', label: 'Government', center: [220, 270] as Point, color: palette.government },
]
const NODE_W = 128
const NODE_H = 52

const EDGES: Edge[] = [
  { key: 'spendingCents', label: 'spent at firms', from: [160, 96], control: [220, 40], to: [280, 96], labelAt: [220, 24], anchor: 'middle', color: palette.household },
  { key: 'wagesCents', label: 'paid in wages', from: [280, 124], control: [220, 168], to: [160, 124], labelAt: [220, 174], anchor: 'middle', color: palette.firmA },
  { key: 'corporateTaxCents', label: 'profit tax', from: [360, 136], control: [362, 244], to: [284, 264], labelAt: [374, 214], anchor: 'start', color: palette.firmA },
  { key: 'wealthTaxCents', label: 'wealth tax', from: [80, 136], control: [80, 252], to: [156, 266], labelAt: [12, 214], anchor: 'start', color: palette.household },
  { key: 'transfersCents', label: 'transfers', from: [192, 244], control: [152, 196], to: [130, 136], labelAt: [190, 216], anchor: 'start', color: palette.government },
]

/**
 * Today's closed money circuit. Line width is proportional to the amount moved,
 * so the day's dominant flows stand out before any number is read.
 */
export function MoneyFlow({ flows, animate }: { flows: MoneyFlows; animate: boolean }) {
  const maximum = Math.max(1, ...EDGES.map(({ key }) => flows[key]))
  const description = EDGES.map(({ key, label }) => `${moneyWhole(flows[key])} ${label}`).join(', ')
  return <svg className={`money-flow${animate ? ' is-animated' : ''}`} viewBox="0 0 440 310" role="img" aria-label={`Today's money flows: ${description}.`}>
    <defs>
      {EDGES.map((edge) => <marker key={edge.key} id={`flow-arrow-${edge.key}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="15" markerHeight="15" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill={edge.color} />
      </marker>)}
    </defs>
    {EDGES.map((edge) => {
      const amount = flows[edge.key]
      const width = amount > 0 ? 1.5 + (amount / maximum) * 7 : 1
      const path = `M${edge.from.join(' ')} Q${edge.control.join(' ')} ${edge.to.join(' ')}`
      return <g key={edge.key} className="flow-edge" opacity={amount > 0 ? 1 : 0.35}>
        <path d={path} fill="none" stroke={edge.color} strokeOpacity={0.22} strokeWidth={width + 4} strokeLinecap="round" />
        <path d={path} fill="none" stroke={edge.color} strokeWidth={width} strokeLinecap="round" className="flow-line" markerEnd={`url(#flow-arrow-${edge.key})`} />
        <text x={edge.labelAt[0]} y={edge.labelAt[1]} textAnchor={edge.anchor} className="flow-label">
          <tspan className="flow-amount">{moneyWhole(amount)}</tspan>
          <tspan x={edge.labelAt[0]} dy="15">{edge.label}</tspan>
        </text>
      </g>
    })}
    {NODES.map((node) => <g key={node.id} className="flow-node">
      <rect x={node.center[0] - NODE_W / 2} y={node.center[1] - NODE_H / 2} width={NODE_W} height={NODE_H} rx={14} fill={palette.surface2} stroke={node.color} strokeOpacity={0.6} />
      <circle cx={node.center[0] - NODE_W / 2 + 18} cy={node.center[1]} r={5} fill={node.color} />
      <text x={node.center[0] - NODE_W / 2 + 32} y={node.center[1] + 5} className="flow-node-label">{node.label}</text>
    </g>)}
  </svg>
}
