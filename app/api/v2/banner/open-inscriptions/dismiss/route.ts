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
import { getAdminDb } from '@/db/client'
import { oposiciones } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
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

  const db = getAdminDb()

  // Buscar boe_reference actual para snapshot. Si la oposición ya no
  // existe o está inactiva, persistimos igualmente con boe NULL (el
  // dismiss simplemente no aparecerá en open list futura).
  const [opo] = await db
    .select({ boe_reference: oposiciones.boeReference })
    .from(oposiciones)
    .where(eq(oposiciones.slug, parsed.data.oposicion_slug))
    .limit(1)

  // user_inscription_banner_dismissals no está tipada en Drizzle → raw SQL.
  // onConflict (user_id, oposicion_slug) = PK; DO UPDATE de las no-clave.
  let error = null
  try {
    await db.execute(sql`
      INSERT INTO user_inscription_banner_dismissals
        (user_id, oposicion_slug, boe_reference_at_dismiss, dismissed_at)
      VALUES (
        ${auth.userId}::uuid,
        ${parsed.data.oposicion_slug},
        ${opo?.boe_reference ?? null},
        ${new Date().toISOString()}
      )
      ON CONFLICT (user_id, oposicion_slug) DO UPDATE SET
        boe_reference_at_dismiss = EXCLUDED.boe_reference_at_dismiss,
        dismissed_at = EXCLUDED.dismissed_at
    `)
  } catch (e) {
    error = e
  }

  if (error) {
    console.error('❌ [API/banner/dismiss] upsert error:', error)
    return NextResponse.json({ ok: false, error: 'persist failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, persisted: true }, { status: 200 })
}

export const POST = withErrorLogging('/api/v2/banner/open-inscriptions/dismiss', _POST)
