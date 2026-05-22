import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur } from '../lib/utils'
import { toast } from 'sonner'
import { Send, Image, X, Reply, Copy, BarChart2, Plus, Settings, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'

// ── helpers ────────────────────────────────────────────────────
function Avatar({ nome, avatarUrl, size = 32 }) {
  const s = {
    width: size, height: size, borderRadius: '50%',
    flexShrink: 0, overflow: 'hidden',
    border: '2px solid var(--border)',
  }
  if (avatarUrl) return <img src={avatarUrl} alt="" style={{ ...s, objectFit: 'cover' }} />
  const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899']
  const color = colors[(nome?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ ...s, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .4), fontWeight: 700, color: '#fff', border: 'none' }}>
      {(nome || '?')[0].toUpperCase()}
    </div>
  )
}

const SIM_STATUS = {
  pending:     { label: 'Pendente',   color: '#f59e0b' },
  in_progress: { label: 'Em Análise', color: '#3b82f6' },
  done:        { label: 'Concluída',  color: '#10b981' },
  rejected:    { label: 'Recusada',   color: '#ef4444' },
}

const ROOM_COLORS = {
  indigo: '#6366f1', purple: '#a855f7', pink: '#ec4899', red: '#ef4444',
  orange: '#f97316', amber: '#f59e0b', green: '#22c55e', teal: '#14b8a6',
  cyan: '#06b6d4', blue: '#3b82f6', sky: '#0ea5e9',
}

const SIM_NEXT = { pending: 'in_progress', in_progress: 'done', done: 'rejected', rejected: 'pending' }

// ── SimulationCard ─────────────────────────────────────────────
function SimulationCard({ msg, isMe, isAdmin, onStatusChange, onRespond }) {
  const sim = msg.simulacao || {}
  const st = SIM_STATUS[msg.simulacao_status || 'pending']
  const bubbleBg = isMe
    ? 'linear-gradient(135deg, rgba(201,162,42,.15) 0%, rgba(232,188,56,.1) 100%)'
    : 'var(--card)'
  const borderColor = isMe ? 'rgba(201,162,42,.35)' : 'var(--border)'

  return (
    <div style={{
      background: bubbleBg, border: `1.5px solid ${borderColor}`,
      borderRadius: 14, padding: '12px 14px', minWidth: 220, maxWidth: 320,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(201,162,42,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart2 size={14} color="var(--accent)" />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Simulação</span>
        <button
          style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: st.color + '22', color: st.color, border: `1px solid ${st.color}44`, cursor: isAdmin ? 'pointer' : 'default' }}
          onClick={() => isAdmin && onStatusChange(msg.id, msg.simulacao_status)}
          title={isAdmin ? 'Clique para avançar status' : ''}
        >
          {st.label}
        </button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
        {sim.client_name && <div style={{ fontWeight: 600, marginBottom: 4 }}>{sim.client_name}</div>}
        {sim.cpf      && <div style={{ color: 'var(--muted)', fontSize: 12 }}>CPF: {sim.cpf}</div>}
        {sim.phone    && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Tel: {sim.phone}</div>}
        {sim.product  && <div style={{ marginTop: 6, fontSize: 12 }}>Produto: <strong>{sim.product}</strong></div>}
        {sim.value    && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>{fmtCur(sim.value)}</div>}
        {sim.notes    && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 6 }}>{sim.notes}</div>}
      </div>
      {msg.simulacao_resposta && (
        <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--success)11', border: '1px solid var(--success)33', borderRadius: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 2, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Resposta</div>
          {msg.simulacao_resposta}
        </div>
      )}
      {isAdmin && (
        <button
          onClick={() => onRespond(msg)}
          style={{ marginTop: 10, width: '100%', padding: '6px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity .15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Responder Simulação
        </button>
      )}
    </div>
  )
}

