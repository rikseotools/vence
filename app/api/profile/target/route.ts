// app/api/profile/target/route.ts
// Fase 8 / arreglo chapuza: ENDPOINT ÚNICO para cambiar la oposición objetivo.
//
// PROBLEMA que resuelve: había 4 write-paths para cambiar target, 2 escribían
// user_profiles DIRECTO por Supabase REST desde el cliente con
// `target_oposicion_data: JSON.stringify(obj)` → JSONB doble-codificado (1298
// filas corruptas) + 4 shapes distintas. Este endpoint es la ÚNICA vía robusta:
//   - Deriva el shape CANÓNICO server-side desde el config (no confía en el
//     cliente) → un solo formato, sin stringify (escribe objeto JSONB real).
//   - Auth por sesión (getAuthenticatedUser) → userId del token, sin IDOR.
//   - El trigger tg_sync_user_oposiciones_seguidas sincroniza target/favoritas.
//
// OBSERVABILIDAD: withErrorLogging hace dual-write a observable_events + Sentry
// ante cualquier throw → un fallo es DETECTABLE. withDbTimeout = quick-fail (no
// cuelga). Escalable: 1 UPDATE indexado por PK.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getOposicion } from '@/lib/config/oposiciones'
import { withDbTimeout } from '@/lib/db/timeout'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { invalidateProfileCache } from '@/lib/api/profile/queries'
import { esObjetivoPersonalizado, idCustomDe } from '@/lib/oposicion/objetivoPersonalizado'
import { nombrePublico } from '@/lib/oposicionPersonalizada/nombrePublico'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 10

const TARGET_UPDATE_TIMEOUT_MS = 8000

/**
 * Shape CANÓNICO de target_oposicion_data. Superset de todas las variantes que
 * leen los consumidores (unos usan `name`, otros `nombre`; todos id/slug/
 * categoria/administracion) → no rompe ningún lector existente.
 * Si la oposición no está en el config (demanda no implementada todavía), se
 * guarda el mínimo {id, name} para capturar la demanda.
 */
async function buildCanonicalData(
  oposicionId: string,
  userId: string,
): Promise<Record<string, unknown>> {
  // [T-327] Oposición PERSONALIZADA: no está en el config —vive en la base de datos— así que su
  // nombre hay que ir a buscarlo. Sin esto, el fallback de abajo guardaría
  // `personalizada_<uuid>` COMO NOMBRE y el usuario vería ese churro en la cabecera y en todos
  // los selectores. Se resuelve aquí, en el ÚNICO punto de escritura, y no en cada llamante:
  // este endpoint existe justamente porque antes había cuatro write-paths divergiendo.
  if (esObjetivoPersonalizado(oposicionId)) {
    const idCustom = idCustomDe(oposicionId)
    try {
      // ACOTADA: pública O tuya. Sin la condición, cualquiera podría fijar como objetivo la
      // oposición PRIVADA de otra persona con solo conocer su id — y de paso leer su nombre.
      // Que sean elegibles por otros es el diseño (`is_public`), pero solo las públicas.
      // Lo pilló el guardarraíl C2 de scoping por usuario, que hizo bien en preguntar.
      const filas = (await getAdminDb().execute(sql`
        SELECT nombre, created_by_username
          FROM custom_oposiciones
         WHERE replace(id::text, '-', '') = ${idCustom}
           AND is_active = true
           AND (is_public = true OR user_id = ${userId}::uuid)
         LIMIT 1
      `)) as unknown as Array<{ nombre: string; created_by_username: string | null }>
      const fila = filas[0]
      if (fila) {
        const nombre = nombrePublico(fila.nombre, fila.created_by_username)
        return { id: oposicionId, name: nombre, nombre, tipo: 'personalizada' }
      }
    } catch {
      // Si la consulta falla se cae al fallback de abajo: guardar el objetivo con un nombre feo
      // es malo, pero perder el cambio que el usuario acaba de pedir es peor.
    }
  }

  const op = getOposicion(oposicionId)
  if (!op) return { id: oposicionId, name: oposicionId, nombre: oposicionId }
  return {
    id: op.id,
    name: op.name,
    nombre: op.name,
    slug: op.slug,
    categoria: op.badge,
    administracion: op.administracion,
  }
}

// PUT { oposicionId }  → fija la oposición objetivo del usuario autenticado.
async function _PUT(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const raw = (body as Record<string, unknown>)?.oposicionId
  // null explícito = limpiar objetivo. string = fijar. Otra cosa = 400.
  const clearing = raw === null
  const oposicionId = typeof raw === 'string' ? raw.trim() : ''
  if (!clearing && !oposicionId) {
    return NextResponse.json(
      { success: false, error: 'oposicionId requerido (string) o null para limpiar' },
      { status: 400 },
    )
  }

  const targetValue = clearing ? null : oposicionId
  const data = clearing ? null : await buildCanonicalData(oposicionId, auth.user.id)

  // Throw en fallo → withErrorLogging lo emite a observable_events (detectable).
  await withDbTimeout(
    () =>
      getAdminDb()
        .update(userProfiles)
        .set({
          targetOposicion: targetValue,
          targetOposicionData: data,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userProfiles.id, auth.user.id)),
    TARGET_UPDATE_TIMEOUT_MS,
  )

  // Invalidar el cache server-side de /api/profile (tag 'profile', TTL 60s).
  // Sin esto, tras cambiar la oposición el GET cacheado seguía sirviendo el
  // perfil viejo (target_oposicion stale) hasta 60s → contribuía a que el
  // contexto leyera una oposición desactualizada. updateProfile() ya lo hace;
  // este write-path (target) faltaba por hacerlo.
  invalidateProfileCache()

  return NextResponse.json({ success: true, data })
}

export const PUT = withErrorLogging('/api/profile/target', _PUT)
