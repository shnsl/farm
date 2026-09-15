import { useState, type FormEvent } from 'react'
import { careStandards } from '../config/careStandards'
import { defaultPlowWindows, defaultTimesPerYear } from '../config/plowWindows'
import { useAuth } from '../lib/auth'

export function SettingsPage() {
  const { farmId, changePin } = useAuth()
  const [currentPin, setCurrentPin] = useState('')
  const [nextPin, setNextPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onChangePin(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(nextPin)) {
      setError('Şifreler 6 haneli rakam olmalıdır')
      return
    }
    if (nextPin !== confirmPin) {
      setError('Yeni şifreler eşleşmiyor')
      return
    }

    setSaving(true)
    try {
      await changePin(currentPin, nextPin)
      setCurrentPin('')
      setNextPin('')
      setConfirmPin('')
      setMessage('Şifre güncellendi')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şifre değiştirilemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Ayarlar</h1>
          <p className="muted">PIN, config standartları ve güvenlik notları.</p>
        </div>
      </header>

      <section className="panel stack">
        <h2>Şifre değiştir</h2>
        <p className="muted small">
          6 haneli PIN Firebase Auth’ta tutulur. Değişiklik anında geçerli olur.
        </p>
        <form className="stack" onSubmit={onChangePin}>
          <label>
            Mevcut şifre
            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={currentPin}
              onChange={(e) =>
                setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              required
            />
          </label>
          <label>
            Yeni şifre
            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={nextPin}
              onChange={(e) =>
                setNextPin(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              required
            />
          </label>
          <label>
            Yeni şifre (tekrar)
            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && <p className="success">{message}</p>}
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
          </button>
        </form>
        <p className="muted small">
          Farm ID: <code>{farmId}</code>
        </p>
      </section>

      <section className="panel stack">
        <h2>Bakım standartları</h2>
        <p className="muted">
          Kaynak: <code>src/config/careStandards.ts</code>
        </p>
        <ul>
          {careStandards.map((item) => (
            <li key={item.type}>
              <strong>{item.label}</strong> — her {item.intervalDays} günde bir
              {item.notes ? ` (${item.notes})` : ''}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2>Sürme standartları</h2>
        <p className="muted">
          Kaynak: <code>src/config/plowWindows.ts</code> · yılda{' '}
          {defaultTimesPerYear} kez
        </p>
        <ul>
          {defaultPlowWindows.map((w) => (
            <li key={w.id}>
              {w.label}: {w.startMonthDay} → {w.endMonthDay}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2>Güvenlik</h2>
        <ul className="bullets">
          <li>Giriş yalnızca 6 haneli PIN ile yapılır (e-posta sorulmaz).</li>
          <li>
            PIN Firebase Authentication’da saklanır; Firestore’da yalnızca erişim
            meta verisi tutulur.
          </li>
          <li>
            Firestore Rules yalnızca <code>ownerUid</code> eşleşen kullanıcının
            farm verisine erişmesine izin verir.
          </li>
        </ul>
      </section>
    </div>
  )
}
