import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur, fmtDate, currentMonth, monthStr } from '../lib/utils'
import { toast } from 'sonner'
import { CheckCircle } from 'lucide-react'

export default function Commissions() {
  const { profile, isAdmin } = useAuth()
  const [comissoes, setComissoes] = useState([])
  const [mes, setMes] = useState(currentMonth())
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [profile])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('comissoes')
      .select('*, clientes(nome, consultor_id, data, banco)')
      .order('created_at', { ascending: false })

    if (error) { setLoading(false); return }

    const mine = isAdmin
      ? data || []
      : (data || []).filter(c => c.clientes?.consultor_id === profile?.id)

    setComissoes(mine)
    setLoading(false)
  }

  // Build set of available months
  const months = [...new Set(comissoes.map(c => monthStr(c.clientes?.data)).filter(Boolean))].sort().reverse()

  const filtered = mes === 'todas'
    ? comissoes
    : comissoes.filter(c => monthStr(c.clientes?.data) === mes)

  const pendente = filtered.filter(c => c.status === 'Pendente')
  const pago = filtered.filter(c => c.status === 'Pago')

  const totalPend = pendente.reduce((s, c) => s + (c.ps || 0), 0)
  const totalPago = pago.reduce((s, c) => s + (c.ps || 0), 0)

  async function marcarPago(id) {
    if (!isAdmin) return
    const { error } = await supabase.from('comissoes').update({ status: 'Pago' }).eq('id', id)
    if (error) return toast.error('Erro ao atualizar')
    setComissoes(prev => prev.map(c => c.id === id ? { ...c, status: 'Pago' } : c))
    toast.success('Marcado como pago')
  }

  function CommRow({ c }) {
    const nome = c.clientes?.nome || '-'
    const banco = c.clientes?.banco
    return (
      <tr>
        <td style={{ fontWeight: 500 }}>{nome}</td>
        <td>
          {banco && (
            <span className="badge" style={{ background: banco === 'Caixa' ? '#1d4ed822' : '#dc262622', color: banco === 'Caixa' ? 'var(--info)' : 'var(--danger)' }}>
              {banco}
            </span>
          )}
        </td>
        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtCur(c.ps)}</td>
        <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(c.clientes?.data)}</td>
        {isAdmin && c.status === 'Pendente' && (
          <td>
            <button onClick={() => marcarPago(c.id)} className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff', gap: 4 }}>
              <CheckCircle size={13} /> Pagar
            </button>
          </td>
        )}
        {(!isAdmin || c.status !== 'Pendente') && <td />}
      </tr>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Comissões</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setMes('todas')}
            className="btn btn-sm"
            style={{ background: mes === 'todas' ? 'var(--accent)' : 'var(--hover)', color: mes === 'todas' ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}
          >Todas</button>
          {months.map(m => (
            <button
              key={m}
              onClick={() => setMes(m)}
              className="btn btn-sm"
              style={{ background: mes === m ? 'var(--accent)' : 'var(--hover)', color: mes === m ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Pendente</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warn)', marginTop: 4 }}>{fmtCur(totalPend)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{pendente.length} comissão(ões)</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Pago</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)', marginTop: 4 }}>{fmtCur(totalPago)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{pago.length} comissão(ões)</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{fmtCur(totalPend + totalPago)}</div>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
        <>
          {/* Pendentes */}
          {pendente.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--warn)' }}>
                Pendente ({pendente.length})
              </h2>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="tbl">
                  <thead><tr><th>Cliente</th><th>Banco</th><th>PS</th><th>Data</th><th></th></tr></thead>
                  <tbody>{pendente.map(c => <CommRow key={c.id} c={c} />)}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagos */}
          {pago.length > 0 && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--success)' }}>
                Pago ({pago.length})
              </h2>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="tbl">
                  <thead><tr><th>Cliente</th><th>Banco</th><th>PS</th><th>Data</th><th></th></tr></thead>
                  <tbody>{pago.map(c => <CommRow key={c.id} c={c} />)}</tbody>
                </table>
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
              Nenhuma comissão no período selecionado
            </div>
          )}
        </>
      )}
    </div>
  )
}
