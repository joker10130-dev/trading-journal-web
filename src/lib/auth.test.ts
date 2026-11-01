import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestSessionRefresh, requestSignIn, requestSignOut, requestSignUp } from './auth'

describe('authentication requests', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('signs in and keeps the access token in the returned in-memory session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        accessToken: 'signed-in-token',
        tokenType: 'Bearer',
        expiresAt: '2026-10-18T21:30:00Z',
      }),
    )

    await expect(requestSignIn(' Trader@Example.com ', 'password')).resolves.toEqual({
      email: 'trader@example.com',
      accessToken: 'signed-in-token',
      expiresAt: '2026-10-18T21:30:00Z',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/sign-in', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'trader@example.com', password: 'password' }),
    })
  })

  it('signs up with cookies included', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        accessToken: 'signed-up-token',
        tokenType: 'Bearer',
        expiresAt: '2026-10-18T21:30:00Z',
      }, { status: 201 }),
    )

    await requestSignUp('new@example.com', 'long-password')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/sign-up', expect.objectContaining({
      credentials: 'include',
      body: JSON.stringify({ email: 'new@example.com', password: 'long-password' }),
    }))
  })

  it('restores the user from the subject in a refreshed access token', async () => {
    const payload = btoa(JSON.stringify({ sub: 'trader@example.com' }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        accessToken: `header.${payload}.signature`,
        tokenType: 'Bearer',
        expiresAt: '2026-10-18T21:30:00Z',
      }),
    )

    await expect(requestSessionRefresh()).resolves.toEqual({
      email: 'trader@example.com',
      accessToken: `header.${payload}.signature`,
      expiresAt: '2026-10-18T21:30:00Z',
    })
  })

  it('posts to the sign-out endpoint with cookies included', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await requestSignOut()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    })
  })

  it('surfaces unsuccessful server responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 503 }),
    )

    await expect(requestSignOut()).rejects.toThrow('Authentication request failed with status 503.')
  })
})
