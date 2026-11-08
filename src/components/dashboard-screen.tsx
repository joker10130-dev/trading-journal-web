import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary, DashboardRequestError, type DashboardPeriod } from '../lib/dashboard'
import type { TradingAccount } from '../lib/accounts'

const PnlChart = lazy(() => import('./pnl-chart'))

type DashboardScreenProps = {
  accounts: TradingAccount[]
  accessToken: string
  refreshKey: number
  onAuthenticationRequired: () => void
}

const periods: { label: string; value: DashboardPeriod }[] = [
  { label: 'This Month', value: 'THIS_MONTH' },
  { label: 'Last Month', value: 'LAST_MONTH' },
  { label: 'Last Quarter', value: 'LAST_QUARTER' },
  { label: 'Last Year', value: 'LAST_YEAR' },
  { label: 'Eternal', value: 'ETERNAL' },
]
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const fmtMoney = (value: number, currency: string) =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
const fmtR = (value: number, digits = 2) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}R`
const valueClass = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}

function dateKeys(startDate: string, endDate: string) {
  const date = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  const dates: string[] = []
  while (date <= end) {
    dates.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return dates
}

function DashboardScreen({
  accounts,
  accessToken,
  refreshKey,
  onAuthenticationRequired,
}: DashboardScreenProps) {
  const [period, setPeriod] = useState<DashboardPeriod>('THIS_MONTH')
  const [accountIds, setAccountIds] = useState<number[]>(() => accounts.slice(0, 1).map((account) => account.id))
  const [selectedSymbols, setSelectedSymbols] = useState<string[] | null>(null)
  const noSelection = accountIds.length === 0 || selectedSymbols?.length === 0
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', accessToken, period, accountIds, selectedSymbols, refreshKey],
    queryFn: () => getDashboardSummary(accessToken, {
      period,
      accountIds,
      symbols: selectedSymbols ?? undefined,
    }),
    enabled: !noSelection,
    retry: false,
  })
  const summary = dashboardQuery.data ?? null
  const loading = dashboardQuery.isLoading || dashboardQuery.isFetching
  const error = dashboardQuery.error instanceof Error
    ? dashboardQuery.error.message
    : dashboardQuery.error
      ? 'Unable to load dashboard statistics.'
      : ''

  useEffect(() => {
    if (dashboardQuery.error instanceof DashboardRequestError && dashboardQuery.error.status === 401) {
      onAuthenticationRequired()
    }
  }, [dashboardQuery.error, onAuthenticationRequired])

  const accountCurrency = accounts.find((account) => account.id === accountIds[0])?.currency
    ?? accounts[0]?.currency
    ?? ''
  const selectedCurrency = accounts.find((account) => account.id === accountIds[0])?.currency
  const rangeLabel = summary
    ? `${formatDate(summary.startDate, { month: 'short', day: 'numeric', year: 'numeric' })} – ${formatDate(summary.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''
  const calendarDays = useMemo(
    () => summary ? dateKeys(summary.startDate, summary.endDate) : [],
    [summary],
  )
  const calendarOffset = calendarDays.length
    ? (new Date(`${calendarDays[0]}T00:00:00.000Z`).getUTCDay() + 6) % 7
    : 0
  const dailyByDate = useMemo(
    () => new Map(summary?.daily.map((day) => [day.date, day]) ?? []),
    [summary],
  )

  function toggleAccount(accountId: number) {
    setAccountIds((current) => current.includes(accountId)
      ? current.filter((id) => id !== accountId)
      : [...current, accountId])
    setSelectedSymbols(null)
  }

  function toggleSymbol(symbol: string) {
    if (!summary) return
    setSelectedSymbols((current) => {
      if (current === null) return summary.availableSymbols.filter((item) => item !== symbol)
      return current.includes(symbol)
        ? current.filter((item) => item !== symbol)
        : [...current, symbol]
    })
  }

  const winPercent = summary && summary.tradesWithR > 0
    ? summary.wins / summary.tradesWithR * 100
    : null

  return (
    <>
      <section className="filters dashboard-filters" aria-label="Dashboard filters">
        <span className="filter-title">Account:</span>
        {accounts.map((account) => {
          const checked = accountIds.includes(account.id)
          const disabled = !checked && Boolean(selectedCurrency && account.currency !== selectedCurrency)
          return (
            <label className="filter-control" key={account.id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggleAccount(account.id)}
              />
              {account.name} · {account.broker} ({account.currency})
            </label>
          )
        })}
        <span className="filter-title symbol-title">Symbol:</span>
        {summary?.availableSymbols.map((symbol) => (
          <label className="filter-control symbol-control" key={symbol}>
            <input
              type="checkbox"
              checked={selectedSymbols === null || selectedSymbols.includes(symbol)}
              onChange={() => toggleSymbol(symbol)}
            />
            {symbol}
          </label>
        ))}
        <nav className="period-tabs dashboard-period-tabs" aria-label="Date range">
          {periods.map((item) => (
            <button
              aria-pressed={period === item.value}
              className={`period-tab ${period === item.value ? 'period-tab-active' : ''}`}
              key={item.value}
              onClick={() => setPeriod(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      {error && !(dashboardQuery.error instanceof DashboardRequestError && dashboardQuery.error.status === 401) && (
        <div className="dashboard-error" role="alert">{error}</div>
      )}
      {loading && !noSelection && <div className="dashboard-status" role="status">Loading dashboard…</div>}
      {noSelection && (
        <div className="dashboard-status" role="status">
          {accountIds.length === 0 ? 'Select at least one account to view statistics.' : 'Select at least one symbol to view statistics.'}
        </div>
      )}
      {!loading && !noSelection && summary && (
        <main id="dashboard" className="dashboard" aria-busy={loading}>
          <div className="dashboard-range-label">{rangeLabel}</div>
          <section className="metric-grid" aria-label="Dashboard summary">
            <article className="metric-card">
              <div className="metric-label">Net P&amp;L</div>
              <div className={`metric-value ${valueClass(summary.netPnl)}`}>{fmtMoney(summary.netPnl, accountCurrency)}</div>
              <div className="metric-sub">{summary.tradeCount} trades · selected period</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">Total R</div>
              <div className={`metric-value ${valueClass(summary.totalR)}`}>
                {summary.tradesWithR > 0 ? fmtR(summary.totalR, 1) : summary.tradeCount === 0 ? fmtR(0, 1) : '—'}
              </div>
              <div className="metric-sub">
                R from {summary.tradesWithR}/{summary.tradeCount} trades
                {summary.tradesWithoutR > 0 && <span className="warning-text"> · {summary.tradesWithoutR} without R</span>}
                {summary.flaggedTradeCount > 0 && <span className="warning-text"> · {summary.flaggedTradeCount} to review (|R| &gt; 5)</span>}
              </div>
            </article>
            {winPercent !== null && (
              <article className="metric-card">
                <div className="metric-label">Win % (R &gt; 1)</div>
                <div className="metric-value">{winPercent.toFixed(1)}%</div>
                <div className="metric-sub">
                  {summary.wins} wins (R&gt;1) · {summary.smalls} small · {summary.losses} losses
                </div>
              </article>
            )}
            <article className="metric-card">
              <div className="metric-label">Daily streak</div>
              <div className="metric-value">{summary.dailyStreak} days</div>
              <div className="metric-sub">consecutive days with positive total R</div>
            </article>
          </section>

          <section className="panel chart-panel">
            <h2>Cumulative P&amp;L</h2>
            <div className="chart-wrap">
              {summary.cumulative.length > 0
                ? <Suspense fallback={<div className="chart-empty">Loading chart…</div>}>
                    <PnlChart
                      data={summary.cumulative.map((point) => ({
                        time: formatDate(point.date),
                        pnl: point.cumulativeNetPnl,
                      }))}
                      formatMoney={(value) => fmtMoney(value, accountCurrency)}
                    />
                  </Suspense>
                : <div className="chart-empty">No data in this range</div>}
            </div>
            <div className="chart-caption">Cumulative P&amp;L by close date in your time zone</div>
          </section>

          <section className="calendar-week-grid">
            <article className="panel calendar-panel">
              <div className="panel-heading">
                <h2>Trading calendar</h2>
                <strong className="calendar-range">{rangeLabel}</strong>
              </div>
              <div className="dashboard-calendar-scroll">
                <div className="calendar-grid" role="grid" aria-label={`Calendar from ${rangeLabel}`}>
                  {weekdays.map((day) => <div className="weekday" role="columnheader" key={day}>{day}</div>)}
                  {Array.from({ length: calendarOffset }, (_, index) => (
                    <div className="calendar-day day-empty" key={`empty-${index}`} role="gridcell" />
                  ))}
                  {calendarDays.map((date) => {
                    const day = dailyByDate.get(date)
                    return (
                      <div
                        className={`calendar-day ${day ? 'day-traded' : ''} ${day && day.netPnl < 0 ? 'day-loss' : ''}`}
                        key={date}
                        role="gridcell"
                        aria-label={`${date}: ${day?.tradeCount ?? 0} trades, ${fmtMoney(day?.netPnl ?? 0, accountCurrency)}`}
                      >
                        <span className="day-number">{Number(date.slice(-2))}</span>
                        {day && (
                          <>
                            <span className="day-amount">{fmtMoney(day.netPnl, accountCurrency)}</span>
                            <span className={`day-r ${day.tradesWithR === 0 ? 'day-r-missing' : valueClass(day.totalR)}`}>
                              R {day.tradesWithR === 0 ? '—' : fmtR(day.totalR)}
                            </span>
                            <span className="day-count">{day.tradeCount} trades</span>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="calendar-note">Weeks start Monday. Dates and totals use your time zone.</div>
            </article>

            <article className="panel weekly-panel">
              <h2>Weekly breakdown</h2>
              <div className="week-list dashboard-week-list">
                {summary.weekly.map((week, index) => (
                  <div className="week-card" key={week.startDate}>
                    <div className="week-heading">
                      <strong>Week {index + 1}</strong>
                      <span>{formatDate(week.startDate)} – {formatDate(week.endDate)}</span>
                    </div>
                    <div className="week-result">
                      <strong className={valueClass(week.netPnl)}>{fmtMoney(week.netPnl, accountCurrency)}</strong>
                      <span>{week.tradeCount} trades</span>
                    </div>
                  </div>
                ))}
              </div>
              {summary.weekly.length === 0 && <div className="chart-empty">No weeks in this range</div>}
            </article>
          </section>
        </main>
      )}
    </>
  )
}

export default DashboardScreen
