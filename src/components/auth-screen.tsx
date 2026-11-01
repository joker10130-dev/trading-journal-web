import { useState, type FormEvent } from 'react'
import { LogIn, TrendingUp } from 'lucide-react'
import {
  AuthRequestError,
  confirmPasswordReset,
  requestPasswordReset,
  requestSignIn,
  requestSignUp,
  type AuthSession,
} from '../lib/auth'

type AuthScreenProps = {
  onAuthenticated: (session: AuthSession) => void
  notice?: string | null
}

type AuthView = 'login' | 'signup' | 'password-reset-request' | 'password-reset-confirm'
type AuthErrors = Partial<Record<'email' | 'password' | 'confirmPassword' | 'form', string>>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emailError(email: string) {
  if (!email.trim()) return 'Enter your email.'
  if (!emailPattern.test(email.trim())) return 'Enter a valid email address.'
  return ''
}

function AuthScreen({ onAuthenticated, notice }: AuthScreenProps) {
  const [resetToken] = useState(() => typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('token'))
  const [view, setView] = useState<AuthView>(() => resetToken ? 'password-reset-confirm' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<AuthErrors>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function switchView(nextView: AuthView) {
    setView(nextView)
    setPassword('')
    setConfirmPassword('')
    setErrors({})
    setSuccessMessage('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: AuthErrors = {}
    if (view !== 'password-reset-confirm') {
      const invalidEmail = emailError(email)
      if (invalidEmail) nextErrors.email = invalidEmail
    }

    const needsPassword = view === 'login' || view === 'signup' || view === 'password-reset-confirm'
    const needsStrongPassword = view === 'signup' || view === 'password-reset-confirm'
    if (needsPassword && !password) nextErrors.password = 'Enter your password.'
    if (needsStrongPassword && Array.from(password).length < 10) {
      nextErrors.password = 'Use at least 10 characters.'
    }
    if ((view === 'signup' || view === 'password-reset-confirm') && confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }
    setErrors(nextErrors)
    setSuccessMessage('')
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      if (view === 'login') {
        onAuthenticated(await requestSignIn(email, password))
      } else if (view === 'signup') {
        onAuthenticated(await requestSignUp(email, password))
      } else if (view === 'password-reset-request') {
        setSuccessMessage(await requestPasswordReset(email))
      } else {
        if (!resetToken) throw new Error('The password-reset link is invalid or expired.')
        await confirmPasswordReset(resetToken, password)
        if (typeof window !== 'undefined') window.history.replaceState({}, '', window.location.pathname)
        setPassword('')
        setConfirmPassword('')
        setView('login')
        setSuccessMessage('Password updated. Sign in with your new password.')
      }
    } catch (error) {
      const genericFailure = view === 'login'
        ? error instanceof AuthRequestError && error.status >= 400 && error.status < 500
          ? 'Email or password is incorrect.'
          : 'Unable to sign in right now. Please try again.'
        : view === 'signup'
          ? error instanceof AuthRequestError && error.status >= 400 && error.status < 500
            ? 'Unable to create an account with these details.'
            : 'Unable to create an account right now. Please try again.'
          : view === 'password-reset-request'
            ? 'Unable to request a password reset right now. Please try again.'
            : error instanceof AuthRequestError && error.status === 400
              ? 'Reset link is invalid or expired.'
              : 'Unable to reset your password right now. Please try again.'
      setErrors((current) => ({ ...current, form: genericFailure }))
    } finally {
      setSubmitting(false)
    }
  }

  const title = view === 'login'
    ? 'Welcome back'
    : view === 'signup'
      ? 'Create an account'
      : view === 'password-reset-request'
        ? 'Reset your password'
        : 'Choose a new password'
  const subtitle = view === 'login'
    ? 'Sign in to review your trading performance.'
    : view === 'signup'
      ? 'Create your workspace and start reviewing your trades.'
      : view === 'password-reset-request'
        ? 'Enter your email. If an account exists, we will send reset instructions.'
        : 'Enter a new password for your Trading Journal account.'

  return (
    <main className="auth-screen">
      <div className="auth-stack">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-brand">
            <span className="auth-brand-icon"><TrendingUp size={22} aria-hidden="true" /></span>
            <span><strong>Trading Journal</strong></span>
          </div>
          <div className="auth-eyebrow">Your trading workspace</div>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>

          <form className="auth-form" noValidate onSubmit={submit}>
            {notice && <div className="auth-alert" role="alert">{notice}</div>}
            {successMessage && <div className="auth-success" role="status">{successMessage}</div>}
            {errors.form && <div className="auth-alert" role="alert">{errors.form}</div>}
            {view !== 'password-reset-confirm' && (
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
            )}

            {(view === 'login' || view === 'signup' || view === 'password-reset-confirm') && (
              <div className={`auth-field ${errors.password ? 'auth-field-error' : ''}`}>
                <label htmlFor="auth-password">{view === 'password-reset-confirm' ? 'New password' : 'Password'}</label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'auth-password-error' : view !== 'login' ? 'auth-password-hint' : undefined}
                  onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined, form: undefined })) }}
                />
                {view !== 'login' && <span className="auth-hint" id="auth-password-hint">At least 10 characters.</span>}
                {errors.password && <span className="auth-error" id="auth-password-error">{errors.password}</span>}
              </div>
            )}

            {(view === 'signup' || view === 'password-reset-confirm') && (
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

            <button className="auth-submit" type="submit" disabled={submitting}>
              {view === 'login' && <LogIn size={18} aria-hidden="true" />}
              {submitting
                ? 'Please wait…'
                : view === 'login'
                  ? 'Sign in'
                  : view === 'signup'
                    ? 'Create account'
                    : view === 'password-reset-request'
                      ? 'Send reset link'
                      : 'Update password'}
            </button>
          </form>

          {view === 'login' && (
            <p className="auth-switch">
              New to Trading Journal?{' '}
              <button className="auth-link" type="button" disabled={submitting} onClick={() => switchView('signup')}>Create an account</button>
            </p>
          )}
          {view === 'login' && (
            <p className="auth-switch">
              <button className="auth-link" type="button" disabled={submitting} onClick={() => switchView('password-reset-request')}>Forgot password?</button>
            </p>
          )}
          {view !== 'login' && (
            <p className="auth-switch">
              {view === 'signup' ? 'Already have an account?' : 'Remember your password?'}{' '}
              <button className="auth-link" type="button" disabled={submitting} onClick={() => switchView('login')}>Sign in</button>
            </p>
          )}
        </section>
        <p className="auth-privacy">Your trade history stays yours. We never place trades or make investment decisions for you.</p>
      </div>
    </main>
  )
}

export default AuthScreen
