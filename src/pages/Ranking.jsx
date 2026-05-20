import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCur } from '../lib/utils'
import { Trophy } from 'lucide-react'

export default function Ranking() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [clients, profiles] = await Promise.all([
      supabase.from('clientes').select('consultor_id, valor, banco'),
      supabase.from('profiles').select('id, nome, avatar, avatar_url').in('role', ['admin','consultor']),
    ])

    const c = clients.data || []
    const p = profiles.data || []

    const map = {}
    p.forEach(u => {
      map[u.id] = { ...u, total: 0, caixa: 0, santander: 0 }
    })

    c.forEach(cl => {
      if (!cl.consultor_id || !map[cl.consultor_id]) return
      map[cl.consultor_id].total += (cl.valor || 0)
      if (cl.banco === 'Caixa') map[cl.consultor_id].caixa += (cl.valor || 0)
      if (cl.banco === 'Santander') map[cl.consultor_id].santander += (cl.valor || 0)
    })

    // Add count
    const counts = {}
    c.forEach(cl => {
      if (!cl.consultor_id) return
      counts[cl.consultor_id] = (counts[cl.consultor_id] || 0) + 1
    })

    const ranking = Object.values(map)
      .map(u => ({ ...u, count: counts[u.id] || 0 }))
      .sort((a, b) => b.total - a.total)

    setData(ranking)
    setLoading(false)
  }

  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Ranking</h1>
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map((u, i) => (
            <div key={u.id} className="card" style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 20px',
              border: i === 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
            }}>
              {/* Position */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i < 3 ? medalColors[i] + '22' : 'var(--hover)',
                color: i < 3 ? medalColors[i] : 'var(--muted)',
                fontWeight: 700, fontSize: 15, flexShrink: 0,
              }}>
                {i < 3 ? <Trophy size={18} color={medalColors[i]} /> : i + 1}
              </div>

              {/* Avatar */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#fff',
              }}>
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : u.avatar || '?'}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{u.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {u.count} cliente(s)
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 20, textAlign: 'right' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Caixa</div>
                  <div style={{ fontWeight: 600, color: 'var(--info)' }}>{fmtCur(u.caixa)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Santander</div>
                  <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{fmtCur(u.santander)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: i === 0 ? 'var(--accent)' : 'var(--text)' }}>{fmtCur(u.total)}</div>
                </div>
              </div>
            </div>
          ))}

          {data.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
              Nenhum dado disponível
            </div>
          )}
        </div>
      )}
    </div>
  )
}
