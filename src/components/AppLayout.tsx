import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  IconCompare,
  IconFields,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
  IconTree,
} from './Icons'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

export function AppLayout() {
  const { logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function onSearch(event: FormEvent) {
    event.preventDefault()
    const q = query.trim()
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <IconTree />
          </span>
          Tarla
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            <IconFields />
            Tarlalar
          </NavLink>
          <NavLink to="/search">
            <IconSearch />
            Ara
          </NavLink>
          <NavLink to="/stats">
            <IconCompare />
            İstatistikler
          </NavLink>
          <NavLink to="/settings">
            <IconSettings />
            Ayarlar
          </NavLink>
        </nav>
        <form className="top-search" onSubmit={onSearch} role="search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara…"
            aria-label="Ara"
          />
        </form>
        <div className="topbar-meta">
          <button
            type="button"
            className="btn ghost icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Açık moda geç' : 'Koyu moda geç'}
            title={theme === 'dark' ? 'Açık mod' : 'Koyu mod'}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
            {theme === 'dark' ? 'Açık' : 'Koyu'}
          </button>
          <button type="button" className="btn ghost" onClick={() => void logout()}>
            Çıkış
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
