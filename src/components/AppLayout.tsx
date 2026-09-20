import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useNavSwipe } from '../lib/useNavSwipe'
import {
  IconCompare,
  IconFields,
  IconSearch,
  IconSettings,
  IconTree,
} from './Icons'

export function AppLayout() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  useNavSwipe()

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
          <NavLink to="/stats">
            <IconCompare />
            İstatistikler
          </NavLink>
          <NavLink to="/search">
            <IconSearch />
            Ara
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
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
