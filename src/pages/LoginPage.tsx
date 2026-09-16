import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function LoginPage() {
  const { user, loading, loginWithPin, error, clearError } = useAuth()
  const [pin, setPin] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    clearError()
    setFormError(null)

    if (!/^\d{6}$/.test(pin)) {
      setFormError('Şifreyi kontrol et')
      return
    }

    setSubmitting(true)
    try {
      await loginWithPin(pin)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Giriş başarısız')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand-icon">
          <img
            className="auth-app-icon"
            src={`${import.meta.env.BASE_URL}pwa-192.png`}
            alt=""
            width={64}
            height={64}
          />
        </div>
        <p className="eyebrow">Tarla ağaç takip</p>
        <h1>Giriş yap</h1>
        <p className="muted">Şifreni gir.</p>

        <form className="stack" onSubmit={onSubmit}>
          <label>
            Şifre
            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern="\d{6}"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, '').slice(0, 6)
                setPin(next)
              }}
              required
              autoFocus
            />
          </label>

          {(formError || error) && (
            <p className="error" role="alert">
              {formError || error}
            </p>
          )}

          <button
            className="btn primary"
            type="submit"
            disabled={submitting || pin.length !== 6}
          >
            {submitting ? 'Bekle…' : 'Giriş yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
