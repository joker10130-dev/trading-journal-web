export type TradingAccount = {
  id: number
  name: string
  broker: string
  currency: string
  brokerLogin: string | null
  tradesReportUtcOffsetMinutes: number | null
}

export type CreateTradingAccountRequest = {
  name: string
  broker: string
  currency: string
  brokerLogin: string | null
  tradesReportUtcOffsetMinutes: number | null
}

export class TradingAccountRequestError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Trading account request failed with status ${status}.`)
    this.name = 'TradingAccountRequestError'
    this.status = status
  }
}

function isTradingAccount(value: unknown): value is TradingAccount {
  if (typeof value !== 'object' || value === null) return false
  const account = value as Record<string, unknown>
  return typeof account.id === 'number'
    && typeof account.name === 'string'
    && typeof account.broker === 'string'
    && typeof account.currency === 'string'
    && (typeof account.brokerLogin === 'string' || account.brokerLogin === null)
    && (typeof account.tradesReportUtcOffsetMinutes === 'number' || account.tradesReportUtcOffsetMinutes === null)
}

async function tradingAccountRequest<T>(
  path: string,
  accessToken: string,
  method: 'GET' | 'POST',
  body?: CreateTradingAccountRequest,
  validate?: (value: unknown) => value is T,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw new TradingAccountRequestError(response.status)

  const payload: unknown = await response.json()
  if (!validate || !validate(payload)) throw new Error('The trading account response was invalid.')
  return payload
}

function isTradingAccountList(value: unknown): value is TradingAccount[] {
  return Array.isArray(value) && value.every(isTradingAccount)
}

export function listTradingAccounts(accessToken: string): Promise<TradingAccount[]> {
  return tradingAccountRequest('/api/v1/trading-accounts', accessToken, 'GET', undefined, isTradingAccountList)
}

export function createTradingAccount(
  accessToken: string,
  account: CreateTradingAccountRequest,
): Promise<TradingAccount> {
  return tradingAccountRequest('/api/v1/trading-accounts', accessToken, 'POST', account, isTradingAccount)
}
