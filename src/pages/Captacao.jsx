import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtDate, todayStr } from '../lib/utils'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const EMPTY = { nome: '', telefone: '', banco: 'Caixa', origem: '', status: 'novo', obs: '', data: todayStr() }

const STATUS_STYLE = {
  novo:        { bg: '#3b82f633', color: '#3b82f6' },
  contato:     { bg: '#f59e0b33', color: '#f59e0b' },
  qualificado: { bg: '#10b98133', color: '#10b981' },
  perdido:     { bg: '#ef444433', color: '#ef4444' },
}

export default function Captacao() {
  const { profile, isAdmin } = useAuth()
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [profile])

  async function load() {
    setLoading(true)
    const [l, u] = await Promise.all([
      supabase.from('captacao').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nome'),
    ])
    const mine = isAdmin ? (l.data || []) : (l.data || []).filter(x => x.consultor_id === profile?.id)
    setLeads(mine)
    setUsers(u.data || [])
    setLoading(false)
  }

  const displayed = filter === 'todos' ? leads : leads.filter(l => l.status === filter)

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true) }
  function openEdit(l) { setForm({ ...l }); setEditing(l.id); setModal(true) }

  async function save() {
    const payload = { ...form, consultor_id: form.consultor_id || profile?.id }
    if (editing) {
      const { error } = await supabase.from('captacao').update(payload).eq('id', editing)
      if (error) return toast.error('Erro ao salvar')
      setLeads(prev => prev.map(l => l.id === editing ? { ...l, ...payload } : l))
      toast.success('Lead atualizado')
    } else {
      const { data, error } = await supabase.from('captacao').insert(payload).select().single()
      if (error) return toast.error('Erro ao salvar')
      setLeads(prev => [data, ...prev])
      toast.success('Lead adicionado')
    }
    setModal(false)
  }

  async function remove(id) {
    if (!confirm('Excluir lead?')) return
    await supabase.from('captacao').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    toast.success('Lead removido')
  }

  const consultorNome = (id) => users.find(u => u.id === id)?.nome || '-'

  // Stats
  const stats = ['novo','contato','qualificado','perdido'].map(s => ({
    key: s, count: leads.filter(l => l.status === s).length
  }))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Captação</h1>
        <button onClick={openAdd} className="btn btn-primary"><Plus size={16} /> Novo Lead</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.key} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: STATUS_STYLE[s.key]?.color, fontWeight: 700, textTransform: 'capitalize', marginBottom: 4 }}>
              {s.key}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['todos','novo','contato','qualificado','perdido'].map(f => (
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
                <th>Nome</th>
                <th>Telefone</th>
                <th>Banco</th>
                <th>Origem</th>
                <th>Status</th>
                <th>Consultor</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Carregando...</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhum lead</td></tr>
              ) : displayed.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 500 }}>{l.nome}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{l.telefone || '-'}</td>
                  <td>
                    {l.banco && (
                      <span className="badge" style={{ background: l.banco === 'Caixa' ? '#1d4ed822' : '#dc262622', color: l.banco === 'Caixa' ? 'var(--info)' : 'var(--danger)' }}>
                        {l.banco}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{l.origem || '-'}</td>
                  <td>
                    <span className="badge" style={{ background: STATUS_STYLE[l.status]?.bg || 'var(--hover)', color: STATUS_STYLE[l.status]?.color || 'var(--text)', textTransform: 'capitalize' }}>
                      {l.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{consultorNome(l.consultor_id)}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(l.data)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(l)} className="btn btn-secondary btn-sm btn-icon"><Pencil size={13} /></button>
                      <button onClick={() => remove(l.id)} className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar Lead' : 'Novo Lead'}</h2>
            <div className="modal-row">
              <label>Nome *</label>
              <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="modal-row">
                <label>Telefone</label>
                <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div className="modal-row">
                <label>Banco</label>
                <select value={form.banco || ''} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))}>
                  <option value="">Selecione</option>
                  <option>Caixa</option><option>Santander</option>
                </select>
              </div>
              <div className="modal-row">
                <label>Origem</label>
                <input value={form.origem} onChange={e => setForm(p => ({ ...p, origem: e.target.value }))} placeholder="WhatsApp, Indicação..." />
              </div>
              <div className="modal-row">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="novo">Novo</option>
                  <option value="contato">Contato</option>
                  <option value="qualificado">Qualificado</option>
                  <option value="perdido">Perdido</option>
                </select>
              </div>
              <div className="modal-row">
                <label>Data</label>
                <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
              {isAdmin && (
                <div className="modal-row">
                  <label>Consultor</label>
                  <select value={form.consultor_id || ''} onChange={e => setForm(p => ({ ...p, consultor_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-row">
              <label>Observação</label>
              <textarea rows={3} value={form.obs} onChange={e => setForm(p => ({ ...p, obs: e.target.value }))} placeholder="Anotações..." />
            </div>
            <div className="modal-actions">
              <button onClick={() => setModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} className="btn btn-primary" disabled={!form.nome}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
