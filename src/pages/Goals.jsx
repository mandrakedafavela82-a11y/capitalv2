import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtCur } from '../lib/utils'
import { toast } from 'sonner'
import { Plus, Pencil, Target, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function ProgressBar({ value, max, color = 'var(--accent)' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 8, background: 'var(--hover)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        width: pct + '%', height: '100%', borderRadius: 4,
        background: pct >= 100 ? 'var(--success)' : color,
        transition: 'width .5s ease',
      }} />
    </div>
  )
}

export default function Goals() {
  const { profile, isAdmin } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [metas, setMetas] = useState([])
  const [consultors, setConsultors] = useState([])
  const [vendas, setVendas] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ consultor_id: '', meta_valor: '' })
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [month, year, profile])

  async function load() {
    setLoading(true)
    const [m, c, v] = await Promise.all([
      supabase.from('metas').select('*').eq('month', month).eq('year', year),
      supabase.from('profiles').select('id, nome').in('role', ['admin','consultor']),
      supabase.from('vendas').select('consultor_id, sale_value: valor, data')
        .gte('data', `${year}-${String(month).padStart(2,'0')}-01`)
        .lte('data', lastDay(month, year)),
    ])
    setMetas(m.data || [])
    setConsultors(c.data || [])
    setVendas(v.data || [])
    setLoading(false)
  }

  function lastDay(m, y) {
    return new Date(y, m, 0).toISOString().slice(0, 10)
  }

  function achieved(consultorId) {
    return vendas
      .filter(v => v.consultor_id === consultorId)
      .reduce((s, v) => s + (v.sale_value || 0), 0)
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function openAdd() {
    setForm({ consultor_id: isAdmin ? '' : profile?.id, meta_valor: '' })
    setEditing(null)
    setModal(true)
  }

  function openEdit(meta) {
    setForm({ consultor_id: meta.consultor_id, meta_valor: meta.meta_valor })
    setEditing(meta.id)
    setModal(true)
  }

  async function save() {
    const consultor = consultors.find(c => c.id === form.consultor_id) || profile
    const payload = {
      consultor_id: form.consultor_id,
      seller_name: consultor?.nome || '',
      month,
      year,
      meta_valor: parseFloat(form.meta_valor) || 0,
    }

    if (editing) {
      const { error } = await supabase.from('metas').update(payload).eq('id', editing)
      if (error) { console.error('[DB]', error); return toast.error(error.message || 'Erro ao salvar meta') }
      setMetas(prev => prev.map(m => m.id === editing ? { ...m, ...payload } : m))
      toast.success('Meta atualizada')
    } else {
      const { data, error } = await supabase.from('metas').insert(payload).select().single()
      if (error) {
        if (error.code === '23505') return toast.error('Já existe uma meta para este consultor neste mês')
        return toast.error('Erro ao salvar meta')
      }
      setMetas(prev => [...prev, data])
      toast.success('Meta criada')
    }
    setModal(false)
  }

  async function remove(id) {
    if (!confirm('Excluir meta?')) return
    await supabase.from('metas').delete().eq('id', id)
    setMetas(prev => prev.filter(m => m.id !== id))
    toast.success('Meta removida')
  }

  // Merge consultors with their metas
  const rows = isAdmin
    ? consultors.map(c => ({
        consultor: c,
        meta: metas.find(m => m.consultor_id === c.id) || null,
        atingido: achieved(c.id),
      }))
    : [{
        consultor: consultors.find(c => c.id === profile?.id) || profile,
        meta: metas.find(m => m.consultor_id === profile?.id) || null,
        atingido: achieved(profile?.id),
      }]

  const totalMeta = rows.reduce((s, r) => s + (r.meta?.meta_valor || 0), 0)
  const totalAtingido = rows.reduce((s, r) => s + r.atingido, 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Metas</h1>
        {(isAdmin || !metas.find(m => m.consultor_id === profile?.id)) && (
          <button onClick={openAdd} className="btn btn-primary"><Plus size={16} /> {isAdmin ? 'Nova Meta' : 'Definir Meta'}</button>
        )}
      </div>

      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={prevMonth} className="btn btn-secondary btn-icon"><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 700, fontSize: 17, minWidth: 130, textAlign: 'center' }}>
          {MONTHS[month - 1]} / {year}
        </span>
        <button onClick={nextMonth} className="btn btn-secondary btn-icon"><ChevronRight size={16} /></button>
      </div>

      {/* Summary cards — admin only */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Meta Total</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{fmtCur(totalMeta)}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Atingido</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: totalAtingido >= totalMeta && totalMeta > 0 ? 'var(--success)' : 'var(--accent)', marginTop: 4 }}>
              {fmtCur(totalAtingido)}
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>% Atingido</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {totalMeta > 0 ? Math.round(totalAtingido / totalMeta * 100) : 0}%
            </div>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map(({ consultor, meta, atingido }) => {
            const metaV = meta?.meta_valor || 0
            const pct = metaV > 0 ? Math.min(100, Math.round(atingido / metaV * 100)) : 0
            const color = pct >= 100 ? 'var(--success)' : pct >= 70 ? 'var(--accent)' : pct >= 40 ? 'var(--warn)' : 'var(--danger)'

            return (
              <div key={consultor?.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, color: '#fff', fontSize: 15, flexShrink: 0,
                  }}>
                    {(consultor?.nome || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{consultor?.nome}</div>
                    {metaV > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Meta: {fmtCur(metaV)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color }}>{pct}%</div>
                    {metaV === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem meta</div>}
                  </div>
                  {isAdmin && (
                    <button onClick={() => meta ? openEdit(meta) : (setForm({ consultor_id: consultor.id, meta_valor: '' }), setEditing(null), setModal(true))} className="btn btn-secondary btn-sm btn-icon">
                      <Pencil size={13} />
                    </button>
                  )}
                </div>

                <ProgressBar value={atingido} max={metaV} color={color} />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Atingido: <strong style={{ color: 'var(--text)' }}>{fmtCur(atingido)}</strong></span>
                  <span style={{ color: 'var(--muted)' }}>Falta: <strong style={{ color: atingido >= metaV && metaV > 0 ? 'var(--success)' : 'var(--text)' }}>
                    {metaV > 0 ? (atingido >= metaV ? '🎯 Meta batida!' : fmtCur(metaV - atingido)) : '—'}
                  </strong></span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar Meta' : 'Nova Meta'} — {MONTHS[month - 1]}/{year}</h2>
            {isAdmin && (
              <div className="modal-row">
                <label>Consultor *</label>
                <select value={form.consultor_id} onChange={e => setForm(p => ({ ...p, consultor_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {consultors.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            <div className="modal-row">
              <label>Valor da Meta (R$) *</label>
              <input
                type="number" min="0" step="100"
                value={form.meta_valor}
                onChange={e => setForm(p => ({ ...p, meta_valor: e.target.value }))}
                placeholder="Ex: 50000"
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setModal(false)} className="btn btn-secondary">Cancelar</button>
              <button
                onClick={save}
                className="btn btn-primary"
                disabled={!form.meta_valor || (isAdmin && !form.consultor_id)}
              >Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
