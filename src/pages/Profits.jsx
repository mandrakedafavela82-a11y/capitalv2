import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCur, fmtDate } from '../lib/utils'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function ProfitCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 48, height: 48, borderRadius: 13, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={21} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
        <div style={{ fontSize: 21, fontWeight: 700, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function Profits() {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [trendMonths, setTrendMonths] = useState([])
  const [cards, setCards] = useState({})
  const [clients, setClients] = useState([])
  const [vendas, setVendas] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [month, year])

  function lastDay(m, y) { return new Date(y, m, 0).toISOString().slice(0, 10) }
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const to = lastDay(month, year)

  async function load() {
    setLoading(true)

    // Current month data
    const [cl, vd, us] = await Promise.all([
      supabase.from('clientes').select('id, nome, valor, ps, data, banco, consultor_id').gte('data', from).lte('data', to),
      supabase.from('vendas').select('id, cliente_nome, valor, comissao_valor, data, consultor_id, ps').gte('data', from).lte('data', to),
      supabase.from('profiles').select('id, nome'),
    ])

    const clientsData = cl.data || []
    const vendasData = vd.data || []
    const usersData = us.data || []

    const receita = clientsData.reduce((s, c) => s + (c.valor || 0), 0)
    const psTotal = clientsData.reduce((s, c) => s + (c.ps || 0), 0)
    const vendaReceita = vendasData.reduce((s, v) => s + (v.valor || 0), 0)
    const vendaComissao = vendasData.reduce((s, v) => s + (v.comissao_valor || 0), 0)
    const lucroClientes = receita - psTotal
    const lucroVendas = vendaReceita - vendaComissao
    const lucroTotal = lucroClientes + lucroVendas
    const margemClientes = receita > 0 ? Math.round((lucroClientes / receita) * 100) : 0

    setCards({ receita, psTotal, vendaReceita, vendaComissao, lucroClientes, lucroVendas, lucroTotal, margemClientes, clientCount: clientsData.length })
    setClients(clientsData)
    setVendas(vendasData)
    setUsers(usersData)

    // 12-month trend
    const trend = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const m2 = d.getMonth() + 1
      const y2 = d.getFullYear()
      const f2 = `${y2}-${String(m2).padStart(2,'0')}-01`
      const t2 = lastDay(m2, y2)
      const [c2, v2] = await Promise.all([
        supabase.from('clientes').select('valor, ps').gte('data', f2).lte('data', t2),
        supabase.from('vendas').select('valor, comissao_valor').gte('data', f2).lte('data', t2),
      ])
      const rec2 = (c2.data || []).reduce((s, c) => s + (c.valor || 0), 0)
      const ps2 = (c2.data || []).reduce((s, c) => s + (c.ps || 0), 0)
      const vRec2 = (v2.data || []).reduce((s, v) => s + (v.valor || 0), 0)
      const vCom2 = (v2.data || []).reduce((s, v) => s + (v.comissao_valor || 0), 0)
      trend.push({ label: MONTHS[m2 - 1], receita: rec2, lucro: (rec2 - ps2) + (vRec2 - vCom2) })
    }
    setTrendMonths(trend)

    setLoading(false)
  }

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const maxVal = Math.max(...trendMonths.map(m => m.receita), 1)
  const uNome = id => users.find(u => u.id === id)?.nome || '-'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Lucros</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} className="btn btn-secondary btn-icon"><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 700, fontSize: 15, minWidth: 120, textAlign: 'center' }}>{MONTHS[month - 1]} / {year}</span>
          <button onClick={nextMonth} className="btn btn-secondary btn-icon"><ChevronRight size={16} /></button>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
            <ProfitCard icon={DollarSign}   label="Total em Vendas"   value={fmtCur(cards.vendaReceita)}  sub={`${vendas.length} operações`}              color="var(--success)" />
            <ProfitCard icon={TrendingDown} label="Comissão Vendedores" value={fmtCur(cards.psTotal + cards.vendaComissao)} sub="PS + comissão vendas"      color="var(--danger)" />
            <ProfitCard icon={TrendingUp}   label="Lucro Total"        value={fmtCur(cards.lucroTotal)}   sub={`Margem: ${cards.margemClientes}%`}          color="var(--accent)" />
            <ProfitCard icon={Users}        label="Clientes"           value={cards.clientCount}          sub={fmtCur(cards.receita) + ' crédito total'}    color="var(--info)" />
          </div>

          {/* 12-month trend */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700 }}>Tendência 12 meses</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120 }}>
              {trendMonths.map((m, i) => (
                <div key={i} style={{ flex: 1, minWidth: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'flex-end', height: 96 }}>
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      height: Math.max(4, (m.lucro / maxVal) * 75),
                      background: m.lucro >= 0 ? 'var(--accent)' : 'var(--danger)',
                      transition: 'height .3s',
                    }} title={`Lucro: ${fmtCur(m.lucro)}`} />
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      height: Math.max(3, (m.receita / maxVal) * 18),
                      background: 'var(--info)', opacity: .45,
                      transition: 'height .3s',
                    }} title={`Receita: ${fmtCur(m.receita)}`} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center' }}>{m.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent)', display: 'inline-block' }} />
                <span style={{ color: 'var(--muted)' }}>Lucro</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--info)', display: 'inline-block', opacity: .5 }} />
                <span style={{ color: 'var(--muted)' }}>Receita</span>
              </span>
            </div>
          </div>

          {/* Detalhamento por cliente */}
          {clients.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Detalhamento por Cliente</span>
                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>{clients.length} registros</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th>Banco</th>
                      <th>Valor Crédito</th>
                      <th>PS (Comissão)</th>
                      <th>Lucro Bruto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(c => {
                      const lucro = (c.valor || 0) - (c.ps || 0)
                      return (
                        <tr key={c.id}>
                          <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(c.data)}</td>
                          <td style={{ fontWeight: 500 }}>{c.nome}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 13 }}>{uNome(c.consultor_id)}</td>
                          <td>
                            <span className="badge" style={{ background: c.banco === 'Caixa' ? '#1d4ed822' : '#dc262622', color: c.banco === 'Caixa' ? 'var(--info)' : 'var(--danger)' }}>
                              {c.banco}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtCur(c.valor)}</td>
                          <td style={{ color: 'var(--warn)' }}>{fmtCur(c.ps)}</td>
                          <td style={{ fontWeight: 700, color: lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtCur(lucro)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--hover)' }}>
                      <td colSpan={4} style={{ fontWeight: 700, padding: '12px 14px', borderTop: '2px solid var(--border)' }}>Total</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)', padding: '12px 14px', borderTop: '2px solid var(--border)' }}>{fmtCur(cards.receita)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--warn)', padding: '12px 14px', borderTop: '2px solid var(--border)' }}>{fmtCur(cards.psTotal)}</td>
                      <td style={{ fontWeight: 700, color: cards.lucroClientes >= 0 ? 'var(--success)' : 'var(--danger)', padding: '12px 14px', borderTop: '2px solid var(--border)' }}>{fmtCur(cards.lucroClientes)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Detalhamento por venda */}
          {vendas.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Detalhamento por Venda</span>
                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>{vendas.length} operações</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th>Valor Venda</th>
                      <th>Comissão</th>
                      <th>Lucro Bruto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.map(v => {
                      const lucro = (v.valor || 0) - (v.comissao_valor || 0)
                      return (
                        <tr key={v.id}>
                          <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(v.data)}</td>
                          <td style={{ fontWeight: 500 }}>{v.cliente_nome}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 13 }}>{uNome(v.consultor_id)}</td>
                          <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtCur(v.valor)}</td>
                          <td style={{ color: 'var(--warn)' }}>{fmtCur(v.comissao_valor)}</td>
                          <td style={{ fontWeight: 700, color: lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtCur(lucro)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--hover)' }}>
                      <td colSpan={3} style={{ fontWeight: 700, padding: '12px 14px', borderTop: '2px solid var(--border)' }}>Total</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)', padding: '12px 14px', borderTop: '2px solid var(--border)' }}>{fmtCur(cards.vendaReceita)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--warn)', padding: '12px 14px', borderTop: '2px solid var(--border)' }}>{fmtCur(cards.vendaComissao)}</td>
                      <td style={{ fontWeight: 700, color: cards.lucroVendas >= 0 ? 'var(--success)' : 'var(--danger)', padding: '12px 14px', borderTop: '2px solid var(--border)' }}>{fmtCur(cards.lucroVendas)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
