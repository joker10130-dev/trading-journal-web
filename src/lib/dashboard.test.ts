import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDashboardSummary, type DashboardSummary } from './dashboard'

const summary: DashboardSummary = {
  period: 'THIS_MONTH',
  startDate: '2026-11-01',
  endDate: '2026-11-08',
  tradeCount: 1,
  tradesWithR: 1,
  tradesWithoutR: 0,
  flaggedTradeCount: 0,
  netPnl: 10,
  totalR: 1.5,
  wins: 1,
  smalls: 0,
  losses: 0,
  dailyStreak: 1,
  daily: [{ date: '2026-11-08', tradeCount: 1, tradesWithR: 1, netPnl: 10, totalR: 1.5 }],
  cumulative: [{ date: '2026-11-08', cumulativeNetPnl: 10 }],
  weekly: [{ startDate: '2026-11-02', endDate: '2026-11-08', tradeCount: 1, netPnl: 10 }],
  availableSymbols: ['XAUUSD'],
}

describe('dashboard summary requests', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends repeated account and symbol filters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(summary))

    await expect(getDashboardSummary('access-token', {
      period: 'THIS_MONTH',
      accountIds: [4, 8],
      symbols: ['XAUUSD', 'BTCUSD'],
    })).resolves.toEqual(summary)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/trading-accounts/summary/dashboard?period=THIS_MONTH&accountIds=4&accountIds=8&symbols=XAUUSD&symbols=BTCUSD')
    expect(options).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: 'Bearer access-token' },
    })
  })

  it('reports server errors with their ProblemDetail message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(
      { detail: 'Statistics cannot combine accounts with different currencies.' },
      { status: 400 },
    ))

    await expect(getDashboardSummary('access-token', {
      period: 'THIS_MONTH',
      accountIds: [4],
    })).rejects.toMatchObject({
      name: 'DashboardRequestError',
      status: 400,
      message: 'Statistics cannot combine accounts with different currencies.',
    })
  })
})
