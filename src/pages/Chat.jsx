import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur } from '../lib/utils'
import { toast } from 'sonner'
import { Send, Image, X, Reply, Copy, BarChart2, Plus, Settings } from 'lucide-react'

// ── helpers ────────────────────────────────────────────────────
function Avatar({ nome, avatarUrl, size = 30 }) {
  const s = { width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden' }
  if (avatarUrl) return <img src={avatarUrl} alt="" style={{ ...s, objectFit: 'cover' }} />
  return (
    <div style={{ ...s, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .38), fontWeight: 700, color: '#fff' }}>
      {(nome || '?')[0].toUpperCase()}
    </div>
  )
}

const SIM_STATUS = {
  pending:     { label: 'Pendente',    bg: 'var(--warn)',    text: '#fff' },
  in_progress: { label: 'Em Análise', bg: 'var(--info)',    text: '#fff' },
  done:        { label: 'Concluída',  bg: 'var(--success)', text: '#fff' },
  rejected:    { label: 'Recusada',   bg: 'var(--danger)',  text: '#fff' },
}

const ROOM_COLORS = {
  indigo: '#6366f1', purple: '#a855f7', pink: '#ec4899', red: '#ef4444',
  orange: '#f97316', amber: '#f59e0b', green: '#22c55e', teal: '#14b8a6',
  cyan: '#06b6d4', blue: '#3b82f6', sky: '#0ea5e9',
}

