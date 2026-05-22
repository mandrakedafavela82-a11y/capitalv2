import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCur } from '../lib/utils'
import { getCached, setCached } from '../lib/cache'
import { Trophy } from 'lucide-react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const PODIUM_COLORS = [
  { bg: '#c8a227', border: '#f0c040' }, // 1º ouro
  { bg: '#2a52a0', border: '#4a72c0' }, // 2º azul
  { bg: '#b03a2e', border: '#e05545' }, // 3º vermelho
]

const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']

export default function Ranking() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano] = useState(now.getFullYear())
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [mes])

  async function load() {
    const cacheKey = `ranking-${mes}-${ano}`
    const cached = getCached(cacheKey)
    if (cached) { setData(cached); setLoading(false) }
    else setLoading(true)

    const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`
    const fim = mes === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 1).padStart(2,'0')}-01`

    const [clients, profiles] = await Promise.all([
      supabase.from('clientes').select('consultor_id, valor, banco').gte('created_at', inicio).lt('created_at', fim),
      supabase.from('profiles').select('id, nome, avatar, avatar_url').in('role', ['admin','consultor']),
    ])

    const c = clients.data || []
    const p = profiles.data || []

    const map = {}
    p.forEach(u => { map[u.id] = { ...u, total: 0, caixa: 0, santander: 0, count: 0 } })
    c.forEach(cl => {
      if (!cl.consultor_id || !map[cl.consultor_id]) return
      map[cl.consultor_id].total += (cl.valor || 0)
      map[cl.consultor_id].count += 1
      if (cl.banco === 'Caixa') map[cl.consultor_id].caixa += (cl.valor || 0)
      if (cl.banco === 'Santander') map[cl.consultor_id].santander += (cl.valor || 0)
    })

    const ranked = Object.values(map)
      .filter(u => u.total > 0)
      .sort((a, b) => b.total - a.total)
    setCached(cacheKey, ranked)
    setData(ranked)
    setLoading(false)
  }

  // Pódio escadinha: posição visual [2º, 1º, 3º]
  const podiumSlots = [data[1], data[0], data[2]]
  const podiumRealPos = [1, 0, 2]
  const podiumHeights = [180, 220, 155]

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="page-title">Ranking</h1>
        <select
          value={mes}
          onChange={e => setMes(Number(e.target.value))}
          style={{
            background: 'var(--card)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '6px 12px', fontSize: 14, cursor: 'pointer',
          }}
        >
          {MESES.map((nome, i) => (
            <option key={i} value={i + 1}>{nome}</option>
          ))}
        </select>
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Carregando...</p> : (
        <>
          {/* Pódio escadinha */}
          {data.length >= 1 && (
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              gap: 12, marginBottom: 32,
            }}>
              {podiumSlots.map((u, slot) => {
                if (!u) return <div key={slot} style={{ width: 180, height: podiumHeights[slot] }} />
                const pos = podiumRealPos[slot]
                const color = PODIUM_COLORS[pos]
                const displayPos = pos + 1
                return (
                  <div key={u.id} style={{
                    width: 190, height: podiumHeights[slot],
                    borderRadius: 14,
                    background: `linear-gradient(160deg, ${color.bg}cc, ${color.bg}77)`,
                    border: `2px solid ${color.border}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: 12,
                    boxShadow: `0 6px 24px ${color.bg}44`,
                  }}>
                    <span style={{ fontSize: displayPos === 1 ? 26 : 20 }}>
                      {displayPos === 1 ? '🏆' : displayPos === 2 ? '🥈' : '🥉'}
                    </span>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: color.border, overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: '#fff',
                    }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (u.avatar || u.nome?.[0] || '?')}
                    </div>
                    {displayPos === 1 && (
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', textAlign: 'center' }}>
                        {u.nome}
                      </div>
                    )}
                    <div style={{ fontWeight: 800, fontSize: displayPos === 1 ? 17 : 15, color: '#fff' }}>
                      {fmtCur(u.total)}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'rgba(255,255,255,0.85)' }}>
                      {displayPos}º
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Lista completa */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map((u, i) => (
              <div key={u.id} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 20px',
                border: i === 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < 3 ? medalColors[i] + '22' : 'var(--hover)',
                  color: i < 3 ? medalColors[i] : 'var(--muted)',
                  fontWeight: 700, fontSize: 15, flexShrink: 0,
                }}>
                  {i < 3 ? <Trophy size={18} color={medalColors[i]} /> : i + 1}
                </div>

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

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{u.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{u.count} venda(s)</div>
                </div>

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
                Nenhuma venda em {MESES[mes - 1]}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
