import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import App from './App'

it('renders the root App component without errors', () => {
  expect(() => renderToStaticMarkup(createElement(App))).not.toThrow()
})
