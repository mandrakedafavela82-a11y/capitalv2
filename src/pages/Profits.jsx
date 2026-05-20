import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCur } from '../lib/utils'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function ProfitCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 50, height: 50, borderRadius: 14, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function Profits() {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear]   = useState(new Date().getFullYear())
  const [months, setMonths] = useState([])  // last 12 months trend
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [month, year])

  function lastDay(m, y) { return new Date(y, m, 0).toISOString().slice(0, 10) }
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const to   = lastDay(month, year)

  async function load() {
    setLoading(true)

    // Current month data
    const [cl, vd, cm] = await Promise.all([
      supabase.from('clientes').select('valor, ps').gte('data', from).lte('data', to),
      supabase.from('vendas').select('valor, comissao_valor, status').gte('data', from).lte('data', to),
      supabase.from('comissoes').select('ps, status').eq('status', 'Pago'),
    ])

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
      const receita = (c2.data || []).reduce((s, c) => s + (c.valor || 0), 0)
      const comissoes = (c2.data || []).reduce((s, c) => s + (c.ps || 0), 0)
      trend.push({ label: MONTHS[m2 - 1], receita, comissoes, lucro: receita - comissoes })
    }
    setMonths(trend)

    const clients = cl.data || []
    const vendas  = vd.data || []
    const comis   = cm.data || []

    const receita       = clients.reduce((s, c) => s + (c.valor || 0), 0)
    const psTotal       = clients.reduce((s, c) => s + (c.ps || 0), 0)     // custo comissões
    const vendaReceita  = vendas.reduce((s, v) => s + (v.valor || 0), 0)
    const vendaComissao = vendas.reduce((s, v) => s + (v.comissao_valor || 0), 0)
    const comPago       = comis.reduce((s, c) => s + (c.ps || 0), 0)       // comissões já pagas

    const lucroClientes = receita - psTotal
    const lucroVendas   = vendaReceita - vendaComissao
    const lucroLiquido  = lucroClientes + lucroVendas
    const margemClientes = receita > 0 ? Math.round((lucroClientes / receita) * 100) : 0
    const margemVendas   = vendaReceita > 0 ? Math.round((lucroVendas / vendaReceita) * 100) : 0

    setMonths(prev => {
      // update last entry with exact numbers
      const copy = [...prev]
      if (copy.length) copy[copy.length - 1] = { ...copy[copy.length - 1], receita, comissoes: psTotal, lucro: lucroClientes }
      return copy
    })

    // Store as state
    setLoading(false)
    setMonths(trend)

    // Re-set derived card values
    setCards({ receita, psTotal, vendaReceita, vendaComissao, comPago, lucroClientes, lucroVendas, lucroLiquido, margemClientes, margemVendas, clients: clients.length })
  }

  const [cards, setCards] = useState({})

  const maxVal = Math.max(...months.map(m => m.receita), 1)

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Lucros</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} className="btn btn-secondary btn-icon"><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 700, fontSize: 16, minWidth: 120, textAlign: 'center' }}>{MONTHS[month - 1]} / {year}</span>
          <button onClick={nextMonth} className="btn btn-secondary btn-icon"><ChevronRight size={16} /></button>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
            <ProfitCard icon={DollarSign}   label="Receita Bruta"    value={fmtCur(cards.receita)}       sub={`${cards.clients} clientes`}        color="var(--success)" />
            <ProfitCard icon={TrendingDown} label="PS (Comissões)"   value={fmtCur(cards.psTotal)}       sub={`${100 - cards.margemClientes}% da receita`} color="var(--danger)" />
            <ProfitCard icon={TrendingUp}   label="Lucro Clientes"   value={fmtCur(cards.lucroClientes)} sub={`Margem: ${cards.margemClientes}%`}  color="var(--accent)" />
            <ProfitCard icon={DollarSign}   label="Receita Vendas"   value={fmtCur(cards.vendaReceita)}  sub="total de vendas"                     color="var(--info)" />
            <ProfitCard icon={TrendingDown} label="Comissão Vendas"  value={fmtCur(cards.vendaComissao)} sub={`${100 - cards.margemVendas}% das vendas`}   color="var(--warn)" />
            <ProfitCard icon={TrendingUp}   label="Lucro Líquido"    value={fmtCur(cards.lucroLiquido)}  sub="clientes + vendas"                   color={cards.lucroLiquido >= 0 ? 'var(--success)' : 'var(--danger)'} />
          </div>

          {/* 12-month trend chart (bar chart with CSS) */}
          <div className="card">
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Tendência 12 meses — Receita vs Lucro</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 140, overflowX: 'auto' }}>
              {months.map((m, i) => (
                <div key={i} style={{ flex: 1, minWidth: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'flex-end', height: 110 }}>
                    {/* Lucro bar */}
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      height: Math.max(4, (m.lucro / maxVal) * 90),
                      background: m.lucro >= 0 ? 'var(--accent)' : 'var(--danger)',
                      transition: 'height .3s',
                    }} title={`Lucro: ${fmtCur(m.lucro)}`} />
                    {/* Receita bar (behind/below) */}
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      height: Math.max(4, (m.receita / maxVal) * 20),
                      background: 'var(--info)', opacity: .4,
                      transition: 'height .3s',
                    }} title={`Receita: ${fmtCur(m.receita)}`} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>{m.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent)' }} />
                <span style={{ color: 'var(--muted)' }}>Lucro</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--info)', opacity: .6 }} />
                <span style={{ color: 'var(--muted)' }}>Receita</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
