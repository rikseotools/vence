// lib/api/authHeaders.ts — Get Bearer token headers for client-side API calls
import { getSupabaseClient } from '@/lib/supabase'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` }
    }
  } catch {}
  return {}
}
