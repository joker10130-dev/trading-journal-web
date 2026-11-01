import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import AuthScreen from './auth-screen'

afterEach(() => vi.unstubAllGlobals())

it('offers password reset from the sign-in screen', () => {
  const markup = renderToStaticMarkup(createElement(AuthScreen, { onAuthenticated: vi.fn() }))

  expect(markup).toContain('Forgot password?')
})

it('shows password confirmation when opened with a reset token', () => {
  vi.stubGlobal('window', {
    location: { search: '?token=reset-token' },
    history: { replaceState: vi.fn() },
  })

  const markup = renderToStaticMarkup(createElement(AuthScreen, { onAuthenticated: vi.fn() }))

  expect(markup).toContain('Choose a new password')
  expect(markup).toContain('Confirm password')
})
