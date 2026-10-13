import { useState, type FormEvent } from 'react'
import { LogIn, TrendingUp } from 'lucide-react'

type AuthScreenProps = {
  onAuthenticated: (email: string) => void
}

type AuthView = 'login' | 'signup'
type AuthErrors = Partial<Record<'email' | 'password' | 'confirmPassword' | 'form', string>>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emailError(email: string) {
  if (!email.trim()) return 'Enter your email.'
  if (!emailPattern.test(email.trim())) return 'Enter a valid email address.'
  return ''
}

function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [view, setView] = useState<AuthView>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<AuthErrors>({})

  function switchView(nextView: AuthView) {
    setView(nextView)
    setPassword('')
    setConfirmPassword('')
    setErrors({})
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: AuthErrors = {}
    const invalidEmail = emailError(email)
    if (invalidEmail) nextErrors.email = invalidEmail
    if (!password) nextErrors.password = 'Enter your password.'
    if (password === 'wrong') nextErrors.form = 'Email or password is incorrect.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onAuthenticated(email.trim())
  }

  function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: AuthErrors = {}
    const invalidEmail = emailError(email)
    if (invalidEmail) nextErrors.email = invalidEmail
    if (password.length < 10) nextErrors.password = 'Use at least 10 characters.'
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onAuthenticated(email.trim())
  }

  return (
    <main className="auth-screen">
      <div className="auth-stack">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-brand">
            <span className="auth-brand-icon"><TrendingUp size={22} aria-hidden="true" /></span>
            <span><strong>Trading Journal</strong></span>
          </div>
          <div className="auth-eyebrow">Your trading workspace</div>
          <h1 id="auth-title">{view === 'login' ? 'Welcome back' : 'Create an account'}</h1>
          <p className="auth-subtitle">
            {view === 'login'
              ? 'Sign in to review your trading performance.'
              : 'Create your workspace and start reviewing your trades.'}
          </p>

          <form className="auth-form" noValidate onSubmit={view === 'login' ? signIn : createAccount}>
            {errors.form && <div className="auth-alert" role="alert">{errors.form}</div>}
            <div className={`auth-field ${errors.email ? 'auth-field-error' : ''}`}>
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="username"
                value={email}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'auth-email-error' : undefined}
                onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined, form: undefined })) }}
              />
              {errors.email && <span className="auth-error" id="auth-email-error">{errors.email}</span>}
            </div>

            <div className={`auth-field ${errors.password ? 'auth-field-error' : ''}`}>
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                value={password}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'auth-password-error' : view === 'signup' ? 'auth-password-hint' : undefined}
                onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined, form: undefined })) }}
              />
              {view === 'signup' && <span className="auth-hint" id="auth-password-hint">At least 10 characters.</span>}
              {errors.password && <span className="auth-error" id="auth-password-error">{errors.password}</span>}
            </div>

            {view === 'signup' && (
              <div className={`auth-field ${errors.confirmPassword ? 'auth-field-error' : ''}`}>
                <label htmlFor="auth-confirm-password">Confirm password</label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'auth-confirm-password-error' : undefined}
                  onChange={(event) => { setConfirmPassword(event.target.value); setErrors((current) => ({ ...current, confirmPassword: undefined })) }}
                />
                {errors.confirmPassword && <span className="auth-error" id="auth-confirm-password-error">{errors.confirmPassword}</span>}
              </div>
            )}

            <button className="auth-submit" type="submit">
              {view === 'login' && <LogIn size={18} aria-hidden="true" />}
              {view === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            {view === 'login' ? 'New to Trading Journal?' : 'Already have an account?'}{' '}
            <button className="auth-link" type="button" onClick={() => switchView(view === 'login' ? 'signup' : 'login')}>
              {view === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </section>
        <p className="auth-privacy">Your trade history stays yours. We never place trades or make investment decisions for you.</p>
        <p className="auth-demo-note">
          Demo only: authentication is not connected to an API. Use any valid email and password to sign in; use “wrong” to test the error state.
        </p>
      </div>
    </main>
  )
}

export default AuthScreen
