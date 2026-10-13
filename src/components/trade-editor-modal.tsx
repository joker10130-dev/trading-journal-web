import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { riskFromStopLoss, rMultiple, type Trade } from '../lib/trade'

type TradeEditorModalProps = {
  trade: Trade | null
  onClose: () => void
  onSave: (trade: Trade) => void
}

type FieldName = 'symbol' | 'size' | 'opened' | 'closed' | 'entry' | 'exit' | 'pnl' | 'risk'
type FormErrors = Partial<Record<FieldName, string>>
type RiskInput = 'RISK' | 'SL'

type FormValues = {
  symbol: string
  side: Trade['side']
  size: string
  opened: string
  closed: string
  entry: string
  exit: string
  pnl: string
  stopLoss: string
  risk: string
  riskInput: RiskInput
  ticket: string
  tags: string
  notes: string
}

const accountLabel = 'Eightcap · xxxxxxxx (USD)'
const parseNumber = (value: string) => value === '' ? Number.NaN : Number(value)

function localDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function initialForm(trade: Trade | null): FormValues {
  const now = new Date()
  return {
    symbol: trade?.symbol ?? '',
    side: trade?.side ?? 'LONG',
    size: trade ? String(trade.size) : '',
    opened: trade?.opened?.slice(0, 16) ?? localDateTime(new Date(now.getTime() - 60 * 60 * 1000)),
    closed: trade?.closed.slice(0, 16) ?? localDateTime(now),
    entry: trade ? String(trade.entry) : '',
    exit: trade ? String(trade.exit) : '',
    pnl: trade ? String(trade.pnl) : '',
    stopLoss: trade?.initialSlPrice === null || trade?.initialSlPrice === undefined ? '' : String(trade.initialSlPrice),
    risk: trade?.risk === null || trade?.risk === undefined ? '' : String(trade.risk),
    riskInput: trade?.initialSlPrice !== null && trade?.initialSlPrice !== undefined ? 'SL' : 'RISK',
    ticket: trade?.ticket ?? '',
    tags: trade?.tags.join(', ') ?? '',
    notes: trade?.notes ?? '',
  }
}

