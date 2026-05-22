import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur } from '../lib/utils'
import { toast } from 'sonner'
import { UserPlus, Pencil, Trash2, Shield, Users } from 'lucide-react'
import Modal from '../components/Modal'

const ROLE_LABEL = { admin: 'Administrador', consultor: 'Consultor', operacional: 'Operacional' }
const ROLE_COLOR = {
  admin:      { bg: '#b8902a22', color: 'var(--accent)' },
  consultor:  { bg: '#3b82f622', color: 'var(--info)' },
  operacional:{ bg: '#10b98122', color: 'var(--success)' },
}

export default function Team() {
  const { profile, isAdmin } = useAuth()
  const [members, setMembers] = useState([])
  const [stats, setStats] = useState({})        // { profileId: { clients, valor } }
  const [approved, setApproved] = useState([])  // approved_emails
  const [editModal, setEditModal] = useState(null)
  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ email: '', nome: '', role: 'consultor' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [m, c, v, ap] = await Promise.all([
      supabase.from('profiles').select('*').order('nome'),
      supabase.from('clientes').select('consultor_id, valor'),
      supabase.from('vendas').select('consultor_id, valor'),
      isAdmin ? supabase.from('approved_emails').select('*').order('email') : Promise.resolve({ data: [] }),
    ])
    setMembers(m.data || [])
    setApproved(ap.data || [])

    // Build stats
    const s = {}
    ;(c.data || []).forEach(cl => {
      if (!cl.consultor_id) return
      if (!s[cl.consultor_id]) s[cl.consultor_id] = { clients: 0, valor: 0, vendas: 0, vendaValor: 0 }
      s[cl.consultor_id].clients++
      s[cl.consultor_id].valor += (cl.valor || 0)
    })
    ;(v.data || []).forEach(vd => {
      if (!vd.consultor_id) return
      if (!s[vd.consultor_id]) s[vd.consultor_id] = { clients: 0, valor: 0, vendas: 0, vendaValor: 0 }
      s[vd.consultor_id].vendas++
      s[vd.consultor_id].vendaValor += (vd.valor || 0)
    })
    setStats(s)
    setLoading(false)
  }

  async function changeRole(id, role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) return toast.error('Erro ao alterar cargo')
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m))
    setEditModal(null)
    toast.success('Cargo atualizado')
  }

  async function addApproved() {
    if (!addForm.email) return
    const { error } = await supabase.from('approved_emails').insert({
      email: addForm.email.toLowerCase().trim(),
      nome: addForm.nome || null,
      role: addForm.role,
    })
    if (error) {
      if (error.code === '23505') return toast.error('E-mail já está na lista')
      return toast.error('Erro ao adicionar')
    }
    toast.success('E-mail autorizado adicionado')
    setAddModal(false)
    setAddForm({ email: '', nome: '', role: 'consultor' })
    load()
  }

  async function removeApproved(id) {
    if (!confirm('Remover autorização deste e-mail?')) return
    await supabase.from('approved_emails').delete().eq('id', id)
    setApproved(prev => prev.filter(a => a.id !== id))
    toast.success('Removido')
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="page-title" style={{ marginBottom: 24 }}>Equipe</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
          {members.map(m => (
            <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.avatar || '?'}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{m.nome}</div>
                <span className="badge" style={{ background: ROLE_COLOR[m.role]?.bg, color: ROLE_COLOR[m.role]?.color }}>{ROLE_LABEL[m.role] || m.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Equipe</h1>
        <button onClick={() => setAddModal(true)} className="btn btn-primary">
          <UserPlus size={16} /> Autorizar E-mail
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total membros', value: members.length, icon: Users },
          { label: 'Administradores', value: members.filter(m => m.role === 'admin').length, icon: Shield },
          { label: 'Consultores', value: members.filter(m => m.role === 'consultor').length, icon: Users },
          { label: 'Operacionais', value: members.filter(m => m.role === 'operacional').length, icon: Users },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <s.icon size={20} color="var(--muted)" />
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Members table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Membros</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Clientes</th><th>Valor</th><th>Vendas</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Carregando...</td></tr>
              ) : members.map(m => {
                const st = stats[m.id] || {}
                return (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 13, overflow: 'hidden', flexShrink: 0 }}>
                          {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.avatar || '?'}
                        </div>
                        <span style={{ fontWeight: 500 }}>{m.nome}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>{m.email}</td>
                    <td>
                      <span className="badge" style={{ background: ROLE_COLOR[m.role]?.bg, color: ROLE_COLOR[m.role]?.color }}>
                        {ROLE_LABEL[m.role] || m.role}
                      </span>
                    </td>
                    <td>{st.clients || 0}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtCur(st.valor || 0)}</td>
                    <td>{st.vendas || 0}</td>
                    <td>
                      <button onClick={() => setEditModal(m)} className="btn btn-secondary btn-sm btn-icon"><Pencil size={13} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approved emails */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>E-mails Autorizados (Google Login)</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>E-mail</th><th>Nome</th><th>Cargo</th><th></th></tr></thead>
            <tbody>
              {approved.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhum e-mail autorizado</td></tr>
              ) : approved.map(a => (
                <tr key={a.id}>
                  <td style={{ fontSize: 13 }}>{a.email}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{a.nome || '-'}</td>
                  <td>
                    <span className="badge" style={{ background: ROLE_COLOR[a.role]?.bg, color: ROLE_COLOR[a.role]?.color }}>
                      {ROLE_LABEL[a.role] || a.role}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => removeApproved(a.id)} className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit role modal */}
      {editModal && (
        <Modal onClose={() => setEditModal(null)} maxWidth={400}>
            <h2>Alterar Cargo — {editModal.nome}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {Object.entries(ROLE_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => changeRole(editModal.id, key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderRadius: 10, border: `2px solid ${editModal.role === key ? ROLE_COLOR[key]?.color || 'var(--border)' : 'var(--border)'}`,
                    background: editModal.role === key ? (ROLE_COLOR[key]?.bg || 'var(--hover)') : 'var(--hover)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, fontWeight: editModal.role === key ? 700 : 400, color: editModal.role === key ? (ROLE_COLOR[key]?.color || 'var(--text)') : 'var(--text)' }}>{label}</div>
                  {editModal.role === key && <div style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLOR[key]?.color || 'var(--accent)' }} />}
                </button>
              ))}
            </div>
            <div className="modal-actions"><button onClick={() => setEditModal(null)} className="btn btn-secondary">Fechar</button></div>
        </Modal>
      )}

      {/* Add approved email modal */}
      {addModal && (
        <Modal onClose={() => setAddModal(false)} maxWidth={420}>
            <h2>Autorizar E-mail para Google Login</h2>
            <div className="modal-row"><label>E-mail *</label><input type="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@gmail.com" /></div>
            <div className="modal-row"><label>Nome (opcional)</label><input value={addForm.nome} onChange={e => setAddForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do usuário" /></div>
            <div className="modal-row">
              <label>Cargo</label>
              <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}>
                <option value="consultor">Consultor</option>
                <option value="operacional">Operacional</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="modal-actions">
              <button onClick={() => setAddModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={addApproved} className="btn btn-primary" disabled={!addForm.email}>Autorizar</button>
            </div>
        </Modal>
      )}
    </div>
  )
}
