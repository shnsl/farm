import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AccentProvider } from './lib/accent'
import { AuthProvider } from './lib/auth'
import { FocusNavProvider } from './lib/focusNav'
import { FontProvider } from './lib/font'
import { ThemeProvider } from './lib/theme'
import { AssetsPage } from './pages/AssetsPage'
import { DashboardPage } from './pages/DashboardPage'
import { FieldDetailPage } from './pages/FieldDetailPage'
import { LoginPage } from './pages/LoginPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'

export default function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

  return (
    <ThemeProvider>
      <AccentProvider>
        <FontProvider>
          <AuthProvider>
            <BrowserRouter basename={basename}>
              <FocusNavProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route
                        path="/fields/:fieldId"
                        element={<FieldDetailPage />}
                      />
                      <Route path="/assets" element={<AssetsPage />} />
                      <Route path="/search" element={<SearchPage />} />
                      <Route path="/stats" element={<StatsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </FocusNavProvider>
            </BrowserRouter>
          </AuthProvider>
        </FontProvider>
      </AccentProvider>
    </ThemeProvider>
  )
}
