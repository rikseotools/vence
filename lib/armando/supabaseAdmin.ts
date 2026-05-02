// lib/armando/supabaseAdmin.ts
// Cliente Supabase con SERVICE_ROLE para operaciones server-side del panel /armando.
// Mismo patrón que lib/api/dailyLimit.ts.

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function getArmandoSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados')
    }
    _admin = createClient(url, key)
  }
  return _admin
}
