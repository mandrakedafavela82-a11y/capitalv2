import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCur } from '../lib/utils'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const PODIUM_COLORS = [
  { bg: '#c8a227', border: '#f0c040', label: '#fff8e1' }, // 1º ouro
  { bg: '#2a52a0', border: '#4a72c0', label: '#e8eeff' }, // 2º azul
  { bg: '#b03a2e', border: '#e05545', label: '#ffeee8' }, // 3º vermelho
]

const MEDAL_COLORS = ['#f0c040', '#4a72c0', '#e05545']

export default function RankingTV() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [mes, ano])

  async function load() {
    setLoading(true)
    const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`
    const fim = mes === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 1).padStart(2,'0')}-01`

    const [{ data: clientes }, { data: profiles }] = await Promise.all([
      supabase.from('clientes')
        .select('consultor_id, valor')
        .gte('created_at', inicio)
        .lt('created_at', fim),
      supabase.from('profiles')
        .select('id, nome, avatar, avatar_url')
        .in('role', ['admin', 'consultor']),
    ])

    const map = {}
    ;(profiles || []).forEach(p => { map[p.id] = { ...p, total: 0, count: 0 } })
    ;(clientes || []).forEach(c => {
      if (!c.consultor_id || !map[c.consultor_id]) return
      map[c.consultor_id].total += (c.valor || 0)
      map[c.consultor_id].count += 1
    })

    setRanking(
      Object.values(map)
        .filter(u => u.total > 0)
        .sort((a, b) => b.total - a.total)
    )
    setLoading(false)
  }

  // Pódio: posição visual é [2º, 1º, 3º]
  const podium = [ranking[1], ranking[0], ranking[2]]
  const podiumOrder = [1, 0, 2] // índice original de cada slot visual

  const HEIGHTS = [200, 240, 170] // 2º, 1º, 3º

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1b2a 0%, #1a2e45 60%, #0d1b2a 100%)',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
      padding: '32px 24px',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 36 }}>🏆</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
              Ranking de Vendedores
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#8ab0d0', marginTop: 2 }}>
              Desempenho da equipe de vendas
            </p>
          </div>
        </div>

        <select
          value={`${mes}-${ano}`}
          onChange={e => {
            const [m, a] = e.target.value.split('-').map(Number)
            setMes(m); setAno(a)
          }}
          style={{
            background: '#1e3a5f', color: '#fff', border: '1px solid #2a5a8f',
            borderRadius: 8, padding: '8px 14px', fontSize: 15, cursor: 'pointer',
          }}
        >
          {MESES.map((nome, i) => (
            <option key={i} value={`${i + 1}-${ano}`}>{nome}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#8ab0d0', fontSize: 18 }}>Carregando...</div>
      ) : ranking.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#8ab0d0', fontSize: 18 }}>
          Nenhuma venda registrada em {MESES[mes - 1]}
        </div>
      ) : (
        <>
          {/* Pódio escadinha */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 16,
            marginBottom: 48,
          }}>
            {podium.map((u, slot) => {
              const realPos = podiumOrder[slot] // 0-based real ranking position
              const displayPos = realPos + 1    // 1, 2, 3
              const color = PODIUM_COLORS[realPos]
              const height = HEIGHTS[slot]

              if (!u) return <div key={slot} style={{ width: 220, height }} />

              return (
                <div key={u.id} style={{
                  width: 220,
                  height,
                  borderRadius: 16,
                  background: `linear-gradient(160deg, ${color.bg}cc, ${color.bg}88)`,
                  border: `2px solid ${color.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: 16,
                  boxShadow: `0 8px 32px ${color.bg}55`,
                  position: 'relative',
                }}>
                  {/* Troféu */}
                  <span style={{ fontSize: displayPos === 1 ? 32 : 24 }}>
                    {displayPos === 1 ? '🏆' : displayPos === 2 ? '🥈' : '🥉'}
                  </span>

                  {/* Avatar */}
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: color.border, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 700, color: '#fff',
                    border: `3px solid ${color.label}`,
                  }}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (u.avatar || u.nome?.[0] || '?')}
                  </div>

                  {/* Nome (só 1º lugar mostra nome grande) */}
                  {displayPos === 1 && (
                    <div style={{ fontWeight: 700, fontSize: 16, textAlign: 'center', color: color.label }}>
                      {u.nome}
                    </div>
                  )}

                  {/* Valor */}
                  <div style={{ fontWeight: 800, fontSize: displayPos === 1 ? 20 : 17, color: '#fff' }}>
                    {fmtCur(u.total)}
                  </div>

                  {/* Posição */}
                  <div style={{
                    fontSize: 22, fontWeight: 900, color: color.label,
                    textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  }}>
                    {displayPos}º
                  </div>
                </div>
              )
            })}
          </div>

          {/* Lista completa */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
            maxWidth: 860,
            margin: '0 auto',
          }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#8ab0d0' }}>Classificação Completa</span>
            </div>

            {ranking.map((u, i) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 24px',
                borderBottom: i < ranking.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                background: i === 0 ? 'rgba(240,192,64,0.08)' : 'transparent',
              }}>
                {/* Medalha / número */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < 3 ? MEDAL_COLORS[i] + '33' : 'rgba(255,255,255,0.08)',
                  color: i < 3 ? MEDAL_COLORS[i] : '#8ab0d0',
                  fontWeight: 700, fontSize: 15, flexShrink: 0,
                }}>
                  {i + 1}
                </div>

                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: i < 3 ? MEDAL_COLORS[i] : '#2a5a8f',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, color: '#fff',
                }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (u.avatar || u.nome?.[0] || '?')}
                </div>

                {/* Nome + vendas */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{u.nome}</div>
                  <div style={{ fontSize: 12, color: '#8ab0d0' }}>{u.count} venda{u.count !== 1 ? 's' : ''}</div>
                </div>

                {/* Total */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: i === 0 ? '#f0c040' : '#fff' }}>
                    {fmtCur(u.total)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
