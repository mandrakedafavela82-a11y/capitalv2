import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Lists from './pages/Lists'
import Sales from './pages/Sales'
import Commissions from './pages/Commissions'
import Ranking from './pages/Ranking'
import Goals from './pages/Goals'
import CRM from './pages/CRM'
import Captacao from './pages/Captacao'
import Chat from './pages/Chat'
import Config from './pages/Config'
import Team from './pages/Team'
import Reports from './pages/Reports'
import Profits from './pages/Profits'

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
    <Routes>
      <Route path="/login" element={profile ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<Guard><Layout /></Guard>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="clientes"   element={<Guard roles={['admin','consultor']}><Clients /></Guard>} />
        <Route path="listas"     element={<Guard roles={['admin','consultor']}><Lists /></Guard>} />
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
