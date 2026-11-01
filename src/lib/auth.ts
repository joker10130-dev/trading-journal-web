export type AuthSession = {
  email: string
  accessToken: string
  expiresAt: string
}

export class AuthRequestError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Authentication request failed with status ${status}.`)
    this.name = 'AuthRequestError'
    this.status = status
  }
}

type TokenResponse = {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== 'object' || value === null) return false
  const response = value as Record<string, unknown>
  return typeof response.accessToken === 'string'
    && response.tokenType === 'Bearer'
    && typeof response.expiresAt === 'string'
    && Number.isFinite(Date.parse(response.expiresAt))
}

function emailFromToken(token: string) {
  const encodedPayload = token.split('.')[1]
  if (!encodedPayload) throw new Error('The authentication response did not contain a valid access token.')

  const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const bytes = Uint8Array.from(atob(paddedBase64), (character) => character.charCodeAt(0))
  const payload: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('The authentication response did not contain a valid access token.')
  }

  const subject = (payload as Record<string, unknown>).sub
  if (typeof subject !== 'string' || !subject) {
    throw new Error('The authentication response did not contain a valid user.')
  }
  return subject
}

async function requestTokens(path: string, body?: { email: string; password: string }) {
  const response = await fetch(`/api/v1/auth/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw new AuthRequestError(response.status)

  const payload: unknown = await response.json()
  if (!isTokenResponse(payload)) throw new Error('The authentication response was invalid.')
  return payload
}

export async function requestSignIn(email: string, password: string): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase()
  const tokens = await requestTokens('sign-in', { email: normalizedEmail, password })
  return { email: normalizedEmail, accessToken: tokens.accessToken, expiresAt: tokens.expiresAt }
}

export async function requestSignUp(email: string, password: string): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase()
  const tokens = await requestTokens('sign-up', { email: normalizedEmail, password })
  return { email: normalizedEmail, accessToken: tokens.accessToken, expiresAt: tokens.expiresAt }
}

async function refreshSession(): Promise<AuthSession> {
  const tokens = await requestTokens('refresh')
  return {
    email: emailFromToken(tokens.accessToken),
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
  }
}

let refreshInFlight: Promise<AuthSession> | null = null

export function requestSessionRefresh() {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = refreshSession().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

export async function requestSignOut() {
  const response = await fetch('/api/v1/auth/sign-out', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new AuthRequestError(response.status)
  }
}
