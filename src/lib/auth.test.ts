import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmPasswordReset, requestPasswordReset, requestSessionRefresh, requestSignIn, requestSignOut, requestSignUp } from './auth'

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

  it('requests a password reset without revealing whether the email exists', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ message: 'If an account exists for this email, password-reset instructions will be sent.' }, { status: 202 }),
    )

    await expect(requestPasswordReset(' Trader@Example.com ')).resolves.toBe(
      'If an account exists for this email, password-reset instructions will be sent.',
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/password-reset/request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'trader@example.com' }),
    })
  })

  it('confirms a password reset with the one-time token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await expect(confirmPasswordReset('one-time-token', 'ten-character-password')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'one-time-token', newPassword: 'ten-character-password' }),
    })
  })

  it('surfaces unsuccessful server responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 503 }),
    )

    await expect(requestSignOut()).rejects.toThrow('Authentication request failed with status 503.')
  })
})
