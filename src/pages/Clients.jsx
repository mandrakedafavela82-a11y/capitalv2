import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur, fmtDate, todayStr } from '../lib/utils'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'

const EMPTY = {
  nome: '', cpf: '-', cidade: '-', banco: 'Caixa',
  valor: '', ps: '', data: todayStr(),
  telefone: '', email: '', endereco: '', produto: '',
}

export default function Clients() {
  const { profile, isAdmin } = useAuth()
  const [clients, setClients] = useState([])
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('Caixa')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [profile])

  async function load() {
    setLoading(true)
    const [c, u] = await Promise.all([
      supabase.from('clientes').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nome'),
    ])
    const mine = isAdmin ? (c.data || []) : (c.data || []).filter(x => x.consultor_id === profile?.id)
    setClients(mine)
    setUsers(u.data || [])
    setLoading(false)
  }

  const displayed = clients
    .filter(c => c.banco === tab)
    .filter(c => !search || c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.cpf && c.cpf.includes(search)) ||
      (c.telefone && c.telefone.includes(search)))

  function openAdd() { setForm({ ...EMPTY, banco: tab }); setEditing(null); setModal(true) }
  function openEdit(c) {
    setForm({
      ...EMPTY, ...c,
      valor: c.valor ?? '',
      ps: c.ps ?? '',
      telefone: c.telefone || '',
      email: c.email || '',
      endereco: c.endereco || '',
      produto: c.produto || '',
    })
    setEditing(c.id)
    setModal(true)
  }

  async function save() {
    const payload = {
      ...form,
      valor: parseFloat(form.valor) || 0,
      ps: parseFloat(form.ps) || 0,
      consultor_id: isAdmin && form.consultor_id ? form.consultor_id : (editing ? form.consultor_id : profile?.id),
    }
    if (editing) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', editing)
      if (error) { console.error('[DB]', error); return toast.error(error.message || 'Erro ao salvar') }
      setClients(prev => prev.map(c => c.id === editing ? { ...c, ...payload } : c))
      toast.success('Cliente atualizado')
    } else {
      const { data, error } = await supabase.from('clientes').insert(payload).select().single()
      if (error) { console.error('[DB]', error); return toast.error(error.message || 'Erro ao salvar') }
      setClients(prev => [data, ...prev])
      toast.success('Cliente adicionado')
    }
    setModal(false)
  }

  async function remove(id) {
    if (!confirm('Excluir cliente?')) return
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) { console.error('[DB]', error); return toast.error(error.message || 'Erro ao excluir') }
    setClients(prev => prev.filter(c => c.id !== id))
    toast.success('Cliente removido')
  }

  const consultorNome = (id) => users.find(u => u.id === id)?.nome || '-'
  const canSePS = (c) => isAdmin || c.consultor_id === profile?.id

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clientes</h1>
        <button onClick={openAdd} className="btn btn-primary"><Plus size={16} /> Novo Cliente</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['Caixa', 'Santander'].map(b => (
          <button key={b} onClick={() => setTab(b)} className="btn btn-sm"
            style={{ background: tab === b ? 'var(--accent)' : 'var(--hover)', color: tab === b ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
            {b}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          <input placeholder="Nome, CPF, telefone..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220, paddingLeft: 30 }} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>CPF</th>
                <th>Cidade</th>
                <th>Produto</th>
                <th>Valor</th>
                <th>PS</th>
                <th>Consultor</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Carregando...</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhum cliente</td></tr>
              ) : displayed.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.nome}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {c.telefone && <div>📞 {c.telefone}</div>}
                    {c.email && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>✉ {c.email}</div>}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{c.cpf}</td>
                  <td>{c.cidade}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{c.produto || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtCur(c.valor)}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{canSePS(c) ? fmtCur(c.ps) : '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{consultorNome(c.consultor_id)}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(c.data)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(c)} className="btn btn-secondary btn-sm btn-icon"><Pencil size={13} /></button>
                      <button onClick={() => remove(c.id)} className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
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
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar Cliente' : 'Novo Cliente'}</h2>
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
                <label>Email</label>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="cliente@email.com" />
              </div>
              <div className="modal-row">
                <label>CPF</label>
                <input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
              <div className="modal-row">
                <label>Cidade</label>
                <input value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} placeholder="Cidade" />
              </div>
              <div className="modal-row" style={{ gridColumn: '1 / -1' }}>
                <label>Endereço</label>
                <input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} placeholder="Rua, número, bairro..." />
              </div>
              <div className="modal-row" style={{ gridColumn: '1 / -1' }}>
                <label>Produto / Serviço</label>
                <input value={form.produto} onChange={e => setForm(p => ({ ...p, produto: e.target.value }))} placeholder="Ex: Crédito Pessoal, FGTS..." />
              </div>
              <div className="modal-row">
                <label>Banco</label>
                <select value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))}>
                  <option>Caixa</option><option>Santander</option>
                </select>
              </div>
              <div className="modal-row">
                <label>Data</label>
                <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
              <div className="modal-row">
                <label>Valor (R$)</label>
                <input type="number" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="modal-row">
                <label>PS (R$)</label>
                <input type="number" value={form.ps} onChange={e => setForm(p => ({ ...p, ps: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
              </div>
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
