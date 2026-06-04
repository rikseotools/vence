// app/api/profile/seguidas/route.ts
// Fase 8 (alertas usuario): gestión de oposiciones seguidas (target + favoritas).
//
// La tabla user_oposiciones_seguidas tiene RLS-lockdown (sin políticas) → el
// cliente NO puede escribir por Supabase REST. Toda lectura/escritura pasa por
// este endpoint con getAdminDb (conexión privilegiada que bypasa RLS).
//
// El userId SIEMPRE se deriva de la sesión autenticada (getAuthenticatedUser),
// nunca del cliente → sin IDOR.
//
// El 'target' lo gestiona el trigger tg_sync_user_oposiciones_seguidas al
// cambiar user_profiles.target_oposicion. Este endpoint gestiona las FAVORITAS
// (añadir / borrar) y lista todo lo seguido.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { userOposicionesSeguidas, oposiciones } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 10

async function listSeguidas(userId: string) {
  const db = getAdminDb()
  const rows = await db
    .select({
      id: userOposicionesSeguidas.id,
      oposicionId: userOposicionesSeguidas.oposicionId,
      rol: userOposicionesSeguidas.rol,
      notifyBell: userOposicionesSeguidas.notifyBell,
      notifyEmail: userOposicionesSeguidas.notifyEmail,
      slug: oposiciones.slug,
      nombre: oposiciones.nombre,
      isActive: oposiciones.isActive,
    })
    .from(userOposicionesSeguidas)
    .innerJoin(oposiciones, eq(oposiciones.id, userOposicionesSeguidas.oposicionId))
    .where(eq(userOposicionesSeguidas.userId, userId))
  // target primero, luego favoritas por nombre.
  rows.sort((a, b) => {
    if (a.rol !== b.rol) return a.rol === 'target' ? -1 : 1
    return (a.nombre ?? '').localeCompare(b.nombre ?? '')
  })
  return rows
}

// GET ?  → lista de oposiciones seguidas del usuario autenticado.
async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const data = await listSeguidas(auth.user.id)
  return NextResponse.json({ success: true, data })
}

// POST { oposicionSlug }  → añade una favorita.
async function _POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const slug = typeof body?.oposicionSlug === 'string' ? body.oposicionSlug.trim() : ''
  if (!slug) {
    return NextResponse.json({ success: false, error: 'oposicionSlug requerido' }, { status: 400 })
  }

  const db = getAdminDb()
  const [op] = await db
    .select({ id: oposiciones.id })
    .from(oposiciones)
    .where(eq(oposiciones.slug, slug))
    .limit(1)
  if (!op) {
    return NextResponse.json({ success: false, error: 'Oposición no encontrada' }, { status: 404 })
  }

  // Insert como favorita. Si ya existe (target o favorita) no se toca el rol:
  // nunca degradamos un target a favorita por error desde aquí.
  await db
    .insert(userOposicionesSeguidas)
    .values({ userId: auth.user.id, oposicionId: op.id, rol: 'favorita' })
    .onConflictDoNothing({
      target: [userOposicionesSeguidas.userId, userOposicionesSeguidas.oposicionId],
    })

  const data = await listSeguidas(auth.user.id)
  return NextResponse.json({ success: true, data })
}

// DELETE { oposicionId }  → quita una FAVORITA (nunca el target).
async function _DELETE(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const oposicionId = typeof body?.oposicionId === 'string' ? body.oposicionId.trim() : ''
  if (!oposicionId) {
    return NextResponse.json({ success: false, error: 'oposicionId requerido' }, { status: 400 })
  }

  const db = getAdminDb()
  // Solo se borran favoritas: el target se gestiona cambiando la oposición objetivo.
  await db
    .delete(userOposicionesSeguidas)
    .where(
      and(
        eq(userOposicionesSeguidas.userId, auth.user.id),
        eq(userOposicionesSeguidas.oposicionId, oposicionId),
        eq(userOposicionesSeguidas.rol, 'favorita'),
      ),
    )

  const data = await listSeguidas(auth.user.id)
  return NextResponse.json({ success: true, data })
}

export const GET = withErrorLogging('/api/profile/seguidas', _GET)
export const POST = withErrorLogging('/api/profile/seguidas', _POST)
export const DELETE = withErrorLogging('/api/profile/seguidas', _DELETE)
