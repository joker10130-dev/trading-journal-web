import { useState, type FormEvent } from 'react'
import { createTradingAccount, TradingAccountRequestError, type TradingAccount } from '../lib/accounts'

type AccountSetupScreenProps = {
  accessToken: string
  onCreated: (account: TradingAccount) => void
  onAuthenticationRequired: () => void
}

function AccountSetupScreen({ accessToken, onCreated, onAuthenticationRequired }: AccountSetupScreenProps) {
  const [step, setStep] = useState<'prompt' | 'create'>('prompt')
  const [name, setName] = useState('')
  const [broker, setBroker] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [brokerLogin, setBrokerLogin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const account = await createTradingAccount(accessToken, {
        name: name.trim(),
        broker: broker.trim(),
        currency: currency.trim().toUpperCase(),
        brokerLogin: brokerLogin.trim() || null,
        tradesReportUtcOffsetMinutes: null,
      })
      onCreated(account)
    } catch (requestError) {
      if (requestError instanceof TradingAccountRequestError && requestError.status === 401) {
        onAuthenticationRequired()
        return
      }
      setError('Unable to create the trading account. Check the details and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-stack">
        <section className="auth-card" aria-labelledby="account-setup-title">
          <div className="auth-brand"><span className="auth-brand-icon" aria-hidden="true">TJ</span><span><strong>Trading Journal</strong></span></div>
          {step === 'prompt' ? (
            <>
              <div className="auth-eyebrow">One last step</div>
              <h1 id="account-setup-title">Create a trading account</h1>
              <p className="auth-subtitle">Add the account you trade with. You can add more accounts later.</p>
              <button className="auth-submit" onClick={() => setStep('create')} type="button">Continue to account setup</button>
            </>
          ) : (
            <>
              <div className="auth-eyebrow">Trading account</div>
              <h1 id="account-setup-title">Account details</h1>
              <p className="auth-subtitle">Enter the account name, broker, and currency.</p>
              <form className="auth-form" onSubmit={submit}>
                {error && <div className="auth-alert" role="alert">{error}</div>}
                <div className="auth-field">
                  <label htmlFor="account-name">Account name</label>
                  <input id="account-name" autoComplete="off" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="auth-field">
                  <label htmlFor="account-broker">Broker</label>
                  <input id="account-broker" autoComplete="organization" maxLength={120} required value={broker} onChange={(event) => setBroker(event.target.value)} />
                </div>
                <div className="auth-field">
                  <label htmlFor="account-currency">Currency</label>
                  <input id="account-currency" autoComplete="off" maxLength={3} pattern="[A-Za-z]{3}" required value={currency} onChange={(event) => setCurrency(event.target.value)} />
                </div>
                <div className="auth-field">
                  <label htmlFor="account-number">Account number <span className="auth-hint">(optional)</span></label>
                  <input id="account-number" autoComplete="off" maxLength={64} value={brokerLogin} onChange={(event) => setBrokerLogin(event.target.value)} />
                </div>
                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Create trading account'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default AccountSetupScreen
