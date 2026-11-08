export type DashboardPeriod = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_QUARTER' | 'LAST_YEAR' | 'ETERNAL'

export type DashboardDailyTotal = {
  date: string
  tradeCount: number
  tradesWithR: number
  netPnl: number
  totalR: number
}

export type DashboardSummary = {
  period: DashboardPeriod
  startDate: string
  endDate: string
  tradeCount: number
  tradesWithR: number
  tradesWithoutR: number
  flaggedTradeCount: number
  netPnl: number
  totalR: number
  wins: number
  smalls: number
  losses: number
  dailyStreak: number
  daily: DashboardDailyTotal[]
  cumulative: { date: string; cumulativeNetPnl: number }[]
  weekly: { startDate: string; endDate: string; tradeCount: number; netPnl: number }[]
  availableSymbols: string[]
}

export type DashboardQuery = {
  period: DashboardPeriod
  accountIds: number[]
  symbols?: string[]
}

export class DashboardRequestError extends Error {
  readonly status: number

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'DashboardRequestError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDashboardDailyTotal(value: unknown): value is DashboardDailyTotal {
  if (!isRecord(value)) return false
  return typeof value.date === 'string'
    && typeof value.tradeCount === 'number'
    && typeof value.tradesWithR === 'number'
    && typeof value.netPnl === 'number'
    && typeof value.totalR === 'number'
}

function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (!isRecord(value)) return false
  return (value.period === 'THIS_MONTH'
      || value.period === 'LAST_MONTH'
      || value.period === 'LAST_QUARTER'
      || value.period === 'LAST_YEAR'
      || value.period === 'ETERNAL')
    && typeof value.startDate === 'string'
    && typeof value.endDate === 'string'
    && typeof value.tradeCount === 'number'
    && typeof value.tradesWithR === 'number'
    && typeof value.tradesWithoutR === 'number'
    && typeof value.flaggedTradeCount === 'number'
    && typeof value.netPnl === 'number'
    && typeof value.totalR === 'number'
    && typeof value.wins === 'number'
    && typeof value.smalls === 'number'
    && typeof value.losses === 'number'
    && typeof value.dailyStreak === 'number'
    && Array.isArray(value.daily)
    && value.daily.every(isDashboardDailyTotal)
    && Array.isArray(value.cumulative)
    && value.cumulative.every((point) => isRecord(point)
      && typeof point.date === 'string'
      && typeof point.cumulativeNetPnl === 'number')
    && Array.isArray(value.weekly)
    && value.weekly.every((week) => isRecord(week)
      && typeof week.startDate === 'string'
      && typeof week.endDate === 'string'
      && typeof week.tradeCount === 'number'
      && typeof week.netPnl === 'number')
    && Array.isArray(value.availableSymbols)
    && value.availableSymbols.every((symbol) => typeof symbol === 'string')
}

export async function getDashboardSummary(
  accessToken: string,
  query: DashboardQuery,
): Promise<DashboardSummary> {
  const search = new URLSearchParams({ period: query.period })
  query.accountIds.forEach((id) => search.append('accountIds', String(id)))
  query.symbols?.forEach((symbol) => search.append('symbols', symbol))

  const response = await fetch(`/api/v1/trading-accounts/summary/dashboard?${search}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    let detail = `Dashboard request failed with status ${response.status}.`
    try {
      const payload: unknown = await response.json()
      if (isRecord(payload) && typeof payload.detail === 'string') detail = payload.detail
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
    }
    throw new DashboardRequestError(response.status, detail)
  }

  const payload: unknown = await response.json()
  if (!isDashboardSummary(payload)) throw new Error('The dashboard response was invalid.')
  return payload
}
