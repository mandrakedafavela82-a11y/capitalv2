import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setProfile(null); setLoading(false); return }
      if (session?.user) await loadProfile(session.user)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(user) {
    setLoading(true)
    // Google OAuth pre-approval check
    const providers = user.app_metadata?.providers || []
    const isGoogle = providers.includes('google') || user.app_metadata?.provider === 'google'

    if (isGoogle) {
      const { data: approved, error } = await supabase
        .from('approved_emails')
        .select('id, role')
        .eq('email', user.email)
        .maybeSingle()

      if (error || !approved) {
        await supabase.auth.signOut()
        setProfile(null)
        setLoading(false)
        return
      }
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(prof || null)
    setLoading(false)
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
