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
import { decidirSub, type DecisionSub } from './canonicalSub'

/**
 * Comprueba que el `sub` de una sesión tiene perfil y, si no, lo reconcilia por email.
 * La decisión vive en `decidirSub` (pura, testeada); aquí solo se hacen las consultas.
 *
 * COSTE EN EL HOT PATH: `/api/auth/token` se acuña en cada tick de sesión (~675k/día), así
 * que el caso bueno paga SOLO un lookup por clave primaria (índice, microsegundos) y ni
 * siquiera mira el email. La consulta por email —que NO usa el índice único porque
 * compara en minúsculas -y por eso tarda- solo se ejecuta cuando el `sub` no existe, que
 * es el caso roto y raro (8 usuarios en 3 semanas). Ver [T-245].
 */
export async function canonicalSubForToken(
  sub: string,
  email: string | null,
): Promise<DecisionSub> {
  const db = getAdminDb()
  const found = await db.execute(sql`SELECT 1 AS ok FROM user_profiles WHERE id = ${sub}::uuid LIMIT 1`)
  const existe = (found as unknown as Array<{ ok: number }>).length > 0
  if (existe) return decidirSub(sub, true, null)

  const porEmail = email ? await resolveProfileIdByEmail(email) : null
  return decidirSub(sub, false, porEmail)
}

/** id del perfil de un email (case-insensitive), o null. Mismo criterio que el primer login. */
async function resolveProfileIdByEmail(emailRaw: string): Promise<string | null> {
  const email = emailRaw.trim().toLowerCase()
  if (!email) return null
  const db = getAdminDb()
  const rows = await db.execute(
    sql`SELECT id FROM user_profiles WHERE lower(email) = ${email} LIMIT 1`,
  )
  return (rows as unknown as Array<{ id: string }>)[0]?.id ?? null
}

/** Por qué salió lo que salió. Lo consume `authjs.ts` para emitir el evento correcto. */
export type MotivoResolucion =
  | 'existia'            // el perfil ya estaba
  | 'creado'             // se creó ahora
  | 'creado_por_otro'    // carrera: otra petición lo creó primero y se releyó el suyo
  | 'sin_email'          // no hay email: no se puede ni intentar
  | 'error_lectura'      // falló la CONSULTA. NO se crea nada: podría duplicar a un usuario
  | 'error_creacion'     // falló la creación por un motivo que no es la carrera

export interface ResultadoResolucion {
  id: string | null
  motivo: MotivoResolucion
  /** Mensaje del error, recortado. Solo cuando el motivo es un fallo. */
  detalle?: string
}

/** Postgres: violación de restricción única. */
const UNIQUE_VIOLATION = '23505'

/**
 * Resuelve el `user_profiles.id` de un email, creándolo si hace falta, y **dice por qué**.
 *
 * ── DOS AGUJEROS DE ROBUSTEZ QUE ESTA VERSIÓN CIERRA (T-434, 01/08/2026) ────────────────────
 *
 * 1. **La CONSULTA estaba fuera del `try`.** Si fallaba, la excepción se propagaba hasta el
 *    callback `jwt` de Auth.js, que no la espera. Ahora se captura y se devuelve
 *    `error_lectura` — y, muy a propósito, **NO se intenta crear nada**: si no sabemos si el
 *    perfil existe, crearlo puede duplicar a un usuario, que es el peor fallo posible aquí (la
 *    cabecera de este fichero lo dice: «un usuario hereda los datos de otro»).
 *
 * 2. **La carrera entre peticiones simultáneas.** Con el reintento de T-434, varias pestañas del
 *    mismo usuario roto pueden llegar a la vez: todas leen «no existe» y todas intentan crear.
 *    El `ON CONFLICT (id)` de `create_organic_user` NO las protege, porque cada una trae un UUID
 *    distinto; quien las corta es el índice único sobre `lower(email)`
 *    (`20260801_user_profiles_email_lower_unique.sql`). Las perdedoras reciben **23505**, y eso
 *    **no es un fallo**: significa «otro lo creó primero». Se relee y se devuelve ESE id, que es
 *    el correcto. Sin esto, el reintento convertiría una reparación en un error intermitente.
 */
