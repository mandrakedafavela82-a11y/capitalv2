import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur, fmtDate, todayStr } from '../lib/utils'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const EMPTY = {
  cliente_nome: '', banco: 'Caixa', valor: '', ps: '',
  status: 'pendente', data: todayStr(), produto: '',
  comissao_pct: 37, comissao_valor: '', data_pagamento: '',
}

const STATUS_COLOR = {
  pendente:  { bg: 'var(--warn)',    text: '#fff' },
  concluida: { bg: 'var(--success)', text: '#fff' },
  cancelada: { bg: 'var(--danger)',  text: '#fff' },
}

export default function Sales() {
  const { profile, isAdmin } = useAuth()
  const [vendas, setVendas] = useState([])
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('todas')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [profile])

  async function load() {
    setLoading(true)
    const [v, u] = await Promise.all([
      supabase.from('vendas').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nome'),
    ])
    const mine = isAdmin ? (v.data || []) : (v.data || []).filter(x => x.consultor_id === profile?.id)
    setVendas(mine)
    setUsers(u.data || [])
    setLoading(false)
  }

  const displayed = filter === 'todas' ? vendas : vendas.filter(v => v.status === filter)

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true) }
  function openEdit(v) {
    setForm({
      ...EMPTY, ...v,
      valor: v.valor ?? '',
      ps: v.ps ?? '',
      comissao_pct: v.comissao_pct ?? 37,
      comissao_valor: v.comissao_valor ?? '',
      data_pagamento: v.data_pagamento ?? '',
    })
    setEditing(v.id)
    setModal(true)
  }

  function handleValorChange(valor) {
    const pct = parseFloat(form.comissao_pct) || 37
    const calc = ((parseFloat(valor) || 0) * pct / 100).toFixed(2)
    setForm(p => ({ ...p, valor, comissao_valor: calc }))
  }

  function handlePctChange(pct) {
    const calc = (((parseFloat(form.valor) || 0) * (parseFloat(pct) || 0)) / 100).toFixed(2)
    setForm(p => ({ ...p, comissao_pct: pct, comissao_valor: calc }))
  }

  async function save() {
    const payload = {
      ...form,
      valor: parseFloat(form.valor) || 0,
      ps: parseFloat(form.ps) || 0,
      comissao_pct: parseFloat(form.comissao_pct) || 37,
      comissao_valor: parseFloat(form.comissao_valor) || 0,
      data_pagamento: form.data_pagamento || null,
      consultor_id: form.consultor_id || profile?.id,
    }
    if (editing) {
      const { error } = await supabase.from('vendas').update(payload).eq('id', editing)
      if (error) return toast.error('Erro ao salvar')
      setVendas(prev => prev.map(v => v.id === editing ? { ...v, ...payload } : v))
      toast.success('Venda atualizada')
    } else {
      const { data, error } = await supabase.from('vendas').insert(payload).select().single()
      if (error) return toast.error('Erro ao salvar')
      setVendas(prev => [data, ...prev])
      toast.success('Venda adicionada')
    }
    setModal(false)
  }

  async function remove(id) {
    if (!confirm('Excluir venda?')) return
    await supabase.from('vendas').delete().eq('id', id)
    setVendas(prev => prev.filter(v => v.id !== id))
    toast.success('Venda removida')
  }

  const consultorNome = (id) => users.find(u => u.id === id)?.nome || '-'

  const totais = {
    valor: displayed.reduce((s, v) => s + (v.valor || 0), 0),
    comissao: displayed.reduce((s, v) => s + (v.comissao_valor || 0), 0),
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Vendas</h1>
        <button onClick={openAdd} className="btn btn-primary"><Plus size={16} /> Nova Venda</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Vendas', value: fmtCur(totais.valor), color: 'var(--success)' },
          { label: 'Total Comissão', value: fmtCur(totais.comissao), color: 'var(--accent)' },
          { label: 'Qtd', value: displayed.length, color: 'var(--info)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['todas','pendente','concluida','cancelada'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="btn btn-sm"
            style={{
              background: filter === f ? 'var(--accent)' : 'var(--hover)',
              color: filter === f ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)', textTransform: 'capitalize',
            }}
          >{f}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Produto</th>
                <th>Banco</th>
                <th>Valor</th>
                <th>Comissão</th>
                <th>Status</th>
                <th>Consultor</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Carregando...</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhuma venda</td></tr>
              ) : displayed.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 500 }}>{v.cliente_nome}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{v.produto || '-'}</td>
                  <td>
                    {v.banco && <span className="badge" style={{ background: v.banco === 'Caixa' ? '#1d4ed822' : '#dc262622', color: v.banco === 'Caixa' ? 'var(--info)' : 'var(--danger)' }}>{v.banco}</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmtCur(v.valor)}</td>
                  <td>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtCur(v.comissao_valor)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 4 }}>({v.comissao_pct || 37}%)</span>
                  </td>
                  <td>
                    <span className="badge" style={{ background: STATUS_COLOR[v.status]?.bg || 'var(--hover)', color: STATUS_COLOR[v.status]?.text || 'var(--text)', textTransform: 'capitalize' }}>
                      {v.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{consultorNome(v.consultor_id)}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(v.data)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(v)} className="btn btn-secondary btn-sm btn-icon"><Pencil size={13} /></button>
                      <button onClick={() => remove(v.id)} className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar Venda' : 'Nova Venda'}</h2>
            <div className="modal-row">
              <label>Nome do Cliente *</label>
              <input value={form.cliente_nome} onChange={e => setForm(p => ({ ...p, cliente_nome: e.target.value }))} placeholder="Nome" />
            </div>
            <div className="modal-row">
              <label>Produto / Serviço</label>
              <input value={form.produto} onChange={e => setForm(p => ({ ...p, produto: e.target.value }))} placeholder="Ex: Crédito Pessoal, FGTS..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="modal-row">
                <label>Banco</label>
                <select value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))}>
                  <option>Caixa</option><option>Santander</option>
                </select>
              </div>
              <div className="modal-row">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="pendente">Pendente</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div className="modal-row">
                <label>Valor da Venda (R$)</label>
                <input type="number" value={form.valor} onChange={e => handleValorChange(e.target.value)} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="modal-row">
                <label>PS (R$)</label>
                <input type="number" value={form.ps} onChange={e => setForm(p => ({ ...p, ps: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="modal-row">
                <label>% Comissão (padrão 37%)</label>
                <input type="number" value={form.comissao_pct} onChange={e => handlePctChange(e.target.value)} placeholder="37" min="0" max="100" step="0.1" />
              </div>
              <div className="modal-row">
                <label>Valor Comissão (R$) <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(auto)</span></label>
                <input type="number" value={form.comissao_valor} onChange={e => setForm(p => ({ ...p, comissao_valor: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="modal-row">
                <label>Data da Venda</label>
                <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
              <div className="modal-row">
                <label>Data de Pagamento</label>
                <input type="date" value={form.data_pagamento} onChange={e => setForm(p => ({ ...p, data_pagamento: e.target.value }))} />
              </div>
              {isAdmin && (
                <div className="modal-row" style={{ gridColumn: '1 / -1' }}>
                  <label>Consultor</label>
                  <select value={form.consultor_id || ''} onChange={e => setForm(p => ({ ...p, consultor_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} className="btn btn-primary" disabled={!form.cliente_nome}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
