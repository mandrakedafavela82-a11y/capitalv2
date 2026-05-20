import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { toast } from 'sonner'
import { LogIn } from 'lucide-react'

export default function Login() {
  const { signInWithGoogle, signInWithEmail } = useAuth()
  const { theme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmail = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      await signInWithEmail(email, password)
    } catch (err) {
      toast.error('Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    try {
      await signInWithGoogle()
    } catch {
      toast.error('Erro ao entrar com Google')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20,
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 400,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={theme === 'dark' ? '/logo.png' : '/logo-light.png'}
            alt="CapitalCred"
            style={{ height: 50, objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Plataforma de consultoria financeira
          </p>
        </div>

        {/* Email / password */}
        <form onSubmit={handleEmail}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
          >
            <LogIn size={16} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>ou</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" style={{ width: 18, height: 18 }} />
          Entrar com Google
        </button>
      </div>
    </div>
  )
}