// ── SimRespModal ───────────────────────────────────────────────
function SimRespModal({ msg, onClose, onSave }) {
  const [status, setStatus] = useState(msg.simulacao_status || 'pending')
  const [resposta, setResposta] = useState(msg.simulacao_resposta || '')
  return (
    <Modal onClose={onClose} maxWidth={420}>
        <h2>Responder Simulação</h2>
        <div style={{ padding: '10px 14px', background: 'var(--hover)', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{msg.simulacao?.client_name}</div>
          {msg.simulacao?.product && <div style={{ color: 'var(--muted)' }}>{msg.simulacao.product}</div>}
        </div>
        <div className="modal-row">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="pending">Pendente</option>
            <option value="in_progress">Em Análise</option>
            <option value="done">Concluída</option>
            <option value="rejected">Recusada</option>
          </select>
        </div>
        <div className="modal-row">
          <label>Resposta</label>
          <textarea rows={4} value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Digite a resposta..." />
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={() => onSave(status, resposta)} className="btn btn-primary">Salvar</button>
        </div>
    </Modal>
  )
}

// ── MessageBubble ──────────────────────────────────────────────
function MessageBubble({ msg, isMe, isNew, onReply, isOperacional, isAdmin, profiles, onStatusChange, onDelete, onEdit, onRespond, editingId, editText, onEditChange, onEditSave, onEditCancel, showAvatar, showName }) {
  const prof = profiles[msg.user_id] || {}
  const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const tipo = msg.tipo || 'text'
  const isEditing = editingId === msg.id
  const msgText = msg.message || msg.texto

  function copyText() {
    navigator.clipboard.writeText(msgText || '').then(() => toast.success('Copiado!'))
  }

  // WhatsApp-style bubble colors
  const meBg    = 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)'
  const themBg  = 'var(--card)'
  const meRadius  = '18px 18px 4px 18px'
  const themRadius = '18px 18px 18px 4px'

  return (
    <div
      className={isNew ? (isMe ? 'msg-me' : 'msg-them') : ''}
      style={{
        display: 'flex', gap: 8, marginBottom: showAvatar ? 6 : 2,
        flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-end', paddingLeft: isMe ? 40 : 0, paddingRight: isMe ? 0 : 40,
      }}
    >
      {/* Avatar — only shown for first in group (their side) */}
      {!isMe ? (
        showAvatar
          ? <Avatar nome={msg.user_nome || msg.sender_name} avatarUrl={prof.avatar_url} size={30} />
          : <div style={{ width: 30, flexShrink: 0 }} />
      ) : null}

      <div style={{ maxWidth: '75%', minWidth: 0 }}>
        {/* Name/time row (only for first in group) */}
        {showName && !isMe && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 3, paddingLeft: 2 }}>
            {msg.user_nome || msg.sender_name}
          </div>
        )}

        {tipo === 'simulation' ? (
          <SimulationCard msg={msg} isMe={isMe} isAdmin={isAdmin} onStatusChange={onStatusChange} onRespond={onRespond} />
        ) : (
          <div style={{
            background: isMe ? meBg : themBg,
            border: isMe ? 'none' : '1px solid var(--border)',
            borderRadius: isMe ? meRadius : themRadius,
            padding: '8px 13px',
            color: isMe ? '#fff' : 'var(--text)',
            boxShadow: isMe ? '0 2px 12px rgba(201,162,42,.25)' : '0 1px 4px rgba(0,0,0,.12)',
            position: 'relative',
          }}>
            {/* Reply preview */}
            {msg.reply_to_id && (
              <div style={{
                background: isMe ? 'rgba(0,0,0,.2)' : 'var(--hover)',
                borderRadius: 8, padding: '5px 8px', marginBottom: 6,
                borderLeft: `3px solid ${isMe ? 'rgba(255,255,255,.5)' : 'var(--accent)'}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: .9, marginBottom: 1 }}>
                  {msg.reply_to_nome || msg.reply_to_name}
                </div>
                <div style={{ fontSize: 12, opacity: .7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                  {msg.reply_to_texto || msg.reply_to_message}
                </div>
              </div>
            )}

            {/* Image */}
            {msg.image_url && (
              <img src={msg.image_url} alt="" onClick={() => window.open(msg.image_url, '_blank')}
                style={{ maxWidth: '100%', borderRadius: 10, marginBottom: msgText ? 6 : 0, display: 'block', cursor: 'pointer' }} />
            )}

            {/* Text / edit */}
            {isEditing ? (
              <div>
                <textarea value={editText} onChange={e => onEditChange(e.target.value)} autoFocus rows={2}
                  style={{ width: '100%', fontSize: 13, resize: 'none', background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, padding: '6px 8px', color: 'inherit', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={onEditSave} className="btn btn-sm" style={{ background: 'rgba(255,255,255,.25)', color: 'inherit', fontSize: 11, border: 'none' }}>Salvar</button>
                  <button onClick={onEditCancel} className="btn btn-sm" style={{ background: 'rgba(0,0,0,.2)', color: 'inherit', fontSize: 11, border: 'none' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              msgText && (
                <div style={{ fontSize: 14, wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {msgText}
                </div>
              )
            )}

            {/* Timestamp inside bubble */}
            {!isEditing && (
              <div style={{ fontSize: 10, opacity: .65, marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>
                {time}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isEditing && (
          <div style={{ display: 'flex', gap: 2, marginTop: 2, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
            {[
              { show: true,                        icon: <Reply size={10} />,   label: 'Responder', onClick: () => onReply(msg) },
              { show: !isMe && msgText,             icon: <Copy size={10} />,    label: 'Copiar',    onClick: copyText },
              { show: isMe && tipo === 'text',      icon: <Pencil size={10} />,  label: 'Editar',    onClick: () => onEdit(msg) },
              { show: isMe || isAdmin,              icon: <Trash2 size={10} />,  label: 'Excluir',   onClick: () => onDelete(msg.id), danger: true },
            ].filter(a => a.show).map((a, i) => (
              <button key={i} onClick={a.onClick}
                style={{ background: 'none', border: 'none', color: a.danger ? 'var(--danger)' : 'var(--muted)', cursor: 'pointer', padding: '1px 5px', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, borderRadius: 4, transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SimModal ───────────────────────────────────────────────────
function SimModal({ onClose, onSend }) {
  const [form, setForm] = useState({ client_name: '', cpf: '', phone: '', product: '', value: '', notes: '' })
  return (
    <Modal onClose={onClose}>
        <h2>Enviar Simulação</h2>
        <div className="modal-row"><label>Nome do Cliente *</label><input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="João da Silva" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="modal-row"><label>CPF</label><input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" /></div>
          <div className="modal-row"><label>Telefone</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" /></div>
          <div className="modal-row"><label>Produto</label><input value={form.product} onChange={e => setForm(p => ({ ...p, product: e.target.value }))} placeholder="Crédito Consignado..." /></div>
          <div className="modal-row"><label>Valor (R$)</label><input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} placeholder="0.00" /></div>
        </div>
        <div className="modal-row"><label>Observações</label><textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Detalhes adicionais..." /></div>
        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={() => { if (!form.client_name) return toast.error('Informe o nome'); onSend(form); onClose() }} className="btn btn-primary">Enviar</button>
        </div>
    </Modal>
  )
}

// ── RoomsModal ─────────────────────────────────────────────────
function RoomsModal({ rooms, onClose, onAdd, onDelete }) {
  const [form, setForm] = useState({ nome: '', cor: 'indigo', descricao: '' })
  return (
    <Modal onClose={onClose}>
        <h2>Gerenciar Salas</h2>
        <div className="modal-row"><label>Nome</label><input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Operacional" /></div>
        <div className="modal-row">
          <label>Cor</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(ROOM_COLORS).map(([k, v]) => (
              <button key={k} onClick={() => setForm(p => ({ ...p, cor: k }))}
                style={{ width: 28, height: 28, borderRadius: '50%', background: v, border: `3px solid ${form.cor === k ? 'var(--text)' : 'transparent'}`, cursor: 'pointer', transition: 'border .15s, transform .15s', transform: form.cor === k ? 'scale(1.15)' : 'scale(1)' }} />
            ))}
          </div>
        </div>
        <button onClick={() => { if (form.nome) { onAdd(form); setForm({ nome: '', cor: 'indigo', descricao: '' }) } }} className="btn btn-primary btn-sm" style={{ marginBottom: 16 }}>
          <Plus size={13} /> Criar Sala
        </button>
        {rooms.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {rooms.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--hover)', borderRadius: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: ROOM_COLORS[r.cor] || 'var(--accent)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14 }}>{r.nome}</span>
                <button onClick={() => onDelete(r.id)} className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions"><button onClick={onClose} className="btn btn-secondary">Fechar</button></div>
    </Modal>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function Chat() {
  const { profile, isAdmin, isOperacional } = useAuth()
  const [rooms, setRooms] = useState([])
  const [activeTab, setActiveTab] = useState({ type: 'canal', value: 'Caixa' })
  const [msgs, setMsgs] = useState([])
  const [newMsgIds, setNewMsgIds] = useState(new Set())
  const [profiles, setProfiles] = useState({})
  const [texto, setTexto] = useState('')
  const [replyCtx, setReplyCtx] = useState(null)
  const [pendingImg, setPendingImg] = useState(null)
  const [pendingImgFile, setPendingImgFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [simModal, setSimModal] = useState(false)
  const [roomsModal, setRoomsModal] = useState(false)
  const [editingMsg, setEditingMsg] = useState(null)
  const [editText, setEditText] = useState('')
  const [respModal, setRespModal] = useState(null)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const textRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { loadProfiles(); loadRooms() }, [])

  useEffect(() => {
    loadMsgs()
    const channelName = activeTab.type === 'canal' ? `chat-c-${activeTab.value}` : `chat-s-${activeTab.value}`
    const filter = activeTab.type === 'canal' ? `canal=eq.${activeTab.value}` : `sala_id=eq.${activeTab.value}`

    const ch = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter }, payload => {
        setMsgs(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        setNewMsgIds(prev => { const s = new Set(prev); s.add(payload.new.id); return s })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensagens' }, payload => {
        setMsgs(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [activeTab])

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('id, nome, avatar, avatar_url')
    const map = {};(data || []).forEach(p => { map[p.id] = p }); setProfiles(map)
  }

  async function loadRooms() {
    const { data } = await supabase.from('salas').select('*').order('created_at')
    setRooms(data || [])
  }

  async function loadMsgs() {
    let q = supabase.from('mensagens').select('*').order('created_at', { ascending: true }).limit(100)
    if (activeTab.type === 'canal') q = q.eq('canal', activeTab.value).is('sala_id', null)
    else q = q.eq('sala_id', activeTab.value)
    const { data } = await q
    setMsgs(data || [])
    setNewMsgIds(new Set())
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
  }

  function setReply(msg) {
    setReplyCtx({ id: msg.id, nome: msg.user_nome || msg.sender_name, texto: msg.message || msg.texto || '📷 Foto' })
    textRef.current?.focus()
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setPendingImg(URL.createObjectURL(file)); setPendingImgFile(file); e.target.value = ''
  }

  async function uploadImg(file) {
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${file.name.split('.').pop() || 'jpg'}`
    const { error } = await supabase.storage.from('chat-media').upload(path, file)
    if (error) throw error
    return supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl
  }

  async function send(tipo = 'text', simulacao = null) {
    if (tipo === 'text' && !texto.trim() && !pendingImgFile) return
    setSending(true)
    try {
      let image_url = null
      if (pendingImgFile) image_url = await uploadImg(pendingImgFile).catch(() => null)
      await supabase.from('mensagens').insert({
        canal: activeTab.type === 'canal' ? activeTab.value : 'Caixa',
        sala_id: activeTab.type === 'sala' ? activeTab.value : null,
        user_id: profile.id, user_nome: profile.nome,
        tipo, texto: tipo === 'text' ? (texto.trim() || null) : null,
        image_url, simulacao: simulacao || null,
        simulacao_status: simulacao ? 'pending' : null,
        reply_to_id: replyCtx?.id || null,
        reply_to_nome: replyCtx?.nome || null,
        reply_to_texto: replyCtx?.texto || null,
      })
      setTexto(''); setPendingImg(null); setPendingImgFile(null); setReplyCtx(null)
      if (textRef.current) { textRef.current.style.height = 'auto' }
    } catch { toast.error('Erro ao enviar mensagem') }
    finally { setSending(false) }
  }

  async function handleStatusChange(msgId, currentStatus) {
    const next = SIM_NEXT[currentStatus || 'pending']
    const { error } = await supabase.from('mensagens').update({ simulacao_status: next }).eq('id', msgId)
    if (error) toast.error('Erro ao atualizar status')
  }

  async function saveEdit() {
    if (!editingMsg || !editText.trim()) return
    const { error } = await supabase.from('mensagens').update({ texto: editText.trim() }).eq('id', editingMsg.id)
    if (error) return toast.error('Erro ao editar')
    setMsgs(prev => prev.map(m => m.id === editingMsg.id ? { ...m, texto: editText.trim() } : m))
    setEditingMsg(null); setEditText('')
  }

  async function deleteMsg(id) {
    if (!confirm('Excluir esta mensagem?')) return
    const { error } = await supabase.from('mensagens').delete().eq('id', id)
    if (error) return toast.error('Erro ao excluir')
    setMsgs(prev => prev.filter(m => m.id !== id))
    toast.success('Mensagem excluída')
  }

  async function saveResposta(status, resposta) {
    if (!respModal) return
    const { error } = await supabase.from('mensagens').update({ simulacao_status: status, simulacao_resposta: resposta }).eq('id', respModal.id)
    if (error) return toast.error('Erro ao salvar')
    setMsgs(prev => prev.map(m => m.id === respModal.id ? { ...m, simulacao_status: status, simulacao_resposta: resposta } : m))
    setRespModal(null); toast.success('Resposta salva')
  }

  async function addRoom(form) {
    const { data, error } = await supabase.from('salas').insert(form).select().single()
    if (error) return toast.error('Erro ao criar sala')
    setRooms(prev => [...prev, data]); toast.success('Sala criada')
  }

  async function deleteRoom(id) {
    if (!confirm('Excluir sala e todas as mensagens?')) return
    await supabase.from('salas').delete().eq('id', id)
    setRooms(prev => prev.filter(r => r.id !== id))
    if (activeTab.value === id) setActiveTab({ type: 'canal', value: 'Caixa' })
    toast.success('Sala removida')
  }

  function autoResize(e) {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'
  }

  const tabs = [
    { type: 'canal', value: 'Caixa',     label: 'Caixa',     color: '#3b82f6' },
    { type: 'canal', value: 'Santander', label: 'Santander', color: '#ef4444' },
    ...rooms.map(r => ({ type: 'sala', value: r.id, label: r.nome, color: ROOM_COLORS[r.cor] || 'var(--accent)' })),
  ]
  const isActive = t => t.type === activeTab.type && t.value === activeTab.value

  const activeTabInfo = tabs.find(t => isActive(t)) || tabs[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', minHeight: 500, gap: 0 }}>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, display: 'flex', gap: 4, padding: '4px', background: 'var(--hover)', borderRadius: 14, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button
              key={`${t.type}-${t.value}`}
              onClick={() => setActiveTab({ type: t.type, value: t.value })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: isActive(t) ? 700 : 500,
                background: isActive(t) ? 'var(--card)' : 'transparent',
                color: isActive(t) ? t.color : 'var(--muted)',
                boxShadow: isActive(t) ? 'var(--shadow-sm)' : 'none',
                transition: 'all .18s',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color, flexShrink: 0, opacity: isActive(t) ? 1 : .5 }} />
              {t.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button onClick={() => setRoomsModal(true)} className="btn btn-secondary btn-icon" title="Gerenciar salas" style={{ flexShrink: 0 }}>
            <Settings size={16} />
          </button>
        )}
      </div>

      {/* ── Messages container ── */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '16px 16px 0 0',
        padding: '20px 16px 12px',
        backgroundImage: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,162,42,.03) 0%, transparent 70%)',
      }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>Nenhuma mensagem ainda</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Canal: {activeTabInfo?.label}</div>
          </div>
        )}

        {msgs.map((msg, i) => {
          const prev = msgs[i - 1]
          const isMe = msg.user_id === profile?.id
          const sameUser = prev && prev.user_id === msg.user_id
          const timeDiff = prev ? (new Date(msg.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000 : true
          const showAvatar = !sameUser || timeDiff
          const showName = showAvatar && !isMe

          // Date separator
          const msgDate = new Date(msg.created_at).toLocaleDateString('pt-BR')
          const prevDate = prev ? new Date(prev.created_at).toLocaleDateString('pt-BR') : null
          const showDate = msgDate !== prevDate

          return (
            <div key={msg.id}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--hover)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
                    {msgDate}
                  </span>
                </div>
              )}
              <MessageBubble
                msg={msg} isMe={isMe} isNew={newMsgIds.has(msg.id)}
                showAvatar={showAvatar} showName={showName}
                onReply={setReply} isOperacional={isOperacional} isAdmin={isAdmin}
                profiles={profiles} onStatusChange={handleStatusChange}
                onDelete={deleteMsg} onEdit={m => { setEditingMsg(m); setEditText(m.texto || m.message || '') }}
                onRespond={setRespModal}
                editingId={editingMsg?.id} editText={editText}
                onEditChange={setEditText} onEditSave={saveEdit}
                onEditCancel={() => { setEditingMsg(null); setEditText('') }}
              />
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Reply bar ── */}
      {replyCtx && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--card)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderTop: '1px solid var(--border)', borderBottom: 'none' }}>
          <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--accent)', borderRadius: 2, flexShrink: 0 }} />
          <Reply size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{replyCtx.nome}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyCtx.texto}</div>
          </div>
          <button onClick={() => setReplyCtx(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}><X size={14} /></button>
        </div>
      )}

      {/* ── Image preview ── */}
      {pendingImg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderTop: replyCtx ? 'none' : '1px solid var(--border)', borderBottom: 'none' }}>
          <img src={pendingImg} alt="" style={{ height: 48, borderRadius: 8, objectFit: 'cover' }} />
          <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1 }}>Imagem selecionada</span>
          <button onClick={() => { setPendingImg(null); setPendingImgFile(null) }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}><X size={14} /></button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div ref={inputRef} style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderTop: (replyCtx || pendingImg) ? 'none' : '1px solid var(--border)',
        borderRadius: '0 0 16px 16px',
        alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-icon" title="Imagem" style={{ borderRadius: 10 }}>
            <Image size={17} />
          </button>
          <button onClick={() => setSimModal(true)} className="btn btn-secondary btn-icon" title="Simulação" style={{ borderRadius: 10 }}>
            <BarChart2 size={17} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        <textarea
          ref={textRef}
          value={texto}
          onChange={e => { setTexto(e.target.value); autoResize(e) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Digite uma mensagem..."
          rows={1}
          style={{ flex: 1, resize: 'none', maxHeight: 110, overflowY: 'auto', lineHeight: '1.5', padding: '8px 12px', borderRadius: 12, fontSize: 14 }}
        />
        <button
          onClick={() => send()}
          disabled={sending || (!texto.trim() && !pendingImgFile)}
          style={{
            width: 40, height: 40, borderRadius: 12, border: 'none', flexShrink: 0,
            background: (sending || (!texto.trim() && !pendingImgFile))
              ? 'var(--hover)'
              : 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
            color: (sending || (!texto.trim() && !pendingImgFile)) ? 'var(--muted)' : '#fff',
            cursor: (sending || (!texto.trim() && !pendingImgFile)) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .18s',
            boxShadow: (texto.trim() || pendingImgFile) ? '0 2px 12px rgba(201,162,42,.35)' : 'none',
          }}
        >
          <Send size={17} style={{ marginLeft: 1 }} />
        </button>
      </div>

      {simModal   && <SimModal onClose={() => setSimModal(false)} onSend={d => send('simulation', { ...d, value: parseFloat(d.value) || 0 })} />}
      {roomsModal && isAdmin && <RoomsModal rooms={rooms} onClose={() => setRoomsModal(false)} onAdd={addRoom} onDelete={deleteRoom} />}
      {respModal  && isAdmin && <SimRespModal msg={respModal} onClose={() => setRespModal(null)} onSave={saveResposta} />}
    </div>
  )
}
