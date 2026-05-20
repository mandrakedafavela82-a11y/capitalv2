import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur, fmtDate } from '../lib/utils'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function Reports() {
  const { profile, isAdmin } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [vendorFilter, setVendorFilter] = useState('')
  const [data, setData] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadUsers() }, [])
  useEffect(() => { load() }, [month, year, vendorFilter, profile])

  function lastDay(m, y) { return new Date(y, m, 0).toISOString().slice(0, 10) }
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const to = lastDay(month, year)

  async function loadUsers() {
    const { data: u } = await supabase.from('profiles').select('id, nome').in('role', ['admin','consultor'])
    setUsers(u || [])
  }

  async function load() {
    setLoading(true)
    let clQ = supabase.from('clientes').select('*').gte('data', from).lte('data', to)
    let vdQ = supabase.from('vendas').select('*').gte('data', from).lte('data', to)

    if (!isAdmin) {
      clQ = clQ.eq('consultor_id', profile?.id)
      vdQ = vdQ.eq('consultor_id', profile?.id)
    } else if (vendorFilter) {
      clQ = clQ.eq('consultor_id', vendorFilter)
      vdQ = vdQ.eq('consultor_id', vendorFilter)
    }

    const [cl, vd, us] = await Promise.all([
      clQ, vdQ,
      supabase.from('profiles').select('id, nome').in('role', ['admin','consultor']),
    ])

    const clients = cl.data || []
    const vendas = vd.data || []
    const allUsers = us.data || []

    // Weekly evolution (4 weeks)
    const daysInMonth = new Date(year, month, 0).getDate()
    const weeks = [
      { label: 'Sem 1', days: [1, 7] },
      { label: 'Sem 2', days: [8, 14] },
      { label: 'Sem 3', days: [15, 21] },
      { label: 'Sem 4', days: [22, daysInMonth] },
    ]
    const weeklyClients = weeks.map(w => {
      const d1 = `${year}-${String(month).padStart(2,'0')}-${String(w.days[0]).padStart(2,'0')}`
      const d2 = `${year}-${String(month).padStart(2,'0')}-${String(w.days[1]).padStart(2,'0')}`
      return { label: w.label, count: clients.filter(c => c.data >= d1 && c.data <= d2).length }
    })
    const weeklyVendas = weeks.map(w => {
      const d1 = `${year}-${String(month).padStart(2,'0')}-${String(w.days[0]).padStart(2,'0')}`
      const d2 = `${year}-${String(month).padStart(2,'0')}-${String(w.days[1]).padStart(2,'0')}`
      return { label: w.label, valor: vendas.filter(v => v.data >= d1 && v.data <= d2).reduce((s, v) => s + (v.valor || 0), 0) }
    })

    // Per-consultor breakdown
    const byConsultor = {}
    allUsers.forEach(u => {
      byConsultor[u.id] = { nome: u.nome, clients: 0, valor: 0, ps: 0, vendas: 0, vendaValor: 0, comissao: 0 }
    })
    clients.forEach(c => {
      if (!byConsultor[c.consultor_id]) return
      byConsultor[c.consultor_id].clients++
      byConsultor[c.consultor_id].valor += (c.valor || 0)
      byConsultor[c.consultor_id].ps += (c.ps || 0)
    })
    vendas.forEach(v => {
      if (!byConsultor[v.consultor_id]) return
      byConsultor[v.consultor_id].vendas++
      byConsultor[v.consultor_id].vendaValor += (v.valor || 0)
      byConsultor[v.consultor_id].comissao += (v.comissao_valor || 0)
    })

    const totalValor = clients.reduce((s, c) => s + (c.valor || 0), 0)
    const totalVendas = vendas.reduce((s, v) => s + (v.valor || 0), 0)
    const totalComissao = vendas.reduce((s, v) => s + (v.comissao_valor || 0), 0)
    const totalPS = clients.reduce((s, c) => s + (c.ps || 0), 0)

    setData({
      clients, vendas, weeklyClients, weeklyVendas,
      byConsultor: Object.values(byConsultor).filter(c => c.clients > 0 || c.vendas > 0).sort((a, b) => b.valor - a.valor),
      totals: {
        clients: clients.length,
        valor: totalValor,
        ps: totalPS,
        vendas: vendas.length,
        vendaValor: totalVendas,
        comissao: totalComissao,
        lucro: totalValor - totalPS + (totalVendas - totalComissao),
      },
    })
    setLoading(false)
  }

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  function exportPDF() {
    window.print()
  }

  const t = data?.totals || {}
  const maxWeekClients = Math.max(...(data?.weeklyClients || []).map(w => w.count), 1)
  const maxWeekVendas = Math.max(...(data?.weeklyVendas || []).map(w => w.valor), 1)
  const maxConsultorValor = Math.max(...(data?.byConsultor || []).map(c => c.valor), 1)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={prevMonth} className="btn btn-secondary btn-icon"><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 700, fontSize: 15, minWidth: 160, textAlign: 'center' }}>
            {MONTHS[month - 1]} / {year}
          </span>
          <button onClick={nextMonth} className="btn btn-secondary btn-icon"><ChevronRight size={16} /></button>
          {isAdmin && (
            <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}
              style={{ padding: '7px 10px', background: 'var(--hover)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="">Todos os Vendedores</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          )}
          <button onClick={exportPDF} className="btn btn-secondary btn-sm">
            <Download size={14} /> Exportar PDF
          </button>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard label="Total em Vendas"    value={fmtCur(t.vendaValor)} sub={`${t.vendas} operações`}  color="var(--success)" />
            <StatCard label="Total em Comissões" value={fmtCur(t.ps + t.comissao)} sub={`PS + Comissão`}    color="var(--warn)" />
            <StatCard label="Total em Lucros"    value={fmtCur(t.lucro)}      sub={`${t.clients} clientes`} color="var(--accent)" />
            <StatCard label="Novos Clientes"     value={t.clients}            sub={fmtCur(t.valor)}         color="var(--info)" />
          </div>

          {/* Weekly evolution chart */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Evolução Semanal — {MONTHS_SHORT[month - 1]}/{year}</h3>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', height: 120 }}>
              {(data?.weeklyClients || []).map((w, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{w.count}</div>
                  <div style={{
                    width: '100%', borderRadius: '6px 6px 0 0',
                    height: Math.max(6, (w.count / maxWeekClients) * 88),
                    background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent2) 100%)',
                    transition: 'height .4s',
                  }} title={`${w.label}: ${w.count} clientes`} />
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{w.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'flex-end', height: 100 }}>
              {(data?.weeklyVendas || []).map((w, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{w.valor > 0 ? fmtCur(w.valor).replace('R$ ','') : '—'}</div>
                  <div style={{
                    width: '100%', borderRadius: '6px 6px 0 0',
                    height: Math.max(4, (w.valor / maxWeekVendas) * 72),
                    background: 'var(--info)',
                    opacity: .75,
                    transition: 'height .4s',
                  }} title={`${w.label}: ${fmtCur(w.valor)}`} />
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{w.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent)', display: 'inline-block' }} />
                <span style={{ color: 'var(--muted)' }}>Clientes</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--info)', display: 'inline-block', opacity: .75 }} />
                <span style={{ color: 'var(--muted)' }}>Valor Vendas</span>
              </span>
            </div>
          </div>

          {/* Per-consultor breakdown */}
          {isAdmin && (data?.byConsultor || []).length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                Detalhamento por Vendedor
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th>Nº Vendas</th>
                      <th>Total Vendas</th>
                      <th>Comissões</th>
                      <th>Clientes</th>
                      <th>Valor Clientes</th>
                      <th>Ticket Médio</th>
                      <th>Participação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.byConsultor || []).map(c => {
                      const pct = maxConsultorValor > 0 ? Math.round((c.valor / maxConsultorValor) * 100) : 0
                      const ticket = c.clients > 0 ? c.valor / c.clients : 0
                      return (
                        <tr key={c.nome}>
                          <td style={{ fontWeight: 600 }}>{c.nome}</td>
                          <td>{c.vendas}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmtCur(c.vendaValor)}</td>
                          <td style={{ color: 'var(--warn)' }}>{fmtCur(c.comissao + c.ps)}</td>
                          <td>{c.clients}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmtCur(c.valor)}</td>
                          <td style={{ color: 'var(--muted)' }}>{fmtCur(ticket)}</td>
                          <td style={{ minWidth: 100 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--hover)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 3, width: `${pct}%`, transition: 'width .4s' }} />
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 28 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Client list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Clientes do Período</span>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>{data?.clients.length || 0} registros</span>
            </div>
            {(data?.clients.length || 0) === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhum cliente neste período</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead><tr><th>Nome</th><th>Banco</th><th>Valor</th><th>PS</th><th>Data</th></tr></thead>
                  <tbody>
                    {(data?.clients || []).map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.nome}</td>
                        <td>
                          <span className="badge" style={{ background: c.banco === 'Caixa' ? '#1d4ed822' : '#dc262622', color: c.banco === 'Caixa' ? 'var(--info)' : 'var(--danger)' }}>
                            {c.banco}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtCur(c.valor)}</td>
                        <td style={{ color: 'var(--accent)' }}>{fmtCur(c.ps)}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(c.data)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
