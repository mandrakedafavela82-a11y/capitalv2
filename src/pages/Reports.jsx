import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur, fmtDate } from '../lib/utils'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function Reports() {
  const { profile, isAdmin } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [month, year, profile])

  function lastDay(m, y) { return new Date(y, m, 0).toISOString().slice(0, 10) }
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const to = lastDay(month, year)

  async function load() {
    setLoading(true)
    const [cl, vd, cm, us] = await Promise.all([
      supabase.from('clientes').select('*').gte('data', from).lte('data', to),
      supabase.from('vendas').select('*').gte('data', from).lte('data', to),
      supabase.from('comissoes').select('*, clientes(consultor_id, data)').gte('clientes.data', from),
      supabase.from('profiles').select('id, nome').in('role', ['admin','consultor']),
    ])

    const clients = isAdmin ? (cl.data || []) : (cl.data || []).filter(c => c.consultor_id === profile?.id)
    const vendas = isAdmin ? (vd.data || []) : (vd.data || []).filter(v => v.consultor_id === profile?.id)
    const comissoes = isAdmin
      ? (cm.data || [])
      : (cm.data || []).filter(c => c.clientes?.consultor_id === profile?.id)
    const users = us.data || []

    // Per consultor breakdown (admin only)
    const byConsultor = {}
    users.forEach(u => { byConsultor[u.id] = { nome: u.nome, clients: 0, valor: 0, ps: 0, vendas: 0, vendaValor: 0 } })

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
    })

    setData({
      clients,
      vendas,
      comissoes,
      byConsultor: Object.values(byConsultor).sort((a, b) => b.valor - a.valor),
      totals: {
        clients: clients.length,
        valor: clients.reduce((s, c) => s + (c.valor || 0), 0),
        ps: clients.reduce((s, c) => s + (c.ps || 0), 0),
        vendas: vendas.length,
        vendaValor: vendas.reduce((s, v) => s + (v.valor || 0), 0),
        comissaoPend: comissoes.filter(c => c.status === 'Pendente').reduce((s, c) => s + (c.ps || 0), 0),
        comissaoPago: comissoes.filter(c => c.status === 'Pago').reduce((s, c) => s + (c.ps || 0), 0),
      }
    })
    setLoading(false)
  }

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const t = data?.totals || {}

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} className="btn btn-secondary btn-icon"><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 700, fontSize: 16, minWidth: 120, textAlign: 'center' }}>
            {MONTHS[month - 1]} / {year}
          </span>
          <button onClick={nextMonth} className="btn btn-secondary btn-icon"><ChevronRight size={16} /></button>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Novos Clientes', value: t.clients, color: 'var(--info)' },
              { label: 'Valor Total',     value: fmtCur(t.valor), color: 'var(--success)' },
              { label: 'PS Total',        value: fmtCur(t.ps), color: 'var(--accent)' },
              { label: 'Vendas',          value: t.vendas, color: 'var(--warn)' },
              { label: 'Valor Vendas',    value: fmtCur(t.vendaValor), color: 'var(--success)' },
              { label: 'Comissão Pend.',  value: fmtCur(t.comissaoPend), color: 'var(--warn)' },
              { label: 'Comissão Paga',   value: fmtCur(t.comissaoPago), color: 'var(--success)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Per consultor (admin only) */}
          {isAdmin && data.byConsultor.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                Desempenho por Consultor — {MONTHS[month - 1]}/{year}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Consultor</th><th>Clientes</th><th>Valor Clientes</th><th>PS</th><th>Vendas</th><th>Valor Vendas</th></tr>
                  </thead>
                  <tbody>
                    {data.byConsultor.map(c => (
                      <tr key={c.nome}>
                        <td style={{ fontWeight: 500 }}>{c.nome}</td>
                        <td>{c.clients}</td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtCur(c.valor)}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtCur(c.ps)}</td>
                        <td>{c.vendas}</td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtCur(c.vendaValor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Client list for period */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
              Clientes do Período ({data.clients.length})
            </div>
            {data.clients.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhum cliente neste período</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead><tr><th>Nome</th><th>Banco</th><th>Valor</th><th>Data</th></tr></thead>
                  <tbody>
                    {data.clients.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.nome}</td>
                        <td><span className="badge" style={{ background: c.banco === 'Caixa' ? '#1d4ed822' : '#dc262622', color: c.banco === 'Caixa' ? 'var(--info)' : 'var(--danger)' }}>{c.banco}</span></td>
                        <td style={{ fontWeight: 600 }}>{fmtCur(c.valor)}</td>
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
