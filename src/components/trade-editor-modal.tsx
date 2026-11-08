import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { parseManualR, rSourceFor, type Trade } from '../lib/trade'

type TradeEditorModalProps = {
  trade: Trade | null
  accountLabel: string
  onClose: () => void
  onSave: (trade: Trade) => void
}

type FieldName = 'symbol' | 'size' | 'opened' | 'closed' | 'entry' | 'exit' | 'profit' | 'swaps' | 'commission' | 'r'
type FormErrors = Partial<Record<FieldName, string>>

type FormValues = {
  symbol: string
  side: Trade['side']
  size: string
  opened: string
  closed: string
  entry: string
  exit: string
  profit: string
  swaps: string
  commission: string
  r: string
  ticket: string
}

const parseNumber = (value: string) => value === '' ? Number.NaN : Number(value)
const valueClass = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'

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
    closed: trade?.closed?.slice(0, 16) ?? localDateTime(now),
    entry: trade ? String(trade.entry) : '',
    exit: trade ? String(trade.exit) : '',
    profit: trade ? String(trade.profit) : '',
    swaps: trade ? String(trade.swaps) : '0',
    commission: trade ? String(trade.commission) : '0',
    r: trade?.r === null || trade?.r === undefined ? '' : String(trade.r),
    ticket: trade?.ticket ?? '',
  }
}

function TradeEditorModal({ trade, accountLabel, onClose, onSave }: TradeEditorModalProps) {
  const [form, setForm] = useState(() => initialForm(trade))
  const [errors, setErrors] = useState<FormErrors>({})
  const importedTrade = trade?.source === 'IMPORT' ? trade : null
  const locked = importedTrade !== null
  const numbers = {
    size: parseNumber(form.size),
    entry: parseNumber(form.entry),
    exit: parseNumber(form.exit),
    profit: parseNumber(form.profit),
    swaps: parseNumber(form.swaps),
    commission: parseNumber(form.commission),
  }
  const enteredR = parseManualR(form.r)

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
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
      if (!Number.isFinite(numbers.profit)) nextErrors.profit = 'Enter gross profit in USD.'
      if (!Number.isFinite(numbers.swaps)) nextErrors.swaps = 'Enter a valid swap amount.'
      if (!Number.isFinite(numbers.commission)) nextErrors.commission = 'Enter a valid commission.'
    }
    if (form.r && enteredR === null) nextErrors.r = 'Enter a valid R value.'
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const profit = importedTrade ? importedTrade.profit : numbers.profit
    const swaps = importedTrade ? importedTrade.swaps : numbers.swaps
    const commission = importedTrade ? importedTrade.commission : numbers.commission
    const pnl = importedTrade ? importedTrade.pnl : profit + swaps + commission
    const r = enteredR

    onSave({
      id: trade?.id ?? crypto.randomUUID(),
      ticket: form.ticket.trim(),
      source: trade?.source ?? 'MANUAL',
      symbol: importedTrade ? importedTrade.symbol : form.symbol.trim().toUpperCase(),
      side: importedTrade ? importedTrade.side : form.side,
      size: importedTrade ? importedTrade.size : numbers.size,
      entry: importedTrade ? importedTrade.entry : numbers.entry,
      exit: importedTrade ? importedTrade.exit : numbers.exit,
      profit,
      swaps,
      commission,
      pnl,
      r,
      rSource: rSourceFor(r),
      opened: importedTrade ? importedTrade.opened : form.opened,
      closed: importedTrade ? importedTrade.closed : form.closed,
      closes: trade?.closes ?? 1,
      comment: trade?.comment ?? 'Manual entry',
      tags: trade?.tags ?? [],
      notes: trade?.notes ?? '',
    })
  }

  return (
    <div className="modal-backdrop trade-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-editor-title">
        <button className="trade-modal-close" onClick={onClose} aria-label="Close" type="button"><X size={20} /></button>
        <h2 id="trade-editor-title">{trade ? 'Edit trade' : 'Add trade'}</h2>
        {!locked && <p className="trade-modal-subtitle">{trade ? 'Manual trade' : 'Enter a trade by hand, for example one that isn’t in a broker file.'}</p>}
        {importedTrade && <div className="trade-lock-note">Imported from Eightcap (ticket {importedTrade.ticket}). Prices, size, time and P&amp;L come from the broker file and are locked. You can enter or edit R manually.</div>}

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
              <span>Gross profit (USD)</span>
              <input type="number" step="any" inputMode="decimal" value={form.profit} disabled={locked} onChange={(event) => update('profit', event.target.value)} />
              {errors.profit && <small>{errors.profit}</small>}
            </label>
            {!locked && (
              <>
                <label className="trade-form-field">
                  <span>Swap (USD)</span>
                  <input type="number" step="any" inputMode="decimal" value={form.swaps} onChange={(event) => update('swaps', event.target.value)} />
                  {errors.swaps && <small>{errors.swaps}</small>}
                </label>
                <label className="trade-form-field">
                  <span>Commission (USD)</span>
                  <input type="number" step="any" inputMode="decimal" value={form.commission} onChange={(event) => update('commission', event.target.value)} />
                  {errors.commission && <small>{errors.commission}</small>}
                </label>
                <div className="trade-preview trade-form-full" aria-live="polite">
                  Net P&amp;L: <strong className={valueClass(numbers.profit + numbers.swaps + numbers.commission)}>
                    {Number.isFinite(numbers.profit + numbers.swaps + numbers.commission)
                      ? `${(numbers.profit + numbers.swaps + numbers.commission).toFixed(2)} USD`
                      : 'Enter valid amounts'}
                  </strong>
                </div>
              </>
            )}
            <label className="trade-form-field">
              <span>R multiple <em>Optional · entered manually</em></span>
              <input type="number" step="any" inputMode="decimal" value={form.r} onChange={(event) => update('r', event.target.value)} />
              {errors.r && <small>{errors.r}</small>}
            </label>
            <div className="trade-preview trade-form-full" aria-live="polite">
              {enteredR !== null
                ? <>Entered R: <strong className={enteredR >= 0 ? 'positive' : 'negative'}>{`${enteredR >= 0 ? '+' : ''}${enteredR.toFixed(2)}R`}</strong></>
                : form.r
                  ? <span>Enter a valid R value.</span>
                : <span>R is not entered and will be excluded from R totals.</span>}
            </div>
            {!locked && (
              <>
                <label className="trade-form-field">
                  <span>Broker ticket <em>Optional</em></span>
                  <input value={form.ticket} onChange={(event) => update('ticket', event.target.value)} />
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
