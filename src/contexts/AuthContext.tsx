import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../types/database'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ error: string | null }>
  signup: (username: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

// Deterministic internal email so we can use Supabase's native email/password
// auth while the user only ever sees/enters a username. The real identifier
// exposed anywhere in the UI is the username, never this address.
function usernameToInternalEmail(username: string): string {
  return `${username.toLowerCase()}@users.prepify.internal`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) {
        loadProfile(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        loadProfile(newSession.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (!error && data) {
      setProfile(data as Profile)
    }
    setLoading(false)
  }

  async function login(username: string, password: string): Promise<{ error: string | null }> {
    const trimmed = username.trim()
    if (!trimmed || !password) {
      return { error: 'Enter your username and password.' }
    }

    // Look up the internal email for this username via a security-definer RPC,
    // so the client never needs to know or store emails.
    const { data: email, error: lookupError } = await supabase.rpc('get_email_for_username', {
      p_username: trimmed,
    })

    if (lookupError || !email) {
      return { error: 'Invalid username or password.' }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: 'Invalid username or password.' }
    }
    return { error: null }
  }

  async function signup(username: string, password: string): Promise<{ error: string | null }> {
    const trimmed = username.trim()
    if (!USERNAME_RE.test(trimmed)) {
      return { error: 'Username must be 3–20 characters: letters, numbers, underscore only.' }
    }
    if (password.length < 6) {
      return { error: 'Password must be at least 6 characters.' }
    }

    const { data: available, error: checkError } = await supabase.rpc('is_username_available', {
      p_username: trimmed,
    })
    if (checkError) {
      return { error: 'Could not verify username. Try again.' }
    }
    if (!available) {
      return { error: 'That username is already taken.' }
    }

    const email = usernameToInternalEmail(trimmed)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: trimmed } },
    })

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        return { error: 'That username is already taken.' }
      }
      return { error: 'Could not create account. Try again.' }
    }

    return { error: null }
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
