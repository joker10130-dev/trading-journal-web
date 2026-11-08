import { useCallback, useEffect, useRef, useState } from 'react'
import AccountSetupScreen from './components/account-setup-screen'
import AuthScreen from './components/auth-screen'
import DashboardScreen from './components/dashboard-screen'
import ImportDialog from './components/import-dialog'
import TradeManagementScreen from './components/trade-management-screen'
import TagManagementScreen from './components/tag-management-screen'
import { AuthRequestError, requestSessionRefresh, requestSignOut, type AuthSession } from './lib/auth'
import { listTradingAccounts, TradingAccountRequestError, type TradingAccount } from './lib/accounts'
import './App.css'

function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState('')
  const [accountsRetry, setAccountsRetry] = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showTradeList, setShowTradeList] = useState(false)
  const [showTagManagement, setShowTagManagement] = useState(false)
  const [dashboardRefresh, setDashboardRefresh] = useState(0)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const requireAuthentication = useCallback(() => {
    setAuthSession(null)
    setAuthNotice('Your session expired. Please sign in again.')
  }, [])

  useEffect(() => {
    let active = true
    requestSessionRefresh()
      .then((session) => {
        if (active) setAuthSession(session)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof AuthRequestError && error.status === 401) {
          setAuthSession(null)
          return
        }
        setAuthNotice('Unable to restore your session. Please sign in again.')
      })
      .finally(() => {
        if (active) setAuthLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!authSession) return

    let active = true
    listTradingAccounts(authSession.accessToken)
      .then((accounts) => {
        if (active) setTradingAccounts(accounts)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof TradingAccountRequestError && error.status === 401) {
          setAuthSession(null)
          setAuthNotice('Your session expired. Please sign in again.')
          return
        }
        setAccountsError('Unable to load your trading accounts. Please try again.')
      })
      .finally(() => {
        if (active) setAccountsLoading(false)
      })
    return () => {
      active = false
    }
  }, [authSession, accountsRetry])

  useEffect(() => {
    if (!showUserMenu) return

    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && !userMenuRef.current?.contains(event.target)) {
        setShowUserMenu(false)
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowUserMenu(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showUserMenu])

  async function signOut() {
    setShowUserMenu(false)
    let signOutFailed = false
    try {
      await requestSignOut()
    } catch (error) {
      console.error('Sign-out request failed.', error)
      signOutFailed = true
    }
    setAuthSession(null)
    setAuthNotice(signOutFailed ? 'Sign-out could not be confirmed by the server. Please try again later.' : null)
    setTradingAccounts([])
    setAccountsError('')
    setAccountsLoading(false)
    setShowImport(false)
    setShowTradeList(false)
    setShowTagManagement(false)
  }

  return (
    <div className="app-shell">
      {authLoading
        ? <main className="auth-screen" aria-busy="true"><p role="status">Checking your session…</p></main>
        : !authSession
          ? <AuthScreen
              notice={authNotice}
              onAuthenticated={(session) => {
                setAccountsLoading(true)
                setAuthSession(session)
                setAuthNotice(null)
              }}
            />
          : accountsLoading
            ? <main className="auth-screen" aria-busy="true"><p role="status">Loading your trading accounts…</p></main>
            : accountsError
              ? <main className="auth-screen">
                  <section className="auth-card" aria-labelledby="accounts-error-title">
                    <h1 id="accounts-error-title">Could not load accounts</h1>
                    <p className="auth-subtitle">{accountsError}</p>
                    <button
                      className="auth-submit"
                      onClick={() => {
                        setAccountsLoading(true)
                        setAccountsError('')
                        setAccountsRetry((current) => current + 1)
                      }}
                      type="button"
                    >
                      Retry
                    </button>
                  </section>
                </main>
              : tradingAccounts.length === 0
                ? <AccountSetupScreen
                    accessToken={authSession.accessToken}
                    onCreated={(account) => {
                      setTradingAccounts([account])
                      setAccountsError('')
                    }}
                    onAuthenticationRequired={requireAuthentication}
                  />
                : <>
                    <header className="app-header">
                      <a className="brand" href="#dashboard">Trading Journal</a>
                      <nav className="main-navigation" aria-label="Main navigation">
                        <button
                          aria-current={!showTradeList && !showTagManagement ? 'page' : undefined}
                          onClick={() => { setShowTradeList(false); setShowTagManagement(false) }}
                          type="button"
                        >
                          Dashboard
                        </button>
                        <button
                          aria-current={showTradeList ? 'page' : undefined}
                          onClick={() => { setShowTradeList(true); setShowTagManagement(false) }}
                          type="button"
                        >
                          Trades
                        </button>
                        <button
                          aria-current={showTagManagement ? 'page' : undefined}
                          onClick={() => { setShowTradeList(false); setShowTagManagement(true) }}
                          type="button"
                        >
                          Tags
                        </button>
                      </nav>
                      <button className="trade-add-button" onClick={() => setShowImport(true)} type="button">
                        Import
                      </button>
                      <div className="account-menu" ref={userMenuRef}>
                        <button
                          className="account-trigger"
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={showUserMenu}
                          aria-label="Account menu"
                          onClick={() => setShowUserMenu((open) => !open)}
                        >
                          <span className="account-avatar" aria-hidden="true">
                            {authSession.email.split('@')[0].slice(0, 2).toUpperCase()}
                          </span>
                        </button>
                        {showUserMenu && (
                          <div className="account-dropdown" role="menu">
                            <div className="account-menu-heading">
                              <strong>Trader</strong>
                              <span>{authSession.email}</span>
                            </div>
                            <button
                              className="account-menu-item account-signout"
                              type="button"
                              role="menuitem"
                              onClick={() => { void signOut() }}
                            >
                              Sign out
                            </button>
                          </div>
                        )}
                      </div>
                    </header>

                    {showTagManagement
                      ? <TagManagementScreen
                          accessToken={authSession.accessToken}
                          onAuthenticationRequired={requireAuthentication}
                        />
                      : showTradeList
                        ? <TradeManagementScreen
                          accounts={tradingAccounts}
                          accessToken={authSession.accessToken}
                          onAuthenticationRequired={requireAuthentication}
                          />
                        : <DashboardScreen
                          accounts={tradingAccounts}
                          accessToken={authSession.accessToken}
                          refreshKey={dashboardRefresh}
                          onAuthenticationRequired={requireAuthentication}
                        />}

                    {showImport && (
                      <ImportDialog
                        accounts={tradingAccounts}
                        accessToken={authSession.accessToken}
                        onClose={() => setShowImport(false)}
                        onAuthenticationRequired={() => {
                          requireAuthentication()
                          setShowImport(false)
                        }}
                        onImported={() => setDashboardRefresh((current) => current + 1)}
                      />
                    )}
                  </>}
    </div>
  )
}

export default App