// ── SimulationCard ─────────────────────────────────────────────
function SimulationCard({ msg, isMe, isAdmin, onStatusChange }) {
  const sim = msg.simulacao || {}
  const st = SIM_STATUS[msg.simulacao_status || 'pending']

  return (
    <div style={{
      background: isMe ? 'var(--accent)' : 'var(--card)',
      border: `1px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 10, padding: '10px 14px',
      color: isMe ? '#fff' : 'var(--text)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <BarChart2 size={15} />
        <span style={{ fontWeight: 700, fontSize: 13 }}>Simulação</span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: st.bg, color: st.text, cursor: isAdmin ? 'pointer' : 'default',
        }}
          onClick={() => isAdmin && onStatusChange(msg.id, msg.simulacao_status)}
        >
          {st.label}
        </span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, opacity: .9 }}>
        {sim.client_name && <div><strong>Cliente:</strong> {sim.client_name}</div>}
        {sim.cpf        && <div><strong>CPF:</strong> {sim.cpf}</div>}
        {sim.phone      && <div><strong>Tel:</strong> {sim.phone}</div>}
        {sim.product    && <div><strong>Produto:</strong> {sim.product}</div>}
        {sim.value      && <div><strong>Valor:</strong> {fmtCur(sim.value)}</div>}
        {sim.notes      && <div style={{ marginTop: 4, fontStyle: 'italic', opacity: .8 }}>{sim.notes}</div>}
      </div>
      {msg.simulacao_resposta && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(0,0,0,.12)', borderRadius: 6, fontSize: 12 }}>
          <strong>Resposta:</strong> {msg.simulacao_resposta}
        </div>
      )}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────
function MessageBubble({ msg, isMe, onReply, isOperacional, isAdmin, profiles, onStatusChange }) {
  const prof = profiles[msg.user_id] || {}
  const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const tipo = msg.tipo || 'text'

  function copyText() {
    if (!msg.message && !msg.texto) return
    navigator.clipboard.writeText(msg.message || msg.texto || '').then(() => toast.success('Copiado!'))
  }

  const msgText = msg.message || msg.texto

  return (
    <div style={{
      display: 'flex', gap: 8, marginBottom: 10,
      flexDirection: isMe ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      <Avatar nome={msg.user_nome || msg.sender_name} avatarUrl={prof.avatar_url} size={28} />

      <div style={{ maxWidth: '74%', minWidth: 0 }}>
        <div style={{
          fontSize: 11, color: 'var(--muted)', marginBottom: 3,
          display: 'flex', gap: 6,
          justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600 }}>{isMe ? 'Você' : (msg.user_nome || msg.sender_name)}</span>
          <span>{time}</span>
        </div>

        {tipo === 'simulation' ? (
          <SimulationCard msg={msg} isMe={isMe} isAdmin={isAdmin} onStatusChange={onStatusChange} />
        ) : (
          <div style={{
            background: isMe ? 'var(--accent)' : 'var(--card)',
            border: `1px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
            padding: '8px 12px', color: isMe ? '#fff' : 'var(--text)',
          }}>
            {msg.reply_to_id && (
              <div style={{
                background: 'rgba(0,0,0,.15)', borderRadius: 6,
                padding: '5px 8px', marginBottom: 6,
                borderLeft: '3px solid rgba(255,255,255,.4)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: .8 }}>{msg.reply_to_nome || msg.reply_to_name}</div>
                <div style={{ fontSize: 12, opacity: .7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                  {msg.reply_to_texto || msg.reply_to_message}
                </div>
              </div>
            )}
            {msg.image_url && (
              <img src={msg.image_url} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msgText ? 6 : 0, display: 'block', cursor: 'pointer' }}
                onClick={() => window.open(msg.image_url, '_blank')} />
            )}
            {msgText && <div style={{ fontSize: 14, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msgText}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginTop: 3, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
          <button onClick={() => onReply(msg)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
            <Reply size={11} /> Responder
          </button>
          {(isOperacional || isMe) && msgText && (
            <button onClick={copyText} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
              <Copy size={11} /> Copiar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Simulation form modal ──────────────────────────────────────
function SimModal({ onClose, onSend }) {
  const [form, setForm] = useState({ client_name: '', cpf: '', phone: '', product: '', value: '', notes: '' })
  function submit() {
    if (!form.client_name) return toast.error('Informe o nome do cliente')
    onSend(form)
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Enviar Simulação</h2>
        <div className="modal-row"><label>Nome do Cliente *</label><input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="João da Silva" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="modal-row"><label>CPF</label><input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" /></div>
          <div className="modal-row"><label>Telefone</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" /></div>
          <div className="modal-row"><label>Produto</label><input value={form.product} onChange={e => setForm(p => ({ ...p, product: e.target.value }))} placeholder="Crédito Consignado..." /></div>
          <div className="modal-row"><label>Valor (R$)</label><input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} placeholder="0.00" min="0" /></div>
        </div>
        <div className="modal-row"><label>Observações</label><textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Detalhes adicionais..." /></div>
        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={submit} className="btn btn-primary">Enviar</button>
        </div>
      </div>
    </div>
  )
}

// ── Room management modal (admin) ──────────────────────────────
function RoomsModal({ rooms, onClose, onAdd, onDelete }) {
  const [form, setForm] = useState({ nome: '', cor: 'indigo', descricao: '' })
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Gerenciar Salas</h2>
        <div className="modal-row"><label>Nome da Sala</label><input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Operacional" /></div>
        <div className="modal-row">
          <label>Cor</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(ROOM_COLORS).map(([k, v]) => (
              <div key={k} onClick={() => setForm(p => ({ ...p, cor: k }))} style={{ width: 24, height: 24, borderRadius: '50%', background: v, cursor: 'pointer', border: `3px solid ${form.cor === k ? 'var(--text)' : 'transparent'}` }} />
            ))}
          </div>
        </div>
        <button onClick={() => { if (form.nome) { onAdd(form); setForm({ nome: '', cor: 'indigo', descricao: '' }) } }} className="btn btn-primary btn-sm" style={{ marginBottom: 16 }}>
          <Plus size={13} /> Criar Sala
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rooms.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--hover)', borderRadius: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: ROOM_COLORS[r.cor] || 'var(--accent)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14 }}>{r.nome}</span>
              <button onClick={() => onDelete(r.id)} className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }}><X size={13} /></button>
            </div>
          ))}
        </div>
        <div className="modal-actions"><button onClick={onClose} className="btn btn-secondary">Fechar</button></div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
