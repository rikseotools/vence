// lib/api/authHeaders.ts — Get Bearer token + device ID headers for client-side API calls
import { getSupabaseClient } from '@/lib/supabase'

const DEVICE_ID_KEY = 'vence_device_id'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}

  try {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch {}

  if (typeof window !== 'undefined') {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (deviceId) headers['X-Device-Id'] = deviceId
    const hwFp = localStorage.getItem('vence_hw_fingerprint')
    if (hwFp) headers['X-Hw-Fingerprint'] = hwFp
  }

  return headers
}
