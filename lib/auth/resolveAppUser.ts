// lib/auth/resolveAppUser.ts
// Resuelve el `user_profiles.id` canónico a partir del email del proveedor OAuth.
//
// ES EL PUNTO DE CORRECTITUD MÁS DELICADO de Fase B: toda la data del usuario
// (tests, suscripciones, medallas…) cuelga de `user_profiles.id`. El `sub` del
// token DEBE ser ese UUID existente — NUNCA el `sub` de Google (que es otro).
// Si esto se hace mal, un usuario "hereda" los datos de otro. Verificado en prod
// (2026-07-02): 0 emails duplicados / 0 id-mismatch → el lookup por email es
// inequívoco para los 9256 perfiles.
//
// SERVER-ONLY (getAdminDb). Lo usa el callback `jwt` de Auth.js (lib/auth/authjs.ts).

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'

/**
 * Devuelve el `user_profiles.id` para un email:
 *   - si existe el perfil → su id (case-insensitive por email).
 *   - si NO existe → intenta crearlo (organic) con un UUID nuevo y lo devuelve.
 *   - si no se puede crear (p.ej. FK a auth.users aún viva pre-cutover) → null.
 *
 * Devolver `null` es SEGURO: el emisor no acuñará token sin `sub` válido
 * (`/api/auth/token` responde 503) en vez de emitir un `sub` erróneo.
 */
export async function resolveAppUserId(
  emailRaw: string | null | undefined,
  displayName?: string | null,
): Promise<string | null> {
  const email = (emailRaw || '').trim().toLowerCase()
  if (!email) return null

  const db = getAdminDb()

  // 1. Lookup por email (case-insensitive). Fuente única del `sub`.
  const found = await db.execute(
    sql`SELECT id FROM user_profiles WHERE lower(email) = ${email} LIMIT 1`,
  )
  const existing = (found as unknown as Array<{ id: string }>)[0]
  if (existing?.id) return existing.id

  // 2. Usuario nuevo: crear perfil organic con UUID fresco.
  //    (Los logins reales de usuarios existentes NUNCA llegan aquí; los nuevos
  //    solo se enrutarán por Auth.js tras el re-point de FKs del cutover.)
  const newId = crypto.randomUUID()
  const name = displayName || email.split('@')[0] || null
  try {
    await db.execute(
      sql`SELECT create_organic_user(user_id => ${newId}::uuid, user_email => ${email}, user_name => ${name})`,
    )
    return newId
  } catch (err) {
    // FK a auth.users aún viva (pre-cutover) u otro fallo → no acuñar token.
    console.warn(
      `🔒 [auth/resolveAppUser] no se pudo crear perfil para ${email.slice(0, 3)}***: ${
        err instanceof Error ? err.message : 'error'
      }`,
    )
    return null
  }
}
