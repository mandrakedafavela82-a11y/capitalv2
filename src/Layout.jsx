import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useTheme } from './contexts/ThemeContext'
import { supabase } from './lib/supabase'
import {
  LayoutDashboard, Users, List, TrendingUp, Award,
  Kanban, Target, MessageSquare, Settings, LogOut,
  Sun, Moon, Coffee, Menu, Trophy, Flag,
  UserCog, BarChart2, DollarSign,
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard, roles: ['admin','consultor','operacional'] },
  { path: '/clientes',  label: 'Clientes',     icon: Users,           roles: ['admin','consultor'] },
  { path: '/listas',    label: 'Listas',       icon: List,            roles: ['admin','consultor'] },
  { path: '/vendas',    label: 'Vendas',       icon: TrendingUp,      roles: ['admin','consultor'] },
  { path: '/comissoes', label: 'Comissões',    icon: Award,           roles: ['admin','consultor'] },
  { path: '/metas',     label: 'Metas',        icon: Flag,            roles: ['admin','consultor'] },
  { path: '/ranking',   label: 'Ranking',      icon: Trophy,          roles: ['admin','consultor'] },
  { path: '/crm',       label: 'CRM',          icon: Kanban,          roles: ['admin','consultor'] },
  { path: '/captacao',  label: 'Captação',     icon: Target,          roles: ['admin','consultor'] },
  { path: '/chat',       label: 'Chat',         icon: MessageSquare,   roles: ['admin','consultor','operacional'] },
  { path: '/equipe',    label: 'Equipe',        icon: UserCog,         roles: ['admin'] },
  { path: '/relatorios',label: 'Relatórios',    icon: BarChart2,       roles: ['admin','consultor'] },
  { path: '/lucros',    label: 'Lucros',        icon: DollarSign,      roles: ['admin'] },
  { path: '/config',    label: 'Configurações', icon: Settings,        roles: ['admin','consultor','operacional'] },
]

function ThemeIcon({ theme }) {
  if (theme === 'dark') return <Moon size={16} />
  if (theme === 'light') return <Sun size={16} />
  return <Coffee size={16} />
}

function Avatar({ profile, size = 36 }) {
  const s = { width: size, height: size, borderRadius: '50%', flexShrink: 0 }
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" style={{ ...s, objectFit: 'cover' }} />
  }
  return (
    <div style={{
      ...s, background: 'var(--accent)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 700, color: '#fff',
    }}>
      {profile?.avatar || '?'}
    </div>
  )
}

function SidebarContent({ onClose }) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const visible = NAV_ITEMS.filter(n => n.roles.includes(profile?.role))

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const themeLabel = theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Sépia'
  const logoSrc = theme === 'dark' ? '/logo.png' : '/logo-light.png'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border)', minHeight: 68, display: 'flex', alignItems: 'center', background: 'linear-gradient(180deg, rgba(201,162,42,.06) 0%, transparent 100%)' }}>
        <img
          src={logoSrc} alt="CapitalCred"
          style={{ height: 40, objectFit: 'contain', maxWidth: '100%' }}
          onError={e => { e.target.style.display = 'none' }}
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {visible.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px 9px 13px',
              margin: '1px 8px',
              borderRadius: 10,
              color: isActive ? 'var(--accent)' : 'var(--text)',
              background: isActive ? 'rgba(201,162,42,.1)' : 'transparent',
              textDecoration: 'none', fontSize: 13.5,
              fontWeight: isActive ? 700 : 400,
              border: `1px solid ${isActive ? 'rgba(201,162,42,.2)' : 'transparent'}`,
              transition: 'all .15s',
            })}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Avatar profile={profile} size={34} />
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.nome}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>
              {profile?.role}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={toggleTheme} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
            <ThemeIcon theme={theme} /> {themeLabel}
          </button>
          <button onClick={handleSignOut} className="btn btn-secondary btn-sm btn-icon" title="Sair">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const lastSeenRef = useRef(parseInt(localStorage.getItem('chat_last_seen') || '0', 10))

  const isOnChat = location.pathname === '/chat'

  useEffect(() => {
    if (isOnChat) {
      const now = Date.now()
      localStorage.setItem('chat_last_seen', String(now))
      lastSeenRef.current = now
      setUnread(0)
      return
    }
  }, [isOnChat])

  useEffect(() => {
    const channel = supabase
      .channel('layout-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, payload => {
        if (isOnChat) return
        const ts = new Date(payload.new.created_at).getTime()
        if (ts > lastSeenRef.current) setUnread(prev => prev + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isOnChat])

  function handleChatClick() {
    const now = Date.now()
    localStorage.setItem('chat_last_seen', String(now))
    lastSeenRef.current = now
    setUnread(0)
    navigate('/chat')
  }

  const sidebarStyle = {
    width: 220, flexShrink: 0,
    background: 'var(--card)',
    borderRight: '1px solid var(--border)',
    height: '100vh',
    position: 'sticky', top: 0,
    display: 'flex', flexDirection: 'column',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <aside style={sidebarStyle} className="hidden-mobile">
        <SidebarContent onClose={() => {}} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.55)', display: 'flex' }}
          onClick={() => setMobileOpen(false)}
        >
          <aside
            style={{ ...sidebarStyle, position: 'relative', zIndex: 201 }}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile top bar */}
        <header style={{
          display: 'none', alignItems: 'center', gap: 12,
          padding: '10px 16px', background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 50,
        }} className="show-mobile-flex">
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            <Menu size={22} />
          </button>
          <img
            src={theme === 'dark' ? '/logo.png' : '/logo-light.png'}
            alt="CapitalCred" style={{ height: 30 }}
            onError={e => { e.target.style.display = 'none' }}
          />
        </header>

        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>

      {/* Floating chat button */}
      {!isOnChat && (
        <button
          onClick={handleChatClick}
          title="Chat"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 100,
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,.35)',
            transition: 'transform .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageSquare size={22} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#ef4444', color: '#fff',
              fontSize: 11, fontWeight: 700,
              borderRadius: '50%', minWidth: 20, height: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
