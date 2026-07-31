// lib/api/v2/user-sessions/queries.ts
// Query SERVIDOR (Drizzle/RDS, agnóstico). NO importar desde el cliente.
import { getDb, getPoolerDb } from '@/db/client'
import { userSessions } from '@/db/schema'
import type { CreateUserSessionRequest } from './schemas'

function dbForWrites() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

/**
 * Lo que el SERVIDOR sabe del request y el cliente no puede afirmar: de dónde viene.
 *
 * Va aparte de `CreateUserSessionRequest` a propósito — eso es lo que manda el navegador y esto
 * son las cabeceras del borde. Si viajaran juntos, el día que alguien mande `ipAddress` en el body
 * nos lo creeríamos.
 */
export interface OrigenDelRequest {
  ipAddress?: string | null
  geo?: { country_code: string; region: string; city: string; lat: number | null; lon: number | null } | null
}

export async function createUserSession(
  params: CreateUserSessionRequest,
  userId: string,
  origen: OrigenDelRequest = {},
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = dbForWrites()
    // La IP se estampa AQUÍ, en el request que crea la fila (T-314, 31/07/2026). Antes se dejaba a
    // NULL y se esperaba una segunda llamada de `/api/auth/track-session-ip` que llegaba ANTES de
    // que esta fila existiera y acababa escribiendo en una sesión de otro día — 96 % de las
    // escrituras, medido. Quien tiene la cabecera delante es este request: aquí no hay que adivinar.
    // `ip_address` es `inet`: 'unknown' (lo que devuelve el resolutor cuando no hay cabecera fiable)
    // NO es un valor válido y la fila entera fallaría al insertarse. Se guarda NULL.
    const ip = origen.ipAddress && origen.ipAddress !== 'unknown' ? origen.ipAddress : null
    const geo = origen.geo ?? null
    const [row] = await db
      .insert(userSessions)
      .values({
        userId,
        sessionStart: new Date().toISOString(),
        ipAddress: ip,
        countryCode: geo?.country_code ?? null,
        region: geo?.region ?? null,
        city: geo?.city ?? null,
        coordinates: geo && geo.lat !== null && geo.lon !== null ? [geo.lon, geo.lat] : null,
        userAgent: params.userAgent ?? null,
        screenResolution: params.screenResolution ?? null,
        viewportSize: params.viewportSize ?? null,
        deviceModel: params.deviceModel ?? null,
        browserLanguage: params.browserLanguage ?? null,
        timezone: params.timezone ?? null,
        colorDepth: params.colorDepth ?? null,
        pixelRatio: params.pixelRatio != null ? String(params.pixelRatio) : null,
        connectionType: params.connectionType ?? null,
      })
      .returning({ id: userSessions.id })
    if (!row?.id) return { success: false, error: 'insert_no_id' }
    return { success: true, id: row.id }
  } catch (error) {
    console.error(`❌ [v2/user-sessions] create falló userId=${userId}:`, (error as Error).message)
    return { success: false, error: 'db_error' }
  }
}
