// lib/api/fraud/esConfirmado.ts
//
// ¿Este sujeto está en la lista de fraude CONFIRMADO por revisión manual?
//
// ── PARA QUÉ (T-304, 30/07/2026) ────────────────────────────────────────────
// El límite por dispositivo arranca en modo `shadow`: mide sin cortar, porque el ancla nueva
// agrupa cuentas que antes no se agrupaban y hay que ver a quién afectaría antes de aplicarlo a
// todo el mundo. Esa prudencia es correcta para el grueso de usuarios… y sobra para los que ya
// están verificados uno a uno.
//
// Decisión de Manuel: **cortar ya a los confirmados**, sin esperar a la sombra. Y es la opción de
// MENOS riesgo, no de más: son 8 dispositivos revisados con evidencia concreta (correos que son
// variantes del mismo nombre, altas escalonadas, y secuencias como 24 respuestas a las 20:45, 25 a
// las 20:56 y 75 a las 21:12 — el mismo equipo agotando cupos en cadena). Ahí no hay duda que
// resolver con más datos.
//
// Lo que les pasa NO es un bloqueo de cuenta: se les aplica el límite por dispositivo, o sea que
// las cuentas del mismo equipo comparten los 25 del día en vez de sumar 25 cada una. Siguen
// pudiendo estudiar; lo que dejan de poder es multiplicar el cupo.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { getOrSet } from '@/lib/cache/redis'

/**
 * Segundos de caché. Corto a propósito: la lista cambia cuando alguien revisa una señal, y un
 * minuto de desfase no importa. Lo que importa es no consultar en cada respuesta.
 */
const TTL_SEGUNDOS = 300

/**
 * ¿Está confirmado como fraude este dispositivo, huella o cuenta?
 *
 * Basta con que coincida UNO: quien rota cuentas cambia de correo y de `device_id`, pero no de
 * hardware; y quien borra la cuenta pierde el `user_id` pero no la huella.
 *
 * Fail-open: ante cualquier error devuelve `false`. Un fallo de consulta no puede convertirse en
 * un corte a alguien.
 */
export async function esFraudeConfirmado(opts: {
  userId?: string | null
  deviceId?: string | null
  fingerprint?: string | null
}): Promise<boolean> {
  const fpV2 = opts.fingerprint?.startsWith('fp2_') ? opts.fingerprint : null
  const { userId, deviceId } = opts
  if (!userId && !deviceId && !fpV2) return false

  const clave = `fraude_confirmado:${userId ?? '-'}:${deviceId ?? '-'}:${fpV2 ?? '-'}`
  const res = await getOrSet<boolean>(clave, TTL_SEGUNDOS, async () => {
    try {
      const filas = (await getAdminDb().execute(sql`
        SELECT 1
          FROM fraud_confirmations
         WHERE retention_until > now()
           AND status = 'confirmed'
           AND (
             (${deviceId}::text IS NOT NULL AND device_id = ${deviceId})
             OR (${fpV2}::text IS NOT NULL AND fingerprint = ${fpV2})
             OR (${userId}::text IS NOT NULL AND ${userId}::uuid = ANY(user_ids))
           )
         LIMIT 1
      `)) as unknown as unknown[]
      const rows = Array.isArray(filas) ? filas : ((filas as { rows?: unknown[] })?.rows ?? [])
      return rows.length > 0
    } catch {
      return false // fail-open: nunca cortar por un fallo de consulta
    }
  })
  return res === true
}
