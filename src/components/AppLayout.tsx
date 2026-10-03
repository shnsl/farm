import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useNavSwipe } from '../lib/useNavSwipe'
import {
  IconChart,
  IconFurrows,
  IconSearch,
  IconSettings,
  IconWallet,
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
            <img
              className="brand-mark-icon"
              src={`${import.meta.env.BASE_URL}favicon.png`}
              alt=""
              width={24}
              height={24}
            />
          </span>
          ORA
        </Link>
        <nav className="nav" aria-label="Ana menü">
          <NavLink to="/" end aria-label="Tarlalar" title="Tarlalar">
            <IconFurrows />
            <span className="nav-label">Tarlalar</span>
          </NavLink>
          <NavLink to="/assets" aria-label="Varlıklar" title="Varlıklar">
            <IconWallet />
            <span className="nav-label">Varlıklar</span>
          </NavLink>
          <NavLink to="/stats" aria-label="İstatistikler" title="İstatistikler">
            <IconChart />
            <span className="nav-label">İstatistikler</span>
          </NavLink>
          <NavLink to="/search" aria-label="Ara" title="Ara">
            <IconSearch />
            <span className="nav-label">Ara</span>
          </NavLink>
          <NavLink to="/settings" aria-label="Ayarlar" title="Ayarlar">
            <IconSettings />
            <span className="nav-label">Ayarlar</span>
          </NavLink>
        </nav>
        <form className="top-search" onSubmit={onSearch} role="search">
          <input
            type="search"
            size={1}
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
