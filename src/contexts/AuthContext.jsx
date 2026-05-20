import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Timeout de segurança: se após 8s ainda estiver loading, libera
    const timeout = setTimeout(() => setLoading(false), 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setProfile(null); setLoading(false); return }
      if (session?.user) await loadProfile(session.user)
      else { setProfile(null); setLoading(false) }
    })

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  async function loadProfile(user) {
    setLoading(true)
    try {
      // Google OAuth pre-approval check
      const providers = user.app_metadata?.providers || []
      const isGoogle = providers.includes('google') || user.app_metadata?.provider === 'google'

      if (isGoogle) {
        const { data: approved } = await supabase
          .from('approved_emails')
          .select('id, role')
          .eq('email', user.email)
          .maybeSingle()

        if (!approved) {
          await supabase.auth.signOut()
          setProfile(null)
          return
        }
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      setProfile(prof || null)
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
      setProfile(null)
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
      profile, loading,
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
