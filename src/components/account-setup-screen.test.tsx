import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import AccountSetupScreen from './account-setup-screen'

it('prompts a signed-in user without an account to start account setup', () => {
  const markup = renderToStaticMarkup(createElement(AccountSetupScreen, {
    accessToken: 'access-token',
    onCreated: vi.fn(),
    onAuthenticationRequired: vi.fn(),
  }))

  expect(markup).toContain('Create a trading account')
  expect(markup).toContain('Continue to account setup')
})
