export type TradeSource = 'IMPORT' | 'MANUAL'
export type RSource = 'MANUAL' | 'NONE'

export type Trade = {
  id: string
  ticket: string
  source: TradeSource
  symbol: string
  side: 'LONG' | 'SHORT'
  size: number
  entry: number
  exit: number
  profit: number
  swaps: number
  commission: number
  pnl: number
  r: number | null
  rSource: RSource
  opened: string | null
  closed: string
  closes: number
  comment: string
  tags: string[]
  notes: string
}

export function netPnl(profit: number, swaps: number, commission: number) {
  return profit + swaps + commission
}

export function parseManualR(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function rSourceFor(value: number | null): RSource {
  return value === null ? 'NONE' : 'MANUAL'
}
