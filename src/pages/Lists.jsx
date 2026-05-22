import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtDate, todayStr } from '../lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import Modal from '../components/Modal'

const EMPTY_LIST = { nome: '', banco: 'Caixa', data: todayStr() }

const LEAD_STATUS = {
  contacted:     { label: 'Contatado',       bg: '#3b82f633', color: '#3b82f6' },
  added_to_crm:  { label: 'No CRM',          bg: '#10b98133', color: '#10b981' },
  no_answer:     { label: 'Sem Resposta',     bg: '#f59e0b33', color: '#f59e0b' },
  not_interested:{ label: 'Sem Interesse',    bg: '#ef444433', color: '#ef4444' },
}

const STATUS_CYCLE = ['contacted', 'no_answer', 'not_interested', 'added_to_crm']

export default function Lists() {
  const { profile, isAdmin } = useAuth()
  const [lists, setLists] = useState([])
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_LIST)
  const [nomes, setNomes] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [leadData, setLeadData] = useState({}) // { listId: [lead_contatos] }
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [profile])

  async function load() {
    setLoading(true)
    const [l, u] = await Promise.all([
      supabase.from('listas').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nome'),
    ])
    setLists(l.data || [])
    setUsers(u.data || [])
    setLoading(false)
  }

  async function save() {
    const payload = { ...form, consultor_id: profile?.id }
    const { data: lista, error } = await supabase.from('listas').insert(payload).select().single()
    if (error) return toast.error('Erro ao criar lista')

    const names = nomes.split('\n').map(n => n.trim()).filter(Boolean)
    if (names.length > 0) {
      const leadRows = names.map(nome => ({
        lista_id: lista.id,
        nome,
        consultor_id: profile?.id,
        status: 'contacted',
      }))
      const { error: le } = await supabase.from('lead_contatos').insert(leadRows)
      if (le) toast.error('Lista criada mas erro ao importar leads')
      else toast.success(`Lista criada com ${names.length} lead(s)`)
    } else {
      toast.success('Lista criada')
    }

    setLists(prev => [lista, ...prev])
    setModal(false)
    setForm(EMPTY_LIST)
    setNomes('')
  }

  async function remove(id) {
    if (!confirm('Excluir lista e todos os leads?')) return
    const { error } = await supabase.from('listas').delete().eq('id', id)
    if (error) return toast.error('Erro ao excluir')
    setLists(prev => prev.filter(l => l.id !== id))
    toast.success('Lista removida')
  }

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!leadData[id]) {
      const { data } = await supabase
        .from('lead_contatos')
        .select('*')
        .eq('lista_id', id)
        .order('nome')
      setLeadData(prev => ({ ...prev, [id]: data || [] }))
    }
  }

  async function cycleStatus(lead) {
    const idx = STATUS_CYCLE.indexOf(lead.status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    const { error } = await supabase.from('lead_contatos').update({ status: next }).eq('id', lead.id)
    if (error) return toast.error('Erro ao atualizar')
    setLeadData(prev => ({
      ...prev,
      [lead.lista_id]: (prev[lead.lista_id] || []).map(l => l.id === lead.id ? { ...l, status: next } : l),
    }))
  }

  async function sendToCRM(lead) {
    // Create a client entry from this lead
    const lista = lists.find(l => l.id === lead.lista_id)
    const { data: client, error } = await supabase.from('clientes').insert({
      nome: lead.nome,
      cpf: lead.lead_cpf || '-',
      telefone: lead.telefone,
      banco: lista?.banco || 'Caixa',
      lista_id: lead.lista_id,
      consultor_id: profile?.id,
      data: todayStr(),
    }).select().single()

    if (error) return toast.error('Erro ao enviar para CRM')

    // Mark as added_to_crm
    await supabase.from('lead_contatos').update({ status: 'added_to_crm', crm_id: client.id }).eq('id', lead.id)
    setLeadData(prev => ({
      ...prev,
      [lead.lista_id]: (prev[lead.lista_id] || []).map(l => l.id === lead.id ? { ...l, status: 'added_to_crm', crm_id: client.id } : l),
    }))
    toast.success(`${lead.nome} enviado para Clientes/CRM`)
  }

  const consultorNome = (id) => users.find(u => u.id === id)?.nome || '-'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Listas</h1>
        <button onClick={() => { setModal(true); setForm(EMPTY_LIST); setNomes('') }} className="btn btn-primary">
          <Plus size={16} /> Nova Lista
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Carregando...</p>
      ) : lists.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Nenhuma lista criada</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lists.map(l => {
            const leads = leadData[l.id] || []
            const stats = leads.length > 0 ? Object.entries(LEAD_STATUS).map(([k, v]) => ({ key: k, ...v, count: leads.filter(ld => ld.status === k).length })) : []
            return (
              <div key={l.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{l.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {l.banco} · {fmtDate(l.data)} · {consultorNome(l.consultor_id)}
                      {expanded === l.id && leads.length > 0 && (
                        <span style={{ marginLeft: 8 }}>
                          {stats.filter(s => s.count > 0).map(s => (
                            <span key={s.key} style={{ marginLeft: 6, color: s.color }}>
                              {s.count} {s.label.toLowerCase()}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => toggleExpand(l.id)} className="btn btn-secondary btn-sm btn-icon">
                    {expanded === l.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button onClick={() => remove(l.id)} className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {expanded === l.id && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                    {leads.length === 0 ? (
                      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nenhum lead nesta lista</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {leads.map(ld => {
                          const st = LEAD_STATUS[ld.status] || LEAD_STATUS.contacted
                          return (
                            <div key={ld.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--hover)', borderRadius: 8 }}>
                              <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{ld.nome}</div>
                              {ld.telefone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{ld.telefone}</div>}
                              <button
                                onClick={() => cycleStatus(ld)}
                                className="badge"
                                style={{ background: st.bg, color: st.color, cursor: 'pointer', border: 'none' }}
                                title="Clique para mudar status"
                              >
                                {st.label}
                              </button>
                              {ld.status !== 'added_to_crm' && (
                                <button onClick={() => sendToCRM(ld)} className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff', padding: '3px 8px', fontSize: 11 }}>
                                  → CRM
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal onClose={() => setModal(false)} maxWidth={560}>
          
            <h2>Nova Lista</h2>
            <div className="modal-row">
              <label>Nome da Lista *</label>
              <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Lista Caixa Maio" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            </div>
            <div className="modal-row">
              <label>Leads (cole um nome por linha)</label>
              <textarea
                rows={8}
                value={nomes}
                onChange={e => setNomes(e.target.value)}
                placeholder={"João da Silva\nMaria Souza\nPedro Lima\n..."}
                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
              />
              {nomes && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {nomes.split('\n').filter(n => n.trim()).length} lead(s) detectado(s)
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} className="btn btn-primary" disabled={!form.nome}>Criar Lista</button>
            </div>
        </Modal>
      )}
    </div>
  )
}
