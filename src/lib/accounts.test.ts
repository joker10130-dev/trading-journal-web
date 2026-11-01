import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTradingAccount, listTradingAccounts } from './accounts'

const sampleAccount = {
  id: 12,
  name: 'Main',
  broker: 'Eightcap',
  currency: 'USD',
  brokerLogin: null,
  tradesReportUtcOffsetMinutes: null,
}

describe('trading account requests', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lists only the signed-in user accounts with the bearer token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json([sampleAccount]))

    await expect(listTradingAccounts('access-token')).resolves.toEqual([sampleAccount])
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/trading-accounts', {
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: 'Bearer access-token' },
      body: undefined,
    })
  })

  it('creates an account with optional account number', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(sampleAccount, { status: 201 }))
    const request = {
      name: 'Main',
      broker: 'Eightcap',
      currency: 'USD',
      brokerLogin: null,
      tradesReportUtcOffsetMinutes: null,
    }

    await expect(createTradingAccount('access-token', request)).resolves.toEqual(sampleAccount)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/trading-accounts', {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  })
})
