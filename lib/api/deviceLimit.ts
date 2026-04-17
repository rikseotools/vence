// lib/api/deviceLimit.ts — Server-side device registration and limit enforcement
// Free users: max 2 devices. Premium: max 3 (alert only, no block).

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _supabaseAdmin
}

export interface DeviceCheckResult {
  allowed: boolean
  deviceCount: number
  maxDevices: number
  isNewDevice: boolean
  isPremium: boolean
}

const FAIL_OPEN: DeviceCheckResult = {
  allowed: true,
  deviceCount: 0,
  maxDevices: 2,
  isNewDevice: false,
  isPremium: false,
}

export function getDeviceIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-device-id') ?? null
}

/**
 * Register a device for a user and check if it's within limits.
 * - Free: max 2 devices. 3rd device → blocked.
 * - Premium: max 3 devices. 4th device → allowed but flagged.
 * - Devices inactive 30+ days are auto-evicted by the SQL function.
 *
 * Returns allowed=true if no userId or no deviceId (fail open).
 */
export async function registerAndCheckDevice(
  userId: string | null,
  deviceId: string | null,
  userAgent?: string | null,
): Promise<DeviceCheckResult> {
  if (!userId || !deviceId) return FAIL_OPEN

  try {
    const deviceLabel = userAgent ? parseDeviceLabel(userAgent) : null

    const { data, error } = await getSupabaseAdmin().rpc('register_device', {
      p_user_id: userId,
      p_device_id: deviceId,
      p_device_label: deviceLabel,
    })

    if (error) {
      // Table might not exist yet — fail open
      if (error.code === '42P01' || error.code === 'PGRST202') {
        return FAIL_OPEN
      }
      console.error('❌ [DeviceLimit] RPC error:', error.message)
      return FAIL_OPEN
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result) return FAIL_OPEN

    return {
      allowed: result.allowed,
      deviceCount: result.device_count,
      maxDevices: result.max_devices,
      isNewDevice: result.is_new_device,
      isPremium: result.is_premium,
    }
  } catch (err) {
    console.error('❌ [DeviceLimit] Unexpected error:', err)
    return FAIL_OPEN
  }
}

/**
 * Get all user_ids that share a device. Used to enforce shared daily limit.
 */
export async function getAccountsOnDevice(deviceId: string): Promise<string[]> {
  if (!deviceId) return []

  try {
    const { data, error } = await getSupabaseAdmin().rpc('get_accounts_on_device', {
      p_device_id: deviceId,
    })

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST202') return []
      console.error('❌ [DeviceLimit] get_accounts error:', error.message)
      return []
    }

    if (!data) return []
    return (data as { user_id: string }[]).map(r => r.user_id)
  } catch {
    return []
  }
}

function parseDeviceLabel(ua: string): string {
  let browser = 'Unknown'
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Edg')) browser = 'Edge'

  let os = 'Unknown'
  if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'Mac'
  else if (ua.includes('Linux')) os = 'Linux'

  return `${browser} / ${os}`
}