function TradeEditorModal({ trade, onClose, onSave }: TradeEditorModalProps) {
  const [form, setForm] = useState(() => initialForm(trade))
  const [errors, setErrors] = useState<FormErrors>({})
  const importedTrade = trade?.source === 'IMPORT' ? trade : null
  const locked = importedTrade !== null
  const numbers = {
    size: parseNumber(form.size),
    entry: parseNumber(form.entry),
    exit: parseNumber(form.exit),
    pnl: parseNumber(form.pnl),
    stopLoss: parseNumber(form.stopLoss),
    risk: parseNumber(form.risk),
  }
  const calculatedRisk = form.riskInput === 'SL' && Number.isFinite(numbers.stopLoss)
    ? riskFromStopLoss(numbers.pnl, numbers.entry, numbers.exit, numbers.stopLoss)
    : Number.isFinite(numbers.risk) && numbers.risk > 0 ? numbers.risk : null
  const calculatedR = rMultiple(numbers.pnl, calculatedRisk)
  const stopOnProfitSide = Number.isFinite(numbers.stopLoss) && Number.isFinite(numbers.entry) && (
    form.side === 'LONG' ? numbers.stopLoss >= numbers.entry : numbers.stopLoss <= numbers.entry
  )

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      ...(['entry', 'exit', 'pnl', 'stopLoss', 'risk'].includes(key) ? { risk: undefined } : {}),
    }))
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: FormErrors = {}
    if (!locked) {
      if (!/^[A-Z0-9._-]{2,20}$/.test(form.symbol.trim().toUpperCase())) nextErrors.symbol = 'Enter a pair, e.g. XAUUSD.'
      if (!(numbers.size > 0)) nextErrors.size = 'Size must be greater than 0.'
      if (!form.opened) nextErrors.opened = 'Pick the opening date and time.'
      if (!form.closed) nextErrors.closed = 'Pick the closing date and time.'
      else if (form.opened && form.closed < form.opened) nextErrors.closed = 'Close time cannot be before open time.'
      if (!Number.isFinite(numbers.entry) || numbers.entry <= 0) nextErrors.entry = 'Enter a valid entry price.'
      if (!Number.isFinite(numbers.exit) || numbers.exit <= 0) nextErrors.exit = 'Enter a valid exit price.'
      if (!Number.isFinite(numbers.pnl)) nextErrors.pnl = 'Enter the P&L in USD.'
    }

    const selectedRisk = form.riskInput === 'SL' ? calculatedRisk : numbers.risk
    if (form.riskInput === 'RISK' && form.risk && (selectedRisk === null || !(selectedRisk > 0) || !Number.isFinite(selectedRisk))) {
      nextErrors.risk = 'Risk amount must be greater than 0.'
    } else if (form.riskInput === 'SL' && form.stopLoss && calculatedRisk === null) {
      nextErrors.risk = 'Can’t calculate risk from this stop loss. Enter risk amount instead.'
    } else if (form.riskInput === 'SL' && form.stopLoss && numbers.stopLoss === numbers.entry) {
      nextErrors.risk = 'Stop loss cannot equal entry price.'
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const pnl = importedTrade ? importedTrade.pnl : numbers.pnl
    const risk = form.riskInput === 'SL'
      ? form.stopLoss ? calculatedRisk : locked && !form.risk ? importedTrade?.risk ?? null : null
      : form.risk ? numbers.risk : locked && !form.risk ? importedTrade?.risk ?? null : null
    const riskChanged = importedTrade ? (
      form.riskInput !== (importedTrade.initialSlPrice === null ? 'RISK' : 'SL')
      || form.risk !== String(importedTrade.risk ?? '')
      || form.stopLoss !== (importedTrade.initialSlPrice === null ? '' : String(importedTrade.initialSlPrice))
    ) : false
    const nextRisk = importedTrade && !riskChanged ? importedTrade.risk : risk
    const nextSl = importedTrade && !riskChanged
      ? importedTrade.initialSlPrice
      : form.riskInput === 'SL' && form.stopLoss ? numbers.stopLoss : null

    onSave({
      id: trade?.id ?? crypto.randomUUID(),
      ticket: form.ticket.trim(),
      source: trade?.source ?? 'MANUAL',
      symbol: importedTrade ? importedTrade.symbol : form.symbol.trim().toUpperCase(),
      side: importedTrade ? importedTrade.side : form.side,
      size: importedTrade ? importedTrade.size : numbers.size,
      entry: importedTrade ? importedTrade.entry : numbers.entry,
      exit: importedTrade ? importedTrade.exit : numbers.exit,
      profit: importedTrade ? importedTrade.profit : pnl,
      swaps: importedTrade ? importedTrade.swaps : 0,
      commission: importedTrade ? importedTrade.commission : 0,
      pnl,
      risk: nextRisk,
      initialSlPrice: nextSl,
      riskSource: nextRisk === null ? null : riskChanged || !locked ? 'MANUAL' : importedTrade.riskSource,
      r: rMultiple(pnl, nextRisk),
      opened: importedTrade ? importedTrade.opened : form.opened,
      closed: importedTrade ? importedTrade.closed : form.closed,
      closes: trade?.closes ?? 1,
      comment: trade?.comment ?? 'Manual entry',
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      notes: form.notes.trim(),
    })
  }

  return (
    <div className="modal-backdrop trade-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-editor-title">
        <button className="trade-modal-close" onClick={onClose} aria-label="Close" type="button"><X size={20} /></button>
        <h2 id="trade-editor-title">{trade ? 'Edit trade' : 'Add trade'}</h2>
        {!locked && <p className="trade-modal-subtitle">{trade ? 'Manual trade' : 'Enter a trade by hand, for example one that isn’t in a broker file.'}</p>}
        {importedTrade && <div className="trade-lock-note">Imported from Eightcap (ticket {importedTrade.ticket}). Prices, size, time and P&amp;L come from the broker file and are locked. You can change the stop-loss or risk amount used for R.</div>}

        <form className="trade-form" onSubmit={save} noValidate>
          <div className="trade-form-grid">
            <label className="trade-form-field trade-form-full">
              <span>Account</span>
              <select value={accountLabel} disabled>
                <option>{accountLabel}</option>
              </select>
            </label>
            <label className="trade-form-field">
              <span>Pair</span>
              <input value={form.symbol} disabled={locked} list="trade-symbols" placeholder="e.g. XAUUSD" autoComplete="off" onChange={(event) => update('symbol', event.target.value)} />
              <datalist id="trade-symbols"><option value="XAUUSD" /><option value="BTCUSD" /><option value="EURUSD" /><option value="GBPUSD" /><option value="USDJPY" /><option value="NAS100" /><option value="US30" /></datalist>
              {errors.symbol && <small>{errors.symbol}</small>}
            </label>
            <div className="trade-form-field">
              <span>Side</span>
              <div className="trade-side-segment" role="group" aria-label="Trade side">
                {(['LONG', 'SHORT'] as const).map((side) => (
                  <button
                    className={`${form.side === side ? `trade-side-active trade-side-${side.toLowerCase()}` : ''}`}
                    key={side}
                    type="button"
                    disabled={locked}
                    aria-pressed={form.side === side}
                    onClick={() => update('side', side)}
                  >{side === 'LONG' ? 'Long' : 'Short'}</button>
                ))}
              </div>
            </div>
            <label className="trade-form-field">
              <span>Size (lots)</span>
              <input type="number" step="0.01" min="0" inputMode="decimal" value={form.size} disabled={locked} onChange={(event) => update('size', event.target.value)} />
              {errors.size && <small>{errors.size}</small>}
            </label>
            <label className="trade-form-field">
              <span>Open time · local</span>
              <input type="datetime-local" value={form.opened} disabled={locked} onChange={(event) => update('opened', event.target.value)} />
              {errors.opened && <small>{errors.opened}</small>}
            </label>
            <label className="trade-form-field">
              <span>Closed · local</span>
              <input type="datetime-local" value={form.closed} disabled={locked} onChange={(event) => update('closed', event.target.value)} />
              {errors.closed && <small>{errors.closed}</small>}
            </label>
            <label className="trade-form-field">
              <span>Entry price</span>
              <input type="number" step="any" inputMode="decimal" value={form.entry} disabled={locked} onChange={(event) => update('entry', event.target.value)} />
              {errors.entry && <small>{errors.entry}</small>}
            </label>
            <label className="trade-form-field">
              <span>Exit price</span>
              <input type="number" step="any" inputMode="decimal" value={form.exit} disabled={locked} onChange={(event) => update('exit', event.target.value)} />
              {errors.exit && <small>{errors.exit}</small>}
            </label>
            <label className="trade-form-field trade-form-full">
              <span>P&amp;L (USD, after swap/commission)</span>
              <input type="number" step="any" inputMode="decimal" value={form.pnl} disabled={locked} onChange={(event) => update('pnl', event.target.value)} />
              <span className="trade-field-hint">{form.pnl ? 'Entered manually. Include swap and commission.' : 'Enter net closed P&L.'}</span>
              {errors.pnl && <small>{errors.pnl}</small>}
            </label>
            <label className="trade-form-field">
              <span>Stop-loss price <em>Optional</em></span>
              <input type="number" step="any" inputMode="decimal" value={form.stopLoss} disabled={form.riskInput === 'RISK' && Boolean(form.risk)} onChange={(event) => { setForm((current) => ({ ...current, stopLoss: event.target.value, risk: '', riskInput: 'SL' })); setErrors((current) => ({ ...current, risk: undefined })) }} />
            </label>
            <label className="trade-form-field">
              <span>or Risk amount, USD <em>Optional</em></span>
              <input type="number" step="any" min="0" inputMode="decimal" value={form.risk} disabled={form.riskInput === 'SL' && Boolean(form.stopLoss)} onChange={(event) => { setForm((current) => ({ ...current, risk: event.target.value, stopLoss: '', riskInput: 'RISK' })); setErrors((current) => ({ ...current, risk: undefined })) }} />
              {errors.risk && <small>{errors.risk}</small>}
            </label>
            <div className="trade-preview trade-form-full" aria-live="polite">
              {calculatedRisk !== null
                ? <>Risk {calculatedRisk.toFixed(2)} USD · R = <strong className={calculatedR === null ? '' : calculatedR >= 0 ? 'positive' : 'negative'}>{calculatedR === null ? '—' : `${calculatedR >= 0 ? '+' : ''}${calculatedR.toFixed(2)}R`}</strong></>
                : <span>No SL or risk amount: R won’t be calculated (shown as —).</span>}
              {stopOnProfitSide && <span className="trade-form-warning">This SL is on the profit side of the entry price.</span>}
            </div>
            {!locked && (
              <>
                <label className="trade-form-field">
                  <span>Broker ticket <em>Optional</em></span>
                  <input value={form.ticket} onChange={(event) => update('ticket', event.target.value)} />
                </label>
                <label className="trade-form-field">
                  <span>Tags <em>Optional, comma-separated</em></span>
                  <input value={form.tags} onChange={(event) => update('tags', event.target.value)} />
                </label>
                <label className="trade-form-field trade-form-full">
                  <span>Notes <em>Optional</em></span>
                  <textarea rows={2} value={form.notes} onChange={(event) => update('notes', event.target.value)} />
                </label>
              </>
            )}
            {locked && (
              <>
                <label className="trade-form-field trade-form-full">
                  <span>Tags <em>Optional, comma-separated</em></span>
                  <input value={form.tags} onChange={(event) => update('tags', event.target.value)} />
                </label>
                <label className="trade-form-field trade-form-full">
                  <span>Notes <em>Optional</em></span>
                  <textarea rows={2} value={form.notes} onChange={(event) => update('notes', event.target.value)} />
                </label>
              </>
            )}
          </div>
          <div className="trade-modal-footer">
            <span className="trade-modal-error" role="alert">{Object.values(errors).find(Boolean) || ''}</span>
            <button className="secondary-button" onClick={onClose} type="button">Cancel</button>
            <button className="confirm-button trade-save-button" type="submit">Save trade</button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default TradeEditorModal
