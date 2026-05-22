import { useState, useEffect, useRef } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur, fmtDate } from '../lib/utils'
import { toast } from 'sonner'
import { X, Bell, Paperclip, Upload, Trash2, ExternalLink } from 'lucide-react'
import Modal from '../components/Modal'

const COLS = [
  { id: 'negociando',  label: 'Negociando',         color: '#3b82f6' },
  { id: 'documentos',  label: 'Pegando Documentos', color: '#f59e0b' },
  { id: 'fechado',     label: 'Cliente Fechado',     color: '#8b5cf6' },
  { id: 'pago',        label: 'Cliente Pago',        color: '#10b981' },
  { id: 'ps_pago',     label: 'Pagou PS',            color: '#06b6d4' },
  { id: 'desistiu',    label: 'Desistiu',            color: '#ef4444' },
]

const DETAIL_TABS = ['Info', 'Notas', 'Retorno', 'Documentos']

function DetailModal({ client, onClose, onUpdate, isAdmin, profileId }) {
  const [tab, setTab] = useState('Info')
  const [form, setForm] = useState({
    notas: client.notas || '',
    follow_up: client.follow_up || false,
    data_retorno: client.data_retorno || '',
    motivo_retorno: client.motivo_retorno || '',
    telefone: client.telefone || '',
    email: client.email || '',
    produto: client.produto || '',
  })
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (tab === 'Documentos') loadDocs()
  }, [tab])

  async function loadDocs() {
    const { data } = await supabase
      .from('crm_documentos')
      .select('*')
      .eq('cliente_id', client.id)
      .order('created_at', { ascending: false })
    setDocs(data || [])
  }

  async function saveField(field, value) {
    const { error } = await supabase.from('clientes').update({ [field]: value }).eq('id', client.id)
    if (error) { toast.error('Erro ao salvar'); return }
    onUpdate(client.id, { [field]: value })
  }

  async function saveForm() {
    const { error } = await supabase.from('clientes').update(form).eq('id', client.id)
    if (error) return toast.error('Erro ao salvar')
    onUpdate(client.id, form)
    toast.success('Salvo')
  }

  async function uploadDoc(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `docs/${client.id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path)
      const { data, error } = await supabase.from('crm_documentos').insert({
        cliente_id: client.id,
        arquivo_url: publicUrl,
        arquivo_nome: file.name,
        uploader_id: profileId,
      }).select().single()
      if (error) throw error
      setDocs(prev => [data, ...prev])
      toast.success('Documento enviado')
    } catch {
      toast.error('Erro ao enviar documento')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function deleteDoc(id, url) {
    if (!confirm('Excluir documento?')) return
    await supabase.from('crm_documentos').delete().eq('id', id)
    setDocs(prev => prev.filter(d => d.id !== id))
    toast.success('Documento removido')
  }

  const canEdit = isAdmin || client.consultor_id === profileId

  return (
    <Modal onClose={onClose} maxWidth={580}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{client.nome}</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{client.banco} · {fmtCur(client.valor)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {DETAIL_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 14px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: tab === t ? 700 : 400,
                color: tab === t ? 'var(--accent)' : 'var(--muted)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >{t}</button>
          ))}
        </div>

        {/* Info */}
        {tab === 'Info' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="modal-row">
                <label>Telefone</label>
                <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" disabled={!canEdit} />
              </div>
              <div className="modal-row">
                <label>Email</label>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" disabled={!canEdit} />
              </div>
              <div className="modal-row" style={{ gridColumn: '1 / -1' }}>
                <label>Produto / Serviço</label>
                <input value={form.produto} onChange={e => setForm(p => ({ ...p, produto: e.target.value }))} placeholder="Ex: Crédito Consignado" disabled={!canEdit} />
              </div>
            </div>
            {canEdit && (
              <div className="modal-actions" style={{ marginTop: 12 }}>
                <button onClick={saveForm} className="btn btn-primary btn-sm">Salvar</button>
              </div>
            )}
          </div>
        )}

        {/* Notas */}
        {tab === 'Notas' && (
          <div>
            <textarea
              rows={8}
              value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              placeholder="Anotações sobre este cliente..."
              style={{ resize: 'vertical' }}
              disabled={!canEdit}
            />
            {canEdit && (
              <div className="modal-actions" style={{ marginTop: 8 }}>
                <button onClick={() => saveField('notas', form.notas)} className="btn btn-primary btn-sm">Salvar Notas</button>
              </div>
            )}
          </div>
        )}

        {/* Retorno */}
        {tab === 'Retorno' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: 'var(--hover)', borderRadius: 10, marginBottom: 14,
              border: `2px solid ${form.follow_up ? 'var(--warn)' : 'var(--border)'}`,
            }}>
              <Bell size={20} color={form.follow_up ? 'var(--warn)' : 'var(--muted)'} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Acompanhar cliente</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ativar para receber lembrete de retorno</div>
              </div>
              <button
                onClick={() => {
                  if (!canEdit) return
                  const val = !form.follow_up
                  setForm(p => ({ ...p, follow_up: val }))
                  saveField('follow_up', val)
                }}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: canEdit ? 'pointer' : 'default',
                  background: form.follow_up ? 'var(--warn)' : 'var(--border)',
                  position: 'relative', transition: 'background .2s',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left .2s',
                  left: form.follow_up ? 23 : 3,
                }} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="modal-row">
                <label>Data de Retorno</label>
                <input type="date" value={form.data_retorno} onChange={e => setForm(p => ({ ...p, data_retorno: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="modal-row" style={{ gridColumn: '1 / -1' }}>
                <label>Motivo do Retorno</label>
                <textarea rows={3} value={form.motivo_retorno} onChange={e => setForm(p => ({ ...p, motivo_retorno: e.target.value }))} placeholder="Por que retornar?" disabled={!canEdit} />
              </div>
            </div>
            {canEdit && (
              <div className="modal-actions" style={{ marginTop: 4 }}>
                <button onClick={() => {
                  saveField('data_retorno', form.data_retorno || null)
                  saveField('motivo_retorno', form.motivo_retorno)
                }} className="btn btn-primary btn-sm">Salvar Retorno</button>
              </div>
            )}
          </div>
        )}

        {/* Documentos */}
        {tab === 'Documentos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{docs.length} documento(s)</span>
              {canEdit && (
                <>
                  <button onClick={() => fileRef.current?.click()} className="btn btn-primary btn-sm" disabled={uploading}>
                    <Upload size={13} /> {uploading ? 'Enviando...' : 'Enviar arquivo'}
                  </button>
                  <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={uploadDoc} />
                </>
              )}
            </div>
            {docs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: 14 }}>
                Nenhum documento enviado
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docs.map(d => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: 'var(--hover)',
                    borderRadius: 8, border: '1px solid var(--border)',
                  }}>
                    <Paperclip size={15} color="var(--muted)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.arquivo_nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(d.created_at?.slice(0,10))}</div>
                    </div>
                    <a href={d.arquivo_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm btn-icon">
                      <ExternalLink size={13} />
                    </a>
                    {canEdit && (
                      <button onClick={() => deleteDoc(d.id, d.arquivo_url)} className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </Modal>
  )
}

export default function CRM() {
  const { profile, isAdmin } = useAuth()
  const [clients, setClients] = useState([])
  const [tab, setTab] = useState('Caixa')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, valor, ps, banco, crm_status, consultor_id, telefone, email, produto, notas, follow_up, data_retorno, motivo_retorno')
      .order('nome')
    const mine = isAdmin ? (data || []) : (data || []).filter(c => c.consultor_id === profile?.id)
    setClients(mine)
    setLoading(false)
  }

  async function onDragEnd(result) {
    const { draggableId, destination, source } = result
    if (!destination || destination.droppableId === source.droppableId) return

    const newStatus = destination.droppableId
    setClients(prev => prev.map(c => c.id === draggableId ? { ...c, crm_status: newStatus } : c))

    const { error } = await supabase.from('clientes').update({ crm_status: newStatus }).eq('id', draggableId)
    if (error) { toast.error('Erro ao mover card'); load() }
  }

  function handleUpdate(id, patch) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...patch }))
  }

  const filtered = clients.filter(c => c.banco === tab)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">CRM</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['Caixa', 'Santander'].map(b => (
            <button
              key={b}
              onClick={() => setTab(b)}
              className="btn btn-sm"
              style={{
                background: tab === b ? 'var(--accent)' : 'var(--hover)',
                color: tab === b ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >{b}</button>
          ))}
          {clients.filter(c => c.follow_up && c.data_retorno && new Date(c.data_retorno) <= new Date()).length > 0 && (
            <span style={{ background: 'var(--warn)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
              🔔 {clients.filter(c => c.follow_up && c.data_retorno && new Date(c.data_retorno) <= new Date()).length} retorno(s)
            </span>
          )}
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
            {COLS.map(col => {
              const cards = filtered.filter(c => (c.crm_status || 'negociando') === col.id)
              return (
                <div
                  key={col.id}
                  style={{
                    minWidth: 210, width: 210, flexShrink: 0,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 12, overflow: 'hidden',
                  }}
                >
                  <div style={{
                    padding: '10px 12px', borderBottom: '2px solid ' + col.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{col.label}</span>
                    <span style={{ background: col.color + '33', color: col.color, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
                      {cards.length}
                    </span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                          padding: 8, minHeight: 80,
                          background: snapshot.isDraggingOver ? col.color + '11' : 'transparent',
                          transition: 'background .15s',
                        }}
                      >
                        {cards.map((c, idx) => (
                          <Draggable key={c.id} draggableId={c.id} index={idx}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                onClick={() => setSelected(c)}
                                style={{
                                  background: 'var(--hover)', border: '1px solid var(--border)',
                                  borderRadius: 8, padding: '10px 10px',
                                  marginBottom: 6, cursor: 'pointer',
                                  boxShadow: snap.isDragging ? '0 4px 12px rgba(0,0,0,.3)' : 'none',
                                  ...prov.draggableProps.style,
                                }}
                              >
                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{c.nome}</div>
                                {c.produto && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{c.produto}</div>}
                                <div style={{ fontSize: 12, color: 'var(--accent)' }}>{fmtCur(c.valor)}</div>
                                <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                                  {c.telefone && <span style={{ fontSize: 10, color: 'var(--muted)' }}>📞 {c.telefone}</span>}
                                  {c.follow_up && <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 700 }}>🔔</span>}
                                  {c.data_retorno && new Date(c.data_retorno) <= new Date() && (
                                    <span style={{ fontSize: 10, background: 'var(--warn)', color: '#fff', borderRadius: 4, padding: '0 4px' }}>
                                      Retorno!
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {cards.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, padding: '10px 0' }}>
                            Arraste aqui
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      )}

      {selected && (
        <DetailModal
          client={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          isAdmin={isAdmin}
          profileId={profile?.id}
        />
      )}
    </div>
  )
}