export async function resolverPerfilPorEmail(
  emailRaw: string | null | undefined,
  displayName?: string | null,
): Promise<ResultadoResolucion> {
  const email = (emailRaw || '').trim().toLowerCase()
  if (!email) return { id: null, motivo: 'sin_email' }

  // OJO: `getAdminDb()` **lanza** si falta `DATABASE_URL` (`db/client.ts`), así que va DENTRO
  // del try igual que la consulta. Fuera, la excepción subiría al callback `jwt` de Auth.js —
  // y desde T-434 esto ya no corre solo en el alta, sino en CADA carga de página de un usuario
  // sin perfil. O sea: el mismo despiste que antes rompía un sign-in raro, ahora dejaría a esas
  // personas sin poder ABRIR la web. Un reintento capaz de tumbar la sesión que viene a reparar
  // es peor que no reintentar.
  let db: ReturnType<typeof getAdminDb>
  try {
    db = getAdminDb()
  } catch (err) {
    return { id: null, motivo: 'error_lectura', detalle: recorta(err) }
  }

  // 1. Lookup por email (case-insensitive). Fuente única del `sub`.
  //    Desde el índice funcional de T-434 esto es un Index Scan (~3 ms); antes era un Seq Scan
  //    de 426 ms sobre la tabla entera, y estaba en el camino crítico de cada sign-in.
  let existente: string | null = null
  try {
    const found = await db.execute(
      sql`SELECT id FROM user_profiles WHERE lower(email) = ${email} LIMIT 1`,
    )
    existente = (found as unknown as Array<{ id: string }>)[0]?.id ?? null
  } catch (err) {
    return { id: null, motivo: 'error_lectura', detalle: recorta(err) }
  }
  if (existente) return { id: existente, motivo: 'existia' }

  // 2. No existe: crear perfil organic con UUID fresco.
  const newId = crypto.randomUUID()
  const name = displayName || email.split('@')[0] || null
  try {
    await db.execute(
      sql`SELECT create_organic_user(user_id => ${newId}::uuid, user_email => ${email}, user_name => ${name})`,
    )
    return { id: newId, motivo: 'creado' }
  } catch (err) {
    // 2.bis Carrera: otro lo creó entre nuestra lectura y nuestra escritura. Se relee su id.
    if (esViolacionUnica(err)) {
      try {
        const rows = await db.execute(
          sql`SELECT id FROM user_profiles WHERE lower(email) = ${email} LIMIT 1`,
        )
        const ganador = (rows as unknown as Array<{ id: string }>)[0]?.id ?? null
        if (ganador) return { id: ganador, motivo: 'creado_por_otro' }
      } catch {
        /* si la relectura también falla, cae abajo como error de creación */
      }
    }
    return { id: null, motivo: 'error_creacion', detalle: recorta(err) }
  }
}

function esViolacionUnica(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code
  if (code === UNIQUE_VIOLATION) return true
  // Drizzle/postgres-js a veces envuelven el error; el código viaja en la causa.
  const causa = (err as { cause?: { code?: unknown } })?.cause
  return causa?.code === UNIQUE_VIOLATION
}

function recorta(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200)
}

/**
 * Compatibilidad: mismo contrato de siempre (`id` o `null`).
 *
 * Se conserva porque devolver `null` sigue siendo SEGURO para quien solo quiera el id: el emisor
 * no acuña token sin `sub` válido (`/api/auth/token` responde 503) en vez de emitir uno erróneo.
 * Quien necesite saber **por qué** —para emitir el evento correcto— debe usar
 * `resolverPerfilPorEmail`, que es donde vive la información.
 */
export async function resolveAppUserId(
  emailRaw: string | null | undefined,
  displayName?: string | null,
): Promise<string | null> {
  return (await resolverPerfilPorEmail(emailRaw, displayName)).id
}
