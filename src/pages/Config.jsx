import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { compressImage } from '../lib/utils'
import { toast } from 'sonner'
import { Save, Upload, Moon, Sun, Coffee } from 'lucide-react'

export default function Config() {
  const { profile, refreshProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const [nome, setNome] = useState(profile?.nome || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const themes = [
    { key: 'dark',  label: 'Escuro', icon: Moon,   desc: 'Fundo preto, texto claro' },
    { key: 'light', label: 'Claro',  icon: Sun,    desc: 'Fundo branco, texto escuro' },
    { key: 'sepia', label: 'Sépia',  icon: Coffee, desc: 'Tom amarelado, descansa os olhos' },
  ]

  async function saveName() {
    if (!nome.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ nome: nome.trim(), avatar: nome.trim().slice(0, 1).toUpperCase() })
      .eq('id', profile?.id)
    if (error) { toast.error('Erro ao salvar'); setSaving(false); return }
    await refreshProfile()
    toast.success('Nome salvo')
    setSaving(false)
  }

  async function handleAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Envie uma imagem')
    setUploading(true)
    try {
      const base64 = await compressImage(file, 200, 200, 0.75)
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: base64 })
        .eq('id', profile?.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Foto de perfil atualizada')
    } catch {
      toast.error('Erro ao enviar foto')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const avatarUrl = profile?.avatar_url

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {/* Profile */}
        <div className="card">
          <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Perfil</h2>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--accent)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 700, color: '#fff',
                cursor: 'pointer', position: 'relative', flexShrink: 0,
                border: '3px solid var(--border)',
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : profile?.avatar || '?'}
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity .2s',
              }} className="av-hover">
                <Upload size={20} color="#fff" />
              </div>
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                className="btn btn-secondary btn-sm"
                disabled={uploading}
              >
                <Upload size={14} />
                {uploading ? 'Enviando...' : 'Alterar foto'}
              </button>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                JPG, PNG ou WEBP · máx 5 MB
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
          </div>

          {/* Name */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              Nome
            </label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Seu nome"
              onKeyDown={e => e.key === 'Enter' && saveName()}
            />
          </div>
          <button onClick={saveName} className="btn btn-primary btn-sm" disabled={saving || !nome.trim()}>
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar nome'}
          </button>

          {/* Info readonly */}
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--hover)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>E-mail</div>
            <div style={{ fontSize: 14, wordBreak: 'break-all' }}>{profile?.email}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, marginBottom: 4 }}>Cargo</div>
            <div style={{ fontSize: 14, textTransform: 'capitalize' }}>{profile?.role}</div>
          </div>
        </div>

        {/* Theme */}
        <div className="card">
          <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Tema</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {themes.map(t => {
              const Icon = t.icon
              const active = theme === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 10,
                    border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent)11' : 'var(--hover)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color .15s',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: active ? 'var(--accent)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={17} color={active ? '#fff' : 'var(--muted)'} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: active ? 'var(--accent)' : 'var(--text)' }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{t.desc}</div>
                  </div>
                  {active && <div style={{ marginLeft: 'auto', width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
