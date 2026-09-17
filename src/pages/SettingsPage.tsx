import { useState, type CSSProperties, type FormEvent } from 'react'
import { CollapseSection } from '../components/CollapseSection'
import {
  IconCalendar,
  IconFont,
  IconLock,
  IconPalette,
  IconSettings,
  IconShield,
  PageTitle,
} from '../components/Icons'
import { careStandards } from '../config/careStandards'
import { useAccent } from '../lib/accent'
import { useAuth } from '../lib/auth'
import { useFont } from '../lib/font'
import { useTheme } from '../lib/theme'

export function SettingsPage() {
  const { farmId, changePin } = useAuth()
  const { fontId, fonts, setFontId } = useFont()
  const { theme } = useTheme()
  const { accentId, accents, setAccentId } = useAccent()
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
      setError('Şifreleri kontrol et')
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
          <PageTitle icon={<IconSettings />} tone="violet">
            Ayarlar
          </PageTitle>
          <p className="muted">
            Tema rengi, yazı tipi, PIN, standartlar ve güvenlik notları.
          </p>
        </div>
      </header>

      <CollapseSection
        title="Tema Rengi"
        icon={<IconPalette />}
        tone="violet"
        defaultOpen
        bodyClassName="stack"
      >
        <p className="muted small">
          Uygulama vurgusu ve arka plan tonu. Açık / koyu moda göre otomatik
          uyumlanır. Seçim bu cihazda saklanır.
        </p>
        <div className="accent-picker" role="radiogroup" aria-label="Tema Rengi">
          {accents.map((accent) => {
            const selected = accent.id === accentId
            return (
              <button
                key={accent.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`accent-picker-option${selected ? ' is-selected' : ''}`}
                onClick={() => setAccentId(accent.id)}
              >
                <span
                  className="accent-picker-swatch"
                  style={
                    {
                      ['--swatch-a']: accent.light.swatch,
                      ['--swatch-b']: accent.dark.swatch,
                    } as CSSProperties
                  }
                  aria-hidden
                />
                <span className="accent-picker-name">{accent.label}</span>
                <span className="muted small">
                  {theme === 'dark' ? 'Koyu uyumlu' : 'Açık uyumlu'}
                </span>
              </button>
            )
          })}
        </div>
      </CollapseSection>

      <CollapseSection
        title="Yazı Tipi"
        icon={<IconFont />}
        tone="teal"
        bodyClassName="stack"
      >
        <p className="muted small">
          Türkçe karakterleri (ğüşıöç) destekleyen yazı tipleri. Seçim bu cihazda
          saklanır.
        </p>
        <div className="font-picker" role="radiogroup" aria-label="Yazı Tipi">
          {fonts.map((font) => {
            const selected = font.id === fontId
            return (
              <button
                key={font.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`font-picker-option${selected ? ' is-selected' : ''}`}
                style={{ fontFamily: font.stack }}
                onClick={() => setFontId(font.id)}
              >
                <span className="font-picker-name">{font.label}</span>
                <span className="font-picker-sample muted small">{font.sample}</span>
              </button>
            )
          })}
        </div>
      </CollapseSection>

      <CollapseSection
        title="Şifre Değiştir"
        icon={<IconLock />}
        tone="amber"
        bodyClassName="stack"
      >
        <p className="muted small">
          PIN Firebase Auth’ta tutulur. Değişiklik anında geçerli olur.
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
      </CollapseSection>

      <CollapseSection
        title="Bakım Standartları"
        icon={<IconCalendar />}
        tone="green"
        bodyClassName="stack"
      >
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
      </CollapseSection>

      <CollapseSection
        title="Güvenlik"
        icon={<IconShield />}
        tone="sky"
        bodyClassName="stack"
      >
        <ul className="bullets">
          <li>Giriş yalnızca PIN ile yapılır (e-posta sorulmaz).</li>
          <li>
            PIN Firebase Authentication’da saklanır; Firestore’da yalnızca erişim
            meta verisi tutulur.
          </li>
          <li>
            Firestore Rules yalnızca <code>ownerUid</code> eşleşen kullanıcının
            farm verisine erişmesine izin verir.
          </li>
        </ul>
      </CollapseSection>
    </div>
  )
}
