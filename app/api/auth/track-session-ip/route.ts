// app/api/auth/track-session-ip/route.ts
// Guarda la IP y localidad en la sesión del usuario para detectar cuentas compartidas
import { NextResponse, after } from 'next/server'
import { getDb, getAdminDb, probeDbPaths } from '@/db/client'
import { userSessions, userDevices } from '@/db/schema'
import { eq, isNull, desc, and } from 'drizzle-orm'
import { z } from 'zod/v3'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { emit } from '@/lib/observability/emit'

// Quick-fail timeout (Phase 3). Track-session-ip se llama en cada login;
// si el pooler parpadea, el lambda quedaría 30s esperando. 10s es
// suficiente para SELECT+UPDATE de userSessions con margen para latencia.
const TRACK_TIMEOUT_MS = 10000
// Fracción de timeouts en los que se ejecuta el probe de diagnóstico (abre
// conexiones nuevas a BD). Muestreado para no amplificar carga durante bursts.
const PROBE_SAMPLE_RATE = 0.2
const trackSessionIpSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid().nullish(),
  deviceId: z.string().nullish(),
  hwFingerprint: z.string().nullish(),
})

interface GeoLocation {
  country_code: string
  region: string
  city: string
  lat: number | null
  lon: number | null
}

/**
 * Extrae geolocation de los headers que Vercel inyecta en cada request
 * server-side (gratis en todos los planes, incluido Hobby).
 *
 * Reemplaza la llamada externa a ip-api.com que tenía 3 problemas:
 *   1. Bloqueaba el await de la respuesta hasta 3s (AbortSignal timeout) →
 *      login lento si el proveedor estaba lento o caído
 *   2. HTTP no HTTPS → tráfico de geolocalización en claro
 *   3. Free tier 45 req/min → riesgo de rate limit a escala
 *
 * Vercel headers disponibles (verificado en producción 2026-05-06):
 *   - x-vercel-ip-country         (e.g. 'ES')
 *   - x-vercel-ip-country-region  (e.g. 'M' para Madrid)
 *   - x-vercel-ip-city            (e.g. 'Madrid', URL-encoded)
 *   - x-vercel-ip-latitude        (e.g. '40.4168')
 *   - x-vercel-ip-longitude       (e.g. '-3.7038')
 *
 * En dev local (next dev) los headers no existen → devolvemos null y la
 * sesión se guarda sin geo data. Comportamiento esperado.
 *
 * Pérdida controlada: el campo isp ya no se rellena. Verificado que NO
 * se consume en ningún sitio del codebase (admin/fraudes solo usa city).
 * Filas históricas mantienen su isp; nuevas serán null.
 */
