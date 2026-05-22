import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './Layout'
import Login from './pages/Login'

const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Clients     = lazy(() => import('./pages/Clients'))
const Sales       = lazy(() => import('./pages/Sales'))
const Commissions = lazy(() => import('./pages/Commissions'))
const Ranking     = lazy(() => import('./pages/Ranking'))
const Goals       = lazy(() => import('./pages/Goals'))
const CRM         = lazy(() => import('./pages/CRM'))
const Captacao    = lazy(() => import('./pages/Captacao'))
const Chat        = lazy(() => import('./pages/Chat'))
const Config      = lazy(() => import('./pages/Config'))
const Team        = lazy(() => import('./pages/Team'))
const Reports     = lazy(() => import('./pages/Reports'))
const Profits     = lazy(() => import('./pages/Profits'))
const RankingTV   = lazy(() => import('./pages/RankingTV'))

function Guard({ children, roles }) {
  const { profile, loading } = useAuth()
  if (loading) return <Loader />
  if (!profile) return <Navigate to="/login" replace />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/dashboard" replace />
  return children
}

function Loader() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontSize: 16
    }}>
      Carregando...
    </div>
  )
}

function AppRoutes() {
  const { profile, loading } = useAuth()
  if (loading) return <Loader />

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/tv" element={<RankingTV />} />
        <Route path="/login" element={profile ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/" element={<Guard><Layout /></Guard>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="clientes"   element={<Guard roles={['admin','consultor']}><Clients /></Guard>} />
          <Route path="vendas"     element={<Guard roles={['admin','consultor']}><Sales /></Guard>} />
          <Route path="comissoes"  element={<Guard roles={['admin','consultor']}><Commissions /></Guard>} />
          <Route path="ranking"    element={<Guard roles={['admin','consultor']}><Ranking /></Guard>} />
          <Route path="metas"      element={<Guard roles={['admin','consultor']}><Goals /></Guard>} />
          <Route path="crm"        element={<Guard roles={['admin','consultor']}><CRM /></Guard>} />
          <Route path="captacao"   element={<Guard roles={['admin','consultor']}><Captacao /></Guard>} />
          <Route path="chat"       element={<Chat />} />
          <Route path="config"     element={<Config />} />
          <Route path="equipe"     element={<Guard roles={['admin']}><Team /></Guard>} />
          <Route path="relatorios" element={<Guard roles={['admin','consultor']}><Reports /></Guard>} />
          <Route path="lucros"     element={<Guard roles={['admin']}><Profits /></Guard>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