const SIM_NEXT = { pending: 'in_progress', in_progress: 'done', done: 'rejected', rejected: 'pending' }

export default function Chat() {
  const { profile, isAdmin, isOperacional } = useAuth()
  const [rooms, setRooms] = useState([])
  const [activeTab, setActiveTab] = useState({ type: 'canal', value: 'Caixa' })
  const [msgs, setMsgs] = useState([])
  const [profiles, setProfiles] = useState({})
  const [texto, setTexto] = useState('')
  const [replyCtx, setReplyCtx] = useState(null)
  const [pendingImg, setPendingImg] = useState(null)
  const [pendingImgFile, setPendingImgFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [simModal, setSimModal] = useState(false)
  const [roomsModal, setRoomsModal] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const textRef = useRef(null)

  useEffect(() => { loadProfiles(); loadRooms() }, [])

  useEffect(() => {
    loadMsgs()
    const channelName = activeTab.type === 'canal'
      ? `chat-canal-${activeTab.value}`
      : `chat-sala-${activeTab.value}`

    const filter = activeTab.type === 'canal'
      ? `canal=eq.${activeTab.value}`
      : `sala_id=eq.${activeTab.value}`

    const ch = supabase.channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensagens', filter,
      }, payload => {
        setMsgs(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'mensagens',
      }, payload => {
        setMsgs(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [activeTab])

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('id, nome, avatar, avatar_url')
    const map = {}
    ;(data || []).forEach(p => { map[p.id] = p })
    setProfiles(map)
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
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
  }

  function setReply(msg) {
    setReplyCtx({
      id: msg.id,
      nome: msg.user_nome || msg.sender_name,
      texto: msg.message || msg.texto || '📷 Foto',
    })
    textRef.current?.focus()
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setPendingImg(URL.createObjectURL(file))
    setPendingImgFile(file)
    e.target.value = ''
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

      const payload = {
        canal: activeTab.type === 'canal' ? activeTab.value : 'Caixa',
        sala_id: activeTab.type === 'sala' ? activeTab.value : null,
        user_id: profile.id,
        user_nome: profile.nome,
        tipo,
        texto: tipo === 'text' ? (texto.trim() || null) : null,
        image_url,
        simulacao: simulacao || null,
        simulacao_status: simulacao ? 'pending' : null,
        reply_to_id: replyCtx?.id || null,
        reply_to_nome: replyCtx?.nome || null,
        reply_to_texto: replyCtx?.texto || null,
      }

      const { error } = await supabase.from('mensagens').insert(payload)
      if (error) throw error

      setTexto('')
      setPendingImg(null)
      setPendingImgFile(null)
      setReplyCtx(null)
    } catch {
      toast.error('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  async function handleSimSend(simData) {
    await send('simulation', { ...simData, value: parseFloat(simData.value) || 0 })
  }

  async function handleStatusChange(msgId, currentStatus) {
    const next = SIM_NEXT[currentStatus || 'pending']
    const { error } = await supabase.from('mensagens').update({ simulacao_status: next }).eq('id', msgId)
    if (error) toast.error('Erro ao atualizar status')
  }

  async function addRoom(form) {
    const { data, error } = await supabase.from('salas').insert(form).select().single()
    if (error) return toast.error('Erro ao criar sala')
    setRooms(prev => [...prev, data])
    toast.success('Sala criada')
  }

  async function deleteRoom(id) {
    if (!confirm('Excluir sala e todas as mensagens?')) return
    await supabase.from('salas').delete().eq('id', id)
    setRooms(prev => prev.filter(r => r.id !== id))
    if (activeTab.value === id) setActiveTab({ type: 'canal', value: 'Caixa' })
    toast.success('Sala removida')
  }

  const tabs = [
    { type: 'canal', value: 'Caixa',     label: 'Caixa',     color: 'var(--info)' },
    { type: 'canal', value: 'Santander', label: 'Santander', color: 'var(--danger)' },
    ...rooms.map(r => ({ type: 'sala', value: r.id, label: r.nome, color: ROOM_COLORS[r.cor] || 'var(--accent)' })),
  ]

  const isActive = (t) => t.type === activeTab.type && t.value === activeTab.value

  return (
    <div>
      {/* Tabs + room manage */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {tabs.map(t => (
          <button
            key={`${t.type}-${t.value}`}
            onClick={() => setActiveTab({ type: t.type, value: t.value })}
            className="btn btn-sm"
            style={{
              background: isActive(t) ? t.color : 'var(--hover)',
              color: isActive(t) ? '#fff' : 'var(--text)',
              border: `1px solid ${isActive(t) ? t.color : 'var(--border)'}`,
            }}
          >{t.label}</button>
        ))}
        {isAdmin && (
          <button onClick={() => setRoomsModal(true)} className="btn btn-secondary btn-sm btn-icon" title="Gerenciar salas">
            <Settings size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{
        height: 460, overflowY: 'auto',
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '12px 12px 0 0', padding: '16px',
      }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', paddingTop: 60 }}>
            Nenhuma mensagem ainda. Seja o primeiro!
          </div>
        )}
        {msgs.map(msg => (
          <MessageBubble
            key={msg.id} msg={msg}
            isMe={msg.user_id === profile?.id}
            onReply={setReply}
            isOperacional={isOperacional}
            isAdmin={isAdmin}
            profiles={profiles}
            onStatusChange={handleStatusChange}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      {replyCtx && (
        <div style={{ background: 'var(--hover)', borderLeft: '3px solid var(--accent)', borderRight: '1px solid var(--border)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Reply size={13} color="var(--accent)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{replyCtx.nome}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyCtx.texto}</div>
          </div>
          <button onClick={() => setReplyCtx(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={13} /></button>
        </div>
      )}

      {/* Image preview */}
      {pendingImg && (
        <div style={{ background: 'var(--hover)', borderRight: '1px solid var(--border)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={pendingImg} alt="" style={{ height: 44, borderRadius: 5, objectFit: 'cover' }} />
          <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1 }}>Imagem selecionada</span>
          <button onClick={() => { setPendingImg(null); setPendingImgFile(null) }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={13} /></button>
        </div>
      )}

      {/* Input */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 12px',
        background: 'var(--card)', border: '1px solid var(--border)',
        borderTop: 'none', borderRadius: '0 0 12px 12px', alignItems: 'flex-end',
      }}>
        <button onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-icon" title="Imagem" style={{ flexShrink: 0 }}>
          <Image size={16} />
        </button>
        <button onClick={() => setSimModal(true)} className="btn btn-secondary btn-icon" title="Enviar Simulação" style={{ flexShrink: 0 }}>
          <BarChart2 size={16} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        <textarea
          ref={textRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Digite uma mensagem... (Enter para enviar)"
          rows={1}
          style={{ flex: 1, resize: 'none', maxHeight: 100, overflowY: 'auto', lineHeight: '1.5', padding: '7px 12px' }}
        />
        <button onClick={() => send()} disabled={sending || (!texto.trim() && !pendingImgFile)} className="btn btn-primary btn-icon" style={{ flexShrink: 0 }}>
          <Send size={16} />
        </button>
      </div>

      {simModal  && <SimModal  onClose={() => setSimModal(false)}  onSend={handleSimSend} />}
      {roomsModal && isAdmin && <RoomsModal rooms={rooms} onClose={() => setRoomsModal(false)} onAdd={addRoom} onDelete={deleteRoom} />}
    </div>
  )
}
