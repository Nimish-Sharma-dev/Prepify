import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your project values.'
  )
}

// Note: intentionally untyped (no Database generic). Row shapes are declared
// explicitly in src/types/database.ts and applied at each call site via
// `as` casts, which keeps this client flexible for RPC calls and joined
// selects without fighting the generated-schema generic.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
