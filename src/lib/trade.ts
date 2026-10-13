export type TradeSource = 'IMPORT' | 'MANUAL'
export type RiskSource = 'TRADINGVIEW' | 'MANUAL' | null

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
  risk: number | null
  initialSlPrice: number | null
  riskSource: RiskSource
  r: number | null
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

export function riskFromStopLoss(profit: number, entry: number, exit: number, stopLoss: number) {
  const priceDifference = Math.abs(exit - entry)
  if (priceDifference === 0) return null
  const valuePerPriceUnit = Math.abs(profit) / priceDifference
  return valuePerPriceUnit * Math.abs(entry - stopLoss)
}

export function rMultiple(pnl: number, risk: number | null) {
  return risk !== null && risk > 0 ? pnl / risk : null
}
