import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileSpreadsheet,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import AuthScreen from './components/auth-screen'
import TradeEditorModal from './components/trade-editor-modal'
import { type Trade } from './lib/trade'
import './App.css'

const PnlChart = lazy(() => import('./components/pnl-chart'))

const trades: Trade[] = [
  { id: '1246214425', ticket: '1246214425', source: 'IMPORT', symbol: 'XAUUSD', side: 'SHORT', size: 0.02, entry: 4183.74, exit: 4183.08, profit: 1.32, swaps: 0, commission: 0, pnl: 1.32, r: null, rSource: 'NONE', opened: null, closed: '2026-10-02T11:04:07', closes: 1, comment: 'MARKET GTC COMPLETED', tags: [], notes: '' },
  { id: '1246237056', ticket: '1246237056', source: 'IMPORT', symbol: 'XAUUSD', side: 'SHORT', size: 0.02, entry: 4185.2, exit: 4195.3, profit: -20.2, swaps: 0, commission: 0, pnl: -20.2, r: null, rSource: 'NONE', opened: null, closed: '2026-10-02T13:04:18', closes: 1, comment: 'STOP GTC COMPLETED', tags: [], notes: '' },
  { id: '1247862625', ticket: '1247862625', source: 'IMPORT', symbol: 'XAUUSD', side: 'LONG', size: 0.01, entry: 4129.79, exit: 4118.38, profit: -11.41, swaps: 0, commission: 0, pnl: -11.41, r: null, rSource: 'NONE', opened: null, closed: '2026-10-06T09:35:04', closes: 1, comment: 'STOP GTC COMPLETED', tags: [], notes: '' },
  { id: '1248616142', ticket: '1248616142', source: 'IMPORT', symbol: 'XAUUSD', side: 'LONG', size: 0.01, entry: 4146.63, exit: 4136.69, profit: -9.94, swaps: 0, commission: 0, pnl: -9.94, r: null, rSource: 'NONE', opened: null, closed: '2026-10-07T11:54:24', closes: 1, comment: 'STOP GTC COMPLETED', tags: [], notes: '' },
  { id: '1250162056', ticket: '1250162056', source: 'IMPORT', symbol: 'XAUUSD', side: 'SHORT', size: 0.01, entry: 4174.41, exit: 4184.28, profit: -9.87, swaps: 0, commission: 0, pnl: -9.87, r: null, rSource: 'NONE', opened: null, closed: '2026-10-09T11:33:36', closes: 1, comment: 'STOP GTC COMPLETED', tags: [], notes: '' },
  { id: '1250232985', ticket: '1250232985', source: 'IMPORT', symbol: 'XAUUSD', side: 'SHORT', size: 0.01, entry: 4178.6, exit: 4188.62, profit: -10.02, swaps: 0, commission: 0, pnl: -10.02, r: null, rSource: 'NONE', opened: null, closed: '2026-10-09T12:16:27', closes: 1, comment: 'STOP GTC COMPLETED', tags: [], notes: '' },
  { id: '1250803562', ticket: '1250803562', source: 'IMPORT', symbol: 'BTCUSD', side: 'LONG', size: 0.02, entry: 82994, exit: 82958.5, profit: -0.72, swaps: 0, commission: 0, pnl: -0.72, r: null, rSource: 'NONE', opened: null, closed: '2026-10-10T22:50:08', closes: 2, comment: 'MARKET GTC COMPLETED', tags: [], notes: '' },
]

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const periods = ['This Month', 'Last Month', 'Last Quarter', 'Last Year', 'Eternal']
const fmtMoney = (value: number, digits = 2) =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
const fmtR = (value: number, digits = 2) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}R`
const tradeDay = (trade: Trade) => trade.closed.slice(0, 10)
const valueClass = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'

function App() {
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [month, setMonth] = useState(new Date(2026, 9, 1))
  const [accountEnabled, setAccountEnabled] = useState(true)
  const [symbols, setSymbols] = useState<string[]>(['XAUUSD', 'BTCUSD'])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [tradeRows, setTradeRows] = useState(trades)
  const [deletedTrades, setDeletedTrades] = useState<Trade[]>([])
  const [showDeletedTrades, setShowDeletedTrades] = useState(false)
  const [tradeEditor, setTradeEditor] = useState<{ trade: Trade | null } | null>(null)
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null)
  const [showReminder, setShowReminder] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    if (!showUserMenu) return

    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && !userMenuRef.current?.contains(event.target)) {
        setShowUserMenu(false)
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowUserMenu(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showUserMenu])

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
  const monthTrades = useMemo(
    () => tradeRows.filter((trade) => accountEnabled && trade.closed.startsWith(monthKey) && symbols.includes(trade.symbol)),
    [accountEnabled, monthKey, symbols, tradeRows],
  )
  const visibleTrades = useMemo(
    () => (showDeletedTrades
      ? deletedTrades.filter((trade) => accountEnabled && trade.closed.startsWith(monthKey) && symbols.includes(trade.symbol))
      : monthTrades)
      .filter((trade) => !selectedDay || tradeDay(trade) === selectedDay)
      .sort((a, b) => b.closed.localeCompare(a.closed)),
    [accountEnabled, deletedTrades, monthKey, monthTrades, selectedDay, showDeletedTrades, symbols],
  )
  const stats = useMemo(() => {
    const pnl = monthTrades.reduce((total, trade) => total + trade.pnl, 0)
    const withR = monthTrades.filter((trade) => trade.r !== null)
    const totalR = withR.reduce((total, trade) => total + (trade.r ?? 0), 0)
    const wins = withR.filter((trade) => (trade.r ?? 0) > 1).length
    const smalls = withR.filter((trade) => (trade.r ?? 0) >= 0 && (trade.r ?? 0) <= 1).length
    const losses = withR.filter((trade) => (trade.r ?? 0) < 0).length
    const byDay = new Map<string, number>()
    withR.forEach((trade) => byDay.set(tradeDay(trade), (byDay.get(tradeDay(trade)) ?? 0) + (trade.r ?? 0)))
    let streak = 0
    for (const [, dailyR] of [...byDay.entries()].sort(([left], [right]) => right.localeCompare(left))) {
      if (dailyR <= 0) break
      streak += 1
    }
    const drawdown = [...monthTrades]
      .sort((a, b) => a.closed.localeCompare(b.closed))
      .reduce((state, trade) => {
        const balance = state.balance + trade.pnl
        const peak = Math.max(state.peak, balance)
        return { balance, peak, maxDrawdown: Math.min(state.maxDrawdown, balance - peak) }
      }, { balance: 0, peak: 0, maxDrawdown: 0 })
    return {
      pnl,
      totalR,
      withR: withR.length,
      wins,
      smalls,
      losses,
      noR: monthTrades.length - withR.length,
      streak,
      flagged: withR.filter((trade) => Math.abs(trade.r ?? 0) > 5).length,
      winRate: withR.length ? wins / withR.length * 100 : 0,
      averageR: withR.length ? totalR / withR.length : null,
      maxDrawdown: drawdown.maxDrawdown,
    }
  }, [monthTrades])

  const calendar = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (firstDay.getDay() + 6) % 7
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return Array.from({ length: offset + count }, (_, index) => {
      if (index < offset) return null
      const day = index - offset + 1
      const key = `${monthKey}-${String(day).padStart(2, '0')}`
      const dayTrades = monthTrades.filter((trade) => tradeDay(trade) === key)
      const knownRiskTrades = dayTrades.filter((trade) => trade.r !== null)
      return {
        day,
        key,
        count: dayTrades.length,
        pnl: dayTrades.reduce((total, trade) => total + trade.pnl, 0),
        rCount: knownRiskTrades.length,
        r: knownRiskTrades.length ? knownRiskTrades.reduce((total, trade) => total + (trade.r ?? 0), 0) : null,
      }
    })
  }, [month, monthKey, monthTrades])

  const weeklySummaries = useMemo(() => {
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
    const mondayBefore = 1 - ((firstDay.getDay() + 6) % 7)
    const weeks: { start: number; end: number; pnl: number; count: number }[] = []
    for (let monday = mondayBefore; monday <= daysInMonth; monday += 7) {
      const start = Math.max(1, monday)
      const end = Math.min(monday + 6, daysInMonth)
      const weekTrades = monthTrades.filter((trade) => {
        const day = Number(tradeDay(trade).slice(-2))
        return day >= start && day <= end
      })
      weeks.push({
        start,
        end,
        pnl: weekTrades.reduce((total, trade) => total + trade.pnl, 0),
        count: weekTrades.length,
      })
    }
    return weeks
  }, [month, monthTrades])

  const chartData = useMemo(
    () => [...monthTrades]
      .sort((a, b) => a.closed.localeCompare(b.closed))
      .reduce<{ time: string; pnl: number }[]>((points, trade) => [
        ...points,
        {
          time: new Date(trade.closed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          pnl: Number(((points.at(-1)?.pnl ?? 0) + trade.pnl).toFixed(2)),
        },
      ], []),
    [monthTrades],
  )

  function toggleSymbol(symbol: string) {
    setSelectedDay(null)
    setSymbols((current) => current.includes(symbol)
      ? current.filter((item) => item !== symbol)
      : [...current, symbol])
  }

  function changeMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
    setSelectedDay(null)
  }

  function signOut() {
    setShowUserMenu(false)
    setAuthenticatedEmail(null)
    setSelectedTrade(null)
    setTradeEditor(null)
    setTradeToDelete(null)
    setTradeRows(trades)
    setDeletedTrades([])
    setShowDeletedTrades(false)
    setShowImport(false)
    setShowReminder(false)
    setFiles([])
    setToastMessage('')
  }

  function addTrade() {
    setShowDeletedTrades(false)
    setTradeEditor({ trade: null })
  }

  function saveTrade(trade: Trade) {
    const wasEditing = Boolean(tradeEditor?.trade)
    if (tradeEditor?.trade) {
      setTradeRows((current) => current.map((item) => item.id === trade.id ? trade : item))
    } else {
      setTradeRows((current) => [trade, ...current])
    }
    setTradeEditor(null)
    setSelectedTrade(null)
    setSelectedDay(null)
    setShowDeletedTrades(false)
    setToastMessage(wasEditing ? 'Trade updated' : 'Trade added')
  }

  function editTrade(trade: Trade) {
    setSelectedTrade(null)
    setTradeEditor({ trade })
  }

  function confirmDeleteTrade() {
    if (!tradeToDelete) return
    const action = tradeToDelete.source === 'IMPORT' ? 'hidden' : 'deleted'
    setTradeRows((current) => current.filter((trade) => trade.id !== tradeToDelete.id))
    setDeletedTrades((current) => [tradeToDelete, ...current])
    setTradeToDelete(null)
    setSelectedTrade(null)
    setToastMessage(`Trade ${action}`)
  }

  function restoreTrade(id: string) {
    const trade = deletedTrades.find((item) => item.id === id)
    if (!trade) return
    setDeletedTrades((current) => current.filter((item) => item.id !== id))
    setTradeRows((current) => [trade, ...current])
    setToastMessage('Trade restored')
  }

  function snoozeReminder() {
    const nextMonday = new Date()
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7))
    localStorage.setItem('journal-reminder-snoozed-until', nextMonday.toLocaleDateString('en-CA'))
    setShowReminder(false)
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    setFiles((current) => [
      ...current,
      ...Array.from(fileList).filter((file) => !current.some((item) => item.name === file.name && item.size === file.size)),
    ])
  }

  const shortMonth = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="app-shell">
      {!authenticatedEmail
        ? <AuthScreen onAuthenticated={setAuthenticatedEmail} />
        : <>
      <header className="app-header">
        <a className="brand" href="#dashboard">Trading Journal</a>
        <nav className="period-tabs" aria-label="Date range">
          {periods.map((period, index) => (
            <button
              className={`period-tab ${index === 0 ? 'period-tab-active' : ''}`}
              disabled={index !== 0}
              key={period}
              title={index === 0 ? undefined : 'Sample data covers October 2026 only'}
              type="button"
            >
              {period}
            </button>
          ))}
        </nav>
        <button className={`period-tab reminder-preview ${showReminder ? 'period-tab-active' : ''}`} onClick={() => setShowReminder((showing) => !showing)} type="button">
          Preview reminder
        </button>
        <div className="account-menu" ref={userMenuRef}>
          <button
            className="account-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            aria-label="Account menu"
            onClick={() => setShowUserMenu((open) => !open)}
          >
            <span className="account-avatar" aria-hidden="true">{authenticatedEmail.split('@')[0].slice(0, 2).toUpperCase()}</span>
          </button>
          {showUserMenu && (
            <div className="account-dropdown" role="menu">
              <div className="account-menu-heading">
                <strong>Trader</strong>
                <span>{authenticatedEmail}</span>
              </div>
              <button className="account-menu-item account-signout" type="button" role="menuitem" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="filters" aria-label="Trade filters">
        <span className="filter-title">Account:</span>
        <label className="filter-control">
          <input type="checkbox" checked={accountEnabled} onChange={(event) => { setAccountEnabled(event.target.checked); setSelectedDay(null) }} />
          Eightcap · xxxxxxxx (USD)
        </label>
        <span className="filter-title symbol-title">Symbol:</span>
        {['XAUUSD', 'BTCUSD'].map((symbol) => (
          <label className="filter-control symbol-control" key={symbol}>
            <input type="checkbox" checked={symbols.includes(symbol)} onChange={() => toggleSymbol(symbol)} />
            {symbol}
          </label>
        ))}
        {selectedDay && <button className="clear-day" onClick={() => setSelectedDay(null)} type="button">Clear date <X size={12} /></button>}
      </section>

      {showReminder && (
        <div className="reminder-banner">
          <span>Account <strong>Eightcap · xxxxxxxx</strong> has not been imported for 9 days. Older data may drop out of TradingView’s 199-row window.</span>
          <button onClick={() => { setFiles([]); setShowImport(true) }} type="button">Import now</button>
          <button className="snooze-button" onClick={snoozeReminder} type="button">Remind me next Monday</button>
        </div>
      )}

      <main id="dashboard" className="dashboard">
        <section className="metric-grid" aria-label="Monthly summary">
          <article className="metric-card">
            <div className="metric-label">Net P&amp;L</div>
            <div className={`metric-value ${valueClass(stats.pnl)}`}>{fmtMoney(stats.pnl)} USD</div>
            <div className="metric-sub">{monthTrades.length} trades · all closed</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">Total R</div>
            <div className={`metric-value ${valueClass(stats.totalR)}`}>{stats.withR ? fmtR(stats.totalR, 1) : '—'}</div>
            <div className="metric-sub">
              from {stats.withR}/{monthTrades.length} trades
              {stats.noR > 0 && <span className="warning-text"> · {stats.noR} without R</span>}
              {stats.flagged > 0 && <span className="warning-text"> · {stats.flagged} to review (|R| &gt; 5)</span>}
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-label">Win % (R &gt; 1)</div>
            <div className="metric-value">{stats.withR ? `${stats.winRate.toFixed(1)}%` : '—'}</div>
            <div className="metric-sub">
              {stats.wins} wins (R&gt;1) · {stats.smalls} small · {stats.losses} losses
              {stats.noR > 0 && <span className="warning-text"> · {stats.noR} without R</span>}
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-label">Daily streak</div>
            <div className="metric-value">{stats.streak} days</div>
            <div className="metric-sub">consecutive days with positive total R</div>
          </article>
        </section>

        <section className="panel chart-panel">
          <h2>Cumulative P&amp;L</h2>
          <div className="chart-wrap">
            {chartData.length > 0
              ? <Suspense fallback={<div className="chart-empty">Loading chart…</div>}><PnlChart data={chartData} formatMoney={(value) => `${fmtMoney(value)} USD`} /></Suspense>
              : <div className="chart-empty">No data in this range</div>}
          </div>
          <div className="chart-caption">Cumulative P&amp;L by close time (Thai time)</div>
        </section>

        <section className="calendar-week-grid">
          <article className="panel calendar-panel">
            <div className="panel-heading">
              <h2>Trading calendar</h2>
              <div className="month-control">
                <button className="month-arrow" onClick={() => changeMonth(-1)} aria-label="Previous month" type="button"><ChevronLeft size={14} /></button>
                <strong>{shortMonth}</strong>
                <button className="month-arrow" onClick={() => changeMonth(1)} aria-label="Next month" type="button"><ChevronRight size={14} /></button>
              </div>
            </div>
            <div className="calendar-grid" role="grid" aria-label={`Calendar for ${shortMonth}`}>
              {weekdays.map((day) => <div className="weekday" role="columnheader" key={day}>{day}</div>)}
              {calendar.map((cell, index) => cell ? (
                <button
                  className={`calendar-day ${cell.count ? 'day-traded' : ''} ${cell.pnl < 0 ? 'day-loss' : ''} ${selectedDay === cell.key ? 'day-selected' : ''}`}
                  key={cell.key}
                  onClick={() => setSelectedDay((current) => current === cell.key ? null : cell.key)}
                  aria-label={`${cell.key}: ${cell.count} trades, ${fmtMoney(cell.pnl)} USD, R ${cell.r === null ? 'not entered' : fmtR(cell.r)} from ${cell.rCount} trades with entered R`}
                  aria-pressed={selectedDay === cell.key}
                  type="button"
                >
                  <span className="day-number">{cell.day}</span>
                  {cell.count > 0 && (
                    <>
                      <span className="day-amount">{fmtMoney(cell.pnl)}</span>
                      <span className={`day-r ${cell.r === null ? 'day-r-missing' : valueClass(cell.r)}`} title={`R entered for ${cell.rCount} of ${cell.count} trades`}>
                        R {cell.r === null ? '—' : fmtR(cell.r)}
                      </span>
                      <span className="day-count">{cell.count} trades</span>
                    </>
                  )}
                </button>
              ) : <div className="calendar-day day-empty" key={`empty-${index}`} />)}
            </div>
            <div className="calendar-note">Click a day to filter trades · weeks start Monday</div>
          </article>

          <article className="panel weekly-panel">
            <h2>Weekly breakdown</h2>
            <div className="week-list">
              {weeklySummaries.map((week, index) => (
                <div className="week-card" key={week.start}>
                  <div className="week-heading"><strong>Week {index + 1}</strong><span>{String(week.start).padStart(2, '0')}/{String(month.getMonth() + 1).padStart(2, '0')} – {String(week.end).padStart(2, '0')}/{String(month.getMonth() + 1).padStart(2, '0')}</span></div>
                  <div className="week-result"><strong className={valueClass(week.pnl)}>{fmtMoney(week.pnl)} USD</strong><span>{week.count} trades</span></div>
                </div>
              ))}
            </div>
            <div className="performance-note">
              <div className="metric-label">Performance note</div>
              <p>Average R on trades with entered R: <strong>{stats.averageR === null ? '—' : fmtR(stats.averageR)}</strong> · Max drawdown in range: <strong>{fmtMoney(stats.maxDrawdown)} USD</strong></p>
            </div>
          </article>
        </section>

        <section className="panel trades-panel" id="trades">
          <div className="panel-heading trades-heading">
            <h2>Trades</h2>
            {!showDeletedTrades && <button className="trade-add-button" onClick={addTrade} type="button"><Plus size={14} /> Add trade</button>}
            <span className="trade-heading-meta">
              {deletedTrades.length > 0 && (
                <button className="trade-link-button" onClick={() => { setShowDeletedTrades((showing) => !showing); setSelectedDay(null) }} type="button">
                  {showDeletedTrades ? 'Hide deleted trades' : `Show hidden (${deletedTrades.length})`}
                </button>
              )}
              <span className="trade-count">{visibleTrades.length} items</span>
            </span>
          </div>
          <div className="table-scroll">
            <table className="trade-table">
              <thead><tr>
                <th>Pair</th><th>Side</th><th className="numeric">Size</th><th>Entry → Exit</th><th>Closed</th>
                <th className="numeric">P&amp;L (USD)</th><th className="numeric">R</th><th>Source</th><th className="numeric">Actions</th>
              </tr></thead>
              <tbody>
                {visibleTrades.map((trade) => (
                  <tr
                    className="trade-row"
                    key={trade.id}
                    onClick={() => setSelectedTrade(trade)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault()
                        setSelectedTrade(trade)
                      }
                    }}
                  >
                    <td><strong>{trade.symbol}</strong></td>
                    <td><span className={`side-badge ${trade.side === 'LONG' ? 'badge-long' : 'badge-short'}`}>{trade.side}</span></td>
                    <td className="numeric">{trade.size.toFixed(2)}</td>
                    <td>{trade.entry.toLocaleString('en-US')} → {trade.exit.toLocaleString('en-US')}</td>
                    <td>{new Date(trade.closed).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(trade.closed).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className={`numeric ${valueClass(trade.pnl)}`}>{fmtMoney(trade.pnl)}</td>
                    <td className="numeric">{trade.r === null ? <span className="no-risk" title="R not entered">—</span> : <><span className={valueClass(trade.r)}>{fmtR(trade.r)}</span>{Math.abs(trade.r) > 5 && <span className="warning-text" title="Review this manually entered R value"> · review</span>}</>}</td>
                    <td className="source-cell">{trade.source === 'MANUAL' ? 'Manual' : `Eightcap · ${trade.ticket || '—'}`}{trade.closes > 1 && <span> · closed {trade.closes} times</span>}</td>
                    <td className="trade-actions" onClick={(event) => event.stopPropagation()}>
                      {showDeletedTrades
                        ? <button className="row-action restore-action" onClick={() => restoreTrade(trade.id)} aria-label={`Restore ${trade.symbol} trade`} title="Restore trade" type="button"><RotateCcw size={15} /></button>
                        : <>
                          <button className="row-action" onClick={() => editTrade(trade)} aria-label={`Edit trade ${trade.symbol} ${trade.closed.slice(5, 10)}`} title="Edit" type="button"><Pencil size={15} /></button>
                          <button className="row-action delete-action" onClick={() => setTradeToDelete(trade)} aria-label={`${trade.source === 'IMPORT' ? 'Hide' : 'Delete'} trade ${trade.symbol} ${trade.closed.slice(5, 10)}`} title={trade.source === 'IMPORT' ? 'Hide' : 'Delete'} type="button"><Trash2 size={15} /></button>
                        </>}
                    </td>
                  </tr>
                ))}
                {visibleTrades.length === 0 && <tr><td className="empty-table" colSpan={9}>{showDeletedTrades ? 'No deleted trades in this selection.' : 'No trades in this selection.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {tradeEditor && <TradeEditorModal trade={tradeEditor.trade} onClose={() => setTradeEditor(null)} onSave={saveTrade} />}

      {tradeToDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTradeToDelete(null) }}>
          <section className="trade-modal delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-trade-title">
            <h2 id="delete-trade-title">{tradeToDelete.source === 'IMPORT' ? 'Hide this trade?' : 'Delete this trade?'}</h2>
            <p className="delete-confirm-copy">
              {tradeToDelete.symbol} {tradeToDelete.side.toLowerCase()} · {tradeToDelete.ticket ? `ticket ${tradeToDelete.ticket}` : 'manual trade'} · {fmtMoney(tradeToDelete.pnl)} USD<br />
              {tradeToDelete.source === 'IMPORT'
                ? 'It is excluded from all stats but kept with your imported data, so importing the same file again won’t bring it back. You can restore it later.'
                : 'This manual trade is removed from your stats.'}
            </p>
            <div className="trade-modal-footer">
              <span />
              <button className="secondary-button" onClick={() => setTradeToDelete(null)} type="button">Cancel</button>
              <button className="delete-confirm-button" onClick={confirmDeleteTrade} type="button">{tradeToDelete.source === 'IMPORT' ? 'Hide' : 'Delete'}</button>
            </div>
          </section>
        </div>
      )}

      {toastMessage && <div className="trade-toast" role="status">{toastMessage}</div>}

      {showImport && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowImport(false) }}>
          <section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <div className="modal-heading"><div><div className="metric-label">ADD TRADE HISTORY</div><h2 id="import-title">Import files</h2></div><button className="close-button" onClick={() => setShowImport(false)} aria-label="Close import dialog" type="button"><X size={18} /></button></div>
            <p className="modal-description">Choose TradingView Order History or an Eightcap Trades Report. Multiple monthly reports can be selected together.</p>
            <div className="import-tip"><FileSpreadsheet size={17} /><p><strong>Eightcap tip</strong><span>Monthly exports help avoid repeated rows in longer reports.</span></p></div>
            <label className="upload-zone">
              <input type="file" accept=".csv,.xlsx" multiple onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = '' }} />
              <Upload size={21} /><strong>Choose CSV or XLSX files</strong><span>TradingView Order History · Eightcap Trades Report</span>
            </label>
            {files.length > 0 && <div className="selected-files">{files.map((file) => <div key={`${file.name}-${file.size}`}><FileSpreadsheet size={15} /><span>{file.name}<small>{(file.size / 1024).toFixed(0)} KB</small></span><button onClick={() => setFiles((current) => current.filter((item) => item !== file))} aria-label={`Remove ${file.name}`} type="button"><X size={14} /></button></div>)}</div>}
            <p className="demo-notice">Import preview and saving need the Spring Boot API. Files stay in this browser and are not uploaded.</p>
            <div className="modal-footer"><button className="secondary-button" onClick={() => setShowImport(false)} type="button">Close</button><button className="confirm-button" disabled type="button">Preview import · API needed</button></div>
          </section>
        </div>
      )}

      {selectedTrade && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTrade(null) }}>
          <aside className="trade-drawer" role="dialog" aria-modal="true" aria-labelledby="trade-detail-title">
            <div className="drawer-heading"><div className="metric-label">TRADE DETAILS</div><button className="close-button" onClick={() => setSelectedTrade(null)} aria-label="Close trade details" type="button"><X size={18} /></button></div>
            <div className="drawer-instrument"><div><h2 id="trade-detail-title">{selectedTrade.symbol}</h2><span>Ticket {selectedTrade.ticket} · {selectedTrade.comment}</span></div><span className={`side-badge ${selectedTrade.side === 'LONG' ? 'badge-long' : 'badge-short'}`}>{selectedTrade.side}</span></div>
            <div className={`drawer-pnl ${valueClass(selectedTrade.pnl)}`}>{fmtMoney(selectedTrade.pnl)} USD<span>Realized P&amp;L</span></div>
            <div className="detail-grid">
              <div><span>Entry price</span><strong>{selectedTrade.entry.toLocaleString('en-US')}</strong></div>
              <div><span>Average exit</span><strong>{selectedTrade.exit.toLocaleString('en-US')}</strong></div>
              <div><span>Position size</span><strong>{selectedTrade.size.toFixed(2)} lot</strong></div>
              <div><span>Closed</span><strong>{new Date(selectedTrade.closed).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong></div>
              <div><span>R multiple</span><strong>              {selectedTrade.r === null ? 'Not entered' : fmtR(selectedTrade.r)}</strong></div>
              <div><span>Close executions</span><strong>{selectedTrade.closes}</strong></div>
            </div>
            <div className="risk-note"><CircleHelp size={16} /><span>{selectedTrade.rSource === 'MANUAL' ? 'R entered manually.' : 'No R entered; this trade is excluded from R totals.'}</span></div>
            {selectedTrade.r !== null && Math.abs(selectedTrade.r) > 5 && <div className="warning-text">Review: |R| is greater than 5. The value is unchanged.</div>}
            <div className="detail-source"><span>Source</span><strong>{selectedTrade.source === 'MANUAL' ? 'Manual' : 'Eightcap Trades Report'}</strong></div>
            <div className="detail-actions">
              <button className="secondary-button" type="button" onClick={() => editTrade(selectedTrade)}>
                {selectedTrade.source === 'IMPORT' ? 'Edit R' : 'Edit trade'}
              </button>
              <button className="detail-delete-button" type="button" onClick={() => { setTradeToDelete(selectedTrade); setSelectedTrade(null) }}>
                {selectedTrade.source === 'IMPORT' ? 'Hide trade' : 'Delete trade'}
              </button>
            </div>
          </aside>
        </div>
      )}
      </>}
    </div>
  )
}

export default App
