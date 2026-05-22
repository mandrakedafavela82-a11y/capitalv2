import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [authUser, setAuthUser] = useState(undefined) // undefined=carregando, null=sem sessão
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setAuthUser(null); setProfile(null); setLoading(false); return
      }
      if (session?.user) {
        setAuthUser(session.user)
        await loadProfile(session.user)
      } else {
        setAuthUser(null); setProfile(null); setLoading(false)
      }
    })

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  async function loadProfile(user) {
    setLoading(true)
    try {
      const providers = user.app_metadata?.providers || []
      const isGoogle = providers.includes('google') || user.app_metadata?.provider === 'google'

      if (isGoogle) {
        const { data: approved, error: approvedErr } = await supabase
          .from('approved_emails')
          .select('id, role')
          .eq('email', user.email)
          .maybeSingle()

        // Só faz logout se a query FUNCIONOU e o email não está aprovado.
        // Se deu erro de rede/RLS, mantém a sessão para não deslogar indevidamente.
        if (!approvedErr && approved === null) {
          await supabase.auth.signOut()
          setAuthUser(null); setProfile(null)
          return
        }
      }

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profErr) {
        console.error('Erro ao carregar perfil:', profErr)
        // Mantém authUser válido — sessão existe, só o perfil falhou
        setProfile(null)
        return
      }

      setProfile(prof || null)
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function refreshProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadProfile(user)
  }

  return (
    <AuthContext.Provider value={{
      profile, loading, authUser,
      isAdmin: profile?.role === 'admin',
      isOperacional: profile?.role === 'operacional',
      isConsultor: profile?.role === 'consultor',
      signInWithGoogle, signInWithEmail, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
