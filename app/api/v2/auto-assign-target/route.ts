// app/api/v2/auto-assign-target/route.ts
// Endpoint idempotente que auto-asigna target_oposicion al usuario logueado
// si (a) aún es NULL y (b) el slug enviado corresponde a una oposición
// conocida del catálogo.
//
// Contexto: los usuarios que navegan una landing de oposición estando
// logueados pero con target=NULL (no completaron onboarding) se quedaban
// viendo contenido de Estado (default). Este endpoint cierra ese gap
// post-registro. Llamado desde un Client Component montado en la landing.
//
// Complementa al fix de processAuthCallback (que cubre el momento del
// registro con registration_url).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { invalidateProfileCache } from '@/lib/api/profile'
import { OPOSICIONES } from '@/lib/config/oposiciones'

const SLUG_TO_POSITION_TYPE = new Map(OPOSICIONES.map(o => [o.slug, o.positionType]))

const requestSchema = z.object({
  slug: z.string().min(1),
})

async function _POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'slug requerido' }, { status: 400 })
  }

  const positionType = SLUG_TO_POSITION_TYPE.get(parsed.data.slug)
  if (!positionType) {
    // Slug no conocido → no hacemos nada (idempotente, no error)
    return NextResponse.json({ assigned: false, reason: 'unknown_slug' })
  }

  const db = getAdminDb()
  let profile = null
  let selErr = null
  try {
    const [row] = await db
      .select({ target_oposicion: userProfiles.targetOposicion })
      .from(userProfiles)
      .where(eq(userProfiles.id, auth.user.id))
      .limit(1)
    profile = row ?? null
  } catch (e) {
    selErr = e
  }

  if (selErr || !profile) {
    return NextResponse.json({ error: 'Error leyendo perfil' }, { status: 500 })
  }

  if (profile.target_oposicion) {
    // Ya tiene → no tocar
    return NextResponse.json({ assigned: false, reason: 'already_assigned' })
  }

  let updErr = null
  try {
    await db
      .update(userProfiles)
      .set({
        targetOposicion: positionType,
        firstOposicionDetectedAt: new Date().toISOString(),
      })
      .where(eq(userProfiles.id, auth.user.id))
  } catch (e) {
    updErr = e
  }

  if (updErr) {
    return NextResponse.json({ error: 'Error asignando' }, { status: 500 })
  }

  // Invalidar cache (tag 'profile') tras UPDATE OK — sin esto, el user
  // que acaba de aterrizar en la landing vería target_oposicion=null
  // durante hasta 60s y seguiría con contenido por defecto pese a haberlo
  // asignado ya en BD.
  invalidateProfileCache()

  console.log('🎯 [auto-assign-target] Asignado', {
    userId: auth.user.id,
    slug: parsed.data.slug,
    positionType,
  })

  return NextResponse.json({ assigned: true, positionType })
}

export const POST = withErrorLogging('/api/v2/auto-assign-target', _POST)
