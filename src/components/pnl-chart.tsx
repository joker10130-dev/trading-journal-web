import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type PnlPoint = {
  time: string
  pnl: number
}

type PnlChartProps = {
  data: PnlPoint[]
  formatMoney: (value: number) => string
}

function PnlChart({ data, formatMoney }: PnlChartProps) {
  const color = (data.at(-1)?.pnl ?? 0) < 0 ? '#ff5d6c' : '#2ecc8f'

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.16} />
            <stop offset="95%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#2a3550" strokeDasharray="5 5" />
        <ReferenceLine y={0} stroke="#34415d" strokeDasharray="4 5" />
        <XAxis dataKey="time" tick={false} tickLine={false} axisLine={false} />
        <YAxis tick={false} tickLine={false} axisLine={false} width={8} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #35415c', background: '#1d2639', color: '#e6eaf3', fontSize: 14 }}
          formatter={(value) => [formatMoney(Number(value)), 'Running P&L']}
        />
        <Area type="monotone" dataKey="pnl" stroke={color} strokeWidth={2} fill="url(#pnlFill)" activeDot={{ r: 4, fill: color, stroke: '#1d2639', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default PnlChart
