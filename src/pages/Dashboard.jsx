import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur } from '../lib/utils'
import { Users, DollarSign, TrendingUp, Award, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function Trend({ current, prev, suffix = '' }) {
  if (prev === 0 && current === 0) return null
  if (prev === 0) return <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 2 }}><ArrowUpRight size={13} />Novo</span>
  const pct = Math.round(((current - prev) / prev) * 100)
  const up = pct >= 0
  const color = up ? 'var(--success)' : 'var(--danger)'
  const Icon = pct === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span style={{ fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Icon size={13} />{Math.abs(pct)}%{suffix}
    </span>
  )
}

function KPICard({ icon: Icon, label, value, raw, rawPrev, color }) {
  return (
    <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -10, right: -10, width: 70, height: 70, borderRadius: '50%', background: color + '0d' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={color} />
        </div>
        <Trend current={raw ?? 0} prev={rawPrev ?? 0} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>vs mês anterior</div>
    </div>
  )
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [data, setData] = useState(null)
  const [chart, setChart] = useState([])
  const [dashView, setDashView] = useState('geral')
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => { load() }, [profile, dashView])

  async function load() {
    if (!profile?.id) return
    setLoading(true)
    try {
      const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10)

      let clQ = supabase.from('clientes').select('id, nome, banco, valor, ps, data, consultor_id, crm_status').gte('data', sixAgo)
      let vdQ = supabase.from('vendas').select('id, cliente_nome, valor, status, data, consultor_id').gte('data', sixAgo)
      let cmQ = supabase.from('comissoes').select('ps, status, consultor_id')

      const isPersonal = isAdmin && dashView === 'pessoal'
      if (!isAdmin || isPersonal) {
        clQ = clQ.eq('consultor_id', profile.id)
        vdQ = vdQ.eq('consultor_id', profile.id)
        cmQ = cmQ.eq('consultor_id', profile.id)
      }

      const [cl, vd, cm] = await Promise.all([clQ, vdQ, cmQ])

      const clients = cl.data || []
      const vendas = vd.data || []
      const comissoes = cm.data || []

      const thisCl  = clients.filter(c => c.data?.startsWith(thisMonth))
      const lastCl  = clients.filter(c => c.data?.startsWith(lastMonth))
      const thisVd  = vendas.filter(v => v.data?.startsWith(thisMonth))
      const lastVd  = vendas.filter(v => v.data?.startsWith(lastMonth))

      const thisValor = thisCl.reduce((s, c) => s + (c.valor || 0), 0)
      const lastValor = lastCl.reduce((s, c) => s + (c.valor || 0), 0)
      const thisVdVal = thisVd.reduce((s, v) => s + (v.valor || 0), 0)
      const lastVdVal = lastVd.reduce((s, v) => s + (v.valor || 0), 0)

      const pendente = comissoes.filter(c => c.status === 'Pendente').reduce((s, c) => s + (c.ps || 0), 0)
      const pago = comissoes.filter(c => c.status === 'Pago').reduce((s, c) => s + (c.ps || 0), 0)

      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const mClients = clients.filter(c => c.data?.startsWith(key))
        months.push({
          label: MONTHS_SHORT[d.getMonth()], key,
          clients: mClients.length,
          valor: mClients.reduce((s, c) => s + (c.valor || 0), 0),
          isCurrent: key === thisMonth,
        })
      }

      const recentClients = [...thisCl].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5)
      const recentVendas  = [...thisVd].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5)

      setChart(months)
      setData({
        kpi: {
          clients: { cur: thisCl.length, prev: lastCl.length },
          valor:   { cur: thisValor, prev: lastValor },
          vendas:  { cur: thisVd.length, prev: lastVd.length },
          vendaVal:{ cur: thisVdVal, prev: lastVdVal },
        },
        pendente, pago,
        recentClients, recentVendas,
        caixaCount: thisCl.filter(c => c.banco === 'Caixa').length,
        santCount:  thisCl.filter(c => c.banco === 'Santander').length,
      })
    } catch (err) {
      console.error('Dashboard load error:', err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const maxChart = Math.max(...chart.map(m => m.clients), 1)

  const STATUS_CRM = {
    negociando:  { label: 'Negociando',  color: '#3b82f6' },
    documentos:  { label: 'Documentos',  color: '#f59e0b' },
    fechado:     { label: 'Fechado',     color: '#10b981' },
    pago:        { label: 'Pago',        color: '#059669' },
    ps_pago:     { label: 'PS Pago',     color: '#c9a22a' },
    desistiu:    { label: 'Desistiu',    color: '#ef4444' },
  }

  const firstName = profile?.nome?.split(' ')[0] || 'você'
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 60%, #f0c040 100%)',
        borderRadius: 18, padding: '22px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        boxShadow: '0 4px 24px rgba(201,162,42,.3)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
        <div style={{ position: 'absolute', right: 40, bottom: -30, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-.03em', marginBottom: 4 }}>
            {greeting()}, {firstName}! 👋
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', textTransform: 'capitalize' }}>{today}</div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setDashView(v => v === 'geral' ? 'pessoal' : 'geral')}
            style={{
              background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)',
              color: '#fff', borderRadius: 10, padding: '7px 14px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, flexShrink: 0, backdropFilter: 'blur(8px)',
              transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.2)'}
          >
            {dashView === 'geral' ? '🌐 Geral' : '👤 Pessoal'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="card" style={{ height: 110, background: 'var(--hover)', animation: 'shimmerPulse 1.4s ease infinite' }} />
          ))}
        </div>
      ) : !data ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          <p style={{ fontSize: 15, marginBottom: 8 }}>Não foi possível carregar os dados.</p>
          <p style={{ fontSize: 13 }}>Verifique a conexão com o banco em <strong>Configurações</strong>.</p>
          <button onClick={load} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>Tentar novamente</button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
            <KPICard icon={Users}      label="Clientes este mês"  value={data.kpi.clients.cur}        raw={data.kpi.clients.cur}  rawPrev={data.kpi.clients.prev}  color="var(--info)" />
            <KPICard icon={DollarSign} label="Valor de Crédito"   value={fmtCur(data.kpi.valor.cur)}  raw={data.kpi.valor.cur}   rawPrev={data.kpi.valor.prev}   color="var(--success)" />
            <KPICard icon={TrendingUp} label="Vendas"             value={data.kpi.vendas.cur}         raw={data.kpi.vendas.cur}  rawPrev={data.kpi.vendas.prev}  color="var(--warn)" />
            <KPICard icon={Award}      label="Valor de Vendas"    value={fmtCur(data.kpi.vendaVal.cur)} raw={data.kpi.vendaVal.cur} rawPrev={data.kpi.vendaVal.prev} color="var(--accent)" />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* 6-month bar chart */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Clientes — Últimos 6 meses</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{chart.reduce((s, m) => s + m.clients, 0)} total</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 110 }}>
                {chart.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: m.isCurrent ? 'var(--accent)' : 'var(--text)' }}>
                      {m.clients || ''}
                    </div>
                    <div style={{
                      width: '100%', borderRadius: '6px 6px 0 0',
                      height: Math.max(4, (m.clients / maxChart) * 82),
                      background: m.isCurrent
                        ? 'linear-gradient(180deg, var(--accent) 0%, var(--accent2) 100%)'
                        : 'var(--hover)',
                      border: m.isCurrent ? 'none' : '1px solid var(--border)',
                      boxShadow: m.isCurrent ? '0 2px 10px rgba(201,162,42,.3)' : 'none',
                      transition: 'height .4s cubic-bezier(.22,1,.36,1)',
                    }} title={`${m.label}: ${m.clients} clientes · ${fmtCur(m.valor)}`} />
                    <div style={{ fontSize: 11, color: m.isCurrent ? 'var(--accent)' : 'var(--muted)', fontWeight: m.isCurrent ? 700 : 400 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commissions + Bank split */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card" style={{ flex: 1, padding: '16px 18px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Comissões</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--muted)' }}>Pendente</span>
                    <span style={{ fontWeight: 700, color: 'var(--warn)' }}>{fmtCur(data.pendente)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--muted)' }}>Pago</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmtCur(data.pago)}</span>
                  </div>
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>Total</span>
                    <span style={{ fontWeight: 800 }}>{fmtCur(data.pendente + data.pago)}</span>
                  </div>
                </div>
              </div>

              <div className="card" style={{ flex: 1, padding: '16px 18px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Bancos este mês</h3>
                {[
                  { label: 'Caixa',     count: data.caixaCount, total: data.kpi.clients.cur, color: 'var(--info)' },
                  { label: 'Santander', count: data.santCount,  total: data.kpi.clients.cur, color: 'var(--danger)' },
                ].map(b => {
                  const pct = b.total > 0 ? Math.round((b.count / b.total) * 100) : 0
                  return (
                    <div key={b.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>{b.label}</span>
                        <span style={{ color: 'var(--muted)' }}>{b.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--hover)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: pct + '%', height: '100%', background: b.color, borderRadius: 3, transition: 'width .5s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
            {/* Recent clients */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Últimos Clientes</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Este mês</span>
              </div>
              {data.recentClients.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Nenhum cliente este mês
                </div>
              ) : data.recentClients.map(c => {
                const st = STATUS_CRM[c.crm_status] || STATUS_CRM.negociando
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: c.banco === 'Caixa' ? '#1d4ed818' : '#dc262618', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.banco === 'Caixa' ? 'var(--info)' : 'var(--danger)' }}>
                        {c.banco === 'Caixa' ? 'CEF' : 'SAN'}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{fmtCur(c.valor)}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: st.color + '20', color: st.color, flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Recent vendas */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Últimas Vendas</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Este mês</span>
              </div>
              {data.recentVendas.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Nenhuma venda este mês
                </div>
              ) : data.recentVendas.map(v => {
                const stColor = v.status === 'concluida' ? 'var(--success)' : v.status === 'cancelada' ? 'var(--danger)' : 'var(--warn)'
                const stLabel = v.status === 'concluida' ? 'Concluída' : v.status === 'cancelada' ? 'Cancelada' : 'Pendente'
                return (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: stColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.cliente_nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'capitalize' }}>{stLabel}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', flexShrink: 0 }}>{fmtCur(v.valor)}</span>
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
