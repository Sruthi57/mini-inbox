import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ContactStatus = 'new' | 'contacted' | 'discarded'

export interface Agency {
  id: string
  slug: string
  name: string
  created_at: string
}

export interface Contact {
  id: string
  agency_id: string
  name: string
  email: string
  message: string
  status: ContactStatus
  created_at: string
}
