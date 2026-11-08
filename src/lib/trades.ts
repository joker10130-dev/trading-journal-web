export type TradePage = {
  content: TradeRecord[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type TradeRecord = {
  id: number
  tradingAccountId: number
  ticket: string | null
  symbol: string
  side: 'LONG' | 'SHORT'
  status: string
  openedAt: string | null
  closedAt: string | null
  deletedAt: string | null
  openPrice: number | null
  closePrice: number | null
  volume: number | null
  grossPnl: number
  feesAndSwap: number
  netPnl: number
  rMultiple: number | null
  rSource: 'MANUAL' | 'NONE'
  rFlag: string | null
  hasTradesReport: boolean
  hasTradingViewData: boolean
  closeCount: number
  tags: string[]
}

export type TradeCloseRecord = {
  id: number
  source: string
  volume: number
  closeTimeServer: string | null
  closedAt: string | null
  closePrice: number
  grossPnl: number
  swaps: number
  commission: number
  netPnl: number
  rMultiple: number | null
}

export type TradeDetailRecord = Omit<TradeRecord, 'deletedAt' | 'closePrice' | 'closeCount'> & {
  openTimeServer: string | null
  openedVolume: number | null
  hasTradesReport: boolean
  hasTradingViewData: boolean
  closes: TradeCloseRecord[]
}

export type ManualTradeRequest = {
  ticket: string | null
  symbol: string
  side: 'LONG' | 'SHORT'
  volume: number
  openedAt: string
  closedAt: string
  openPrice: number
  closePrice: number
  profit: number
  swaps: number
  commission: number
  rMultiple: number | null
}

export type ManualTradeResult = {
  id: number
  ticket: string | null
  symbol: string
  side: 'LONG' | 'SHORT'
  volume: number
  openedAt: string
  closedAt: string
  openPrice: number
  closePrice: number
  profit: number
  swaps: number
  commission: number
  netPnl: number
  rMultiple: number | null
  rFlag: string | null
  warnings: string[]
}

export class TradeRequestError extends Error {
  readonly status: number

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'TradeRequestError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isTradeRecord(value: unknown): value is TradeRecord {
  if (!isRecord(value)) return false
  return typeof value.id === 'number'
    && typeof value.tradingAccountId === 'number'
    && isNullableString(value.ticket)
    && typeof value.symbol === 'string'
    && (value.side === 'LONG' || value.side === 'SHORT')
    && typeof value.status === 'string'
    && isNullableString(value.openedAt)
    && isNullableString(value.closedAt)
    && isNullableString(value.deletedAt)
    && isNullableNumber(value.openPrice)
    && isNullableNumber(value.closePrice)
    && isNullableNumber(value.volume)
    && typeof value.grossPnl === 'number'
    && typeof value.feesAndSwap === 'number'
    && typeof value.netPnl === 'number'
    && isNullableNumber(value.rMultiple)
    && (value.rSource === 'MANUAL' || value.rSource === 'NONE')
    && isNullableString(value.rFlag)
    && typeof value.hasTradesReport === 'boolean'
    && typeof value.hasTradingViewData === 'boolean'
    && typeof value.closeCount === 'number'
    && Array.isArray(value.tags)
    && value.tags.every((tag) => typeof tag === 'string')
}

function isTradePage(value: unknown): value is TradePage {
  return isRecord(value)
    && Array.isArray(value.content)
    && value.content.every(isTradeRecord)
    && typeof value.page === 'number'
    && typeof value.size === 'number'
    && typeof value.totalElements === 'number'
    && typeof value.totalPages === 'number'
}

function isTradeCloseRecord(value: unknown): value is TradeCloseRecord {
  if (!isRecord(value)) return false
  return typeof value.id === 'number'
    && typeof value.source === 'string'
    && typeof value.volume === 'number'
    && isNullableString(value.closeTimeServer)
    && isNullableString(value.closedAt)
    && typeof value.closePrice === 'number'
    && typeof value.grossPnl === 'number'
    && typeof value.swaps === 'number'
    && typeof value.commission === 'number'
    && typeof value.netPnl === 'number'
    && isNullableNumber(value.rMultiple)
}

function isTradeDetail(value: unknown): value is TradeDetailRecord {
  return isRecord(value)
    && typeof value.id === 'number'
    && typeof value.tradingAccountId === 'number'
    && isNullableString(value.ticket)
    && typeof value.symbol === 'string'
    && (value.side === 'LONG' || value.side === 'SHORT')
    && typeof value.status === 'string'
    && isNullableString(value.openedAt)
    && isNullableString(value.openTimeServer)
    && isNullableNumber(value.openPrice)
    && isNullableNumber(value.openedVolume)
    && typeof value.grossPnl === 'number'
    && typeof value.feesAndSwap === 'number'
    && typeof value.netPnl === 'number'
    && isNullableNumber(value.rMultiple)
    && (value.rSource === 'MANUAL' || value.rSource === 'NONE')
    && isNullableString(value.rFlag)
    && typeof value.hasTradesReport === 'boolean'
    && typeof value.hasTradingViewData === 'boolean'
    && Array.isArray(value.closes)
    && value.closes.every(isTradeCloseRecord)
}

function isManualTradeResult(value: unknown): value is ManualTradeResult {
  return isRecord(value)
    && typeof value.id === 'number'
    && isNullableString(value.ticket)
    && typeof value.symbol === 'string'
    && (value.side === 'LONG' || value.side === 'SHORT')
    && typeof value.volume === 'number'
    && typeof value.openedAt === 'string'
    && typeof value.closedAt === 'string'
    && typeof value.openPrice === 'number'
    && typeof value.closePrice === 'number'
    && typeof value.profit === 'number'
    && typeof value.swaps === 'number'
    && typeof value.commission === 'number'
    && typeof value.netPnl === 'number'
    && isNullableNumber(value.rMultiple)
    && isNullableString(value.rFlag)
    && Array.isArray(value.warnings)
    && value.warnings.every((warning) => typeof warning === 'string')
}

async function request<T>(
  path: string,
  accessToken: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  validate: (value: unknown) => value is T,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const payload: unknown = await response.json()
    const detail = isRecord(payload) && typeof payload.detail === 'string'
      ? payload.detail
      : `Trade request failed with status ${response.status}.`
    throw new TradeRequestError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  const payload: unknown = await response.json()
  if (!validate(payload)) throw new Error('The trade response was invalid.')
  return payload
}

export function listTrades(
  accountId: number,
  accessToken: string,
  options: { page: number; size: number; symbol?: string; from?: string; to?: string; tagIds?: number[]; deleted?: boolean },
): Promise<TradePage> {
  const query = new URLSearchParams({ page: String(options.page), size: String(options.size) })
  if (options.symbol) query.set('symbol', options.symbol)
  if (options.from) query.set('from', options.from)
  if (options.to) query.set('to', options.to)
  options.tagIds?.forEach((tagId) => query.append('tagIds', String(tagId)))
  const deletedPath = options.deleted ? '/deleted' : ''
  return request(`/api/v1/trading-accounts/${accountId}/trades${deletedPath}?${query}`, accessToken, 'GET', isTradePage)
}

export function getTrade(tradeId: string, accessToken: string): Promise<TradeDetailRecord> {
  return request(`/api/v1/trades/${tradeId}`, accessToken, 'GET', isTradeDetail)
}

export function createManualTrade(
  accountId: number,
  trade: ManualTradeRequest,
  accessToken: string,
): Promise<ManualTradeResult> {
  return request(`/api/v1/trading-accounts/${accountId}/trades`, accessToken, 'POST', isManualTradeResult, trade)
}

export function updateManualTrade(
  accountId: number,
  tradeId: string,
  trade: ManualTradeRequest,
  accessToken: string,
): Promise<ManualTradeResult> {
  return request(`/api/v1/trading-accounts/${accountId}/trades/${tradeId}`, accessToken, 'PUT', isManualTradeResult, trade)
}

export function updateTradeR(tradeId: string, rMultiple: number | null, accessToken: string) {
  return request(`/api/v1/trades/${tradeId}/r`, accessToken, 'PUT', isTradeR, { rMultiple })
}

function isTradeR(value: unknown): value is { id: number; rMultiple: number | null; rSource: 'MANUAL' | 'NONE'; rFlag: string | null } {
  return isRecord(value)
    && typeof value.id === 'number'
    && isNullableNumber(value.rMultiple)
    && (value.rSource === 'MANUAL' || value.rSource === 'NONE')
    && isNullableString(value.rFlag)
}

export function deleteTrade(tradeId: string, accessToken: string) {
  return request(`/api/v1/trades/${tradeId}`, accessToken, 'DELETE', isEmptyResponse)
}

export function restoreTrade(tradeId: string, accessToken: string) {
  return request(`/api/v1/trades/${tradeId}/restore`, accessToken, 'PUT', isEmptyResponse)
}

function isEmptyResponse(value: unknown): value is undefined {
  return value === undefined
}
