import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import TradeEditorModal from './trade-editor-modal'
import {
  createManualTrade,
  deleteTrade,
  getTrade,
  listTrades,
  restoreTrade,
  TradeRequestError,
  updateManualTrade,
  updateTradeR,
  type ManualTradeRequest,
  type TradeDetailRecord,
  type TradeRecord,
} from '../lib/trades'
import type { TradingAccount } from '../lib/accounts'
import type { Trade } from '../lib/trade'

type TradeManagementScreenProps = {
  accounts: TradingAccount[]
  accessToken: string
  onAuthenticationRequired: () => void
}

type Period = 'This month' | 'Last month' | 'Last quarter' | 'Last year' | 'All time'

const periods: Period[] = ['This month', 'Last month', 'Last quarter', 'Last year', 'All time']
const pageSize = 25
const fmtMoney = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtR = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}R`
const valueClass = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'

function localDateKey(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function periodRange(period: Period) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  switch (period) {
    case 'This month':
      return { from: localDateKey(new Date(year, month, 1)), to: localDateKey(today) }
    case 'Last month':
      return { from: localDateKey(new Date(year, month - 1, 1)), to: localDateKey(new Date(year, month, 0)) }
    case 'Last quarter':
      return { from: localDateKey(new Date(year, month - 3, 1)), to: localDateKey(today) }
    case 'Last year':
      return { from: localDateKey(new Date(year - 1, month, today.getDate())), to: localDateKey(today) }
    case 'All time':
      return { from: '', to: '' }
  }
}

function localDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function sourceOf(trade: Pick<TradeRecord, 'hasTradesReport' | 'hasTradingViewData'>) {
  return trade.hasTradesReport || trade.hasTradingViewData ? 'IMPORT' : 'MANUAL'
}

function fromListRecord(record: TradeRecord): Trade {
  return {
    id: String(record.id),
    ticket: record.ticket ?? '',
    source: sourceOf(record),
    symbol: record.symbol,
    side: record.side,
    status: record.status,
    size: record.volume ?? 0,
    entry: record.openPrice ?? 0,
    exit: record.closePrice ?? 0,
    profit: record.grossPnl,
    swaps: record.feesAndSwap,
    commission: 0,
    pnl: record.netPnl,
    r: record.rMultiple,
    rSource: record.rSource,
    opened: localDateTime(record.openedAt),
    closed: localDateTime(record.closedAt) || null,
    closes: record.closeCount,
    comment: sourceOf(record) === 'MANUAL' ? 'Manual entry' : 'Imported trade',
    tags: [],
    notes: '',
  }
}

function fromDetailRecord(record: TradeDetailRecord): Trade {
  const closes = record.closes.map((close) => ({
    id: String(close.id),
    source: close.source,
    closedAt: localDateTime(close.closedAt) || null,
    volume: close.volume,
    closePrice: close.closePrice,
    grossPnl: close.grossPnl,
    swaps: close.swaps,
    commission: close.commission,
    netPnl: close.netPnl,
    r: close.rMultiple,
  }))
  const latestClose = record.closes.at(-1)
  return {
    id: String(record.id),
    ticket: record.ticket ?? '',
    source: sourceOf(record),
    symbol: record.symbol,
    side: record.side,
    status: record.status,
    size: record.openedVolume ?? 0,
    entry: record.openPrice ?? 0,
    exit: latestClose?.closePrice ?? 0,
    profit: closes.reduce((total, close) => total + close.grossPnl, 0),
    swaps: closes.reduce((total, close) => total + close.swaps, 0),
    commission: closes.reduce((total, close) => total + close.commission, 0),
    pnl: record.netPnl,
    r: record.rMultiple,
    rSource: record.rSource,
    opened: localDateTime(record.openedAt),
    closed: localDateTime(latestClose?.closedAt ?? null) || null,
    closes: record.closes.length,
    comment: sourceOf(record) === 'MANUAL' ? 'Manual entry' : 'Imported trade',
    tags: [],
    notes: '',
    closeDetails: closes,
  }
}

function TradeManagementScreen({
  accounts,
  accessToken,
  onAuthenticationRequired,
}: TradeManagementScreenProps) {
  const [accountId, setAccountId] = useState<number | null>(accounts[0]?.id ?? null)
  const [period, setPeriod] = useState<Period>('This month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [symbol, setSymbol] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [page, setPage] = useState(0)
  const [tradePage, setTradePage] = useState<{ content: TradeRecord[]; totalElements: number; totalPages: number }>({
    content: [],
    totalElements: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editorTrade, setEditorTrade] = useState<Trade | null | undefined>(undefined)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null)
  const [toast, setToast] = useState('')
  const account = accounts.find((item) => item.id === accountId) ?? null
  const defaultRange = useMemo(() => periodRange(period), [period])
  const from = customFrom || defaultRange.from
  const to = customTo || defaultRange.to
  const accountLabel = account
    ? `${account.name} · ${account.broker} (${account.currency})`
    : 'Select a trading account'

  useEffect(() => {
    if (accountId === null) return
    let active = true
    Promise.resolve()
      .then(() => {
        if (active) {
          setLoading(true)
          setError('')
        }
        return listTrades(accountId, accessToken, {
          page,
          size: pageSize,
          symbol: symbol.trim() || undefined,
          from: showDeleted ? undefined : from || undefined,
          to: showDeleted ? undefined : to || undefined,
          deleted: showDeleted,
        })
      })
      .then((result) => {
        if (active) setTradePage(result)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        if (requestError instanceof TradeRequestError && requestError.status === 401) {
          onAuthenticationRequired()
          return
        }
        setError(requestError instanceof Error ? requestError.message : 'Unable to load trades.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [accessToken, accountId, from, onAuthenticationRequired, page, showDeleted, symbol, to])

  const trades = useMemo(() => tradePage.content.map(fromListRecord), [tradePage.content])

  function resetPage() {
    setPage(0)
  }

  async function reload() {
    if (accountId === null) return
    try {
      const result = await listTrades(accountId, accessToken, {
        page,
        size: pageSize,
        symbol: symbol.trim() || undefined,
        from: showDeleted ? undefined : from || undefined,
        to: showDeleted ? undefined : to || undefined,
        deleted: showDeleted,
      })
      setTradePage(result)
      setError('')
    } catch (requestError) {
      if (requestError instanceof TradeRequestError && requestError.status === 401) {
        onAuthenticationRequired()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to reload trades.')
    }
  }

  async function loadDetail(trade: Trade) {
    try {
      const result = await getTrade(trade.id, accessToken)
      return fromDetailRecord(result)
    } catch (requestError) {
      if (requestError instanceof TradeRequestError && requestError.status === 401) {
        onAuthenticationRequired()
        return null
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to load trade details.')
      return null
    }
  }

  async function openDetail(trade: Trade) {
    const detail = await loadDetail(trade)
    if (detail) setSelectedTrade(detail)
  }

  async function editTrade(trade: Trade) {
    const detail = await loadDetail(trade)
    if (detail) {
      setSelectedTrade(null)
      setEditorTrade(detail)
    }
  }

  async function saveTrade(trade: Trade) {
    if (accountId === null) return
    setError('')
    try {
      if (trade.source === 'IMPORT') {
        await updateTradeR(trade.id, trade.r, accessToken)
      } else {
        const request: ManualTradeRequest = {
          ticket: trade.ticket.trim() || null,
          symbol: trade.symbol,
          side: trade.side,
          volume: trade.size,
          openedAt: trade.opened ?? '',
          closedAt: trade.closed ?? '',
          openPrice: trade.entry,
          closePrice: trade.exit,
          profit: trade.profit,
          swaps: trade.swaps,
          commission: trade.commission,
          rMultiple: trade.r,
        }
        if (editorTrade) {
          await updateManualTrade(accountId, trade.id, request, accessToken)
        } else {
          await createManualTrade(accountId, request, accessToken)
        }
      }
      setEditorTrade(undefined)
      setToast(editorTrade ? 'Trade updated' : 'Trade added')
      await reload()
    } catch (requestError) {
      if (requestError instanceof TradeRequestError && requestError.status === 401) {
        onAuthenticationRequired()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the trade.')
    }
  }

  async function confirmDelete() {
    if (!tradeToDelete) return
    try {
      await deleteTrade(tradeToDelete.id, accessToken)
      setTradeToDelete(null)
      setSelectedTrade(null)
      setToast('Trade deleted')
      await reload()
    } catch (requestError) {
      if (requestError instanceof TradeRequestError && requestError.status === 401) {
        onAuthenticationRequired()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete the trade.')
    }
  }

  async function restoreDeleted(trade: Trade) {
    try {
      await restoreTrade(trade.id, accessToken)
      setToast('Trade restored')
      await reload()
    } catch (requestError) {
      if (requestError instanceof TradeRequestError && requestError.status === 401) {
        onAuthenticationRequired()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to restore the trade.')
    }
  }

  return (
    <main className="dashboard trade-management">
      <section className="panel trade-management-panel">
        <div className="panel-heading trades-heading">
          <div>
            <h2>{showDeleted ? 'Deleted trades' : 'Trade list'}</h2>
            <span className="trade-count">{tradePage.totalElements} trades</span>
          </div>
          <div className="trade-management-actions">
            {!showDeleted && (
              <button className="trade-add-button" onClick={() => setEditorTrade(null)} type="button">
                <Plus size={14} /> Add trade
              </button>
            )}
            <button className="trade-link-button" onClick={() => { setShowDeleted((value) => !value); setPage(0) }} type="button">
              {showDeleted ? 'Back to trades' : 'Deleted trades'}
            </button>
          </div>
        </div>

        <div className="trade-management-filters">
          <label>
            <span>Account</span>
            <select
              value={accountId ?? ''}
              onChange={(event) => { setAccountId(Number(event.target.value)); resetPage() }}
            >
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>{item.name} · {item.broker} ({item.currency})</option>
              ))}
            </select>
          </label>
          {!showDeleted && (
            <>
              <label>
                <span>Period</span>
                <select value={period} onChange={(event) => { setPeriod(event.target.value as Period); setCustomFrom(''); setCustomTo(''); resetPage() }}>
                  {periods.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>From</span>
                <input type="date" value={customFrom || defaultRange.from} onChange={(event) => { setCustomFrom(event.target.value); setPeriod('All time'); resetPage() }} />
              </label>
              <label>
                <span>To</span>
                <input type="date" value={customTo || defaultRange.to} onChange={(event) => { setCustomTo(event.target.value); setPeriod('All time'); resetPage() }} />
              </label>
              <label>
                <span>Symbol</span>
                <input value={symbol} placeholder="All symbols" onChange={(event) => { setSymbol(event.target.value); resetPage() }} />
              </label>
            </>
          )}
        </div>

        {error && <div className="trade-management-error" role="alert">{error}</div>}
        <div className="table-scroll">
          <table className="trade-table">
            <thead>
              <tr>
                <th>Pair</th><th>Side</th><th className="numeric">Size</th><th>Entry → Exit</th><th>Closed</th>
                <th className="numeric">P&amp;L ({account?.currency ?? 'USD'})</th><th className="numeric">R</th><th>Source</th><th className="numeric">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr className="trade-row" key={trade.id} onClick={() => { void openDetail(trade) }} tabIndex={0}>
                  <td><strong>{trade.symbol}</strong></td>
                  <td><span className={`side-badge ${trade.side === 'LONG' ? 'badge-long' : 'badge-short'}`}>{trade.side}</span></td>
                  <td className="numeric">{trade.size.toFixed(2)}</td>
                  <td>{trade.entry.toLocaleString('en-US')} → {trade.exit.toLocaleString('en-US')}</td>
                  <td>{trade.closed ? new Date(trade.closed).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : trade.status}</td>
                  <td className={`numeric ${valueClass(trade.pnl)}`}>{fmtMoney(trade.pnl)}</td>
                  <td className="numeric">{trade.r === null ? '—' : fmtR(trade.r)}</td>
                  <td>{trade.source === 'MANUAL' ? 'Manual' : `${trade.ticket || 'Imported'} · ${trade.closes} close${trade.closes === 1 ? '' : 's'}`}</td>
                  <td className="trade-actions" onClick={(event) => event.stopPropagation()}>
                    {showDeleted
                      ? <button className="row-action restore-action" onClick={() => { void restoreDeleted(trade) }} aria-label={`Restore ${trade.symbol} trade`} type="button"><RotateCcw size={15} /></button>
                      : <>
                        <button className="row-action" onClick={() => { void editTrade(trade) }} aria-label={`Edit ${trade.symbol} trade`} type="button"><Pencil size={15} /></button>
                        <button className="row-action delete-action" onClick={() => setTradeToDelete(trade)} aria-label={`Delete ${trade.symbol} trade`} type="button"><Trash2 size={15} /></button>
                      </>}
                  </td>
                </tr>
              ))}
              {!loading && trades.length === 0 && (
                <tr><td className="empty-table" colSpan={9}>{showDeleted ? 'No deleted trades.' : 'No trades match these filters.'}</td></tr>
              )}
              {loading && <tr><td className="empty-table" colSpan={9}>Loading trades…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="trade-pagination">
          <span>Page {tradePage.totalPages ? page + 1 : 0} of {tradePage.totalPages}</span>
          <div>
            <button className="month-arrow" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Previous page" type="button"><ChevronLeft size={15} /></button>
            <button className="month-arrow" disabled={page + 1 >= tradePage.totalPages || loading} onClick={() => setPage((value) => value + 1)} aria-label="Next page" type="button"><ChevronRight size={15} /></button>
          </div>
        </div>
      </section>

      {editorTrade !== undefined && (
        <TradeEditorModal
          trade={editorTrade}
          accountLabel={accountLabel}
          onClose={() => setEditorTrade(undefined)}
          onSave={(trade) => { void saveTrade(trade) }}
        />
      )}

      {tradeToDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTradeToDelete(null) }}>
          <section className="trade-modal delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-trade-title">
            <button className="trade-modal-close" onClick={() => setTradeToDelete(null)} aria-label="Close" type="button"><X size={20} /></button>
            <h2 id="delete-trade-title">Delete this trade?</h2>
            <p className="delete-confirm-copy">{tradeToDelete.symbol} {tradeToDelete.side.toLowerCase()} · {tradeToDelete.ticket || 'manual trade'} · {fmtMoney(tradeToDelete.pnl)} {account?.currency}</p>
            <p className="delete-confirm-copy">Trade disappears from stats and stays available in Deleted trades for restore.</p>
            <div className="trade-modal-footer">
              <span />
              <button className="secondary-button" onClick={() => setTradeToDelete(null)} type="button">Cancel</button>
              <button className="delete-confirm-button" onClick={() => { void confirmDelete() }} type="button">Delete</button>
            </div>
          </section>
        </div>
      )}

      {selectedTrade && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTrade(null) }}>
          <aside className="trade-drawer" role="dialog" aria-modal="true" aria-labelledby="trade-detail-title">
            <div className="drawer-heading">
              <div className="metric-label">TRADE DETAILS</div>
              <button className="close-button" onClick={() => setSelectedTrade(null)} aria-label="Close trade details" type="button"><X size={18} /></button>
            </div>
            <div className="drawer-instrument">
              <div><h2 id="trade-detail-title">{selectedTrade.symbol}</h2><span>Ticket {selectedTrade.ticket || '—'} · {selectedTrade.comment}</span></div>
              <span className={`side-badge ${selectedTrade.side === 'LONG' ? 'badge-long' : 'badge-short'}`}>{selectedTrade.side}</span>
            </div>
            <div className={`drawer-pnl ${valueClass(selectedTrade.pnl)}`}>{fmtMoney(selectedTrade.pnl)} {account?.currency}<span>Net P&amp;L</span></div>
            <div className="detail-grid">
              <div><span>Entry price</span><strong>{selectedTrade.entry.toLocaleString('en-US')}</strong></div>
              <div><span>Average exit</span><strong>{selectedTrade.exit.toLocaleString('en-US')}</strong></div>
              <div><span>Position size</span><strong>{selectedTrade.size.toFixed(2)} lot</strong></div>
              <div><span>Opened</span><strong>{selectedTrade.opened ? new Date(selectedTrade.opened).toLocaleString() : '—'}</strong></div>
              <div><span>R multiple</span><strong>{selectedTrade.r === null ? 'Not entered' : fmtR(selectedTrade.r)}</strong></div>
              <div><span>Close executions</span><strong>{selectedTrade.closes}</strong></div>
            </div>
            <div className="risk-note"><span>{selectedTrade.rSource === 'MANUAL' ? 'R entered manually.' : 'No R entered; this trade is excluded from R totals.'}</span></div>
            <div className="detail-source"><span>Source</span><strong>{selectedTrade.source === 'MANUAL' ? 'Manual' : 'Imported trade'}</strong></div>
            <h3 className="trade-closes-title">Closes</h3>
            <div className="trade-close-list">
              {selectedTrade.closeDetails?.map((close) => (
                <div className="trade-close-item" key={close.id}>
                  <span>{close.closedAt ? new Date(close.closedAt).toLocaleString() : 'No close time'}</span>
                  <span>{close.volume.toFixed(2)} · {close.closePrice.toLocaleString('en-US')}</span>
                  <strong className={valueClass(close.netPnl)}>{fmtMoney(close.netPnl)} · {close.source}</strong>
                </div>
              ))}
            </div>
            <div className="detail-actions">
              <button className="secondary-button" type="button" onClick={() => { void editTrade(selectedTrade) }}>
                {selectedTrade.source === 'IMPORT' ? 'Edit R' : 'Edit trade'}
              </button>
              <button className="detail-delete-button" type="button" onClick={() => { setTradeToDelete(selectedTrade); setSelectedTrade(null) }}>Delete trade</button>
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="trade-toast" role="status" onAnimationEnd={() => setToast('')}>{toast}</div>}
    </main>
  )
}

export default TradeManagementScreen
