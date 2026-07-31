// app/api/auth/track-session-ip/route.ts
// Guarda la IP y localidad en la sesión del usuario para detectar cuentas compartidas
import { NextResponse, after } from 'next/server'
import { getDb, getAdminDb, probeDbPaths } from '@/db/client'
import { userSessions, userDevices } from '@/db/schema'
import { eq, isNull, desc, and, gte } from 'drizzle-orm'
import { SESSION_IP_MAX_AGE_MIN } from '@/lib/security/sessionIpTracking'
import { extractEdgeGeo, type EdgeGeo } from '@/lib/api/edgeGeo'
import { getClientIp } from '@/lib/api/clientIp'
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

    // Resolutor compartido (T-089): distingue la cabecera del borde de confianza de una
    // falsificable, en vez de creerse el primer `x-forwarded-for` que llegue.
    const ip = getClientIp(request)

    console.log('📍 [SessionIP] Tracking IP de sesión:', {
      userId: userId.substring(0, 8) + '...',
      ip,
      hasDeviceId: !!deviceId,
    })

    // Geolocalización de los headers del edge (CloudFront → Vercel legacy), sync 0 latencia
    const geo: EdgeGeo | null = extractEdgeGeo(request.headers)

    const db = getDb()

    // `ip_address` es de tipo `inet`: escribir 'unknown' —lo que devuelve el resolutor cuando no
    // hay ninguna cabecera— reventaría el UPDATE entero y el handler degradaría a 200/no-track sin
    // que nadie viera la causa. Sin IP fiable no se toca la columna; el resto (device, geo) sí.
    const updateData: Record<string, unknown> = {}
    if (ip !== 'unknown') updateData.ipAddress = ip

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
        // Sin sessionId hay que adivinar la fila, y adivinar mal es PEOR que no escribir: hasta el
        // 31/07 esto cogía «la más reciente sin IP» sin mirar su fecha y el 96% de las escrituras
        // caían en sesiones de otros días —58 de hace más de una semana—, porque la fila de hoy
        // aún no existe cuando llega esta llamada. Con 34.732 filas sin IP en la cola de los 27
        // días rotos, esto no estampaba la sesión viva: drenaba el atasco con la IP de hoy y le
        // mentía al antifraude, que es quien luego compara IPs para decidir si dos cuentas
        // comparten casa. Ahora sólo se estampa una sesión que PUEDA ser la de ahora; si no la
        // hay, no se escribe nada — la IP de verdad ya la pone quien crea la fila (T-314).
        const recentSession = await db
          .select({ id: userSessions.id })
          .from(userSessions)
          .where(
            and(
              eq(userSessions.userId, userId),
              isNull(userSessions.ipAddress),
              gte(userSessions.sessionStart, new Date(Date.now() - SESSION_IP_MAX_AGE_MIN * 60_000).toISOString()),
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
