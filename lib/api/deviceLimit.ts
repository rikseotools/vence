// lib/api/deviceLimit.ts — Server-side device registration and limit enforcement
// All users: max 2 devices (computer + phone). Blocks 3rd device.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { NextRequest } from 'next/server'
// Fase 1.5 outbox sprint (28/05/2026): cache Redis cross-lambda para
// 3 RPCs antifraude. Ver docs/roadmap/sprint-outbox-test-questions.md
import { getOrSet, invalidate as redisInvalidate } from '@/lib/cache/redis'

// AGNÓSTICO (Fase C1): server-only (solo app/api/*). RPCs plpgsql vía Drizzle
// (getAdminDb, bypass RLS) en vez de supabase.rpc — portable a RDS/Neon.
function rowsOf(res: unknown): any[] {
  return (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as any[]
}

export interface DeviceCheckResult {
  allowed: boolean
  deviceCount: number
  maxDevices: number
  isNewDevice: boolean
  isPremium: boolean
  existingDevices: string
}

const FAIL_OPEN: DeviceCheckResult = {
  allowed: true,
  deviceCount: 0,
  maxDevices: 2,
  isNewDevice: false,
  isPremium: false,
  existingDevices: '',
}

export function getDeviceIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-device-id') ?? null
}

export function getHwFingerprintFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-hw-fingerprint') ?? null
}

// Cache de device checks: evita llamar a la RPC register_device en cada pregunta
// de un examen (100 preguntas = 100 RPCs sin cache). TTL 60s: suficiente para
// un examen, el estado del dispositivo no cambia durante un test.
// Bug Paloma 30/04/2026: 100 RPCs de device check → 100 errores 403 → cascada 504s.
interface DeviceCacheEntry {
  result: DeviceCheckResult
  timestamp: number
}
const deviceCheckCache = new Map<string, DeviceCacheEntry>()
const DEVICE_CHECK_TTL = 60_000 // 60 segundos

/** Clear the in-memory device check cache (for testing). */
export function clearDeviceCheckCache() {
  deviceCheckCache.clear()
}

/**
 * Register a device for a user and check if it's within limits.
 * - Free: max 2 devices. 3rd device → blocked.
 * - Premium: max 3 devices. 4th device → allowed but flagged.
 * - Devices inactive 30+ days are auto-evicted by the SQL function.
 * - Cached 60s to avoid RPC spam during exams (100 questions = 100 calls).
 *
 * Returns allowed=true if no userId or no deviceId (fail open).
 */
export async function registerAndCheckDevice(
  userId: string | null,
  deviceId: string | null,
  userAgent?: string | null,
  hwFingerprint?: string | null,
): Promise<DeviceCheckResult> {
  if (!userId || !deviceId) return FAIL_OPEN

  // L1 cache in-memory por-lambda (mantenemos por compat + edge case Redis caído).
  const cacheKey = `${userId}:${deviceId}`
  const cached = deviceCheckCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < DEVICE_CHECK_TTL) {
    return cached.result
  }

  // L2 cache Redis cross-lambda (Fase 1.5 outbox sprint 28/05/2026): para tests
  // de 25q en 5min → 96% hit ratio sobre el mismo user+device. Reduce RPCs a
  // Supabase de 25/test a ~1/test. Singleflight de redis.ts protege contra
  // stampede en cache miss. Fallback automático a fetcher si Redis cae.
  return getOrSet<DeviceCheckResult>(`device_check:${userId}:${deviceId}`, 60, async () => {
    try {
      const deviceLabel = userAgent ? parseDeviceLabel(userAgent) : null

      const regRes = await getAdminDb().execute(sql`
        SELECT * FROM register_device(${userId}::uuid, ${deviceId}, ${deviceLabel}, ${hwFingerprint || null})
      `)
      const result = rowsOf(regRes)[0]
      if (!result) return FAIL_OPEN

      const checkResult: DeviceCheckResult = {
        allowed: result.out_allowed ?? result.allowed,
        deviceCount: result.out_device_count ?? result.device_count,
        maxDevices: result.out_max_devices ?? result.max_devices,
        isNewDevice: result.out_is_new_device ?? result.is_new_device,
        isPremium: result.out_is_premium ?? result.is_premium,
        existingDevices: result.out_existing_devices ?? result.existing_devices ?? '',
      }

      // Guardar también en L1 in-memory (no esperamos al próximo cache miss para tenerlo local).
      deviceCheckCache.set(cacheKey, { result: checkResult, timestamp: Date.now() })

      return checkResult
    } catch (err) {
      console.error('❌ [DeviceLimit] Unexpected error:', err)
      return FAIL_OPEN
    }
  })
}

/** Invalida cache device_check (L1 + L2) tras un cambio relevante (premium upgrade/downgrade). */
export async function invalidateDeviceCheckCache(userId: string, deviceId: string): Promise<void> {
  deviceCheckCache.delete(`${userId}:${deviceId}`)
  await redisInvalidate(`device_check:${userId}:${deviceId}`)
}

/**
 * Get all user_ids that share a device. Used to enforce shared daily limit.
 */
export async function getAccountsOnDevice(deviceId: string): Promise<string[]> {
  if (!deviceId) return []

  try {
    const accRes = await getAdminDb().execute(sql`
      SELECT * FROM get_accounts_on_device(${deviceId})
    `)
    return rowsOf(accRes).map((r: { user_id: string }) => r.user_id)
  } catch {
    return []
  }
}

function parseDeviceLabel(ua: string): string {
  // Navegador. OJO con iOS: Chrome/Firefox/Edge se identifican como CriOS/FxiOS/
  // EdgiOS (no el literal "Chrome"/"Firefox"/"Edge") y TODOS contienen "Safari".
  // Hay que detectar las variantes iOS ANTES que Safari para no etiquetar como
  // Safari un Chrome de iPad (bug caso Vanesa 02/06/2026).
  let browser = 'Unknown'
  if (ua.includes('CriOS') || (ua.includes('Chrome') && !ua.includes('Edg'))) browser = 'Chrome'
  else if (ua.includes('FxiOS') || ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('EdgiOS') || ua.includes('Edg')) browser = 'Edge'
  else if (ua.includes('Safari')) browser = 'Safari'

  // Tipo de dispositivo / SO. Distinguir iPad de iPhone (y móvil/tablet Android)
  // para que dos equipos del mismo usuario NO salgan con la misma etiqueta en el
  // modal de límite de dispositivos — si no, no se puede saber cuál desconectar.
  let os = 'Unknown'
  if (ua.includes('iPad')) os = 'iPad'
  else if (ua.includes('iPhone')) os = 'iPhone'
  else if (ua.includes('iPod')) os = 'iPod'
  else if (ua.includes('Android')) os = ua.includes('Mobile') ? 'Android (móvil)' : 'Android (tablet)'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'Mac'
  else if (ua.includes('Linux')) os = 'Linux'

  return `${browser} / ${os}`
}
