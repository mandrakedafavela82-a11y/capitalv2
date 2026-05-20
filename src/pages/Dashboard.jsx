import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur } from '../lib/utils'
import { Users, DollarSign, TrendingUp, Award, ToggleLeft, ToggleRight } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [clients, setClients] = useState([])
  const [vendas, setVendas] = useState([])
  const [commissions, setCommissions] = useState([])
  const [dashView, setDashView] = useState('geral')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [profile])

  async function load() {
    setLoading(true)
    const [c, v, cm] = await Promise.all([
      supabase.from('clientes').select('*'),
      supabase.from('vendas').select('*'),
      supabase.from('comissoes').select('*, clientes(consultor_id)'),
    ])
    setClients(c.data || [])
    setVendas(v.data || [])
    setCommissions(cm.data || [])
    setLoading(false)
  }

  const isPersonal = isAdmin && dashView === 'pessoal'

  const myClients = isPersonal
    ? clients.filter(c => c.consultor_id === profile?.id)
    : isAdmin
      ? clients
      : clients.filter(c => c.consultor_id === profile?.id)

  const myVendas = isPersonal
    ? vendas.filter(v => v.consultor_id === profile?.id)
    : isAdmin
      ? vendas
      : vendas.filter(v => v.consultor_id === profile?.id)

  const myComm = commissions.filter(cm =>
    isAdmin && !isPersonal
      ? true
      : cm.clientes?.consultor_id === profile?.id
  )

  const totalValor = myClients.reduce((s, c) => s + (c.valor || 0), 0)
  const totalPS = myClients.reduce((s, c) => s + (c.ps || 0), 0)
  const pendente = myComm.filter(c => c.status === 'Pendente').reduce((s, c) => s + (c.ps || 0), 0)
  const pago = myComm.filter(c => c.status === 'Pago').reduce((s, c) => s + (c.ps || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        {isAdmin && (
          <button
            onClick={() => setDashView(v => v === 'geral' ? 'pessoal' : 'geral')}
            className="btn btn-secondary"
          >
            {dashView === 'geral' ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
            {dashView === 'geral' ? 'Visão Geral' : 'Meus Dados'}
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Carregando...</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard icon={Users} label="Clientes" value={myClients.length} color="var(--info)" />
            <StatCard icon={DollarSign} label="Valor Total" value={fmtCur(totalValor)} color="var(--success)" />
            <StatCard icon={Award} label="PS Total" value={fmtCur(totalPS)} color="var(--accent)" />
            <StatCard icon={TrendingUp} label="Vendas" value={myVendas.length} color="var(--warn)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
            <div className="card">
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Comissões</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)', fontSize: 14 }}>Pendente</span>
                  <span style={{ fontWeight: 700, color: 'var(--warn)' }}>{fmtCur(pendente)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)', fontSize: 14 }}>Pago</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmtCur(pago)}</span>
                </div>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}>Total</span>
                  <span style={{ fontWeight: 700 }}>{fmtCur(pendente + pago)}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Clientes por Banco</h3>
              {['Caixa', 'Santander'].map(banco => {
                const n = myClients.filter(c => c.banco === banco).length
                const pct = myClients.length ? Math.round(n / myClients.length * 100) : 0
                return (
                  <div key={banco} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                      <span>{banco}</span><span style={{ color: 'var(--muted)' }}>{n} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--hover)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: pct + '%', height: '100%', borderRadius: 3,
                        background: banco === 'Caixa' ? 'var(--info)' : 'var(--danger)',
                        transition: 'width .4s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="card">
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Vendas por Status</h3>
              {[
                { key: 'pendente', label: 'Pendente', color: 'var(--warn)' },
                { key: 'concluida', label: 'Concluída', color: 'var(--success)' },
                { key: 'cancelada', label: 'Cancelada', color: 'var(--danger)' },
              ].map(({ key, label, color }) => {
                const n = myVendas.filter(v => v.status === key).length
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      {label}
                    </div>
                    <span style={{ color, fontWeight: 600 }}>{n}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
