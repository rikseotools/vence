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
import { eq } from 'drizzle-orm'
import { getOposicion } from '@/lib/config/oposiciones'
import { withDbTimeout } from '@/lib/db/timeout'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { invalidateProfileCache } from '@/lib/api/profile/queries'

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
function buildCanonicalData(oposicionId: string): Record<string, unknown> {
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
  const data = clearing ? null : buildCanonicalData(oposicionId)

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
