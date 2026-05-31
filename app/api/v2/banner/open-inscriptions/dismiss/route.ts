// app/api/v2/banner/open-inscriptions/dismiss/route.ts
//
// Persiste el dismiss del banner para usuarios autenticados. UPSERT por
// (user_id, oposicion_slug), guardando el boe_reference vigente. Si la
// convocatoria cambia más adelante (nueva BOE), el dismiss queda obsoleto
// y el banner vuelve a aparecer — controlado en el GET sibling.
//
// Anónimos: 200 OK no-op. El cliente gestiona el dismiss en localStorage
// (key: vence_dismissed_inscription_banners, array de slugs).
//
// Roadmap: docs/roadmap/banner-inscripcion-abierta.md

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getServiceClient } from '@/lib/api/shared/auth'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

export const maxDuration = 10

// Slug: letras minúsculas, números y guiones. Mismo formato que oposiciones.slug.
const bodySchema = z.object({
  oposicion_slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/, 'slug inválido'),
})

async function _POST(request: NextRequest) {
  // Parse body con guard.
  let parsed
  try {
    const body = await request.json()
    parsed = bodySchema.safeParse(body)
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 })
  }
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'inválido' }, { status: 400 })
  }

  // Auth opcional. Anon → 200 OK no-op (cliente persiste en localStorage).
  const auth = await verifyAuth(request, '/api/v2/banner/open-inscriptions/dismiss')
  if (!auth.success) {
    return NextResponse.json({ ok: true, persisted: false }, { status: 200 })
  }

  const supabase = getServiceClient()

  // Buscar boe_reference actual para snapshot. Si la oposición ya no
  // existe o está inactiva, persistimos igualmente con boe NULL (el
  // dismiss simplemente no aparecerá en open list futura).
  const { data: opo } = await supabase
    .from('oposiciones')
    .select('boe_reference')
    .eq('slug', parsed.data.oposicion_slug)
    .maybeSingle()

  const { error } = await supabase
    .from('user_inscription_banner_dismissals')
    .upsert(
      {
        user_id: auth.userId,
        oposicion_slug: parsed.data.oposicion_slug,
        boe_reference_at_dismiss: opo?.boe_reference ?? null,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,oposicion_slug' },
    )

  if (error) {
    console.error('❌ [API/banner/dismiss] upsert error:', error)
    return NextResponse.json({ ok: false, error: 'persist failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, persisted: true }, { status: 200 })
}

export const POST = withErrorLogging('/api/v2/banner/open-inscriptions/dismiss', _POST)
