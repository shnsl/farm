import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { DEFAULT_PIN, useAuth } from '../lib/auth'

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
      setFormError('6 haneli şifre gir')
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
        <p className="eyebrow">Tarla Ağaç Takip</p>
        <h1>Giriş yap</h1>
        <p className="muted">6 haneli şifreni gir.</p>

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

        <p className="muted small">
          İlk kurulumda varsayılan şifre <strong>{DEFAULT_PIN}</strong>. Ayarlar’dan
          değiştirebilirsin.
        </p>
      </div>
    </div>
  )
}
