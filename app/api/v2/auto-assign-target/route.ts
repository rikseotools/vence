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
import { getAuthenticatedUser, getServiceClient } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
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

  const supabase = getServiceClient()
  const { data: profile, error: selErr } = await supabase
    .from('user_profiles')
    .select('target_oposicion')
    .eq('id', auth.user.id)
    .single()

  if (selErr) {
    return NextResponse.json({ error: 'Error leyendo perfil' }, { status: 500 })
  }

  if (profile?.target_oposicion) {
    // Ya tiene → no tocar
    return NextResponse.json({ assigned: false, reason: 'already_assigned' })
  }

  const { error: updErr } = await supabase
    .from('user_profiles')
    .update({
      target_oposicion: positionType,
      first_oposicion_detected_at: new Date().toISOString(),
    })
    .eq('id', auth.user.id)

  if (updErr) {
    return NextResponse.json({ error: 'Error asignando' }, { status: 500 })
  }

  console.log('🎯 [auto-assign-target] Asignado', {
    userId: auth.user.id,
    slug: parsed.data.slug,
    positionType,
  })

  return NextResponse.json({ assigned: true, positionType })
}

export const POST = withErrorLogging('/api/v2/auto-assign-target', _POST)