function extractGeoFromVercelHeaders(request: Request): GeoLocation | null {
  const country = request.headers.get('x-vercel-ip-country')
  if (!country) return null // dev local o request sin pasar por Vercel edge

  const cityEncoded = request.headers.get('x-vercel-ip-city')
  // Vercel encodea el city con encodeURIComponent (espacios = %20, etc.)
  const city = cityEncoded ? safeDecodeURIComponent(cityEncoded) : ''

  const region = request.headers.get('x-vercel-ip-country-region') || ''
  const lat = parseFloatOrNull(request.headers.get('x-vercel-ip-latitude'))
  const lon = parseFloatOrNull(request.headers.get('x-vercel-ip-longitude'))

  return { country_code: country, region, city, lat, lon }
}

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function parseFloatOrNull(s: string | null): number | null {
  if (!s) return null
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

async function _POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = trackSessionIpSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { userId, sessionId, deviceId, hwFingerprint } = parsed.data

    // Obtener IP del request
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0]?.trim() ?? realIp ?? 'unknown'

    console.log('📍 [SessionIP] Tracking IP de sesión:', {
      userId: userId.substring(0, 8) + '...',
      ip,
      hasDeviceId: !!deviceId,
    })

    // Obtener geolocalización de Vercel headers (sync, 0 latencia, 0 timeout)
    const geo = extractGeoFromVercelHeaders(request)

    const db = getDb()

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {
      ipAddress: ip,
    }

    if (deviceId) {
      updateData.deviceFingerprint = deviceId
    }

    if (hwFingerprint) {
      updateData.deviceId = hwFingerprint
    }

    if (geo) {
      updateData.countryCode = geo.country_code
      updateData.region = geo.region
      updateData.city = geo.city
      // isp no se setea: Vercel headers no lo exponen y el campo no se
      // consume en ningún sitio del codebase (admin/fraudes solo usa city)
      if (geo.lat !== null && geo.lon !== null) {
        updateData.coordinates = [geo.lon, geo.lat]
      }
      console.log('📍 [SessionIP] Localidad:', geo.city, geo.region, geo.country_code)
    }

    // Wrap todo el bloque de DB en quick-fail. Si el pooler parpadea,
    // devolvemos 503 en 10s en vez de mantener el lambda 30s.
    await withDbTimeout(async () => {
      if (sessionId) {
        // Actualizar sesión específica
        await db
          .update(userSessions)
          .set(updateData)
          .where(eq(userSessions.id, sessionId))
      } else {
        // Sin sessionId: actualizar la sesión más reciente sin IP
        // Drizzle no soporta .update().order().limit(), usamos select + update por ID
        const recentSession = await db
          .select({ id: userSessions.id })
          .from(userSessions)
          .where(
            and(
              eq(userSessions.userId, userId),
              isNull(userSessions.ipAddress)
            )
          )
          .orderBy(desc(userSessions.sessionStart))
          .limit(1)

        if (recentSession.length > 0) {
          await db
            .update(userSessions)
            .set(updateData)
            .where(eq(userSessions.id, recentSession[0].id))
        }
      }
    }, TRACK_TIMEOUT_MS)

    // Update hw_fingerprint in user_devices if both deviceId and hwFingerprint present
    if (deviceId && hwFingerprint) {
      try {
        await getAdminDb()
          .update(userDevices)
          .set({ hwFingerprint })
          .where(and(
            eq(userDevices.userId, userId),
            eq(userDevices.deviceId, deviceId),
          ))
      } catch {}
    }

    return NextResponse.json({
      success: true,
      ip,
      geo: geo ? { city: geo.city, region: geo.region, country: geo.country_code } : null,
    })
  } catch (error) {
    // Track-session-ip es analytics de seguridad eventually-consistent:
    // el cliente trata el call como fire-and-forget no crítico (ver
    // contexts/AuthContext.tsx:41-59) y la fila se actualiza en el siguiente
    // login. Para CUALQUIER fallo de BD (timeout, conexión transitoria, query
    // glitch del pooler) devolvemos 200 { tracked: false } — el cliente no
    // tiene nada útil que hacer con un 500 aquí.
    //
    // MANTENEMOS OBSERVABILIDAD: emitimos evento `warn` con eventType
    // específico (no contamina http_5xx / critical) para que /admin/observability
    // pueda detectar si el rate sube significativamente sobre baseline (0.82%
    // medido 30/05/2026) y reabrir como bug real del pooler.
    const isTimeout = isDbTimeoutError(error)
    const errMsg = error instanceof Error ? error.message : 'Unknown error'

    if (isTimeout) {
      console.warn('⏱️ [SessionIP] Timeout (quick-fail) — degradado a 200/no-track:', error.timeoutMs, 'ms')
    } else {
      console.warn('⚠️ [SessionIP] Error de BD transitorio — degradado a 200/no-track:', errMsg.slice(0, 200))
    }

    if (isTimeout) {
      // Probe de diagnóstico en after(): corre DESPUÉS de enviar la response
      // (cero latencia para el usuario, que además trata esto como
      // fire-and-forget). Distingue conexión ZOMBI (conexión nueva responde
      // → la del pool estaba medio-muerta) de fallo real de BD. El resultado
      // viaja en metadata para confirmar la causa raíz sin abrir Sentry.
      //
      // MUESTREADO al 20%: en un burst (un blip de Supavisor genera decenas
      // de timeouts a la vez) no queremos abrir una conexión nueva por cada
      // uno contra el pooler que justo flaquea. 1 de cada 5 da señal de sobra
      // (~60 probes/día en baseline) sin amplificar carga en el peor momento.
      const sampled = Math.random() < PROBE_SAMPLE_RATE
      after(async () => {
        const probe = sampled ? await probeDbPaths().catch(() => null) : null
        await emit({
          source: 'vercel',
          severity: 'warn',
          eventType: 'track_session_ip_db_timeout',
          endpoint: '/api/auth/track-session-ip',
          errorMessage: errMsg.slice(0, 500),
          metadata: { degraded_to: 200, reason: 'db_unavailable', probe, probeSampled: sampled },
        }).catch(() => {})
      })
    } else {
      // Fire-and-forget — no esperamos al emit ni rompemos si falla
      emit({
        source: 'vercel',
        severity: 'warn',
        eventType: 'track_session_ip_db_error',
        endpoint: '/api/auth/track-session-ip',
        errorMessage: errMsg.slice(0, 500),
        metadata: { degraded_to: 200, reason: 'db_error' },
      }).catch(() => {})
    }

    return NextResponse.json(
      { success: false, tracked: false, reason: isTimeout ? 'db_unavailable' : 'db_error' },
      { status: 200 }
    )
  }
}

export const POST = withErrorLogging('/api/auth/track-session-ip', _POST)
