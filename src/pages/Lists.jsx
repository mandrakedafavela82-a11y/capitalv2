import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtDate, todayStr } from '../lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronDown, ChevronUp, BarChart2, Send, Upload } from 'lucide-react'

const EMPTY_LIST = { nome: '', banco: 'Caixa', data: todayStr(), descricao: '' }

const LEAD_STATUS = {
  contacted:     { label: 'Contatado',    bg: '#3b82f633', color: '#3b82f6' },
  added_to_crm:  { label: 'No CRM',       bg: '#10b98133', color: '#10b981' },
  no_answer:     { label: 'Sem Resposta', bg: '#f59e0b33', color: '#f59e0b' },
  not_interested:{ label: 'Sem Interesse',bg: '#ef444433', color: '#ef4444' },
}

const STATUS_CYCLE = ['contacted', 'no_answer', 'not_interested', 'added_to_crm']

function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const norm = h => h.trim().replace(/"/g, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
  const headers = lines[0].split(/[,;|\t]/).map(norm)
  return lines.slice(1).map(line => {
    if (!line.trim()) return null
    const cols = line.split(/[,;|\t]/).map(c => c.trim().replace(/"/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] || '' })
    const nome = obj['nome'] || obj['name'] || obj['cliente'] || obj['nome completo'] || ''
    const cpf = obj['cpf'] || obj['cpf_cnpj'] || obj['documento'] || ''
    const telefone = obj['telefone'] || obj['phone'] || obj['celular'] || obj['fone'] || obj['cel'] || ''
    return { nome: nome.trim(), cpf: cpf.trim(), telefone: telefone.trim() }
  }).filter(r => r && r.nome)
}

export default function Lists() {
  const { profile, isAdmin } = useAuth()
  const [tab, setTab] = useState('listas')
  const [lists, setLists] = useState([])
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_LIST)
  const [nomes, setNomes] = useState('')
  const [csvMode, setCsvMode] = useState(false)
  const [parsedLeads, setParsedLeads] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [leadData, setLeadData] = useState({})
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reportData, setReportData] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [simChat, setSimChat] = useState(null)
  const [simCanal, setSimCanal] = useState('Caixa')
  const [simProduct, setSimProduct] = useState('')
  const [simValue, setSimValue] = useState('')
  const [simNotes, setSimNotes] = useState('')
  const [simSending, setSimSending] = useState(false)
  const [formVendedorId, setFormVendedorId] = useState('')

  useEffect(() => { load() }, [profile])

  useEffect(() => {
    if (tab === 'relatorio' && users.length > 0) loadReport()
  }, [tab, users])

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

  async function loadReport() {
    setReportLoading(true)
    const { data: lc } = await supabase.from('lead_contatos').select('consultor_id, status')
    const map = {}
    for (const r of lc || []) {
      if (!r.consultor_id) continue
      if (!map[r.consultor_id]) map[r.consultor_id] = { contacted: 0, no_answer: 0, not_interested: 0, added_to_crm: 0, total: 0 }
      map[r.consultor_id][r.status] = (map[r.consultor_id][r.status] || 0) + 1
      map[r.consultor_id].total++
    }
    const result = Object.entries(map).map(([id, stats]) => ({
      nome: users.find(u => u.id === id)?.nome || '-',
      ...stats,
    })).sort((a, b) => (b.added_to_crm || 0) - (a.added_to_crm || 0))
    setReportData(result)
    setReportLoading(false)
  }

  function handleCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setParsedLeads(parseCSV(ev.target.result))
    reader.readAsText(file, 'UTF-8')
  }

  async function save() {
    const vendId = isAdmin ? (formVendedorId || profile?.id) : profile?.id
    const payload = { ...form, consultor_id: vendId }
    const { data: lista, error } = await supabase.from('listas').insert(payload).select().single()
    if (error) return toast.error('Erro ao criar lista')

    let leadRows = []
    if (csvMode) {
      leadRows = parsedLeads.map(l => ({
        lista_id: lista.id, nome: l.nome,
        cpf: l.cpf || null, telefone: l.telefone || null,
        consultor_id: vendId, status: 'contacted',
      }))
    } else {
      leadRows = nomes.split('\n').map(n => n.trim()).filter(Boolean).map(nome => ({
        lista_id: lista.id, nome, consultor_id: vendId, status: 'contacted',
      }))
    }

    if (leadRows.length > 0) {
      const { error: le } = await supabase.from('lead_contatos').insert(leadRows)
      if (le) toast.error('Lista criada mas erro ao importar leads')
      else toast.success(`Lista criada com ${leadRows.length} lead(s)`)
    } else {
      toast.success('Lista criada')
    }

    setLists(prev => [lista, ...prev])
    setModal(false); setForm(EMPTY_LIST); setNomes(''); setParsedLeads([]); setCsvMode(false)
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
      const { data } = await supabase.from('lead_contatos').select('*').eq('lista_id', id).order('nome')
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
    const lista = lists.find(l => l.id === lead.lista_id)
    const { data: client, error } = await supabase.from('clientes').insert({
      nome: lead.nome, cpf: lead.cpf || '-', telefone: lead.telefone,
      banco: lista?.banco || 'Caixa', lista_id: lead.lista_id,
      consultor_id: profile?.id, data: todayStr(),
    }).select().single()
    if (error) return toast.error('Erro ao enviar para CRM')
    await supabase.from('lead_contatos').update({ status: 'added_to_crm', crm_id: client.id }).eq('id', lead.id)
    setLeadData(prev => ({
      ...prev,
      [lead.lista_id]: (prev[lead.lista_id] || []).map(l => l.id === lead.id ? { ...l, status: 'added_to_crm', crm_id: client.id } : l),
    }))
    toast.success(`${lead.nome} enviado para Clientes/CRM`)
  }

  async function sendSimChat() {
    if (!simChat || simSending) return
    setSimSending(true)
    try {
      await supabase.from('mensagens').insert({
        canal: simCanal, sala_id: null,
        user_id: profile.id, user_nome: profile.nome,
        tipo: 'simulation',
        texto: `📋 Simulação para ${simChat.lead.nome}`,
        simulacao: {
          client_name: simChat.lead.nome,
          cpf: simChat.lead.cpf || null,
          phone: simChat.lead.telefone || null,
          product: simProduct || null,
          value: simValue ? parseFloat(simValue) : null,
          notes: simNotes || null,
        },
        simulacao_status: 'pending',
      })
      toast.success('Simulação enviada para o chat')
      setSimChat(null); setSimProduct(''); setSimValue(''); setSimNotes('')
    } catch {
      toast.error('Erro ao enviar')
    } finally {
      setSimSending(false)
    }
  }

  const consultorNome = (id) => users.find(u => u.id === id)?.nome || '-'

  const filteredLists = lists.filter(l => {
    const d = l.created_at?.slice(0, 10)
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Listas</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && (
            <button onClick={() => setTab(t => t === 'relatorio' ? 'listas' : 'relatorio')} className="btn btn-secondary btn-sm">
              <BarChart2 size={14} /> {tab === 'relatorio' ? 'Listas' : 'Relatório'}
            </button>
          )}
          {tab !== 'relatorio' && (
            <button onClick={() => { setModal(true); setForm(EMPTY_LIST); setNomes(''); setParsedLeads([]); setCsvMode(false); setFormVendedorId(profile?.id || '') }} className="btn btn-primary">
              <Plus size={16} /> Nova Lista
            </button>
          )}
        </div>
      </div>

      {tab === 'relatorio' && isAdmin ? (
        <div>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Captação por Consultor</h3>
          {reportLoading ? (
            <p style={{ color: 'var(--muted)' }}>Carregando...</p>
          ) : reportData.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Nenhum contato registrado</div>
          ) : reportData.map((r, i) => (
            <div key={i} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.total} interações</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{r.added_to_crm || 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>no CRM</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>
                {[
                  { key: 'contacted',      label: 'Contatados',  color: '#3b82f6' },
                  { key: 'added_to_crm',   label: 'No CRM',      color: '#10b981' },
                  { key: 'no_answer',      label: 'Sem Resp.',   color: '#f59e0b' },
                  { key: 'not_interested', label: 'S. Interesse', color: '#ef4444' },
                ].map(s => (
                  <div key={s.key} style={{ background: s.color + '22', borderRadius: 8, padding: '8px 4px' }}>
                    <div style={{ fontWeight: 700, color: s.color, fontSize: 16 }}>{r[s.key] || 0}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 11 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                  <span>Taxa de conversão</span>
                  <span>{r.total > 0 ? Math.round(((r.added_to_crm || 0) / r.total) * 100) : 0}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--hover)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--success)', borderRadius: 3, width: `${r.total > 0 ? ((r.added_to_crm || 0) / r.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Date filter */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Filtrar por data:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ padding: '5px 8px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>até</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ padding: '5px 8px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }} className="btn btn-secondary btn-sm">Limpar</button>
            )}
          </div>

          {loading ? (
            <p style={{ color: 'var(--muted)' }}>Carregando...</p>
          ) : filteredLists.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Nenhuma lista criada</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredLists.map(l => {
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
                                <span key={s.key} style={{ marginLeft: 6, color: s.color }}>{s.count} {s.label.toLowerCase()}</span>
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
                                <div key={ld.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--hover)', borderRadius: 8 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500 }}>{ld.nome}</div>
                                    {(ld.telefone || ld.cpf) && (
                                      <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 10, marginTop: 2 }}>
                                        {ld.telefone && <span>📞 {ld.telefone}</span>}
                                        {ld.cpf && <span>🪪 {ld.cpf}</span>}
                                      </div>
                                    )}
                                  </div>
                                  <button onClick={() => cycleStatus(ld)} className="badge"
                                    style={{ background: st.bg, color: st.color, cursor: 'pointer', border: 'none', flexShrink: 0 }}
                                    title="Clique para mudar status">
                                    {st.label}
                                  </button>
                                  <button
                                    onClick={() => { setSimChat({ lead: ld, lista: l }); setSimCanal(l.banco === 'Santander' ? 'Santander' : 'Caixa'); setSimProduct(''); setSimValue(''); setSimNotes('') }}
                                    className="btn btn-sm"
                                    style={{ background: 'var(--info)', color: '#fff', padding: '3px 8px', fontSize: 11, flexShrink: 0 }}
                                    title="Enviar simulação para o chat">
                                    <Send size={11} />
                                  </button>
                                  {ld.status !== 'added_to_crm' && (
                                    <button onClick={() => sendToCRM(ld)} className="btn btn-sm"
                                      style={{ background: 'var(--success)', color: '#fff', padding: '3px 8px', fontSize: 11, flexShrink: 0 }}>
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
        </>
      )}

      {/* Create list modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>Nova Lista</h2>
            <div className="modal-row">
              <label>Nome da Lista *</label>
              <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Lista Caixa Maio" />
            </div>
            <div className="modal-row">
              <label>Descrição</label>
              <input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Opcional..." />
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
            {isAdmin && (
              <div className="modal-row">
                <label>Atribuir a</label>
                <select value={formVendedorId} onChange={e => setFormVendedorId(e.target.value)}>
                  {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button type="button" onClick={() => setCsvMode(false)} className="btn btn-sm"
                style={{ background: !csvMode ? 'var(--accent)' : 'var(--hover)', color: !csvMode ? '#fff' : 'var(--text)' }}>
                Colar Nomes
              </button>
              <button type="button" onClick={() => setCsvMode(true)} className="btn btn-sm"
                style={{ background: csvMode ? 'var(--accent)' : 'var(--hover)', color: csvMode ? '#fff' : 'var(--text)' }}>
                <Upload size={13} /> Importar CSV
              </button>
            </div>

            {csvMode ? (
              <div className="modal-row">
                <label>CSV (colunas: nome, cpf, telefone)</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '2px dashed var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--muted)' }}>
                  <Upload size={16} />
                  <span style={{ fontSize: 13 }}>Clique para selecionar o CSV</span>
                  <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleCSV} />
                </label>
                {parsedLeads.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 6 }}>
                    ✅ {parsedLeads.length} leads detectados
                    {parsedLeads.some(l => l.cpf) && ' · com CPF'}
                    {parsedLeads.some(l => l.telefone) && ' · com telefone'}
                  </div>
                )}
              </div>
            ) : (
              <div className="modal-row">
                <label>Leads (cole um nome por linha)</label>
                <textarea rows={8} value={nomes} onChange={e => setNomes(e.target.value)}
                  placeholder={"João da Silva\nMaria Souza\nPedro Lima\n..."}
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
                {nomes && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {nomes.split('\n').filter(n => n.trim()).length} lead(s) detectado(s)
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => setModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} className="btn btn-primary" disabled={!form.nome}>Criar Lista</button>
            </div>
          </div>
        </div>
      )}

      {/* Sim chat modal */}
      {simChat && (
        <div className="modal-overlay" onClick={() => setSimChat(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h2>Enviar para Simulação</h2>
            <div style={{ padding: '10px 14px', background: 'var(--hover)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{simChat.lead.nome}</div>
              {simChat.lead.telefone && <div style={{ fontSize: 13, color: 'var(--muted)' }}>📞 {simChat.lead.telefone}</div>}
              {simChat.lead.cpf && <div style={{ fontSize: 13, color: 'var(--muted)' }}>🪪 {simChat.lead.cpf}</div>}
            </div>
            <div className="modal-row">
              <label>Canal *</label>
              <select value={simCanal} onChange={e => setSimCanal(e.target.value)}>
                <option value="Caixa">🏦 Caixa</option>
                <option value="Santander">🏛️ Santander</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="modal-row">
                <label>Produto</label>
                <input value={simProduct} onChange={e => setSimProduct(e.target.value)} placeholder="Crédito Consignado..." />
              </div>
              <div className="modal-row">
                <label>Valor (R$)</label>
                <input type="number" value={simValue} onChange={e => setSimValue(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="modal-row">
              <label>Observações</label>
              <textarea rows={3} value={simNotes} onChange={e => setSimNotes(e.target.value)} placeholder="Detalhes adicionais..." />
            </div>
            <div className="modal-actions">
              <button onClick={() => setSimChat(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={sendSimChat} disabled={simSending} className="btn btn-primary">
                {simSending ? 'Enviando...' : 'Enviar Simulação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
